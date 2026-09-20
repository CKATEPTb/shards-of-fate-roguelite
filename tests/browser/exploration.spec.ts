import { expect, test, type Page } from '@playwright/test';
import { generateChunk, generateWorld } from '@shards/game-core';
import { tileToScreen } from '../../apps/client/src/world/projection';
import { cameraView, clickTile, crossFirstCampNorthGate, expectActorPosition, expectFullViewport, firstCampSpawn, loadBattleFixture, loadExpeditionFixture, loadPartyAt, ready, reloadCheckpoint, saveExpeditionFixture, sessionStorageKey } from './world-helpers';

async function openMenu(page: Page) { await page.getByRole('button', { name: 'Меню', exact: true }).click(); }
async function saveGame(page: Page) {
  return saveExpeditionFixture(page);
}
async function finishBattle(page: Page) {
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.getByRole('button', { name: /^(Начать бой|Продолжить)$/ }).click();
  await expect(page.getByRole('heading', { name: 'Победа', exact: true })).toBeVisible({ timeout: 45_000 });
}

test('real map clicks move the hero, reject obstacles and save/restore exploration without page scrolling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await loadPartyAt(page, firstCampSpawn);
  await clickTile(page, { x: 19, y: 18 });
  await expectActorPosition(page, { x: 19, y: 18 });
  const saved = await saveGame(page);
  expect(saved.world.actors[0].position).toEqual({ x: 19, y: 18 });
  const chunk = generateChunk(generateWorld('FIRST-CAMPFIRE'), '0,0');
  const blockers = chunk.tiles.map((tile, index) => ({ tile, point: { x: index % chunk.size, y: Math.floor(index / chunk.size) } }))
    .filter(({ tile, point }) => !tile.walkable && Math.abs(point.x - 19) < 5 && Math.abs(point.y - 18) < 5);
  expect(blockers.length).toBeGreaterThan(0);
  await clickTile(page, blockers[0].point);
  await expect(page.locator('.game-notice')).toHaveCount(0);
  await expectActorPosition(page, { x: 19, y: 18 });
  await clickTile(page, { x: 17, y: 19 });
  await expectActorPosition(page, { x: 17, y: 19 });
  await reloadCheckpoint(page);
  await expectActorPosition(page, { x: 19, y: 18 });
  expect((await saveGame(page)).world).toEqual(saved.world);
  await page.evaluate(key => localStorage.setItem(key, '{broken-json'), sessionStorageKey);
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Продолжить/ })).toBeDisabled();
  await loadExpeditionFixture(page, saved);
  expect((await saveGame(page)).world).toEqual(saved.world);
  expect(errors).toEqual([]);
});

test('walking through a terrain exit transfers the session hero and centers the camera', async ({ page }) => {
  await ready(page);
  await crossFirstCampNorthGate(page);
  const saved = await saveGame(page);
  expect(saved.world.visited).toEqual(['0,0', '0,-1']);
  expect(saved.world.transitions).toBe(1);
  expect(saved.world.actors).toHaveLength(1);
  for (const actor of saved.world.actors) {
    expect(actor.path).toEqual([]);
    expect(actor.position.y).toBeGreaterThanOrEqual(30);
    expect(actor.position.y).toBeLessThan(34);
  }
  await page.waitForTimeout(350);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-chunk-id', '0,-1');
  const view = await cameraView(page);
  const actorOnScreen = tileToScreen(saved.world.actors[0].position, view);
  const canvasBounds = (await page.getByTestId('world-canvas').boundingBox())!;
  expect(actorOnScreen.x).toBeGreaterThan(0);
  expect(actorOnScreen.x).toBeLessThan(canvasBounds.width);
  expect(actorOnScreen.y).toBeGreaterThan(0);
  expect(actorOnScreen.y).toBeLessThan(canvasBounds.height);
  await expectFullViewport(page);
  await expect(page.getByTestId('actor-position')).toHaveAttribute('data-y', String(-35 + saved.world.actors[0].position.y - 17));
});

test('map encounters pause, step, restore, replay and return to the same world', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const initialBattle = await loadBattleFixture(page);
  await page.getByRole('button', { name: 'Начать бой', exact: true }).click();
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.getByRole('button', { name: 'Выполнить один ход', exact: true }).click();
  const saved = await saveGame(page);
  expect(saved.combat!.characterIds).toEqual(['guardian']);
  await page.waitForTimeout(400);
  expect((await saveGame(page)).combat!.turn).toBe(saved.combat!.turn);
  await page.getByRole('button', { name: 'Выполнить один ход', exact: true }).click();
  await reloadCheckpoint(page);
  expect((await saveGame(page)).combat).toEqual(saved.combat);
  await finishBattle(page);
  const firstResult = (await saveGame(page)).combat;
  await page.getByRole('button', { name: 'Продолжить путь', exact: true }).click();
  await expectActorPosition(page, initialBattle.world.actors[0].position);
  const explored = await saveGame(page);
  expect(explored.roaming!.chunks['0,0']).toEqual([]);
  expect(explored.roaming!.active).toBeNull();
  await loadExpeditionFixture(page, initialBattle);
  await finishBattle(page);
  expect((await saveGame(page)).combat).toEqual(firstResult);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 740 }]) {
  test.describe(`touch viewport ${viewport.width}`, () => {
  test.use({ viewport, hasTouch: true });
  test(`game fills ${viewport.width}x${viewport.height}, keeps overlays inside it and accepts taps`, async ({ page }) => {
    await ready(page);
    await expectFullViewport(page);
    await clickTile(page, { x: 19, y: 18 }, true);
    await expectActorPosition(page, { x: 19, y: 18 });
    for (const removed of ['Герои', 'Журнал', 'Карта', 'Камера к герою']) await expect(page.getByRole('button', { name: removed, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Меню', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const bounds = (await page.getByRole('dialog').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.getByRole('checkbox', { name: /Меньше движения/ }).check();
    await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
    const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, innerWidth, innerHeight }));
    expect(size.width).toBeLessThanOrEqual(size.innerWidth);
    expect(size.height).toBeLessThanOrEqual(size.innerHeight);
    await page.mouse.wheel(0, 500);
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
    await page.screenshot({ path: `test-results/map-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await crossFirstCampNorthGate(page, true);
    const position = await page.getByTestId('world-canvas').evaluate(element => ({ x: Number((element as HTMLElement).dataset.actorX), y: Number((element as HTMLElement).dataset.actorY) }));
    await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-visual-actor-x', String((position.x + 0.5) * 32));
    await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-visual-actor-y', String((position.y + 0.5) * 32));
    const view = await cameraView(page);
    const actorOnScreen = tileToScreen(position, view);
    const canvasBounds = (await page.getByTestId('world-canvas').boundingBox())!;
    expect(actorOnScreen.x).toBeGreaterThan(0);
    expect(actorOnScreen.x).toBeLessThan(canvasBounds.width);
    expect(actorOnScreen.y).toBeGreaterThan(0);
    expect(actorOnScreen.y).toBeLessThan(canvasBounds.height);
    await expectFullViewport(page);
    await page.screenshot({ path: `test-results/map-gate-${viewport.width}x${viewport.height}.png`, fullPage: true });
  });
  });
}
