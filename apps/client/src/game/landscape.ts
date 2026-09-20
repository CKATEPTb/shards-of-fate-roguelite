import Phaser from "phaser";
import { environmentPalettes } from '../art/environment/palette';
import { drawGroundFleck, drawStoneSlab, drawTreeCrown, drawTreeShadow, drawTreeTrunk } from '../art/environment/primitives';

const W = 1000;
const H = 620;
export const BATTLE_CAMPFIRE = { x: 247, y: 483 };

function cosmeticRandom(seed = 9173) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function drawLandscape(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  const random = cosmeticRandom();
  const palette = environmentPalettes.spring;
  g.fillStyle(0x172821).fillRect(0, 0, W, H);
  for (let i = 0; i < 55; i++) {
    g.fillStyle(0x506345, 0.013).fillEllipse(
      510,
      350,
      930 - i * 10,
      590 - i * 7,
    );
  }
  for (let i = 0; i < 2500; i++) {
    const x = Math.floor((random() * W) / 4) * 4;
    const y = Math.floor((random() * H) / 4) * 4;
    drawGroundFleck(g, x, y, palette, Math.floor(random() * 105));
  }
  // Broken stone road disappears between the roots at the far edge.
  for (let row = 0; row < 18; row++) {
    const y = 90 + row * 30;
    const center = 635 - row * 11 + Math.sin(row / 3) * 40;
    for (let col = -2; col <= 2; col++) {
      if (random() < 0.2) continue;
      const x = center + col * 33 + (row % 2) * 12;
      drawStoneSlab(g, x, y, palette, Math.floor(random() * 105));
    }
  }
  // Fallen shrine and broken pillars: a landmark, never a gameplay obstacle.
  g.fillStyle(0x101e19, 0.6).fillEllipse(832, 218, 180, 58);
  g.fillStyle(0x4b584c).fillRect(773, 154, 117, 54);
  g.fillStyle(0x5d6857).fillRect(767, 148, 129, 14);
  g.fillStyle(0x253c2b).fillRect(792, 170, 21, 38).fillRect(848, 170, 21, 38);
  g.fillStyle(0x182d22).fillRect(810, 150, 40, 14);
  [
    [765, 141],
    [889, 169],
    [930, 252],
    [718, 135],
  ].forEach(([x, y], i) => {
    const height = 32 + i * 11;
    g.fillStyle(0x334439).fillRect(x - 4, y - height, 25, height + 5);
    g.fillStyle(0x68745d).fillRect(x, y - height, 16, height);
    g.fillStyle(0x4c5c49).fillRect(x + 8, y - height, 8, height);
    g.fillStyle(0x7a8065).fillRect(x - 4, y - height, 25, 7);
    g.fillStyle(0x425c35).fillRect(x - 4, y - height + 5, 12, 9);
  });
  for (let i = 0; i < 28; i++) {
    const x = 65 + random() * 870,
      y = 75 + random() * 490;
    if (x > 300 && x < 790 && y > 245 && y < 460) continue;
    g.fillStyle(0x192b23).fillEllipse(x, y + 5, 35, 12);
    g.fillStyle(0x65705b).fillRect(x - 9, y - 4, 19, 9);
    g.fillStyle(0x879079, 0.4).fillRect(x - 5, y - 6, 12, 3);
  }

  const tree = (x: number, y: number, scale: number, dark = false) => {
    drawTreeShadow(g, x, y, scale);
    drawTreeTrunk(g, x, y, palette, { scale, dark });
    drawTreeCrown(g, x, y, palette, { scale, dark });
  };
  for (let x = -30; x < 1090; x += 73)
    tree(x, 135 + random() * 25, 1 + random() * 0.3, true);
  [
    [0, 300, 1.4],
    [78, 270, 1.25],
    [176, 185, 1.1],
    [984, 335, 1.5],
    [1055, 441, 1.4],
    [68, 480, 1.5],
    [-18, 580, 1.65],
    [938, 623, 1.65],
    [1070, 626, 1.9],
  ].forEach(([x, y, s]) => tree(x, y, s));

  // The first campfire, warm against the shaded clearing.
  for (let i = 0; i < 20; i++)
    g.fillStyle(0xd29648, 0.008).fillEllipse(
      BATTLE_CAMPFIRE.x,
      BATTLE_CAMPFIRE.y,
      170 - i * 6,
      100 - i * 3,
    );
  g.fillStyle(0x25352a).fillEllipse(247, 493, 70, 20);
  g.fillStyle(0x73806b);
  [
    [220, 484],
    [233, 496],
    [251, 499],
    [268, 488],
    [260, 479],
  ].forEach(([x, y]) => g.fillRect(x, y, 9, 6));
  g.fillStyle(0x594232).fillRect(230, 485, 29, 6).fillRect(240, 480, 24, 6);
  // The same live flame and smoke as exploration sit over these baked logs.
  g.fillStyle(0xa14d2e).fillRect(239, 485, 17, 3);
  // Tiny flowers and distant fireflies supply a little colour without visual noise.
  [
    [330, 204],
    [603, 543],
    [893, 368],
    [168, 354],
    [734, 468],
    [329, 542],
  ].forEach(([x, y]) => {
    g.fillStyle(0x879374)
      .fillRect(x, y, 3, 3)
      .fillRect(x + 10, y + 6, 3, 3);
  });
  // The forest is static. Bake its thousands of pixel primitives once instead
  // of replaying the Graphics command buffer for every animation frame.
  g.generateTexture("forest-landscape", W, H);
  g.destroy();
  scene.add.image(0, 0, "forest-landscape").setOrigin(0).setDepth(0);
  const motes = scene.add.graphics();
  for (let i = 0; i < 22; i++)
    motes
      .fillStyle(0xd5dba3, random() * 0.45 + 0.1)
      .fillRect(140 + random() * 720, 120 + random() * 380, 2, 2);
  motes.setDepth(1);
  return motes;
}
