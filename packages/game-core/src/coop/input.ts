import type { CoopCommand, CoopEvent, CoopResult, CoopState, GameContent } from '@shards/shared';
import { bodyMovementMultiplier, isBodyAlive } from '../anatomy';
import { advanceActor } from '../world/movement';
import { MOVEMENT_TICK_MS } from '../world/movement-speed';
import { isWalkable } from '../world/grid';
import { commandCoop } from './coop';
import { detectCoopBattles, getCoopBattle } from './battles';
import { enterCoopChunk, motionEvent, rebuildMotion, resolveCoopGates } from './movement';
import { coopChunk } from './world';

/** The same input is used by local prediction, its replay, and the host.
 * A friend's movement origin is trusted. Late input catches up its route, rather
 * than starting that route a second time when the network finally delivers it.
 */
export function applyCoopInput(state: CoopState, actorId: string, command: CoopCommand, content: GameContent, inputTick = state.tick): CoopResult {
  if (command.type === 'battle') {
    // Predicted contact may happen at a different tick and therefore have a
    // different battle ID. A hero can control only the battle they are in.
    const battle = getCoopBattle(state, actorId);
    const sameEncounter = battle && (battle.id === command.battleId
      || command.battleId.replace(/^battle:\d+:/, '') === battle.initiatorMobId);
    if (sameEncounter && command.action === 'choose' && command.expectedTurn !== undefined
      && command.expectedTurn !== battle.combat.turn) {
      return { state, events: [], accepted: false, reason: 'Это действие относится к другому ходу боя.' };
    }
    return commandCoop(state, actorId, sameEncounter ? { ...command, battleId: battle.id } : command, content);
  }
  if (command.type !== 'move' || !command.from) return commandCoop(state, actorId, command, content);
  const actor = state.actors.find(hero => hero.id === actorId);
  // Reject before trusting a movement origin or crossing its claimed chunk gate.
  if (actor?.body && bodyMovementMultiplier(actor.body) <= 0) {
    return { state, events: [], accepted: false, reason: 'Нет действующих конечностей для передвижения.' };
  }
  if (!actor || state.failed || state.completed || getCoopBattle(state, actorId) || actor.body && !isBodyAlive(actor.body)) {
    return commandCoop(state, actorId, command, content);
  }
  const chunk = coopChunk(state.seed, command.chunkId, state.worldVersion ?? 2);
  if (!isWalkable(chunk, command.from)) return { state, events: [], accepted: false, reason: 'Сюда не пройти.' };
  const original = state;
  const events: CoopEvent[] = [];
  if (actor.chunkId !== command.chunkId) {
    // The local actor may already have passed a gate while its command is in flight.
    state = enterCoopChunk(state, actorId, command.chunkId, command.from, content);
    events.push({ type: 'chunk-enter', actorId, fromChunkId: actor.chunkId, chunkId: command.chunkId, position: command.from });
  }
  state = { ...state, actors: state.actors.map(hero => hero.id === actorId ? { ...hero, position: { ...command.from! } } : hero) };
  const result = commandCoop(state, actorId, command, content);
  if (!result.accepted) return { ...result, state: original, events: [] };
  state = result.state;
  let moving = state.actors.find(hero => hero.id === actorId)!;
  const start = motionEvent(moving, moving.chunkId);
  if (command.fromElapsedMs !== undefined) start.elapsedMs = command.fromElapsedMs;
  moving = rebuildMotion(moving, start, state.seed, state.worldVersion ?? 2);
  state = { ...state, actors: state.actors.map(hero => hero.id === actorId ? moving : hero) };
  events.push(start);

  // Bound catch-up to the same five seconds as the client's prediction horizon.
  const ticks = Math.min(125, Math.max(0, state.tick - inputTick));
  for (let elapsed = 0; elapsed < ticks && moving.path.length; elapsed++) {
    const previousPoint = moving.position;
    const previousChunk = moving.chunkId;
    moving = { ...moving, ...advanceActor(moving, coopChunk(state.seed, moving.chunkId, state.worldVersion ?? 2), MOVEMENT_TICK_MS) };
    state = { ...state, actors: state.actors.map(hero => hero.id === actorId ? moving : hero) };
    const transitions: CoopEvent[] = [];
    state = resolveCoopGates(state, content, transitions);
    events.push(...transitions);
    moving = state.actors.find(hero => hero.id === actorId)!;
    if (moving.chunkId === previousChunk && moving.position.x === previousPoint.x && moving.position.y === previousPoint.y) continue;
    const contacts: CoopEvent[] = [];
    const contactState = detectCoopBattles(state, content, contacts);
    if (contacts.length) {
      // Publish the exact contact position before reserving participants.
      events.push(motionEvent(moving, moving.chunkId), ...contacts);
      state = contactState;
      if (getCoopBattle(state, actorId)) return { state, events, accepted: true };
    }
  }
  if (ticks) events.push(motionEvent(moving, moving.chunkId));
  return { state, events, accepted: true };
}
