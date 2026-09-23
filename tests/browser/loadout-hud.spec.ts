import { expect, test, type Locator, type Page } from '@playwright/test';
import { findPath, generateChunk, generateWorld } from '@shards/game-core';
import { tileToScreen } from '../../apps/client/src/world/projection';
import { cameraView, clickTile, expectActorPosition, expectFullViewport, loadBattleFixture, loadPartyAt, ready } from './world-helpers';

const armor = ['helmet', 'chest', 'gloves', 'pants', 'boots'];
const accessories = ['amulet', 'ring1', 'ring2', 'rightHand', 'leftHand'];
const skills = ['class', 'characterActive', 'passive', 'extra1', 'extra2'];

async function activate(locator: Locator, touch = false) {
  if (touch) await locator.tap();
  else await locator.click();
}

async function openLoadout(page: Page, touch = false) {
  const toggle = page.getByTestId('loadout-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await activate(toggle, touch);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('loadout-panel')).toBeVisible();
}

async function hoverSlot(page: Page, id: string) {
  const slot = page.getByTestId(`loadout-slot-${id}`);
  await slot.hover();
  await expect(slot).toHaveAttribute('aria-describedby', 'loadout-tooltip');
  const tooltip = page.getByTestId('loadout-tooltip');
  await expect(tooltip).toBeVisible();
  return tooltip;
}

async function expectStableHover(slot: Locator) {
  const samples = await slot.evaluate(async element => {
    const visible: boolean[] = [];
    for (let frame = 0; frame < 8; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const bounds = element.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      visible.push(hit?.closest('[data-loadout-slot]') === element && element.hasAttribute('aria-describedby'));
    }
    return visible;
  });
  expect(samples).toEqual(Array(8).fill(true));
}

test('equipment starts collapsed and preserves ordered slots and actual hero abilities', async ({ page }) => {
  await ready(page);
  const toggle = page.getByTestId('loadout-toggle');
  await expect(toggle).toHaveAccessibleName('Экипировка');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('loadout-panel')).toHaveCount(0);
  await expect(page.getByTestId('loadout-tooltip')).toHaveCount(0);
  await expect(page.locator('button')).toHaveCount(2);
  for (const removed of ['Карта', 'Герои', 'Журнал', 'Камера к герою']) await expect(page.getByRole('button', { name: removed, exact: true })).toHaveCount(0);
  await openLoadout(page);
  for (const [testId, ids] of [['armor-slots', armor], ['accessories-slots', accessories], ['skill-slots', skills]] as const) {
    const list = page.getByTestId(testId);
    await expect(list.locator('li')).toHaveCount(ids.length);
    await expect(list.getByRole('button')).toHaveCount(ids.length);
    expect(await list.locator('[data-loadout-slot]').evaluateAll(elements => elements.map(element => element.getAttribute('data-loadout-slot')))).toEqual(ids);
  }
  for (const id of [...armor, 'rightHand', 'leftHand']) {
    await expect(page.getByTestId(`loadout-slot-${id}`)).toHaveAttribute('data-empty', 'false');
    await expect(page.getByTestId(`loadout-slot-${id}`)).toHaveAttribute('data-equipment-condition', 'active');
  }
  for (const id of ['amulet', 'ring1', 'ring2', 'extra1', 'extra2']) await expect(page.getByTestId(`loadout-slot-${id}`)).toHaveAttribute('data-empty', 'true');
  await expect(page.getByTestId('loadout-panel').locator('[data-body-part]')).toHaveCount(6);
  for (const id of ['belt', 'race']) await expect(page.getByTestId(`loadout-slot-${id}`)).toHaveCount(0);
  const columns = await page.getByTestId('loadout-panel').locator('ol').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
  expect(columns[0]).toBeLessThan(columns[1]);
  expect(columns[1]).toBeLessThan(columns[2]);
  const hero = page.getByTestId('hero-info-guardian');
  const heroBounds = (await hero.boundingBox())!;
  await page.mouse.move(heroBounds.x + heroBounds.width / 2, heroBounds.y + heroBounds.height / 2);
  await expect(hero).toHaveAttribute('data-inspected', 'true');
  const role = await hoverSlot(page, 'class');
  await expect(hero).toHaveAttribute('data-inspected', 'false');
  await expect(role).toContainText('Вызов');
  await expect(role).toContainText('Привлекает атаки врагов на 3 хода.');
  await expect(role).toContainText('Перезарядка: 6 ходов');
  await expect(role).toContainText('Готово');
  await expect(page.getByTestId('loadout-slot-class')).toHaveAttribute('data-content-id', 'tank_taunt');
  const active = await hoverSlot(page, 'characterActive');
  await expect(active).toContainText('Несокрушимый бастион');
  await expect(active).toContainText('75% на 4 хода');
  await expect(active).toContainText('Перезарядка: 10 ходов');
  const passive = await hoverSlot(page, 'passive');
  await expect(passive).toContainText('Стойкая защита');
  await expect(passive).toContainText('включая самого Стража, на 25%');
  await expect(passive).toContainText('Постоянный эффект');
  const shield = await hoverSlot(page, 'leftHand');
  await expect(shield).toContainText('Экипировано');
  await expect(shield).toContainText('Левая рука');
  const empty = await hoverSlot(page, 'amulet');
  await expect(empty).toContainText('Амулет');
  await expect(empty).toContainText('Предмет не экипирован.');
  await page.mouse.move(720, 500);
  await expect(page.getByTestId('loadout-tooltip')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('loadout-panel')).toHaveCount(0);
});

