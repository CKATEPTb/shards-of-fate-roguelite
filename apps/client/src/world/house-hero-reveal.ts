import type Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import type { EnvironmentObject } from './environmentObject';
import { entersHouse, overlapsBounds, probeBounds } from './house-visibility';
import type { Bounds, OcclusionProbe } from './occlusion';
import { intersectsViewport } from './water';
import { actorDepth } from './actor-depth';

export interface HeroAppearance { point: GridPoint; sprite: Phaser.GameObjects.Sprite; controlled?: boolean }

interface Surface {
  object: EnvironmentObject;
  images: Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Image>;
  graphics?: Phaser.GameObjects.Graphics;
  mask?: Phaser.Display.Masks.GeometryMask;
}

/** Show only the hidden hero through a closed surface. The roof/wall itself stays
 * opaque: unlike a transparent hole, this cannot expose objects inside the house. */
export function createHouseHeroReveal(scene: Phaser.Scene, objects: EnvironmentObject[]) {
  const surfaces: Surface[] = objects.filter(object => object.occluder.house).map(object => ({ object, images: new Map() }));
  const houses = new Map(surfaces.map(({ object }) => {
    const house = object.occluder.house!.geometry;
    return [house.id, house];
  }));
  let visibleCount = 0;

  function createImage(surface: Surface, sprite: Phaser.GameObjects.Sprite) {
    if (!surface.mask) {
      surface.graphics = scene.make.graphics({ x: 0, y: 0 });
      surface.graphics.fillStyle(0xffffff);
      for (const shape of surface.object.occluder.silhouettes) surface.graphics.fillRect(shape.x, shape.y, shape.width, shape.height);
      surface.mask = surface.graphics.createGeometryMask();
    }
    const image = scene.add.image(0, 0, sprite.texture.key, sprite.frame.name)
      .setMask(surface.mask).setAlpha(0).setVisible(false);
    surface.images.set(sprite, image);
    return image;
  }

  return {
    get count() { return visibleCount; },
    update(heroes: readonly HeroAppearance[], delta: number, reduced: boolean, viewport?: Bounds) {
      visibleCount = 0;
      const ordered = [...heroes].sort((a, b) => actorDepth(a.point.y, a.controlled) - actorDepth(b.point.y, b.controlled));
      const probes: OcclusionProbe[] = ordered.map(hero => ({ point: hero.point, width: 25, height: 43 }));
      const opened = new Set<string>();
      for (const house of houses.values()) if (probes.some(probe => entersHouse(house, probe))) opened.add(house.id);
      const currentSprites = new Set(heroes.map(hero => hero.sprite));
      for (const surface of surfaces) {
        const { object } = surface;
        const { occluder } = object;
        const image = object.images[0];
        const closed = !opened.has(occluder.house!.geometry.id);
        const onScreen = intersectsViewport(occluder.bounds, viewport);
        for (const [sprite, reveal] of surface.images) {
          if (currentSprites.has(sprite)) continue;
          reveal.clearMask().destroy();
          surface.images.delete(sprite);
        }
        for (const [index, hero] of ordered.entries()) {
          const bounds = probeBounds(probes[index]);
          const covered = closed && onScreen && hero.sprite.visible && image.depth > actorDepth(hero.point.y, hero.controlled)
            && occluder.silhouettes.some(shape => overlapsBounds(shape, bounds));
          let reveal = surface.images.get(hero.sprite);
          if (!covered && !reveal) continue;
          reveal ??= createImage(surface, hero.sprite);
          // A stale mask may not paint a ghost once the hero clears the surface.
          if (!covered) { reveal.setVisible(false).setAlpha(0); continue; }
          const source = hero.sprite;
          if (reveal.frame !== source.frame) reveal.setTexture(source.texture.key, source.frame.name);
          const transform = source.getWorldTransformMatrix();
          const target = 0.68 * source.alpha * image.alpha;
          const alpha = reduced ? target : reveal.alpha + (target - reveal.alpha) * (1 - Math.exp(-Math.max(0, delta) / 65));
          reveal.setOrigin(source.originX, source.originY).setPosition(transform.tx, transform.ty)
            .setScale(transform.scaleX, transform.scaleY).setRotation(transform.rotation)
            .setFlip(source.flipX, source.flipY).setDepth(image.depth + 0.001 + index * 0.0001).setAlpha(alpha).setVisible(true);
          if (alpha > 0.01) visibleCount++;
        }
      }
    },
    destroy() {
      for (const surface of surfaces) {
        surface.images.forEach(image => image.clearMask().destroy());
        surface.images.clear();
        surface.mask?.destroy();
        surface.graphics?.destroy();
      }
      visibleCount = 0;
    },
  };
}
