import { battleLoadouts, contentWithLoadouts } from './progression';
import { awardAdventureLoot } from './rewards';
import { hashValue } from '../canonical';
import { combatEventsDuration, COMBAT_CHOICE_TIMEOUT_MS, COMBAT_TURN_MS, HERO_LIGHT_RADIUS_TILES, type CombatChoice, type CoopActor, type CoopBattle, type CoopEncounterPreview, type CoopEvent, type CoopResult, type CoopState, type GameContent, type GridPoint, type RoamingGroup, type WorldChunk } from '@shards/shared';
import { isBodyAlive } from '../anatomy';
import { isTerminal, skipCombatTurn, stepCombat, submitCombatAction } from '../combat';
import { createCombat } from '../create';
import { partyBodies } from '../expedition/party-health';
import { findRoamingEncounter, ROAMING_REINFORCEMENT_RADIUS } from '../roaming/encounters';
import { distanceSquared, inRoamingRange } from '../roaming/navigation';
import { withinCoopBattleReach } from './battle-reach';
import { coopLocks, stopCoopActor } from './movement';
import { compareCoopIds, coopChunk } from './world';
import { advanceCoopDice, coopBattleRng, coopDiceChanges } from './entity-dice';
import { retreatPosition } from '../expedition/retreat';
import { MOVEMENT_TICK_MS } from '../world/movement-speed';
import { seasonBossesDefeated, startNextSeasonBossCountdown } from './bosses';
import { COOP_REVIVE_WINDOW_TICKS } from './revival';

export const COOP_COMBAT_TURN_MS = COMBAT_TURN_MS;

export function getCoopBattle(state: CoopState, actorId: string): CoopBattle | undefined {
  // Death keeps the seat reserved for spectating until battle-end. Only escape releases it early.
  return state.battles.find(battle => battle.actorIds.includes(actorId)
    && !battle.combat.units.some(unit => unit.team === 'heroes' && unit.definitionId === actorId && unit.escaped));
}

/** A lost local battle never ends another living player's expedition. */
export function coopPartyFailed(state: CoopState): boolean {
  return state.actors.every(actor => {
    const unit = getCoopBattle(state, actor.id)?.combat.units.find(unit => unit.team === 'heroes' && unit.definitionId === actor.id);
    return unit ? unit.hp <= 0 : Boolean(actor.body && !isBodyAlive(actor.body));
  });
}

export function withinCoopLight(a: GridPoint, b: GridPoint): boolean {
  return distanceSquared(a, b) < HERO_LIGHT_RADIUS_TILES ** 2;
}

function availableRoster(state: CoopState, chunkId: string): { heroes: CoopActor[]; groups: RoamingGroup[] } {
  const locks = coopLocks(state);
  const heroes = state.actors.filter(actor => actor.chunkId === chunkId && !locks.actors.has(actor.id)
    && (!actor.body || isBodyAlive(actor.body))).sort((a, b) => compareCoopIds(a.id, b.id));
  const groups = (state.groups[chunkId] ?? []).map(group => ({ ...group, members: group.members.filter(mob => !locks.mobs.has(mob.id)) }))
    .filter(group => group.members.length).sort((a, b) => compareCoopIds(a.id, b.id));
  return { heroes, groups };
}

function encounterRoster(chunk: WorldChunk, heroes: CoopActor[], groups: RoamingGroup[], actorId: string, mobId: string, groupIds: string[]): CoopEncounterPreview {
  const initiator = heroes.find(hero => hero.id === actorId)!;
  const contact = groups.flatMap(group => group.members).find(mob => mob.id === mobId)!;
  const candidates = groups.filter(group => groupIds.includes(group.id)).flatMap(group => group.members)
    .filter(mob => withinCoopBattleReach(chunk, mob.position, initiator.position, mob)
      || withinCoopBattleReach(chunk, mob.position, contact.position, mob));
  const mobs = candidates.sort((a, b) => a.id === mobId ? -1 : b.id === mobId ? 1
    : distanceSquared(initiator.position, a.position) - distanceSquared(initiator.position, b.position) || compareCoopIds(a.id, b.id)).slice(0, 16);
  const actorIds = recruitCoopActors(chunk, heroes, [initiator.position, ...mobs.map(mob => mob.position)], [actorId]);
  return { actorId, mobId, actorIds, mobIds: mobs.map(mob => mob.id), enemyIds: mobs.map(mob => mob.definitionId),
    groupIds: groups.filter(group => group.members.some(mob => mobs.some(chosen => chosen.id === mob.id))).map(group => group.id) };
}

