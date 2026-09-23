import { describe, expect, it } from 'vitest';
import { numericSummary, pairedWinDifference, quantile, winInterval } from '../tools/balance-simulator/src/statistics';
import { campaignReportHtml } from '../tools/balance-simulator/src/report-html';

describe('simulation report statistics', () => {
  it('does not claim certainty from zero or all observed wins', () => {
    expect(winInterval(0, 100)[1]).toBeCloseTo(.03699, 4);
    expect(winInterval(100, 100)[0]).toBeCloseTo(.96301, 4);
    expect(winInterval(0, 0)).toEqual([0, 1]);
    expect(() => winInterval(2, 1)).toThrow();
  });
  it('reports 95% uncertainty and successful-run quantiles separately', () => {
    const interval = winInterval(300, 1000);
    expect(interval[0]).toBeCloseTo(.2724, 3);
    expect(interval[1]).toBeCloseTo(.3291, 3);
    expect(quantile([90, 60, 80], .5)).toBe(80);
    expect(numericSummary([]).median).toBeNull();
  });
  it('measures matched seeds rather than treating paired runs as independent', () => {
    const result = pairedWinDifference([[true, true], [false, false], [true, false], [true, false]]);
    expect(result.difference).toBe(.5);
    expect(result.easierOnly).toBe(2);
    expect(result.harderOnly).toBe(0);
    expect(pairedWinDifference([]).confidence95).toEqual([-1, 1]);
  });
  it('retains uncertainty when every paired outcome agrees', () => {
    const pairs = Array.from({ length: 100 }, (_, index) => [index % 2 === 0, index % 2 === 0] as const);
    const result = pairedWinDifference(pairs);
    expect(result.difference).toBe(0);
    expect(result.easierOnly + result.harderOnly).toBe(0);
    expect(result.confidence95[0]).toBeCloseTo(-winInterval(0, pairs.length)[1], 10);
    expect(result.confidence95[1]).toBeCloseTo(winInterval(0, pairs.length)[1], 10);
  });
  it.each([true, false])('retains uncertainty when every discordant pair favors the same setting (%s)', easierWins => {
    const result = pairedWinDifference(Array.from({ length: 100 }, () => [easierWins, !easierWins] as const));
    expect(result.difference).toBe(easierWins ? 1 : -1);
    expect(result.confidence95[1] - result.confidence95[0]).toBeGreaterThan(.03);
    expect(result.confidence95[0]).toBeGreaterThanOrEqual(-1);
    expect(result.confidence95[1]).toBeLessThanOrEqual(1);
    expect(result.confidence95[easierWins ? 1 : 0]).toBe(easierWins ? 1 : -1);
  });
  it('narrows the boundary uncertainty with more paired evidence without removing it', () => {
    const small = pairedWinDifference(Array.from({ length: 10 }, () => [false, false] as const));
    const large = pairedWinDifference(Array.from({ length: 1000 }, () => [false, false] as const));
    expect(large.confidence95[1]).toBeGreaterThan(0);
    expect(large.confidence95[1]).toBeLessThan(small.confidence95[1]);
    expect(pairedWinDifference([[true, false]]).confidence95).toEqual([-1, 1]);
  });
  it('visibly marks even a completed series as unvalidated when its sources changed', () => {
    const report = { complete: true, sourcesUnchanged: false, contentHash: 'test-content', seedPrefix: '<test>',
      completedCampaigns: 100, totalBattles: 500, wallSeconds: 30, virtualHours: 100, byPartySize: [] };
    const html = campaignReportHtml(report);
    expect(html).toContain('<aside class="source-warning" role="alert">');
    expect(html).toContain('Серия не прошла проверку исходников');
    expect(html).toContain('Эти результаты не подтверждают баланс текущей версии');
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('<div class="metrics">'));
    expect(html).toContain('&lt;test>');
    expect(campaignReportHtml({ ...report, sourcesUnchanged: true })).not.toContain('role="alert"');
  });
});
