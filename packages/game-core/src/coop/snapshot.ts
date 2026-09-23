import { adventureContent, contentWithLoadouts, restoreProgress } from './progression';
import type { CoopActor, CoopBattle, CoopState, GameContent, GridPoint, MovementState, RoamingGroup, RoamingMob, WorldActor } from '@shards/shared';
import { startHeroBody } from '../anatomy';
import { hashValue } from '../canonical';
import { isCurrentShippedContent, restoreContentHash } from '../content-hash';
import { restoreSavedHeroBody } from '../snapshot-body';
import { getDifficultyProfile, restoreDifficultyId } from '../difficulty';
import { createRoomRng } from '../random';
import { deserializeSnapshot } from '../snapshot';
import { array, finite, integer, oneOf, record, same, string } from '../snapshot-values';
import { validateActorIds } from '../world/movement';
import { createMovementState, validateMovementBonus } from '../world/movement-speed';
import { coopPartyFailed } from './battles';
import { coopBattleDiceOwners, coopBattleRng } from './entity-dice';
import { restoreSeasonBosses } from './boss-snapshot';

const fields = ['version', 'contentHash', 'seed', 'difficultyId', 'characterIds', 'tick', 'diceIndex', 'diceCounters', 'actors', 'groups', 'battles',
  'killedEnemyIds', 'interactedStructureIds', 'removedRewardIds', 'completed', 'failed', 'progression', 'worldVersion', 'bosses'] as const;

