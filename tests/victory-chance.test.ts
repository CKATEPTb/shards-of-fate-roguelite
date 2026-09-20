import { describe, expect, it } from 'vitest';
import { createCombat } from '../packages/game-core/src/create';
import { runCombat } from '../packages/game-core/src/combat';
import { gameContent } from '@shards/game-data';
import { estimateVictoryChance } from '../packages/game-core/src/victory-chance';
import { hashString } from '../packages/game-core/src/random';

const options = { seed: 'forecast', characterIds: ['guardian'], encounterId: 'roaming', enemyIds: ['wolf', 'wolf'] };

describe('sampled victory chance', () => {
  it('matches independent battles under the actual combat rules', () => {
    const samples = 24;
    const before = structuredClone({ options, gameContent });
    const outcomes = Array.from({ length: samples }, (_, index) => runCombat(createCombat({
      ...options, seed: `estimate:${hashString(options.seed).toString(16)}:${index}`,
    }, gameContent), gameContent).status);
    const estimate = estimateVictoryChance(options, gameContent, samples);
    expect(estimate.wins).toBe(outcomes.filter(status => status === 'victory').length);
    expect(estimate.draws).toBe(outcomes.filter(status => status === 'draw').length);
    expect(estimate.samples).toBe(samples);
    expect({ options, gameContent }).toEqual(before);
    expect(estimateVictoryChance(options, gameContent, samples)).toEqual(estimate);
  });

  it('uses independent trials rather than repeating one deterministic result', () => {
    const content = structuredClone(gameContent);
    for (const unit of [...content.characters, ...content.enemies]) {
      delete unit.anatomy;
      unit.stats = { maxHp: 1, power: 0, armor: 0, initiative: 0, crit: 0, evasion: 0, healing: 0 };
      unit.basicAttack = { type: 'damage', dice: '1d4' };
      unit.skillIds = []; unit.effectIds = []; unit.modifiers = {};
    }
    content.balance.partyScaling[1] = { hp: 1, damage: 1 };
    const estimate = estimateVictoryChance({ ...options, enemyIds: ['rat'] }, content);
    expect(estimate.samples).toBe(64);
    expect(estimate.percent).toBeGreaterThan(0);
    expect(estimate.percent).toBeLessThan(100);
    expect(estimate.percent).toBe(Math.round(estimate.wins / 64 * 100));
  });

  it('reports sampled extremes and counts draws separately from victories', () => {
    const easy = estimateVictoryChance({ ...options, characterIds: ['guardian', 'priest', 'mage'], enemyIds: ['rat'] }, gameContent, 16);
    const hard = estimateVictoryChance({ ...options, enemyIds: Array(16).fill('elite_warden') }, gameContent, 16);
    expect(easy).toEqual({ percent: 100, wins: 16, samples: 16, draws: 0 });
    expect(hard).toEqual({ percent: 0, wins: 0, samples: 16, draws: 0 });
    const content = structuredClone(gameContent);
    content.balance.maxRounds = 1;
    for (const unit of [...content.characters, ...content.enemies]) { delete unit.anatomy; unit.stats.maxHp = 1_000_000; }
    expect(estimateVictoryChance(options, content, 8)).toEqual({ percent: 0, wins: 0, samples: 8, draws: 8 });
  });

  it('derives bounded independent seeds even from a maximum-length world seed', () => {
    expect(estimateVictoryChance({ ...options, seed: 'a'.repeat(256) }, gameContent, 1).samples).toBe(1);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 4097])('rejects invalid sample count %s', samples => {
    expect(() => estimateVictoryChance(options, gameContent, samples)).toThrow();
  });
});
