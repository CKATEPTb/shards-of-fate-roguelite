import { describe, expect, it } from 'vitest';
import {
  createExploration, deserializeExploration, findPath, movementStepMs,
  requestMove, serializeExploration, stepExploration, withMovementBonus,
} from '@shards/game-core';
import type { ExplorationState, GridPoint, Terrain } from '@shards/shared';
import { makeTile } from '../packages/game-core/src/world/carving';

function corridor(baseSpeed = 100): ExplorationState {
  const state = createExploration({ seed: 'BUSH-MOVEMENT', characterIds: ['guardian'], movementSpeeds: { guardian: baseSpeed } });
  return {
    ...state,
    chunk: { ...state.chunk, exits: [], pois: [], structures: [], tiles: state.chunk.tiles.map(() => ({ terrain: 'grass', walkable: true, movementCost: 1 })) },
    actors: state.actors.map(actor => ({ ...actor, position: { x: 1, y: 1 }, path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }] })),
  };
}

function paint(state: ExplorationState, point: GridPoint, terrain: Terrain): void {
  state.chunk.tiles[point.y * state.chunk.size + point.x] = makeTile(terrain);
}

function bushApproach(structureVersion: 1 | 2 = 2): ExplorationState {
  const state = createExploration({ seed: 'BUSH-MOVEMENT', characterIds: ['guardian'], structureVersion });
  for (let index = 0; index < state.chunk.tiles.length; index++) {
    if (state.chunk.tiles[index].terrain !== 'bush') continue;
    const target = { x: index % state.chunk.size, y: Math.floor(index / state.chunk.size) };
    const path = findPath(state.chunk, state.actors[0].position, target);
    if (!path.length) continue;
    return { ...state, actors: state.actors.map(actor => ({ ...actor, position: path.at(-2) ?? actor.position, path: [target] })) };
  }
  throw new Error('The fixture must include a reachable bush');
}

describe('walkable bushes', () => {
  it('takes twice as long to enter and cross bushes, then restores the normal pace on clear ground', () => {
    const start = corridor();
    paint(start, { x: 2, y: 1 }, 'bush');
    paint(start, { x: 3, y: 1 }, 'bush');
    const halfway = stepExploration(start, 280);
    expect(halfway.actors[0].position).toEqual({ x: 1, y: 1 });
    let state = stepExploration(halfway, 280);
    expect(state.actors[0].position).toEqual({ x: 2, y: 1 });
    state = stepExploration(state, 559);
    expect(state.actors[0].position).toEqual({ x: 2, y: 1 });
    state = stepExploration(state, 1);
    expect(state.actors[0].position).toEqual({ x: 3, y: 1 });
    state = stepExploration(state, 280);
    expect(state.actors[0].position).toEqual({ x: 4, y: 1 });
    expect(state.actors[0].path).toEqual([]);
    expect(state.actors[0].movement?.elapsedMs).toBe(0);
  });

  it('multiplies each class and equipment-adjusted pace, without changing snow travel', () => {
    for (const baseSpeed of [100, 103, 105, 110]) {
      const start = corridor(baseSpeed);
      start.actors[0] = withMovementBonus(start.actors[0], 25);
      const plainDuration = movementStepMs(start.actors[0]);
      expect(movementStepMs(start.actors[0], 'bush')).toBe(plainDuration * 2);
      expect(movementStepMs(start.actors[0], 'snow')).toBe(plainDuration);
      paint(start, { x: 2, y: 1 }, 'bush');
      expect(stepExploration(start, plainDuration).actors[0].position).toEqual(start.actors[0].position);
      expect(stepExploration(start, plainDuration * 2).actors[0].position).toEqual({ x: 2, y: 1 });
      paint(start, { x: 2, y: 1 }, 'snow');
      expect(stepExploration(start, plainDuration).actors[0].position).toEqual({ x: 2, y: 1 });
    }
  });

  it('keeps fractional time crossing different terrain and never skips a tile after a stall', () => {
    const start = corridor();
    paint(start, { x: 2, y: 1 }, 'bush');
    const walking = stepExploration(start, 550);
    const crossed = stepExploration(walking, 40);
    expect(crossed.actors[0].position).toEqual({ x: 2, y: 1 });
    expect(crossed.actors[0].movement?.elapsedMs).toBe(30);
    expect(stepExploration(crossed, 250).actors[0].position).toEqual({ x: 3, y: 1 });
    const stalled = stepExploration(walking, 60_000);
    expect(stalled.actors[0].position).toEqual({ x: 2, y: 1 });
    expect(stalled.actors[0].movement!.elapsedMs).toBeLessThan(movementStepMs(stalled.actors[0], 'grass'));
    expect(stepExploration(stalled, 40).actors[0].position).toEqual({ x: 3, y: 1 });
  });

  it('preserves a partial bush step only when the next target is unchanged', () => {
    const start = corridor();
    paint(start, { x: 2, y: 1 }, 'bush');
    const walking = stepExploration(start, 400);
    const sameStep = requestMove(walking, 'guardian', { x: 2, y: 1 }).state;
    expect(sameStep.actors[0].movement?.elapsedMs).toBe(400);
    const redirected = requestMove(walking, 'guardian', { x: 1, y: 2 }).state;
    expect(redirected.actors[0].movement?.elapsedMs).toBe(0);
    expect(stepExploration(redirected, 280).actors[0].position).toEqual({ x: 1, y: 2 });
    const stopped = requestMove(walking, 'guardian', { x: 1, y: 1 }).state;
    expect(stopped.actors[0].path).toEqual([]);
    expect(stopped.actors[0].movement?.elapsedMs).toBe(0);
  });

  it.each(['grass', 'snow'] as const)('can enter a bush but prefers a faster detour on %s', ground => {
    const state = corridor();
    state.chunk.tiles = state.chunk.tiles.map(() => makeTile(ground));
    for (let x = 2; x <= 7; x++) paint(state, { x, y: 1 }, 'bush');
    expect(findPath(state.chunk, { x: 1, y: 1 }, { x: 2, y: 1 })).toEqual([{ x: 2, y: 1 }]);
    const detour = findPath(state.chunk, { x: 1, y: 1 }, { x: 8, y: 1 });
    expect(detour.length).toBeGreaterThan(7);
    expect(detour.every(point => state.chunk.tiles[point.y * state.chunk.size + point.x].terrain !== 'bush')).toBe(true);
    expect(detour.at(-1)).toEqual({ x: 8, y: 1 });
    const duration = detour.reduce((total, point) => total + movementStepMs(state.actors[0], state.chunk.tiles[point.y * state.chunk.size + point.x].terrain), 0);
    expect(duration).toBeLessThan(6 * movementStepMs(state.actors[0], 'bush') + movementStepMs(state.actors[0], ground));
  });
});