/** Every newly included hero can in turn connect another nearby free hero. */
export function recruitCoopActors(chunk: WorldChunk, heroes: CoopActor[], participants: GridPoint[], initialIds: string[] = []): string[] {
  const actorIds = [...initialIds];
  const included = new Set(actorIds);
  const points = [...participants];
  let changed = true;
  while (changed) {
    changed = false;
    for (const hero of heroes) {
      if (included.has(hero.id) || !points.some(point => withinCoopBattleReach(chunk, hero.position, point, hero))) continue;
      actorIds.push(hero.id); included.add(hero.id); points.push(hero.position); changed = true;
    }
  }
  return actorIds;
}

/** Current local projection only: distant or reserved enemies have no certain roster yet. */
export function previewCoopEncounter(state: CoopState, viewerId: string, groupId: string, _content?: GameContent): CoopEncounterPreview | null {
  const viewer = state.actors.find(actor => actor.id === viewerId);
  if (!viewer) return null;
  const chunk = coopChunk(state.seed, viewer.chunkId, state.worldVersion ?? 2);
  const { heroes, groups } = availableRoster(state, viewer.chunkId);
  const selected = groups.find(group => group.id === groupId);
  if (!selected || !heroes.length) return null;
  const pairs = heroes.flatMap(hero => selected.members.filter(mob => withinCoopBattleReach(chunk, hero.position, mob.position, hero))
    .map(mob => ({ hero, mob })));
  pairs.sort((a, b) => Number(b.hero.id === viewerId) - Number(a.hero.id === viewerId)
    || distanceSquared(a.hero.position, a.mob.position) - distanceSquared(b.hero.position, b.mob.position)
    || compareCoopIds(a.hero.id, b.hero.id) || compareCoopIds(a.mob.id, b.mob.id));
  const initiator = pairs[0];
  if (!initiator) return null;
  const groupIds = groups.filter(group => group.id === groupId || group.members.some(mob =>
    inRoamingRange(chunk, mob.position, initiator.mob.position, ROAMING_REINFORCEMENT_RADIUS)
    || inRoamingRange(chunk, mob.position, initiator.hero.position, ROAMING_REINFORCEMENT_RADIUS))).map(group => group.id);
  return encounterRoster(chunk, heroes, groups, initiator.hero.id, initiator.mob.id, groupIds);
}

export function startCoopBattle(state: CoopState, event: Extract<CoopEvent, { type: 'battle-start' }>, content: GameContent): CoopState {
  if (state.battles.some(battle => battle.id === event.battleId)) throw new Error('Duplicate co-op battle');
  const actorIds = new Set(event.actorIds);
  const mobIds = new Set(event.mobIds);
  const locks = coopLocks(state);
  if (!actorIds.size || actorIds.size !== event.actorIds.length || !mobIds.size || mobIds.size !== event.mobIds.length
    || event.mobIds.length !== event.enemyIds.length || event.actorIds.some(id => locks.actors.has(id)) || event.mobIds.some(id => locks.mobs.has(id))) throw new Error('Co-op battle participants are already reserved');
  const actors = event.actorIds.map(id => state.actors.find(actor => actor.id === id && actor.chunkId === event.chunkId));
  if (actors.some(actor => !actor || actor.body && !isBodyAlive(actor.body))) throw new Error('Missing living co-op participant');
  const groups = state.groups[event.chunkId];
  if (!groups || event.mobIds.some((id, index) => !groups.some(group => group.members.some(mob => mob.id === id && mob.definitionId === event.enemyIds[index])))) throw new Error('Missing co-op enemy');
  const loadouts = battleLoadouts(state, event.actorIds);
  content = contentWithLoadouts(content, loadouts);
  const combat = createCombat({ seed: state.seed, difficultyId: state.difficultyId, characterIds: event.actorIds,
    encounterId: 'roaming', enemyIds: event.enemyIds, heroBodies: partyBodies(actors.map(actor => actor!)) }, content);
  combat.rng = coopBattleRng(state, combat, event.mobIds);
  const battle: CoopBattle = { loadouts, id: event.battleId, chunkId: event.chunkId, actorIds: [...event.actorIds], mobIds: [...event.mobIds],
    initiatorActorId: event.initiatorActorId, initiatorMobId: event.initiatorMobId, combat, elapsedMs: 0 };
  return { ...state, diceIndex: Math.max(state.diceIndex, event.diceIndex),
    actors: state.actors.map(actor => actorIds.has(actor.id) ? stopCoopActor(actor) : actor),
    groups: { ...state.groups, [event.chunkId]: groups.map(group => ({ ...group,
      members: group.members.map(mob => mobIds.has(mob.id) ? stopCoopActor(mob) : mob) })) },
    battles: [...state.battles, battle] };
}

