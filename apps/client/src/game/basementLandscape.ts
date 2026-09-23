import type Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import { drawChest, drawStairs } from '../world/poiArt';
import { landscapeRandom, type BattleEnvironment } from './battleEnvironment';
import type { BattleLandscape } from './landscape';
import type { BattleStage } from './battleLayout';

let textureSequence = 0;

function storeShelf(art: Phaser.GameObjects.Graphics, x: number, y: number, width: number, random: () => number) {
  art.fillStyle(0x111b1b).fillRect(x - width / 2 - 4, y - 63, width + 8, 68);
  art.fillStyle(0x302c22).fillRect(x - width / 2, y - 61, width, 62);
  for (let row = 0; row < 3; row++) {
    const sy = y - 60 + row * 20;
    art.fillStyle(0x6b5638).fillRect(x - width / 2, sy + 15, width, 4);
    art.fillStyle(0xb18a50, .3).fillRect(x - width / 2 + 2, sy + 15, width - 4, 1);
    for (let col = 0; col < Math.floor(width / 16); col++) {
      const sx = x - width / 2 + 4 + col * 16;
      const height = 7 + Math.floor(random() * 7);
      art.fillStyle(random() < .5 ? 0x8a7953 : 0x466458).fillRect(sx, sy + 15 - height, 9, height);
      art.fillStyle(0xabb090, .25).fillRect(sx + 1, sy + 16 - height, 2, height - 2);
      if (height > 10) art.fillStyle(0xa49564).fillRect(sx + 1, sy + 12 - height, 7, 3);
    }
  }
  art.fillStyle(0x443d2c).fillRect(x - width / 2, y - 62, 4, 66).fillRect(x + width / 2 - 4, y - 62, 4, 66);
}

