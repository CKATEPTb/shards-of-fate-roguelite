import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { actOneEnemyMetadata, gameContent } from '@shards/game-data';
import { generateChunk, generateWorld } from '@shards/game-core';
import { SEASON_BOSS_ORDER, type GameContent, type WorldChunk } from '@shards/shared';
import { generateRoamingGroups } from '../../../packages/game-core/src/roaming/generation';
import { patrolEnemyPools } from '../../../packages/game-core/src/roaming/population';
import { roamingRandom } from '../../../packages/game-core/src/roaming/random';
import { planChunk } from '../../../packages/game-core/src/world/plan';

interface EnemyWitness { layoutSeed: string; encounterSeed: string; chunkId: string; groupId: string; mobId: string; x: number; y: number }
interface CensusSite { chunk: WorldChunk; regular: Set<string>; candidates: Set<string> }

/**
 * A population/placement census, not a campaign simulation: fixed, genuinely
 * generated seasonal layouts are reused across independent encounter seeds.
 * This makes even rare patrol branches cheap to witness without running clocks
 * or claiming that all definitions occur in a single same-seed world.
 */
export function runEnemyRuntimeCensus(content: GameContent = gameContent, maximumSeedIndices = 50_000) {
  const layoutSeed = 'enemy-runtime-census-layout';
  const graph = generateWorld(layoutSeed);
  const definitions = content.enemies.filter(enemy => {
    const metadata = actOneEnemyMetadata(enemy);
    return metadata && metadata.habitat !== 'aquatic';
  });
  const missing = new Set(definitions.map(enemy => enemy.id));
  const witnesses: Record<string, EnemyWitness> = {};
  const sites: CensusSite[] = [];
  for (const season of SEASON_BOSS_ORDER) for (const habitat of ['surface', 'basement'] as const) {
    const expected = definitions.filter(enemy => {
      const metadata = actOneEnemyMetadata(enemy)!;
      return metadata.season === season && metadata.habitat === habitat;
    });
    for (const node of graph.nodes.filter(node => node.season === season)) {
      const distance = Math.hypot(node.x, node.y);
      if (distance < 10) continue;
      const candidates = new Set<string>(), regular = new Set<string>();
      for (const category of ['normal', 'epic', 'miniboss'] as const) for (const roll of [1, 20]) {
        const pools = patrolEnemyPools(content, season, habitat, distance, category, roll);
        for (const entry of [...pools.leaders, ...pools.escorts]) {
          candidates.add(entry.enemy.id);
          if (roll === 1) regular.add(entry.enemy.id);
        }
      }
      if (!expected.every(enemy => candidates.has(enemy.id))) continue;
      const stairs = habitat === 'basement' ? planChunk(graph, node).pois.find(poi => poi.kind === 'stairs-down') : undefined;
      if (habitat === 'basement' && !stairs) continue;
      sites.push({ chunk: generateChunk(graph, stairs?.destination?.chunkId ?? node.id), candidates, regular });
      break;
    }
  }
  if (sites.length !== SEASON_BOSS_ORDER.length * 2) throw new Error('Census could not find a real layout for every seasonal habitat');
  let calls = 0, seedIndices = 0, patrols = 0, members = 0;
  for (let index = 0; index < maximumSeedIndices && missing.size; index++) {
    seedIndices = index + 1;
    const encounterSeed = `enemy-runtime-census-${index}`;
    for (const { chunk, candidates, regular } of sites) {
      const remaining = [...missing].filter(id => candidates.has(id));
      if (!remaining.length) continue;
      // If only the rare +2 patrol remains, no geometry work is necessary until
      // one of the four possible groups has actually rolled the veteran die.
      if (remaining.every(id => !regular.has(id)) && ![0, 1, 2, 3].some(group =>
        1 + Math.floor(roamingRandom(encounterSeed, `population:${chunk.id}:${group}`)() * 20) === 20)) continue;
      const groups = generateRoamingGroups(encounterSeed, chunk, content);
      calls++;
      patrols += groups.length;
      for (const group of groups) for (const mob of group.members) {
        members++;
        if (!chunk.tiles[mob.position.y * chunk.size + mob.position.x].walkable) throw new Error(`Unwalkable witness: ${mob.id}`);
        if (!missing.delete(mob.definitionId)) continue;
        witnesses[mob.definitionId] = { layoutSeed, encounterSeed, chunkId: chunk.id, groupId: group.id,
          mobId: mob.id, x: mob.position.x, y: mob.position.y };
      }
    }
  }
  // Every reported witness must replay to the same definition AND placement.
  for (const [definitionId, witness] of Object.entries(witnesses)) {
    const chunk = sites.find(site => site.chunk.id === witness.chunkId)!.chunk;
    const replay = generateRoamingGroups(witness.encounterSeed, chunk, content).flatMap(group => group.members)
      .find(mob => mob.id === witness.mobId);
    if (!replay || replay.definitionId !== definitionId || replay.position.x !== witness.x || replay.position.y !== witness.y) {
      throw new Error(`Non-deterministic witness: ${definitionId}`);
    }
  }
  return {
    scope: 'Production generateRoamingGroups + real generated seasonal surface/basement layouts; independent encounter seeds, not full campaigns',
    layoutSeed, difficulty: 'normal', generatedLayouts: sites.map(site => ({ chunkId: site.chunk.id, season: site.chunk.season, layer: site.chunk.layer })),
    seedIndices, rosterCalls: calls, patrols, members, expected: definitions.length, witnessed: Object.keys(witnesses).length,
    byHabitat: Object.fromEntries(['surface', 'basement'].map(habitat => [habitat, definitions.filter(enemy =>
      actOneEnemyMetadata(enemy)!.habitat === habitat && witnesses[enemy.id]).length])),
    missing: [...missing].sort(), witnesses,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = runEnemyRuntimeCensus();
  const output = resolve(process.argv[2] ?? 'docs/reports/enemy-runtime-census.json');
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, expected: report.expected, witnessed: report.witnessed,
    seedIndices: report.seedIndices, rosterCalls: report.rosterCalls, missing: report.missing }, null, 2));
  if (report.missing.length) process.exitCode = 1;
}
