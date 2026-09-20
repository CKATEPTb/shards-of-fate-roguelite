import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import type { GameContent } from '@shards/shared';
import { assertValidContent, ContentValidationError, validateContent } from './index';
import { validDiceExpression } from './common';

const copy = (): GameContent => structuredClone(gameContent);

describe('game content contract', () => {
  it('validates the complete roster and includes every enemy in an encounter', () => {
    expect(validateContent(gameContent)).toEqual({ valid: true, issues: [] });
    expect(gameContent.characters).toHaveLength(9);
    expect(gameContent.enemies).toHaveLength(10);
    const used = new Set(gameContent.encounters.flatMap(({ enemyIds }) => enemyIds));
    expect(gameContent.enemies.every(({ id }) => used.has(id))).toBe(true);
  });

  it('rejects malformed input without throwing', () => {
    for (const input of [undefined, null, {}, [], 'content']) {
      expect(validateContent(input).valid).toBe(false);
    }
  });

  it('reports missing references with their owner path', () => {
    const content = copy();
    content.characters[0].skillIds.push('missing_skill');
    content.skills[0].actions[0].statusId = 'missing_status';
    content.encounters[0].enemyIds.push('missing_enemy');
    const result = validateContent(content);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'characters[0].skillIds[2]', message: 'Unknown reference: missing_skill' }),
      expect.objectContaining({ path: 'skills[0].actions[0].statusId', message: 'Unknown status: missing_status' }),
      expect.objectContaining({ path: 'encounters[0].enemyIds[3]', message: 'Unknown reference: missing_enemy' }),
    ]));
  });

  it('rejects duplicated identifiers and hero/enemy collisions', () => {
    const content = copy();
    content.characters.push(structuredClone(content.characters[0]));
    content.enemies[0].id = content.characters[0].id;
    const result = validateContent(content);
    expect(result.issues.some(({ message }) => message.includes('Duplicate identifier'))).toBe(true);
    expect(result.issues.some(({ message }) => message.includes('identifiers conflict'))).toBe(true);
  });

  it('rejects duplicate skill bindings but permits packs of the same enemy', () => {
    const content = copy();
    content.characters[0].skillIds.push(content.characters[0].skillIds[0]);
    expect(validateContent(content).issues.some(({ path }) => path.includes('skillIds'))).toBe(true);
    content.characters[0].skillIds.pop();
    content.encounters[0].enemyIds.push(content.encounters[0].enemyIds[0]);
    expect(validateContent(content).valid).toBe(true);
  });

  it('rejects unsafe numbers, percentages and mitigation', () => {
    for (const value of [NaN, Infinity, -1]) {
      const content = copy();
      content.characters[0].stats.maxHp = value;
      expect(validateContent(content).valid).toBe(false);
    }
    const content = copy();
    content.characters[0].stats.crit = 1.5;
    content.characters[0].modifiers.damageReduction = 1;
    expect(validateContent(content).issues).toHaveLength(2);
  });

  it('rejects incompatible action payloads', () => {
    const content = copy();
    content.skills[0].actions[0].dice = '1d6';
    expect(validateContent(content).valid).toBe(false);
    content.skills[0].actions = [{ type: 'damage', factor: 2 }];
    expect(validateContent(content).valid).toBe(false);
  });

  it('requires a positive status duration and an explicit periodic trigger', () => {
    const content = copy();
    content.skills[0].actions[0].duration = 0;
    expect(validateContent(content).valid).toBe(false);
    content.skills[0].actions[0].duration = 3;
    delete content.statuses.find(({ id }) => id === 'burning')!.trigger;
    expect(validateContent(content).issues.some(({ path }) => path.includes('trigger'))).toBe(true);
  });

  it('accepts only supported selectors and event contexts', () => {
    const content = copy();
    content.skills[0].target = 'eventTarget';
    expect(validateContent(content).issues[0].message).toContain('no triggering event');
    content.skills[0].target = 'self';
    content.effects[0].trigger = 'COMBAT_STARTED';
    expect(validateContent(content).issues[0].message).toContain('has no target');
    const raw = copy() as unknown as { skills: { target: string }[] };
    raw.skills[0].target = 'random_everything';
    expect(validateContent(raw).valid).toBe(false);
  });

  it('restricts remaining duration scaling to periodic statuses', () => {
    const content = copy();
    content.skills[4].actions[0].scaleWithRemainingDuration = true;
    expect(validateContent(content).issues[0].message).toContain('periodic status');
  });

  it('requires version 1 and all supported party scaling entries', () => {
    const content = copy() as unknown as { schemaVersion: number; balance: { partyScaling: Record<number, unknown> } };
    content.schemaVersion = 2;
    delete content.balance.partyScaling[4];
    expect(validateContent(content).issues).toHaveLength(2);
  });

  it('provides a typed assertion and structured exception', () => {
    const content: unknown = copy();
    assertValidContent(content);
    expect(content.characters[0].id).toBe('guardian');
    expect(() => assertValidContent({})).toThrow(ContentValidationError);
  });
});

describe('dice content syntax', () => {
  it.each(['d4', '1d6', '2d8+3', '2D10 - 2', ' d12 ', '1000d20+1000000'])('accepts %s', (expression) => {
    expect(validDiceExpression(expression)).toBe(true);
  });
  it.each(['d3', '0d6', '1001d6', '2d6.5', '1d6+1000001', '1d6+1d4', '1d6;alert(1)', ''])('rejects %s', (expression) => {
    expect(validDiceExpression(expression)).toBe(false);
  });
});
