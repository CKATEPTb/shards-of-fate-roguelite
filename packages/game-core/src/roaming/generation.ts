import type { DifficultyId, EnemyDefinition, GameContent, GridPoint, RoamingCategory, RoamingGroup, WorldChunk } from '@shards/shared';
import { tileIndex } from '../world/grid';
import { createMovementState } from '../world/movement-speed';
import { distanceSquared, roamingNavigation } from './navigation';
import { placeRoamingFormation, safeRoamingPoint } from './placement';
import { roamingRandom, shuffled } from './random';
import { getDifficultyProfile } from '../difficulty';

const CATEGORY_IDS: Record<RoamingCategory, string[]> = {
  normal: ['rat', 'wolf', 'slime', 'spider', 'goblin_scout', 'thornling'],
  epic: ['boar', 'goblin_archer', 'goblin_shaman'],
  miniboss: ['elite_warden'],
};
const SPECIES_SPEED: Record<string, number> = {
  rat: 80, wolf: 90, slime: 55, spider: 80, goblin_scout: 75,
  boar: 65, goblin_archer: 70, goblin_shaman: 65, thornling: 55, elite_warden: 60,
};

function legacyRoster(category: RoamingCategory, content: GameContent, random: () => number): EnemyDefinition[] {
  const choices = content.enemies.filter(enemy => CATEGORY_IDS[category].includes(enemy.id));
  if (!choices.length) throw new Error(`No enemy definitions for roaming category ${category}`);
  const species = choices[Math.floor(random() * choices.length)];
  const size = category === 'miniboss' ? 1 : 1 + Math.floor(random() * (category === 'normal' ? 4 : 3));
  return Array.from({ length: size }, (_, index) => {
    // Goblin groups sometimes bring their healer; animal packs stay one species.
    if (category === 'epic' && species.id.startsWith('goblin_') && index === size - 1 && size > 1) {
      return choices.find(enemy => enemy.id === 'goblin_shaman') ?? species;
    }
    return species;
  });
}

interface CatalogEntry { enemy: EnemyDefinition; family: string; tier: number; pack: boolean }

/** Every choice is a die on this chunk's independent encounter stream. */
function die(random: () => number, sides: number): number { return 1 + Math.floor(random() * sides); }
function succeeds(random: () => number, chance: number): boolean { return die(random, 100) <= Math.round(chance * 100); }
function pick<T>(values: readonly T[], random: () => number): T { return values[die(random, values.length) - 1]; }

function chunkDepth(chunk: WorldChunk): number {
  const coordinates = (chunk.surfaceNodeId ?? chunk.id).match(/^(-?\d+),(-?\d+)(?:$|:)/);
  return coordinates ? Math.hypot(Number(coordinates[1]), Number(coordinates[2])) : 0;
}

function depthTier(depth: number): number {
  return depth < 4 ? 1 : depth < 10 ? 2 : depth < 20 ? 3 : depth < 35 ? 4 : 5;
}

function catalogEntries(chunk: WorldChunk, content: GameContent): CatalogEntry[] {
  const season = `SEASON_${chunk.season.toUpperCase()}`;
  const basement = chunk.layer === 'basement';
  return content.enemies.flatMap(enemy => {
    if (!enemy.tags.includes('ACT_1') || !enemy.tags.includes(season) || enemy.tags.includes('AQUATIC')
      || enemy.tags.includes('BASEMENT') !== basement) return [];
    const family = enemy.tags.find(tag => tag.startsWith('FAMILY_'))?.slice(7);
    const tier = Number(enemy.tags.find(tag => /^TIER_[1-5]$/.test(tag))?.slice(5));
    return family && tier ? [{ enemy, family, tier, pack: enemy.tags.includes('PACK') }] : [];
  });
}

