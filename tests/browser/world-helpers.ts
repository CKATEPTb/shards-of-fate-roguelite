import { expect, type Page } from '@playwright/test';
import type { ExpeditionState, GridPoint, WorldActor, WorldChunk } from '@shards/shared';
import { createExpedition, deserializeExpedition, serializeExpedition, stepExpedition } from '@shards/game-core';
import { isWalkable, neighbors, tileIndex } from '../../packages/game-core/src/world/grid';
import { gameContent } from '@shards/game-data';
import { tileToScreen } from '../../apps/client/src/world/projection';

export const firstCampSpawn: GridPoint = { x: 17, y: 16 };
export const sessionStorageKey = 'shards-of-fate:session:v1';

/** Geometry/UI fixtures isolate their subject from unrelated patrol encounters. */
export function clearFixtureEnemies(state: ExpeditionState) {
  if (state.roaming) state.roaming.chunks = Object.fromEntries(state.world.visited.map(id => [id, []]));
}

export async function storeExpeditionFixture(page: Page, state: ExpeditionState) {
  const snapshot = serializeExpedition(state, gameContent);
  deserializeExpedition(snapshot, gameContent);
  const now = Date.now();
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: sessionStorageKey,
    value: JSON.stringify({ version: 1, id: 'browser-fixture', startedAt: now, savedAt: now, snapshot }) });
}

export async function continueSession(page: Page) {
  await page.getByRole('navigation', { name: 'Главное меню' }).getByRole('button', { name: /^Продолжить/ }).click();
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-prop-count', /[1-9]\d*/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export async function loadExpeditionFixture(page: Page, state: ExpeditionState) {
  if (state.world.actors.length !== 1) throw new Error('Browser sessions require one local hero');
  await storeExpeditionFixture(page, state);
  await page.reload();
  await continueSession(page);
}

export async function readSavedExpedition(page: Page): Promise<ExpeditionState> {
  const saved = await page.evaluate(key => localStorage.getItem(key), sessionStorageKey);
  expect(saved).not.toBeNull();
  return deserializeExpedition(JSON.parse(saved!).snapshot, gameContent);
}

export async function saveExpeditionFixture(page: Page, resume = true): Promise<ExpeditionState> {
  if (!await page.getByRole('dialog', { name: 'Привал' }).isVisible()) await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить и выйти в главное меню', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Главное меню' })).toBeVisible();
  const state = await readSavedExpedition(page);
  if (resume) await continueSession(page);
  return state;
}

export async function reloadCheckpoint(page: Page) {
  await page.reload();
  await continueSession(page);
}

export async function startNewGame(page: Page, seed = 'FIRST-CAMPFIRE', hero = 'guardian') {
  await page.getByRole('button', { name: 'Новая игра', exact: true }).click();
  await page.locator(`.hero-choice[data-character="${hero}"]`).click();
  await page.getByLabel('Сид мира').fill(seed);
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-prop-count', /[1-9]\d*/);
}

/** Real generated enemies enter combat through production proximity rules. */
export function createBattleFixture(): ExpeditionState {
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  const group = state.roaming!.chunks['0,0'].find(candidate => candidate.members.length === 2 && candidate.members.every(mob => mob.definitionId === 'spider'))!;
  expect(group).toBeDefined();
  state.world.actors = state.world.actors.map(actor => ({ ...actor, position: { x: 23, y: 9 }, path: [] }));
  group.home = { x: 23, y: 8 };
  group.members = group.members.map(mob => ({ ...mob, position: { ...group.home }, path: [] }));
  state.roaming!.chunks['0,0'] = [group];
  const battle = stepExpedition(state, gameContent, 0);
  expect(battle.combat?.enemyIds).toEqual(['spider', 'spider']);
  return battle;
}

export async function loadBattleFixture(page: Page) {
  const state = createBattleFixture();
  await loadExpeditionFixture(page, state);
  await expect(page.getByRole('region', { name: 'Боевая встреча' })).toBeVisible();
  return state;
}

