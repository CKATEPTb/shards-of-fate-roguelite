import type { CoopCommand, CoopEvent, CoopResult, CoopState, DifficultyId, GameContent, RoamingGroup } from '@shards/shared';
import { combatTurnDuration } from '@shards/shared';
import { bodyMovementMultiplier, isBodyAlive } from '../anatomy';
import { isTerminal } from '../combat';
import { getDifficultyProfile } from '../difficulty';
import { initializePartyBodies } from '../expedition/party-health';
import { createEntityRng, createRng } from '../random';
import { stepRoamingGroups } from '../roaming/movement';
import { sameRoamingRegion } from '../roaming/navigation';
import { createExploration } from '../world/movement';
import { createMovementState, MOVEMENT_TICK_MS } from '../world/movement-speed';
import { isWalkable, samePoint } from '../world/grid';
import { findPath } from '../world/pathfinding';
import { detectCoopBattles, getCoopBattle, performCoopBattleAction, performCoopBattleStep, performCoopBattleTimeout } from './battles';
import { applyCoopEvent } from './events';
import { advanceCoopTo, coopLocks, motionEvent, rebuildMotion, resolveCoopGates, sameMotion, stopCoopActor } from './movement';
import { compareCoopIds, coopChunk, ensureCoopChunk } from './world';
import { hashValue } from '../canonical';
import { initialProgress } from './progression';
import { discoverCampfires } from './campfire-runtime';
import { engageSeasonBosses, initialSeasonBosses } from './bosses';

export function createCoopState(seed: string, characterIds: string[], content: GameContent, difficultyId: DifficultyId = 'normal'): CoopState {
  createRng(seed);
  getDifficultyProfile(content, difficultyId);
  if (characterIds.some(id => !content.characters.some(hero => hero.id === id))) throw new Error('Unknown co-op hero');
  const movementSpeeds = Object.fromEntries(content.characters.map(hero => [hero.id, hero.movementSpeed ?? 100]));
  const world = initializePartyBodies(createExploration({ seed, characterIds, movementSpeeds }), content);
  const state: CoopState = {
    worldVersion: 3, version: 1, contentHash: hashValue(content), seed, difficultyId, characterIds: [...characterIds], tick: 0, diceIndex: 0, diceCounters: {},
    actors: world.actors.map(actor => ({ ...actor, chunkId: world.currentChunkId, visited: [world.currentChunkId], transitions: 0 })),
    bosses: initialSeasonBosses(0, content), progression: initialProgress(content, characterIds), groups: {}, battles: [], killedEnemyIds: [], interactedStructureIds: [], removedRewardIds: [], completed: false, failed: false,
  };
  return ensureCoopChunk(state, world.currentChunkId, content);
}

const rejected = (state: CoopState, reason: string): CoopResult => ({ state, events: [], accepted: false, reason });

