import { drawNature, drawQuadruped, drawSlime, drawSpider } from './creatureSprites';
import { drawHumanoid } from './humanoidSprites';
import { drawHeroParts } from './heroParts';
import { getHeroRig, HERO_FRAME_SIZE, HERO_FOOT_Y } from './heroRig';
import { resolveHeroVisualLoadout, type HeroVisualLoadout } from './heroLoadout';
import { HERO_ART_IDS } from './heroOutfit';
import type { HeroBody } from '@shards/shared';
import { PixelCanvas, type Pixel } from './pixelCanvas';
import { unitPalette } from './unitPalette';
import { UNIT_CLIPS, UNIT_FOOT_Y, UNIT_FRAME_SIZE, unitPose, type UnitFacing, type UnitMotion } from './unitPose';

const heroIds = new Set<string>(HERO_ART_IDS);
const enemyIds = new Set(['rat', 'wolf', 'slime', 'spider', 'goblin_scout', 'goblin_archer', 'goblin_shaman', 'boar', 'thornling', 'elite_warden']);

/** Higher hero detail keeps the same ground anchor and logical on-screen footprint. */
export function unitFrameMetrics(enemy = false) {
  return enemy
    ? { size: UNIT_FRAME_SIZE, footY: UNIT_FOOT_Y, displayScale: 1 }
    : { size: HERO_FRAME_SIZE, footY: HERO_FOOT_Y, displayScale: UNIT_FRAME_SIZE / HERO_FRAME_SIZE };
}

export function resolveUnitArt(sprite: string, role: string, enemy: boolean): string {
  if ((enemy ? enemyIds : heroIds).has(sprite)) return sprite;
  return enemy ? 'goblin_scout' : role === 'tank' ? 'guardian' : role === 'healer' ? 'priest' : 'mage';
}

function collapse(pixels: Pixel[], frame: number, id: string): Pixel[] {
  if (!pixels.length) return pixels;
  const progress = frame / (UNIT_CLIPS.death.frames - 1);
  const result = new PixelCanvas();
  const soft = id === 'slime' || id === 'spider';
  const falling = pixels.map((pixel) => {
    if (soft) {
      return { ...pixel, x: Math.round(16 + (pixel.x - 16) * (1 + progress * 0.12)), y: Math.round(UNIT_FOOT_Y + (pixel.y - UNIT_FOOT_Y) * (1 - progress * 0.76)) };
    } else {
      const angle = progress * Math.PI / 2;
      const x = pixel.x - 16;
      const y = pixel.y - 27;
      // Move the pivot as the unit falls so tall silhouettes remain inside the frame.
      return { ...pixel, x: Math.round(16 - progress * 9 + x * Math.cos(angle) - y * Math.sin(angle) * 0.8),
        y: Math.round(26 + x * Math.sin(angle) * 0.5 + y * Math.cos(angle)) };
    }
  });
  // Fallen bodies settle on the same floor; normalize before clipping the atlas.
  const groundOffset = UNIT_FOOT_Y - 1 - Math.max(...falling.map((pixel) => pixel.y));
  for (const pixel of falling) result.point(pixel.x, pixel.y + groundOffset, pixel.color);
  return result.result();
}

/** Code-native art: no Phaser, DOM, clock or random input enters frame generation. */
export function unitFramePixels(
  sprite: string,
  role: string,
  enemy = false,
  facing: UnitFacing = 'south',
  motion: UnitMotion = 'idle',
  frame = 0,
  body?: HeroBody,
  equipment?: HeroVisualLoadout,
): Pixel[] {
  const id = resolveUnitArt(sprite, role, enemy);
  if (!enemy) {
    const art = new PixelCanvas(HERO_FRAME_SIZE);
    const loadout = resolveHeroVisualLoadout({ id, sprite: id, role: role === 'tank' || role === 'healer' ? role : 'damage' }, equipment);
    drawHeroParts(art, getHeroRig(id, facing, motion, frame, body, loadout), loadout);
    return art.result();
  }
  const drawingFacing = facing === 'west' ? 'east' : facing;
  const pose = unitPose(motion === 'cast' || motion === 'attackLeft' ? 'attack' : motion, frame);
  const p = unitPalette(id);
  const art = new PixelCanvas(UNIT_FRAME_SIZE);
  if (['rat', 'wolf', 'boar'].includes(id)) drawQuadruped(art, id, drawingFacing, pose, p);
  else if (id === 'slime') drawSlime(art, drawingFacing, pose, p);
  else if (id === 'spider') drawSpider(art, drawingFacing, pose, p);
  else if (id === 'thornling' || id === 'elite_warden') drawNature(art, id, drawingFacing, pose, p);
  else drawHumanoid(art, id, drawingFacing, pose, p);
  let result = art.result();
  if (motion === 'death') result = collapse(result, pose.frame, id);
  if (facing === 'west') result = result.map((pixel) => ({ ...pixel, x: UNIT_FRAME_SIZE - 1 - pixel.x }));
  return result.sort((left, right) => left.y - right.y || left.x - right.x);
}
