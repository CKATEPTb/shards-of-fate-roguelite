import { expect, test, type Page } from '@playwright/test';
import { cameraView, clickTile, continueSession, crossFirstCampNorthGate, expectActorPosition, firstCampSpawn, loadPartyAt, ready, saveExpeditionFixture } from './world-helpers';
import { tileToScreen } from '../../apps/client/src/world/projection';
import { visibleWorldBounds } from '../../apps/client/src/world/camera';

async function expectInsideMap(page: Page) {
  const bounds = visibleWorldBounds(await cameraView(page));
  expect(bounds.x).toBeGreaterThanOrEqual(-0.01);
  expect(bounds.y).toBeGreaterThanOrEqual(-0.01);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(35 * 32 + 0.01);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(35 * 32 + 0.01);
}

test('camera ignores manual pan and zoom while following the hero inside terrain bounds', async ({ page }) => {
  await ready(page);
  await loadPartyAt(page, firstCampSpawn);
  await expect(page.getByRole('button', { name: 'Увеличить карту', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Уменьшить карту', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Камера к герою', exact: true })).toHaveCount(0);
  const host = page.getByTestId('world-canvas');
  const frame = (await host.boundingBox())!;
  const zoom = (await cameraView(page)).zoom;
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.wheel(0, 1000);
  expect((await cameraView(page)).zoom).toBe(zoom);
  await expectInsideMap(page);
  const before = await cameraView(page);
  for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.down();
    await page.mouse.move(frame.x + frame.width / 2 + dx * (frame.width / 2 - 60), frame.y + frame.height / 2 + dy * (frame.height / 2 - 60), { steps: 10 });
    await page.mouse.up();
    await expectInsideMap(page);
    const after = await cameraView(page);
    expect(Math.abs(after.scrollX - before.scrollX)).toBeLessThan(0.1);
    expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThan(0.1);
    await expectActorPosition(page, firstCampSpawn);
  }
  // A short walk isolates camera following from software-rendered movement time.
  const destination = { x: firstCampSpawn.x + 2, y: firstCampSpawn.y };
  await clickTile(page, destination);
  await expectActorPosition(page, destination);
  await expect.poll(async () => (await cameraView(page)).scrollX - before.scrollX).toBeGreaterThan(32);
  await expectInsideMap(page);
  await page.setViewportSize({ width: 2560, height: 1080 });
  await expect.poll(async () => (await cameraView(page)).width).toBe(2560);
  await expectInsideMap(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(async () => (await cameraView(page)).width).toBe(320);
  await expectInsideMap(page);
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
});

test('soft world lighting reveals the party clearing and darkens distant rendered terrain', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const view = await cameraView(page);
  const points = [tileToScreen({ x: 17, y: 19 }, view), tileToScreen({ x: 10, y: 10 }, view)];
  const brightness = await page.locator('.world-surface canvas').evaluate((element, locations) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const bounds = canvas.getBoundingClientRect();
    return locations.map(point => {
      const x = Math.round(point.x * canvas.width / bounds.width);
      const y = Math.round(point.y * canvas.height / bounds.height);
      const pixels = context.getImageData(x - 7, y - 7, 14, 14).data;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) total += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      return total / (pixels.length / 4);
    });
  }, points);
  expect(brightness[0]).toBeGreaterThan(brightness[1] * 1.6);
  expect(brightness[0]).toBeGreaterThan(20);
  await page.screenshot({ path: 'test-results/large-world-atmosphere.png' });
  expect(errors).toEqual([]);
});

test('the minimap reveals only visited exits and remembers discovery after transition and loading', async ({ page }) => {
  await ready(page);
  const minimap = page.getByTestId('minimap-hud');
  const nodeIds = () => minimap.locator('.map-node').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-node-id')).sort());
  await expect.poll(nodeIds).toEqual(['-1,0', '0,-1', '0,0', '0,1', '1,0']);
  await expect(minimap.locator('.map-edge')).toHaveCount(4);
  await expect(minimap.locator('.map-node.current title')).toContainText('0, 0');
  const geometry = await minimap.locator('svg').evaluate(svg => {
    const field = svg.querySelector<SVGCircleElement>('.minimap-field')!;
    const cx = field.cx.baseVal.value;
    const cy = field.cy.baseVal.value;
    const radius = field.r.baseVal.value;
    const outside = (x: number, y: number) => Math.hypot(x - cx, y - cy) > radius;
    const nodes = [...svg.querySelectorAll<SVGGElement>('.map-node')];
    const edges = [...svg.querySelectorAll<SVGLineElement>('.map-edge')];
    return {
      nodesOutside: nodes.filter(node => {
        const position = node.transform.baseVal.consolidate()!.matrix;
        return outside(position.e, position.f);
      }).length,
      outwardPassages: edges.filter(edge => outside(edge.x1.baseVal.value, edge.y1.baseVal.value)
        || outside(edge.x2.baseVal.value, edge.y2.baseVal.value)).length,
      allClippedToField: [...nodes, ...edges].every(element => {
        const reference = element.closest('[clip-path]')?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
        const circle = reference && document.getElementById(reference)?.querySelector('circle');
        return !!circle && circle.cx.baseVal.value === cx && circle.cy.baseVal.value === cy && circle.r.baseVal.value === radius;
      }),
    };
  });
  expect(geometry.nodesOutside).toBe(0);
  expect(geometry.outwardPassages).toBe(0);
  expect(geometry.allClippedToField).toBe(true);
  const mapBounds = (await minimap.boundingBox())!;
  await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
  await minimap.screenshot({ path: 'test-results/circular-minimap.png' });
  await expect(minimap.locator('[role="button"], button')).toHaveCount(0);
  await expect(page.locator('button')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Меню', exact: true })).toBeVisible();
  await crossFirstCampNorthGate(page);
  const discovered = ['-1,-1', '-1,0', '0,-1', '0,-2', '0,0', '0,1', '1,0'];
  await expect.poll(nodeIds).toEqual(discovered);
  await expect(minimap.locator('.map-edge')).toHaveCount(6);
  await expect(minimap.locator('.map-node[data-node-id="1,-1"]')).toHaveCount(0);
  expect(await minimap.locator('.map-edge').evaluateAll(edges => edges.every(edge =>
    ['0,0', '0,-1'].includes(edge.getAttribute('data-from')!) || ['0,0', '0,-1'].includes(edge.getAttribute('data-to')!)))).toBe(true);
  await expect(minimap.locator('.map-node.current title')).toContainText('0, -1');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await saveExpeditionFixture(page, false);
  await page.reload();
  await expect(page.getByTestId('world-canvas')).toHaveCount(0);
  await continueSession(page);
  await expect.poll(nodeIds).toEqual(discovered);
  await expect(minimap.locator('.map-edge')).toHaveCount(6);
});
