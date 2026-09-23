import { describe, expect, it } from 'vitest';
import { createCombat, isTerminal, runCombat, stepCombat, submitCombatAction, type CombatDecisionPolicy } from '../index';
import { contentFixture, deepFreeze, options } from './fixtures';

const attackPolicy: CombatDecisionPolicy = state => ({ type: 'attack', actorId: state.pendingActorId!,
  targetId: state.units.find(unit => unit.team === 'enemies' && unit.hp > 0)!.id });

describe('combat transition', () => {
  it('replays exactly, independent of one-step or full-run scheduling', () => {
    const content = contentFixture();
    const original = createCombat(options, content);
    let stepped = original;
    for (let step = 0; step < 500 && !isTerminal(stepped); step++) stepped = stepped.pendingActorId
      ? submitCombatAction(stepped, content, attackPolicy(stepped, content)) : stepCombat(stepped, content);
    expect(isTerminal(stepped)).toBe(true);
    expect(stepped).toEqual(runCombat(original, content, attackPolicy));
    expect(runCombat(original, content, attackPolicy)).toEqual(runCombat(createCombat(options, content), content, attackPolicy));
  });
  it('leaves content, options and all prior state graphs untouched', () => {
    const content = deepFreeze(contentFixture());
    const input = deepFreeze({ ...options, characterIds: [...options.characterIds] });
    const initial = deepFreeze(createCombat(input, content));
    const saved = JSON.stringify(initial);
    const first = deepFreeze(stepCombat(initial, content));
    runCombat(first, content, attackPolicy);
    expect(JSON.stringify(initial)).toBe(saved);
    expect(first.turn).toBe(1);
    expect(initial.status).toBe('ready');
  });
  it('rolls initiative once per encounter and records every entity die', () => {
    const result = runCombat(createCombat(options, contentFixture()), contentFixture(), attackPolicy);
    expect(result.events.filter(event => event.type === 'ROUND_STARTED')).toHaveLength(result.round);
    const rolls = result.events.flatMap(event => event.type === 'DICE_ROLLED' ? event.rolls! : []);
    expect(result.events.filter(event => event.type === 'DICE_ROLLED' && event.rollReason === 'initiative')).toHaveLength(2);
    expect(result.rng.diceIndex).toBe(rolls.length);
    expect(result.events.at(-1)?.type).toBe('COMBAT_ENDED');
  });
  it('caps stalemates as draw and leaves terminal battles unchanged', () => {
    const content = contentFixture();
    content.balance.maxRounds = 3;
    content.characters[0].stats.power = 0;
    content.enemies[0].stats.power = 0;
    const result = runCombat(createCombat(options, content), content, attackPolicy);
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
    for (let step = 0; step < 100 && state.events.filter(event => event.type === 'SKILL_USED').length < 3; step++) {
      if (!state.pendingActorId) state = stepCombat(state, content);
      else state = submitCombatAction(state, content, state.units[0].cooldowns.guard === 0
        ? { type: 'skill', actorId: state.pendingActorId, skillId: 'guard', targetId: state.units[0].id }
        : attackPolicy(state, content));
    }
    const turns = state.events.filter(event => event.type === 'TURN_STARTED' && event.actorId === state.units[0].id);
    const activations = state.events.filter(event => event.type === 'SKILL_USED');
    expect(activations.map(event => turns.findIndex(turn => turn.turn === event.turn) + 1)).toEqual([1, 4, 7]);
  });
  it('waits for a player decision when no offline policy is supplied', () => {
    const content = contentFixture(), state = runCombat(createCombat(options, content), content);
    expect(state.pendingActorId).toBe(state.units[0].id);
    expect(stepCombat(state, content)).toBe(state);
    expect(isTerminal(state)).toBe(false);
  });
  it('rejects invalid seed, unknown rosters and duplicates before play', () => {
    for (const invalid of [{ ...options, seed: '' }, { ...options, characterIds: [] }, { ...options, characterIds: ['missing'] }, { ...options, characterIds: ['hero', 'hero'] }, { ...options, encounterId: 'missing' }]) expect(() => createCombat(invalid, contentFixture())).toThrow();
  });
});
