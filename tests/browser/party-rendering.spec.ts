import { expect, test, type Page } from '@playwright/test';
import { tileCenter } from '../../apps/client/src/world/projection';
import { crossFirstCampNorthGate, expectActorPosition, loadPartyAt, ready, saveExpeditionFixture } from './world-helpers';

interface ActorFrame { id: string; x: number; y: number; depth: number }
async function renderedActors(page: Page): Promise<ActorFrame[]> {
  return JSON.parse((await page.getByTestId('world-canvas').getAttribute('data-actor-frames')) ?? '[]');
}

test('the session hero stands at the fire, arrives on the entrance tile and keeps ground-based depth', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await expect.poll(async () => (await renderedActors(page)).map(({ id, x, y }) => ({ id, x, y })))
    .toEqual([{ id: 'guardian', ...tileCenter({ x: 17, y: 16 }) }]);
  await crossFirstCampNorthGate(page);
  const arrival = (await saveExpeditionFixture(page)).world.actors[0].position;
  await expect.poll(async () => (await renderedActors(page)).map(({ id, x, y }) => ({ id, x, y })))
    .toEqual([{ id: 'guardian', ...tileCenter(arrival) }]);
  await page.screenshot({ path: 'test-results/solo-entrance-arrival.png' });

  await loadPartyAt(page, { x: 19, y: 17 });
  await expectActorPosition(page, { x: 19, y: 17 });
  const north = (await renderedActors(page))[0];
  await loadPartyAt(page, { x: 19, y: 18 });
  await expectActorPosition(page, { x: 19, y: 18 });
  const south = (await renderedActors(page))[0];
  expect(south.x).toBe(north.x);
  expect(south.y - north.y).toBe(32);
  expect(south.depth).toBeGreaterThan(north.depth);
  await page.screenshot({ path: 'test-results/solo-ground-depth.png' });
});