function catalogRoster(entries: CatalogEntry[], category: RoamingCategory, depth: number, random: () => number): EnemyDefinition[] {
  const baseTier = depthTier(depth);
  const targetTier = Math.min(5, baseTier + (category === 'normal' ? 0 : 1));
  // Custom catalogs may omit bands; use the nearest available band without abandoning the habitat.
  const nearest = Math.min(...entries.map(entry => Math.abs(entry.tier - targetTier)));
  const tierEntries = entries.filter(entry => Math.abs(entry.tier - targetTier) === nearest);
  const family = pick([...new Set(tierEntries.map(entry => entry.family))], random);
  const familyEntries = tierEntries.filter(entry => entry.family === family);
  const pack = familyEntries.every(entry => entry.pack);
  const size = depth < 4 ? die(random, 2) : category === 'miniboss' ? 3
    : category === 'epic' ? 3 + (die(random, 4) === 4 ? 1 : 0) : 2 + (die(random, 3) === 3 ? 1 : 0);
  const selected: EnemyDefinition[] = [];
  const take = (role: EnemyDefinition['role']) => {
    const choices = familyEntries.filter(entry => entry.enemy.role === role);
    const unused = choices.filter(entry => !selected.some(enemy => enemy.id === entry.enemy.id));
    selected.push(pick(unused.length ? unused : choices.length ? choices : familyEntries, random).enemy);
  };
  // Beast packs have no artificial healer. Humanoid/brood patrols protect a support unit at larger sizes.
  if (category === 'miniboss' || size >= 2) take('tank');
  take('damage');
  if (selected.length < size && !pack) take('healer');
  while (selected.length < size) take('damage');
  return selected;
}

/** Independent seeds preserve terrain and combat outcomes when groups are added. */
export function generateRoamingGroups(seed: string, chunk: WorldChunk, content: GameContent, difficultyId: DifficultyId = 'normal'): RoamingGroup[] {
  const difficulty = getDifficultyProfile(content, difficultyId);
  const random = roamingRandom(seed, `generate:${chunk.id}`);
  const catalog = catalogEntries(chunk, content);
  const depth = chunkDepth(chunk);
  const startingArea = catalog.length > 0 && depth < 4;
  const count = startingArea ? 2 : 1 + die(random, 3);
  const groups: RoamingGroup[] = [];
  const occupied = new Set<number>();
  const protectedPoints = [chunk.spawn, ...chunk.pois.filter(poi => poi.kind === 'campfire').map(poi => poi.position)];
  const safe = (point: GridPoint) => safeRoamingPoint(point, protectedPoints);
  const candidates = shuffled(roamingNavigation(chunk).points, random);
  const minibossIndex = !startingArea && succeeds(random, difficulty.minibossChunkChance) ? die(random, count) - 1 : -1;
  for (let index = 0; index < count; index++) {
    const category: RoamingCategory = index === minibossIndex ? 'miniboss'
      : !startingArea && succeeds(random, difficulty.epicGroupChance) ? 'epic' : 'normal';
    const definitions = catalog.length ? catalogRoster(catalog, category, depth, random) : legacyRoster(category, content, random);
    // Start separate enough for both isolated encounters and occasional overlaps.
    const ordered = [...candidates].sort((a, b) => {
      const clearance = (point: GridPoint) => Math.min(100, ...groups.map(group => distanceSquared(point, group.home)));
      return clearance(b) - clearance(a);
    });
    let positions = placeRoamingFormation(chunk, ordered, definitions.length, safe, occupied);
    // Tight basement layouts can fit a smaller patrol while keeping the entrance protected.
    while (!positions && catalog.length && definitions.length > 1) {
      definitions.pop();
      positions = placeRoamingFormation(chunk, ordered, definitions.length, safe, occupied);
    }
    if (!positions) {
      if (catalog.length) break;
      throw new Error('No safe roaming group formation');
    }
    positions.forEach(point => occupied.add(tileIndex(point, chunk.size)));
    const id = `${chunk.id}:roaming:${index}`;
    groups.push({ id, category, chases: succeeds(random, 0.28), home: positions[0], mode: 'patrol', targetActorId: null,
      decision: 0, pauseMs: 699 + die(random, 1500),
      members: definitions.map((definition, member) => ({ id: `${id}:${member}`, definitionId: definition.id,
        position: positions![member], path: [], movement: createMovementState(
          definition.movementSpeed ?? SPECIES_SPEED[definition.id] ?? 70) })) });
  }
  return groups;
}
