export const UNIT_FRAME_SIZE = 32;
export const UNIT_FOOT_Y = 28;
export const UNIT_GROUND_ORIGIN = UNIT_FOOT_Y / UNIT_FRAME_SIZE;
export const UNIT_FACINGS = ['south', 'north', 'east', 'west'] as const;
export type UnitFacing = typeof UNIT_FACINGS[number];
export const UNIT_MOTIONS = ['idle', 'walk', 'attack', 'cast', 'hit', 'death'] as const;
export type UnitMotion = typeof UNIT_MOTIONS[number];

export const UNIT_CLIPS: Record<UnitMotion, { frames: number; frameRate: number; repeat: number }> = {
  idle: { frames: 4, frameRate: 4, repeat: -1 },
  walk: { frames: 6, frameRate: 12, repeat: -1 },
  attack: { frames: 5, frameRate: 14, repeat: 0 },
  cast: { frames: 5, frameRate: 10, repeat: 0 },
  hit: { frames: 3, frameRate: 15, repeat: 0 },
  death: { frames: 5, frameRate: 10, repeat: 0 },
};

export interface UnitPose {
  step: number;
  lift: number;
  breath: number;
  sway: number;
  reach: number;
  recoil: number;
  blink: boolean;
  frame: number;
  motion: UnitMotion;
}

/** Limb offsets are integers: moving actors remain crisp at fractional camera positions. */
export function unitPose(motion: UnitMotion, frame: number): UnitPose {
  const count = UNIT_CLIPS[motion].frames;
  frame = Math.max(0, Math.min(count - 1, Math.floor(frame)));
  const walking = motion === 'walk';
  const attack = motion === 'attack' ? [0, -1, 3, 2, 0][frame] : motion === 'cast' ? [0, 1, 2, 1, 0][frame] : 0;
  return {
    step: walking ? [0, 1, 2, 0, -1, -2][frame] : 0,
    lift: walking ? [0, 1, 0, 0, 1, 0][frame] : 0,
    breath: motion === 'idle' ? [0, 0, -1, -1][frame] : motion === 'cast' ? [0, -1, -1, -1, 0][frame] : 0,
    sway: walking ? [0, 1, 1, 0, -1, -1][frame] : motion === 'idle' ? [0, 1, 0, -1][frame] : 0,
    reach: attack,
    recoil: motion === 'hit' ? [-1, -2, 0][frame] : 0,
    blink: motion === 'idle' && frame === 3,
    frame, motion,
  };
}

export function facingFromDelta(dx: number, dy: number, fallback: UnitFacing = 'south'): UnitFacing {
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'east' : 'west' : dy > 0 ? 'south' : 'north';
}

export function unitFrameName(facing: UnitFacing, motion: UnitMotion, frame: number): string {
  return `${facing}:${motion}:${frame}`;
}
