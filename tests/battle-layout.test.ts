import { describe, expect, it } from 'vitest';
import { battleLayout, type BattlePlacement } from '../apps/client/src/game/battleLayout';

function bounds(placement: BattlePlacement) {
  // Include the full sprite frame, attack lunge and maximum truncated label.
  const halfWidth = Math.max(placement.scale * 16 + 12, placement.labelWidth / 2);
  return { left: placement.x - halfWidth, right: placement.x + halfWidth, top: placement.y - 28 * placement.scale, bottom: placement.y + 39 };
}

describe('battle formation', () => {
  for (let heroes = 1; heroes <= 4; heroes++) for (let enemies = 1; enemies <= 16; enemies++) {
    it(`fits ${heroes} heroes and ${enemies} enemies without overlapping their sprites, health bars or names`, () => {
      const placements = [...battleLayout('heroes', heroes), ...battleLayout('enemies', enemies)];
      const boxes = placements.map(bounds);
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(40);
        expect(box.right).toBeLessThanOrEqual(960);
        expect(box.top).toBeGreaterThanOrEqual(70);
        expect(box.bottom).toBeLessThanOrEqual(590);
      }
      for (let left = 0; left < boxes.length; left++) for (let right = left + 1; right < boxes.length; right++) {
        const a = boxes[left], b = boxes[right];
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `${left} overlaps ${right}`).toBe(true);
      }
    });
  }

  it('rejects rosters beyond battle capacity', () => {
    expect(() => battleLayout('heroes', 5)).toThrow();
    expect(() => battleLayout('enemies', 17)).toThrow();
    expect(() => battleLayout('enemies', 0)).toThrow();
  });
});