/** Reinforcements keep the running round, wounds, cooldowns and room dice intact. */
export function joinCoopBattle(state: CoopState, event: Extract<CoopEvent, { type: 'battle-join' }>, content: GameContent): CoopState {
  const battle = state.battles.find(candidate => candidate.id === event.battleId);
  if (!battle || isTerminal(battle.combat)) throw new Error('Cannot reinforce a finished co-op battle');
  const locks = coopLocks(state);
  const added = new Set(event.actorIds);
  if (!added.size || added.size !== event.actorIds.length || event.actorIds.some(id => locks.actors.has(id))) throw new Error('Co-op reinforcements are already reserved');
  const actors = event.actorIds.map(id => state.actors.find(actor => actor.id === id && actor.chunkId === battle.chunkId));
  if (actors.some(actor => !actor || actor.body && !isBodyAlive(actor.body))) throw new Error('Missing living co-op reinforcement');
  const actorIds = [...battle.actorIds, ...event.actorIds];
  const loadouts = { ...battle.loadouts, ...battleLoadouts(state, event.actorIds) };
  content = contentWithLoadouts(content, loadouts);
  const fresh = createCombat({ seed: state.seed, difficultyId: state.difficultyId, characterIds: actorIds,
    encounterId: 'roaming', enemyIds: battle.combat.enemyIds, heroBodies: partyBodies(actors.map(actor => actor!)) }, content);
  const reinforcements = fresh.units.filter(unit => unit.team === 'heroes' && added.has(unit.definitionId));
  const combat = { ...battle.combat, contentHash: hashValue(content), characterIds: actorIds,
    units: [...battle.combat.units.filter(unit => unit.team === 'heroes'), ...reinforcements,
      ...battle.combat.units.filter(unit => unit.team === 'enemies')] };
  combat.rng = coopBattleRng(state, combat, battle.mobIds);
  // A newly arrived hero joins initiative on the next round. Existing IDs and
  // turn order remain valid, and no extra initiative die is consumed here.
  const updated = { ...battle, loadouts, actorIds, combat, initialActorIds: battle.initialActorIds ?? [...battle.actorIds] };
  return { ...state, actors: state.actors.map(actor => added.has(actor.id) ? stopCoopActor(actor) : actor),
    battles: state.battles.map(candidate => candidate.id === battle.id ? updated : candidate) };
}

function reinforceCoopBattles(state: CoopState, chunk: WorldChunk, content: GameContent, events: CoopEvent[]): CoopState {
  const battles = state.battles.filter(battle => battle.chunkId === chunk.id && !isTerminal(battle.combat))
    .sort((a, b) => compareCoopIds(a.id, b.id));
  for (const battle of battles) {
    const { heroes } = availableRoster(state, chunk.id);
    if (!heroes.length) break;
    const participants = [
      ...state.actors.filter(actor => battle.actorIds.includes(actor.id)
        && !battle.combat.units.some(unit => unit.definitionId === actor.id && unit.escaped)).map(actor => actor.position),
      ...(state.groups[chunk.id] ?? []).flatMap(group => group.members).filter(mob => battle.mobIds.includes(mob.id)).map(mob => mob.position),
    ];
    const actorIds = recruitCoopActors(chunk, heroes.filter(hero => !battle.actorIds.includes(hero.id)), participants);
    if (!actorIds.length) continue;
    const event: Extract<CoopEvent, { type: 'battle-join' }> = { type: 'battle-join', battleId: battle.id, actorIds };
    state = joinCoopBattle(state, event, content);
    events.push(event);
  }
  return state;
}

export function detectCoopBattles(state: CoopState, content: GameContent, events: CoopEvent[]): CoopState {
  const chunks = [...new Set(state.actors.map(actor => actor.chunkId))].sort(compareCoopIds);
  for (const chunkId of chunks) {
    const chunk = coopChunk(state.seed, chunkId, state.worldVersion ?? 2);
    state = reinforceCoopBattles(state, chunk, content, events);
    // Each iteration reserves at least one of at most four room heroes.
    for (let count = 0; count < state.actors.length; count++) {
      const { heroes, groups } = availableRoster(state, chunkId);
      if (!heroes.length) break;
      const encounter = findRoamingEncounter(chunk, groups, heroes, 1, false);
      if (!encounter) break;
      const roster = encounterRoster(chunk, heroes, groups, encounter.actorId, encounter.mobId, encounter.groupIds);
      if (!roster.mobIds.length) break;
      const event: Extract<CoopEvent, { type: 'battle-start' }> = {
        type: 'battle-start', battleId: `battle:${state.tick}:${encounter.mobId}`, chunkId,
        actorIds: roster.actorIds, mobIds: roster.mobIds, enemyIds: roster.enemyIds,
        initiatorActorId: encounter.actorId, initiatorMobId: encounter.mobId, diceIndex: state.diceIndex,
      };
      state = startCoopBattle(state, event, content);
      events.push(event);
    }
  }
  return state;
}

