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

function roster(category: RoamingCategory, content: GameContent, random: () => number): EnemyDefinition[] {
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

/** Independent seeds preserve terrain and combat outcomes when groups are added. */
export function generateRoamingGroups(seed: string, chunk: WorldChunk, content: GameContent, difficultyId: DifficultyId = 'normal'): RoamingGroup[] {
  const difficulty = getDifficultyProfile(content, difficultyId);
  const random = roamingRandom(seed, `generate:${chunk.id}`);
  const count = 2 + Math.floor(random() * 3);
  const groups: RoamingGroup[] = [];
  const occupied = new Set<number>();
  const protectedPoints = [chunk.spawn, ...chunk.pois.filter(poi => poi.kind === 'campfire').map(poi => poi.position)];
  const safe = (point: GridPoint) => safeRoamingPoint(point, protectedPoints);
  const candidates = shuffled(roamingNavigation(chunk).points, random);
  const minibossIndex = random() < difficulty.minibossChunkChance ? Math.floor(random() * count) : -1;
  for (let index = 0; index < count; index++) {
    const category: RoamingCategory = index === minibossIndex ? 'miniboss' : random() < difficulty.epicGroupChance ? 'epic' : 'normal';
    const definitions = roster(category, content, random);
    // Start separate enough for both isolated encounters and occasional overlaps.
    const ordered = [...candidates].sort((a, b) => {
      const clearance = (point: GridPoint) => Math.min(100, ...groups.map(group => distanceSquared(point, group.home)));
      return clearance(b) - clearance(a);
    });
    const positions = placeRoamingFormation(chunk, ordered, definitions.length, safe, occupied);
    if (!positions) throw new Error('No safe roaming group formation');
    positions.forEach(point => occupied.add(tileIndex(point, chunk.size)));
    const id = `${chunk.id}:roaming:${index}`;
    const speed = definitions[0].movementSpeed ?? SPECIES_SPEED[definitions[0].id] ?? 70;
    groups.push({ id, category, chases: random() < 0.28, home: positions[0], mode: 'patrol', targetActorId: null,
      decision: 0, pauseMs: 700 + Math.floor(random() * 1500),
      members: definitions.map((definition, member) => ({ id: `${id}:${member}`, definitionId: definition.id,
        position: positions[member], path: [], movement: createMovementState(speed) })) });
  }
  return groups;
}
