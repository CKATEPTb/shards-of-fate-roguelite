import { describe, expect, it } from 'vitest';
import { advanceMotion, motionSpeed } from '../apps/client/src/world/motion';
import { createPlannedMotion, resumePlannedMotion, syncPlannedMotion } from '../apps/client/src/world/planned-motion';

describe('planned world movement', () => {
  it('crosses grass, bushes and grass continuously at each terrain pace', () => {
    const motion = createPlannedMotion({ x: 0, y: 0 }, 40);
    syncPlannedMotion(motion, { x: 0, y: 0 }, { x: 32, y: 0 }, 280, 280);
    for (let elapsed = 40; elapsed <= 1160; elapsed += 40) {
      const distance = advanceMotion(motion, 40);
      if (elapsed > 40) expect(distance).toBeGreaterThan(0);
      if (elapsed === 280) syncPlannedMotion(motion, { x: 32, y: 0 }, { x: 64, y: 0 }, 280, 560);
      if (elapsed === 840) syncPlannedMotion(motion, { x: 64, y: 0 }, { x: 96, y: 0 }, 560, 280);
      if (elapsed === 1120) syncPlannedMotion(motion, { x: 96, y: 0 }, undefined, 280, 280);
      if (elapsed === 320) expect(motion.position.x).toBe(32);
      if (elapsed === 600) expect(motion.position.x).toBe(48);
      if (elapsed === 880) expect(motion.position.x).toBe(64);
    }
    expect(motion.position).toEqual({ x: 96, y: 0 });
    expect(motion.targets).toEqual([]);
  });

  it('retraces a redirected partial step before turning, without a snap or diagonal', () => {
    const origin = { x: 0, y: 0 };
    const motion = createPlannedMotion(origin);
    syncPlannedMotion(motion, origin, { x: 32, y: 0 }, 280, 280);
    advanceMotion(motion, 140);
    expect(motion.position).toEqual({ x: 16, y: 0 });
    syncPlannedMotion(motion, origin, { x: 0, y: 32 }, 280, 560);
    expect(motion.position).toEqual({ x: 16, y: 0 });
    expect(motionSpeed(motion)).toBe(32 / 280);
    advanceMotion(motion, 70);
    expect(motion.position).toEqual({ x: 8, y: 0 });
    advanceMotion(motion, 70);
    expect(motion.position).toEqual(origin);
    advanceMotion(motion, 280);
    expect(motion.position).toEqual({ x: 0, y: 16 });
    expect(motionSpeed(motion)).toBe(32 / 560);
    syncPlannedMotion(motion, { x: 0, y: 32 }, undefined, 560, 280);
    advanceMotion(motion, 280);
    expect(motion.position).toEqual({ x: 0, y: 32 });
  });

  it('finishes a confirmed corner while replacing an unstarted preview', () => {
    const motion = createPlannedMotion({ x: 0, y: 0 }, 40);
    syncPlannedMotion(motion, { x: 0, y: 0 }, { x: 32, y: 0 }, 280, 280);
    advanceMotion(motion, 280);
    syncPlannedMotion(motion, { x: 32, y: 0 }, { x: 32, y: 32 }, 280, 280);
    syncPlannedMotion(motion, { x: 32, y: 0 }, { x: 32, y: -32 }, 280, 560);
    advanceMotion(motion, 40);
    expect(motion.position).toEqual({ x: 32, y: 0 });
    advanceMotion(motion, 280);
    expect(motion.position).toEqual({ x: 32, y: -16 });
  });

  it('returns smoothly to the authoritative tile when an unconfirmed step stops', () => {
    const origin = { x: 0, y: 0 };
    const motion = createPlannedMotion(origin);
    syncPlannedMotion(motion, origin, { x: 32, y: 0 }, 280, 560);
    advanceMotion(motion, 280);
    syncPlannedMotion(motion, origin, undefined, 280, 280);
    expect(motion.position).toEqual({ x: 16, y: 0 });
    advanceMotion(motion, 140);
    expect(motion.position).toEqual({ x: 8, y: 0 });
    advanceMotion(motion, 140);
    expect(motion.position).toEqual(origin);
    expect(motion.targets).toEqual([]);
  });

  it('does not advance when paused or predict past the next authoritative tile', () => {
    const motion = createPlannedMotion({ x: 0, y: 0 });
    syncPlannedMotion(motion, { x: 0, y: 0 }, { x: 32, y: 0 }, 280, 560);
    advanceMotion(motion, 280);
    advanceMotion(motion, 0);
    expect(motion.position).toEqual({ x: 16, y: 0 });
    advanceMotion(motion, 2000);
    expect(motion.position).toEqual({ x: 32, y: 0 });
    expect(motion.preview).toBeDefined();
    syncPlannedMotion(motion, { x: 32, y: 0 }, { x: 32, y: 32 }, 560, 280);
    advanceMotion(motion, 280);
    expect(motion.position).toEqual({ x: 32, y: 32 });
  });

  it('restores a saved bush step at its elapsed fraction without another full step of lag', () => {
    const motion = createPlannedMotion({ x: 0, y: 0 }, 40);
    syncPlannedMotion(motion, { x: 0, y: 0 }, { x: 32, y: 0 }, 280, 560);
    resumePlannedMotion(motion, 420);
    expect(motion.position).toEqual({ x: 24, y: 0 });
    expect(motionSpeed(motion)).toBe(32 / 560);
    advanceMotion(motion, 140);
    expect(motion.position).toEqual({ x: 32, y: 0 });
    syncPlannedMotion(motion, { x: 32, y: 0 }, undefined, 560, 280);
    expect(motion.targets).toEqual([]);
  });

  it('preserves visible progress when a bonus changes the active step pace', () => {
    const motion = createPlannedMotion({ x: 0, y: 0 });
    syncPlannedMotion(motion, { x: 0, y: 0 }, { x: 32, y: 0 }, 280, 560);
    advanceMotion(motion, 280);
    syncPlannedMotion(motion, { x: 0, y: 0 }, { x: 32, y: 0 }, 140, 280);
    expect(motion.position).toEqual({ x: 16, y: 0 });
    expect(motion.elapsed).toBe(140);
    expect(motionSpeed(motion)).toBe(32 / 280);
    advanceMotion(motion, 140);
    expect(motion.position).toEqual({ x: 32, y: 0 });
  });

  it('changes an unstarted preview pace without altering the confirmed step before it', () => {
    const motion = createPlannedMotion({ x: 0, y: 0 }, 40);
    syncPlannedMotion(motion, { x: 0, y: 0 }, { x: 32, y: 0 }, 280, 280);
    advanceMotion(motion, 280);
    syncPlannedMotion(motion, { x: 32, y: 0 }, { x: 64, y: 0 }, 280, 560);
    syncPlannedMotion(motion, { x: 32, y: 0 }, { x: 64, y: 0 }, 140, 280);
    expect(motion.targets.map(target => target.durationMs)).toEqual([280, 280]);
    expect(motion.elapsed).toBe(240);
    advanceMotion(motion, 180);
    expect(motion.position).toEqual({ x: 48, y: 0 });
  });
});
