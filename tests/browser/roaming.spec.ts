import { expect, test, type Page } from '@playwright/test';
import { createExpedition, stepExpedition } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { tileToScreen } from '../../apps/client/src/world/projection';
import { cameraView, clickTile, expectActorPosition, loadExpeditionFixture, ready, saveExpeditionFixture } from './world-helpers';
import { formationPoints } from '../../packages/game-core/src/roaming/navigation';

const heroPoint = { x: 23, y: 10 };
const mobPoint = { x: 23, y: 4 };

const mobFrames = async (page: Page): Promise<{ id: string; groupId: string; labelVisible: boolean; labelText: string }[]> =>
  JSON.parse((await page.getByTestId('world-canvas').getAttribute('data-mob-frames'))!);

function fixture() {
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  state.world.actors = state.world.actors.map(actor => ({ ...actor, position: { ...heroPoint }, path: [] }));
  const group = state.roaming!.chunks['0,0'][0];
  // A real generated solo scout, held still while inspecting its live combat odds.
  expect(group.members).toHaveLength(1);
  group.home = { ...mobPoint }; group.pauseMs = 60_000;
  group.members[0].position = { ...mobPoint };
  state.roaming!.chunks['0,0'] = [group];
  return state;
}

async function loadFixture(page: Page, state = fixture()) {
  await loadExpeditionFixture(page, state);
  await expectActorPosition(page, heroPoint);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-mob-frames', /goblin_scout/);
}

async function inspectScout(page: Page, touch: boolean) {
  const groupId = (await mobFrames(page))[0].groupId;
  const view = await cameraView(page);
  const screen = tileToScreen(mobPoint, view);
  const point = { x: screen.x, y: screen.y - 18 * view.zoom };
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.move(point.x, point.y);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-inspected-group', groupId);
  await expect(page.getByTestId('encounter-preview')).toHaveCount(0);
  await expect.poll(async () => (await mobFrames(page)).some(mob => mob.groupId === groupId
    && mob.labelVisible && /^\d+%$/.test(mob.labelText)), { timeout: 15_000 }).toBe(true);
  await expectActorPosition(page, heroPoint);
}

