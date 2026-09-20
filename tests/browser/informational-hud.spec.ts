import { expect, test, type Page } from '@playwright/test';
import { findPath, generateChunk, generateWorld } from '@shards/game-core';
import type { GridPoint } from '@shards/shared';
import { tileToScreen } from '../../apps/client/src/world/projection';
import { cameraView, clickTile, expectActorPosition, expectFullViewport, firstCampSpawn, loadBattleFixture, loadPartyAt, ready, saveExpeditionFixture } from './world-helpers';

/** A solo row is shorter than one zoomed tile; use its overlap with reachable ground. */
async function groundUnderPanel(page: Page, selector: string, start: GridPoint) {
  const bounds = (await page.locator(selector).boundingBox())!;
  const view = await cameraView(page);
  const chunk = generateChunk(generateWorld('FIRST-CAMPFIRE'), '0,0');
  const half = 16 * view.zoom;
  const candidates = chunk.tiles.flatMap((tile, index) => {
    const target = { x: index % chunk.size, y: Math.floor(index / chunk.size) };
    if (!tile.walkable) return [];
    const center = tileToScreen(target, view);
    const left = Math.max(bounds.x + 8, center.x - half + 4, 30);
    const right = Math.min(bounds.x + bounds.width - 8, center.x + half - 4);
    const top = Math.max(bounds.y + 8, center.y - half + 4, 25);
    const bottom = Math.min(bounds.y + bounds.height - 8, center.y + half - 4);
    const path = findPath(chunk, start, target);
    return right > left && bottom > top && path.length > 0
      ? [{ target, position: { x: (left + right) / 2, y: (top + bottom) / 2 }, length: path.length }] : [];
  }).sort((a, b) => a.length - b.length);
  expect(candidates.length).toBeGreaterThan(0);
  return candidates[0];
}

test('informational corner panels reveal details and pass clicks through without enabling camera dragging', async ({ page }) => {
  await ready(page);
  await expectFullViewport(page);
  await expect(page.locator('.location-hud, .travel-hint, .exit-shortcuts')).toHaveCount(0);
  await expect(page.locator('.party-hud button, .minimap-hud button')).toHaveCount(0);
  for (const scenario of [
    { selector: '.party-hud', start: { x: 4, y: 15 } },
    { selector: '.minimap-hud', start: { x: 30, y: 4 }, target: { x: 31, y: 2 } },
  ]) {
    await loadPartyAt(page, scenario.start);
    const panel = page.locator(scenario.selector);
    const bounds = (await panel.boundingBox())!;
    const ground = await groundUnderPanel(page, scenario.selector, scenario.start);
    const { target, position } = ground;
    expect(position.x).toBeGreaterThan(bounds.x);
    expect(position.x).toBeLessThan(bounds.x + bounds.width);
    expect(position.y).toBeGreaterThan(bounds.y);
    expect(position.y).toBeLessThan(bounds.y + bounds.height);
    await page.mouse.move(position.x, position.y);
    await expect(panel).toHaveAttribute('data-inspected', 'true');
    await expect(panel).toHaveCSS('opacity', '1');
    expect(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.tagName, position)).toBe('CANVAS');
    if (scenario.selector === '.party-hud') {
      const details = page.getByRole('tooltip');
      await expect(details).toBeVisible();
      const area = (await details.boundingBox())!;
      const detailPoint = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
      await page.mouse.move(detailPoint.x, detailPoint.y);
      await expect(details).toBeVisible();
      await expect(panel).toHaveAttribute('data-inspected', 'true');
      expect(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.tagName, detailPoint)).toBe('CANVAS');
      await page.mouse.move(position.x, position.y);
    }
    await page.mouse.click(position.x, position.y);
    await expectActorPosition(page, target);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('actor-position')).toHaveAttribute('data-x', String(target.x - 17));
    await expect(page.getByTestId('actor-position')).toHaveAttribute('data-y', String(target.y - 17));
    await page.waitForTimeout(400);
    const before = await cameraView(page);
    // A drag through the panel cancels its tap; it never detaches the camera.
    await page.mouse.move(position.x, position.y);
    await page.mouse.down();
    await page.mouse.move(position.x, position.y - 70, { steps: 8 });
    await page.mouse.up();
    const after = await cameraView(page);
    expect(Math.abs(after.scrollX - before.scrollX)).toBeLessThan(0.1);
    expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThan(0.1);
    await expectActorPosition(page, target);
    await page.mouse.move(720, 500);
    await expect(panel).toHaveAttribute('data-inspected', 'false');
    await expect.poll(async () => Number(await panel.evaluate(element => getComputedStyle(element).opacity))).toBeLessThan(1);
  }
});

test('number keys never switch the local hero and dialogs keep gameplay input paused', async ({ page }) => {
  await ready(page);
  const host = page.getByTestId('world-canvas');
  for (const key of ['1', '2', '3']) {
    await page.keyboard.press(key);
    await expect(host).toHaveAttribute('data-actor-id', 'guardian');
    await expectActorPosition(page, firstCampSpawn);
  }
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  for (const key of ['1', '2', '3', 'ArrowRight']) await page.keyboard.press(key);
  await expect(host).toHaveAttribute('data-actor-id', 'guardian');
  await expectActorPosition(page, firstCampSpawn);
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
  await clickTile(page, { x: 19, y: 18 });
  await expect(host).toHaveAttribute('data-actor-id', 'guardian');
  await expectActorPosition(page, { x: 19, y: 18 });
});

test('house interiors preserve movement and reveal coherent floors and walls under faded roofs', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await ready(page);
  await loadPartyAt(page, { x: 8, y: 9 });
  await clickTile(page, { x: 9, y: 8 });
  await expectActorPosition(page, { x: 9, y: 8 });
  await expect.poll(async () => Number(await page.getByTestId('world-canvas').getAttribute('data-occluded-props'))).toBeGreaterThan(0);
  await page.mouse.move(800, 550);
  await page.screenshot({ path: 'test-results/house-interior.png' });
});

test.describe('touch through informational HUD', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('a tap beneath the party rows reaches the ground', async ({ page }) => {
    await ready(page);
    const start = { x: 4, y: 15 };
    await loadPartyAt(page, start);
    const { position, target } = await groundUnderPanel(page, '.party-hud', start);
    const bounds = (await page.locator('.party-hud').boundingBox())!;
    expect(position.x).toBeGreaterThan(bounds.x);
    expect(position.x).toBeLessThan(bounds.x + bounds.width);
    expect(position.y).toBeGreaterThan(bounds.y);
    expect(position.y).toBeLessThan(bounds.y + bounds.height);
    await page.touchscreen.tap(position.x, position.y);
    await expectActorPosition(page, target);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('floating controls remain usable during combat and after saving', async ({ page }) => {
    await ready(page);
    await loadBattleFixture(page);
    await saveExpeditionFixture(page);
    await page.getByRole('button', { name: 'Выполнить один ход', exact: true }).click();
    const map = (await page.locator('.minimap-hud').boundingBox())!;
    const heading = (await page.locator('.combat-heading').boundingBox())!;
    const enemies = (await page.locator('.combat-enemies').boundingBox())!;
    expect(map.y + map.height).toBeLessThan(heading.y);
    expect(heading.y + heading.height).toBeLessThan(enemies.y);
    await page.screenshot({ path: 'test-results/combat-floating-hud-mobile.png' });
  });
});
