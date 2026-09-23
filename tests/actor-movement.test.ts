import { describe, expect, it, vi } from 'vitest';
import type { RoamingMob, WorldActor } from '@shards/shared';
import { createMovementState, MOVEMENT_TICK_MS } from '@shards/game-core';
import { animateActor, updateActorView, type ActorView } from '../apps/client/src/world/actors';
import { createPlannedMotion } from '../apps/client/src/world/planned-motion';
import { tileCenter } from '../apps/client/src/world/projection';

vi.mock('../apps/client/src/game/unitAnimation', () => ({
  createUnitSprite: vi.fn(), setUnitAnimation: vi.fn(), setUnitWalkDistance: vi.fn(), updateUnitBody: vi.fn(), facingFromDelta: () => 'east',
}));

function viewAt(actor: WorldActor): ActorView {
  const point = tileCenter(actor.position);
  const container = { ...point,
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
    setDepth() { return this; },
  };
  return { container, sprite: { anims: { pause() {}, resume() {} } },
    motion: createPlannedMotion(point, MOVEMENT_TICK_MS), facing: 'south',
    walkDistance: 0, selected: false, dead: false } as unknown as ActorView;
}

const hero: WorldActor = { id: 'guardian', position: { x: 1, y: 1 }, path: [{ x: 2, y: 1 }], movement: createMovementState() };
const mob: RoamingMob = { ...hero, id: 'scout', definitionId: 'goblin_scout' };

describe('actor rendering across bushes', () => {
  it('keeps mobs at their normal visible and animation pace while heroes slow down', () => {
    const heroView = viewAt(hero);
    const mobView = viewAt(mob);
    for (const [actor, view] of [[hero, heroView], [mob, mobView]] as const) {
      updateActorView(actor, view, false, true, 'grass', 'bush');
      animateActor(view, MOVEMENT_TICK_MS + 140, false, false);
    }
    const origin = tileCenter(hero.position);
    expect(heroView.container.x).toBe(origin.x + 8);
    expect(mobView.container.x).toBe(origin.x + 16);
    expect(mobView.walkDistance).toBe(heroView.walkDistance * 2);
    animateActor(mobView, 140, false, false);
    expect(mobView.container.x).toBe(tileCenter(mob.path[0]).x);
    updateActorView({ ...mob, position: mob.path[0], path: [] }, mobView, false, false, 'bush');
    expect(mobView.motion.targets).toHaveLength(0);
  });

  it('restores a mob halfway through a bush step without extending the visual duration', () => {
    const walking = { ...mob, movement: { ...mob.movement!, elapsedMs: 140 } };
    const view = viewAt(walking);
    updateActorView(walking, view, false, true, 'grass', 'bush');
    expect(view.container.x).toBe(tileCenter(mob.position).x + 16);
    animateActor(view, 140, false, false);
    expect(view.container.x).toBe(tileCenter(mob.path[0]).x);
  });
});
