import type { DifficultyId, ExplorationState, GameContent, GridPoint, RoamingEncounter, RoamingGroup, RoamingState, WorldChunk } from '@shards/shared';
import { generateRoamingGroups } from '../roaming';
import { generateChunk } from '../world/chunk';
import { distance, isWalkable } from '../world/grid';
import { chunkRegions, regionAt } from '../world/regions';
import { movementStepMs } from '../world/movement-speed';
import { array, finite, integer, oneOf, record, same, string } from '../snapshot-values';

function point(value: unknown, chunk: WorldChunk): GridPoint {
  const data = record(value, 'mob.position', ['x', 'y']);
  const result = { x: integer(data.x, 'mob.x', 1, chunk.size - 2), y: integer(data.y, 'mob.y', 1, chunk.size - 2) };
  if (!isWalkable(chunk, result)) throw new Error('Mob occupies an obstacle');
  return result;
}

function restoreGroup(value: unknown, expected: RoamingGroup[], chunk: WorldChunk, world: ExplorationState): RoamingGroup {
  const data = record(value, 'group', ['id', 'category', 'chases', 'members', 'home', 'mode', 'targetActorId', 'decision', 'pauseMs']);
  const id = string(data.id, 'group.id');
  const original = expected.find(group => group.id === id);
  if (!original) throw new Error('Unknown roaming group');
  same(data.category, original.category, 'group.category'); same(data.chases, original.chases, 'group.chases');
  const home = point(data.home, chunk);
  const mode = oneOf(data.mode, ['patrol', 'chase'] as const, 'group.mode');
  const targetActorId = data.targetActorId === null ? null : string(data.targetActorId, 'group.targetActorId');
  if (targetActorId !== null && !world.actors.some(actor => actor.id === targetActorId)
    || mode === 'chase' && !targetActorId || mode === 'patrol' && targetActorId !== null) throw new Error('Invalid pursuit target');
  const regions = chunkRegions(chunk);
  const members = array(data.members, 'group.members', 4).map((value, index) => {
    const mob = record(value, 'mob', ['id', 'definitionId', 'position', 'path', 'movement']);
    const template = original.members[index];
    if (!template) throw new Error('Too many group members');
    same(mob.id, template.id, 'mob.id'); same(mob.definitionId, template.definitionId, 'mob.definitionId');
    const position = point(mob.position, chunk);
    if (regionAt(chunk, regions, position) !== regionAt(chunk, regions, home)) throw new Error('Mob changed disconnected region');
    const path = array(mob.path, 'mob.path', chunk.size * chunk.size).map(value => point(value, chunk));
    let previous = position;
    const visited = new Set([`${position.x},${position.y}`]);
    for (const next of path) {
      const key = `${next.x},${next.y}`;
      if (distance(previous, next) !== 1 || visited.has(key)) throw new Error('Invalid mob path');
      visited.add(key); previous = next;
    }
    const timing = record(mob.movement, 'mob.movement', ['baseSpeed', 'bonusPercent', 'elapsedMs']);
    same(timing.baseSpeed, template.movement!.baseSpeed, 'mob.speed'); same(timing.bonusPercent, 0, 'mob.bonus');
    const member = { ...template, position, path, movement: { ...template.movement!, elapsedMs: finite(timing.elapsedMs, 'mob.elapsedMs', 0) } };
    const next = path[0];
    const terrain = next ? chunk.tiles[next.y * chunk.size + next.x].terrain : undefined;
    const duration = movementStepMs(member, terrain);
    if (member.movement.elapsedMs >= duration) {
      // Older mobs spent twice as long entering bushes. Normalize an otherwise
      // valid old partial step, while current saves retain their exact clock.
      if (terrain === 'bush' && member.movement.elapsedMs < duration * 2) member.movement.elapsedMs /= 2;
      else throw new Error('Invalid mob movement progress');
    }
    return member;
  });
  if (members.length !== original.members.length) throw new Error('Incomplete group roster');
  return { ...original, home, mode, targetActorId, members, decision: integer(data.decision, 'group.decision'), pauseMs: finite(data.pauseMs, 'group.pauseMs', 0, 60_000) };
}

export function restoreRoaming(value: unknown, world: ExplorationState, content: GameContent, difficultyId: DifficultyId = 'normal'): RoamingState {
  const data = record(value, 'roaming', ['version', 'chunks', 'battleSerial', 'active']);
  same(data.version, 1, 'roaming.version');
  const chunks = record(data.chunks, 'roaming.chunks', world.visited);
  const restored: Record<string, RoamingGroup[]> = {};
  for (const [id, groups] of Object.entries(chunks)) {
    const chunk = id === world.currentChunkId ? world.chunk : generateChunk(world.graph, id);
    const expected = generateRoamingGroups(world.graph.seed, chunk, content, difficultyId);
    restored[id] = array(groups, 'roaming.groups', 4).map(group => restoreGroup(group, expected, chunk, world));
    if (new Set(restored[id].map(group => group.id)).size !== restored[id].length) throw new Error('Duplicate mob group');
  }
  if (!restored[world.currentChunkId] || !restored[world.graph.startId]) throw new Error('Missing roaming chunk');
  let active: RoamingEncounter | null = null;
  if (data.active !== null) {
    const item = record(data.active, 'roaming.active', ['groupIds', 'mobId', 'actorId', 'enemyIds', 'triggerRadius', 'includePursuers']);
    if (item.triggerRadius !== undefined) same(item.triggerRadius, 1, 'active.triggerRadius');
    if (item.includePursuers !== undefined) same(item.includePursuers, true, 'active.includePursuers');
    const groupIds = array(item.groupIds, 'active.groupIds', 4).map(id => string(id, 'active.groupId'));
    const groups = groupIds.map(id => restored[world.currentChunkId].find(group => group.id === id));
    if (!groups.length || groups.some(group => !group) || new Set(groupIds).size !== groupIds.length) throw new Error('Invalid battle groups');
    const mobId = string(item.mobId, 'active.mobId'); const actorId = string(item.actorId, 'active.actorId');
    if (!groups.some(group => group!.members.some(mob => mob.id === mobId)) || !world.actors.some(actor => actor.id === actorId)) throw new Error('Invalid encounter initiator');
    const enemyIds = array(item.enemyIds, 'active.enemyIds', 16).map(id => string(id, 'active.enemyId'));
    same(enemyIds.join(','), groups.flatMap(group => group!.members.map(mob => mob.definitionId)).join(','), 'active.roster');
    active = { groupIds, mobId, actorId, enemyIds, ...(item.triggerRadius === 1 ? { triggerRadius: 1 as const } : {}),
      ...(item.includePursuers === true ? { includePursuers: true as const } : {}) };
  }
  return { version: 1, chunks: restored, battleSerial: integer(data.battleSerial, 'roaming.battleSerial'), active };
}
