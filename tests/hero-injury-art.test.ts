import { describe, expect, it } from 'vitest';
import { BODY_PARTS, type HeroBody } from '@shards/shared';
import { characters, enemies } from '@shards/game-data';
import { heroAppearanceKey } from '../apps/client/src/art/heroAppearance';
import { unitFramePixels } from '../apps/client/src/art/unitFrames';
import { UNIT_CLIPS, UNIT_FACINGS, UNIT_FOOT_Y, UNIT_FRAME_SIZE, UNIT_MOTIONS, type UnitFacing } from '../apps/client/src/art/unitPose';
import { UnitAtlasLifetime } from '../apps/client/src/game/unitAtlasLifetime';

const body = (changes: Partial<Record<keyof HeroBody, number>> = {}): HeroBody => Object.fromEntries(
  BODY_PARTS.map((part) => [part, { current: changes[part] ?? 100, max: 100 }]),
) as HeroBody;

describe('hero injury art', () => {
  it('shares atlas keys within injury bands and ignores non-visible damage amounts', () => {
    expect(heroAppearanceKey(body({ leftLeg: 50, head: 15, torso: 23, leftArm: 10 })))
      .toBe(heroAppearanceKey(body({ leftLeg: 60 })));
    expect(heroAppearanceKey(body())).toBe(heroAppearanceKey());
    expect(heroAppearanceKey(body({ leftLeg: 20 }))).not.toBe(heroAppearanceKey(body({ leftLeg: 50 })));
    expect(heroAppearanceKey(body({ leftLeg: 80 }))).not.toBe(heroAppearanceKey(body()));
    expect(heroAppearanceKey(body({ leftLeg: 0 }))).not.toBe(heroAppearanceKey(body({ leftLeg: 1 })));
  });

  it.each(characters)('$id stays anchored for injured, amputated and crawling poses in every direction', (hero) => {
    for (const changes of [{ leftLeg: 80 }, { leftLeg: 35 }, { rightLeg: 50 }, { leftLeg: 60, rightLeg: 60 }, { leftLeg: 0 }, { rightLeg: 0 },
      { leftLeg: 0, rightLeg: 0 }, { leftLeg: 0, rightLeg: 0, leftArm: 0 },
      { leftArm: 0 }, { rightArm: 0 }, { leftArm: 0, rightArm: 0 }]) {
      for (const facing of UNIT_FACINGS) for (const motion of UNIT_MOTIONS) {
        const frames = new Set<string>();
        for (let frame = 0; frame < UNIT_CLIPS[motion].frames; frame++) {
          const pixels = unitFramePixels(hero.sprite, hero.role, false, facing, motion, frame, body(changes));
          expect(pixels.length).toBeGreaterThan(30);
          expect(Math.max(...pixels.map((pixel) => pixel.y)) + 1, `${hero.id} ${JSON.stringify(changes)} ${facing} ${motion}:${frame}`).toBe(UNIT_FOOT_Y);
          expect(pixels.every((pixel) => pixel.x >= 0 && pixel.x < UNIT_FRAME_SIZE && pixel.y >= 0 && pixel.y < UNIT_FRAME_SIZE)).toBe(true);
          frames.add(JSON.stringify(pixels));
        }
        expect(frames.size, `${hero.id} ${JSON.stringify(changes)} ${facing} ${motion}`).toBeGreaterThan(1);
      }
    }
  });

  it.each(UNIT_FACINGS)('removes the anatomical arm and its held item when facing %s', (facing) => {
    for (const changes of [{ leftArm: 0 }, { rightArm: 0 }, { leftArm: 0, rightArm: 0 }]) {
      const pixels = unitFramePixels('guardian', 'tank', false, facing, 'idle', 0, body(changes));
      expect(pixels.some((pixel) => pixel.color === '#d0d4bf')).toBe(changes.rightArm !== 0);
      // Shield metal is unique except for the sword tip; its three-pixel rows require the left arm.
      const metal = pixels.filter((pixel) => pixel.color === '#788d91');
      expect(metal.length > 3).toBe(changes.leftArm !== 0);
      const priest = unitFramePixels('priest', 'healer', false, facing, 'idle', 0, body(changes));
      expect(priest.some((pixel) => pixel.color === '#8d734b')).toBe(changes.rightArm !== 0);
    }
  });

  it('keeps the remaining boot under the ground pivot and removes both boots while crawling', () => {
    const bootXs = (facing: UnitFacing, changes: Partial<Record<keyof HeroBody, number>>) =>
      unitFramePixels('mage', 'damage', false, facing, 'idle', 0, body(changes))
        .filter((pixel) => pixel.color === '#625846').map((pixel) => pixel.x);
    for (const facing of UNIT_FACINGS) {
      const one = bootXs(facing, { leftLeg: 0 });
      expect(one.length).toBeGreaterThan(0);
      expect(Math.min(...one)).toBeGreaterThanOrEqual(13);
      expect(Math.max(...one)).toBeLessThanOrEqual(18);
      expect(bootXs(facing, { leftLeg: 0, rightLeg: 0 })).toHaveLength(0);
    }
  });

  it('uses a low crawling silhouette and an asymmetric injured gait', () => {
    for (const facing of UNIT_FACINGS) {
      const healthy = unitFramePixels('guardian', 'tank', false, facing, 'walk', 1, body());
      const injured = unitFramePixels('guardian', 'tank', false, facing, 'walk', 1, body({ leftLeg: 20 }));
      expect(injured).not.toEqual(healthy);
      const crawling = unitFramePixels('guardian', 'tank', false, facing, 'walk', 1, body({ leftLeg: 0, rightLeg: 0 }));
      expect(Math.min(...crawling.map((pixel) => pixel.y))).toBeGreaterThan(Math.min(...healthy.map((pixel) => pixel.y)) + 5);
    }
  });

  it.each(enemies)('leaves $id enemy frames independent of hero anatomy', (enemy) => {
    for (const facing of UNIT_FACINGS) for (const motion of UNIT_MOTIONS) {
      expect(unitFramePixels(enemy.sprite, enemy.role, true, facing, motion, 2, body({ head: 0, leftArm: 0, rightLeg: 0 })))
        .toEqual(unitFramePixels(enemy.sprite, enemy.role, true, facing, motion, 2));
    }
  });
});

describe('injury atlas lifetime', () => {
  it('retains atlases in use and bounds unused variants across repeated injuries', () => {
    const removed: string[] = [];
    const cache = new UnitAtlasLifetime((key) => removed.push(key), 2);
    cache.retain('shared');
    cache.retain('shared');
    cache.release('shared');
    for (let i = 0; i < 20; i++) { cache.retain(`injury:${i}`); cache.release(`injury:${i}`); }
    expect(removed).toHaveLength(18);
    expect(removed).not.toContain('shared');
    cache.release('shared');
    expect(removed.at(-1)).toBe('injury:18');
    cache.retain('shared');
    cache.retain('new'); cache.release('new');
    cache.retain('last'); cache.release('last');
    expect(removed).not.toContain('shared');
  });
});
