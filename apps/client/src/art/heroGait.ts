import type { HeroSide } from './heroRigTypes';
import { UNIT_CLIPS, type UnitPose } from './unitPose';

/** A planted foot travels back under the body before a low, shorter recovery. */
export function heroWalkStep(pose: UnitPose, side: HeroSide) {
  if (pose.motion !== 'walk') return { forward: 0, lift: 0, heel: 0 };
  const phase = (pose.frame / UNIT_CLIPS.walk.frames + (side === 'left' ? 0.5 : 0)) % 1;
  const planted = phase < 0.6;
  const swing = planted ? 0 : (phase - 0.6) / 0.4;
  const recovery = swing * swing * (3 - 2 * swing);
  return {
    forward: planted ? 1 - phase / 0.3 : -1 + recovery * 2,
    lift: planted ? 0 : Math.sin(swing * Math.PI),
    heel: planted ? Math.max(0, (phase - 0.4) / 0.2) : 0,
  };
}
