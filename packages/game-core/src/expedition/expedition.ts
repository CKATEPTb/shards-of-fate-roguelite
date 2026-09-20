import type { DifficultyId, ExpeditionState, GameContent, GridPoint } from '@shards/shared';
import { createCombat } from '../create';
import { isTerminal, stepCombat } from '../combat';
import { hashString } from '../random';
import { createExploration, requestMove, stepExploration } from '../world';
import { initializeMovementSpeeds, resetMovementProgress } from './movement-speeds';
import { findRoamingEncounter, stepRoamingGroups } from '../roaming';
import { BASE_MOVEMENT_STEP_MS } from '../world/movement-speed';
import { beginRoamingBattle, enableRoaming, enterRoamingChunk, withRoamingGroups } from './roaming';
import { carryBattleWounds, initializePartyBodies, livingActors, partyBodies } from './party-health';
import { getDifficultyProfile } from '../difficulty';

export function createExpedition(seed: string, characterIds: string[], content: GameContent, difficultyId: DifficultyId = 'normal'): ExpeditionState {
  if (!characterIds.length || characterIds.some(id => !content.characters.some(unit => unit.id === id))) {
    throw new Error('Unknown expedition character');
  }
  const movementSpeeds = Object.fromEntries(content.characters.map(character => [character.id, character.movementSpeed ?? 100]));
  getDifficultyProfile(content, difficultyId);
  return enableRoaming({ version: 1, difficultyId, world: initializePartyBodies(createExploration({ seed, characterIds, movementSpeeds }), content), clearedPoiIds: [], activePoiId: null, combat: null, completed: false }, content);
}

export function moveExpedition(state: ExpeditionState, actorId: string, target: GridPoint) {
  if (state.combat || state.failed) return { state, accepted: false };
  const movement = requestMove(state.world, actorId, target);
  return { ...movement, state: movement.state === state.world ? state : { ...state, world: movement.state } };
}

export function encounterSeed(seed: string, poiId: string): string { return `encounter:${hashString(seed)}:${poiId}`; }

function activateOccupiedPoint(state: ExpeditionState, content: GameContent): ExpeditionState | null {
  let world = state.world;
  const poi = world.chunk.pois.find(item => item.kind !== 'campfire'
    && (!state.roaming || item.kind === 'altar')
    && !state.clearedPoiIds.includes(item.id)
    && livingActors(world.actors).some(actor => actor.position.x === item.position.x && actor.position.y === item.position.y));
  if (!poi) return null;
  world = { ...world, actors: world.actors.map(actor => ({ ...resetMovementProgress(actor), path: [] })) };
  if (poi.kind === 'altar') return { ...state, world, completed: true, clearedPoiIds: [...state.clearedPoiIds, poi.id] };
  if (!poi.encounterId) throw new Error('Encounter point has no encounter definition');
  const combat = createCombat({ seed: encounterSeed(world.graph.seed, poi.id), characterIds: world.actors.map(actor => actor.id), heroBodies: partyBodies(world.actors), encounterId: poi.encounterId, difficultyId: state.difficultyId }, content);
  return { ...state, world, activePoiId: poi.id, combat };
}

/** Exploration and encounters share one authoritative state; the client supplies only intents. */
export function stepExpedition(state: ExpeditionState, content: GameContent, elapsedMs?: number): ExpeditionState {
  if (state.combat || state.failed) return state;
  const initialized = initializePartyBodies(initializeMovementSpeeds(state.world, content), content);
  if (initialized !== state.world) state = { ...state, world: initialized };
  // Resolve arrivals left pending by another hero's encounter before accepting more movement.
  const pending = activateOccupiedPoint(state, content);
  if (pending) return pending;
  if (state.roaming) {
    const encounter = findRoamingEncounter(state.world.chunk, state.roaming.chunks[state.world.currentChunkId] ?? [], state.world.actors);
    if (encounter) return beginRoamingBattle(state, encounter, content);
  }
  const world = stepExploration(state.world, elapsedMs);
  if (state.roaming) {
    let moved = world === state.world ? state : { ...state, world };
    if (world.currentChunkId !== state.world.currentChunkId) return enterRoamingChunk(moved, content);
    const groups = stepRoamingGroups(state.roaming.chunks[world.currentChunkId] ?? [], world.chunk, world.actors, elapsedMs ?? BASE_MOVEMENT_STEP_MS, world.graph.seed);
    if (groups !== state.roaming.chunks[world.currentChunkId]) moved = withRoamingGroups(moved, groups);
    const encounter = findRoamingEncounter(world.chunk, groups, world.actors);
    return encounter ? beginRoamingBattle(moved, encounter, content) : activateOccupiedPoint(moved, content) ?? moved;
  }
  if (world === state.world) return state;
  const moved = { ...state, world };
  return activateOccupiedPoint(moved, content) ?? moved;
}

export function stepExpeditionCombat(state: ExpeditionState, content: GameContent): ExpeditionState {
  if (!state.combat || isTerminal(state.combat)) return state;
  return { ...state, combat: stepCombat(state.combat, content) };
}

export function leaveEncounter(state: ExpeditionState): ExpeditionState {
  if (!state.combat || !isTerminal(state.combat)) return state;
  const victory = state.combat.status === 'victory';
  const world = carryBattleWounds(state.world, state.combat);
  const roaming = state.roaming;
  const next: ExpeditionState = {
    ...state,
    world,
    ...(!victory ? { failed: true } : {}),
    clearedPoiIds: !roaming && victory && state.activePoiId ? [...state.clearedPoiIds, state.activePoiId] : state.clearedPoiIds,
    activePoiId: null,
    combat: null,
    ...(roaming ? { roaming: { ...roaming, active: null,
      chunks: { ...roaming.chunks, [state.world.currentChunkId]: roaming.chunks[state.world.currentChunkId]
        .filter(group => !victory || !roaming.active?.groupIds.includes(group.id))
        .map(group => ({ ...group, mode: 'patrol' as const, targetActorId: null, members: group.members.map(member => ({ ...resetMovementProgress(member), path: [] })) })) },
    } } : {}),
  };
  return next;
}
