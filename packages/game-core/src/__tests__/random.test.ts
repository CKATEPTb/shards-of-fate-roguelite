import { describe, expect, it } from 'vitest';
import { createRng, nextRandom, parseDice, rollD20, rollDice } from '../index';

describe('named deterministic randomness', () => {
  it('repeats a stream exactly and never mutates its input', () => {
    const first = createRng('snow');
    expect(nextRandom(first)).toEqual(nextRandom(createRng('snow')));
    expect(first.streams.COMBAT.counter).toBe(0);
    expect(nextRandom(first).rng.streams.COMBAT.counter).toBe(1);
  });
  it('keeps unrelated systems independent', () => {
    const initial = createRng('separate');
    let noisy = initial;
    for (let i = 0; i < 30; i++) noisy = nextRandom(noisy, 'LOOT').rng;
    expect(nextRandom(noisy, 'COMBAT').value).toBe(nextRandom(initial, 'COMBAT').value);
    expect(noisy.streams.COMBAT).toEqual(initial.streams.COMBAT);
    expect(noisy.streams.LOOT.counter).toBe(30);
  });
  it('uses all five persisted streams with a known deterministic vector', () => {
    expect(Object.keys(createRng('vector').streams)).toEqual(['WORLD', 'COMBAT', 'LOOT', 'ENCOUNTER', 'EVENT']);
    const rolled = rollDice('6d20+2', createRng('vector'));
    expect(rolled.result.rolls).toEqual([5, 20, 7, 6, 7, 9]);
    expect(rolled.rng.streams.COMBAT.counter).toBe(6);
    expect(rolled.result.total).toBe(rolled.result.rolls.reduce((a, b) => a + b, 2));
  });
});

describe('dice notation', () => {
  it('supports standard polyhedral dice, shorthand and signed modifiers', () => {
    for (const sides of [4, 6, 8, 10, 12, 20]) {
      const rolled = rollDice(`5d${sides} - 3`, createRng('dice'));
      expect(rolled.result.rolls.every(value => value >= 1 && value <= sides)).toBe(true);
      expect(rolled.result.modifier).toBe(-3);
    }
    expect(parseDice(' D20 + 2 ')).toEqual({ count: 1, sides: 20, modifier: 2 });
  });
  it.each(['', 'd3', '1d100', '0d6', '-1d6', '1.5d6', '1001d4', '2d6+1000001', '2d6junk', '1d6+NaN'])('rejects malformed or unbounded input %s', expression => {
    expect(() => parseDice(expression)).toThrow();
  });
  it('advantage and disadvantage consume exactly two draws', () => {
    const initial = createRng('advantage');
    const high = rollD20(initial, 'advantage');
    const low = rollD20(initial, 'disadvantage');
    expect(high.result.rolls).toEqual(low.result.rolls);
    expect(high.result.total).toBe(Math.max(...high.result.rolls));
    expect(low.result.total).toBe(Math.min(...low.result.rolls));
    expect(high.rng.streams.COMBAT.counter).toBe(2);
  });
});
