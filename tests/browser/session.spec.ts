import { expect, test, type Page } from '@playwright/test';
import { createExpedition, stepExpedition } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import type { ExpeditionState } from '@shards/shared';
import { SESSION_STORAGE_KEY } from '../../apps/client/src/session/storage';
import { clearFixtureEnemies, clickTile, expectActorPosition, loadExpeditionFixture } from './world-helpers';

async function checkpoint(page: Page) {
  return page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    const state = JSON.parse(saved.snapshot);
    return { ...saved, state: { ...state, world: JSON.parse(state.world), combat: state.combat ? JSON.parse(state.combat) : null } };
  }, SESSION_STORAGE_KEY);
}
async function newRun(page: Page, hero = 'guardian', difficulty = 'Обычная') {
  await page.getByRole('button', { name: 'Новая игра', exact: true }).click();
  await page.locator(`[data-character="${hero}"]`).click();
  await page.getByRole('button', { name: difficulty, exact: true }).click();
  await page.getByLabel('Сид мира', { exact: false }).fill('FIRST-CAMPFIRE');
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-actor-id', hero);
  await expect(page.locator('.world-surface canvas')).toBeVisible();
}
async function exitRun(page: Page) {
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить и выйти в главное меню', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Главное меню' })).toBeVisible();
}
function battleFixture(dying = false): ExpeditionState {
  const state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent, 'hard');
  const group = state.roaming!.chunks['0,0'][0];
  state.world.actors[0].position = {x:23,y:9};
  group.home = {x:23,y:8};
  group.members.forEach(mob => { mob.position = {...group.home}; mob.path=[]; });
  state.roaming!.chunks['0,0'] = [group];
  if (dying) for (const part of Object.values(state.world.actors[0].body!)) part.current=1;
  const result = stepExpedition(state, gameContent, 0);
  expect(result.combat).not.toBeNull();
  return result;
}

