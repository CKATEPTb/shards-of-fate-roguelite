import { expect, test } from '@playwright/test';
import { generateChunk, generateWorld } from '@shards/game-core';
import type { GridPoint } from '@shards/shared';
import { clickTile, expectActorPosition, firstCampSpawn, ready } from './world-helpers';

test('campfire interaction stays beside the flames and movement to its far side walks around them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const fire = { x: 17, y: 17 };
  await expectActorPosition(page, firstCampSpawn);
  // Global coordinates remain anchored to the fire, not the shifted spawn.
  await expect(page.getByTestId('actor-position')).toHaveAttribute('data-x', '0');
  await expect(page.getByTestId('actor-position')).toHaveAttribute('data-y', '-1');
  await clickTile(page, fire);
  await expect(page.getByRole('dialog', { name: 'У костра' })).toBeVisible();
  await expect(page.locator('.game-notice')).toHaveCount(0);
  await expectActorPosition(page, firstCampSpawn);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.game-notice')).toHaveCount(0);
  await expectActorPosition(page, firstCampSpawn);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Observe actual simulated steps from the canvas host; the final position alone would
  // also pass if the hero had walked directly through the fire.
  const host = page.getByTestId('world-canvas');
  await host.evaluate(element => {
    const host = element as HTMLElement;
    const read = () => ({ x: Number(host.dataset.actorX), y: Number(host.dataset.actorY) });
    const positions = [read()];
    const observer = new MutationObserver(() => {
      const current = read(); const previous = positions.at(-1)!;
      if (current.x !== previous.x || current.y !== previous.y) positions.push(current);
      host.dataset.walkTrace = JSON.stringify(positions);
    });
    host.dataset.walkTrace = JSON.stringify(positions);
    observer.observe(host, { attributes: true, attributeFilter: ['data-actor-x', 'data-actor-y'] });
  });
  const target = { x: 17, y: 18 };
  await clickTile(page, target);
  await expectActorPosition(page, target);
  const positions: GridPoint[] = JSON.parse((await host.getAttribute('data-walk-trace'))!);
  expect(positions[0]).toEqual(firstCampSpawn);
  expect(positions.at(-1)).toEqual(target);
  expect(positions).toHaveLength(5);
  expect(positions.some(point => point.x !== fire.x)).toBe(true);
  const chunk = generateChunk(generateWorld('FIRST-CAMPFIRE'), '0,0');
  for (let index = 0; index < positions.length; index++) {
    const point = positions[index];
    expect(point).not.toEqual(fire);
    expect(chunk.tiles[point.y * chunk.size + point.x].walkable).toBe(true);
    if (index > 0) expect(Math.abs(point.x - positions[index - 1].x) + Math.abs(point.y - positions[index - 1].y)).toBe(1);
  }
  expect(errors).toEqual([]);
});
