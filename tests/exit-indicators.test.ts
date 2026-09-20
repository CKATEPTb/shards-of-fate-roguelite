import { describe, expect, it } from 'vitest';
import type { ChunkExit, Direction, GridPoint } from '@shards/shared';
import { computeExitIndicators } from '../apps/client/src/world/exitIndicators';
import { tileToScreen, type WorldProjection } from '../apps/client/src/world/projection';

const view: WorldProjection = { scrollX: 400, scrollY: 440, zoom: 1, width: 320, height: 240 };
const exit = (id: string, direction: Direction, position: GridPoint): ChunkExit => ({ id, direction, position, targetNodeId: id, returnGateId: `${id}:return` });
const cardinalExits = [
  exit('north', 'north', { x: 17, y: 0 }),
  exit('east', 'east', { x: 34, y: 17 }),
  exit('south', 'south', { x: 17, y: 34 }),
  exit('west', 'west', { x: 0, y: 17 }),
];

function expectAngle(actual: number, expected: number) {
  const difference = ((actual - expected + 540) % 360 + 360) % 360 - 180;
  expect(Math.abs(difference)).toBeLessThan(0.0001);
}

describe('exit indicator projection', () => {
  it('keeps visible exits at their actual tile centres, including centres 16 px from an edge', () => {
    const wholeChunk = { scrollX: 0, scrollY: 0, zoom: 1, width: 1120, height: 1120 };
    const indicators = computeExitIndicators(cardinalExits, wholeChunk);
    expect(indicators.map(item => item.id).sort()).toEqual(cardinalExits.map(item => item.id).sort());
    for (const gate of cardinalExits) {
      const indicator = indicators.find(item => item.id === gate.id)!;
      expect(indicator.offscreen).toBe(false);
      expect({ x: indicator.x, y: indicator.y }).toEqual(tileToScreen(gate.position, wholeChunk));
      expectAngle(indicator.angle, { north: -90, east: 0, south: 90, west: 180 }[gate.direction]);
    }
  });

  it('keeps one indicator per exit at the corresponding inset edge when the camera cannot see them', () => {
    const indicators = computeExitIndicators(cardinalExits, view);
    expect(indicators).toHaveLength(4);
    const expected = {
      north: { x: 160, y: 20, angle: -90 }, east: { x: 300, y: 120, angle: 0 },
      south: { x: 160, y: 220, angle: 90 }, west: { x: 20, y: 120, angle: 180 },
    };
    for (const item of indicators) {
      const position = expected[item.id as Direction];
      expect(item.offscreen).toBe(true);
      expect(item.edge).toBe(item.id);
      expect(item.x).toBeCloseTo(position.x);
      expect(item.y).toBeCloseTo(position.y);
      expectAngle(item.angle, position.angle);
    }
  });

  it('points each displaced indicator towards its real exit rather than just the nominal cardinal direction', () => {
    const gates = [exit('northwest', 'north', { x: 14, y: 0 }), exit('northeast', 'north', { x: 18, y: 0 })];
    for (const item of computeExitIndicators(gates, view)) {
      const target = tileToScreen(gates.find(gate => gate.id === item.id)!.position, view);
      expect(item.offscreen).toBe(true);
      expectAngle(item.angle, Math.atan2(target.y - item.y, target.x - item.x) * 180 / Math.PI);
    }
  });

  it('separates multiple exits on one edge without merging or changing their order', () => {
    const gates = Array.from({ length: 5 }, (_, index) => exit(`north-${index}`, 'north', { x: 15 + index, y: 0 }));
    const indicators = computeExitIndicators(gates, view).sort((a, b) => a.x - b.x);
    expect(indicators.map(item => item.id)).toEqual(gates.map(item => item.id));
    for (const [index, item] of indicators.entries()) {
      expect(item.edge).toBe('north');
      expect(item.y).toBe(20);
      expect(item.x).toBeGreaterThanOrEqual(20);
      expect(item.x).toBeLessThanOrEqual(view.width - 20);
      if (index > 0) expect(item.x - indicators[index - 1].x).toBeGreaterThanOrEqual(34 - 0.0001);
      const target = tileToScreen(gates[index].position, view);
      expectAngle(item.angle, Math.atan2(target.y - item.y, target.x - item.x) * 180 / Math.PI);
    }
  });

  it('compresses spacing to the available edge on small viewports without losing exits', () => {
    const narrow = { ...view, scrollX: 500, width: 120 };
    const gates = Array.from({ length: 9 }, (_, index) => exit(`crowded-${index}`, 'north', { x: 13 + index, y: 0 }));
    const indicators = computeExitIndicators(gates, narrow).sort((a, b) => a.x - b.x);
    expect(new Set(indicators.map(item => item.id)).size).toBe(gates.length);
    expect(new Set(indicators.map(item => item.x)).size).toBe(gates.length);
    for (const item of indicators) {
      expect(item.edge).toBe('north');
      expect(item.y).toBe(20);
      expect(item.x).toBeGreaterThanOrEqual(20);
      expect(item.x).toBeLessThanOrEqual(narrow.width - 20);
    }
  });

  it('keeps indicators on adjacent edges apart near a shared corner', () => {
    const gates = [exit('top-corner', 'north', { x: 1, y: 0 }), exit('left-corner', 'west', { x: 0, y: 1 })];
    const cornerView = { scrollX: 400, scrollY: 400, zoom: 1, width: 320, height: 320 };
    const indicators = computeExitIndicators(gates, cornerView);
    expect(new Set(indicators.map(item => item.edge))).toEqual(new Set(['north', 'west']));
    expect(Math.hypot(indicators[0].x - indicators[1].x, indicators[0].y - indicators[1].y)).toBeGreaterThanOrEqual(28);
  });

  it('updates visibility and exact positions as the camera pans, zooms and resizes', () => {
    const gate = cardinalExits[0];
    expect(computeExitIndicators([gate], view)[0].offscreen).toBe(true);
    for (const projection of [
      { scrollX: 400, scrollY: -32, zoom: 1, width: 320, height: 240 },
      { scrollX: 220, scrollY: -180, zoom: 1.5, width: 680, height: 540 },
      { scrollX: 320, scrollY: -96, zoom: 1.2, width: 480, height: 400 },
    ]) {
      const indicator = computeExitIndicators([gate], projection)[0];
      const target = tileToScreen(gate.position, projection);
      expect(indicator.offscreen).toBe(false);
      expect(indicator.x).toBeCloseTo(target.x);
      expect(indicator.y).toBeCloseTo(target.y);
    }
  });

  it('uses an intact edge indicator when an otherwise visible centre would clip its 14 px silhouette', () => {
    const gate = cardinalExits[0];
    const indicator = computeExitIndicators([gate], { ...view, scrollY: 8 })[0];
    expect(indicator.offscreen).toBe(true);
    expect(indicator.edge).toBe('north');
    expect(indicator.y).toBe(20);
  });

  it('keeps southern exits visible in the former toolbar strip and places hidden ones at the bottom edge', () => {
    const gate = cardinalExits[2];
    const projection = { ...view, scrollY: 640, height: 480 };
    const normal = computeExitIndicators([gate], projection)[0];
    expect(normal.offscreen).toBe(false);
    expect(normal.y).toBe(464);
    const offscreen = computeExitIndicators([gate], { ...projection, scrollY: 600 })[0];
    expect(offscreen.offscreen).toBe(true);
    expect(offscreen.edge).toBe('south');
    expect(offscreen.y).toBe(projection.height - 20);
    expectAngle(offscreen.angle, 90);
  });

  it('is deterministic, leaves exit positions untouched and accepts chunks without exits', () => {
    const gates = cardinalExits.map(gate => Object.freeze({ ...gate, position: Object.freeze({ ...gate.position }) }));
    const before = JSON.stringify(gates);
    const projection = Object.freeze({ ...view });
    expect(computeExitIndicators(gates, projection)).toEqual(computeExitIndicators(gates, projection));
    expect(JSON.stringify(gates)).toBe(before);
    expect(computeExitIndicators([], view)).toEqual([]);
  });
});
