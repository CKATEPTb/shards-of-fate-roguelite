import { describe, expect, it } from 'vitest';
import { BODY_PARTS, type HeroBody } from '@shards/shared';
import { HERO_ART_IDS } from '../apps/client/src/art/heroOutfit';
import { resolveUnitArt, unitFramePixels } from '../apps/client/src/art/unitFrames';
import { spritePixels } from '../apps/client/src/art/sprites';
import { UNIT_CLIPS, UNIT_FACINGS, UNIT_MOTIONS, UNIT_FOOT_Y } from '../apps/client/src/art/unitPose';

const bodyWith = (...missing: (keyof HeroBody)[]): HeroBody => Object.fromEntries(BODY_PARTS.map(part => [part, {
  current: missing.includes(part) ? 0 : 100, max: 100,
}])) as HeroBody;
const geometries = (id: string) => unitFramePixels(id, 'damage').map(pixel => `${pixel.x}:${pixel.y}`).join(',');

describe('nine distinct hero identities', () => {
  it('recognizes every hero and gives each a distinct silhouette, not just recolored clothing', () => {
    expect(HERO_ART_IDS).toHaveLength(9);
    for (const id of HERO_ART_IDS) expect(resolveUnitArt(id, 'damage', false)).toBe(id);
    expect(new Set(HERO_ART_IDS.map(geometries)).size).toBe(9);
    expect(new Set(HERO_ART_IDS.map(id => JSON.stringify(spritePixels(id, 'damage')))).size).toBe(9);
  });

  it.each(HERO_ART_IDS)('%s animates and stays grounded with missing limbs and while crawling', id => {
    for (const body of [bodyWith(), bodyWith('rightArm'), bodyWith('leftArm'), bodyWith('leftLeg'), bodyWith('leftLeg', 'rightLeg'), bodyWith('leftLeg', 'rightLeg', 'leftArm')]) {
      for (const facing of UNIT_FACINGS) for (const motion of UNIT_MOTIONS) {
        const frames = new Set<string>();
        for (let frame = 0; frame < UNIT_CLIPS[motion].frames; frame++) {
          const pixels = unitFramePixels(id, 'damage', false, facing, motion, frame, body);
          expect(pixels.length).toBeGreaterThan(30);
          expect(Math.max(...pixels.map(pixel => pixel.y)) + 1, `${id} ${facing} ${motion}:${frame}`).toBe(UNIT_FOOT_Y);
          frames.add(JSON.stringify(pixels));
        }
        expect(frames.size, `${id} ${facing} ${motion}`).toBeGreaterThan(1);
      }
    }
    const cast = unitFramePixels(id, 'damage', false, 'south', 'cast', 2);
    expect(cast).not.toEqual(unitFramePixels(id, 'damage', false, 'south', 'attack', 2));
    expect(spritePixels(id, 'damage').every(pixel => pixel.y >= 0 && pixel.y < 26)).toBe(true);
  });

  it.each(UNIT_FACINGS)('removes new main-hand weapons with the right arm facing %s', facing => {
    for (const [id, color] of [['vampire', '#dbd5d0'], ['druid', '#8d734b'], ['necromancer', '#8d734b'], ['rogue', '#b7d2d3'], ['ranger', '#bf965c']]) {
      const unarmed = unitFramePixels(id, 'damage', false, facing, 'idle', 0, bodyWith('rightArm', 'leftArm'));
      expect(unarmed.some(pixel => pixel.color === color), id).toBe(false);
      expect(unitFramePixels(id, 'damage', false, facing, 'idle', 0).some(pixel => pixel.color === color), id).toBe(true);
    }
  });
});
