import { fork, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameContent } from '@shards/game-data';
import { DIFFICULTY_IDS, type DifficultyId } from '@shards/shared';
import { hashValue } from '../../../packages/game-core/src/canonical';
import { partyCompositions } from './simulate';
import { numericSummary, pairedWinDifference, winInterval } from './statistics';
import { campaignReportHtml } from './report-html';
import type { simulateCampaign } from './campaign';
import { tunedContent, type CampaignJob, type CampaignTuning } from './campaign-worker';
import { CampaignWorkerLifecycle } from './campaign-worker-lifecycle';

type Entry = { job: CampaignJob; result: ReturnType<typeof simulateCampaign> };
const args = process.argv.slice(2);
const allowed = ['--runs', '--seed', '--output', '--workers', '--sizes', '--modes', '--difficulties', '--tuning', '--details'];
for (let i = 0; i < args.length; i += 2) {
  if (!allowed.includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Expected option and value: ${args[i]}`);
}
function arg(name: string, fallback: string) { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; }
const runs = Number(arg('--runs', '100'));
const workers = Number(arg('--workers', String(Math.min(4, Math.max(1, availableParallelism() - 1)))));
const sizes = arg('--sizes', '1,2,3,4').split(',').map(Number);
const modes = arg('--modes', 'progression').split(',') as CampaignJob['mode'][];
const difficulties = arg('--difficulties', DIFFICULTY_IDS.join(',')).split(',') as DifficultyId[];
if (!Number.isInteger(runs) || runs < 1 || runs > 100000) throw new Error('--runs must be 1..100000 per party size/difficulty/mode');
if (!Number.isInteger(workers) || workers < 1 || workers > 32) throw new Error('--workers must be 1..32');
if (sizes.some(size => ![1, 2, 3, 4].includes(size)) || new Set(sizes).size !== sizes.length) throw new Error('Distinct party sizes 1..4 required');
if (modes.some(mode => !['progression', 'starter'].includes(mode)) || new Set(modes).size !== modes.length) throw new Error('Invalid modes');
if (difficulties.some(id => !DIFFICULTY_IDS.includes(id)) || new Set(difficulties).size !== difficulties.length) throw new Error('Invalid difficulties');
const prefix = arg('--seed', 'campaign-holdout-v1');
const output = resolve(arg('--output', 'docs/reports/campaign-balance.json'));
const details = arg('--details', 'full');
if (!['full', 'compressed'].includes(details)) throw new Error('--details must be full or compressed');
const tuning: CampaignTuning | undefined = args.includes('--tuning') ? JSON.parse(readFileSync(resolve(arg('--tuning', '')), 'utf8')) : undefined;
const content = tunedContent(tuning);
function sourceFingerprint() {
  const hash = createHash('sha256');
  for (const directory of ['packages/game-core/src', 'packages/game-data/src', 'packages/shared/src', 'tools/balance-simulator/src']) {
    for (const file of readdirSync(directory, { recursive: true }).map(String).filter(file => /\.ts$/.test(file) && !file.includes('__tests__')).sort()) {
      hash.update(`${directory}/${file}\0`); hash.update(readFileSync(resolve(directory, file))); hash.update('\0');
    }
  }
  return hash.digest('hex');
}
const sourceHashAtStart = sourceFingerprint();
const combinations = partyCompositions(gameContent.characters.map(hero => hero.id));
const jobs: CampaignJob[] = [];
for (let index = 0; index < runs; index++) for (const size of sizes) {
  const parties = combinations.filter(party => party.length === size);
  // Rotation ensures small pilot batches do not always privilege the first hero.
  const characterIds = parties[index * 19 % parties.length];
  for (const mode of modes) for (const difficultyId of difficulties) jobs.push({ index,
    seed: `${prefix}:${size}:${index}`, characterIds, difficultyId, mode });
}
const started = performance.now();
const entries: Entry[] = [];
const children = new Set<ChildProcess>();
let assigned = 0;
let failed = false;
let stopping = false;
const groups = (key: (entry: Entry) => string) => {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) { const name = key(entry); const group = map.get(name) ?? []; group.push(entry); map.set(name, group); }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, values]) => {
    const winners = values.filter(entry => entry.result.status === 'victory');
    return { group, runs: values.length, victories: winners.length, winRate: winners.length / values.length,
      confidence95: winInterval(winners.length, values.length),
      outcomes: Object.fromEntries([...new Set(values.map(entry => entry.result.status))].map(status => [status, values.filter(entry => entry.result.status === status).length])),
      bossesDefeated: [0, 1, 2, 3, 4].map(count => values.filter(entry => entry.result.bossesDefeated === count).length),
      successfulMinutes: numericSummary(winners.map(entry => entry.result.durationMinutes)),
      allRunMinutes: numericSummary(values.map(entry => entry.result.durationMinutes)),
      battles: numericSummary(values.map(entry => entry.result.battles.length)),
    };
  });
};
function report(complete: boolean) {
  const matched = new Map(entries.map(entry => [`${entry.job.seed}|${entry.job.mode}|${entry.job.difficultyId}`, entry]));
  const paired = modes.flatMap(mode => sizes.flatMap(size => [['normal', 'hard'], ['hard', 'nightmare']].map(([easy, hard]) => {
    const pairs: [boolean, boolean][] = [];
    for (const entry of entries) if (entry.job.mode === mode && entry.job.characterIds.length === size && entry.job.difficultyId === easy) {
      const other = matched.get(`${entry.job.seed}|${mode}|${hard}`);
      if (other) pairs.push([entry.result.status === 'victory', other.result.status === 'victory']);
    }
    return { mode, size, easy, hard, ...pairedWinDifference(pairs) };
  })));
  const sourceHashAtEnd = sourceFingerprint();
  return { schemaVersion: 2, complete, contentHash: hashValue(content), sourceHashAtStart, sourceHashAtEnd,
    sourcesUnchanged: sourceHashAtStart === sourceHashAtEnd, seedPrefix: prefix, tuning: tuning ?? null,
    model: 'Scripted accelerated expedition. Real combat, dice, loot and equipment; travel/contact decisions abstracted. Bot win rates are not human win rates.',
    sampling: 'Uniform rotating distinct hero compositions within each size; same seeds across difficulties and equipment modes.',
    targets: { normal: .30, hard: .15, nightmare: [.05, .10] },
    requestedCampaigns: jobs.length, completedCampaigns: entries.length,
    totalBattles: entries.reduce((sum, entry) => sum + entry.result.battles.length, 0),
    wallSeconds: (performance.now() - started) / 1000,
    virtualHours: entries.reduce((sum, entry) => sum + entry.result.durationMinutes / 60, 0),
    byDifficulty: groups(entry => `${entry.job.mode}:${entry.job.difficultyId}`),
    byPartySize: groups(entry => `${entry.job.mode}:${entry.job.difficultyId}:${entry.job.characterIds.length}`),
    byComposition: groups(entry => `${entry.job.mode}:${entry.job.difficultyId}:${entry.job.characterIds.join('+')}`),
    paired, entries: [...entries].sort((a, b) => a.job.seed.localeCompare(b.job.seed) || a.job.mode.localeCompare(b.job.mode) || a.job.difficultyId.localeCompare(b.job.difficultyId)) };
}
mkdirSync(dirname(output), { recursive: true });
const timer = setInterval(() => console.log(`${entries.length}/${jobs.length} campaigns, ${((performance.now() - started) / 1000).toFixed(1)}s CPU run`), 15000);
function stop() { stopping = true; clearInterval(timer); for (const child of children) child.kill(); children.clear(); }
process.on('SIGINT', () => { writeFileSync(output, JSON.stringify(report(false))); stop(); process.exit(130); });
await new Promise<void>((resolveRun, rejectRun) => {
  const workerStates = new WeakMap<ChildProcess, CampaignWorkerLifecycle>();
  function fail(error: Error) {
    if (failed || stopping) return;
    failed = true; rejectRun(error);
  }
  function dispatch(child: ChildProcess) {
    const lifecycle = workerStates.get(child)!;
    if (assigned >= jobs.length) {
      lifecycle.retire();
      child.disconnect(); children.delete(child);
      if (entries.length === jobs.length) resolveRun();
      return;
    }
    // World chunk caches intentionally live for a game session. Recycle bounded
    // offline sessions so a large seed sweep cannot retain thousands of worlds.
    if (lifecycle.completed >= 48) {
      lifecycle.retire();
      child.disconnect(); children.delete(child); startWorker(); return;
    }
    const batch = jobs.slice(assigned, assigned + 6); assigned += batch.length;
    lifecycle.assign(batch.length);
    child.send({ jobs: batch, tuning }, error => { if (error) fail(error); });
  }
  function startWorker() {
    const child = fork(fileURLToPath(new URL('./campaign-worker.ts', import.meta.url)), [], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    children.add(child);
    const lifecycle = new CampaignWorkerLifecycle(); workerStates.set(child, lifecycle);
    child.on('message', (message: { results?: Entry[]; error?: string }) => {
      if (failed || stopping) return;
      if (message.error || !message.results) { fail(new Error(message.error ?? 'Missing simulation results')); return; }
      try { lifecycle.receive(message.results.length); } catch (error) { fail(error as Error); return; }
      entries.push(...message.results);
      const broken = message.results.find(entry => entry.result.status === 'error');
      if (broken) { fail(new Error(`Invalid simulation ${broken.job.seed}: ${broken.result.diagnostics.error}`)); return; }
      dispatch(child);
    });
    child.on('error', fail);
    child.on('exit', (code, signal) => {
      children.delete(child);
      const error = lifecycle.exitError(code, signal);
      if (error) fail(error);
    });
    dispatch(child);
  }
  for (let worker = 0; worker < Math.min(workers, jobs.length); worker++) startWorker();
}).then(() => {
  const result = report(true);
  if (details === 'compressed') {
    writeFileSync(output + '.gz', gzipSync(JSON.stringify(result), { level: 6 }));
    const { entries: _entries, ...summary } = result;
    writeFileSync(output, JSON.stringify({ ...summary, detailedReport: output.split(/[\\/]/).at(-1)! + '.gz' }, null, 2) + '\n');
  } else writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  writeFileSync(output.replace(/\.json$/, '') + '.html', campaignReportHtml(result));
  console.table(result.byPartySize.map(row => ({ group: row.group, runs: row.runs, wins: `${(100 * row.winRate).toFixed(1)}%`,
    interval: row.confidence95.map(value => `${(100 * value).toFixed(1)}%`).join('–'), minutes: row.successfulMinutes.median?.toFixed(1) ?? '—' })));
  console.log(`${result.completedCampaigns} campaigns / ${result.totalBattles} battles / ${result.virtualHours.toFixed(1)} virtual hours in ${result.wallSeconds.toFixed(1)}s. ${output}`);
}).catch(error => {
  writeFileSync(output, JSON.stringify({ ...report(false), error: String(error) }, null, 2));
  process.exitCode = 1; console.error(error);
}).finally(stop);