describe('saved bush traversal', () => {
  it('round-trips progress beyond a plain tile duration and resumes at the same time', () => {
    const walking = stepExploration(bushApproach(), 420.5);
    expect(walking.actors[0].movement!.elapsedMs).toBeGreaterThan(movementStepMs(walking.actors[0]));
    const loaded = deserializeExploration(serializeExploration(walking));
    expect(loaded).toEqual(walking);
    expect(stepExploration(loaded, 139.5)).toEqual(stepExploration(walking, 139.5));
    expect(stepExploration(loaded, 139.5).actors[0].position).toEqual(walking.actors[0].path[0]);
  });

  it('rescales normalized bush progress when equipment bonuses change', () => {
    const walking = stepExploration(bushApproach(), 420);
    const actor = withMovementBonus(walking.actors[0], 100, 'bush');
    expect(actor.movement?.elapsedMs).toBe(210);
    expect(movementStepMs(actor, 'bush')).toBe(280);
    const boosted = { ...walking, actors: [actor] };
    expect(deserializeExploration(serializeExploration(boosted))).toEqual(boosted);
    expect(stepExploration(boosted, 69).actors[0].position).toEqual(walking.actors[0].position);
    expect(stepExploration(boosted, 70).actors[0].position).toEqual(walking.actors[0].path[0]);
  });

  it('rejects progress at the bush duration and checks idle progress against the base duration', () => {
    const state = bushApproach();
    const atDuration = JSON.parse(serializeExploration(state));
    atDuration.actors[0].movement.elapsedMs = movementStepMs(state.actors[0], 'bush');
    expect(() => deserializeExploration(JSON.stringify(atDuration))).toThrow('Invalid movement values');
    const idle = JSON.parse(serializeExploration(state));
    idle.actors[0].path = [];
    idle.actors[0].movement.elapsedMs = movementStepMs(state.actors[0]);
    expect(() => deserializeExploration(JSON.stringify(idle))).toThrow('Invalid movement values');
  });

  it('accepts older saved routes and actors without movement attributes through new bushes', () => {
    const state = bushApproach(1);
    const saved = JSON.parse(serializeExploration(state));
    delete saved.structureVersion;
    delete saved.actors[0].movement;
    const loaded = deserializeExploration(JSON.stringify(saved));
    expect(loaded.actors[0].path).toEqual(state.actors[0].path);
    expect(loaded.actors[0].movement).toBeUndefined();
    const halfway = stepExploration(loaded, 280);
    expect(halfway.actors[0].position).toEqual(loaded.actors[0].position);
    expect(stepExploration(halfway, 280).actors[0].position).toEqual(loaded.actors[0].path[0]);
  });
});
