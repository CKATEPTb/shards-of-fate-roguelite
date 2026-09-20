import { describe, expect, it } from 'vitest';
import { characters, enemies } from '@shards/game-data';
import type { CombatEvent } from '@shards/shared';
import { spritePixels } from '../apps/client/src/art/sprites';
import { unitFramePixels } from '../apps/client/src/art/unitFrames';
import { UNIT_CLIPS, UNIT_FACINGS, UNIT_FOOT_Y, UNIT_FRAME_SIZE, UNIT_GROUND_ORIGIN, UNIT_MOTIONS, facingFromDelta } from '../apps/client/src/art/unitPose';
import { battleMotion } from '../apps/client/src/game/battleMotion';

const roster = [
  ...characters.map((unit) => ({ unit, enemy: false })),
  ...enemies.map((unit) => ({ unit, enemy: true })),
];
const fingerprint = (value: unknown) => JSON.stringify(value);

describe('shared directional unit art', () => {
  it.each(roster)('$unit.id has bounded, distinct animation frames and a real back view', ({ unit, enemy }) => {
    const front = unitFramePixels(unit.sprite, unit.role, enemy, 'south');
    const back = unitFramePixels(unit.sprite, unit.role, enemy, 'north');
    expect(back).not.toEqual(front);
    expect(unitFramePixels(unit.sprite, unit.role, enemy, 'east')).not.toEqual(front);
    for (const facing of UNIT_FACINGS) {
      for (const motion of UNIT_MOTIONS) {
        const uniqueFrames = new Set<string>();
        for (let frame = 0; frame < UNIT_CLIPS[motion].frames; frame++) {
          const pixels = unitFramePixels(unit.sprite, unit.role, enemy, facing, motion, frame);
          expect(pixels.length).toBeGreaterThan(30);
          expect(pixels.every((pixel) => Number.isInteger(pixel.x) && Number.isInteger(pixel.y)
            && pixel.x >= 0 && pixel.y >= 0 && pixel.x < UNIT_FRAME_SIZE && pixel.y < UNIT_FRAME_SIZE
            && /^#[a-f0-9]{6}$/i.test(pixel.color))).toBe(true);
          expect(new Set(pixels.map((pixel) => `${pixel.x}:${pixel.y}`)).size).toBe(pixels.length);
          uniqueFrames.add(fingerprint(pixels));
        }
        expect(uniqueFrames.size, `${unit.id} ${facing} ${motion} must animate`).toBeGreaterThan(1);
      }
    }
  });

  it.each(roster.filter(({ enemy }) => enemy))('$unit.id mirrors its authored profile, including asymmetric equipment', ({ unit, enemy }) => {
    for (const motion of UNIT_MOTIONS) {
      const east = unitFramePixels(unit.sprite, unit.role, enemy, 'east', motion, 2);
      const west = unitFramePixels(unit.sprite, unit.role, enemy, 'west', motion, 2);
      const reflected = east.map((pixel) => ({ ...pixel, x: UNIT_FRAME_SIZE - 1 - pixel.x }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      expect(west).toEqual(reflected);
    }
  });

  it.each(roster)('$unit.id keeps a ground contact in every direction and action frame', ({ unit, enemy }) => {
    for (const facing of UNIT_FACINGS) {
      for (const motion of UNIT_MOTIONS) {
        for (let frame = 0; frame < UNIT_CLIPS[motion].frames; frame++) {
          const pixels = unitFramePixels(unit.sprite, unit.role, enemy, facing, motion, frame);
          const soleEdge = Math.max(...pixels.map((pixel) => pixel.y)) + 1;
          expect(soleEdge, `${unit.id} ${facing} ${motion}:${frame}`).toBe(UNIT_FOOT_Y);
          for (const scale of [1.65, 3.1]) expect((soleEdge - UNIT_FRAME_SIZE * UNIT_GROUND_ORIGIN) * scale).toBe(0);
        }
      }
    }
  });

  it('spider breathing keeps both rear contact points planted', () => {
    const feet = (frame: number) => unitFramePixels('spider', 'damage', true, 'north', 'idle', frame)
      .filter((pixel) => (pixel.x === 5 || pixel.x === 27) && pixel.y === UNIT_FOOT_Y - 1);
    for (let frame = 0; frame < UNIT_CLIPS.idle.frames; frame++) expect(feet(frame)).toHaveLength(2);
  });

  it('keeps all roster identities distinct and portraits aligned with their live art', () => {
    const identities = new Set<string>();
    for (const { unit, enemy } of roster) {
      const frame = unitFramePixels(unit.sprite, unit.role, enemy);
      identities.add(fingerprint(frame));
      const portrait = spritePixels(unit.sprite, unit.role, enemy);
      expect(portrait.map((pixel) => ({ ...pixel, y: pixel.y + 4 }))).toEqual(frame);
      expect(portrait.every((pixel) => pixel.y >= 0 && pixel.y < 26)).toBe(true);
    }
    expect(identities.size).toBe(roster.length);
  });

  it('uses deterministic gait and retains facing when no movement occurs', () => {
    expect(unitFramePixels('mage', 'damage', false, 'north', 'walk', 4)).toEqual(unitFramePixels('mage', 'damage', false, 'north', 'walk', 4));
    expect(facingFromDelta(0, 0, 'west')).toBe('west');
    expect(facingFromDelta(-4, 1)).toBe('west');
    expect(facingFromDelta(3, 0)).toBe('east');
    expect(facingFromDelta(0, -2)).toBe('north');
    expect(facingFromDelta(1, 3)).toBe('south');
  });
});

describe('battle presentation priority', () => {
  const event = (type: CombatEvent['type'], actorId?: string, targetId?: string, amount?: number): CombatEvent => ({
    sequence: 1, turn: 1, round: 1, message: '', type, actorId, targetId, amount,
  });

  it('preserves death over attacks and damage resolved in the same turn', () => {
    expect(battleMotion({ id: 'mage', hp: 0 }, [event('SKILL_USED', 'mage'), event('DAMAGE', 'rat', 'mage', 20)])).toBe('death');
  });

  it('shows a damaging reaction before an attack and ignores zero damage', () => {
    expect(battleMotion({ id: 'mage', hp: 10 }, [event('ATTACK_STARTED', 'mage'), event('DAMAGE', 'rat', 'mage', 2)])).toBe('hit');
    expect(battleMotion({ id: 'mage', hp: 10 }, [event('ATTACK_STARTED', 'mage'), event('DAMAGE', 'rat', 'mage', 0)])).toBe('attack');
  });

  it('animates skills as actions and leaves unrelated events alone', () => {
    expect(battleMotion({ id: 'priest', hp: 10 }, [event('SKILL_USED', 'priest')])).toBe('cast');
    expect(battleMotion({ id: 'mage', hp: 10 }, [event('HEALED', 'priest', 'mage', 5)])).toBeUndefined();
  });
});
