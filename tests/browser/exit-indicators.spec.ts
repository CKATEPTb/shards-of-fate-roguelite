import { expect, test, type Page } from '@playwright/test';
import type { ChunkExit, ExplorationState } from '@shards/shared';
import { createExpedition, findPath, generateChunk, generateWorld } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { DELTAS } from '../../packages/game-core/src/world/grid';
import { tileToScreen } from '../../apps/client/src/world/projection';
import { computeExitIndicators } from '../../apps/client/src/world/exitIndicators';
import { cameraView, clearFixtureEnemies, clickTile, expectActorPosition, firstCampSpawn, loadBattleFixture, loadExpeditionFixture, loadPartyAt, placeFixtureParty, ready, saveExpeditionFixture } from './world-helpers';

const chunk = generateChunk(generateWorld('FIRST-CAMPFIRE'), '0,0');

async function savedWorld(page: Page): Promise<ExplorationState> {
  return (await saveExpeditionFixture(page)).world;
}

async function expectMatchingArrival(page: Page, gate: ChunkExit, transitions = 1) {
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-chunk-id', gate.targetNodeId, { timeout: 15_000 });
  const world = await savedWorld(page);
  const peer = world.chunk.exits.find(exit => exit.id === gate.returnGateId)!;
  expect(peer.returnGateId).toBe(gate.id);
  const delta = DELTAS[gate.direction];
  const arrival = {
    x: peer.position.x + delta.x, y: peer.position.y + delta.y,
  };
  expect(world.actors.map(actor => ({ id: actor.id, position: actor.position, path: actor.path })))
    .toEqual([{ id: 'guardian', position: arrival, path: [] }]);
  expect(world.transitions).toBe(transitions);
  const actor = world.actors.find(member => member.id === 'guardian')!;
  await expectIndicatorsFollowCamera(page, world.chunk.exits.filter(exit => findPath(world.chunk, actor.position, exit.position).length > 0));
}

async function expectMarkerHit(page: Page, marker: { id?: string; x: number; y: number }) {
  expect(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.closest('[data-exit-id]')?.getAttribute('data-exit-id'), marker)).toBe(marker.id);
}

/** Read a single rendered frame so a moving camera cannot race the SVG assertions. */
async function indicatorFrame(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="world-canvas"]')!;
    const data = host.dataset;
    return {
      view: { scrollX: Number(data.cameraScrollX), scrollY: Number(data.cameraScrollY), zoom: Number(data.cameraZoom), width: Number(data.viewportWidth), height: Number(data.viewportHeight) },
      indicators: Array.from(document.querySelectorAll<SVGGElement>('[data-testid="exit-indicators"] g[data-exit-id]')).map(element => {
        const matrix = element.transform.baseVal.consolidate()?.matrix;
        return { id: element.dataset.exitId, offscreen: element.dataset.offscreen === 'true', edge: element.dataset.edge, x: matrix?.e ?? NaN, y: matrix?.f ?? NaN };
      }),
    };
  });
}

async function expectIndicatorsFollowCamera(page: Page, exits: ChunkExit[]) {
  await expect.poll(async () => {
    const { view, indicators } = await indicatorFrame(page);
    const errors: string[] = [];
    if (indicators.length !== exits.length || new Set(indicators.map(item => item.id)).size !== exits.length) errors.push('Every exit must have exactly one indicator');
    for (const gate of exits) {
      const item = indicators.find(marker => marker.id === gate.id);
      if (!item) { errors.push(`Missing ${gate.id}`); continue; }
      const actual = tileToScreen(gate.position, view);
      const visible = actual.x >= 14 && actual.x <= view.width - 14 && actual.y >= 14 && actual.y <= view.height - 14;
      if (item.offscreen === visible) errors.push(`Incorrect visibility for ${gate.id}`);
      if (visible) {
        if (Math.abs(item.x - actual.x) > 0.1 || Math.abs(item.y - actual.y) > 0.1) errors.push(`Stale tile projection for ${gate.id}`);
      } else {
        if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || item.x < 19.9 || item.x > view.width - 19.9 || item.y < 19.9 || item.y > view.height - 19.9) errors.push(`Indicator outside viewport: ${gate.id}`);
        const coordinate = item.edge === 'north' ? item.y : item.edge === 'south' ? view.height - item.y : item.edge === 'east' ? view.width - item.x : item.edge === 'west' ? item.x : NaN;
        if (!Number.isFinite(coordinate) || Math.abs(coordinate - 20) > 0.1) errors.push(`Incorrect edge inset for ${gate.id}`);
      }
    }
    for (const edge of ['north', 'east', 'south', 'west']) {
      const horizontal = edge === 'north' || edge === 'south';
      const positions = indicators.filter(item => item.offscreen && item.edge === edge).map(item => horizontal ? item.x : item.y).sort((a, b) => a - b);
      const available = (horizontal ? view.width : view.height) - 2 * (20 + 24);
      const gap = Math.min(34, available / (positions.length - 1));
      for (let index = 1; index < positions.length; index++) {
        if (positions[index] - positions[index - 1] < gap - 0.1) errors.push(`Overlapping indicators on ${edge}`);
      }
    }
    return errors;
  }).toEqual([]);
}

