import { BODY_PARTS, type BodyPart, type HeroBody, type UnitDefinition } from '@shards/shared';

export function bodyPartLossThreshold(max: number): number { return -Math.ceil(max / 2); }

export function isBodyPartPresent(body: HeroBody, part: BodyPart): boolean {
  return body[part].lost !== true;
}

export function isBodyPartFunctional(body: HeroBody, part: BodyPart): boolean {
  return isBodyPartPresent(body, part) && body[part].current > 0;
}

export function cloneHeroBody(body: HeroBody): HeroBody {
  return Object.fromEntries(BODY_PARTS.map(part => [part, { ...body[part], lost: body[part].lost ?? false }])) as HeroBody;
}

export function startHeroBody(definition: UnitDefinition): HeroBody {
  const weights = { head: 0.12, torso: 0.28, leftArm: 0.15, rightArm: 0.15, leftLeg: 0.15, rightLeg: 0.15 };
  return Object.fromEntries(BODY_PARTS.map(part => {
    const max = definition.anatomy
      ? definition.anatomy.base[part] + definition.anatomy.equipment.reduce((sum, item) => sum + (item.resources[part] ?? 0), 0)
      : Math.max(1, Math.round(definition.stats.maxHp * weights[part]));
    return [part, { current: max, max, lost: false }];
  })) as HeroBody;
}

export function isBodyAlive(body: HeroBody): boolean {
  return isBodyPartPresent(body, 'head') && isBodyPartPresent(body, 'torso');
}

export function canBodyAct(body: HeroBody): boolean {
  return isBodyAlive(body) && (isBodyPartFunctional(body, 'leftArm') || isBodyPartFunctional(body, 'rightArm'));
}

export function bodyTotalHealth(body: HeroBody): number { return BODY_PARTS.reduce((sum, part) => sum + Math.max(0, body[part].current), 0); }
export function bodyMaxHealth(body: HeroBody): number { return BODY_PARTS.reduce((sum, part) => sum + body[part].max, 0); }
export function bodyCombatHealth(body: HeroBody): number { return isBodyAlive(body) ? Math.max(1, bodyTotalHealth(body)) : 0; }

/** Prioritize the most wounded surviving part: intact limbs must not hide a critical head wound. */
export function bodyHealthRatio(body: HeroBody): number {
  if (!isBodyAlive(body)) return 0;
  const present = BODY_PARTS.filter(part => isBodyPartPresent(body, part));
  return Math.min(...present.map(part => Math.max(0, Math.min(1, body[part].current / body[part].max))));
}

export function bodyMovementMultiplier(body: HeroBody): number {
  if (!isBodyAlive(body)) return 0;
  const fraction = (part: 'leftLeg' | 'rightLeg') => isBodyPartPresent(body, part)
    ? Math.max(0, Math.min(1, body[part].current / body[part].max)) : 0;
  const legs = fraction('leftLeg') + fraction('rightLeg');
  return legs > 0 ? legs / 2 : canBodyAct(body) ? 0.1 : 0;
}

/** The unmodified location roll is independent of the following accuracy roll. */
export function bodyPartForRoll(roll: number): BodyPart {
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) throw new Error('Body location requires a d20 result');
  if (roll <= 11) return 'torso';
  if (roll <= 13) return 'leftArm';
  if (roll <= 15) return 'rightArm';
  if (roll <= 17) return 'leftLeg';
  if (roll <= 19) return 'rightLeg';
  return 'head';
}

export function damageBody(body: HeroBody, part: BodyPart, amount: number): { body: HeroBody; part: BodyPart; damage: number } {
  const updated = cloneHeroBody(body);
  const actualPart = isBodyPartPresent(body, part) ? part : 'torso';
  const resource = updated[actualPart];
  const floor = bodyPartLossThreshold(resource.max);
  const damage = isBodyAlive(body) ? Math.min(resource.current - floor, Math.max(0, Math.floor(amount))) : 0;
  resource.current -= damage;
  if (resource.current <= floor) resource.lost = true;
  return { body: updated, part: actualPart, damage };
}

/** Older saves have no location history, so preserve their health fraction without inventing amputations. */
export function legacyHeroBody(definition: UnitDefinition, hp: number, maxHp: number): HeroBody {
  const body = startHeroBody(definition);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  for (const part of BODY_PARTS) {
    body[part].current = ratio > 0 ? Math.max(1, Math.round(body[part].max * ratio)) : bodyPartLossThreshold(body[part].max);
    body[part].lost = ratio === 0;
  }
  return body;
}
