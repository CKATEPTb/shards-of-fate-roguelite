import { describe, expect, it } from 'vitest';
import { advanceMotion, createMotion, followPoint, queueMotion, WORLD_STEP_MS } from '../apps/client/src/world/motion';
import { createMovementState, movementStepMs, MOVEMENT_TICK_MS } from '@shards/game-core';

describe('world presentation timing', () => {
  it('moves continuously at half the previous default speed', () => {
    const motion = createMotion({ x: 0, y: 0 });
    queueMotion(motion, { x: 32, y: 0 });
    advanceMotion(motion, 220);
    const first = motion.position.x;
    advanceMotion(motion, 40);
    expect(motion.position.x).toBeGreaterThan(first);
    expect(motion.position.x).toBeLessThan(32);
    advanceMotion(motion, 20);
    expect(motion.position).toEqual({ x: 32, y: 0 });
  });

  it('retains progress on repeated updates and follows confirmed corners', () => {
    const motion = createMotion({ x: 0, y: 0 });
    queueMotion(motion, { x: 32, y: 0 });
    advanceMotion(motion, 140);
    queueMotion(motion, { x: 32, y: 0 });
    queueMotion(motion, { x: 32, y: 32 });
    advanceMotion(motion, 210);
    expect(motion.position).toEqual({ x: 32, y: 8 });
    expect(motion.direction).toEqual({ x: 0, y: 32 });
    expect(motion.targets).toHaveLength(1);
    advanceMotion(motion, 0);
    expect(motion.position).toEqual({ x: 32, y: 8 });
    advanceMotion(motion, 210);
    expect(motion.position).toEqual({ x: 32, y: 32 });
    expect(motion.targets).toEqual([]);
  });

  it('is invariant to frame subdivision and never overshoots a stopped actor', () => {
    const run = (frames: number[]) => {
      const motion = createMotion({ x: 0, y: 0 });
      queueMotion(motion, { x: 32, y: 0 });
      queueMotion(motion, { x: 32, y: 32 });
      frames.forEach(delta => advanceMotion(motion, delta));
      return motion.position;
    };
    expect(run([WORLD_STEP_MS * 2])).toEqual(run(Array.from({ length: 56 }, () => 10)));
    expect(run([1000])).toEqual({ x: 32, y: 32 });
  });

  it('uses individual speed without changing a step already in progress', () => {
    const motion = createMotion({ x: 0, y: 0 });
    queueMotion(motion, { x: 32, y: 0 }, 280);
    advanceMotion(motion, 140);
    expect(motion.position).toEqual({ x: 16, y: 0 });
    queueMotion(motion, { x: 32, y: 0 }, 140);
    queueMotion(motion, { x: 32, y: 32 }, 140);
    advanceMotion(motion, 140);
    expect(motion.position).toEqual({ x: 32, y: 0 });
    advanceMotion(motion, 70);
    expect(motion.position).toEqual({ x: 32, y: 16 });
    advanceMotion(motion, 70);
    expect(motion.position).toEqual({ x: 32, y: 32 });
  });

  it('slows the rendered bush step and restores the following ground step', () => {
    const actor = { movement: createMovementState(100) };
    const motion = createMotion({ x: 0, y: 0 });
    queueMotion(motion, { x: 32, y: 0 }, movementStepMs(actor, 'bush'));
    queueMotion(motion, { x: 64, y: 0 }, movementStepMs(actor, 'grass'));
    advanceMotion(motion, WORLD_STEP_MS);
    expect(motion.position).toEqual({ x: 16, y: 0 });
    advanceMotion(motion, WORLD_STEP_MS);
    expect(motion.position).toEqual({ x: 32, y: 0 });
    advanceMotion(motion, WORLD_STEP_MS / 2);
    expect(motion.position).toEqual({ x: 48, y: 0 });
    advanceMotion(motion, WORLD_STEP_MS / 2);
    expect(motion.position).toEqual({ x: 64, y: 0 });
  });

  it.each([103, 105, 110, 125])('buffers quantized confirmations at %s%% without stopping between tiles', speed => {
    const duration = movementStepMs({ movement: createMovementState(speed) });
    const motion = createMotion({ x: 0, y: 0 }, MOVEMENT_TICK_MS);
    let confirmed = 0;
    let started = false;
    for (let elapsed = 0; elapsed < duration * 12; elapsed += 5) {
      if (elapsed % MOVEMENT_TICK_MS === 0) {
        const arrived = Math.floor(elapsed / duration);
        if (arrived > confirmed) {
          confirmed = arrived;
          queueMotion(motion, { x: confirmed * 32, y: 0 }, duration);
        }
      }
      const distance = advanceMotion(motion, 5);
      if (started) expect(distance).toBeGreaterThan(0);
      if (distance > 0) started = true;
    }
    expect(started).toBe(true);
  });

  it('camera damping has the same settling time at 30 and 60 fps', () => {
    const run = (frames: number) => {
      let point = { x: 0, y: 0 };
      for (let index = 0; index < frames; index++) point = followPoint(point, { x: 200, y: 100 }, 1000 / frames);
      return point;
    };
    expect(run(30).x).toBeCloseTo(run(60).x, 9);
    expect(run(30).y).toBeCloseTo(run(60).y, 9);
    expect(followPoint({ x: 0, y: 0 }, { x: 32, y: 0 }, 16, true)).toEqual({ x: 32, y: 0 });
  });
});
