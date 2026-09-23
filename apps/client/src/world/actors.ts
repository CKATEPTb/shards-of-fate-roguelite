import Phaser from 'phaser';
import type { Terrain, UnitDefinition, WorldActor } from '@shards/shared';
import { isBodyAlive, movementStepMs, MOVEMENT_TICK_MS } from '@shards/game-core';
import { findDefinition } from '../catalog';
import { createUnitSprite, facingFromDelta, setUnitAnimation, setUnitScale, setUnitWalkDistance, updateUnitBody, updateUnitDefinition } from '../game/unitAnimation';
import { advanceMotion } from './motion';
import { createPlannedMotion, resumePlannedMotion, syncPlannedMotion, type PlannedMotionTrack } from './planned-motion';
import { tileCenter } from './projection';
import { actorDepth } from './actor-depth';

export interface ActorView {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  marker: Phaser.GameObjects.Graphics;
  motion: PlannedMotionTrack;
  facing: 'north' | 'east' | 'south' | 'west';
  /** Actual interpolated travel; facing and terrain changes do not restart a stride. */
  walkDistance: number;
  dead: boolean;
  selected?: boolean;
}

export function createActorView(scene: Phaser.Scene, actor: WorldActor, appearance?: { definitionId: string; enemy: boolean; scale: number }, definition?: UnitDefinition): ActorView {
  const point = tileCenter(actor.position);
  const shadow = scene.add.ellipse(0, 0, 22, 6, 0x101f19, 0.4);
  const contact = scene.add.ellipse(0, 0, 14, 3, 0x0a1511, 0.52);
  const marker = scene.add.graphics();
  const sprite = setUnitScale(createUnitSprite(scene, definition ?? findDefinition(appearance?.definitionId ?? actor.id), appearance?.enemy ?? false, 0, 0, actor.body), appearance?.scale ?? 1.65);
  const container = scene.add.container(point.x, point.y, [shadow, contact, marker, sprite]).setDepth(actorDepth(point.y));
  const dead = !!actor.body && !isBodyAlive(actor.body);
  if (dead) setUnitAnimation(sprite, 'death', 'south', true);
  return { container, marker, sprite, motion: createPlannedMotion(point, MOVEMENT_TICK_MS), facing: 'south', walkDistance: 0, dead };
}

export function updateActorView(actor: WorldActor, view: ActorView, selected: boolean, immediate: boolean, terrain?: Terrain, nextTerrain?: Terrain, definition?: UnitDefinition) {
  const point = tileCenter(actor.position);
  if (definition) updateUnitDefinition(view.sprite, definition, actor.body);
  else updateUnitBody(view.sprite, actor.body);
  const wasDead = view.dead;
  view.dead = !!actor.body && !isBodyAlive(actor.body);
  if (wasDead && !view.dead) setUnitAnimation(view.sprite, 'idle', view.facing, false, true);
  if (immediate || view.dead) {
    view.motion = createPlannedMotion(point, MOVEMENT_TICK_MS);
    view.walkDistance = 0;
  }
  const next = !view.dead && actor.path[0] ? tileCenter(actor.path[0]) : undefined;
  syncPlannedMotion(view.motion, point, next, movementStepMs(actor, terrain), movementStepMs(actor, nextTerrain));
  if (immediate || view.dead) {
    if (!view.dead) resumePlannedMotion(view.motion, actor.movement?.elapsedMs ?? 0);
    const restored = view.motion.position;
    view.container.setPosition(restored.x, restored.y);
  }
  view.container.setDepth(actorDepth(view.container.y, selected));
  if (view.selected === selected && wasDead === view.dead) return;
  view.selected = selected;
  view.marker.clear();
  if (view.dead) return;
  if (selected) {
    view.marker.lineStyle(1.5, 0xf0d99b, 0.95).strokeEllipse(0, 0, 29, 9);
    view.marker.fillStyle(0xf0d99b).fillTriangle(-3, -43, 3, -43, 0, -39);
  } else view.marker.fillStyle(0xa8c29c, 0.7).fillCircle(0, 11, 1.5);
}

export function animateActor(view: ActorView, delta: number, reduced: boolean, paused: boolean): void {
  if (view.dead) { setUnitAnimation(view.sprite, 'death', view.facing, true); return; }
  if (paused) { view.sprite.anims.pause(); return; }
  view.sprite.anims.resume();
  const distance = advanceMotion(view.motion, delta);
  const { x, y } = view.motion.position;
  if (distance > 0) view.facing = facingFromDelta(view.motion.direction.x, view.motion.direction.y, view.facing);
  view.container.setPosition(x, y).setDepth(actorDepth(y, view.selected));
  if (distance > 0) {
    view.walkDistance += distance;
    setUnitWalkDistance(view.sprite, view.facing, view.walkDistance, reduced);
  } else setUnitAnimation(view.sprite, 'idle', view.facing, reduced);
}
