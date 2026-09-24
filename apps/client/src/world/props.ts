import type Phaser from 'phaser';
import type { GridPoint, WorldChunk, WorldPoi } from '@shards/shared';
import { OcclusionIndex, occlusionAlpha, type Bounds, type Occluder, type OcclusionProbe } from './occlusion';
import { grain } from './palette';
import { ensurePropTexture, type PropKind } from './propArt';
import { tileCenter } from './projection';
import { createStructures } from './structures';
import { createWater, intersectsViewport } from './water';
import type { EnvironmentObject } from './environmentObject';
import { WalkableGround } from './walkable-occlusion';
import { createRocks } from './rocks';
import { createChimneySmoke } from './chimneySmoke';
import { createCampfires } from './campfires';
import { createHouseHeroReveal, type HeroAppearance } from './house-hero-reveal';
import { RenderedVisibility } from './rendered-visibility';
import { textureAlpha } from './texture-alpha';
import { containsPoint, entersHouse } from './house-visibility';
import { createNpcServices } from './npcArt';

export interface EnvironmentUpdate {
  /** Interpolated character feet and cursor use world pixels. The route uses tiles. */
  heroes: GridPoint[];
  heroSprites: HeroAppearance[];
  mobProbes?: OcclusionProbe[];
  cursor?: GridPoint;
  path: GridPoint[];
  delta: number;
  reducedMotion: boolean;
  visibleBounds?: Bounds;
  campfireLit?: boolean;
}
export interface EnvironmentRenderer {
  update(input: EnvironmentUpdate): void;
  /** Transmission through rendered foreground image pixels at a world point. */
  pointVisibility(point: GridPoint, depth: number): number;
  /** Closed house contents cannot be discovered through pointer interaction. */
  isPoiVisible(poi: WorldPoi): boolean;
  /** World-pixel positions inside a closed house must not expose ally markers. */
  isInteriorRevealed(point: GridPoint): boolean;
  destroy(): void;
  readonly count: number;
  readonly occludedCount: number;
  readonly animatedCount: number;
  readonly revealedRoofs: number;
  readonly exteriorReveals: number;
}

const treeSpecies: PropKind[] = ['oak', 'oak', 'oak', 'pine', 'pine', 'birch', 'birch', 'birch', 'birch', 'pine'];
const GROUP_TRANSMISSION = 0.73;

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

function foliageOverlaps(first: EnvironmentObject, second: EnvironmentObject): boolean {
  return first.foliage !== undefined && second.foliage !== undefined
    && first.occluder.silhouettes.some(a => second.occluder.silhouettes.some(b => overlaps(a, b)));
}

