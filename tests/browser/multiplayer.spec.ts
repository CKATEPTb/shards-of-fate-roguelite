import { expect, test, type Page } from '@playwright/test';
import { startRelayServer } from '../../apps/server/src/server';
import { tileCenter } from '../../apps/client/src/world/projection';

let relay: Awaited<ReturnType<typeof startRelayServer>>;
test.beforeAll(async () => { relay = await startRelayServer({ host: '127.0.0.1', port: 0 }); });
test.afterAll(async () => { await relay?.close(); });

async function openOnline(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть с друзьями', exact: true }).click();
  await page.getByLabel('Ваше имя', { exact: true }).fill(name);
  await page.getByLabel('Адрес сервера', { exact: true }).fill(`ws://127.0.0.1:${relay.port}/rsocket`);
}
async function actorPosition(page: Page, id: string) {
  const frames = JSON.parse(await page.getByTestId('world-canvas').getAttribute('data-actor-frames') ?? '[]') as { id: string; x: number; y: number }[];
  const actor = frames.find(frame => frame.id === id);
  return actor ? { x: Math.round(actor.x), y: Math.round(actor.y) } : null;
}

test('two friends control separate heroes in the host world and host departure closes the room', async ({ browser }) => {
  const hostContext = await browser.newContext({ reducedMotion: 'reduce' });
  const guestContext = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, hasTouch: true });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  host.on('pageerror', error => errors.push(error.message));
  guest.on('pageerror', error => errors.push(error.message));
  try {
    await openOnline(host, 'Хост');
    await host.getByRole('button', { name: 'Создать комнату', exact: false }).last().click();
    await expect(host.getByRole('heading', { name: /^Комната / })).toBeVisible();
    const code = (await host.getByRole('heading', { name: /^Комната / }).innerText()).split(' ')[1];
    await host.getByLabel('Сид мира', { exact: true }).fill('FIRST-CAMPFIRE');
    await openOnline(guest, 'Друг');
    await guest.getByRole('button', { name: 'Войти по коду', exact: true }).click();
    await guest.locator('[data-character="priest"]').click();
    await guest.getByLabel('Код комнаты', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Присоединиться', exact: false }).click();
    await expect(guest.getByRole('heading', { name: /^Комната / })).toHaveText(`Комната ${code}`);
    await expect(host.getByText('Отряд · 2/4')).toBeVisible();
    await expect(guest.locator('[data-character="guardian"]')).toBeDisabled();
    await host.screenshot({ path: 'test-results/multiplayer-lobby.png' });
    await host.getByRole('button', { name: 'Начать поход', exact: false }).click();
    await expect(host.getByTestId('world-canvas')).toHaveAttribute('data-actor-id', 'guardian');
    await expect(guest.getByTestId('world-canvas')).toHaveAttribute('data-actor-id', 'priest');
    await expect(guest.getByTestId('world-canvas')).toHaveAttribute('data-actor-x', '16');
    await expect(guest.getByTestId('world-canvas')).toHaveAttribute('data-actor-y', '17');
    await guest.getByTestId('world-canvas').press('ArrowUp');
    await expect(guest.getByTestId('world-canvas')).toHaveAttribute('data-actor-y', '16');
    await expect.poll(() => actorPosition(host, 'priest')).toEqual(tileCenter({ x: 16, y: 16 }));
    await expect(host.getByTestId('world-canvas')).toHaveAttribute('data-actor-x', '17');
    await expect(host.getByTestId('world-canvas')).toHaveAttribute('data-actor-y', '16');
    await guest.getByRole('button', { name: 'Меню', exact: true }).click();
    await host.getByTestId('world-canvas').press('ArrowLeft');
    await expect(host.getByTestId('world-canvas')).toHaveAttribute('data-actor-x', '16');
    await expect.poll(() => actorPosition(guest, 'guardian')).toEqual(tileCenter({ x: 16, y: 16 }));
    for (const page of [host, guest]) expect(await page.evaluate(() => localStorage.getItem('shards-of-fate:session:v1'))).toBeNull();
    await guest.getByRole('button', { name: 'Вернуться в игру', exact: true }).click();
    await guest.screenshot({ path: 'test-results/multiplayer-guest.png' });
    await host.getByRole('button', { name: 'Меню', exact: true }).click();
    await host.getByRole('button', { name: 'Завершить комнату и выйти', exact: true }).click();
    await expect(guest.getByRole('alert')).toContainText('Хост вышел');
    await expect(guest.getByTestId('world-canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