test('all exits remain distinct through ignored drags, automatic following and viewport resizing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const overlay = page.getByTestId('exit-indicators');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCSS('pointer-events', 'none');
  await expectIndicatorsFollowCamera(page, chunk.exits);
  const before = await indicatorFrame(page);
  expect(before.indicators.some(item => item.offscreen)).toBe(true);
  const arrow = before.indicators.find(item => item.offscreen && (item.edge === 'north' || item.edge === 'west'))!;
  expect(arrow).toBeDefined();
  await expectMarkerHit(page, arrow);
  // Returning to the arrow after a drag must still cancel activation, without
  // leaking a click to the reachable ground beneath it.
  await page.mouse.move(arrow.x, arrow.y);
  await page.mouse.down();
  await page.mouse.move(arrow.x + 85, arrow.y + 65, { steps: 10 });
  await page.mouse.move(arrow.x, arrow.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const afterDrag = await cameraView(page);
  expect(Math.hypot(afterDrag.scrollX - before.view.scrollX, afterDrag.scrollY - before.view.scrollY)).toBeLessThan(0.1);
  await expectActorPosition(page, firstCampSpawn);
  await expectIndicatorsFollowCamera(page, chunk.exits);
  await clickTile(page, { x: 19, y: 18 });
  await expectActorPosition(page, { x: 19, y: 18 });
  await expect.poll(async () => {
    const view = await cameraView(page);
    return Math.hypot(view.scrollX - before.view.scrollX, view.scrollY - before.view.scrollY);
  }).toBeGreaterThan(20);
  await expectIndicatorsFollowCamera(page, chunk.exits);

  for (const viewport of [{ width: 844, height: 390 }, { width: 1440, height: 1000 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => (await cameraView(page)).width).toBe(viewport.width);
    await expect.poll(async () => (await cameraView(page)).height).toBe(viewport.height);
    await expectIndicatorsFollowCamera(page, chunk.exits);
  }
});

test('loading another seed refreshes matching exit IDs while the actor and reduced-motion camera stay still', async ({ page }) => {
  const seed = 'GATE-RELOAD-9';
  const replacement = generateChunk(generateWorld(seed), '0,0');
  // This fixture changes gate positions without adding or removing any SVG keys.
  expect(replacement.exits.map(gate => gate.id)).toEqual(chunk.exits.map(gate => gate.id));
  expect(replacement.exits.map(gate => gate.position)).not.toEqual(chunk.exits.map(gate => gate.position));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await expect(page.locator('.game')).toHaveClass(/reduced-motion/);
  await loadPartyAt(page, chunk.spawn);
  await expectIndicatorsFollowCamera(page, chunk.exits);
  const before = await indicatorFrame(page);
  await loadPartyAt(page, replacement.spawn, seed);
  await expectActorPosition(page, replacement.spawn);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-actor-id', 'guardian');
  await expect(page.locator('.game')).toHaveClass(/reduced-motion/);
  await expect.poll(async () => (await cameraView(page))).toEqual(before.view);
  await expectIndicatorsFollowCamera(page, replacement.exits);
  await expect.poll(async () => {
    const frame = await indicatorFrame(page);
    const expected = computeExitIndicators(replacement.exits, frame.view);
    return expected.filter(target => {
      const actual = frame.indicators.find(item => item.id === target.id);
      return !actual || actual.offscreen !== target.offscreen || Math.abs(actual.x - target.x) > 0.1 || Math.abs(actual.y - target.y) > 0.1;
    }).map(item => item.id);
  }).toEqual([]);
  expect((await indicatorFrame(page)).indicators).not.toEqual(before.indicators);
});

for (const touch of [false, true]) {
  test.describe(touch ? 'touch exit indicators' : 'mouse exit indicators', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: touch });
    test('a visible exit targets its own terrain gate', async ({ page }) => {
      await ready(page);
      const gate = chunk.exits.find(item => item.direction === 'north')!;
      const approach = { x: gate.position.x, y: gate.position.y + 2 };
      expect(chunk.tiles[approach.y * chunk.size + approach.x].walkable).toBe(true);
      await loadPartyAt(page, approach);
      await expectIndicatorsFollowCamera(page, chunk.exits);
      const marker = page.getByTestId('exit-indicators').locator('g[data-exit-id]');
      await expect(marker).toHaveCount(chunk.exits.length);
      const frame = await indicatorFrame(page);
      const arrow = frame.indicators.find(item => item.id === gate.id)!;
      expect(arrow.offscreen).toBe(false);
      const target = tileToScreen(gate.position, frame.view);
      expect(arrow.x).toBeCloseTo(target.x, 1);
      expect(arrow.y).toBeCloseTo(target.y, 1);
      await expectMarkerHit(page, arrow);
      await clickTile(page, gate.position, touch);
      await expectMatchingArrival(page, gate);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('an offscreen arrow routes to its exact exit and transfers the party through the matching entrance', async ({ page }) => {
      await ready(page);
      const origin = { x: 21, y: 19 };
      const gate = chunk.exits.find(exit => exit.id === `0,0:east:${touch ? 1 : 0}`)!;
      const path = findPath(chunk, origin, gate.position);
      expect(path.length).toBeGreaterThan(8);
      expect(path.some(point => chunk.pois.some(poi => poi.kind === 'encounter' && poi.position.x === point.x && poi.position.y === point.y))).toBe(false);
      expect(chunk.exits.filter(exit => exit.targetNodeId === gate.targetNodeId).length).toBeGreaterThan(1);
      await loadPartyAt(page, origin);
      await expectIndicatorsFollowCamera(page, chunk.exits);
      const arrow = (await indicatorFrame(page)).indicators.find(marker => marker.id === gate.id)!;
      expect(arrow.offscreen).toBe(true);
      await expectMarkerHit(page, arrow);
      if (touch) await page.touchscreen.tap(arrow.x, arrow.y);
      else await page.mouse.click(arrow.x, arrow.y);
      const routed = await savedWorld(page);
      expect(routed.actors.find(actor => actor.id === 'guardian')!.path.at(-1)).toEqual(gate.position);
      expect(routed.actors.filter(actor => actor.id !== 'guardian').every(actor => actor.path.length === 0)).toBe(true);
      await expectMatchingArrival(page, gate);
    });
  });
}

