import { enemies } from '@shards/game-data';
import { enemyArtId, getEnemyAppearance } from '../art/enemyAppearance';
import { unitFramePixels } from '../art/unitFrames';
import { UNIT_CLIPS, type UnitFacing, type UnitMotion } from '../art/unitPose';
import type { Pixel } from '../art/pixelCanvas';
import './enemyArtPreview.css';

const root = document.getElementById('bestiary')!;
const seasons = { spring: 'Весна', summer: 'Лето', autumn: 'Осень', winter: 'Зима' };
const catalogue = enemies.filter(enemy => enemy.tags.includes('ACT_1') || enemy.tags.includes('BOSS'));
let selected = catalogue.find(enemy => enemy.id === 'boss_briar_king') ?? catalogue[0];
let bosses = true, season = '', search = '', page = 0, facing: UnitFacing = 'south', motion: UnitMotion = 'idle';
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let request = 0, previous = '', clock = 0, lastTime = 0;
const pageSize = 20;
const cache = new Map<string, Pixel[]>();
const html = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

root.innerHTML = `<header class="bestiary-header"><div><span class="bestiary-eyebrow">Осколки судьбы · Обитатели первого акта</span><h1>За пределами огня</h1></div><p>Четыре времени года. Пятьсот обитателей.<br>Пятьдесят существ, которым поклоняются чудовища.</p></header>
<section class="bestiary-focus"><div class="bestiary-stage"><span class="bestiary-stage-note">РЯДОМ С ГЕРОЕМ · МАСШТАБ СОХРАНЁН</span><canvas width="960" height="540" id="monster-stage" aria-label="Модель противника рядом с героем"></canvas></div>
<div class="bestiary-detail"><div><span class="bestiary-eyebrow" id="monster-kind"></span><h2 id="monster-name"></h2><div class="bestiary-title" id="monster-title"></div></div><div class="bestiary-tags" id="monster-tags"></div><p class="bestiary-description" id="monster-description"></p>
<div><div class="bestiary-controls"><label>Ракурс<select id="monster-facing"><option value="south">Лицом</option><option value="east">Вправо</option><option value="north">Со спины</option><option value="west">Влево</option></select></label><label>Движение<select id="monster-motion"><option value="idle">Покой</option><option value="walk">Движение</option><option value="attack">Атака</option><option value="cast">Заклинание</option><option value="hit">Получение удара</option><option value="block">Блок</option><option value="death">Гибель</option></select></label></div><button type="button" class="bestiary-pause" id="monster-pause">${paused ? 'Продолжить' : 'Пауза'}</button></div></div></section>
<section aria-label="Каталог моделей"><div class="bestiary-toolbar"><div class="bestiary-tabs"><button type="button" data-kind="boss" aria-pressed="true">Боссы · 50</button><button type="button" data-kind="enemy" aria-pressed="false">Обитатели · 500</button></div><select id="monster-season" aria-label="Сезон"><option value="">Все сезоны</option>${Object.entries(seasons).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select><input type="search" placeholder="Найти существо…" aria-label="Поиск по имени" id="monster-search"></div><div class="bestiary-grid" id="monster-grid"></div><div class="bestiary-pager"><button id="monster-prev" type="button">← Назад</button><span id="monster-count"></span><button id="monster-next" type="button">Дальше →</button></div></section><p class="bestiary-footnote">Модели из игры. Просмотр не меняет сохранения.</p>`;

