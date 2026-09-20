import { BODY_PARTS, type BodyPart, type HeroBody } from '@shards/shared';

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
  const state = resource.current <= 0 ? 'lost' : resource.current < resource.max ? 'injured' : 'intact';
  const label = state === 'lost' ? part === 'torso' ? 'Разрушен' : part === 'head' ? 'Разрушена' : 'Утрачена'
    : state === 'injured' ? part === 'torso' ? 'Повреждён' : 'Повреждена' : part === 'torso' ? 'Цел' : 'Цела';
  return { ...resource, ratio, state, label };
}
