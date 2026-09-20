import { expect, test } from '@playwright/test';
import { createExpedition } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { clearFixtureEnemies, clickTile, expectActorPosition, firstCampSpawn, loadExpeditionFixture, loadPartyAt, ready } from './world-helpers';

test('movement uses the slower pace and displays class speeds and saved bonuses', async ({ page }) => {
  await ready(page);
  for (const [id, speed] of [['guardian', '100%'], ['priest', '103%'], ['mage', '105%']]) {
    const state = createExpedition('FIRST-CAMPFIRE', [id], gameContent);
    clearFixtureEnemies(state);
    await loadExpeditionFixture(page, state);
    const bounds = (await page.getByTestId(`hero-info-${id}`).boundingBox())!;
    await page.mouse.move(bounds.x + 30, bounds.y + bounds.height / 2);
    await expect(page.getByTestId('hero-movement-speed')).toHaveText(speed);
  }
  // Keep the measured route straight and two tiles long regardless of camp formation.
  await loadPartyAt(page, { x: 17, y: 18 });
  await page.mouse.move(720, 500);
  const host = page.getByTestId('world-canvas');
  await host.evaluate(element => {
    const samples: { x: number; time: number }[] = [];
    const observer = new MutationObserver(() => samples.push({ x: Number((element as HTMLElement).dataset.visualActorX), time: performance.now() }));
    observer.observe(element, { attributes: true, attributeFilter: ['data-visual-actor-x'] });
    Object.assign(element, { speedSamples: samples, speedObserver: observer });
  });
  await clickTile(page, { x: 19, y: 18 });
  await expect(host).toHaveAttribute('data-visual-actor-x', '624');
  const samples = await host.evaluate(element => {
    const sampled = element as HTMLElement & { speedSamples: { x: number; time: number }[]; speedObserver: MutationObserver };
    sampled.speedObserver.disconnect();
    return sampled.speedSamples;
  });
  const start = samples.find(sample => sample.x > 560)!;
  const end = samples.find(sample => sample.x === 624)!;
  // Two visual steps now take ~560 ms; the old 140 ms/tile timing fails this bound.
  expect(end.time - start.time).toBeGreaterThan(400);
  await expectActorPosition(page, { x: 19, y: 18 });

  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  state.world.actors[0].movement!.bonusPercent = 25;
  clearFixtureEnemies(state);
  await loadExpeditionFixture(page, state);
  await expectActorPosition(page, firstCampSpawn);
  const row = (await page.getByTestId('hero-info-guardian').boundingBox())!;
  await page.mouse.move(row.x + 30, row.y + row.height / 2);
  await expect(page.getByTestId('hero-movement-speed')).toHaveText('125%');
  await page.screenshot({ path: 'test-results/movement-speed-tooltip.png' });
});
