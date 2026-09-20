import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gameContent } from '@shards/game-data';
import { createCombat } from '@shards/game-core';
import { simulateBalance } from './simulate';

const args = process.argv.slice(2);
function argument(name: string, fallback: string) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
}
for (let i = 0; i < args.length; i += 2) if (!['--runs', '--seed', '--output'].includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
const runs = Number(argument('--runs', '100'));
const seedPrefix = argument('--seed', 'balance-v1');
const output = resolve(argument('--output', 'docs/reports/balance.json'));
const rows = simulateBalance(gameContent, runs, seedPrefix);
const contentHash = createCombat({ seed: seedPrefix, characterIds: [gameContent.characters[0].id], encounterId: gameContent.encounters[0].id }, gameContent).contentHash;
const report = { schemaVersion: 1, contentSchemaVersion: gameContent.schemaVersion, contentHash, seedPrefix, runsPerComposition: runs, totalBattles: rows.length * runs, rows };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.table(rows.map(row => ({ encounter: row.encounter, party: row.party.join('+'), wins: `${Math.round(row.winRate * 100)}%`, rounds: row.averageRounds.toFixed(1), draws: row.draws })));
console.log(`Completed ${report.totalBattles} deterministic battles. Report: ${output}`);
