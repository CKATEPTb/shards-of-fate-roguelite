import type Phaser from 'phaser';
import type { GridPoint, RoamingGroup, RoamingMob, WorldChunk } from '@shards/shared';
import { animateActor, createActorView, updateActorView, type ActorView } from './actors';
import { RoamingVisibility } from './roaming-visibility';
import type { OcclusionProbe } from './occlusion';
import { containsPoint, overlapsBounds } from './house-visibility';
import { roamingBodySamples } from './roaming-body-samples';
import { MIN_MOB_TRANSMISSION, roamingBodyVisible, type RoamingSight } from './roaming-body-visibility';

interface MobView { actor: ActorView; mob: RoamingMob; group: RoamingGroup; markerKey: string; label: Phaser.GameObjects.Text; bodyVisible: boolean }
export interface MobHit { groupId: string; mobId: string }
const categoryColors = { normal: 0xc19b78, epic: 0xc18ee9, miniboss: 0xf0bb68 };

function drawMarker(view: MobView, highlighted: boolean) {
  const { group, actor } = view;
  const key = `${group.category}:${group.chases}:${group.mode}:${highlighted}`;
  if (key === view.markerKey) return;
  view.markerKey = key;
  const color = categoryColors[group.category];
  const art = actor.marker.clear();
  const footprint = actor.visualScale / 1.65;
  art.lineStyle(highlighted ? 2 : 1, color, highlighted ? 1 : 0.5)
    .strokeEllipse(0, 0, (highlighted ? 31 : 25) * footprint, (highlighted ? 11 : 8) * footprint);
  if (highlighted) art.fillStyle(color, 0.14).fillEllipse(0, 0, 31 * footprint, 11 * footprint);
  const top = -28 * actor.visualScale;
  art.fillStyle(color, 0.94);
  if (group.category === 'epic') art.fillTriangle(-4, top, 0, top - 5, 4, top).fillTriangle(-4, top, 4, top, 0, top + 5);
  if (group.category === 'miniboss') art.fillPoints([{ x: -6, y: top - 5 }, { x: -3, y: top - 1 }, { x: 0, y: top - 7 }, { x: 3, y: top - 1 }, { x: 6, y: top - 5 }, { x: 5, y: top + 3 }, { x: -5, y: top + 3 }], true);
  if (group.chases || group.mode === 'chase') {
    art.lineStyle(1.5, group.mode === 'chase' ? 0xff765e : 0xddbea1, 0.95);
    const offset = group.category === 'normal' ? 0 : 12;
    art.beginPath().moveTo(offset - 3, top - 3).lineTo(offset, top).lineTo(offset + 3, top - 3).strokePath();
  }
}

