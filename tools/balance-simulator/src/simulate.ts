import { createCombat, runCombat } from '@shards/game-core';
import type { GameContent } from '@shards/shared';

export interface SimulationRow {
  encounter: string; party: string[]; runs: number;
  victories: number; defeats: number; draws: number;
  winRate: number; averageRounds: number; averageHpRemaining: number;
}

export function partyCompositions(ids: string[]): string[][] {
  const parties: string[][] = [[]];
  for (const id of ids) {
    const previous = parties.length;
    for (let index = 0; index < previous; index++) {
      if (parties[index].length < 4) parties.push([...parties[index], id]);
    }
  }
  return parties.slice(1);
}

export function simulateBalance(content: GameContent, runs: number, seedPrefix = 'balance-v1'): SimulationRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > 10_000) throw new Error('runs must be an integer between 1 and 10000');
  const results: SimulationRow[] = [];
  for (const encounter of content.encounters) {
    for (const party of partyCompositions(content.characters.map(character => character.id))) {
      const row: SimulationRow = { encounter: encounter.id, party, runs, victories: 0, defeats: 0, draws: 0, winRate: 0, averageRounds: 0, averageHpRemaining: 0 };
      for (let i = 0; i < runs; i++) {
        const result = runCombat(createCombat({ seed: `${seedPrefix}:${i}`, characterIds: party, encounterId: encounter.id }, content), content);
        if (result.status === 'victory') row.victories++;
        else if (result.status === 'defeat') row.defeats++;
        else if (result.status === 'draw') row.draws++;
        else throw new Error(`Simulation did not terminate: ${result.status}`);
        row.averageRounds += result.round / runs;
        const heroes = result.units.filter(unit => unit.team === 'heroes');
        row.averageHpRemaining += heroes.reduce((total, hero) => total + hero.hp / hero.stats.maxHp, 0) / heroes.length / runs;
      }
      row.winRate = row.victories / runs;
      results.push(row);
    }
  }
  return results;
}
