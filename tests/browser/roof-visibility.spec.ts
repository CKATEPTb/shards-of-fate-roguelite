import { expect, test, type Page } from '@playwright/test';
import type { GridPoint } from '@shards/shared';
import { createExpedition } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { tileToScreen } from '../../apps/client/src/world/projection';
import { cameraView, clearFixtureEnemies, clickTile, expectActorPosition, loadExpeditionFixture, loadPartyAt, ready } from './world-helpers';

async function painted(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function roofPixels(page: Page) {
  const point = tileToScreen({ x: 9, y: 8 }, await cameraView(page));
  return page.locator('.world-surface canvas').evaluate((element, location) => {
    const canvas = element as HTMLCanvasElement;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.round(location.x * canvas.width / bounds.width);
    const y = Math.round(location.y * canvas.height / bounds.height);
    // Sample the tile center, away from the hover outline at its edges.
    return Array.from(canvas.getContext('2d')!.getImageData(x - 2, y - 2, 5, 5).data);
  }, point);
}

/** Phaser's animated lighting can move a few colour values between frames.
 * The roof must remain the same opaque surface while hovering; compare the
 * rendered sample with a small per-channel tolerance instead of requiring a
 * byte-for-byte match to an animation frame. */
function expectOpaqueRoofSample(before: number[], after: number[]) {
  expect(after).toHaveLength(before.length);
  for (let index = 0; index < before.length; index += 4) {
    expect(after[index + 3]).toBe(255);
    expect(Math.abs(after[index] - before[index])).toBeLessThanOrEqual(16);
    expect(Math.abs(after[index + 1] - before[index + 1])).toBeLessThanOrEqual(16);
    expect(Math.abs(after[index + 2] - before[index + 2])).toBeLessThanOrEqual(16);
  }
}

/** Restore exact legal cells to compare the same house geometry across entries. */
async function loadPartyPositions(page: Page, positions: GridPoint[]) {
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  state.world.actors = state.world.actors.map((actor, index) => ({ ...actor, position: positions[index], path: [] }));
  clearFixtureEnemies(state);
  await loadExpeditionFixture(page, state);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectActorPosition(page, positions[0]);
  await painted(page);
}

test('a house keeps its roof on hover, reveals a hero at the doorway and closes after they leave', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  // The hero begins outside the doorway.
  await loadPartyAt(page, { x: 8, y: 11 });
  const host = page.getByTestId('world-canvas');
  await expect(host).toHaveAttribute('data-visual-actor-y', '368');
  await page.mouse.move(850, 600);
  await painted(page);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '0');
  const closed = await roofPixels(page);
  const interior = tileToScreen({ x: 9, y: 8 }, await cameraView(page));
  await page.mouse.move(interior.x, interior.y);
  await painted(page);
  expectOpaqueRoofSample(closed, await roofPixels(page));
  await page.screenshot({ path: 'test-results/roof-closed-on-hover.png' });

  // Only the controlled hero moves. Allies stay outside, and the guardian's
  // feet are still below the interior boundary (288), but the head is under the eave.
  await clickTile(page, { x: 8, y: 9 });
  await expectActorPosition(page, { x: 8, y: 9 });
  await expect(host).toHaveAttribute('data-visual-actor-y', '304');
  await painted(page);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '1');
  await expect(host).toHaveAttribute('data-exterior-hero-reveals', '0');
  expect(await roofPixels(page)).not.toEqual(closed);
  await page.screenshot({ path: 'test-results/roof-open-at-doorway.png' });

  await clickTile(page, { x: 9, y: 8 });
  await expectActorPosition(page, { x: 9, y: 8 });
  await expect(host).toHaveAttribute('data-visual-actor-y', '272');
  await painted(page);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '1');
  expect(await roofPixels(page)).not.toEqual(closed);
  await page.screenshot({ path: 'test-results/roof-open-inside.png' });

  await clickTile(page, { x: 8, y: 11 });
  await expectActorPosition(page, { x: 8, y: 11 });
  await expect(host).toHaveAttribute('data-visual-actor-y', '368');
  const hoveredAgain = tileToScreen({ x: 9, y: 8 }, await cameraView(page));
  await page.mouse.move(hoveredAgain.x, hoveredAgain.y);
  await painted(page);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '0');
  expectOpaqueRoofSample(closed, await roofPixels(page));
});

for (const [side, position] of [
  ['north', { x: 9, y: 6 }],
  ['east', { x: 11, y: 8 }],
] as const) {
  test(`a hero outside the ${side} wall remains visible without opening the house`, async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await loadPartyAt(page, side === 'north' ? { x: 9, y: 4 } : position);
    const host = page.getByTestId('world-canvas');
    if (side === 'north') {
      // A planned route under the roof's screen silhouette must not reveal its room.
      const watchedRoof = await host.evaluateHandle(element => {
        let opened = false;
        const observer = new MutationObserver(() => { opened ||= Number(element.getAttribute('data-revealed-house-roofs')) > 0; });
        observer.observe(element, { attributes: true, attributeFilter: ['data-revealed-house-roofs'] });
        return { stop: () => { observer.disconnect(); return opened; } };
      });
      await clickTile(page, position);
      await expectActorPosition(page, position);
      await expect(host).toHaveAttribute('data-visual-actor-y', String((position.y + 0.5) * 32));
      expect(await watchedRoof.evaluate(watched => watched.stop())).toBe(false);
      await watchedRoof.dispose();
    }
    await expect(host).toHaveAttribute('data-visual-actor-y', String((position.y + 0.5) * 32));
    await page.mouse.move(850, 600);
    await painted(page);
    // Actual rendered roofs stay opaque; only the covered parts of the heroes
    // are copied above them. Unrelated roof pixels must not react to hovering.
    await expect(host).toHaveAttribute('data-revealed-house-roofs', '0');
    await expect(host).toHaveAttribute('data-exterior-hero-reveals', /[1-9]\d*/);
    const closed = await roofPixels(page);
    const interior = tileToScreen({ x: 9, y: 8 }, await cameraView(page));
    await page.mouse.move(interior.x, interior.y);
    await painted(page);
    await expect(host).toHaveAttribute('data-revealed-house-roofs', '0');
    expectOpaqueRoofSample(closed, await roofPixels(page));
    await page.screenshot({ path: `test-results/roof-exterior-${side}.png` });
  });
}

test('separate houses only reveal their own interior when the local hero enters', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const host = page.getByTestId('world-canvas');
  await loadPartyPositions(page, [{ x: 8, y: 8 }]);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '1');
  await expect(host).toHaveAttribute('data-exterior-hero-reveals', '0');
  await loadPartyPositions(page, [{ x: 9, y: 6 }]);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '0');
  await expect(host).toHaveAttribute('data-exterior-hero-reveals', /[1-9]\d*/);
  await loadPartyPositions(page, [{ x: 25, y: 24 }]);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '1');
  await expect(host).toHaveAttribute('data-exterior-hero-reveals', '0');
  await loadPartyPositions(page, [{ x: 9, y: 6 }]);
  await expect(host).toHaveAttribute('data-revealed-house-roofs', '0');
  await expect(host).toHaveAttribute('data-exterior-hero-reveals', /[1-9]\d*/);
});
