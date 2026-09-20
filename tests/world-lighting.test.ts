import { describe, expect, it } from 'vitest';
import { LIGHT_STYLES, WORLD_DARKNESS, lightFalloff, lightPulse, lightingOverlayPlacement, visibleWorldLights, worldLightToScreen } from '../apps/client/src/world/lightingGeometry';
import { tileCenter, tileToScreen, TILE_SIZE, type WorldProjection } from '../apps/client/src/world/projection';
import { ROAMING_AGGRO_RADIUS } from '@shards/game-core';

const view: WorldProjection = { scrollX: 75, scrollY: 38, zoom: 1.7, width: 1280, height: 720 };

describe('local world illumination', () => {
  it('illuminates an approaching enemy body before pursuit rather than hiding it at the light edge', () => {
    const enemyHeadBeyondAggro = ROAMING_AGGRO_RADIUS * TILE_SIZE + 43;
    const reveal = LIGHT_STYLES.hero.reveal * lightFalloff(enemyHeadBeyondAggro / LIGHT_STYLES.hero.radius);
    const visibility = 1 - WORLD_DARKNESS * (1 - reveal);
    expect(visibility).toBeGreaterThan(0.5);
    expect(lightFalloff(1.1)).toBe(0);
  });
  it('uses the same camera projection as actors and moves lights without tile snapping', () => {
    const tile = { x: 13, y: 11 };
    const point = tileCenter(tile);
    expect(worldLightToScreen(point, view)).toEqual(tileToScreen(tile, view));
    const moved = worldLightToScreen({ x: point.x + 0.25, y: point.y - 0.5 }, view);
    const initial = worldLightToScreen(point, view);
    expect(moved.x - initial.x).toBeCloseTo(0.25 * view.zoom);
    expect(moved.y - initial.y).toBeCloseTo(-0.5 * view.zoom);
  });

  it('retains a separate reveal for every hero and the campfire', () => {
    const heroes = [{ x: 650, y: 400 }, { x: 710, y: 390 }, { x: 770, y: 420 }];
    const fires = [{ x: 710, y: 480 }];
    const lights = visibleWorldLights(heroes, fires, view);
    expect(lights).toHaveLength(4);
    expect(lights.filter((light) => light.kind === 'hero')).toHaveLength(3);
    expect(lights.at(-1)?.radius).toBe(LIGHT_STYLES.campfire.radius * view.zoom);
    expect(new Set(lights.map((light) => `${light.x}:${light.y}`)).size).toBe(4);
  });

  it('keeps an offscreen source while its light still enters the viewport', () => {
    const unitView = { scrollX: 0, scrollY: 0, zoom: 1, width: 600, height: 400 };
    const radius = LIGHT_STYLES.hero.radius;
    const sources = [{ x: -radius + 1, y: 100 }, { x: -radius - 1, y: 100 }];
    expect(visibleWorldLights(sources, [], unitView)).toEqual([{ ...sources[0], kind: 'hero', radius }]);
  });

  it.each([0.55, 1, 1.35, 2.4])('covers exactly the viewport at zoom %s, including odd dimensions', (zoom) => {
    const projection = { ...view, width: 961, height: 543, zoom };
    const overlay = lightingOverlayPlacement(projection);
    expect((overlay.x - projection.width / 2) * zoom + projection.width / 2).toBeCloseTo(0);
    expect((overlay.y - projection.height / 2) * zoom + projection.height / 2).toBeCloseTo(0);
    expect(overlay.width * zoom).toBeCloseTo(projection.width);
    expect(overlay.height * zoom).toBeCloseTo(projection.height);
    expect(overlay.canvasWidth).toBe(481);
    expect(overlay.canvasHeight).toBe(272);
  });

  it('fades monotonically to the distant silhouettes without a hard bright ring', () => {
    const samples = Array.from({ length: 101 }, (_, index) => lightFalloff(index / 100));
    expect(samples[0]).toBe(1);
    expect(samples.at(-1)).toBe(0);
    expect(samples.every((value, index) => value >= 0 && value <= 1 && (index === 0 || value <= samples[index - 1]))).toBe(true);
    expect(lightFalloff(0.99)).toBeLessThan(0.001);
    expect(lightFalloff(2)).toBe(0);
    expect(WORLD_DARKNESS).toBeGreaterThan(0);
    expect(WORLD_DARKNESS).toBeLessThan(1);
  });

  it('keeps light steady with reduced motion while preserving moving source geometry', () => {
    for (const elapsed of [0, 170, 500, 1900, 7200]) {
      expect(lightPulse('campfire', elapsed, true)).toBe(1);
      expect(lightPulse('hero', elapsed, false)).toBe(1);
      expect(lightPulse('campfire', elapsed, false)).toBeGreaterThanOrEqual(0.95);
      expect(lightPulse('campfire', elapsed, false)).toBeLessThanOrEqual(1);
    }
    expect(lightPulse('campfire', 500, false)).not.toBe(lightPulse('campfire', 0, false));
    expect(visibleWorldLights([{ x: 600, y: 400 }], [], view)[0].x)
      .not.toBe(visibleWorldLights([{ x: 610, y: 400 }], [], view)[0].x);
  });
});