export function performCoopBattleStep(state: CoopState, battleId: string, elapsedMs: number, content: GameContent): CoopResult {
  return transitionCoopBattle(state, battleId, elapsedMs, content);
}

export function performCoopBattleAction(state: CoopState, battleId: string, choice: CombatChoice, content: GameContent): CoopResult {
  return transitionCoopBattle(state, battleId, 0, content, choice);
}

export function performCoopBattleTimeout(state: CoopState, battleId: string, actorId: string, turn: number, content: GameContent): CoopResult {
  return transitionCoopBattle(state, battleId, 0, content, undefined, { actorId, turn });
}

function transitionCoopBattle(state: CoopState, battleId: string, elapsedMs: number, content: GameContent, choice?: CombatChoice,
  timeout?: { actorId: string; turn: number }): CoopResult {
  const battle = state.battles.find(candidate => candidate.id === battleId);
  if (!battle || isTerminal(battle.combat)) return { state, events: [] };
  if (timeout && (battle.combat.pendingActorId !== timeout.actorId || battle.combat.turn !== timeout.turn
    || battle.choiceDeadlineTick === undefined || state.tick < battle.choiceDeadlineTick)) return { state, events: [] };
  if (choice && battle.choiceDeadlineTick !== undefined && state.tick >= battle.choiceDeadlineTick) return { state, events: [] };
  if (!choice && !timeout && battle.combat.pendingActorId) return { state, events: [] };
  const diceIndex = state.diceIndex;
  const rng = coopBattleRng(state, battle.combat, battle.mobIds);
  const before = { ...battle.combat, rng };
  content = contentWithLoadouts(content, battle.loadouts);
  const stepped = choice ? submitCombatAction(before, content, choice)
    : timeout ? skipCombatTurn(before, content, timeout.actorId) : stepCombat(before, content);
  if (stepped.nextSequence === before.nextSequence && stepped.pendingActorId === before.pendingActorId
    && stepped.status === before.status && stepped.turn === before.turn) return { state, events: [] };
  // A complete turn may inspect its own events; retain history only after all
  // effects finish, keeping sequence numbers and RNG untouched for replay.
  const retainedEvents = Math.max(128, stepped.nextSequence - before.nextSequence);
  const combat = stepped.events.length > retainedEvents ? { ...stepped, events: stepped.events.slice(-retainedEvents) } : stepped;
  const dice = coopDiceChanges(rng.entityDice!.counters, combat.rng.entityDice!.counters);
  state = advanceCoopDice(state, dice, rng.entityDice!.counters);
  const nextDiceIndex = state.diceIndex;
  const presentationMs = combatEventsDuration(stepped.events.filter(event => event.sequence >= before.nextSequence));
  const presentationUntilTick = state.tick + Math.ceil(presentationMs / MOVEMENT_TICK_MS);
  const next = { ...battle, combat, elapsedMs: combat.pendingActorId ? 0 : elapsedMs,
    presentationMs, presentationUntilTick,
    choiceDeadlineTick: combat.pendingActorId ? presentationUntilTick + Math.ceil(COMBAT_CHOICE_TIMEOUT_MS / MOVEMENT_TICK_MS) : undefined };
  state = { ...state, diceIndex: nextDiceIndex, battles: state.battles.map(candidate => candidate.id === battleId ? next : candidate) };
  const escaped = combat.units.filter(unit => unit.team === 'heroes' && unit.escaped
    && !before.units.find(previous => previous.id === unit.id)?.escaped);
  if (escaped.length) {
    const chunk = coopChunk(state.seed, battle.chunkId, state.worldVersion ?? 2);
    const leaving = new Set(escaped.map(unit => unit.definitionId));
    const chunkMobs = (state.groups[battle.chunkId] ?? []).flatMap(group => group.members);
    const nearbyBattles = state.battles.filter(candidate => candidate.chunkId === battle.chunkId);
    const engagedHeroes = new Set(nearbyBattles.flatMap(candidate => candidate.combat.units
      .filter(unit => unit.team === 'heroes' && !unit.escaped).map(unit => unit.definitionId)));
    const engagedMobs = new Set(nearbyBattles.flatMap(candidate => candidate.combat.units
      .filter(unit => unit.team === 'enemies').flatMap((unit, index) => unit.hp > 0 ? [candidate.mobIds[index]] : [])));
    const participants = [
      ...state.actors.filter(actor => actor.chunkId === battle.chunkId && engagedHeroes.has(actor.id)).map(actor => actor.position),
      ...chunkMobs.filter(mob => engagedMobs.has(mob.id)).map(mob => mob.position),
    ];
    const occupied: GridPoint[] = [
      ...state.actors.filter(actor => actor.chunkId === battle.chunkId && !leaving.has(actor.id)).map(actor => actor.position),
      ...chunkMobs.map(mob => mob.position),
    ];
    state = { ...state, actors: state.actors.map(actor => {
      const unit = escaped.find(unit => unit.definitionId === actor.id);
      if (!unit) return actor;
      const position = retreatPosition(chunk, actor, participants, occupied);
      occupied.push(position);
      return { ...stopCoopActor(actor), position, ...(unit.body ? { body: structuredClone(unit.body) } : {}) };
    }) };
  }
  state = { ...state, failed: coopPartyFailed(state) };
  const event: CoopEvent = choice
    ? { type: 'battle-action', battleId, choice, diceIndex, nextDiceIndex, elapsedMs: next.elapsedMs, dice }
    : timeout ? { type: 'battle-timeout', battleId, actorId: timeout.actorId, turn: timeout.turn, diceIndex, nextDiceIndex, elapsedMs: next.elapsedMs, dice }
    : { type: 'battle-step', battleId, diceIndex, nextDiceIndex, elapsedMs: next.elapsedMs, dice };
  return { state, events: [event] };
}