test('three columns and descriptions fit desktop, mobile and short landscape screens', async ({ page }, testInfo) => {
  await ready(page);
  for (const viewport of [
    { width: 1440, height: 1000, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' },
    { width: 320, height: 740, name: 'small-mobile' }, { width: 844, height: 390, name: 'landscape' },
    { width: 320, height: 480, name: 'short-mobile' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect.poll(async () => (await cameraView(page)).width).toBe(viewport.width);
    await expectFullViewport(page);
    await openLoadout(page);
    const panel = (await page.getByTestId('loadout-panel').boundingBox())!;
    const toggle = (await page.getByTestId('loadout-toggle').boundingBox())!;
    const menu = (await page.getByRole('button', { name: 'Меню', exact: true }).boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
    expect(panel.y + panel.height).toBeLessThanOrEqual(toggle.y);
    expect(toggle.x + toggle.width).toBeLessThan(menu.x);
    expect(toggle.y + toggle.height).toBeLessThanOrEqual(viewport.height);
    expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width);
    expect(menu.y + menu.height).toBeLessThanOrEqual(viewport.height);
    for (const id of [...armor, ...accessories, ...skills]) {
      const slot = page.getByTestId(`loadout-slot-${id}`);
      await slot.scrollIntoViewIfNeeded();
      const bounds = (await slot.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await expect(slot).toBeInViewport();
    }
    for (const id of ['helmet', 'characterActive', 'leftHand']) {
      const slot = page.getByTestId(`loadout-slot-${id}`);
      await hoverSlot(page, id);
      await expectStableHover(slot);
      await slot.click();
      const tooltip = page.getByTestId('loadout-tooltip');
      await expect(tooltip).toBeVisible();
      const bounds = (await tooltip.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(7.9);
      expect(bounds.y).toBeGreaterThanOrEqual(7.9);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 7.9);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 7.9);
      await page.getByRole('button', { name: 'Закрыть описание', exact: true }).click();
      await expect(tooltip).toHaveCount(0);
    }
    await page.getByTestId('loadout-slot-characterActive').click();
    await page.screenshot({ path: testInfo.outputPath(`loadout-${viewport.name}.png`) });
    await page.getByTestId('loadout-toggle').click();
  }
});

for (const touch of [false, true]) {
  test.describe(touch ? 'loadout touch surface' : 'loadout mouse surface', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: touch });
    test('slots capture clicks and descriptions while outside ground still moves the hero', async ({ page }) => {
      await ready(page);
      const start = { x: 4, y: 30 };
      await loadPartyAt(page, start);
      await openLoadout(page, touch);
      const chunk = generateChunk(generateWorld('FIRST-CAMPFIRE'), '0,0');
      const view = await cameraView(page);
      const slots = await page.getByTestId('loadout-panel').locator('[data-loadout-slot]').evaluateAll(elements => elements.map(element => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
      }));
      const candidates = chunk.tiles.flatMap((tile, index) => {
        const point = { x: index % chunk.size, y: Math.floor(index / chunk.size) };
        if (!tile.walkable || point.x <= 0 || point.y <= 0 || point.x >= chunk.size - 1 || point.y >= chunk.size - 1) return [];
        const screen = tileToScreen(point, view);
        const path = findPath(chunk, start, point);
        return path.length > 0 && !path.some(step => chunk.pois.some(poi => poi.kind === 'encounter' && poi.position.x === step.x && poi.position.y === step.y)) ? [{ point, screen, distance: path.length }] : [];
      }).sort((a, b) => a.distance - b.distance);
      const covered = candidates.find(candidate => slots.some(slot => candidate.screen.x > slot.left + 1 && candidate.screen.x < slot.right - 1 && candidate.screen.y > slot.top + 1 && candidate.screen.y < slot.bottom - 1));
      expect(covered).toBeDefined();
      expect(await page.evaluate(point => !!document.elementFromPoint(point.x, point.y)?.closest('[data-loadout-slot]'), covered!.screen)).toBe(true);
      if (touch) await page.touchscreen.tap(covered!.screen.x, covered!.screen.y);
      else await page.mouse.click(covered!.screen.x, covered!.screen.y);
      const tooltip = page.getByTestId('loadout-tooltip');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveAttribute('role', 'region');
      await activate(page.getByTestId('loadout-slot-class'), touch);
      await expect(tooltip).toContainText('Вызов');
      await activate(page.getByTestId('loadout-slot-leftHand'), touch);
      await expect(tooltip).toContainText('Экипировано');
      await expect(tooltip).toContainText('Левая рука');
      if (!touch) await page.mouse.move(380, 500);
      await expect(tooltip).toBeVisible();
      await activate(tooltip.locator('strong'), touch);
      // Allow one movement step: the reachable ground beneath the first slot must not receive the click.
      await page.waitForTimeout(400);
      await expectActorPosition(page, start);
      await activate(page.getByRole('button', { name: 'Закрыть описание', exact: true }), touch);
      await expect(tooltip).toHaveCount(0);
      await expect(page.getByTestId('loadout-panel')).toBeVisible();
      const panel = (await page.getByTestId('loadout-panel').boundingBox())!;
      const outside = candidates.find(({ screen }) => screen.x > 10 && screen.x < view.width - 10 && screen.y > 160 && screen.y < view.height - 120
        && (screen.x > panel.x + panel.width + 8 || screen.y < panel.y - 8));
      expect(outside).toBeDefined();
      await clickTile(page, outside!.point, touch);
      await expectActorPosition(page, outside!.point);
      await expect(page.getByTestId('loadout-panel')).toBeVisible();
      await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-actor-id', 'guardian');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await activate(page.getByTestId('loadout-toggle'), touch);
      await expect(page.getByTestId('loadout-panel')).toHaveCount(0);
    });
  });
}