test('keyboard activation uses the same exact gate for Enter and Space', async ({ page }) => {
  await ready(page);
  for (const key of ['Enter', 'Space']) {
    const gate = chunk.exits.find(exit => exit.id === '0,0:north:1')!;
    await loadPartyAt(page, { x: gate.position.x, y: gate.position.y + 2 });
    const marker = page.getByTestId('exit-indicators').locator(`g[data-exit-id="${gate.id}"]`);
    await expect(marker).toHaveAttribute('role', 'button');
    await expect(marker).toHaveAttribute('tabindex', '0');
    await marker.focus();
    await page.keyboard.press(key);
    await expectMatchingArrival(page, gate);
  }
});

test('a disconnected area only shows reachable gates, which remain clickable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  const targetId = '2,-2';
  const routes = new Map([[state.world.graph.startId, [state.world.graph.startId]]]);
  const nodes = new Map(state.world.graph.nodes.map(node => [node.id, node]));
  for (const [id, route] of routes) {
    for (const neighbor of Object.values(nodes.get(id)!.exits)) {
      if (neighbor && !routes.has(neighbor)) routes.set(neighbor, [...route, neighbor]);
    }
    if (routes.has(targetId)) break;
  }
  const route = routes.get(targetId)!;
  const detachedChunk = generateChunk(state.world.graph, targetId);
  const origin = { x: 13, y: 2 };
  const reachable = detachedChunk.exits.filter(exit => findPath(detachedChunk, origin, exit.position).length > 0);
  const unreachable = detachedChunk.exits.filter(exit => !reachable.includes(exit));
  expect(reachable).toHaveLength(1);
  expect(unreachable).toHaveLength(4);
  Object.assign(state.world, {
    chunk: detachedChunk, currentChunkId: targetId, visited: route, tick: route.length, transitions: route.length - 1,
    actors: placeFixtureParty(detachedChunk, state.world.actors, origin),
  });
  clearFixtureEnemies(state);
  await loadExpeditionFixture(page, state);
  await expectActorPosition(page, origin);
  await expectIndicatorsFollowCamera(page, reachable);
  for (const gate of unreachable) {
    await expect(page.getByTestId('exit-indicators').locator(`g[data-exit-id="${gate.id}"]`)).toHaveCount(0);
  }
  const gate = reachable[0];
  const arrow = (await indicatorFrame(page)).indicators.find(marker => marker.id === gate.id)!;
  await expectMarkerHit(page, arrow);
  await page.mouse.click(arrow.x, arrow.y);
  await expect(page.locator('.game-notice')).toHaveCount(0);
  await expectMatchingArrival(page, gate, state.world.transitions + 1);
});

test('exit arrows disappear while menus or combat disable world input', async ({ page }) => {
  await ready(page);
  const overlay = page.getByTestId('exit-indicators');
  await expect(overlay).toBeVisible();
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(overlay).toBeHidden();
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
  await expect(overlay).toBeVisible();
  await loadBattleFixture(page);
  await expect(overlay).toBeHidden();
});
