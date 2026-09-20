import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { WorldActor } from '@shards/shared';
import { createActorView, updateActorView, animateActor } from '../apps/client/src/world/actors';

vi.mock('../apps/client/src/catalog', () => ({ findDefinition: (id: string) => ({ id }) }));
vi.mock('../apps/client/src/game/unitAnimation', () => ({
  createUnitSprite: () => ({ setScale() { return this; }, anims: { pause() {}, resume() {}, timeScale: 1 } }),
  facingFromDelta: (_x: number, _y: number, fallback: string) => fallback,
  setUnitAnimation: vi.fn(),
  updateUnitBody: vi.fn(),
}));

function fixture(id: string, selected: boolean, y = 8) {
  const scene = { add: {
    ellipse: () => ({}),
    graphics: () => ({ clear() {}, lineStyle() { return this; }, strokeEllipse() { return this; }, fillStyle() { return this; }, fillTriangle() {}, fillCircle() {} }),
    container: (x: number, y: number) => ({ x, y, depth: 0,
      setDepth(value: number) { this.depth = value; return this; },
      setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
    }),
  } } as unknown as Phaser.Scene;
  const actor: WorldActor = { id, position: { x: 8, y }, path: [] };
  const view = createActorView(scene, actor);
  updateActorView(actor, view, selected, true);
  return { actor, view };
}

describe('overlapping party presentation', () => {
  it('keeps the local hero above allies on arrival, idle frames and pause', () => {
    const local = fixture('guardian', true).view;
    const ally = fixture('priest', false).view;
    for (const paused of [false, true, false]) {
      animateActor(local, 16, false, paused);
      animateActor(ally, 16, false, paused);
      expect(local.container.x).toBe(ally.container.x);
      expect(local.container.y).toBe(ally.container.y);
      expect(local.container.depth).toBeGreaterThan(ally.container.depth);
    }
  });

  it('lets an ally in front cover the local hero standing at their head', () => {
    const local = fixture('guardian', true, 7).view;
    const ally = fixture('priest', false, 8).view;
    animateActor(local, 16, false, false);
    animateActor(ally, 16, false, false);
    expect(local.container.depth).toBeLessThan(ally.container.depth);
  });

  it('updates overlap priority during movement and when control changes without resetting position', () => {
    const local = fixture('guardian', true, 7);
    const ally = fixture('priest', false, 8);
    local.actor.path = [{ x: 8, y: 8 }];
    updateActorView(local.actor, local.view, true, false);
    animateActor(local.view, 100, false, false);
    expect(local.view.container.depth).toBeLessThan(ally.view.container.depth);
    animateActor(local.view, 300, false, false);
    expect(local.view.container.y).toBe(ally.view.container.y);
    expect(local.view.container.depth).toBeGreaterThan(ally.view.container.depth);
    updateActorView(local.actor, local.view, false, false);
    updateActorView(ally.actor, ally.view, true, false);
    expect(ally.view.container.depth).toBeGreaterThan(local.view.container.depth);
  });
});
