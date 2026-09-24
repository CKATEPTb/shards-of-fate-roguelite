import { createCoopState, commandCoop, stepCoop } from '../coop/coop';
import { coopView } from '../coop/view';
import type { CombatChoice, DifficultyId, ExpeditionState, GameContent, GridPoint } from '@shards/shared';
import { createCombat } from '../create';
import { isTerminal, skipCombatTurn, stepCombat, submitCombatAction } from '../combat';
import { hashString } from '../random';
import { createExploration, requestMove, stepExploration } from '../world';
import { initializeMovementSpeeds, resetMovementProgress } from './movement-speeds';
import { findRoamingEncounter, stepRoamingGroups } from '../roaming';
import { BASE_MOVEMENT_STEP_MS } from '../world/movement-speed';
import { beginRoamingBattle, enableRoaming, enterRoamingChunk, withRoamingGroups } from './roaming';
import { carryBattleWounds, initializePartyBodies, livingActors, partyBodies } from './party-health';
import { getDifficultyProfile } from '../difficulty';
import { expeditionCombatDice, withExpeditionCombat } from './dice';
import { retreatPosition } from './retreat';

export function createExpedition(seed: string, characterIds: string[], content: GameContent, difficultyId: DifficultyId = 'normal'): ExpeditionState {
  const cooperative = createCoopState(seed, characterIds, content, difficultyId);
  return { ...coopView(cooperative, characterIds[0], content), cooperative };
}

export function moveExpedition(state: ExpeditionState, actorId: string, target: GridPoint) {
  if (state.combat || state.failed) return { state, accepted: false };
  if (state.cooperative && state.content) {
    const result = commandCoop(state.cooperative, actorId, { type: 'move', chunkId: state.world.currentChunkId, x: target.x, y: target.y }, state.content);
    return { state: { ...coopView(result.state, actorId, state.content), cooperative: result.state }, accepted: result.accepted === true };
  }
  const movement = requestMove(state.world, actorId, target);
  return { ...movement, state: movement.state === state.world ? state : { ...state, world: movement.state } };
}

export function encounterSeed(seed: string, poiId: string): string { return `encounter:${hashString(seed)}:${poiId}`; }

function activateOccupiedPoint(state: ExpeditionState, content: GameContent): ExpeditionState | null {
  let world = state.world;
  const poi = world.chunk.pois.find(item => item.kind === 'encounter'
    && !state.roaming
    && !state.clearedPoiIds.includes(item.id)
    && livingActors(world.actors).some(actor => actor.position.x === item.position.x && actor.position.y === item.position.y));
  if (!poi) return null;
  world = { ...world, actors: world.actors.map(actor => ({ ...resetMovementProgress(actor), path: [] })) };
  if (!poi.encounterId) throw new Error('Encounter point has no encounter definition');
  const fresh = createCombat({ seed: world.graph.seed, characterIds: world.actors.map(actor => actor.id), heroBodies: partyBodies(world.actors), encounterId: poi.encounterId, difficultyId: state.difficultyId }, content);
  const combat = expeditionCombatDice(state, fresh, fresh.units.filter(unit => unit.team === 'enemies').map((unit, index) => `${poi.id}:${index}:${unit.definitionId}`));
  return { ...state, world, activePoiId: poi.id, combat };
}

/** Exploration and encounters share one authoritative state; the client supplies only intents. */
export function stepExpedition(state: ExpeditionState, content: GameContent, elapsedMs?: number): ExpeditionState {
  if (state.cooperative) {
    const cooperative = stepCoop(state.cooperative, content).state;
    return cooperative === state.cooperative ? state : { ...coopView(cooperative, state.world.actors[0].id, content), cooperative };
  }
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
  if (!state.combat || isTerminal(state.combat) || state.combat.pendingActorId) return state;
  return withExpeditionCombat(state, stepCombat(state.combat, content));
}

/** Complete an unfinished battle from the old solo format before migration. */
export function skipExpeditionCombatTurn(state: ExpeditionState, content: GameContent, actorId: string, turn: number): ExpeditionState {
  if (state.cooperative || !state.combat || isTerminal(state.combat)
    || state.combat.pendingActorId !== actorId || state.combat.turn !== turn) return state;
  return withExpeditionCombat(state, skipCombatTurn(state.combat, content, actorId));
}

export function chooseExpeditionCombatAction(state: ExpeditionState, content: GameContent, choice: CombatChoice): ExpeditionState {
  if (state.cooperative) {
    const actor = state.combat?.units.find(unit => unit.id === choice.actorId);
    const battle = state.cooperative.battles.find(battle => battle.combat === state.combat);
    if (!actor || !battle) return state;
    const result = commandCoop(state.cooperative, actor.definitionId, { type: 'battle', battleId: battle.id, action: 'choose', choice }, content);
    return { ...coopView(result.state, state.world.actors[0].id, content), cooperative: result.state };
  }
  if (!state.combat || isTerminal(state.combat)) return state;
  return withExpeditionCombat(state, submitCombatAction(state.combat, content, choice));
}

export function leaveEncounter(state: ExpeditionState): ExpeditionState {
  if (!state.combat || !isTerminal(state.combat)) return state;
  const victory = state.combat.status === 'victory';
  let world = carryBattleWounds(state.world, state.combat);
  const roaming = state.roaming;
  const escaped = state.combat.status === 'escaped';
  const groups = roaming?.chunks[world.currentChunkId] ?? [];
  const engaged = roaming?.active?.groupIds.flatMap(id => groups.find(group => group.id === id)?.members ?? []) ?? [];
  const enemies = state.combat.units.filter(unit => unit.team === 'enemies');
  const killed = new Set(engaged.flatMap((mob, index) => enemies[index]?.hp <= 0 ? [mob.id] : []));
  if (escaped) {
    const threats = engaged.filter(mob => !killed.has(mob.id)).map(mob => mob.position);
    if (!threats.length && state.activePoiId) {
      const point = world.chunk.pois.find(poi => poi.id === state.activePoiId)?.position;
      if (point) threats.push(point);
    }
    const relocated: GridPoint[] = [];
    world = { ...world, actors: world.actors.map(actor => {
      const unit = state.combat!.units.find(unit => unit.team === 'heroes' && unit.definitionId === actor.id);
      if (!unit?.escaped) return actor;
      const position = retreatPosition(world.chunk, actor, threats, relocated);
      relocated.push(position);
      return { ...actor, position };
    }) };
  }
  const next: ExpeditionState = {
    ...state,
    world,
    ...(!victory && !escaped ? { failed: true } : {}),
    clearedPoiIds: !roaming && victory && state.activePoiId ? [...state.clearedPoiIds, state.activePoiId] : state.clearedPoiIds,
    activePoiId: null,
    combat: null,
    ...(roaming ? { roaming: { ...roaming, active: null,
      chunks: { ...roaming.chunks, [state.world.currentChunkId]: roaming.chunks[state.world.currentChunkId]
        .map(group => ({ ...group, mode: 'patrol' as const, targetActorId: null,
          members: group.members.filter(member => !killed.has(member.id)).map(member => ({ ...resetMovementProgress(member), path: [] })) }))
        .filter(group => group.members.length) },
    } } : {}),
  };
  return next;
}
