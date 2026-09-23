import { fork, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actOneBossMetadata, actOneEnemyMetadata, applyEquipmentToHero, equipmentForSet, EQUIPMENT_SETS, gameContent } from '@shards/game-data';
import { BODY_PARTS, DIFFICULTY_IDS, type DifficultyId, type EnemyDefinition, type GameContent, type RewardRarity, type UnitDefinition } from '@shards/shared';
import { createCombat, hashValue, isBodyAlive, runCombat } from '@shards/game-core';
import { simulationPolicy } from '../../../packages/game-core/src/simulation-policy';
import { numericSummary, winInterval } from './statistics';

interface Fixture {
  id: string;
  rarity: RewardRarity;
  sets: Record<string, string>;
  characters: UnitDefinition[];
}
interface CensusSnapshot {
  content: GameContent;
  fixtures: Fixture[];
  capturedAt: string;
  contentHash: string;
  policyHash: string;
  engineHash: string;
}
interface CensusJob { enemyId: string; fixtureId: string; difficultyId: DifficultyId }
type Outcome = 'victory' | 'defeat' | 'draw' | 'escaped' | 'error';
interface Trial {
  index: number;
  outcome: Outcome;
  rounds?: number;
  turns?: number;
  livingHeroes?: number;
  heroHealthFraction?: number;
  lostParts?: number;
  enemyHealthFraction?: number;
  error?: string;
}
interface CensusRow extends CensusJob { trials: Trial[] }
interface WorkerInit { snapshot: CensusSnapshot; runs: number; prefix: string; engineHashAtStart: string; policyHashAtStart: string }
type WorkerMessage = { init: WorkerInit } | { jobs: CensusJob[] };

const policyFile = resolve('packages/game-core/src/simulation-policy.ts');
const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
function engineHash() {
  const hash = createHash('sha256');
  for (const directory of ['packages/game-core/src', 'packages/shared/src']) {
    for (const file of readdirSync(directory, { recursive: true }).map(String).filter(file => file.endsWith('.ts') && !file.includes('__tests__')).sort()) {
      hash.update(`${directory}/${file}\0`); hash.update(readFileSync(resolve(directory, file))); hash.update('\0');
    }
  }
  return hash.digest('hex');
}