function ids(value: unknown, label: string, max = 100_000): string[] {
  const result = array(value, label, max).map(id => string(id, label, 1024));
  if (new Set(result).size !== result.length) throw new Error(`Duplicate co-op IDs: ${label}`);
  return result;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid co-op ${label}`);
  return value;
}

function point(value: unknown): GridPoint {
  const data = record(value, 'point', ['x', 'y']);
  return { x: integer(data.x, 'point.x', 0, 1024), y: integer(data.y, 'point.y', 0, 1024) };
}

function movement(value: unknown): MovementState | undefined {
  if (value === undefined) return undefined;
  const data = record(value, 'movement', ['baseSpeed', 'bonusPercent', 'bootsBonusPercent', 'elapsedMs']);
  const bonusPercent = finite(data.bonusPercent, 'movement.bonusPercent');
  validateMovementBonus(bonusPercent);
  const bootsBonusPercent = data.bootsBonusPercent === undefined ? undefined : finite(data.bootsBonusPercent, 'movement.bootsBonusPercent');
  if (bootsBonusPercent !== undefined) validateMovementBonus(bootsBonusPercent);
  return { ...createMovementState(finite(data.baseSpeed, 'movement.baseSpeed')), bonusPercent,
    ...(bootsBonusPercent === undefined ? {} : { bootsBonusPercent }), elapsedMs: finite(data.elapsedMs, 'movement.elapsedMs', 0) };
}

function actor(data: Record<string, unknown>): WorldActor {
  return { id: string(data.id, 'actor.id'), position: point(data.position), path: array(data.path, 'actor.path', 1225).map(point),
    ...(data.movement === undefined ? {} : { movement: movement(data.movement) }) };
}

/** Keep hero progress; accept and discard enemy bank entries from older saves. */
function restoreDiceCounters(value: unknown, characterIds: readonly string[], visited: readonly string[]): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid co-op dice counters');
  const entries = Object.entries(value);
  if (entries.length > 100_000) throw new Error('Co-op dice counters exceed maximum size');
  const heroes = new Set(characterIds.map(id => `hero:${id}`));
  const chunks = new Set(visited);
  const counters: Record<string, number> = {};
  for (const [owner, count] of entries) {
    string(owner, 'coop.diceCounters.owner', 1024);
    if (!heroes.has(owner)) {
      const enemy = /^enemy:(.+):roaming:(\d+):(\d+)$/.exec(owner);
      if (!enemy || !chunks.has(enemy[1])) throw new Error('Unknown co-op dice owner');
      integer(Number(enemy[2]), 'coop.diceCounters.group');
      integer(Number(enemy[3]), 'coop.diceCounters.member');
    }
    const index = integer(count, `coop.diceCounters.${owner}`);
    if (heroes.has(owner)) counters[owner] = index;
  }
  return counters;
}

function restoreGroup(value: unknown, characterIds: string[], content: GameContent): RoamingGroup {
  const data = record(value, 'group', ['id', 'category', 'chases', 'members', 'home', 'mode', 'targetActorId', 'decision', 'pauseMs']);
  const targetActorId = data.targetActorId === null ? null : string(data.targetActorId, 'group.targetActorId');
  if (targetActorId !== null && !characterIds.includes(targetActorId)) throw new Error('Unknown co-op pursuit target');
  const members: RoamingMob[] = array(data.members, 'group.members', 16).map(value => {
    const mob = record(value, 'mob', ['id', 'definitionId', 'position', 'path', 'movement']);
    const definitionId = string(mob.definitionId, 'mob.definitionId');
    if (!content.enemies.some(enemy => enemy.id === definitionId)) throw new Error('Unknown co-op enemy');
    return { ...actor(mob), definitionId };
  });
  if (!members.length || new Set(members.map(mob => mob.id)).size !== members.length) throw new Error('Invalid co-op mob roster');
  return { id: string(data.id, 'group.id'), category: oneOf(data.category, ['normal', 'epic', 'miniboss'], 'group.category'),
    chases: boolean(data.chases, 'group.chases'), home: point(data.home), mode: oneOf(data.mode, ['patrol', 'chase'], 'group.mode'),
    targetActorId, members, decision: integer(data.decision, 'group.decision'), pauseMs: finite(data.pauseMs, 'group.pauseMs', 0, 60_000) };
}

/** A save is room dynamics only. Static geometry is never copied into the payload. */
export function serializeCoop(state: CoopState): string {
  const data = Object.fromEntries(fields.map(field => [field, state[field]]));
  data.bodyVersion = 2;
  if (state.diceCounters !== undefined) {
    const heroes = new Set(state.characterIds.map(id => `hero:${id}`));
    data.diceCounters = Object.fromEntries(Object.entries(state.diceCounters).filter(([owner]) => heroes.has(owner)));
  }
  // Enemy counters belong only to these still-present battles, including a
  // finished battle awaiting dismissal. No enemy history enters the room bank.
  data.battles = state.battles.map(battle => ({ ...battle, combat: { ...battle.combat, events: battle.combat.events.slice(-128) } }));
  return JSON.stringify(data);
}

/** Lightweight boundary checks; live frames never run the full combat save decoder. */
export function deserializeCoop(json: string, content: GameContent): CoopState {
  if (typeof json !== 'string' || json.length > 32_000_000) throw new Error('Co-op snapshot exceeds maximum size');
  const data = record(JSON.parse(json), 'coop', [...fields, 'bodyVersion']);
  same(data.version, 1, 'coop.version');
  const legacyBodies = data.bodyVersion === undefined;
  if (!legacyBodies) same(data.bodyVersion, 2, 'coop.bodyVersion');
  if (data.contentHash !== undefined) restoreContentHash(data.contentHash, content, 'coop.contentHash');
  else if (!legacyBodies || !isCurrentShippedContent(content)) throw new Error('Missing co-op content version');
  const seed = string(data.seed, 'coop.seed');
  const difficultyId = restoreDifficultyId(data.difficultyId);
  getDifficultyProfile(content, difficultyId);
  const characterIds = ids(data.characterIds, 'coop.characterIds', 4);
  validateActorIds(characterIds);
  if (characterIds.some(id => !content.characters.some(hero => hero.id === id))) throw new Error('Unknown saved co-op hero');
  const tick = integer(data.tick, 'coop.tick');
  const diceIndex = integer(data.diceIndex, 'coop.diceIndex');
  createRoomRng(seed, diceIndex);
  const progression = restoreProgress(data.progression, content, characterIds, tick);
  const equippedContent = adventureContent({ progression }, content);
  const actors: CoopActor[] = array(data.actors, 'coop.actors', 4).map(value => {
    const saved = record(value, 'actor', ['id', 'position', 'path', 'movement', 'body', 'chunkId', 'visited', 'transitions']);
    const restored = actor(saved);
    const definition = equippedContent.characters.find(hero => hero.id === restored.id);
    if (!definition || !characterIds.includes(restored.id)) throw new Error('Hero is outside the original co-op pool');
    const chunkId = string(saved.chunkId, 'actor.chunkId');
    const visited = ids(saved.visited, 'actor.visited');
    if (!visited.includes(chunkId)) throw new Error('Current co-op chunk has not been visited');
    return { ...restored, body: restoreSavedHeroBody(saved.body, startHeroBody(definition), legacyBodies), chunkId, visited,
      // Trusted late inputs can deliver a chunk crossing between host ticks.
      transitions: integer(saved.transitions, 'actor.transitions') };
  });
  if (actors.length !== characterIds.length || new Set(actors.map(hero => hero.id)).size !== actors.length) throw new Error('Co-op save lost its original hero pool');
  const visited = [...new Set(actors.flatMap(hero => hero.visited))];
  // Absence identifies the old shared room sequence. The sparse bank persists
  // heroes only; enemy draws resume from each currently displayed battle.
  const legacyDice = data.diceCounters === undefined;
  const diceCounters: Record<string, number> = legacyDice ? {} : restoreDiceCounters(data.diceCounters, characterIds, visited);
  const savedGroups = record(data.groups, 'coop.groups', visited);
  const groups: Record<string, RoamingGroup[]> = {};
  const allMobs = new Set<string>();
  for (const [chunkId, saved] of Object.entries(savedGroups)) {
    groups[chunkId] = array(saved, 'coop.groups', 68).map(group => restoreGroup(group, characterIds, content));
    if (new Set(groups[chunkId].map(group => group.id)).size !== groups[chunkId].length) throw new Error('Duplicate co-op group');
    for (const mob of groups[chunkId].flatMap(group => group.members)) {
      if (allMobs.has(mob.id)) throw new Error('Duplicate co-op mob');
      allMobs.add(mob.id);
    }
  }
  if (actors.some(hero => !groups[hero.chunkId])) throw new Error('Missing occupied co-op chunk');
  const reservedActors = new Set<string>();
  const reservedMobs = new Set<string>();
  const battles: CoopBattle[] = array(data.battles, 'coop.battles', 4).map(value => {
    const saved = record(value, 'battle', ['id', 'chunkId', 'actorIds', 'initialActorIds', 'mobIds', 'initiatorActorId', 'initiatorMobId', 'combat', 'playing', 'speed', 'elapsedMs', 'presentationMs', 'presentationUntilTick', 'loadouts']);
    const chunkId = string(saved.chunkId, 'battle.chunkId');
    const actorIds = ids(saved.actorIds, 'battle.actorIds', 4);
    const initialActorIds = saved.initialActorIds === undefined ? undefined : ids(saved.initialActorIds, 'battle.initialActorIds', 4);
    if (initialActorIds && (!initialActorIds.length || initialActorIds.some((id, index) => actorIds[index] !== id))) throw new Error('Invalid original co-op battle roster');
    const mobIds = ids(saved.mobIds, 'battle.mobIds', 16);
    if (!actorIds.length || !mobIds.length || actorIds.some(id => !actors.some(hero => hero.id === id))
      || mobIds.some(id => reservedMobs.has(id) || !groups[chunkId]?.some(group => group.members.some(mob => mob.id === id)))) throw new Error('Invalid co-op battle participants');
    mobIds.forEach(id => reservedMobs.add(id));
    const initiatorActorId = string(saved.initiatorActorId, 'battle.initiatorActorId');
    const initiatorMobId = string(saved.initiatorMobId, 'battle.initiatorMobId');
    if (!actorIds.includes(initiatorActorId) || !mobIds.includes(initiatorMobId)) throw new Error('Invalid co-op battle initiator');
    const loadouts = saved.loadouts as CoopBattle['loadouts'];
    const combat = deserializeSnapshot(JSON.stringify(saved.combat), contentWithLoadouts(content, loadouts), { allowTruncatedEvents: true, enemyScalingPartySize: initialActorIds?.length });
    for (const id of actorIds) {
      if (combat.units.some(unit => unit.team === 'heroes' && unit.definitionId === id && unit.escaped)) continue;
      if (reservedActors.has(id) || !actors.some(hero => hero.id === id && hero.chunkId === chunkId)) throw new Error('Invalid active co-op participant');
      reservedActors.add(id);
    }
    if (combat.seed !== seed || combat.difficultyId !== difficultyId || combat.encounterId !== 'roaming'
      || combat.characterIds.join(',') !== actorIds.join(',') || combat.enemyIds?.join(',') !== mobIds.map(id => groups[chunkId].flatMap(group => group.members).find(mob => mob.id === id)!.definitionId).join(',')
      || combat.rng.diceIndex === undefined) throw new Error('Combat does not match its co-op room');
    if (legacyDice) {
      if (combat.rng.diceIndex > diceIndex) throw new Error('Combat does not match its legacy co-op dice count');
      // A legacy aggregate cannot be attributed to individual entities. Each
      // owner starts a deterministic fresh sequence, while the old aggregate
      // remains available for diagnostics and local battle event continuity.
      combat.rng = coopBattleRng({ seed, diceCounters }, combat, mobIds);
    } else {
      const entityDice = combat.rng.entityDice;
      if (!entityDice || combat.rng.diceOwner !== undefined) throw new Error('Missing co-op battle entity dice');
      const expectedOwners = coopBattleDiceOwners(combat, mobIds);
      for (const [unitId, owner] of Object.entries(expectedOwners)) {
        if (entityDice.owners[unitId] !== owner
          || owner.startsWith('hero:') && entityDice.counters[owner] > (diceCounters[owner] ?? 0)) {
          throw new Error('Combat dice do not match their persistent co-op owners');
        }
      }
    }
    return { loadouts, id: string(saved.id, 'battle.id'), chunkId, actorIds, ...(initialActorIds ? { initialActorIds } : {}), mobIds, initiatorActorId, initiatorMobId, combat,
      elapsedMs: finite(saved.elapsedMs, 'battle.elapsedMs', 0),
      ...(saved.presentationMs === undefined ? {} : { presentationMs: finite(saved.presentationMs, 'battle.presentationMs', 0) }),
      ...(saved.presentationUntilTick === undefined ? {} : { presentationUntilTick: integer(saved.presentationUntilTick, 'battle.presentationUntilTick') }) };
  });
  if (new Set(battles.map(battle => battle.id)).size !== battles.length) throw new Error('Duplicate co-op battle');
  const state: CoopState = { worldVersion: data.worldVersion === undefined ? 2 : integer(data.worldVersion, 'coop.worldVersion', 1, 3) as 1 | 2 | 3, progression, version: 1, contentHash: hashValue(content), seed, difficultyId, characterIds, tick, diceIndex, diceCounters, actors, groups, battles,
    killedEnemyIds: ids(data.killedEnemyIds, 'coop.killedEnemyIds'), interactedStructureIds: ids(data.interactedStructureIds, 'coop.interactedStructureIds'),
    removedRewardIds: ids(data.removedRewardIds, 'coop.removedRewardIds'), completed: boolean(data.completed, 'coop.completed'), failed: boolean(data.failed, 'coop.failed') };
  const bosses = restoreSeasonBosses(data.bosses, state, content);
  if (bosses) state.bosses = bosses;
  if (state.failed !== coopPartyFailed(state)) throw new Error('Invalid co-op defeat state');
  // Older saves could mark the final boss's death as victory after the last
  // hero died in the same turn. Preserve the casualties and normalize the outcome.
  if (state.failed) state.completed = false;
  return state;
}
