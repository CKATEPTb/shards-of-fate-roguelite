import { describe, expect, it } from 'vitest';
import { createCombat } from '@shards/game-core';
import { runActions } from '../packages/game-core/src/actions';
import { createContext } from '../packages/game-core/src/events';
import { contentFixture, options } from '../packages/game-core/src/__tests__/fixtures';

describe('enemy sustain follows small-party health scaling', () => {
  it.each([.4, .8, 1, 2.4])('scales healing and shields at hp factor %s without adding random draws', factor => {
    const content = contentFixture(); content.balance.partyScaling[1].hp = factor;
    for (const type of ['heal', 'shield'] as const) {
      const state = createCombat(options, content), enemy = state.units[1]; enemy.hp = 1;
      runActions(createContext(state, content), [{ type, dice: '10d1', ...(type === 'shield' ? { duration: 2 } : {}) }],
        { source: enemy, target: 'self', origin: 'status' });
      expect(type === 'heal' ? enemy.hp - 1 : enemy.shield).toBe(Math.floor(10 * Math.min(1, factor)));
      expect(state.rng.diceIndex).toBe(10);
    }
  });
  it('preserves hero healing and shielding in a solo party', () => {
    const content = contentFixture(); content.balance.partyScaling[1].hp = .4;
    const state = createCombat(options, content), hero = state.units[0];
    runActions(createContext(state, content), [{ type: 'shield', dice: '10d1', duration: 2 }], { source: hero, target: 'self', origin: 'status' });
    expect(hero.shield).toBe(10);
    expect(state.rng.diceIndex).toBe(10);
  });
  it('keeps enemy sustain stable when another hero joins without resizing the enemy', () => {
    const content = contentFixture(); content.balance.partyScaling[1].hp = .4;
    content.balance.partyScaling[2].hp = 1;
    for (const type of ['heal', 'shield'] as const) {
      const state = createCombat(options, content), enemy = state.units[1]; enemy.hp = 1;
      state.characterIds.push('reinforcement');
      runActions(createContext(state, content), [{ type, dice: '10d1', ...(type === 'shield' ? { duration: 2 } : {}) }],
        { source: enemy, target: 'self', origin: 'status' });
      expect(type === 'heal' ? enemy.hp - 1 : enemy.shield).toBe(4);
      expect(state.rng.diceIndex).toBe(10);
    }
  });
});
