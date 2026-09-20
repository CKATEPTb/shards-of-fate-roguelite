import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { unitFramePixels } from '../../apps/client/src/art/unitFrames';
import { UNIT_FACINGS } from '../../apps/client/src/art/unitPose';
import { BODY_PARTS } from '../../packages/shared/src';
import { characters } from '../../packages/game-data/src/characters';

let html = `<html><meta charset="utf-8"><style>body{background:#182720;color:#dde4c9;font:16px system-ui;margin:20px}h1{font-size:22px;margin:12px 0}.row{display:flex;align-items:center;border-bottom:1px solid #35523d;height:106px}.name{width:150px}.cell{width:288px;text-align:center}svg{display:block;image-rendering:pixelated}small{color:#879d82}section{width:1302px}</style>`;
for (const crawl of [false, true]) {
  const name = crawl ? 'Crawl — walk 0 / 2 / one arm' : 'Standing — idle / walk / cast';
  html += `<section id="${crawl ? 'crawl' : 'roster'}"><h1>${name}</h1>`;
  for (const hero of characters) {
    html += `<div class="row"><div class="name">${hero.name}<br><small>${hero.id}</small></div>`;
    for (const facing of UNIT_FACINGS) {
      html += `<div class="cell"><small>${facing}</small><svg width="288" height="84" viewBox="0 0 96 28" shape-rendering="crispEdges">`;
      for (let index = 0; index < 3; index++) {
        const body = Object.fromEntries(BODY_PARTS.map(part => [part, { current: crawl && (part === 'leftLeg' || part === 'rightLeg' || index === 2 && part === 'leftArm') ? 0 : 100, max: 100 }]));
        const motion = crawl ? 'walk' : index === 0 ? 'idle' : index === 1 ? 'walk' : 'cast';
        const frame = index === 0 ? 0 : 2;
        html += `<rect x="${index * 32}" y="27.9" width="32" height="0.1" fill="#8fac7d"/>`;
        for (const pixel of unitFramePixels(hero.sprite, hero.role, false, facing, motion, frame, body)) html += `<rect x="${index * 32 + pixel.x}" y="${pixel.y}" width="1" height="1" fill="${pixel.color}"/>`;
      }
      html += '</svg></div>';
    }
    html += '</div>';
  }
  html += '</section>';
}
html += '</html>';
const out = 'artifacts/roster-preview/';
writeFileSync(out + 'index.html', html);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1050 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  for (const section of ['roster', 'crawl']) await page.locator('#' + section).screenshot({ path: out + section + '.png' });
} finally { await browser.close(); }
