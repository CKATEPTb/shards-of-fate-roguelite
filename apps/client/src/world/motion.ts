import type { GridPoint } from '@shards/shared';
import { BASE_MOVEMENT_STEP_MS } from '@shards/game-core';

/** Shared by the simulation scheduler and visual interpolation. */
export const WORLD_STEP_MS = BASE_MOVEMENT_STEP_MS;

export interface MotionTrack {
  position: GridPoint;
  from: GridPoint;
  targets: Array<GridPoint & { durationMs: number }>;
  elapsed: number;
  direction: GridPoint;
  confirmationBufferMs: number;
  delayRemaining: number;
}

export function createMotion(position: GridPoint, confirmationBufferMs = 0): MotionTrack {
  return { position: { ...position }, from: { ...position }, targets: [], elapsed: 0, direction: { x: 0, y: 0 }, confirmationBufferMs, delayRemaining: 0 };
}

/** Queue confirmed steps: changing selection or a destination never restarts a step. */
export function queueMotion(track: MotionTrack, target: GridPoint, durationMs = WORLD_STEP_MS): void {
  const last = track.targets.at(-1) ?? track.position;
  if (last.x === target.x && last.y === target.y) return;
  if (!track.targets.length) {
    track.from = { ...track.position };
    track.delayRemaining = track.confirmationBufferMs;
  }
  track.targets.push({ ...target, durationMs });
}

/** Pixel pace also covers partial retracing segments, whose duration is shorter than a tile. */
export function motionSpeed(track: MotionTrack): number | undefined {
  const target = track.targets[0];
  if (!target || target.durationMs <= 0) return;
  return Math.hypot(target.x - track.from.x, target.y - track.from.y) / target.durationMs;
}

/** Consumes overshoot across corners instead of cutting diagonally through terrain. */
export function advanceMotion(track: MotionTrack, delta: number): number {
  let distance = 0;
  let remaining = Math.max(0, delta);
  // One simulation tick of initial buffering hides confirmation quantization
  // for speeds whose tile duration is not an exact multiple of the scheduler.
  if (track.targets.length && track.delayRemaining > 0) {
    const delay = Math.min(remaining, track.delayRemaining);
    track.delayRemaining -= delay;
    remaining -= delay;
  }
  while (track.targets.length && remaining > 0) {
    const target = track.targets[0];
    const step = Math.min(remaining, target.durationMs - track.elapsed);
    track.elapsed += step;
    remaining -= step;
    track.direction = { x: target.x - track.from.x, y: target.y - track.from.y };
    const progress = Math.min(1, track.elapsed / target.durationMs);
    const x = track.from.x + (target.x - track.from.x) * progress;
    const y = track.from.y + (target.y - track.from.y) * progress;
    distance += Math.hypot(x - track.position.x, y - track.position.y);
    track.position = { x, y };
    if (progress === 1) {
      track.targets.shift();
      track.from = { x: target.x, y: target.y };
      track.elapsed = 0;
    }
  }
  return distance;
}

/** Frame-rate-independent camera damping; never rounds the followed world position. */
export function followPoint(current: GridPoint, target: GridPoint, delta: number, reduced = false): GridPoint {
  const alpha = reduced ? 1 : 1 - Math.exp(-Math.max(0, delta) / 105);
  return { x: current.x + (target.x - current.x) * alpha, y: current.y + (target.y - current.y) * alpha };
}
