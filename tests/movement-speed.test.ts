import { describe, expect, it } from 'vitest';
import {
  BASE_MOVEMENT_STEP_MS, MOVEMENT_TICK_MS, createExploration, createMovementState,
  deserializeExploration, effectiveMovementSpeed, movementStepMs, requestMove,
  serializeExploration, stepExploration, withMovementBonus,
} from '@shards/game-core';
import type { ExplorationState, MovementState } from '@shards/shared';

function corridor(speeds: Record<string, number> = { guardian: 100 }): ExplorationState {
  const state = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: Object.keys(speeds), movementSpeeds: speeds });
  return {
    ...state,
    chunk: { ...state.chunk, pois: [], structures: [], exits: [], tiles: state.chunk.tiles.map(() => ({ terrain: 'grass', walkable: true, movementCost: 1 })) },
    actors: state.actors.map(actor => ({ ...actor, position: { x: 1, y: 1 }, path: Array.from({ length: 30 }, (_, index) => ({ x: index + 2, y: 1 })) })),
  };
}

function advanceTime(initial: ExplorationState, elapsedMs: number): ExplorationState {
  let state = initial;
  for (let remaining = elapsedMs; remaining > 0; remaining -= MOVEMENT_TICK_MS) state = stepExploration(state, Math.min(remaining, MOVEMENT_TICK_MS));
  return state;
}

describe('exploration movement speed', () => {
  it('halves the original default pace and advances only after a complete tile duration', () => {
    const start = corridor();
    expect(BASE_MOVEMENT_STEP_MS).toBe(280);
    expect(movementStepMs(start.actors[0])).toBe(280);
    const half = stepExploration(start, 140);
    expect(half.actors[0].position).toEqual(start.actors[0].position);
    expect(half.tick).toBe(0);
    const almost = stepExploration(half, 139);
    expect(almost.actors[0].position).toEqual(start.actors[0].position);
    const moved = stepExploration(almost, 1);
    expect(moved.actors[0].position).toEqual({ x: 2, y: 1 });
    expect(moved.actors[0].movement?.elapsedMs).toBe(0);
    expect(moved.tick).toBe(1);
    expect(start.actors[0].movement?.elapsedMs).toBe(0);
  });

  it('uses independent actor speeds and carries fractional progress between ticks', () => {
    const start = corridor({ guardian: 100, assassin: 110 });
    const moved = advanceTime(start, 2800);
    expect(moved.actors[0].position).toEqual({ x: 11, y: 1 });
    expect(moved.actors[1].position).toEqual({ x: 12, y: 1 });
    expect(moved.actors[1].movement?.elapsedMs).toBeCloseTo(0);
  });

  it('applies an equipment bonus to actual travel and bounds extreme effective speeds', () => {
    const start = corridor();
    start.actors[0] = withMovementBonus(start.actors[0], 25);
    const moved = advanceTime(start, 2800);
    expect(effectiveMovementSpeed(start.actors[0])).toBe(125);
    expect(movementStepMs(start.actors[0])).toBe(224);
    expect(moved.actors[0].position).toEqual({ x: 13, y: 1 });
    expect(moved.actors[0].movement?.elapsedMs).toBe(112);
    expect(effectiveMovementSpeed({ movement: { ...createMovementState(), bonusPercent: 1000 } })).toBe(300);
    expect(effectiveMovementSpeed({ movement: { ...createMovementState(), bonusPercent: -100 } })).toBe(10);
    expect(effectiveMovementSpeed({})).toBe(100);
  });

  it('never skips an intermediate tile after a delayed update', () => {
    const start = corridor();
    const next = start.actors[0].path[0];
    start.chunk.pois = [{ id: 'next-encounter', kind: 'encounter', encounterId: 'test', position: next }];
    const moved = stepExploration(start, 60_000);
    expect(moved.actors[0].position).toEqual(next);
    expect(moved.actors[0].path).toHaveLength(29);
    expect(moved.tick).toBe(1);
  });

  it('preserves progress for the same next tile, but clears it when stopping or redirecting', () => {
    const walking = stepExploration(corridor(), 100);
    const continued = requestMove(walking, 'guardian', { x: 5, y: 1 }).state;
    expect(continued.actors[0].movement?.elapsedMs).toBe(100);
    const redirected = requestMove(walking, 'guardian', { x: 1, y: 3 }).state;
    expect(redirected.actors[0].movement?.elapsedMs).toBe(0);
    const stopped = requestMove(walking, 'guardian', walking.actors[0].position).state;
    expect(stopped.actors[0].path).toEqual([]);
    expect(stopped.actors[0].movement?.elapsedMs).toBe(0);
    expect(stepExploration(stopped, 500)).toBe(stopped);
    expect(stepExploration(walking, 0)).toBe(walking);
  });

  it('clears final-step progress and cancels blocked steps without advancing', () => {
    const start = corridor();
    start.actors[0].path = start.actors[0].path.slice(0, 1);
    const final = stepExploration(stepExploration(start, 100), 200);
    expect(final.actors[0].path).toEqual([]);
    expect(final.actors[0].movement?.elapsedMs).toBe(0);
    const blocked = corridor();
    blocked.chunk.tiles[1 * blocked.chunk.size + 2].walkable = false;
    const stopped = stepExploration(blocked, 40);
    expect(stopped.actors[0].position).toEqual(blocked.actors[0].position);
    expect(stopped.actors[0].path).toEqual([]);
    expect(stopped.tick).toBe(0);
  });

  it('keeps base speeds and bonuses across an atomic party transition', () => {
    const start = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: ['guardian', 'priest'], movementSpeeds: { guardian: 100, priest: 103 } });
    start.actors[0].movement!.bonusPercent = 15;
    start.actors[1].movement!.bonusPercent = 5;
    const exit = start.chunk.exits.find(candidate => requestMove(start, 'guardian', candidate.position).accepted)!;
    let state = requestMove(start, 'guardian', exit.position).state;
    for (let step = 0; step < 1225 && state.currentChunkId === start.currentChunkId; step++) state = stepExploration(state);
    expect(state.currentChunkId).toBe(exit.targetNodeId);
    expect(state.transitions).toBe(1);
    expect(state.actors.map(actor => actor.movement)).toEqual(start.actors.map(actor => actor.movement));
    expect(state.actors.every(actor => actor.path.length === 0)).toBe(true);
  });

  it('rejects invalid timing and base speed inputs', () => {
    for (const speed of [NaN, Infinity, 0, 9, 301]) expect(() => createMovementState(speed)).toThrow();
    const start = corridor();
    for (const elapsed of [NaN, Infinity, -1]) expect(() => stepExploration(start, elapsed)).toThrow();
    for (const bonus of [NaN, Infinity, -101, 1001]) expect(() => withMovementBonus(start.actors[0], bonus)).toThrow();
  });
});

