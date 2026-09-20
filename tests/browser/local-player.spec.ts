import { expect, test } from '@playwright/test';
import { createExpedition } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { TILE_SIZE, tileToScreen } from '../../apps/client/src/world/projection';
import { cameraView, clearFixtureEnemies, clickTile, expectActorPosition, loadExpeditionFixture, ready, saveExpeditionFixture, storeExpeditionFixture } from './world-helpers';

const fixture = (hero = 'guardian') => {
  const state = createExpedition('FIRST-CAMPFIRE', [hero], gameContent);
  clearFixtureEnemies(state);
  return state;
};

for (const touch of [false, true]) {
  test.describe(touch ? 'local hero touch movement' : 'local hero mouse movement', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: touch });
    test('clicks on the hero feet and upper sprite target the ground without selecting a character', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ready(page);
      const state = fixture();
      const actor = state.world.actors[0];
      for (const upperSprite of [false, true]) {
        await loadExpeditionFixture(page, state);
        const view = await cameraView(page);
        const foot = tileToScreen(actor.position, view);
        const point = { x: foot.x, y: foot.y - (upperSprite ? TILE_SIZE * view.zoom : 0) };
        const target = { x: actor.position.x, y: actor.position.y - (upperSprite ? 1 : 0) };
        expect(state.world.chunk.tiles[target.y * state.world.chunk.size + target.x].walkable).toBe(true);
        const bounds = (await page.getByTestId('world-canvas').boundingBox())!;
        if (touch) await page.touchscreen.tap(bounds.x + point.x, bounds.y + point.y);
        else await page.mouse.click(bounds.x + point.x, bounds.y + point.y);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-actor-id', 'guardian');
        await expectActorPosition(page, target);
        const saved = await saveExpeditionFixture(page);
        expect(saved.world.actors).toHaveLength(1);
        expect(saved.world.actors[0].position).toEqual(target);
      }
    });
  });
}

test('inspecting the hero information leaves movement assigned to that same local character', async ({ page }) => {
  await ready(page);
  const row = (await page.getByTestId('hero-info-guardian').boundingBox())!;
  await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2);
  await expect(page.getByTestId('hero-details-guardian')).toContainText('Страж');
  await expect(page.getByTestId('hero-info-priest')).toHaveCount(0);
  await clickTile(page, { x: 19, y: 18 });
  await expectActorPosition(page, { x: 19, y: 18 });
  expect((await saveExpeditionFixture(page)).world.actors.map(actor => actor.id)).toEqual(['guardian']);
});

test('a resumed priest remains the local player through number keys and movement', async ({ page }) => {
  await ready(page);
  await loadExpeditionFixture(page, fixture('priest'));
  for (const key of ['1', '2', '3']) await page.keyboard.press(key);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-actor-id', 'priest');
  await clickTile(page, { x: 19, y: 18 });
  await expectActorPosition(page, { x: 19, y: 18 });
  expect((await saveExpeditionFixture(page)).world.actors.map(actor => actor.id)).toEqual(['priest']);
});

test('a multiplayer engine snapshot cannot silently turn into a single-player session', async ({ page }) => {
  await ready(page);
  const state = createExpedition('FIRST-CAMPFIRE', ['priest', 'mage'], gameContent);
  await storeExpeditionFixture(page, state);
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Продолжить/ })).toBeDisabled();
  await expect(page.getByTestId('world-canvas')).toHaveCount(0);
});