test('keyboard opens equipment and descriptions, and Escape restores toggle focus', async ({ page }) => {
  await ready(page);
  const toggle = page.getByTestId('loadout-toggle');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('loadout-panel')).toBeVisible();
  const slot = page.getByTestId('loadout-slot-class');
  await slot.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('loadout-tooltip')).toContainText('Вызов');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('loadout-panel')).toHaveCount(0);
  await expect(page.getByTestId('loadout-tooltip')).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('loadout-panel')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('loadout-panel')).toHaveCount(0);
});

test('skill descriptions report remaining combat cooldown and menu keeps battle controls accessible', async ({ page }) => {
  await ready(page);
  await loadBattleFixture(page);
  await openLoadout(page);
  const slot = page.getByTestId('loadout-slot-characterActive');
  for (let step = 0; step < 8 && Number(await slot.getAttribute('data-cooldown')) === 0; step++) {
    await page.getByRole('button', { name: 'Выполнить один ход', exact: true }).click();
  }
  const remaining = Number(await slot.getAttribute('data-cooldown'));
  expect(remaining).toBeGreaterThan(0);
  await slot.click();
  await expect(page.getByTestId('loadout-tooltip')).toContainText(`Осталось: ${remaining}`);
  await expect(page.getByTestId('loadout-tooltip')).toContainText('Перезарядка: 10 ходов');
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await expect(page.getByTestId('loadout-tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выполнить один ход', exact: true })).toBeEnabled();
});
