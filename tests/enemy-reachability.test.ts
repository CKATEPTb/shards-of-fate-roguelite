import { describe, expect, it } from 'vitest';
import { actOneBossMetadata, actOneEnemyMetadata, gameContent } from '@shards/game-data';
import { createCoopState, generateChunk, generateWorld } from '@shards/game-core';
import { SEASON_BOSS_ORDER, type Season, type WorldChunk } from '@shards/shared';
import { generateRoamingGroups } from '../packages/game-core/src/roaming/generation';
import { enemyPopulationTier, patrolEnemyPools, wellEnemyPool } from '../packages/game-core/src/roaming/population';
import { planChunk } from '../packages/game-core/src/world/plan';
import { createEntityRng } from '../packages/game-core/src/random';
import { drawDie } from '../packages/game-core/src/dice';
import { summonSeasonBoss } from '../packages/game-core/src/coop/bosses';
import { finishCoopBattle } from '../packages/game-core/src/coop/battles';
import { interactAdventure } from '../packages/game-core/src/coop/interactions';
import { coopChunk, coopGraph } from '../packages/game-core/src/coop/world';
import { roamingRandom } from '../packages/game-core/src/roaming/random';

const ordinary = gameContent.enemies.filter(enemy => actOneEnemyMetadata(enemy));
const bosses = gameContent.enemies.filter(enemy => actOneBossMetadata(enemy));

/** Only sample cells that exist in one generated world, including real cellar entrances and wells. */
function populationSites() {
  const graph = generateWorld('enemy-reachability-census');
  const sites = new Map<string, { chunkId: string; season: Season; distance: number; kind: 'surface' | 'basement' | 'aquatic' }>();
  for (const node of graph.nodes) {
    const distance = Math.hypot(node.x, node.y), band = enemyPopulationTier(distance);
    const key = `${node.season}:${band}`;
    if (!sites.has(`${key}:surface`)) sites.set(`${key}:surface`, { chunkId: node.id, season: node.season, distance, kind: 'surface' });
    if (sites.has(`${key}:basement`) && sites.has(`${key}:aquatic`)) continue;
    const plan = planChunk(graph, node);
    const stairs = plan.pois.find(poi => poi.kind === 'stairs-down');
    if (stairs && !sites.has(`${key}:basement`)) sites.set(`${key}:basement`, {
      chunkId: stairs.destination!.chunkId, season: node.season, distance, kind: 'basement' });
    if (plan.pois.some(poi => poi.kind === 'well') && !sites.has(`${key}:aquatic`)) sites.set(`${key}:aquatic`, {
      chunkId: node.id, season: node.season, distance, kind: 'aquatic' });
  }
  return { graph, sites: [...sites.values()] };
}

