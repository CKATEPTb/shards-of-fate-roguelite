import { describe, expect, it, vi } from 'vitest';
import { LIGHT_STYLES } from '../apps/client/src/world/lightingGeometry';
import { inMobDetailRange, MOB_DETAIL_RADIUS, opaqueBodyPixels, roamingBodyVisible, type RoamingSight } from '../apps/client/src/world/roaming-body-visibility';

const viewport = { x: 0, y: 0, width: 1200, height: 1200 };
const feet = { x: 500, y: 500 };
const points = [{ x: 500, y: 475 }, { x: 497, y: 488 }, { x: 503, y: 497 }];
const sight = (transmission = 1): RoamingSight => ({ heroes: [feet], viewport, pointVisibility: () => transmission });

describe('visible body requirement for enemy information', () => {
  it('extends exactly three hero light radii and accepts proximity to any party member', () => {
    expect(MOB_DETAIL_RADIUS).toBe(LIGHT_STYLES.hero.radius * 3);
    expect(inMobDetailRange(feet, [{ x: feet.x + MOB_DETAIL_RADIUS, y: feet.y }])).toBe(true);
    expect(inMobDetailRange(feet, [{ x: feet.x + MOB_DETAIL_RADIUS + 0.001, y: feet.y }])).toBe(false);
    expect(inMobDetailRange(feet, [{ x: feet.x + MOB_DETAIL_RADIUS, y: feet.y + 1 }])).toBe(false);
    expect(inMobDetailRange(feet, [{ x: 5000, y: 5000 }, feet])).toBe(true);
    expect(inMobDetailRange(feet, [])).toBe(false);
  });

  it('distinguishes full opaque cover from a visible part or a faded foreground object', () => {
    expect(roamingBodyVisible(feet, points, 510, sight(0))).toBe(false);
    expect(roamingBodyVisible(feet, points, 510, sight(0.02))).toBe(false);
    expect(roamingBodyVisible(feet, points, 510, sight(0.73))).toBe(true);
    const query = vi.fn((point, depth) => point.y > 495 && depth === 510 ? 1 : 0);
    expect(roamingBodyVisible(feet, points, 510, { ...sight(), pointVisibility: query })).toBe(true);
    expect(query).toHaveBeenCalledWith(points[2], 510);
  });

  it('does not make a hidden body visible because its frame padding or its caption is onscreen', () => {
    expect(roamingBodyVisible(feet, [], 510, sight())).toBe(false);
    expect(roamingBodyVisible(feet, points, 510, { ...sight(), viewport: { x: 0, y: 0, width: 1200, height: 460 } })).toBe(false);
    expect(roamingBodyVisible(feet, points, 510, { ...sight(), viewport: { x: 495, y: 487, width: 3, height: 3 } })).toBe(true);
    expect(roamingBodyVisible(feet, points, 510, { ...sight(), heroes: [{ x: 3000, y: 500 }] })).toBe(false);
  });

  it('samples only painted sprite body pixels, excluding padding and pixels below the feet', () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    const paint = (x: number, y: number) => { rgba[(y * 4 + x) * 4 + 3] = 255; };
    paint(1, 1); paint(2, 2); paint(0, 3);
    expect(opaqueBodyPixels(rgba, 4, 4, 3)).toEqual(expect.arrayContaining([{ x: 1.5, y: 1.5 }, { x: 2.5, y: 2.5 }]));
    expect(opaqueBodyPixels(rgba, 4, 4, 3)).toHaveLength(2);
  });
});
