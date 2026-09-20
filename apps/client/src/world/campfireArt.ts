import type Phaser from 'phaser';

export const FLAME_FRAMES = 16;
export const FLAME_FRAME_MS = 80;
export const FLAME_ANCHOR = { x: 16, y: 34 };
export const FLAME_SIZE = { width: 32, height: 40 };
export const flameTexture = (frame: number) => `campfire-flame:v1:${frame}`;

/** The base stays on the logs; only the tapered tips bend and change height. */
function tongue(art: Phaser.GameObjects.Graphics, x: number, height: number, width: number, bend: number, color: number) {
  art.fillStyle(color);
  for (let rise = 0; rise < height; rise += 2) {
    const progress = rise / height;
    const centre = x + bend * progress ** 1.4;
    const halfWidth = Math.max(1, width * (1 - progress) ** 0.7);
    const left = Math.round((centre - halfWidth) / 2) * 2;
    const right = Math.round((centre + halfWidth) / 2) * 2;
    art.fillRect(left, FLAME_ANCHOR.y - rise - 2, Math.max(2, right - left), 2);
  }
}

/** A small shared frame bank avoids rebuilding graphics in the animation loop. */
export function ensureCampfireArt(scene: Phaser.Scene): void {
  if (scene.textures.exists(flameTexture(0))) return;
  const art = scene.make.graphics({ x: 0, y: 0 });
  for (let frame = 0; frame < FLAME_FRAMES; frame++) {
    art.clear();
    const phase = frame / FLAME_FRAMES * Math.PI * 2;
    const bend = Math.sin(phase) * 3;
    const height = 24 + Math.sin(phase * 2) * 3;
    tongue(art, 10, 15 + Math.sin(phase + 1) * 3, 4, -3 + bend, 0xc5542f);
    tongue(art, 23, 17 + Math.sin(phase + 3) * 3, 4, 2 + bend, 0xd96b30);
    tongue(art, 16, height + 2, 7, bend, 0xe78134);
    tongue(art, 11, 12 + Math.sin(phase + 1) * 3, 3, -2 + bend, 0xffb04e);
    tongue(art, 22, 14 + Math.sin(phase + 3) * 3, 3, 1 + bend, 0xffb04e);
    tongue(art, 16, height - 4, 5, bend, 0xffc565);
    tongue(art, 16, 10 + Math.sin(phase + 2) * 2, 3, -bend / 2, 0xffecc0);
    art.generateTexture(flameTexture(frame), FLAME_SIZE.width, FLAME_SIZE.height);
  }
  art.destroy();
}
