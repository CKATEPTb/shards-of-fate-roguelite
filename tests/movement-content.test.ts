import { describe, expect, it } from 'vitest';
import { gameContent, MOVEMENT_SPEED_PROFILES } from '@shards/game-data';
import { validateContent } from '../tools/content-validator/src';

describe('movement speed content', () => {
  it('keeps exploration speeds independent from combat initiative', () => {
    expect(validateContent(gameContent).valid).toBe(true);
    expect(gameContent.characters.map(hero => [hero.id, hero.movementSpeed, hero.stats.initiative])).toEqual([
      ['guardian', 100, 2], ['priest', 103, 3], ['mage', 105, 4],
      ['vampire', 102, 3], ['paladin', 98, 1], ['druid', 104, 3],
      ['necromancer', 101, 2], ['rogue', 110, 6], ['ranger', 107, 5],
    ]);
    expect(MOVEMENT_SPEED_PROFILES.assassin).toBe(110);
    expect(gameContent.characters.some(hero => hero.id === 'assassin')).toBe(false);
  });

  it('accepts existing unit content without an explicit exploration speed', () => {
    const content = structuredClone(gameContent);
    for (const hero of content.characters) delete hero.movementSpeed;
    expect(validateContent(content).valid).toBe(true);
  });

  it.each([0, -10, 9.9, 300.1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid movement speed %s', speed => {
    const content = structuredClone(gameContent);
    content.characters[0].movementSpeed = speed;
    const result = validateContent(content);
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.path === 'characters.0.movementSpeed')).toBe(true);
  });

  it.each([10, 102.5, 300])('accepts finite movement speed %s within balance limits', speed => {
    const content = structuredClone(gameContent);
    content.characters[0].movementSpeed = speed;
    expect(validateContent(content).valid).toBe(true);
  });
});
