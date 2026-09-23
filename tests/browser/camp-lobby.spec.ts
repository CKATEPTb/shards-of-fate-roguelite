import { expect, test } from '@playwright/test';

test('heroes are selected at the campfire with mouse and keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая игра', exact: true }).click();
  const camp = page.getByTestId('campfire-roster');
  await expect(camp).toBeVisible();
  const choices = camp.locator('[data-character]');
  await expect(choices).toHaveCount(9);
  await camp.locator('[data-character="mage"]').click();
  await expect(page.getByRole('region', { name: 'Выбранный герой' }).getByRole('heading', { name: 'Маг', exact: true })).toBeVisible();
  await expect(camp.locator('[aria-pressed="true"]')).toHaveCount(1);
  await camp.locator('[data-character="mage"]').press('ArrowRight');
  await expect(camp.locator('[data-character="mage"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(camp.locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.getByText('Умения и особенность', { exact: false }).click();
  await expect(page.locator('.camp-ability-list')).toBeVisible();
  await page.screenshot({ path: 'test-results/camp-lobby-desktop.png' });
});

for (const width of [320, 390]) {
  test(`campfire heroes remain tappable on a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра', exact: true }).click();
    const camp = page.getByTestId('campfire-roster');
    await camp.scrollIntoViewIfNeeded();
    const boxes = await camp.locator('[data-character]').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { id: element.getAttribute('data-character'), x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    expect(boxes).toHaveLength(9);
    for (const box of boxes) {
      expect(box.width, `${box.id} width`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${box.id} height`).toBeGreaterThanOrEqual(44);
      expect(box.x, `${box.id} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${box.id} right edge`).toBeLessThanOrEqual(width);
    }
    for (const hero of ['vampire', 'ranger', 'priest']) {
      await camp.locator(`[data-character="${hero}"]`).click();
      await expect(camp.locator(`[data-character="${hero}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/camp-lobby-${width}.png` });
  });
}