const stage = root.querySelector<HTMLCanvasElement>('#monster-stage')!, context = stage.getContext('2d')!;
context.imageSmoothingEnabled = false;
function pixels(id: string, role: string, enemy: boolean, direction: UnitFacing, clip: UnitMotion, frame: number) {
  const key = `${id}:${direction}:${clip}:${frame}`;
  let result = cache.get(key);
  if (!result) {
    result = unitFramePixels(id, role, enemy, direction, clip, frame);
    cache.set(key, result);
    if (cache.size > 180) cache.delete(cache.keys().next().value!);
  }
  return result;
}
function paint(ctx: CanvasRenderingContext2D, points: Pixel[], x: number, ground: number, scale: number, foot = 56) {
  for (const pixel of points) {
    ctx.fillStyle = pixel.color;
    ctx.fillRect(Math.round(x + (pixel.x - 32) * scale), Math.round(ground + (pixel.y - foot) * scale), Math.ceil(scale), Math.ceil(scale));
  }
}
function floor() {
  const p = getEnemyAppearance(enemyArtId(selected))!;
  const sky = context.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#111a21'); sky.addColorStop(.65, '#202c29'); sky.addColorStop(1, '#0c1515');
  context.fillStyle = sky; context.fillRect(0, 0, 960, 540);
  for (let tree = 0; tree < 12; tree++) {
    const x = tree * 89 - 28, h = 150 + tree % 3 * 62;
    context.fillStyle = tree % 2 ? '#111e1de0' : '#162322';
    context.fillRect(x, 385 - h, 15 + tree % 4 * 5, h);
    context.beginPath(); context.moveTo(x - 56, 355); context.lineTo(x + 12, 75 - tree % 3 * 25); context.lineTo(x + 88, 355); context.fill();
  }
  const halo = context.createRadialGradient(620, 330, 20, 620, 330, 310);
  halo.addColorStop(0, `${p.palette.main}28`); halo.addColorStop(1, `${p.palette.main}00`);
  context.fillStyle = halo; context.fillRect(0, 0, 960, 540);
  context.fillStyle = '#182421'; context.fillRect(0, 421, 960, 119);
  for (let stone = 0; stone < 100; stone++) {
    context.fillStyle = ['#24322c', '#2e3a30', '#354036'][stone % 3];
    context.fillRect((stone * 137) % 960, 426 + stone * 53 % 114, 2 + stone % 7, 2);
  }
  context.fillStyle = '#02080aaa';
  context.beginPath(); context.ellipse(265, 463, 45, 10, 0, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.ellipse(620, 463, 42 * p.scale, 10 * p.scale, 0, 0, Math.PI * 2); context.fill();
}
function updateDetails() {
  const p = getEnemyAppearance(enemyArtId(selected))!;
  root.querySelector('#monster-kind')!.textContent = p.boss ? 'Сезонный владыка' : 'Обитатель первого акта';
  root.querySelector('#monster-name')!.textContent = selected.name;
  root.querySelector('#monster-title')!.textContent = selected.title;
  root.querySelector('#monster-description')!.textContent = selected.description;
  root.querySelector('#monster-tags')!.innerHTML = `<span>${seasons[p.season]}</span><span>${p.boss ? 'Исполин' : `Ступень ${p.tier}`}</span><span>${{ tank: 'Защитник', damage: 'Урон', healer: 'Хранитель' }[selected.role]}</span>`;
  previous = '';
}
function renderGallery() {
  const pool = catalogue.filter(enemy => enemy.tags.includes('BOSS') === bosses
    && (!season || getEnemyAppearance(enemyArtId(enemy))?.season === season)
    && (!search || `${enemy.name} ${enemy.title}`.toLocaleLowerCase('ru').includes(search)));
  const pages = Math.max(1, Math.ceil(pool.length / pageSize));
  page = Math.max(0, Math.min(page, pages - 1));
  const shown = pool.slice(page * pageSize, (page + 1) * pageSize);
  const grid = root.querySelector('#monster-grid')!;
  grid.innerHTML = shown.length ? shown.map(enemy => {
    const p = getEnemyAppearance(enemyArtId(enemy))!;
    return `<button type="button" class="bestiary-card" data-monster="${html(enemy.id)}" aria-pressed="${enemy.id === selected.id}"><canvas width="180" height="152" aria-hidden="true"></canvas><div class="bestiary-card-copy"><strong>${html(enemy.name)}</strong><small>${seasons[p.season]} · ${p.boss ? 'Босс' : `Ступень ${p.tier}`}</small></div></button>`;
  }).join('') : '<p class="bestiary-empty">По этому имени никого не найдено.</p>';
  for (const button of grid.querySelectorAll<HTMLButtonElement>('[data-monster]')) {
    const enemy = shown.find(item => item.id === button.dataset.monster)!;
    const ctx = button.querySelector('canvas')!.getContext('2d')!;
    paint(ctx, pixels(enemyArtId(enemy), enemy.role, true, 'south', 'idle', 0), 90, 143, 2.25);
    button.onclick = () => { selected = enemy; clock = 0; updateDetails(); renderGallery(); };
  }
  root.querySelector('#monster-count')!.textContent = `${page + 1} / ${pages} · ${pool.length} существ`;
  root.querySelector<HTMLButtonElement>('#monster-prev')!.disabled = page === 0;
  root.querySelector<HTMLButtonElement>('#monster-next')!.disabled = page >= pages - 1;
}
root.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => { button.onclick = () => {
  bosses = button.dataset.kind === 'boss'; page = 0;
  root.querySelectorAll('[data-kind]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
  renderGallery();
}; });
root.querySelector<HTMLSelectElement>('#monster-season')!.onchange = event => { season = (event.target as HTMLSelectElement).value; page = 0; renderGallery(); };
root.querySelector<HTMLInputElement>('#monster-search')!.oninput = event => { search = (event.target as HTMLInputElement).value.trim().toLocaleLowerCase('ru'); page = 0; renderGallery(); };
root.querySelector<HTMLButtonElement>('#monster-prev')!.onclick = () => { page--; renderGallery(); };
root.querySelector<HTMLButtonElement>('#monster-next')!.onclick = () => { page++; renderGallery(); };
root.querySelector<HTMLSelectElement>('#monster-facing')!.onchange = event => { facing = (event.target as HTMLSelectElement).value as UnitFacing; previous = ''; };
root.querySelector<HTMLSelectElement>('#monster-motion')!.onchange = event => { motion = (event.target as HTMLSelectElement).value as UnitMotion; clock = 0; previous = ''; };
root.querySelector<HTMLButtonElement>('#monster-pause')!.onclick = event => { paused = !paused; (event.target as HTMLButtonElement).textContent = paused ? 'Продолжить' : 'Пауза'; };
function animate(time: number) {
  if (!paused && !document.hidden) clock += Math.min(100, time - lastTime);
  lastTime = time;
  const p = getEnemyAppearance(enemyArtId(selected))!, clip = UNIT_CLIPS[motion];
  const rate = clip.frameRate * (p.boss ? .72 : 1);
  const frame = Math.min(clip.frames - 1, Math.floor(clock * rate / 1000) % (clip.frames + (clip.repeat === 0 ? 6 : 0)));
  const stamp = `${selected.id}:${facing}:${motion}:${frame}`;
  if (stamp !== previous && !document.hidden) {
    previous = stamp; floor();
    paint(context, pixels('guardian', 'tank', false, 'east', 'idle', 0), 265, 459, 2.1);
    paint(context, pixels(enemyArtId(selected), selected.role, true, facing, motion, frame), 620, 459, 2.1 * p.scale);
  }
  request = requestAnimationFrame(animate);
}
updateDetails(); renderGallery(); request = requestAnimationFrame(animate);
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(request); cache.clear(); root.replaceChildren(); });
