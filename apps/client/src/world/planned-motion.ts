import type { GridPoint } from '@shards/shared';
import { advanceMotion, createMotion, queueMotion, type MotionTrack } from './motion';

type MotionTarget = MotionTrack['targets'][number];

export interface PlannedMotionTrack extends MotionTrack {
  confirmed: GridPoint;
  preview?: MotionTarget;
}

const samePoint = (a: GridPoint, b: GridPoint) => a.x === b.x && a.y === b.y;

export function createPlannedMotion(position: GridPoint, confirmationBufferMs = 0): PlannedMotionTrack {
  return { ...createMotion(position, confirmationBufferMs), confirmed: { ...position } };
}

/** Restore the saved fraction once, immediately after creating and syncing a loaded actor. */
export function resumePlannedMotion(track: PlannedMotionTrack, elapsedMs: number): void {
  if (!track.preview || track.targets[0] !== track.preview || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
  advanceMotion(track, track.delayRemaining + Math.min(elapsedMs, track.preview.durationMs));
}

function cancelPreview(track: PlannedMotionTrack) {
  const preview = track.preview;
  if (!preview) return;
  track.preview = undefined;
  const index = track.targets.indexOf(preview);
  if (index > 0) {
    track.targets.splice(index, 1);
    return;
  }
  // A redirected step retraces its current segment before taking the new turn.
  // This keeps the hero continuous and out of blocked diagonal corners.
  track.targets.length = 0;
  track.from = { ...track.position };
  track.elapsed = 0;
  const remaining = Math.hypot(track.position.x - track.confirmed.x, track.position.y - track.confirmed.y);
  if (remaining === 0) return;
  const length = Math.hypot(preview.x - track.confirmed.x, preview.y - track.confirmed.y);
  queueMotion(track, track.confirmed, preview.durationMs * remaining / length);
  track.delayRemaining = 0;
}

/** Preview only the authoritative next tile; a slower tile never waits for its arrival confirmation. */
export function syncPlannedMotion(
  track: PlannedMotionTrack,
  confirmed: GridPoint,
  next: GridPoint | undefined,
  confirmedDurationMs: number,
  nextDurationMs: number,
): void {
  if (!samePoint(track.confirmed, confirmed)) {
    if (track.preview && !samePoint(track.preview, confirmed)) cancelPreview(track);
    else track.preview = undefined;
    queueMotion(track, confirmed, confirmedDurationMs);
    track.confirmed = { ...confirmed };
  }
  if (track.preview && (!next || !samePoint(track.preview, next))) cancelPreview(track);
  if (!next) return;
  if (track.preview) {
    const previousDuration = track.preview.durationMs;
    if (previousDuration !== nextDurationMs) {
      if (track.targets[0] === track.preview) track.elapsed *= nextDurationMs / previousDuration;
      track.preview.durationMs = nextDurationMs;
    }
    return;
  }
  queueMotion(track, next, nextDurationMs);
  const target = track.targets.at(-1);
  if (target && samePoint(target, next)) track.preview = target;
}
