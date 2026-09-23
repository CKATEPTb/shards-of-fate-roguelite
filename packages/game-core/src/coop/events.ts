import type { CoopEvent, CoopFrame, CoopState, GameContent } from '@shards/shared';
import { changeLoadout } from './progression';
import { interactAdventure } from './interactions';
import { CAMPFIRE_LIFETIME_TICKS } from './campfire-runtime';
import { restBody } from '../anatomy';
import { advanceCoopTo, enterCoopChunk, rebuildMotion, stopCoopActor } from './movement';
import { finishCoopBattle, joinCoopBattle, performCoopBattleAction, performCoopBattleStep, startCoopBattle } from './battles';
import { summonSeasonBoss } from './bosses';

export function applyCoopEvent(state: CoopState, event: CoopEvent, content: GameContent): CoopState {
  switch (event.type) {
    case 'boss-summon': return summonSeasonBoss(state, content);
    case 'interact': return interactAdventure(state, event.actorId, event.chunkId, event.poiId, content);
    case 'loadout': return changeLoadout(state, event.actorId, event.command, content);
    case 'campfire-lit': return !state.progression || state.progression.campfires[event.poiId] ? state : { ...state,
      progression: { ...state.progression, campfires: { ...state.progression.campfires, [event.poiId]: { litAtTick: event.tick, expiresAtTick: event.tick + CAMPFIRE_LIFETIME_TICKS } } } };
    case 'motion': {
      if (event.entity === 'actor') return { ...state, actors: state.actors.map(actor => actor.id === event.id
        ? rebuildMotion(actor, event, state.seed, state.worldVersion ?? 2) : actor) };
      const groups = state.groups[event.chunkId];
      if (!groups) throw new Error('Motion references an unknown chunk');
      return { ...state, groups: { ...state.groups, [event.chunkId]: groups.map(group => group.id !== event.groupId ? group
        : { ...group, members: group.members.map(mob => mob.id === event.id ? rebuildMotion(mob, event, state.seed, state.worldVersion ?? 2) : mob) }) } };
    }
    case 'group': {
      const groups = state.groups[event.chunkId];
      if (!groups) throw new Error('Group event references an unknown chunk');
      return { ...state, groups: { ...state.groups, [event.chunkId]: groups.map(group => group.id !== event.groupId ? group
        : { ...group, mode: event.mode, targetActorId: event.targetActorId, decision: event.decision, pauseMs: event.pauseMs }) } };
    }
    case 'chunk-enter': return enterCoopChunk(state, event.actorId, event.chunkId, event.position, content);
    case 'battle-start': return startCoopBattle(state, event, content);
    case 'battle-join': return joinCoopBattle(state, event, content);
    case 'battle-step':
    case 'battle-action': {
      const result = event.type === 'battle-action' ? performCoopBattleAction(state, event.battleId, event.choice, content)
        : performCoopBattleStep(state, event.battleId, event.elapsedMs, content);
      const replayed = result.events[0];
      if (!replayed || replayed.type !== 'battle-step' && replayed.type !== 'battle-action') throw new Error('Co-op battle transition did not replay');
      if (state.diceIndex !== event.diceIndex || replayed.type !== event.type || result.state.diceIndex !== event.nextDiceIndex
        || JSON.stringify(replayed.dice) !== JSON.stringify(event.dice)) throw new Error('Co-op entity dice counters diverged');
      return result.state;
    }
    case 'battle-end': return finishCoopBattle(state, event.battleId, content);
    case 'rest': return { ...state,
      actors: state.actors.map(actor => actor.id !== event.actorId || !actor.body ? actor : { ...stopCoopActor(actor), body: restBody(actor.body) }),
      interactedStructureIds: [...new Set([...state.interactedStructureIds, event.poiId])],
    };
    case 'structure': return { ...state, interactedStructureIds: [...new Set([...state.interactedStructureIds, event.structureId])],
      completed: state.completed || Boolean(event.completed) };
    case 'reward': return { ...state, removedRewardIds: [...new Set([...state.removedRewardIds, event.rewardId])] };
  }
}

/** Apply to the last authoritative state; predicted render states are disposable. */
export function applyCoopFrame(state: CoopState, frame: CoopFrame, content: GameContent): CoopState {
  if (!Number.isSafeInteger(frame.diceIndex) || frame.diceIndex < state.diceIndex) throw new Error('Co-op frame has a stale dice index');
  state = advanceCoopTo(state, frame.tick, content);
  for (const event of frame.events) state = applyCoopEvent(state, event, content);
  // Loot and wells consume personal dice too. A missing draw must not silently
  // overwrite only the room total and leave the owner's sequence divergent.
  if (state.diceIndex !== frame.diceIndex) throw new Error('Co-op frame consumed unexpected dice');
  return { ...state, tick: frame.tick, diceIndex: frame.diceIndex };
}
