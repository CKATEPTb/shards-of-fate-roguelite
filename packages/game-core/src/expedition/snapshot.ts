import { serializeCoop, deserializeCoop } from '../coop/snapshot';
import { coopView } from '../coop/view';
import type { ExpeditionState, GameContent } from '@shards/shared';
import { deserializeSnapshot, serializeSnapshot } from '../snapshot';
import { hashValue } from '../canonical';
import { restoreContentHash } from '../content-hash';
import { array, integer, record, same, string } from '../snapshot-values';
import { deserializeExploration, serializeExploration } from '../world';
import { planChunk } from '../world/plan';
import { encounterSeed } from './expedition';
import { initializeMovementSpeeds } from './movement-speeds';
import { restoreRoaming } from './roaming-snapshot';
import { roamingBattleSeed } from './roaming';
import { findRoamingEncounter } from '../roaming';
import { initializePartyBodies } from './party-health';
import { restoreHeroBody, startHeroBody } from '../anatomy';
import { getDifficultyProfile, restoreDifficultyId } from '../difficulty';

export function serializeExpedition(state: ExpeditionState, content: GameContent): string {
  if (state.cooperative) return JSON.stringify({ version: 2, cooperative: serializeCoop(state.cooperative), actorId: state.world.actors[0].id });
  return JSON.stringify({ version: 1, difficultyId: state.difficultyId ?? 'normal', contentHash: hashValue(content), world: serializeExploration(state.world), clearedPoiIds: state.clearedPoiIds, activePoiId: state.activePoiId, combat: state.combat ? serializeSnapshot(state.combat) : null, completed: state.completed, diceCounters: state.diceCounters ?? {}, ...(state.failed !== undefined ? { failed: state.failed } : {}), ...(state.roaming ? { roaming: state.roaming } : {}) });
}

