import { BODY_PARTS, LIMB_PARTS, type BodyPart, type HeroBody, type UnitDefinition } from '@shards/shared';

export function cloneHeroBody(body: HeroBody): HeroBody {
  return Object.fromEntries(BODY_PARTS.map(part => [part, { ...body[part] }])) as HeroBody;
}

export function startHeroBody(definition: UnitDefinition): HeroBody {
  const weights = { head: 0.12, torso: 0.28, leftArm: 0.15, rightArm: 0.15, leftLeg: 0.15, rightLeg: 0.15 };
  return Object.fromEntries(BODY_PARTS.map(part => {
    const max = definition.anatomy
      ? definition.anatomy.base[part] + definition.anatomy.equipment.reduce((sum, item) => sum + (item.resources[part] ?? 0), 0)
      : Math.max(1, Math.round(definition.stats.maxHp * weights[part]));
    return [part, { current: max, max }];
  })) as HeroBody;
}

export function isBodyAlive(body: HeroBody): boolean {
  return body.head.current > 0 && body.torso.current > 0 && LIMB_PARTS.some(part => body[part].current > 0);
}

export function canBodyAct(body: HeroBody): boolean {
  return isBodyAlive(body) && (body.leftArm.current > 0 || body.rightArm.current > 0);
}

export function bodyTotalHealth(body: HeroBody): number { return BODY_PARTS.reduce((sum, part) => sum + body[part].current, 0); }
export function bodyMaxHealth(body: HeroBody): number { return BODY_PARTS.reduce((sum, part) => sum + body[part].max, 0); }
export function bodyCombatHealth(body: HeroBody): number { return isBodyAlive(body) ? bodyTotalHealth(body) : 0; }

/** Prioritize the most wounded surviving part: intact limbs must not hide a critical head wound. */
export function bodyHealthRatio(body: HeroBody): number {
  if (!isBodyAlive(body)) return 0;
  const present = BODY_PARTS.filter(part => body[part].current > 0);
  return Math.min(...present.map(part => body[part].current / body[part].max));
}

export function bodyMovementMultiplier(body: HeroBody): number {
  if (!isBodyAlive(body)) return 0;
  const legs = body.leftLeg.current / body.leftLeg.max + body.rightLeg.current / body.rightLeg.max;
  return legs > 0 ? legs / 2 : 0.1;
}

/** The unmodified location roll is independent of the following accuracy roll. */
export function bodyPartForRoll(roll: number): BodyPart | null {
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) throw new Error('Body location requires a d20 result');
  if (roll === 1) return null;
  if (roll <= 11) return 'torso';
  if (roll <= 13) return 'leftArm';
  if (roll <= 15) return 'rightArm';
  if (roll <= 17) return 'leftLeg';
  if (roll <= 19) return 'rightLeg';
  return 'head';
}

export function damageBody(body: HeroBody, part: BodyPart, amount: number): { body: HeroBody; part: BodyPart; damage: number } {
  const updated = cloneHeroBody(body);
  const actualPart = LIMB_PARTS.includes(part as typeof LIMB_PARTS[number]) && body[part].current === 0 ? 'torso' : part;
  const damage = isBodyAlive(body) ? Math.min(updated[actualPart].current, Math.max(0, Math.floor(amount))) : 0;
  updated[actualPart].current -= damage;
  return { body: updated, part: actualPart, damage };
}

/** Older saves have no location history, so preserve their health fraction without inventing amputations. */
export function legacyHeroBody(definition: UnitDefinition, hp: number, maxHp: number): HeroBody {
  const body = startHeroBody(definition);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  for (const part of BODY_PARTS) body[part].current = ratio > 0 ? Math.max(1, Math.round(body[part].max * ratio)) : 0;
  return body;
}
