import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { BODY_PARTS, LIMB_PARTS } from '@shards/shared';
import { bodyCombatStats, bodyHealthRatio, bodyMovementMultiplier, bodyPartForRoll, bodyTotalHealth, canBodyAct, damageBody, effectiveBodyArmor, equipmentCondition, healBody, isBodyAlive, restBody, restoreHeroBody, startHeroBody } from '../packages/game-core/src/anatomy';

const guardian = gameContent.characters[0];

describe('six-part hero anatomy', () => {
  it('builds the starting resource budget from 25% base and 75% fixed equipment', () => {
    const expected = [[28, 64, 40, 40, 44, 44], [28, 52, 32, 32, 36, 36], [28, 44, 32, 32, 32, 32]];
    gameContent.characters.slice(0, 3).forEach((definition, index) => {
      const body = startHeroBody(definition);
      expect(BODY_PARTS.map(part => body[part].max)).toEqual(expected[index]);
      for (const part of BODY_PARTS) expect(definition.anatomy!.base[part]).toBe(body[part].max / 4);
      expect(bodyCombatStats(definition, body)).toEqual({ ...definition.stats, maxHp: bodyTotalHealth(body) });
    });
  });

  it('assigns exactly the agreed unmodified twenty roll outcomes', () => {
    const outcomes = Array.from({ length: 20 }, (_, index) => bodyPartForRoll(index + 1));
    expect(outcomes).toEqual([null, ...Array(10).fill('torso'), 'leftArm', 'leftArm', 'rightArm', 'rightArm', 'leftLeg', 'leftLeg', 'rightLeg', 'rightLeg', 'head']);
  });

  it('discards overflow, redirects a missing limb to the torso and never revives', () => {
    const fresh = startHeroBody(guardian);
    const severed = damageBody(fresh, 'leftArm', 1000);
    expect(severed.damage).toBe(40);
    expect(severed.body.leftArm.current).toBe(0);
    expect(severed.body.torso.current).toBe(64);
    expect(fresh.leftArm.current).toBe(40);
    const redirected = damageBody(severed.body, 'leftArm', 7);
    expect(redirected.part).toBe('torso');
    expect(redirected.body.torso.current).toBe(57);
    const fatal = damageBody(redirected.body, 'head', 28).body;
    expect(isBodyAlive(fatal)).toBe(false);
    expect(healBody(fatal, 1000)).toEqual({ body: fatal, healed: 0 });
    expect(restBody(fatal)).toEqual(fatal);
    const limbless = startHeroBody(guardian);
    for (const limb of LIMB_PARTS) limbless[limb].current = 0;
    expect(isBodyAlive(limbless)).toBe(false);
  });

  it('uses one integer healing budget and redistributes filled shares without healing missing limbs', () => {
    const body = startHeroBody(guardian);
    body.head.current--;
    body.torso.current = 1;
    body.leftArm.current = 0;
    const before = structuredClone(body);
    const healed = healBody(body, 20);
    expect(healed.healed).toBe(20);
    expect(healed.body.head.current).toBe(28);
    expect(healed.body.torso.current).toBe(20);
    expect(healed.body.leftArm.current).toBe(0);
    expect(body).toEqual(before);
    expect(healBody(body, 20)).toEqual(healed);
    expect(healBody(body, 1000).healed).toBe(64);
    expect(restBody(body).leftArm.current).toBe(0);
    expect(bodyHealthRatio(restBody(body))).toBe(1);
  });

  it('heals in proportion to maxima with stable integer remainder allocation', () => {
    const body = startHeroBody(guardian);
    for (const part of BODY_PARTS) body[part].current = 1;
    const result = healBody(body, 10);
    expect(BODY_PARTS.map(part => result.body[part].current - 1)).toEqual([1, 2, 2, 1, 2, 2]);
    for (let amount = 1; amount < 300; amount++) {
      const healed = healBody(body, amount);
      expect(healed.healed).toBe(Math.min(amount, 254));
      expect(bodyTotalHealth(healed.body) - bodyTotalHealth(body)).toBe(healed.healed);
    }
  });

  it('keeps wounded equipment active and disables only the lost arm or half of a paired item', () => {
    const body = startHeroBody(guardian);
    body.rightArm.current = 1;
    expect(bodyCombatStats(guardian, body).power).toBe(guardian.stats.power);
    expect(effectiveBodyArmor(guardian, body)).toBe(18);
    body.rightArm.current = 0;
    const gloves = guardian.anatomy!.equipment.find(item => item.slot === 'gloves')!;
    const weapon = guardian.anatomy!.equipment.find(item => item.slot === 'rightHand')!;
    expect(equipmentCondition(gloves, body)).toMatchObject({ active: true, fraction: 0.5, armor: 1, resources: { leftArm: 30 } });
    expect(equipmentCondition(weapon, body).active).toBe(false);
    expect(effectiveBodyArmor(guardian, body)).toBe(17);
    expect(bodyCombatStats(guardian, body).power).toBe(2);
    expect(canBodyAct(body)).toBe(true);
    body.leftArm.current = 0;
    expect(canBodyAct(body)).toBe(false);
    expect(isBodyAlive(body)).toBe(true);
    body.leftLeg.current = 0;
    expect(effectiveBodyArmor(guardian, body)).toBe(13);
  });

  it('derives movement from remaining leg fractions and permits 10% crawling with an arm', () => {
    const body = startHeroBody(guardian);
    body.leftLeg.current /= 2;
    expect(bodyMovementMultiplier(body)).toBe(0.75);
    body.leftLeg.current = 0;
    expect(bodyMovementMultiplier(body)).toBe(0.5);
    body.rightLeg.current = 0;
    expect(bodyMovementMultiplier(body)).toBe(0.1);
    body.leftArm.current = body.rightArm.current = 0;
    expect(bodyMovementMultiplier(body)).toBe(0);
  });

  it('rejects malformed resources and changed equipment maxima when restoring', () => {
    const body = startHeroBody(guardian);
    expect(restoreHeroBody(body, body)).toEqual(body);
    for (const value of [-1, 0.5, 29, NaN]) expect(() => restoreHeroBody({ ...body, head: { current: value, max: 28 } }, body)).toThrow();
    expect(() => restoreHeroBody({ ...body, head: { current: 1, max: 29 } }, body)).toThrow();
    expect(() => restoreHeroBody({ ...body, tail: { current: 1, max: 1 } }, body)).toThrow();
  });
});