export function deserializeExpedition(json: string, content: GameContent): ExpeditionState {
  if (typeof json !== 'string' || json.length > 32_000_000) throw new Error('Expedition snapshot exceeds maximum size');
  const parsed = JSON.parse(json);
  if (parsed?.version === 2 && typeof parsed.cooperative === 'string') {
    const cooperative = deserializeCoop(parsed.cooperative, content);
    return { ...coopView(cooperative, parsed.actorId, content), cooperative };
  }
  const value = record(parsed, 'expedition', ['version', 'difficultyId', 'contentHash', 'world', 'clearedPoiIds', 'activePoiId', 'combat', 'completed', 'failed', 'roaming', 'diceCounters']);
  same(value.version, 1, 'expedition.version');
  restoreContentHash(value.contentHash, content, 'expedition.contentHash');
  const difficultyId = restoreDifficultyId(value.difficultyId);
  getDifficultyProfile(content, difficultyId);
  const decodedWorld = deserializeExploration(string(value.world, 'expedition.world', 2_000_000));
  if (decodedWorld.actors.some(actor => !content.characters.some(unit => unit.id === actor.id))) throw new Error('Unknown expedition character');
  for (const actor of decodedWorld.actors) if (actor.body) restoreHeroBody(actor.body, startHeroBody(content.characters.find(unit => unit.id === actor.id)!));
  const world = initializePartyBodies(initializeMovementSpeeds(decodedWorld, content), content);
  const savedCounters = record(value.diceCounters ?? {}, 'expedition.diceCounters', world.actors.map(actor => `hero:${actor.id}`));
  const diceCounters = Object.fromEntries(Object.entries(savedCounters).map(([owner, count]) => [owner, integer(count, `diceCounters.${owner}`)]));
  if (value.failed !== undefined && typeof value.failed !== 'boolean') throw new Error('Invalid expedition outcome');
  const clearedPoiIds = array(value.clearedPoiIds, 'clearedPoiIds', world.graph.nodes.length + 1).map((id, index) => string(id, `clearedPoiIds[${index}]`));
  if (new Set(clearedPoiIds).size !== clearedPoiIds.length) throw new Error('Invalid cleared points');
  const visited = new Set(world.visited);
  const nodes = new Map(world.graph.nodes.map(node => [node.id, node]));
  for (const id of clearedPoiIds) {
    const nodeId = id.slice(0, id.lastIndexOf(':')); const node = nodes.get(nodeId);
    if (!node || !visited.has(nodeId)) throw new Error('Cleared point belongs to an unvisited region');
    if (!planChunk(world.graph, node).pois.some(poi => poi.id === id && poi.kind !== 'campfire')) throw new Error('Invalid cleared points');
  }
  if (typeof value.completed !== 'boolean' || value.completed !== clearedPoiIds.includes(`${world.graph.altarNodeId}:altar`)) throw new Error('Invalid exploration objective state');
  const activePoiId = value.activePoiId === null ? null : string(value.activePoiId, 'activePoiId');
  const combat = value.combat === null ? null : deserializeSnapshot(string(value.combat, 'expedition.combat', 32_000_000), content);
  const roaming = value.roaming === undefined ? undefined : restoreRoaming(value.roaming, world, content, difficultyId);
  if (combat && combat.difficultyId !== difficultyId) throw new Error('Combat difficulty does not match expedition');
  if (!!combat !== !!activePoiId) throw new Error('Encounter and combat must be present together');
  if (!value.failed && !roaming && !combat && world.chunk.pois.some(poi => poi.kind === 'encounter' && !clearedPoiIds.includes(poi.id)
    && world.actors.some(actor => actor.position.x === poi.position.x && actor.position.y === poi.position.y))) throw new Error('Occupied encounter has no combat');
  if (roaming) {
    if (!!combat !== !!roaming.active) throw new Error('Missing roaming battle provenance');
    if (combat && (activePoiId !== roaming.active!.mobId || combat.encounterId !== 'roaming'
      || combat.enemyIds?.join(',') !== roaming.active!.enemyIds.join(',')
      || combat.seed !== world.graph.seed && combat.seed !== roamingBattleSeed(world.graph.seed, world.currentChunkId, roaming.battleSerial)
      || combat.characterIds.join(',') !== world.actors.map(actor => actor.id).join(',')
      || world.actors.some(actor => actor.path.length)
      || roaming.chunks[world.currentChunkId].some(group => group.members.some(mob => mob.path.length)))) throw new Error('Combat does not match roaming groups');
    if (combat) {
      // Keep already-started battles from the older five-tile rules intact.
      const expected = findRoamingEncounter(world.chunk, roaming.chunks[world.currentChunkId], world.actors,
        roaming.active!.triggerRadius ?? 5, roaming.active!.includePursuers ?? false);
      if (!expected || roaming.battleSerial < 1 || expected.mobId !== roaming.active!.mobId || expected.actorId !== roaming.active!.actorId
        || expected.groupIds.join(',') !== roaming.active!.groupIds.join(',')) throw new Error('Invalid roaming engagement geometry');
    }
  } else if (combat) {
    const poi = world.chunk.pois.find(item => item.id === activePoiId && item.kind === 'encounter');
    if (!poi || clearedPoiIds.includes(poi.id)
      || !world.actors.some(actor => actor.position.x === poi.position.x && actor.position.y === poi.position.y)
      || world.actors.some(actor => actor.path.length)
      || combat.seed !== world.graph.seed && combat.seed !== encounterSeed(world.graph.seed, poi.id)
      || combat.encounterId !== poi.encounterId
      || combat.characterIds.join(',') !== world.actors.map(actor => actor.id).join(',')) throw new Error('Combat does not match the current map encounter');
  }
  if (value.failed && (combat || world.actors.some(actor => actor.path.length))) throw new Error('A finished expedition cannot continue');
  for (const [owner, count] of Object.entries(combat?.rng.entityDice?.counters ?? {})) {
    if (owner.startsWith('hero:')) diceCounters[owner] = Math.max(diceCounters[owner] ?? 0, count);
  }
  return { version: 1, difficultyId, world, clearedPoiIds, activePoiId, combat, completed: value.completed, diceCounters, ...(value.failed !== undefined ? { failed: value.failed } : {}), ...(roaming ? { roaming } : {}) };
}