describe('all authored enemies have production spawn paths', () => {
  it('covers all 500 ordinary enemies through real seasonal surfaces, cellars and wells', () => {
    expect(ordinary).toHaveLength(500);
    const { graph, sites } = populationSites();
    const reached = new Set<string>();
    for (const site of sites) {
      const chunk = generateChunk(graph, site.chunkId);
      expect(chunk.season).toBe(site.season);
      if (site.kind === 'basement') expect(chunk.layer).toBe('basement');
      if (site.kind === 'aquatic') {
        expect(chunk.pois.some(poi => poi.kind === 'well')).toBe(true);
        for (const roll of [1, 2, 20]) for (const enemy of wellEnemyPool(gameContent, site.season, site.distance, roll)) reached.add(enemy.id);
      } else {
        for (const category of ['normal', 'epic', 'miniboss'] as const) {
          // The protected starting area never rolls elite categories or a third/support unit.
          if (site.distance < 4 && category !== 'normal') continue;
          for (const roll of [1, 20]) {
            const pools = patrolEnemyPools(gameContent, site.season, site.kind, site.distance, category, roll);
            for (const entry of [...pools.leaders, ...pools.escorts]) {
              if (site.distance < 4 && entry.enemy.role === 'healer') continue;
              reached.add(entry.enemy.id);
            }
          }
        }
      }
    }
    expect(ordinary.filter(enemy => !reached.has(enemy.id)).map(enemy => enemy.id)).toEqual([]);
    expect(reached.size).toBe(500);
    expect(ordinary.filter(enemy => actOneEnemyMetadata(enemy)!.habitat === 'surface')).toHaveLength(300);
    expect(ordinary.filter(enemy => actOneEnemyMetadata(enemy)!.habitat === 'basement')).toHaveLength(100);
    expect(ordinary.filter(enemy => actOneEnemyMetadata(enemy)!.habitat === 'aquatic')).toHaveLength(100);
  });

  it('keeps patrol relatives together and preserves strong leaders outside the starting area', () => {
    const { graph, sites } = populationSites();
    let sawYoungerEscort = false;
    for (const site of sites.filter(site => site.kind !== 'aquatic')) {
      const chunk: WorldChunk = generateChunk(graph, site.chunkId);
      const groups = generateRoamingGroups(graph.seed, chunk, gameContent);
      expect(generateRoamingGroups(graph.seed, chunk, gameContent)).toEqual(groups);
      for (const group of groups) {
        const metadata = group.members.map(member => actOneEnemyMetadata(gameContent.enemies.find(enemy => enemy.id === member.definitionId)!)!);
        expect(new Set(metadata.map(enemy => enemy.family)).size).toBe(1);
        expect(metadata.every(enemy => enemy.season === chunk.season && enemy.habitat === site.kind)).toBe(true);
        if (site.distance < 4) expect(metadata.every(enemy => enemy.tier === 1)).toBe(true);
        else {
          const ordinaryPools = patrolEnemyPools(gameContent, chunk.season, site.kind as 'surface' | 'basement', site.distance, group.category, 1);
          expect(metadata[0].tier).toBeGreaterThanOrEqual(Math.min(...ordinaryPools.leaders.map(entry => entry.tier)));
          if (metadata.some(enemy => enemy.tier < metadata[0].tier)) sawYoungerEscort = true;
        }
      }
    }
    expect(sawYoungerEscort).toBe(true);
  });

  it('keeps 18 of 20 well population rolls in the regular distance band', () => {
    for (const season of SEASON_BOSS_ORDER) for (const distance of [0, 5, 12, 25, 40]) {
      for (let roll = 2; roll < 20; roll++) expect(wellEnemyPool(gameContent, season, distance, roll)
        .every(enemy => actOneEnemyMetadata(enemy)!.tier === enemyPopulationTier(distance))).toBe(true);
    }
    expect(wellEnemyPool(gameContent, 'spring', 0, 20).every(enemy => actOneEnemyMetadata(enemy)!.tier === 1)).toBe(true);
  });

  it('starts real well battles in the selected population band without consuming extra hero dice', () => {
    const seed = 'well-population-boundaries', owner = 'hero:guardian';
    const base = createCoopState(seed, ['guardian'], gameContent), graph = coopGraph(seed);
    const sites = new Map<string, { chunkId: string; poiId: string; roll: number; distance: number }>();
    for (const node of graph.nodes) {
      if (sites.size === 4) break;
      const distance = Math.hypot(node.x, node.y);
      if (!['spring', 'winter'].includes(node.season)) continue;
      for (const poi of planChunk(graph, node).pois.filter(poi => poi.kind === 'well')) {
        const roll = 1 + Math.floor(roamingRandom(seed, `well-population:${poi.id}`)() * 20);
        const key = node.id === '0,0' ? 'starting' : node.season === 'spring' && distance >= 10 && roll === 20 ? 'older'
          : node.season === 'winter' && roll === 1 ? 'younger' : node.season === 'winter' && roll > 1 && roll < 20 ? 'regular' : undefined;
        if (key && !sites.has(key)) sites.set(key, { chunkId: node.id, poiId: poi.id, roll, distance });
      }
    }
    expect([...sites.keys()].sort()).toEqual(['older', 'regular', 'starting', 'younger']);
    let index = 0;
    while (drawDie(4, createEntityRng(seed, owner, index), 'EVENT') !== 1) index++;
    for (const site of sites.values()) {
      const chunk = coopChunk(seed, site.chunkId), poi = chunk.pois.find(poi => poi.id === site.poiId)!;
      const before = { ...base, diceIndex: index, diceCounters: { [owner]: index }, groups: { [chunk.id]: [] },
        actors: base.actors.map(actor => ({ ...actor, chunkId: chunk.id, position: { ...poi.position }, path: [] })) };
      const result = interactAdventure(before, 'guardian', chunk.id, poi.id, gameContent);
      const rng = createEntityRng(seed, owner, index);
      expect(drawDie(4, rng, 'EVENT')).toBe(1);
      const pool = wellEnemyPool(gameContent, chunk.season, site.distance, site.roll);
      const expected = pool[drawDie(pool.length, rng, 'EVENT') - 1];
      expect(result.battles).toHaveLength(1);
      expect(result.battles[0].combat.enemyIds).toEqual([expected.id]);
      expect(result.diceCounters?.[owner]).toBe(index + 2);
      expect(result.diceIndex).toBe(index + 2);
    }
  });

  it('reaches all 50 seasonal boss definitions with the actual seeded selection rule', () => {
    expect(bosses).toHaveLength(50);
    // Cheap independent-stream search finds witness seeds; only these worlds
    // need allocation, then the real timer/summon/battle-end path must agree.
    const witnessSeeds = new Set<string>(), expected = new Set<string>();
    for (let index = 0; index < 256 && expected.size < bosses.length; index++) {
      const seed = `boss-reachability-${index}`;
      for (const season of SEASON_BOSS_ORDER) {
        const pool = gameContent.enemies.filter(enemy => enemy.tags.includes('BOSS') && enemy.tags.includes(`SEASON_${season.toUpperCase()}`))
          .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        const rng = createEntityRng(seed, `season-boss:${season}`, 0);
        const id = pool[drawDie(pool.length, rng, 'ENCOUNTER') - 1].id;
        if (!expected.has(id)) witnessSeeds.add(seed);
        expected.add(id);
      }
    }
    const seen = new Set<string>();
    for (const seed of witnessSeeds) {
      let state = createCoopState(seed, ['guardian'], gameContent);
      for (const season of SEASON_BOSS_ORDER) {
        state = summonSeasonBoss({ ...state, tick: state.bosses!.nextAtTick! }, gameContent);
        seen.add(state.bosses!.spawned.at(-1)!.enemyId);
        const battle = state.battles.find(battle => battle.mobIds.includes(`season-boss:${season}`))!;
        expect(battle).toBeDefined();
        state = { ...state, battles: state.battles.map(candidate => candidate.id === battle.id ? {
          ...candidate, combat: { ...candidate.combat, status: 'victory' as const,
            units: candidate.combat.units.map(unit => unit.team === 'enemies' ? { ...unit, hp: 0 } : unit) },
        } : candidate) };
        state = finishCoopBattle(state, battle.id, gameContent);
      }
    }
    expect(bosses.filter(enemy => !seen.has(enemy.id)).map(enemy => enemy.id)).toEqual([]);
    expect(SEASON_BOSS_ORDER.map(season => bosses.filter(enemy => actOneBossMetadata(enemy)!.season === season).length)).toEqual([13, 13, 12, 12]);
  }, 20_000);
});
