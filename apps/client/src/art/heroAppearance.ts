import type { HeroBody } from '@shards/shared';
import { isBodyPartFunctional, isBodyPartPresent } from '@shards/game-core';

export type HeroLimb = 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type Part = keyof HeroBody;
export type LegInjury = 0 | 1 | 2;
export interface HeroAppearance {
  present: Record<Part, boolean>;
  functional: Record<Part, boolean>;
  leftLegInjury: LegInjury;
  rightLegInjury: LegInjury;
}

const parts: Part[] = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const legInjury = (part: HeroBody['leftLeg'] | undefined): LegInjury => {
  const ratio = part ? part.current / Math.max(1, part.max) : 1;
  return ratio >= 1 ? 0 : ratio >= 0.5 ? 1 : 2;
};

/** Atlas variants depend on visible injury bands, never individual damage points. */
export function heroAppearance(body?: HeroBody): HeroAppearance {
  return {
    present: Object.fromEntries(parts.map((part) => [part, !body || isBodyPartPresent(body, part)])) as Record<Part, boolean>,
    functional: Object.fromEntries(parts.map((part) => [part, !body || isBodyPartFunctional(body, part)])) as Record<Part, boolean>,
    leftLegInjury: legInjury(body?.leftLeg),
    rightLegInjury: legInjury(body?.rightLeg),
  };
}

export function heroAppearanceKey(body?: HeroBody): string {
  const state = heroAppearance(body);
  return parts.map((part) => state.present[part] ? '1' : '0').join('')
    + ':' + parts.map((part) => state.functional[part] ? '1' : '0').join('')
    + `:${state.leftLegInjury}${state.rightLegInjury}`;
}

/** The west atlas is mirrored after drawing; swap anatomy before that reflection. */
export function mirroredAppearance(state: HeroAppearance): HeroAppearance {
  return {
    present: { ...state.present, leftArm: state.present.rightArm, rightArm: state.present.leftArm,
      leftLeg: state.present.rightLeg, rightLeg: state.present.leftLeg },
    functional: { ...state.functional, leftArm: state.functional.rightArm, rightArm: state.functional.leftArm,
      leftLeg: state.functional.rightLeg, rightLeg: state.functional.leftLeg },
    leftLegInjury: state.rightLegInjury,
    rightLegInjury: state.leftLegInjury,
  };
}

export function screenLimb(sign: number, back: boolean, leg = false): HeroLimb {
  const left = back ? sign < 0 : sign > 0;
  return `${left ? 'left' : 'right'}${leg ? 'Leg' : 'Arm'}` as HeroLimb;
}