export function finishCoopBattle(state: CoopState, battleId: string, content: GameContent): CoopState {
  const battle = state.battles.find(candidate => candidate.id === battleId);
  if (!battle || !isTerminal(battle.combat)) return state;
  const enemies = battle.combat.units.filter(unit => unit.team === 'enemies');
  const killed = new Set(enemies.flatMap((unit, index) => unit.hp <= 0 ? [battle.mobIds[index]] : []));
  const actors = state.actors.map(actor => {
    if (!battle.actorIds.includes(actor.id)) return actor;
    const unit = battle.combat.units.find(unit => unit.team === 'heroes' && unit.definitionId === actor.id);
    if (unit?.escaped) return actor;
    const body = unit?.body;
    const fallen = body && !isBodyAlive(body);
    return { ...stopCoopActor(actor), ...(body ? { body: structuredClone(body) } : {}),
      ...(fallen && state.characterIds.length > 1 && !coopPartyFailed(state) ? { reviveUntilTick: state.tick + COOP_REVIVE_WINDOW_TICKS } : {}) };
  });
  const groups = state.groups[battle.chunkId].map(group => ({ ...group, members: group.members.filter(mob => !killed.has(mob.id)) }))
    .filter(group => group.members.length);
  let next: CoopState = { ...state, actors, battles: state.battles.filter(candidate => candidate.id !== battleId),
    killedEnemyIds: [...new Set([...state.killedEnemyIds, ...killed])], groups: { ...state.groups, [battle.chunkId]: groups } };
  next = startNextSeasonBossCountdown(next);
  if (battle.combat.status === 'victory') {
    const quality = state.groups[battle.chunkId].some(group => group.category === 'miniboss' && group.members.some(mob => battle.mobIds.includes(mob.id))) ? 'miniboss'
      : state.groups[battle.chunkId].some(group => group.category === 'epic' && group.members.some(mob => battle.mobIds.includes(mob.id))) ? 'epic' : 'normal';
    for (const unit of battle.combat.units.filter(unit => unit.team === 'heroes' && unit.hp > 0 && !unit.escaped).sort((a,b) => compareCoopIds(a.definitionId,b.definitionId))) {
      next = awardAdventureLoot(next, unit.definitionId, `battle:${battle.mobIds.slice().sort().join('|')}`, battle.chunkId, content, quality);
    }
  }
  // Other chunks may still be in battle: finish their presentations and turns
  // before freezing the expedition clock on the shared victory screen.
  const failed = coopPartyFailed(next);
  return { ...next, failed, completed: !failed && (next.completed || seasonBossesDefeated(next) && next.battles.length === 0) };
}
