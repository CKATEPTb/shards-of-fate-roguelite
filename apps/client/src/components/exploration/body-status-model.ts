import { BODY_PARTS, type BodyPart, type HeroBody } from '@shards/shared';
import { bodyPartLossThreshold, isBodyPartPresent } from '@shards/game-core';

export const bodyParts = BODY_PARTS;
export const bodyPartNames: Record<BodyPart, string> = {
  head: 'Голова', torso: 'Торс', leftArm: 'Левая рука', rightArm: 'Правая рука', leftLeg: 'Левая нога', rightLeg: 'Правая нога',
};
export const bodyPartAbbreviations: Record<BodyPart, string> = {
  head: 'Г', torso: 'Т', leftArm: 'ЛР', rightArm: 'ПР', leftLeg: 'ЛН', rightLeg: 'ПН',
};

export function bodyPartView(body: HeroBody, part: BodyPart) {
  const resource = body[part];
  const ratio = resource.max > 0 ? Math.max(0, Math.min(1, resource.current / resource.max)) : 0;
  const threshold = bodyPartLossThreshold(resource.max);
  const reserve = Math.max(0, Math.min(1, (resource.current - threshold) / -threshold));
  const state = !isBodyPartPresent(body, part) ? 'lost' : resource.current <= 0 ? 'disabled' : resource.current < resource.max ? 'injured' : 'intact';
  const label = state === 'lost' ? part === 'torso' ? 'Разрушен' : part === 'head' ? 'Разрушена' : 'Утрачена'
    : state === 'disabled' ? part === 'head' || part === 'torso' ? 'Критическое повреждение · может действовать' : 'Не действует · можно вылечить'
    : state === 'injured' ? part === 'torso' ? 'Повреждён' : 'Повреждена' : part === 'torso' ? 'Цел' : 'Цела';
  return { ...resource, ratio, reserve, threshold, state, label };
}
