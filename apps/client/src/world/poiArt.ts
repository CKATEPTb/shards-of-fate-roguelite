import type Phaser from 'phaser';

type Art = Phaser.GameObjects.Graphics;

export function drawChest(art: Art, x: number, y: number, open: boolean): void {
  art.fillStyle(0x080e10, .65).fillEllipse(x, y + 8, 35, 15);
  art.fillStyle(0x201a18).fillRect(x - 15, y - 12, 30, 23);
  art.fillStyle(0x664329).fillRect(x - 13, y - 10, 26, 18);
  art.fillStyle(0x93613b).fillRect(x - 12, y - 8, 24, 3).fillRect(x - 12, y + 1, 24, 3);
  art.fillStyle(0x322824).fillRect(x - 11, y - 3, 22, 2).fillRect(x - 11, y + 6, 22, 2);
  art.fillStyle(0x9a8662).fillRect(x - 10, y - 11, 4, 20).fillRect(x + 6, y - 11, 4, 20);
  art.fillStyle(0xcfb783).fillRect(x - 9, y - 10, 1, 17).fillRect(x + 7, y - 10, 1, 17);
  if (open) {
    art.fillStyle(0x2f2621).fillRect(x - 14, y - 27, 28, 15);
    art.fillStyle(0x8b6041).fillRect(x - 12, y - 25, 24, 10);
    art.fillStyle(0xba9b65).fillRect(x - 10, y - 26, 3, 12).fillRect(x + 7, y - 26, 3, 12);
    art.fillStyle(0x151718).fillRect(x - 11, y - 12, 22, 9);
    art.fillStyle(0x5a5040).fillRect(x - 9, y - 6, 18, 2);
  } else {
    art.fillStyle(0x3b2c23).fillRect(x - 14, y - 19, 28, 9);
    art.fillStyle(0xa57547).fillRect(x - 11, y - 21, 22, 5).fillRect(x - 13, y - 16, 26, 3);
    art.fillStyle(0xc0a574).fillRect(x - 9, y - 21, 3, 11).fillRect(x + 6, y - 21, 3, 11);
    art.fillStyle(0xe3c78b).fillRect(x - 3, y - 9, 6, 7);
    art.fillStyle(0x3a3124).fillRect(x - 1, y - 7, 2, 3);
    art.fillStyle(0xe0c17d, .1).fillEllipse(x, y + 3, 39, 21);
  }
  art.fillStyle(0x171d1c).fillRect(x - 12, y + 9, 5, 3).fillRect(x + 7, y + 9, 5, 3);
}

export function drawStairs(art: Art, x: number, y: number, up: boolean): void {
  art.fillStyle(0x0a1015).fillRect(x - 17, y - 18, 34, 34);
  for (let step = 0; step < 5; step++) {
    const width = up ? 27 - step * 3 : 14 + step * 3;
    const sy = y - 14 + step * 6;
    const shade = up ? [0x859089, 0x76827d, 0x66736f, 0x57645f, 0x46544f][step]
      : [0x293535, 0x394747, 0x4b5957, 0x5e6b65, 0x758179][step];
    art.fillStyle(shade).fillRect(x - Math.floor(width / 2), sy, width, 5);
    art.fillStyle(0xa5ada0, .3).fillRect(x - Math.floor(width / 2), sy, width, 1);
    art.fillStyle(0x151f21).fillRect(x - 2 + step % 2 * 6, sy + 1, 1, 3);
  }
  art.fillStyle(0x323e3b).fillRect(x - 18, y - 20, 4, 36).fillRect(x + 14, y - 20, 4, 36);
  art.fillStyle(0x9ba594).fillRect(x - 18, y - 20, 3, 2).fillRect(x + 14, y - 20, 3, 2);
  art.lineStyle(1, 0xd9cda4, .75).beginPath().moveTo(x - 4, y - 7).lineTo(x, y + (up ? -12 : -2)).lineTo(x + 4, y - 7).strokePath();
}

export function drawPortalFrame(art: Art, x: number, y: number): void {
  art.fillStyle(0x192832, .8).fillEllipse(x, y + 8, 50, 21);
  art.fillStyle(0x354246).fillRect(x - 22, y + 3, 44, 9).fillRect(x - 18, y - 2, 36, 6);
  const blocks = [{ x: -22, y: -12, w: 8, h: 17 }, { x: -23, y: -29, w: 8, h: 15 },
    { x: -20, y: -43, w: 9, h: 12 }, { x: -13, y: -52, w: 11, h: 11 },
    { x: -3, y: -55, w: 9, h: 10 }, { x: 7, y: -51, w: 10, h: 11 },
    { x: 15, y: -41, w: 8, h: 12 }, { x: 16, y: -27, w: 8, h: 14 }, { x: 15, y: -11, w: 8, h: 16 }];
  blocks.forEach((block, index) => {
    art.fillStyle(0x18272d).fillRect(x + block.x - 1, y + block.y - 1, block.w + 2, block.h + 2);
    art.fillStyle(index % 2 ? 0x586d70 : 0x465a60).fillRect(x + block.x, y + block.y, block.w, block.h);
    art.fillStyle(0x889990, .7).fillRect(x + block.x + 1, y + block.y, block.w - 2, 2);
    art.fillStyle(0x9bd6d1, .8).fillRect(x + block.x + 3, y + block.y + 4, 2, 4);
  });
}

export function drawPortalVeil(art: Art, x: number, y: number, time: number): void {
  const pulse = .75 + Math.sin(time * 1.7) * .15;
  art.fillStyle(0x59a5cb, .04 * pulse).fillEllipse(x, y - 22, 65, 76);
  art.fillStyle(0x203441, .9).fillEllipse(x, y - 24, 31, 54);
  art.fillStyle(0x558ab0, .28 * pulse).fillEllipse(x, y - 24, 25, 49);
  art.fillStyle(0x96d2d8, .2 * pulse).fillEllipse(x, y - 24, 15, 43);
  for (let index = 0; index < 11; index++) {
    const phase = (time * .13 + index / 11) % 1;
    const angle = index * 2.399 + time * .8;
    const px = x + Math.round(Math.sin(angle) * (9 - phase * 4) / 2) * 2;
    const py = y - 2 - Math.round(phase * 45 / 2) * 2;
    art.fillStyle(index % 3 ? 0x96d9dd : 0xdadbb1, Math.sin(phase * Math.PI) * .85).fillRect(px, py, 2, index % 2 ? 4 : 2);
  }
}
