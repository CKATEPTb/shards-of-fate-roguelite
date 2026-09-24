import type Phaser from 'phaser';
import type { GridPoint, WorldActor } from '@shards/shared';
import { COOP_REVIVE_WINDOW_MS, isBodyAlive, MOVEMENT_TICK_MS } from '@shards/game-core';
import type { ActorView } from './actors';
import { containsPoint, overlapsBounds } from './house-visibility';
import type { Bounds } from './occlusion';
import type { EnvironmentRenderer } from './props';
import { roamingBodySamples } from './roaming-body-samples';
import { MIN_MOB_TRANSMISSION } from './roaming-body-visibility';

const CORPSE_MARKER_DEPTH = 90_001;

interface CorpseView {
  actor: WorldActor;
  container: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Graphics;
  clock: Phaser.GameObjects.Text;
  remainingMs: number;
  seconds: number;
  bodyVisible: boolean;
}

function visibleBody(actor: ActorView, environment: EnvironmentRenderer, viewport: Bounds): boolean {
  if (!actor.container.visible || !actor.sprite.visible
    || !overlapsBounds(actor.sprite.getBounds(), viewport)
    || !environment.isInteriorRevealed(actor.motion.position)) return false;
  for (const point of roamingBodySamples(actor.sprite)) {
    if (containsPoint(viewport, point)
      && environment.pointVisibility(point, actor.container.depth) > MIN_MOB_TRANSMISSION) return true;
  }
  return false;
}

/** Input and the rescue clock share the actual painted visibility of the fallen ally. */
export function createCorpseViews(scene: Phaser.Scene) {
  const views = new Map<string, CorpseView>();

  return {
    sync(actors: readonly WorldActor[], tick: number) {
      const retained = new Set<string>();
      for (const actor of actors) {
        if (!actor.body || isBodyAlive(actor.body) || actor.reviveUntilTick === undefined) continue;
        retained.add(actor.id);
        let view = views.get(actor.id);
        if (!view) {
          const art = scene.add.graphics();
          const clock = scene.add.text(4, 0, '', {
            fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'bold', color: '#d9edc5',
            stroke: '#142219', strokeThickness: 2,
          }).setOrigin(.5, 0);
          const container = scene.add.container(0, 0, [art, clock])
            .setDepth(CORPSE_MARKER_DEPTH).setVisible(false);
          view = { actor, art, clock, container, remainingMs: 0, seconds: -1, bodyVisible: false };
          views.set(actor.id, view);
        }
        view.actor = actor;
        view.remainingMs = Math.max(0, (actor.reviveUntilTick - tick) * MOVEMENT_TICK_MS);
        const seconds = Math.ceil(view.remainingMs / 1000);
        if (view.seconds === seconds) continue;
        view.seconds = seconds;
        const expired = seconds === 0;
        const urgent = seconds <= 30;
        const color = expired ? 0x6d7776 : urgent ? 0xeaaf81 : 0xc6dda6;
        view.clock.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`)
          .setColor(expired ? '#89928a' : urgent ? '#f0bd93' : '#d9edc5');
        view.art.clear().fillStyle(0x12201c, .9).fillRoundedRect(-25, -3, 50, 22, 5);
        view.art.fillStyle(color, expired ? .45 : .95).fillRect(-20, 4, 8, 2).fillRect(-17, 1, 2, 8);
        view.art.fillStyle(0x64725c, .3).fillRoundedRect(-20, 14, 40, 2, 1);
        if (!expired) view.art.fillStyle(color, .9).fillRect(-20, 14,
          Math.max(1, 40 * Math.min(1, view.remainingMs / COOP_REVIVE_WINDOW_MS)), 2);
        view.container.setAlpha(expired ? .6 : 1);
      }
      for (const [id, view] of views) if (!retained.has(id)) { view.container.destroy(); views.delete(id); }
    },

    updateVisibility(actors: ReadonlyMap<string, ActorView>, environment: EnvironmentRenderer | undefined, viewport: Bounds) {
      for (const view of views.values()) {
        const actor = actors.get(view.actor.id);
        const feet = actor?.motion.position;
        view.bodyVisible = !!actor && !!environment && visibleBody(actor, environment, viewport);
        view.container.setVisible(view.bodyVisible);
        if (feet) view.container.setPosition(feet.x, feet.y + 14);
      }
    },

    atPoint(point: GridPoint): WorldActor | undefined {
      return [...views.values()].filter(view => view.bodyVisible && view.remainingMs > 0)
        .sort((a, b) => Math.hypot(point.x - a.container.x, point.y - a.container.y)
          - Math.hypot(point.x - b.container.x, point.y - b.container.y))
        .find(view => Math.abs(point.x - view.container.x) <= 27
          && point.y >= view.container.y - 43 && point.y <= view.container.y + 20)?.actor;
    },

    nearby(actor: WorldActor): WorldActor | undefined {
      return [...views.values()].filter(view => view.bodyVisible && view.remainingMs > 0 && view.actor.id !== actor.id)
        .map(view => ({ actor: view.actor,
          distance: Math.abs(actor.position.x - view.actor.position.x) + Math.abs(actor.position.y - view.actor.position.y) }))
        .filter(candidate => candidate.distance <= 1).sort((a, b) => a.distance - b.distance)[0]?.actor;
    },

    clear() { views.forEach(view => view.container.destroy()); views.clear(); },
  };
}