/** Animated roaming actors share the hero movement clock, but never open roofs or cast hero light. */
export function createRoamingViews(scene: Phaser.Scene) {
  const views = new Map<string, MobView>();
  let visibility: RoamingVisibility | undefined;
  let currentChunk: WorldChunk | undefined;
  let sight: RoamingSight | undefined;

  function pointVisibility(view: MobView, point: GridPoint): number {
    if (!sight || !containsPoint(sight.viewport, point) || visibility?.coversPoint(point, view.actor.motion.position)) return 0;
    return sight.pointVisibility(point, view.actor.container.depth);
  }

  return {
    sync(groups: readonly RoamingGroup[], chunk: WorldChunk, reset: boolean) {
      if (reset) {
        views.forEach(view => view.actor.container.destroy());
        views.clear();
        sight = undefined;
      }
      if (currentChunk !== chunk) { currentChunk = chunk; visibility = new RoamingVisibility(chunk); }
      const retained = new Set<string>();
      for (const group of groups) for (const mob of group.members) {
        retained.add(mob.id);
        let view = views.get(mob.id);
        if (!view) {
          const scale = group.category === 'miniboss' ? 2.05 : group.category === 'epic' ? 1.8 : 1.65;
          const actor = createActorView(scene, mob, { definitionId: mob.definitionId, enemy: true, scale });
          const label = scene.add.text(0, -31 * actor.visualScale, '', {
            fontFamily: 'Georgia, serif', fontSize: '9px', fontStyle: 'bold', color: '#edc165',
            stroke: '#142219', strokeThickness: 2, padding: { x: 2, y: 1 },
          }).setOrigin(0.5, 1).setVisible(false);
          // The whole actor is depth sorted at its feet, including the label and selection ring.
          actor.container.add(label);
          view = { actor, mob, group, markerKey: '', label, bodyVisible: false };
          views.set(mob.id, view);
        }
        view.mob = mob; view.group = group;
        const terrain = chunk.tiles[mob.position.y * chunk.size + mob.position.x].terrain;
        const next = mob.path[0];
        const nextTerrain = next ? chunk.tiles[next.y * chunk.size + next.x].terrain : undefined;
        updateActorView(mob, view.actor, false, reset, terrain, nextTerrain);
      }
      for (const [id, view] of views) if (!retained.has(id)) { view.actor.container.destroy(); views.delete(id); }
    },

    update(delta: number, reduced: boolean, paused: boolean, heroes: readonly GridPoint[]) {
      visibility?.updateHeroes(heroes);
      for (const view of views.values()) {
        animateActor(view.actor, delta, reduced, paused);
        const feet = view.actor.motion.position;
        view.actor.container.setVisible(!visibility?.hidesInterior(feet));
      }
    },

    /** Runs after environment fading, so labels and input use the same painted frame as the body. */
    updateVisibility(frame: RoamingSight, paused: boolean, highlighted: readonly string[]) {
      sight = frame;
      const selected = new Set(highlighted);
      for (const view of views.values()) {
        const { actor, label } = view;
        view.bodyVisible = !paused && actor.container.visible && actor.sprite.visible
          && overlapsBounds(actor.sprite.getBounds(), frame.viewport)
          && roamingBodyVisible(actor.motion.position, roamingBodySamples(actor.sprite), actor.container.depth,
            { ...frame, pointVisibility: point => pointVisibility(view, point) });
        actor.marker.setVisible(view.bodyVisible);
        drawMarker(view, view.bodyVisible && selected.has(view.group.id));
        label.setVisible(false);
      }
    },

    isGroupVisible(groupId: string): boolean {
      return [...views.values()].some(view => view.group.id === groupId && view.bodyVisible);
    },

    inspect(point: GridPoint): MobHit | undefined {
      const ordered = [...views.values()].sort((a, b) => b.actor.container.depth - a.actor.container.depth);
      for (const view of ordered) {
        const { actor, mob, group } = view;
        if (!view.bodyVisible || pointVisibility(view, point) <= MIN_MOB_TRANSMISSION) continue;
        const sprite = actor.sprite;
        let localX = (point.x - actor.container.x - sprite.x) / sprite.scaleX + sprite.displayOriginX;
        let localY = (point.y - actor.container.y - sprite.y) / sprite.scaleY + sprite.displayOriginY;
        if (localX < 0 || localY < 0 || localX >= sprite.width || localY >= sprite.height) continue;
        if (sprite.flipX) localX = sprite.width - 1 - Math.floor(localX);
        if (sprite.flipY) localY = sprite.height - 1 - Math.floor(localY);
        if (!scene.textures.getPixelAlpha(Math.floor(localX), Math.floor(localY), sprite.texture.key, sprite.frame.name)) continue;
        return { groupId: group.id, mobId: mob.id };
      }
      return undefined;
    },

    occlusionProbes(): OcclusionProbe[] {
      return [...views.values()].flatMap(({ actor }) => {
        if (!actor.container.visible || !actor.sprite.visible) return [];
        const sprite = actor.sprite;
        // Probes extend upward from interpolated feet; exclude the frame padding below its ground origin.
        return [{ point: { ...actor.motion.position }, width: sprite.displayWidth,
          height: sprite.displayOriginY * Math.abs(sprite.scaleY), revealHouses: false }];
      });
    },

    frames() {
      return JSON.stringify([...views.values()].map(({ actor, mob, group, label, bodyVisible }) => ({
        id: mob.id, groupId: group.id, definitionId: mob.definitionId,
        x: actor.container.x, y: actor.container.y, depth: actor.container.depth,
        category: group.category, mode: group.mode, chases: group.chases,
        facing: actor.facing, animationFrame: String(actor.sprite.frame.name), visible: actor.container.visible,
        bodyVisible, labelVisible: label.visible && actor.container.visible, labelText: label.text,
        labelX: actor.container.x + label.x, labelY: actor.container.y + label.y, labelDepth: actor.container.depth,
      })));
    },

    destroy() { views.forEach(view => view.actor.container.destroy()); views.clear(); sight = undefined; },
  };
}