/** Geometry preserves walkability; noninteractive ambient effects share the environment's lifetime. */
export function createEnvironment(scene: Phaser.Scene, chunk: WorldChunk): EnvironmentRenderer {
  const objects = new Map<number, EnvironmentObject>();
  const props: Occluder[] = [];
  for (let y = 0; y < chunk.size; y++) for (let x = 0; x < chunk.size; x++) {
    const tile = chunk.tiles[y * chunk.size + x];
    const isBush = tile.walkable && tile.terrain === 'bush';
    if (!isBush && (tile.walkable || tile.terrain !== 'tree')) continue;
    const variant = grain(x, y, chunk.season.length);
    const kind = isBush ? 'bush' : treeSpecies[variant % treeSpecies.length];
    const texture = ensurePropTexture(scene, chunk.season, kind, (variant >>> 8) % 4);
    const base = tileCenter({ x, y });
    base.y += 9;
    const id = y * chunk.size + x;
    const image = scene.add.image(base.x, base.y, texture.key).setOrigin(0.5, 1).setDepth(10 + base.y);
    const left = base.x - texture.width / 2;
    const top = base.y - texture.height;
    const occluder = { id, base, bounds: { x: left - 4, y: top - 2, width: texture.width + 8, height: texture.height + 2 },
      silhouettes: texture.silhouettes.map(shape => ({ ...shape, x: left + shape.x, y: top + shape.y })),
    };
    props.push(occluder);
    const object: EnvironmentObject = { images: [image], occluder };
    if (texture.crownKey) {
      const crown = scene.add.image(base.x, base.y, texture.crownKey).setOrigin(0.5, 1).setDepth(10 + base.y + 0.01);
      object.images.push(crown);
      object.foliage = { image: crown, x: base.x, y: base.y, phase: variant % 628 / 100 };
    } else if (isBush) object.foliage = { image, x: base.x, y: base.y, phase: variant % 628 / 100 };
    objects.set(id, object);
  }
  const serviceNpcs = createNpcServices(scene, chunk);
  const formations = [...(chunk.layer === 'basement' ? [] : createRocks(scene, chunk)), ...createStructures(scene, chunk), ...serviceNpcs.objects];
  formations.forEach((object, index) => {
    const id = chunk.size * chunk.size + index;
    objects.set(id, object);
    props.push({ ...object.occluder, id });
  });
  const water = createWater(scene, chunk);
  const houseHeroReveal = createHouseHeroReveal(scene, formations);
  const roofs = formations.filter(object => object.occluder.house?.part === 'roof');
  const enteredHouses = new Set<string>();
  const smoke = createChimneySmoke(scene, formations.flatMap(object => object.smokeSource ? [object.smokeSource] : []));
  const campfires = createCampfires(scene, chunk.pois.filter(poi => poi.kind === 'campfire').map(poi => tileCenter(poi.position)));
  const animatedCount = water.count + smoke.count + campfires.count + serviceNpcs.count + [...objects.values()].filter(object => object.foliage).length;
  const index = new OcclusionIndex(props, new WalkableGround(chunk));
  const visibility = new RenderedVisibility([...objects.values()].flatMap(object => object.images), textureAlpha);
  const fading = new Set<number>();
  let obscured = new Set<number>();
  let previousPath: GridPoint[] | undefined;
  let routeOcclusion = new Set<number>();
  let destroyed = false;
  let ambientTime = 0;

  return {
    get count() { return objects.size; },
    get occludedCount() { return obscured.size; },
    get animatedCount() { return animatedCount; },
    get revealedRoofs() { return roofs.reduce((count, object) => count + Number(object.images[0].alpha < 0.999), 0); },
    get exteriorReveals() { return houseHeroReveal.count; },
    pointVisibility(point, depth) { return visibility.pointVisibility(point, depth); },
    isInteriorRevealed(point) {
      return roofs.every(roof => !containsPoint(roof.occluder.house!.geometry.interior, point)
        || enteredHouses.has(roof.occluder.house!.geometry.id) && roof.images[0].alpha < 0.999);
    },
    isPoiVisible(poi) {
      const point = tileCenter(poi.position);
      return roofs.every(roof => {
        const house = roof.occluder.house!.geometry;
        // Service NPCs stand at the exterior approach; interior chests retain the roof gate below.
        if (poi.kind === 'npc' && poi.structureId === house.id && !containsPoint(house.interior, point)) return true;
        if (poi.structureId !== house.id && !containsPoint(house.interior, point)) return true;
        // Require a hero inside now, even while a previously opened roof is
        // still fading closed. Cursor and route probes cannot discover a room.
        return enteredHouses.has(house.id) && roof.images[0].alpha < 0.999;
      });
    },
    update({ heroes, heroSprites, mobProbes = [], cursor, path, delta, reducedMotion, visibleBounds, campfireLit = true }) {
      if (destroyed) return;
      if (!reducedMotion) ambientTime += Math.max(0, delta);
      for (const object of objects.values()) {
        const visible = intersectsViewport(object.occluder.bounds, visibleBounds);
        object.images.forEach(image => image.setVisible(visible));
        const foliage = object.foliage;
        if (!foliage || !visible || reducedMotion) continue;
        const wave = Math.sin(ambientTime / 1100 + foliage.phase);
        foliage.image.setPosition(foliage.x + wave * 1.6, foliage.y + Math.sin(ambientTime / 1650 + foliage.phase) * 0.35).setRotation(wave * 0.004);
      }
      water.update(delta, reducedMotion, visibleBounds);
      smoke.update(delta, reducedMotion, visibleBounds);
      campfires.update(delta, reducedMotion, visibleBounds, campfireLit);
      serviceNpcs.update(delta, reducedMotion, visibleBounds);
      // The full route changes on simulation ticks, not on animation frames.
      if (previousPath !== path) {
        routeOcclusion = index.find(path.map(point => ({ point: tileCenter(point), width: 7, height: 7, ground: true })));
        previousPath = path;
      }
      const probes: OcclusionProbe[] = heroes.map(point => ({ point, width: 25, height: 43 }));
      enteredHouses.clear();
      for (const roof of roofs) {
        const house = roof.occluder.house!.geometry;
        if (probes.some(probe => entersHouse(house, probe))) enteredHouses.add(house.id);
      }
      probes.push(...mobProbes);
      if (cursor) probes.push({ point: { x: cursor.x, y: cursor.y + 0.5 }, groundPoint: cursor, width: 1, height: 1, ground: true });
      const next = index.find(probes);
      routeOcclusion.forEach(id => next.add(id));
      // Revisit already-obscured foliage too: a cursor or walking hero can
      // move from one crown to a dense cluster, changing the compensation
      // required for the group's combined alpha.
      for (const id of next) fading.add(id);
      for (const id of obscured) if (!next.has(id)) fading.add(id);
      obscured = next;
      for (const id of fading) {
        const object = objects.get(id);
        if (!object) { fading.delete(id); continue; }
        const images = object.images;
        const target = obscured.has(id);
        const foliageLayers = target && object.foliage
          ? Math.max(1, [...obscured].filter(otherId => {
            const other = objects.get(otherId);
            return other !== undefined && foliageOverlaps(object, other);
          }).length)
          : 1;
        // Alpha compositing makes N overlapping crowns opaque again. Choose
        // one per-crown alpha whose combined transmission stays at 0.73,
        // matching the existing single-object fade target.
        const targetAlpha = target && object.foliage
          ? 1 - Math.pow(GROUP_TRANSMISSION, 1 / foliageLayers)
          : 0.27;
        const alpha = occlusionAlpha(images[0].alpha, target, delta, reducedMotion, targetAlpha);
        images.forEach(image => image.setAlpha(alpha));
        if (alpha === (target ? targetAlpha : 1)) fading.delete(id);
      }
      houseHeroReveal.update(heroSprites, delta, reducedMotion, visibleBounds);
      visibility.refresh();
    },
    destroy() {
      destroyed = true;
      objects.forEach(object => object.images.forEach(image => image.destroy()));
      objects.clear();
      visibility.destroy();
      houseHeroReveal.destroy();
      water.destroy();
      smoke.destroy();
      campfires.destroy();
      serviceNpcs.destroy();
      fading.clear();
      obscured.clear();
      enteredHouses.clear();
    },
  };
}