test('animated patrols, inspection, five-tile pursuit and one-tile battle use the same enemies', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const host = page.getByTestId('world-canvas');
  await expect(host).toHaveAttribute('data-mob-frames', /goblin_scout/);
  const positions = async () => JSON.parse((await host.getAttribute('data-mob-frames'))!).map((mob: { x: number; y: number }) => [mob.x, mob.y]);
  const first = await positions();
  await expect.poll(positions, { timeout: 10_000 }).not.toEqual(first);
  await expect(page.getByTestId('encounter-preview')).toHaveCount(0);
  await loadFixture(page);
  await page.mouse.move(800, 700);
  await expect.poll(async () => (await mobFrames(page)).some(mob => mob.labelVisible && /^\d+%$/.test(mob.labelText)), { timeout: 15_000 }).toBe(true);
  await expect(page.getByTestId('encounter-preview')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/roaming-passive-percent.png' });
  await inspectScout(page, false);
  await page.screenshot({ path: 'test-results/roaming-hover.png' });
  await page.mouse.move(800, 700);
  await expect(host).toHaveAttribute('data-inspected-group', '');
  await expect(page.getByTestId('encounter-preview')).toHaveCount(0);
  await clickTile(page, { x: 23, y: 9 });
  await expect(host).toHaveAttribute('data-mob-frames', /"mode":"chase"/);
  await expect(page.getByRole('region', { name: 'Боевая встреча' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/roaming-chase.png' });
  await expect(page.getByRole('region', { name: 'Боевая встреча' })).toBeVisible();
  await expect(page.getByTestId('encounter-preview')).toHaveCount(0);
  const battle = await saveExpeditionFixture(page);
  expect(battle.combat!.enemyIds).toEqual(['goblin_scout']);
  expect(battle.combat!.characterIds).toEqual(['guardian']);
  await page.getByRole('button', { name: '4×', exact: true }).click();
  if (!['victory', 'defeat', 'draw'].includes(battle.combat!.status)) {
    await page.getByRole('button', { name: /^(Начать бой|Продолжить)$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Победа', exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Продолжить путь', exact: true }).click();
  await expect(page.locator('.game-notice')).toHaveCount(0);
  await expect(host).toHaveAttribute('data-mob-frames', '[]');
  await expectActorPosition(page, { x: 23, y: 9 });
  expect(errors).toEqual([]);
});

test('each member shows its pack chance without hover and closed houses never leak enemy labels', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await ready(page);
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  state.world.actors = state.world.actors.map(actor => ({ ...actor, position: { ...heroPoint }, path: [] }));
  const group = state.roaming!.chunks['0,0'].find(candidate => candidate.members.length === 2)!;
  group.home = { ...mobPoint }; group.pauseMs = 60_000;
  group.members = group.members.map((member, index) => ({ ...member, position: { x: mobPoint.x + index, y: mobPoint.y } }));
  state.roaming!.chunks['0,0'] = [group];
  await loadExpeditionFixture(page, state);
  await page.mouse.move(800, 700);
  await expect.poll(async () => (await mobFrames(page)).filter(mob => mob.labelVisible && /^\d+%$/.test(mob.labelText)).length,
    { timeout: 15_000 }).toBe(2);
  expect(new Set((await mobFrames(page)).map(mob => mob.labelText)).size).toBe(1);
  await expect(page.getByTestId('encounter-preview')).toHaveCount(0);

  const hidden = fixture();
  hidden.world.actors = hidden.world.actors.map(actor => ({ ...actor, position: { x: 9, y: 4 } }));
  const indoor = hidden.roaming!.chunks['0,0'][0];
  indoor.home = { x: 8, y: 8 };
  indoor.members[0].position = { ...indoor.home };
  await loadExpeditionFixture(page, hidden);
  await expectActorPosition(page, { x: 9, y: 4 });
  await expect.poll(async () => (await mobFrames(page)).every(mob => !mob.labelVisible)).toBe(true);
  const view = await cameraView(page);
  const foot = tileToScreen(indoor.home, view);
  await page.mouse.move(foot.x, foot.y - 18 * view.zoom);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-inspected-group', '');
  await expect(page.getByTestId('encounter-preview')).toHaveCount(0);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-revealed-house-roofs', '0');
});

test.describe('touch mob inspection', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('a short mob tap inspects without moving, then a ground tap resumes walking', async ({ page }) => {
    await ready(page);
    await loadFixture(page);
    await inspectScout(page, true);
    await page.waitForTimeout(400);
    await expectActorPosition(page, heroPoint);
    await page.screenshot({ path: 'test-results/roaming-touch.png' });
    await clickTile(page, { x: 24, y: 10 }, true);
    await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-inspected-group', '');
    await expect(page.getByTestId('encounter-preview')).toHaveCount(0);
    await expectActorPosition(page, { x: 24, y: 10 });
  });
});

test('a large encounter includes distant pursuers and fits desktop and phone with every enemy', async ({ page }) => {
  const state = createExpedition('CROWDED-19', ['guardian'], gameContent);
  const heroes = state.world.actors[0].position;
  const enemies = { x: heroes.x, y: heroes.y - 1 };
  state.world.actors = state.world.actors.map(actor => ({ ...actor, position: { ...heroes } }));
  const distant = formationPoints(state.world.chunk, enemies, 35).find(point => Math.hypot(point.x - heroes.x, point.y - heroes.y) > 10)!;
  expect(distant).toBeDefined();
  for (const [index, group] of state.roaming!.chunks['0,0'].entries()) {
    group.home = { ...(index ? distant : enemies) };
    group.members = group.members.map(mob => ({ ...mob, position: { ...group.home } }));
    if (index) { group.mode = 'chase'; group.targetActorId = state.world.actors[0].id; }
  }
  const battle = stepExpedition(state, gameContent, 40);
  expect(battle.combat?.enemyIds).toHaveLength(13);
  await ready(page);
  await loadExpeditionFixture(page, battle);
  await expect(page.getByRole('region', { name: 'Боевая встреча' })).toBeVisible();
  await expect(page.locator('.combat-scene canvas')).toBeVisible();
  await expect(page.locator('.enemy-status')).toHaveCount(13);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const list = (await page.getByLabel('Противники', { exact: true }).boundingBox())!;
    expect(list.y + list.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: `test-results/roaming-large-${viewport.width}.png` });
  }
});