test('main menu, all nine single choices, settings placeholder and replacement only on start', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('shards-of-fate:expedition:v3','obsolete'); });
  await page.goto('/');
  await expect(page.getByRole('button', {name:'Продолжить',exact:true})).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('shards-of-fate:expedition:v3'))).toBeNull();
  await expect(page.getByTestId('world-canvas')).toHaveCount(0);
  await page.screenshot({path:'test-results/main-menu-desktop.png'});
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await expect(page.getByText('Этот раздел появится позже.')).toBeVisible();
  await page.getByRole('button',{name:'В главное меню',exact:true}).click();
  await page.getByRole('button',{name:'Новая игра',exact:true}).click();
  await expect(page.locator('[data-character]')).toHaveCount(9);
  for (const hero of gameContent.characters) {
    await page.locator(`[data-character="${hero.id}"]`).click();
    await expect(page.locator('[data-character][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByRole('region',{name:'Выбранный герой'}).getByRole('heading',{name:hero.name,exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'← Назад',exact:true}).click();
  await newRun(page,'rogue','Сложная');
  const first = await checkpoint(page);
  expect(first.state.difficultyId).toBe('hard');
  expect(first.state.world.actors.map((actor:{id:string})=>actor.id)).toEqual(['rogue']);
  await exitRun(page);
  await page.getByRole('button',{name:'Новая игра',exact:true}).click();
  await page.locator('[data-character="necromancer"]').click();
  await page.screenshot({path:'test-results/lobby-desktop.png'});
  expect((await checkpoint(page)).id).toBe(first.id);
  await page.getByRole('button',{name:'← Назад',exact:true}).click();
  await page.getByRole('button',{name:/^Продолжить/}).click();
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-actor-id','rogue');
  await exitRun(page);
  await newRun(page,'necromancer','Кошмар');
  const next = await checkpoint(page);
  expect(next.id).not.toBe(first.id);
  expect(next.state.difficultyId).toBe('nightmare');
  expect(next.state.world.actors.map((actor:{id:string})=>actor.id)).toEqual(['necromancer']);
});

test('reload returns to checkpoint; exit saves exact position; a chunk transition autosaves', async ({page}) => {
  await page.goto('/');
  const state = createExpedition('FIRST-CAMPFIRE',['guardian'],gameContent);
  clearFixtureEnemies(state);
  await loadExpeditionFixture(page,state);
  await clickTile(page,{x:19,y:18});
  await expectActorPosition(page,{x:19,y:18});
  expect((await checkpoint(page)).state.world.actors[0].position).toEqual({x:17,y:16});
  await page.reload();
  await page.getByRole('button',{name:/^Продолжить/}).click();
  await expectActorPosition(page,{x:17,y:16});
  await clickTile(page,{x:19,y:18});
  await expectActorPosition(page,{x:19,y:18});
  await exitRun(page);
  expect((await checkpoint(page)).state.world.actors[0].position).toEqual({x:19,y:18});
  const gate = state.world.chunk.exits.find(exit=>exit.direction==='north')!;
  state.world.actors[0].position={x:gate.position.x,y:gate.position.y+2};
  await loadExpeditionFixture(page,state);
  await clickTile(page,gate.position);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-chunk-id',gate.targetNodeId,{timeout:15000});
  expect((await checkpoint(page)).state.world.currentChunkId).toBe(gate.targetNodeId);
});

test('leaving a live battle saves the same dice and turn; death removes checkpoint immediately', async ({page}) => {
  await page.goto('/');
  await loadExpeditionFixture(page,battleFixture());
  await page.getByRole('button',{name:'Выполнить один ход',exact:true}).click();
  await exitRun(page);
  const battle = (await checkpoint(page)).state.combat;
  expect(battle.turn).toBeGreaterThan(0);
  await page.getByRole('button',{name:/^Продолжить/}).click();
  await exitRun(page);
  expect((await checkpoint(page)).state.combat).toEqual(battle);
  await loadExpeditionFixture(page,battleFixture(true));
  await page.getByRole('button',{name:'4×',exact:true}).click();
  await page.getByRole('button',{name:'Начать бой',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Отряд пал',exact:true})).toBeVisible({timeout:30000});
  expect(await page.evaluate(key=>localStorage.getItem(key),SESSION_STORAGE_KEY)).toBeNull();
  await page.reload();
  await expect(page.getByRole('button',{name:'Продолжить',exact:true})).toBeDisabled();
});

test('exit attempts to close the tab and has a usable fallback', async ({page}) => {
  await page.addInitScript(() => { window.close=()=>{ document.documentElement.dataset.closeAttempted='true'; }; });
  await page.goto('/');
  await page.getByRole('button',{name:'Выйти',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-close-attempted','true');
  await expect(page.getByRole('heading',{name:'Можно закрыть вкладку',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'В главное меню',exact:true}).click();
  await expect(page.getByRole('button',{name:'Новая игра',exact:true})).toBeVisible();
});

for (const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:740}]) {
  test.describe(`lobby touch ${viewport.width}`,()=>{
    test.use({viewport,hasTouch:true});
    test('hero, seed, difficulty and start stay usable without page scrolling',async({page})=>{
      await page.goto('/');
      await page.getByRole('button',{name:'Новая игра',exact:true}).tap();
      await page.locator('[data-character="ranger"]').tap();
      await page.getByRole('button',{name:'Сложная',exact:true}).tap();
      await page.getByLabel('Сид мира',{exact:false}).fill('MOBILE-CAMP');
      const size=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight}));
      expect(size.w).toBeLessThanOrEqual(size.iw); expect(size.h).toBeLessThanOrEqual(size.ih);
      await page.screenshot({path:`test-results/lobby-${viewport.width}.png`});
      await page.getByRole('button',{name:'Начать',exact:true}).tap();
      await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-actor-id','ranger');
      await page.getByRole('button',{name:'Меню',exact:true}).tap();
      await page.getByRole('button',{name:'Сохранить и выйти в главное меню',exact:true}).tap();
      await expect(page.getByRole('button',{name:/^Продолжить/})).toBeEnabled();
    });
  });
}
