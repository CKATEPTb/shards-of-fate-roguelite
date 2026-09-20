import { describe, expect, it } from 'vitest';
import { createCombat, isTerminal, runCombat, stepCombat } from '../index';
import { contentFixture, deepFreeze, options } from './fixtures';

describe('combat transition', () => {
  it('replays exactly, independent of one-step or full-run scheduling', () => {
    const content = contentFixture();
    const original = createCombat(options, content);
    let stepped = original;
    while (!isTerminal(stepped)) stepped = stepCombat(stepped, content);
    expect(stepped).toEqual(runCombat(original, content));
    expect(runCombat(original, content)).toEqual(runCombat(createCombat(options, content), content));
  });
  it('leaves content, options and all prior state graphs untouched', () => {
    const content = deepFreeze(contentFixture());
    const input = deepFreeze({ ...options, characterIds: [...options.characterIds] });
    const initial = deepFreeze(createCombat(input, content));
    const saved = JSON.stringify(initial);
    const first = deepFreeze(stepCombat(initial, content));
    runCombat(first, content);
    expect(JSON.stringify(initial)).toBe(saved);
    expect(first.turn).toBe(1);
    expect(initial.status).toBe('ready');
  });
  it('rerolls initiative once each round and records every random draw', () => {
    const result = runCombat(createCombat(options, contentFixture()), contentFixture());
    expect(result.events.filter(event => event.type === 'ROUND_STARTED')).toHaveLength(result.round);
    const rolls = result.events.flatMap(event => event.type === 'DICE_ROLLED' ? event.rolls! : []);
    expect(result.rng.streams.COMBAT.counter).toBe(rolls.length);
    expect(result.events.at(-1)?.type).toBe('COMBAT_ENDED');
  });
  it('caps stalemates as draw and leaves terminal battles unchanged', () => {
    const content = contentFixture();
    content.balance.maxRounds = 3;
    content.characters[0].stats.power = 0;
    content.enemies[0].stats.power = 0;
    const result = runCombat(createCombat(options, content), content);
    expect(result.status).toBe('draw');
    expect(result.round).toBe(3);
    expect(result.turn).toBe(6);
    expect(stepCombat(result, content)).toEqual(result);
  });
  it('measures cooldowns in the skill owner’s turns', () => {
    const content = contentFixture();
    content.characters[0].stats.maxHp = 10_000;
    content.enemies[0].stats.maxHp = 10_000;
    content.characters[0].skillIds = ['guard'];
    content.skills.push({ schemaVersion: 1, id: 'guard', name: 'Guard', description: 'Guard', cooldown: 3, priority: 1, target: 'self', condition: 'always', actions: [{ type: 'shield', scaling: 'power' }], tags: [] });
    let state = createCombat(options, content);
    while (state.units[0].turnsTaken < 7) state = stepCombat(state, content);
    const turns = state.events.filter(event => event.type === 'TURN_STARTED' && event.actorId === state.units[0].id);
    const activations = state.events.filter(event => event.type === 'SKILL_USED');
    expect(activations.map(event => turns.findIndex(turn => turn.turn === event.turn) + 1)).toEqual([1, 4, 7]);
  });
  it('rejects invalid seed, unknown rosters and duplicates before play', () => {
    for (const invalid of [{ ...options, seed: '' }, { ...options, characterIds: [] }, { ...options, characterIds: ['missing'] }, { ...options, characterIds: ['hero', 'hero'] }, { ...options, encounterId: 'missing' }]) expect(() => createCombat(invalid, contentFixture())).toThrow();
  });
});