export function commandCoop(state: CoopState, actorId: string, command: CoopCommand, content: GameContent): CoopResult {
  const actor = state.actors.find(candidate => candidate.id === actorId);
  if (!actor) return rejected(state, 'Герой не найден.');
  if (command.type === 'battle') {
    const battle = getCoopBattle(state, actorId);
    if (!battle || battle.id !== command.battleId) return rejected(state, 'Герой не участвует в этом бою.');
    if (command.action === 'continue') {
      if (!isTerminal(battle.combat)) return rejected(state, 'Бой ещё не завершён.');
      const event: CoopEvent = { type: 'battle-end', battleId: battle.id };
      return { state: applyCoopEvent(state, event, content), events: [event], accepted: true };
    }
    if (isTerminal(battle.combat)) return rejected(state, 'Бой уже завершён.');
    if (command.expectedTurn !== undefined && command.expectedTurn !== battle.combat.turn) return rejected(state, 'Этот ход уже завершён.');
    if (battle.choiceDeadlineTick !== undefined && state.tick >= battle.choiceDeadlineTick) return rejected(state, 'Время на выбор действия истекло.');
    const unit = battle.combat.units.find(candidate => candidate.id === command.choice.actorId);
    if (!unit || unit.team !== 'heroes' || unit.definitionId !== actorId) return rejected(state, 'Вы можете выбрать действие только своего героя.');
    if (battle.combat.pendingActorId !== unit.id) return rejected(state, 'Сейчас ход другого участника.');
    try {
      const result = performCoopBattleAction(state, battle.id, command.choice, content);
      return result.events.length ? { ...result, accepted: true } : rejected(state, 'Это действие сейчас недоступно.');
    } catch (error) { return rejected(state, error instanceof Error ? error.message : 'Это действие сейчас недоступно.'); }
  }
  if (state.failed || actor.body && !isBodyAlive(actor.body)) return rejected(state, 'Этот герой больше не может действовать.');
  if (getCoopBattle(state, actorId)) return rejected(state, 'Герой участвует в бою.');
  if (command.type === 'revive') {
    const event: CoopEvent = { ...command, actorId };
    try { return { state: applyCoopEvent(state, event, content), events: [event], accepted: true }; }
    catch (error) { return rejected(state, error instanceof Error ? error.message : 'Не удалось поднять союзника.'); }
  }
  if (command.type === 'npc-buy' || command.type === 'npc-upgrade-equipment' || command.type === 'npc-upgrade-skill') {
    const event: CoopEvent = { type: 'npc-service', actorId, command };
    try { return { state: applyCoopEvent(state, event, content), events: [event], accepted: true }; }
    catch (error) { return rejected(state, error instanceof Error ? error.message : 'Услуга сейчас недоступна.'); }
  }
  if (command.type === 'equip' || command.type === 'learn' || command.type === 'discard-reward' || command.type === 'resolve-rewards'
    || command.type === 'collect-reward' || command.type === 'collect-rewards' || command.type === 'equip-inventory' || command.type === 'set-auto-equipment') {
    const event: CoopEvent = { type: 'loadout', actorId, command };
    try { return { state: applyCoopEvent(state, event, content), events: [event], accepted: true }; }
    catch (error) { return rejected(state, error instanceof Error ? error.message : 'Не удалось применить награду.'); }
  }
  if (state.completed) return rejected(state, 'Поход уже завершён.');
  if (command.chunkId !== actor.chunkId) return rejected(state, 'Герой уже перешёл в другой участок.');
  const chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
  if (command.type === 'move') {
    if (actor.body && bodyMovementMultiplier(actor.body) <= 0) return rejected(state, 'Нет действующих конечностей для передвижения.');
    const target = { x: command.x, y: command.y };
    if (!isWalkable(chunk, target)) return rejected(state, 'Сюда не пройти.');
    const path = findPath(chunk, actor.position, target, actor);
    if (!path.length && !samePoint(actor.position, target)) return rejected(state, 'Нужен другой вход.');
    const previous = actor.movement ?? createMovementState();
    const keepProgress = path[0] && actor.path[0] && samePoint(path[0], actor.path[0]);
    const moved = { ...actor, path, movement: { ...previous, elapsedMs: keepProgress ? previous.elapsedMs : 0 } };
    const event = motionEvent(moved, actor.chunkId);
    return { state: { ...state, actors: state.actors.map(candidate => candidate.id === actorId ? moved : candidate) }, events: [event], accepted: true };
  }
  if (command.type === 'interact') {
    const event: CoopEvent = { type: 'interact', actorId, chunkId: actor.chunkId, poiId: command.poiId };
    try { return { state: applyCoopEvent(state, event, content), events: [event], accepted: true }; }
    catch (error) { return rejected(state, error instanceof Error ? error.message : 'Не удалось взаимодействовать.'); }
  }
  // Campfires heal through the active world clock; legacy rest intents cannot instantly heal.
  return rejected(state, 'Костёр лечит автоматически, когда вы стоите рядом.');

}

