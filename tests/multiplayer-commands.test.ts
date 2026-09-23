import { describe, expect, it } from 'vitest';
import { createCombat, createExpedition, stepExpedition } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import type { MultiplayerCommand } from '@shards/protocol';
import { applyNetworkCommand } from '../apps/client/src/hooks/networkCommands';

const ids = ['guardian', 'priest', 'mage'];
const create = () => {
  const state = createExpedition('FIRST-CAMPFIRE', ids, gameContent);
  state.roaming!.chunks[state.world.currentChunkId] = [];
  return state;
};

describe('authoritative multiplayer commands', () => {
  it('moves only the hero bound to the sender, ignoring an injected hero identifier', () => {
    const state = create();
    const command = { type: 'move' as const, chunkId: state.world.currentChunkId, x: 16, y: 16, heroId: 'guardian' };
    const next = applyNetworkCommand(state, 'priest', command);
    expect(next.world.actors[1].path.at(-1)).toEqual({ x: 16, y: 16 });
    expect(next.world.actors[0]).toBe(state.world.actors[0]);
    expect(next.world.actors[2]).toBe(state.world.actors[2]);
    expect(state.world.actors[1].path).toEqual([]);
    expect(applyNetworkCommand(state, 'missing-hero', command)).toBe(state);
  });

  it('drops commands from the previous chunk and invalid destinations', () => {
    const state = create();
    const move: MultiplayerCommand = { type: 'move', chunkId: state.world.currentChunkId, x: 16, y: 16 };
    expect(applyNetworkCommand(state, 'priest', { ...move, chunkId: 'previous-chunk' })).toBe(state);
    for (const x of [-1, state.world.chunk.size, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(applyNetworkCommand(state, 'priest', { ...move, x })).toBe(state);
    }
    const fire = state.world.chunk.pois.find(poi => poi.kind === 'campfire')!;
    expect(applyNetworkCommand(state, 'priest', { type: 'rest', chunkId: 'previous-chunk', poiId: fire.id })).toBe(state);
  });

  it('refuses actions by a dead hero while living friends can keep moving', () => {
    const state = create();
    state.world.actors[0].body!.head.current = 0;
    const move: MultiplayerCommand = { type: 'move', chunkId: state.world.currentChunkId, x: 16, y: 16 };
    expect(applyNetworkCommand(state, 'guardian', move)).toBe(state);
    expect(applyNetworkCommand(state, 'priest', move).world.actors[1].path.length).toBeGreaterThan(0);
    const fire = state.world.chunk.pois.find(poi => poi.kind === 'campfire')!;
    expect(applyNetworkCommand(state, 'guardian', { type: 'rest', chunkId: state.world.currentChunkId, poiId: fire.id })).toBe(state);
  });

  it('rejects movement and rest during a fight or after the expedition fails', () => {
    const state = create();
    const combat = createCombat({ seed: 'network-fight', characterIds: ids, encounterId: 'roaming', enemyIds: ['rat'] }, gameContent);
    const fire = state.world.chunk.pois.find(poi => poi.kind === 'campfire')!;
    const commands: MultiplayerCommand[] = [
      { type: 'move', chunkId: state.world.currentChunkId, x: 16, y: 16 },
      { type: 'rest', chunkId: state.world.currentChunkId, poiId: fire.id },
    ];
    for (const blocked of [{ ...state, combat }, { ...state, failed: true }]) {
      for (const command of commands) expect(applyNetworkCommand(blocked, 'priest', command)).toBe(blocked);
    }
  });

  it('walks to a solid fire and permits rest only after authoritative arrival', () => {
    let state = create();
    state.world.actors[1].position = { x: 17, y: 15 };
    state.world.actors[1].body!.torso.current = 10;
    const fire = state.world.chunk.pois.find(poi => poi.kind === 'campfire')!;
    const rest: MultiplayerCommand = { type: 'rest', chunkId: state.world.currentChunkId, poiId: fire.id };
    expect(applyNetworkCommand(state, 'priest', rest)).toBe(state);
    state = applyNetworkCommand(state, 'priest', { type: 'move', chunkId: state.world.currentChunkId, ...fire.position });
    expect(state.world.actors[1].path.length).toBeGreaterThan(0);
    expect(state.world.actors[1].path).not.toContainEqual(fire.position);
    expect(applyNetworkCommand(state, 'priest', rest)).toBe(state);
    for (let tick = 0; tick < 100 && state.world.actors[1].path.length; tick++) state = stepExpedition(state, gameContent, 40);
    const rested = applyNetworkCommand(state, 'priest', rest);
    expect(rested.world.actors[1].body!.torso.current).toBe(rested.world.actors[1].body!.torso.max);
    expect(state.world.actors[1].body!.torso.current).toBe(10);
  });
});
