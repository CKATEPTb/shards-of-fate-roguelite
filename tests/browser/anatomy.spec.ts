import { expect, test } from '@playwright/test';
import { createExpedition } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { clearFixtureEnemies, clickTile, expectActorPosition, loadExpeditionFixture, ready, saveExpeditionFixture, sessionStorageKey, startNewGame, storeExpeditionFixture } from './world-helpers';

function woundedParty() {
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  clearFixtureEnemies(state);
  const body = state.world.actors[0].body!;
  body.leftArm.current = 0; body.leftLeg.current = 0; body.head.current = 12; body.torso.current = 32;
  return state;
}

test('wounds remain visible after load; clicking fire approaches and rests without replacing lost limbs', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const state = woundedParty(); state.world.actors[0].position = { x: 17, y: 15 };
  await loadExpeditionFixture(page, state);
  const hero = page.getByTestId('hero-info-guardian');
  await expect(hero.locator('[data-body-part]')).toHaveCount(6);
  await expect(hero.locator('[data-body-part="torso"]')).toHaveAttribute('data-current', '32');
  await page.screenshot({ path: 'test-results/anatomy-wounded-world.png' });
  await clickTile(page, { x: 17, y: 17 });
  await expect(page.getByRole('dialog', { name: 'У костра' })).toBeVisible();
  await expectActorPosition(page, { x: 17, y: 16 });
  await page.getByRole('button', { name: /Отдохнуть/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(hero.locator('[data-body-part="head"]')).toHaveAttribute('data-current', '28');
  await expect(hero.locator('[data-body-part="torso"]')).toHaveAttribute('data-current', '64');
  await expect(hero.locator('[data-body-part="leftArm"]')).toHaveAttribute('data-current', '0');
  await expect(hero.locator('[data-body-part="leftLeg"]')).toHaveAttribute('data-current', '0');
  await expect(page.getByTestId('hero-info-priest')).toHaveCount(0);
  const saved = await saveExpeditionFixture(page);
  expect(saved.world.actors[0].body!.leftLeg.current).toBe(0);
  expect(saved.world.actors[0].body!.head.current).toBe(28);
  expect(errors).toEqual([]);
});

test.describe('touch anatomy and movement poses', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('shows readable resources and partial equipment; a crawling hero can rest by tap', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await ready(page);
    const state = woundedParty(); state.world.actors[0].body!.rightLeg.current = 0;
    await loadExpeditionFixture(page, state);
    await page.screenshot({ path: 'test-results/anatomy-crawling-mobile.png' });
    await page.getByRole('button', { name: 'Экипировка', exact: true }).tap();
    const details = page.locator('.loadout-condition .body-status-detailed');
    await expect(details).toBeVisible();
    await expect(details.locator('[data-body-part]')).toHaveCount(6);
    await page.screenshot({ path: 'test-results/anatomy-loadout-mobile.png' });
    const panel = page.locator('.loadout-panel'); const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await page.getByRole('button', { name: 'Экипировка', exact: true }).tap();
    await clickTile(page, { x: 17, y: 17 }, true);
    await expect(page.getByRole('dialog', { name: 'У костра' })).toBeVisible();
    await page.getByRole('button', { name: /Отдохнуть/ }).tap();
    await expect(page.getByTestId('hero-info-guardian').locator('[data-body-part="rightLeg"]')).toHaveAttribute('data-current', '0');
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
    expect(errors).toEqual([]);
  });
});

test('a fallen hero checkpoint cannot be resumed and a new session starts with a healthy body', async ({ page }) => {
  await ready(page);
  const state = woundedParty(); state.world.actors[0].body!.head.current = 0;
  await storeExpeditionFixture(page, state);
  await page.reload();
  await expect(page.getByRole('button', { name: /^Продолжить/ })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), sessionStorageKey)).toBeNull();
  await startNewGame(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('hero-info-guardian').locator('[data-body-part="head"]')).toHaveAttribute('data-current', '28');
  await expectActorPosition(page, { x: 17, y: 16 });
});
