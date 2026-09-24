import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gameContent } from '@shards/game-data';
import { hashValue } from '@shards/game-core';
import { assertContentAvailability } from './playability';

try {
  const report = { contentHash: hashValue(gameContent), evidence: 'Production-pool reachability; runtime application and seeded encounter coverage are verified by the reachability tests.',
    ...assertContentAvailability(gameContent) };
  if (process.argv[2]) {
    const destination = resolve(process.argv[2]);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Availability report: ${destination}`);
  }
  console.log(JSON.stringify({ contentHash: report.contentHash, valid: report.valid, counts: report.counts, missing: report.missing }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