/** Spread fixture actors near a point; this is independent of real camp/entry placement. */
export function placeFixtureParty(chunk: WorldChunk, actors: WorldActor[], origin: GridPoint): WorldActor[] {
  const queue = [origin]; const seen = new Set<number>(); const positions: GridPoint[] = [];
  for (let cursor = 0; cursor < queue.length && positions.length < actors.length; cursor++) {
    const point = queue[cursor]; const index = tileIndex(point, chunk.size);
    if (seen.has(index) || !isWalkable(chunk, point)) continue;
    seen.add(index);
    if (point.x > 0 && point.y > 0 && point.x < chunk.size - 1 && point.y < chunk.size - 1) positions.push(point);
    queue.push(...neighbors(point, chunk.size));
  }
  if (positions.length < actors.length) throw new Error('Insufficient walkable fixture positions');
  return actors.map((actor, index) => ({
    ...actor, position: { ...positions[index] }, path: [],
    movement: actor.movement && { ...actor.movement, elapsedMs: 0 },
  }));
}

export async function cameraView(page: Page) {
  const host = page.getByTestId('world-canvas');
  await expect(host).toHaveAttribute('data-camera-scroll-x');
  return host.evaluate(element => {
    const data = (element as HTMLElement).dataset;
    return { scrollX: Number(data.cameraScrollX), scrollY: Number(data.cameraScrollY), zoom: Number(data.cameraZoom), width: Number(data.viewportWidth), height: Number(data.viewportHeight) };
  });
}

export async function clickTile(page: Page, point: GridPoint, touch = false) {
  const host = page.getByTestId('world-canvas');
  const position = tileToScreen(point, await cameraView(page));
  const bounds = (await host.boundingBox())!;
  expect(position.x).toBeGreaterThan(0);
  expect(position.x).toBeLessThan(bounds.width);
  expect(position.y).toBeGreaterThan(0);
  expect(position.y).toBeLessThan(bounds.height);
  if (touch) await page.touchscreen.tap(bounds.x + position.x, bounds.y + position.y);
  else await page.mouse.click(bounds.x + position.x, bounds.y + position.y);
}

export async function expectActorPosition(page: Page, point: GridPoint) {
  const host = page.getByTestId('world-canvas');
  // Read both coordinates together: separate assertions can observe different steps.
  await expect.poll(() => host.evaluate(element => {
    const data = (element as HTMLElement).dataset;
    return { x: Number(data.actorX), y: Number(data.actorY) };
  }), { timeout: 15_000 }).toEqual(point);
}

export async function expectFullViewport(page: Page) {
  const bounds = (await page.getByTestId('world-canvas').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
  expect(bounds.width).toBe(viewport.width);
  expect(bounds.height).toBe(viewport.height);
}

/** Load a valid, regenerated world through the same save UI used by players. */
export async function loadPartyAt(page: Page, position: GridPoint, seed = 'FIRST-CAMPFIRE') {
  const state = createExpedition(seed, ['guardian'], gameContent);
  state.world.actors = placeFixtureParty(state.world.chunk, state.world.actors, position);
  clearFixtureEnemies(state);
  await loadExpeditionFixture(page, state);
  await expectActorPosition(page, position);
}

/** Exercise the actual terrain gate without the removed full-map dialog. */
export async function crossFirstCampNorthGate(page: Page, touch = false) {
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent);
  const gate = state.world.chunk.exits.find(exit => exit.direction === 'north')!;
  await loadPartyAt(page, { x: gate.position.x, y: gate.position.y + 2 });
  await clickTile(page, gate.position, touch);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-chunk-id', gate.targetNodeId, { timeout: 15_000 });
  return gate;
}

export async function ready(page: Page) {
  await page.goto('/');
  await startNewGame(page);
  await expect(page.locator('.world-surface canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.world-surface canvas')).toHaveCount(1);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-prop-count', /[1-9]\d*/);
}
