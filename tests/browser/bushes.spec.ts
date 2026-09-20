import { expect, test, type Page } from '@playwright/test';
import { generateChunk, generateWorld } from '@shards/game-core';
import type { GridPoint } from '@shards/shared';
import { clickTile, expectActorPosition, loadPartyAt, ready } from './world-helpers';

async function measureStep(page: Page, from: GridPoint, to: GridPoint) {
  const host = page.getByTestId('world-canvas');
  const axis = from.x === to.x ? 'y' : 'x';
  const start = from[axis] * 32 + 16;
  const end = to[axis] * 32 + 16;
  await expect(host).toHaveAttribute(`data-visual-actor-${axis}`, String(start));
  await host.evaluate((element, selectedAxis) => {
    const samples: { position: number; time: number }[] = [];
    const attribute = `data-visual-actor-${selectedAxis}`;
    const observer = new MutationObserver(() => samples.push({ position: Number(element.getAttribute(attribute)), time: performance.now() }));
    observer.observe(element, { attributes: true, attributeFilter: [attribute] });
    Object.assign(element, { bushSamples: samples, bushObserver: observer });
  }, axis);
  await clickTile(page, to);
  await expectActorPosition(page, to);
  await expect(host).toHaveAttribute(`data-visual-actor-${axis}`, String(end));
  const samples = await host.evaluate(element => {
    const sampled = element as HTMLElement & { bushSamples: { position: number; time: number }[]; bushObserver: MutationObserver };
    sampled.bushObserver.disconnect();
    return sampled.bushSamples;
  });
  const first = samples.find(sample => sample.position !== start)!;
  const last = samples.find(sample => sample.position === end)!;
  expect(first).toBeDefined();
  expect(last).toBeDefined();
  return last.time - first.time;
}

test('a naturally generated bush can be entered and visibly halves the movement pace', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 900, height: 700 });
  const grass = { x: 16, y: 15 };
  const bush = { x: 16, y: 14 };
  const chunk = generateChunk(generateWorld('FIRST-CAMPFIRE'), '0,0');
  expect(chunk.tiles[grass.y * chunk.size + grass.x].terrain).toBe('grass');
  expect(chunk.tiles[bush.y * chunk.size + bush.x]).toEqual({ terrain: 'bush', walkable: true, movementCost: 2 });
  await ready(page);
  await loadPartyAt(page, grass);
  const throughBushMs = await measureStep(page, grass, bush);
  await page.mouse.move(1100, 650);
  await page.screenshot({ path: 'test-results/walkable-bushes.png' });
  const throughGrassMs = await measureStep(page, bush, grass);
  // Compare visible interpolation, excluding the pre-movement simulation delay.
  expect(throughBushMs).toBeGreaterThan(420);
  expect(throughBushMs).toBeGreaterThan(throughGrassMs * 1.45);
  expect(throughGrassMs).toBeGreaterThan(150);
  expect(errors).toEqual([]);
});