function advanceCoopAI(before: CoopState, state: CoopState, content: GameContent, events: CoopEvent[], regeneratedChunks: Set<string>): CoopState {
  const locks = coopLocks(state);
  const heroes = state.actors.filter(actor => !locks.actors.has(actor.id) && (!actor.body || isBodyAlive(actor.body)));
  const chunkIds = [...new Set(heroes.map(actor => actor.chunkId))].sort(compareCoopIds);
  for (const chunkId of chunkIds) {
    state = ensureCoopChunk(state, chunkId, content);
    const chunk = coopChunk(state.seed, chunkId, state.worldVersion ?? 2);
    const localHeroes = heroes.filter(hero => hero.chunkId === chunkId).sort((a, b) => compareCoopIds(a.id, b.id));
    const current = state.groups[chunkId];
    const original = regeneratedChunks.has(chunkId) ? current : before.groups[chunkId] ?? current;
    const free = original.map(group => ({ ...group, members: group.members.filter(mob => !locks.mobs.has(mob.id)) }))
      .filter(group => group.members.length).map(group => {
        // A lost target releases pursuit once; otherwise the solo chase fallback
        // would refresh its 320 ms timer and send a redundant event every tick.
        if (group.mode !== 'chase' || group.members.some(mob => localHeroes.some(hero => sameRoamingRegion(chunk, mob.position, hero.position)))) return group;
        return { ...group, mode: 'patrol' as const, targetActorId: null, pauseMs: 320, members: group.members.map(stopCoopActor) };
      }).sort((a, b) => compareCoopIds(a.id, b.id));
    if (!free.length) continue;
    const updated = free.flatMap(group => {
      // The existing decision number reproduces patrol randomness without a
      // persistent dice bank or consuming any of the enemy's combat sequence.
      const rng = createEntityRng(state.seed, `roaming:${group.id}:${group.decision}`);
      return stepRoamingGroups([group], chunk, localHeroes, MOVEMENT_TICK_MS, state.seed, rng);
    });
    const groups: RoamingGroup[] = current.map(group => {
      const next = updated.find(candidate => candidate.id === group.id);
      if (!next) return group;
      if (next.mode !== group.mode || next.targetActorId !== group.targetActorId || next.decision !== group.decision || next.pauseMs !== group.pauseMs) {
        events.push({ type: 'group', chunkId, groupId: group.id, mode: next.mode,
          targetActorId: next.targetActorId, decision: next.decision, pauseMs: next.pauseMs });
      }
      const members = group.members.map(mob => {
        const moved = next.members.find(candidate => candidate.id === mob.id);
        if (!moved || sameMotion(mob, moved)) return mob;
        const event = motionEvent(moved, chunkId, group.id);
        events.push(event);
        return rebuildMotion(moved, event, state.seed, state.worldVersion ?? 2);
      });
      return { ...next, members };
    });
    state = { ...state, groups: { ...state.groups, [chunkId]: groups } };
  }
  return state;
}

/** One host-owned 40 ms tick: movement, local AI, new contacts, then independent battles. */
export function stepCoop(state: CoopState, content: GameContent): CoopResult {
  if (state.completed || state.failed && !state.battles.length) return { state, events: [] };
  const before = state;
  const events: CoopEvent[] = [];
  const regeneratedChunks = new Set<string>();
  state = advanceCoopTo(state, state.tick + 1, content);
  state = resolveCoopGates(state, content, events, regeneratedChunks);
  state = discoverCampfires(state, events);
  state = advanceCoopAI(before, state, content, events, regeneratedChunks);
  if (!state.failed && state.bosses?.nextAtTick != null && state.tick >= state.bosses.nextAtTick) {
    const event: CoopEvent = { type: 'boss-summon' };
    state = applyCoopEvent(state, event, content);
    events.push(event);
  }
  state = engageSeasonBosses(state, content, events);
  state = detectCoopBattles(state, content, events);
  for (const battle of [...state.battles].sort((a, b) => compareCoopIds(a.id, b.id))) {
    if (isTerminal(battle.combat) && state.tick >= (battle.presentationUntilTick ?? state.tick)) {
      const event: CoopEvent = { type: 'battle-end', battleId: battle.id };
      state = applyCoopEvent(state, event, content);
      events.push(event);
      continue;
    }
    const interval = battle.presentationMs ?? combatTurnDuration(battle.combat);
    if (battle.combat.pendingActorId) {
      if (battle.choiceDeadlineTick !== undefined && state.tick >= battle.choiceDeadlineTick) {
        const result = performCoopBattleTimeout(state, battle.id, battle.combat.pendingActorId, battle.combat.turn, content);
        state = result.state;
        events.push(...result.events);
      }
      continue;
    }
    if (isTerminal(battle.combat) || battle.elapsedMs < interval) continue;
    const result = performCoopBattleStep(state, battle.id, battle.elapsedMs - interval, content);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