describe('saved movement attributes', () => {
  function walkingSnapshot() {
    const start = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: ['guardian'], movementSpeeds: { guardian: 110 } });
    start.actors[0].movement!.bonusPercent = 12.5;
    const walking = requestMove(start, 'guardian', { x: 23, y: 17 }).state;
    return stepExploration(walking, 40.25);
  }

  it('round-trips fractional progress and resumes with the same pace', () => {
    const walking = walkingSnapshot();
    const loaded = deserializeExploration(serializeExploration(walking));
    expect(loaded).toEqual(walking);
    expect(advanceTime(loaded, 800)).toEqual(advanceTime(walking, 800));
  });

  it('preserves a halfway step when equipment changes, saves it and resumes at the new pace', () => {
    const start = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: ['guardian'] });
    const walking = stepExploration(requestMove(start, 'guardian', { x: 23, y: 17 }).state, 140);
    const boosted = { ...walking, actors: walking.actors.map(actor => withMovementBonus(actor, 100)) };
    expect(boosted.actors[0].movement?.elapsedMs).toBe(70);
    expect(movementStepMs(boosted.actors[0])).toBe(140);
    expect(walking.actors[0].movement).toEqual({ baseSpeed: 100, bonusPercent: 0, elapsedMs: 140 });
    expect(withMovementBonus(boosted.actors[0], 100)).toBe(boosted.actors[0]);
    const loaded = deserializeExploration(serializeExploration(boosted));
    expect(loaded).toEqual(boosted);
    const almost = stepExploration(loaded, 69);
    expect(almost.actors[0].position).toEqual(walking.actors[0].position);
    const advanced = stepExploration(almost, 1);
    expect(advanced.actors[0].position).toEqual(walking.actors[0].path[0]);
    expect(advanced.actors[0].movement?.elapsedMs).toBe(0);
  });

  it('keeps rescaled progress strictly below the tile duration at floating-point boundaries', () => {
    const walking = walkingSnapshot();
    walking.actors[0].movement!.elapsedMs = movementStepMs(walking.actors[0]) * (1 - Number.EPSILON);
    walking.actors[0] = withMovementBonus(walking.actors[0], 1000);
    expect(walking.actors[0].movement!.elapsedMs).toBeLessThan(movementStepMs(walking.actors[0]));
    expect(deserializeExploration(serializeExploration(walking))).toEqual(walking);
  });

  it('accepts legacy actors without inventing content-specific speed defaults', () => {
    const walking = walkingSnapshot();
    const snapshot = JSON.parse(serializeExploration(walking));
    delete snapshot.actors[0].movement;
    const loaded = deserializeExploration(JSON.stringify(snapshot));
    expect(loaded.actors[0].movement).toBeUndefined();
    const advanced = stepExploration(loaded, BASE_MOVEMENT_STEP_MS);
    expect(advanced.actors[0].movement?.baseSpeed).toBe(100);
    expect(advanced.actors[0].position).toEqual(loaded.actors[0].path[0]);
  });

  it('rejects malformed, nonfinite, out-of-range and extra saved movement values', () => {
    const state = walkingSnapshot();
    const movement = state.actors[0].movement!;
    const invalid: unknown[] = [
      null, {}, { ...movement, extra: 1 }, { ...movement, baseSpeed: '100' },
      { ...movement, baseSpeed: 0 }, { ...movement, baseSpeed: 301 }, { ...movement, baseSpeed: Infinity },
      { ...movement, bonusPercent: -101 }, { ...movement, bonusPercent: 1001 }, { ...movement, bonusPercent: NaN },
      { ...movement, elapsedMs: -1 }, { ...movement, elapsedMs: movementStepMs({ movement }) },
      { ...movement, elapsedMs: Infinity },
    ];
    for (const value of invalid) {
      const snapshot = JSON.parse(serializeExploration(state));
      snapshot.actors[0].movement = value as MovementState;
      expect(() => deserializeExploration(JSON.stringify(snapshot))).toThrow();
    }
  });
});