/** Fixed catalogue selection, never optimized against an enemy or a future die. */
function fixture(id: string, heroIds: string[], rarity: RewardRarity): Fixture {
  const sets: Record<string, string> = {};
  const characters = heroIds.map(heroId => {
    const hero = gameContent.characters.find(hero => hero.id === heroId);
    if (!hero) throw new Error(`Unknown fixture hero ${heroId}`);
    const candidates = Object.values(EQUIPMENT_SETS).filter(set => set.rarity === rarity && set.visual?.silhouette === heroId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const set = candidates[Math.floor(candidates.length / 2)];
    if (!set) throw new Error(`Missing ${rarity} catalogue set for ${heroId}`);
    sets[heroId] = set.id;
    return applyEquipmentToHero(hero, equipmentForSet(set.id));
  });
  return { id, rarity, sets, characters };
}

function snapshot(): CensusSnapshot {
  const fixtures = [fixture('solo-guardian-rare', ['guardian'], 'rare'), fixture('solo-priest-rare', ['priest'], 'rare'),
    fixture('solo-mage-rare', ['mage'], 'rare'), fixture('party-balanced-epic', ['guardian', 'priest', 'mage', 'ranger'], 'epic')];
  // IPC transports this exact snapshot to every worker; edits made during a run cannot alter its data.
  const content = structuredClone({ ...gameContent, equipmentCatalog: undefined, characters: [], encounters: [] });
  return { content, fixtures, capturedAt: new Date().toISOString(),
    contentHash: hashValue({ content, fixtures }), policyHash: sha256(readFileSync(policyFile)), engineHash: engineHash() };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function runner(init: WorkerInit): (jobs: CensusJob[]) => CensusRow[] {
  const { snapshot, runs, prefix } = init;
  deepFreeze(snapshot);
  const enemies = new Map(snapshot.content.enemies.map(enemy => [enemy.id, enemy]));
  const fixtures = new Map(snapshot.fixtures.map(fixture => [fixture.id, fixture]));
  const cache = new Map<string, GameContent>();
  return jobs => jobs.map(job => {
    const key = `${job.enemyId}:${job.fixtureId}`;
    let content = cache.get(key);
    if (!content) {
      const enemy = enemies.get(job.enemyId), fixture = fixtures.get(job.fixtureId);
      if (!enemy || !fixture) throw new Error(`Unknown census fixture or enemy: ${key}`);
      const units = [...fixture.characters, enemy];
      const skillIds = new Set(units.flatMap(unit => unit.skillIds)), effectIds = new Set(units.flatMap(unit => unit.effectIds));
      content = Object.freeze({ ...snapshot.content, characters: fixture.characters, enemies: [enemy],
        skills: snapshot.content.skills.filter(skill => skillIds.has(skill.id)),
        effects: snapshot.content.effects.filter(effect => effectIds.has(effect.id)) });
      cache.set(key, content);
    }
    const trials: Trial[] = [];
    for (let index = 0; index < runs; index++) {
      try {
        // Same seed across difficulties permits paired comparison; no policy rollouts or hidden roll access.
        const seed = `${prefix}:${job.enemyId}:${job.fixtureId}:${index}`;
        const initial = createCombat({ seed, encounterId: `census:${job.enemyId}`, enemyIds: [job.enemyId],
          characterIds: content.characters.map(hero => hero.id), difficultyId: job.difficultyId }, content);
        const ending = runCombat(initial, content, simulationPolicy, { eventHistoryLimit: 128 });
        if (!['victory', 'defeat', 'draw', 'escaped'].includes(ending.status)) throw new Error(`Non-terminal simulation: ${ending.status}`);
        const heroes = ending.units.filter(unit => unit.team === 'heroes'), enemy = ending.units.find(unit => unit.team === 'enemies')!;
        const living = heroes.filter(hero => hero.body ? isBodyAlive(hero.body) && !hero.escaped : hero.hp > 0 && !hero.escaped);
        const hp = heroes.reduce((sum, hero) => sum + (hero.body ? BODY_PARTS.reduce((total, part) => total + hero.body![part].current, 0) : hero.hp), 0);
        const maxHp = initial.units.filter(unit => unit.team === 'heroes').reduce((sum, hero) => sum + hero.stats.maxHp, 0);
        trials.push({ index, outcome: ending.status as Outcome, rounds: ending.round, turns: ending.turn, livingHeroes: living.length,
          heroHealthFraction: hp / maxHp, lostParts: heroes.reduce((sum, hero) => sum + (hero.body ? BODY_PARTS.filter(part => hero.body![part].lost).length : 0), 0),
          enemyHealthFraction: enemy.hp / enemy.stats.maxHp });
      } catch (error) {
        // A broken simulation is not a defeat and is excluded from every win-rate denominator.
        trials.push({ index, outcome: 'error', error: error instanceof Error ? error.stack ?? error.message : String(error) });
      }
    }
    return { ...job, trials };
  });
}

function describeEnemy(enemy: EnemyDefinition) {
  const mob = actOneEnemyMetadata(enemy), boss = actOneBossMetadata(enemy);
  return { id: enemy.id, name: enemy.name, kind: boss ? 'boss' : 'mob', season: boss?.season ?? mob?.season ?? 'unknown',
    tier: mob?.tier ?? null, family: mob?.family ?? null, role: enemy.role, stats: enemy.stats,
    skills: enemy.skillIds, rank: enemy.rank };
}

function summarize(trials: Trial[]) {
  const outcomes = Object.fromEntries((['victory', 'defeat', 'draw', 'escaped', 'error'] as const)
    .map(outcome => [outcome, trials.filter(trial => trial.outcome === outcome).length])) as Record<Outcome, number>;
  const valid = trials.filter(trial => trial.outcome !== 'error');
  return { attempts: trials.length, valid: valid.length, outcomes,
    winRate: valid.length ? outcomes.victory / valid.length : null, confidence95: winInterval(outcomes.victory, valid.length),
    rounds: numericSummary(valid.map(trial => trial.rounds!)),
    winningRounds: numericSummary(valid.filter(trial => trial.outcome === 'victory').map(trial => trial.rounds!)),
    heroHealth: numericSummary(valid.map(trial => trial.heroHealthFraction!)),
    livingHeroes: numericSummary(valid.map(trial => trial.livingHeroes!)),
    lostParts: numericSummary(valid.map(trial => trial.lostParts!)) };
}

function group(rows: CensusRow[], key: (row: CensusRow) => string) {
  const groups = new Map<string, Trial[]>();
  for (const row of rows) {
    const id = key(row), trials = groups.get(id) ?? [];
    trials.push(...row.trials); groups.set(id, trials);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([group, trials]) => ({ group, ...summarize(trials) }));
}

function buildReport(init: WorkerInit, rows: CensusRow[], jobs: CensusJob[], elapsedSeconds: number, complete: boolean, fatalError?: string) {
  const enemies = init.snapshot.content.enemies.map(describeEnemy), metadata = new Map(enemies.map(enemy => [enemy.id, enemy]));
  const byEnemy = group(rows, row => row.enemyId).map(row => ({ ...metadata.get(row.group)!, ...row }));
  const byBand = group(rows, row => {
    const enemy = metadata.get(row.enemyId)!;
    return `${row.difficultyId}:${row.fixtureId}:${enemy.kind}:${enemy.season}:${enemy.tier ?? 'boss'}`;
  });
  const bandFor = (row: typeof byEnemy[number]) => row.kind === 'boss' ? `boss:${row.season}` : `mob:tier${row.tier}`;
  const bands = new Map<string, typeof byEnemy>();
  for (const enemy of byEnemy) {
    const key = bandFor(enemy), entries = bands.get(key) ?? [];
    entries.push(enemy); bands.set(key, entries);
  }
  const outliers = [...bands].map(([band, entries]) => {
    const rates = entries.flatMap(entry => entry.winRate === null ? [] : [entry.winRate]);
    const average = rates.reduce((sum, rate) => sum + rate, 0) / Math.max(1, rates.length);
    const hardest = [...entries].sort((a, b) => (a.winRate ?? 2) - (b.winRate ?? 2) || (b.rounds.mean ?? 0) - (a.rounds.mean ?? 0)).slice(0, 5);
    const easiest = [...entries].filter(entry => entry.winRate !== null).sort((a, b) => b.winRate! - a.winRate! || (a.rounds.mean ?? Infinity) - (b.rounds.mean ?? Infinity)).slice(0, 5);
    return { band, enemies: entries.length, meanWinRate: average, hardest, easiest,
      flags: entries.filter(entry => entry.winRate !== null && (Math.abs(entry.winRate - average) >= .2 || entry.outcomes.draw / Math.max(1, entry.valid) >= .1)) };
  });
  const completedTrials = rows.reduce((sum, row) => sum + row.trials.length, 0);
  return { schemaVersion: 1, complete, ...(fatalError ? { fatalError } : {}), model: 'isolated-enemy-census-v1',
    assumptions: [
      'One authored enemy, full-health heroes and intact limbs per fight. Actual party/difficulty scaling, equipment/set bonuses and decision policy.',
      'Three solo archetypes in full rare sets; one balanced four-hero party in full epic sets. This is an encounter diagnostic, not a campaign win-rate estimate.',
      'Each set is the lexical middle catalogue set matching the hero silhouette and rarity; no enemy-specific equipment optimization or additional learned skills.',
      'Different gear tiers confound direct solo/party comparisons. Easy and hard outliers are relative to a monster tier or boss season, not balance verdicts.',
      'Seeds are paired across difficulties. Errors are excluded from win rates; draws, escapes and defeats remain separately reported.',
      'Aggregate enemy rankings average different fixtures/difficulties; inspect detailed rows before changing content. Five seeds per cell is a screening sample.',
    ],
    snapshot: init.snapshot, policyHashAtStart: init.policyHashAtStart, policyHashAtEnd: sha256(readFileSync(policyFile)),
    engineHashAtStart: init.engineHashAtStart, engineHashAtEnd: engineHash(), seedPrefix: init.prefix, runsPerCell: init.runs,
    requestedEnemies: new Set(jobs.map(job => job.enemyId)).size, completedEnemies: new Set(rows.map(row => row.enemyId)).size,
    requestedTrials: jobs.length * init.runs, completedTrials, wallSeconds: elapsedSeconds,
    summary: summarize(rows.flatMap(row => row.trials)),
    byFixtureDifficulty: group(rows, row => `${row.difficultyId}:${row.fixtureId}`), byBand,
    byEnemyFixtureDifficulty: rows.map(row => ({ enemyId: row.enemyId, fixtureId: row.fixtureId, difficultyId: row.difficultyId, ...summarize(row.trials) })),
    byEnemy, outliers, rows: [...rows].sort((a, b) => a.enemyId.localeCompare(b.enemyId) || a.fixtureId.localeCompare(b.fixtureId) || a.difficultyId.localeCompare(b.difficultyId)) };
}
type CensusReport = ReturnType<typeof buildReport>;

function markdown(report: CensusReport) {
  const pct = (value: number | null) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
  const num = (value: number | null) => value == null ? '—' : value.toFixed(1);
  const lines = ['# Isolated combat census', '', `Captured ${report.snapshot.capturedAt}. Content checksum \`${report.snapshot.contentHash}\`.`, '',
    `${report.completedTrials}/${report.requestedTrials} battles; ${report.completedEnemies}/${report.requestedEnemies} enemy definitions; ${report.wallSeconds.toFixed(1)} seconds. Complete: ${report.complete}.`, '',
    `Outcomes: ${Object.entries(report.summary.outcomes).map(([key, count]) => `${key} ${count}`).join(', ')}.`, '',
    '## Scope', '', ...report.assumptions.map(text => `- ${text}`), '',
    '## Frozen balance profiles', '', '```json', JSON.stringify({ difficulties: report.snapshot.content.difficulties, balance: report.snapshot.content.balance }, null, 2), '```', '',
    '## Equipped fixtures', '', '| Fixture | Hero | Set | HP | Power |', '| --- | --- | --- | ---: | ---: |'];
  for (const fixture of report.snapshot.fixtures) for (const hero of fixture.characters)
    lines.push(`| ${fixture.id} | ${hero.id} | ${fixture.sets[hero.id]} | ${hero.stats.maxHp} | ${hero.stats.power} |`);
  lines.push('', '## Results by fixture and difficulty', '', '| Group | Battles | Win rate (95% Wilson interval) | Mean rounds | Draws | Escapes | Errors |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: |');
  for (const row of report.byFixtureDifficulty) lines.push(`| ${row.group} | ${row.attempts} | ${pct(row.winRate)} (${row.confidence95.map(pct).join('–')}) | ${num(row.rounds.mean)} | ${row.outcomes.draw} | ${row.outcomes.escaped} | ${row.outcomes.error} |`);
  lines.push('', '## Tier and season overview', '', '| Band | Definitions | Mean win rate |', '| --- | ---: | ---: |');
  for (const band of report.outliers) lines.push(`| ${band.band} | ${band.enemies} | ${pct(band.meanWinRate)} |`);
  for (const band of report.outliers) {
    lines.push('', `## ${band.band}: strongest and weakest against these fixtures`, '',
      '| Rank | Enemy | Win rate | Mean rounds | Draws | Escapes |', '| --- | --- | ---: | ---: | ---: | ---: |');
    for (const [label, entries] of [['Hardest', band.hardest], ['Easiest', band.easiest]] as const)
      for (const row of entries) lines.push(`| ${label} | ${row.id} — ${row.name} | ${pct(row.winRate)} | ${num(row.rounds.mean)} | ${row.outcomes.draw} | ${row.outcomes.escaped} |`);
  }
  lines.push('', '## Longest encounters', '', '| Enemy | Mean rounds | P90 rounds | Win rate | Draws |', '| --- | ---: | ---: | ---: | ---: |');
  for (const row of [...report.byEnemy].sort((a, b) => (b.rounds.mean ?? 0) - (a.rounds.mean ?? 0)).slice(0, 20))
    lines.push(`| ${row.id} | ${num(row.rounds.mean)} | ${num(row.rounds.p90)} | ${pct(row.winRate)} | ${row.outcomes.draw} |`);
  lines.push('', 'Raw JSON contains every seed result, per-enemy/per-fixture/per-difficulty summaries, stage bands and the full frozen input snapshot.', '',
    `Policy source unchanged during run: ${report.policyHashAtStart === report.policyHashAtEnd}. Engine source unchanged during run: ${report.engineHashAtStart === report.engineHashAtEnd}.`, '');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2), allowed = ['--runs', '--seed', '--output', '--workers', '--limit', '--snapshot'];
  for (let i = 0; i < args.length; i += 2) if (!allowed.includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Expected option and value: ${args[i]}`);
  const arg = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const runs = Number(arg('--runs', '5')), workers = Number(arg('--workers', '1')), limit = Number(arg('--limit', String(gameContent.enemies.length)));
  if (!Number.isInteger(runs) || runs < 1 || runs > 1000) throw new Error('--runs must be 1..1000');
  if (!Number.isInteger(workers) || workers < 1 || workers > 16) throw new Error('--workers must be 1..16');
  if (!Number.isInteger(limit) || limit < 1 || limit > gameContent.enemies.length) throw new Error('--limit must be 1..enemy count');
  const frozen: CensusSnapshot = args.includes('--snapshot') ? JSON.parse(readFileSync(resolve(arg('--snapshot', '')), 'utf8')).snapshot : snapshot();
  const init = { snapshot: frozen, runs, prefix: arg('--seed', 'combat-census-v1'), engineHashAtStart: engineHash(), policyHashAtStart: sha256(readFileSync(policyFile)) };
  const allEnemies = frozen.content.enemies;
  const enemyIds = Array.from({ length: Math.min(limit, allEnemies.length) }, (_, index) => allEnemies[Math.floor(index * allEnemies.length / Math.min(limit, allEnemies.length))].id);
  const jobs = enemyIds.flatMap(enemyId => frozen.fixtures.flatMap(fixture => DIFFICULTY_IDS.map(difficultyId => ({ enemyId, fixtureId: fixture.id, difficultyId }))));
  const rows: CensusRow[] = [], children = new Set<ChildProcess>(), output = resolve(arg('--output', 'docs/reports/combat-census.json'));
  const started = performance.now();
  let completed = false, fatalError: string | undefined;
  mkdirSync(dirname(output), { recursive: true });
  const write = () => {
    const report = buildReport(init, rows, jobs, (performance.now() - started) / 1000, completed, fatalError);
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    writeFileSync(output.replace(/\.json$/, '') + '.md', markdown(report));
    return report;
  };
  const stop = () => { for (const child of children) child.kill(); children.clear(); };
  process.once('SIGINT', () => { fatalError = 'Interrupted'; write(); stop(); process.exit(130); });
  console.log(`Census: ${jobs.length * runs} battles / ${enemyIds.length} enemy definitions / ${workers} worker(s). ${frozen.contentHash}`);
  // Write the baseline before dispatching; a crashed job must never erase which rules were measured.
  write();
  const progress = setInterval(() => console.log(`${rows.length * runs}/${jobs.length * runs} battles in ${((performance.now() - started) / 1000).toFixed(1)}s`), 15000);
  try {
    if (workers === 1) {
      const run = runner(init);
      for (let index = 0; index < jobs.length; index += 12) {
        rows.push(...run(jobs.slice(index, index + 12)));
        await new Promise<void>(resolveYield => setImmediate(resolveYield));
      }
    } else await new Promise<void>((resolveRun, rejectRun) => {
      let assigned = 0;
      const dispatch = (child: ChildProcess) => {
        if (assigned >= jobs.length) {
          child.disconnect(); children.delete(child);
          if (rows.length === jobs.length) resolveRun();
          return;
        }
        const batch = jobs.slice(assigned, assigned + 12); assigned += batch.length;
        child.send({ jobs: batch });
      };
      for (let index = 0; index < Math.min(workers, jobs.length); index++) {
        const child = fork(fileURLToPath(import.meta.url), ['--census-worker'], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        children.add(child);
        child.on('error', rejectRun);
        child.on('exit', code => { if (children.has(child) && !completed) rejectRun(new Error(`Census worker exited before completing its batch (${code})`)); });
        child.on('message', (message: { ready?: boolean; rows?: CensusRow[]; error?: string }) => {
          if (message.error) { rejectRun(new Error(message.error)); return; }
          if (message.rows) rows.push(...message.rows);
          if (message.ready || message.rows) dispatch(child);
        });
        child.send({ init });
      }
    });
    completed = true;
  } catch (error) { fatalError = String(error); process.exitCode = 1; }
  finally { clearInterval(progress); stop(); }
  const report = write();
  console.table(report.byFixtureDifficulty.map(row => ({ group: row.group, battles: row.attempts,
    winRate: row.winRate, rounds: row.rounds.mean, draws: row.outcomes.draw, errors: row.outcomes.error })));
  console.log(`${report.completedTrials} battles in ${report.wallSeconds.toFixed(1)}s. ${output}`);
  if (report.summary.outcomes.error) process.exitCode = 1;
}

if (process.argv.includes('--census-worker')) {
  let run: ReturnType<typeof runner> | undefined;
  process.on('message', (message: WorkerMessage) => {
    try {
      if ('init' in message) { run = runner(message.init); process.send!({ ready: true }); }
      else { if (!run) throw new Error('Worker not initialized'); process.send!({ rows: run(message.jobs) }); }
    } catch (error) { process.send!({ error: error instanceof Error ? error.stack : String(error) }); }
  });
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
