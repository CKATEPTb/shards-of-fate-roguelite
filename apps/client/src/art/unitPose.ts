export const UNIT_FRAME_SIZE = 32;
export const UNIT_FOOT_Y = 28;
export const UNIT_GROUND_ORIGIN = UNIT_FOOT_Y / UNIT_FRAME_SIZE;
export const UNIT_FACINGS = ['south', 'north', 'east', 'west'] as const;
export type UnitFacing = typeof UNIT_FACINGS[number];
export const UNIT_MOTIONS = ['idle', 'walk', 'attack', 'attackLeft', 'cast', 'dodge', 'block', 'shieldBlock', 'hit', 'death'] as const;
export type UnitMotion = typeof UNIT_MOTIONS[number];

export const UNIT_CLIPS: Record<UnitMotion, { frames: number; frameRate: number; repeat: number }> = {
  idle: { frames: 4, frameRate: 4, repeat: -1 },
  walk: { frames: 12, frameRate: 24, repeat: -1 },
  attack: { frames: 9, frameRate: 15, repeat: 0 },
  attackLeft: { frames: 9, frameRate: 15, repeat: 0 },
  cast: { frames: 9, frameRate: 12, repeat: 0 },
  dodge: { frames: 7, frameRate: 16, repeat: 0 },
  block: { frames: 7, frameRate: 16, repeat: 0 },
  shieldBlock: { frames: 7, frameRate: 16, repeat: 0 },
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
  progress: number;
  motion: UnitMotion;
}

/** Authored pose keys keep their timing when an action gains intermediate frames. */
export function samplePoseKeys(progress: number, keys: readonly number[]): number {
  if (!keys.length) return 0;
  const position = Math.max(0, Math.min(1, progress)) * (keys.length - 1);
  const first = Math.floor(position), next = Math.min(first + 1, keys.length - 1);
  return keys[first] + (keys[next] - keys[first]) * (position - first);
}

/** Interpolate articulated offsets; each painter rounds only at the pixel boundary. */
export function unitPose(motion: UnitMotion, frame: number): UnitPose {
  const count = UNIT_CLIPS[motion].frames;
  frame = Math.max(0, Math.min(count - 1, Math.floor(frame)));
  const progress = count > 1 ? frame / (count - 1) : 0;
  const sample = (keys: readonly number[]) => samplePoseKeys(progress, keys);
  const walking = motion === 'walk';
  // A loop samples [0, 2π), without repeating the first contact at its end.
  const walkPhase = frame / count * Math.PI * 2;
  const guarding = motion === 'block' || motion === 'shieldBlock';
  const attack = motion === 'attack' || motion === 'attackLeft' ? sample([0, -1, 3, 2, 0]) : motion === 'cast' ? sample([0, 1, 2, 1, 0]) : 0;
  return {
    step: walking ? Math.sin(walkPhase) * 2 : 0,
    lift: walking ? (1 - Math.cos(walkPhase * 2)) * 0.35 : 0,
    breath: motion === 'idle' ? [0, 0, -1, -1][frame] : motion === 'cast' ? sample([0, -1, -1, -1, 0])
      : motion === 'dodge' ? sample([0, 1, 2, 1, 0]) : guarding ? sample([0, 0.5, 1, 0.5, 0]) : 0,
    sway: walking ? Math.sin(walkPhase) : motion === 'idle' ? [0, 1, 0, -1][frame] : 0,
    reach: guarding ? sample([0, 1, 2, 1, 0]) : attack,
    recoil: motion === 'hit' ? [-1, -2, 0][frame] : motion === 'dodge' ? sample([0, -2, -3, -1, 0])
      : guarding ? sample([0, -0.5, -1, -0.5, 0]) : 0,
    blink: motion === 'idle' && frame === 3,
    frame, progress, motion,
  };
}

export function facingFromDelta(dx: number, dy: number, fallback: UnitFacing = 'south'): UnitFacing {
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'east' : 'west' : dy > 0 ? 'south' : 'north';
}

export function unitFrameName(facing: UnitFacing, motion: UnitMotion, frame: number): string {
  return `${facing}:${motion}:${frame}`;
}
