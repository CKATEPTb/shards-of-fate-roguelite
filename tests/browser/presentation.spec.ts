import { expect, test } from '@playwright/test';
import { cameraView, clickTile, expectActorPosition, ready, reloadCheckpoint } from './world-helpers';
import { tileToScreen } from '../../apps/client/src/world/projection';

test('directional animation and smooth camera following survive pause and ignored dragging', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const host = page.getByTestId('world-canvas');
  const initialFrame = await host.getAttribute('data-animation-frame');
  await expect(host).not.toHaveAttribute('data-animation-frame', initialFrame!);
  await host.evaluate(element => {
    const samples: { x: number; y: number; scrollX: number; frame: string }[] = [];
    const observer = new MutationObserver(() => {
      const data = (element as HTMLElement).dataset;
      samples.push({ x: Number(data.visualActorX), y: Number(data.visualActorY), scrollX: Number(data.cameraScrollX), frame: data.animationFrame! });
    });
    observer.observe(element, { attributes: true, attributeFilter: ['data-visual-actor-x', 'data-visual-actor-y'] });
    Object.assign(element, { motionSamples: samples, motionObserver: observer });
  });
  await clickTile(page, { x: 19, y: 18 });
  await expectActorPosition(page, { x: 19, y: 18 });
  await expect(host).toHaveAttribute('data-visual-actor-x', '624');
  await expect(host).toHaveAttribute('data-visual-actor-y', '592');
  const samples = await host.evaluate(element => {
    const observed = element as HTMLElement & { motionSamples: { x: number; y: number; scrollX: number; frame: string }[]; motionObserver: MutationObserver };
    observed.motionObserver.disconnect();
    return observed.motionSamples;
  });
  expect(new Set(samples.map(point => `${point.x},${point.y}`)).size).toBeGreaterThan(3);
  expect(samples.some(point => point.x % 32 !== 16 || point.y % 32 !== 16)).toBe(true);
  expect(samples.some(point => Math.abs(point.scrollX - Math.round(point.scrollX)) > 0.01)).toBe(true);
  expect(new Set(samples.map(point => point.frame)).size).toBeGreaterThan(1);

  await clickTile(page, { x: 19, y: 16 });
  await expectActorPosition(page, { x: 19, y: 16 });
  await expect(host).toHaveAttribute('data-facing', 'north');
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  const paused = await host.getAttribute('data-animation-frame');
  await page.waitForTimeout(350);
  expect(await host.getAttribute('data-animation-frame')).toBe(paused);
  await page.getByRole('button', { name: 'Закрыть панель', exact: true }).click();
  await expect(host).not.toHaveAttribute('data-animation-frame', paused!);

  // Resuming animation can precede the smooth camera's arrival at the hero.
  // Compare the ignored drag against its settled position, not an intermediate frame.
  await expect.poll(async () => {
    const view = await cameraView(page);
    return Math.abs(tileToScreen({ x: 19, y: 16 }, view).y - view.height / 2);
  }).toBeLessThan(1);
  const before = await cameraView(page);
  await page.mouse.move(600, 430);
  await page.mouse.down();
  await page.mouse.move(600, 580, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await cameraView(page);
  expect(Math.abs(afterDrag.scrollY - before.scrollY)).toBeLessThan(1);
  await expectActorPosition(page, { x: 19, y: 16 });
  await expect(page.getByRole('button', { name: 'Камера к герою', exact: true })).toHaveCount(0);
  await clickTile(page, { x: 19, y: 18 });
  await expectActorPosition(page, { x: 19, y: 18 });
  await expect.poll(async () => {
    const view = await cameraView(page);
    return Math.abs(tileToScreen({ x: 19, y: 18 }, view).y - view.height / 2);
  }).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('multiple passage indicators remain distinct after obsolete prototype saves are discarded', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => localStorage.setItem('shards-of-fate:expedition:v1', '{"legacy":true}'));
  await reloadCheckpoint(page);
  expect(await page.evaluate(() => localStorage.getItem('shards-of-fate:expedition:v1'))).toBeNull();
  const gates = page.getByTestId('exit-indicators').locator('g[data-exit-id]');
  expect(await gates.count()).toBeGreaterThan(4);
  const ids = await gates.evaluateAll(elements => elements.map(element => element.getAttribute('data-exit-id')));
  expect(new Set(ids).size).toBe(ids.length);
  await expect(page.getByRole('button', { name: 'Карта', exact: true })).toHaveCount(0);
});
