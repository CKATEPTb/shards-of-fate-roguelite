import { approachCampfire, isBodyAlive, moveExpedition, restAtCampfire } from '@shards/game-core';
import type { MultiplayerCommand } from '@shards/protocol';
import type { ExpeditionState } from '@shards/shared';

/** The relay supplies heroId from room membership; destinations still belong to the host's current world. */
export function applyNetworkCommand(state: ExpeditionState, heroId: string, command: MultiplayerCommand): ExpeditionState {
  if (command.type !== 'move' && command.type !== 'rest') return state;
  const actor = state.world.actors.find(candidate => candidate.id === heroId);
  if (!actor || actor.body && !isBodyAlive(actor.body) || state.failed || state.combat
    || command.chunkId !== state.world.currentChunkId) return state;

  if (command.type === 'rest') return restAtCampfire(state, heroId, command.poiId);
  if (!Number.isInteger(command.x) || !Number.isInteger(command.y)
    || command.x < 0 || command.y < 0 || command.x >= state.world.chunk.size || command.y >= state.world.chunk.size) return state;
  const fire = state.world.chunk.pois.find(poi => poi.kind === 'campfire' && poi.position.x === command.x && poi.position.y === command.y);
  return fire
    ? approachCampfire(state, heroId, fire.id).state
    : moveExpedition(state, heroId, { x: command.x, y: command.y }).state;
}