/** A cellar is a stone interior: its parent season never introduces trees, leaves or snow. */
export function drawBasementLandscape(scene: Phaser.Scene, environment: BattleEnvironment): BattleLandscape {
  const ratio = Math.min(1, 1600 / Math.max(1, scene.scale.width), 1200 / Math.max(1, scene.scale.height));
  const width = Math.max(1, Math.round(scene.scale.width * ratio)), height = Math.max(1, Math.round(scene.scale.height * ratio));
  const random = landscapeRandom(`${environment.seed}:${environment.chunk.id}:${environment.focus.x},${environment.focus.y}:cellar`);
  const art = scene.make.graphics({ x: 0, y: 0 });
  const wallHeight = Math.min(170, Math.max(90, height * .2));
  art.fillStyle(0x202d2c).fillRect(0, 0, width, height);
  // Perspective stone courses stay subdued throughout the area occupied by combatants.
  for (let y = wallHeight; y < height; y += 22) {
    const slab = Math.round(25 + y / height * 27);
    const offset = (Math.floor(y / 22) + environment.focus.x) % 2 * Math.floor(slab / 2);
    for (let x = -slab + offset; x < width; x += slab) {
      art.fillStyle([0x35403b, 0x303c37, 0x39443d][Math.floor(random() * 3)], .7).fillRect(x + 1, y + 1, slab - 2, 20);
      art.fillStyle(0x77816d, .12).fillRect(x + 3, y + 2, slab - 6, 1);
      if (random() < .28) art.fillStyle(0x172728, .7).fillRect(x + 8, y + 12, 7, 1).fillRect(x + 14, y + 13, 1, 3);
    }
  }
  art.fillStyle(0x141f22).fillRect(0, 0, width, wallHeight);
  for (let y = 0; y < wallHeight; y += 18) for (let x = -(y / 18 % 2) * 21; x < width; x += 42) {
    art.fillStyle([0x344440, 0x3c4b43, 0x2c3d3a][Math.floor(random() * 3)]).fillRect(x + 1, y + 1, 40, 16);
    art.fillStyle(0x90977d, .15).fillRect(x + 3, y + 2, 35, 2);
  }
  art.fillStyle(0x122126, .7).fillRect(0, wallHeight, width, 10);
  art.fillStyle(0x687766, .3).fillRect(0, wallHeight - 3, width, 3);
  const archX = Math.max(45, Math.min(width - 45, width * (.43 + random() * .14)));
  const archWidth = Math.min(64, width * .15);
  art.fillStyle(0x080f14).fillRect(archX - archWidth / 2, wallHeight - 65, archWidth, 68)
    .fillRect(archX - archWidth / 2 + 8, wallHeight - 76, archWidth - 16, 14);
  for (let row = 0; row < 5; row++) {
    art.fillStyle(row % 2 ? 0x586359 : 0x44584f).fillRect(archX - archWidth / 2 - 10, wallHeight - 66 + row * 14, 9, 12)
      .fillRect(archX + archWidth / 2 + 1, wallHeight - 66 + row * 14, 9, 12);
  }
  art.fillStyle(0x7b826b).fillRect(archX - archWidth / 2 - 5, wallHeight - 79, archWidth + 10, 6);
  art.fillStyle(0x253432).fillRect(archX - archWidth / 2 + 8, wallHeight - 11, archWidth - 16, 11);
  const nearChestCount = environment.chunk.pois.filter(poi => poi.kind === 'chest'
    && Math.abs(poi.position.x - environment.focus.x) + Math.abs(poi.position.y - environment.focus.y) <= 16).length;
  const shelfWidth = Math.min(92, width * .22);
  storeShelf(art, width * .17, wallHeight - 1, shelfWidth, random);
  if (width > 420 || nearChestCount > 1) storeShelf(art, width * .84, wallHeight - 1, shelfWidth, random);
  const nearby = environment.chunk.pois.filter(poi => (poi.kind === 'chest' || poi.kind === 'stairs-up')
    && Math.abs(poi.position.x - environment.focus.x) + Math.abs(poi.position.y - environment.focus.y) <= 12).slice(0, 3);
  nearby.forEach((poi, index) => {
    const x = poi.position.x < environment.focus.x ? 28 + index * 24 : width - 28 - index * 24;
    const y = wallHeight + 18 + index % 2 * 23;
    if (poi.kind === 'chest') drawChest(art, x, y, false);
    else drawStairs(art, x, y, true);
  });
  const torches: GridPoint[] = [{ x: width * .32, y: wallHeight - 27 }, { x: width * .7, y: wallHeight - 32 }];
  for (const torch of torches) {
    for (let halo = 0; halo < 10; halo++) art.fillStyle(0xc3a261, .009).fillEllipse(torch.x, torch.y, 90 - halo * 7, 100 - halo * 8);
    art.fillStyle(0x181d19).fillRect(torch.x - 3, torch.y + 1, 7, 15);
    art.fillStyle(0x887752).fillRect(torch.x - 4, torch.y + 5, 9, 3);
  }
  for (let border = 0; border < 12; border++) art.fillStyle(0x070f13, .025)
    .fillRect(border * 6, 0, 6, height).fillRect(width - (border + 1) * 6, 0, 6, height)
    .fillRect(0, height - (border + 1) * 5, width, 5);
  const key = `basement-battle:${++textureSequence}`;
  art.generateTexture(key, width, height);
  art.destroy();
  const image = scene.add.image(0, 0, key).setOrigin(0).setDepth(0);
  const ambient = scene.add.graphics().setDepth(1);
  const dust = Array.from({ length: 12 }, () => ({ x: random() * width, y: random() * height, phase: random() * Math.PI * 2 }));
  let elapsed = 0, destroyed = false;
  const resize = (stage: BattleStage) => {
    image.setDisplaySize(stage.width, stage.height);
    ambient.setScale(stage.width / width, stage.height / height);
  };
  resize({ width: scene.scale.width, height: scene.scale.height });
  return {
    resize,
    update(delta, reduced) {
      if (destroyed) return;
      if (!reduced) elapsed += Math.max(0, Math.min(delta, 100));
      const time = reduced ? 0 : elapsed / 1000;
      ambient.clear();
      torches.forEach((torch, index) => {
        const sway = Math.round(Math.sin(time * 4 + index) * 2);
        ambient.fillStyle(0xc27836, .85).fillRect(torch.x - 3 + sway, torch.y - 9, 6, 12);
        ambient.fillStyle(0xe5bc6c, .95).fillRect(torch.x - 1, torch.y - 6, 3, 9);
        ambient.fillStyle(0xf1db9e).fillRect(torch.x, torch.y - 2, 2, 4);
      });
      if (!reduced) dust.forEach(mote => ambient.fillStyle(0xa5b496, .07 + (Math.sin(time + mote.phase) + 1) * .035)
        .fillRect(Math.round(mote.x + Math.sin(time * .3 + mote.phase) * 13), Math.round((mote.y - time * 2 + height * 100) % height), 2, 2));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      ambient.destroy(); image.destroy();
      if (scene.textures.exists(key)) scene.textures.remove(key);
    },
  };
}
