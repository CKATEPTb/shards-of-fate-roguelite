import { drawEnemy } from './enemySprites';
import { drawBoss } from './bossSprites';
import { ENEMY_FOOT_Y, ENEMY_FRAME_SIZE, getEnemyAppearance } from './enemyAppearance';
import { drawHeroParts } from './heroParts';
import { getHeroRig, HERO_FRAME_SIZE, HERO_FOOT_Y } from './heroRig';
import { resolveHeroVisualLoadout, type HeroVisualLoadout } from './heroLoadout';
import { HERO_ART_IDS } from './heroOutfit';
import type { HeroBody } from '@shards/shared';
import { PixelCanvas, type Pixel } from './pixelCanvas';
import { UNIT_CLIPS, UNIT_FRAME_SIZE, unitPose, type UnitFacing, type UnitMotion } from './unitPose';

const heroIds = new Set<string>(HERO_ART_IDS);

/** Higher detail keeps a consistent ground anchor and logical on-screen footprint. */
export function unitFrameMetrics(enemy = false) {
  return enemy
    ? { size: ENEMY_FRAME_SIZE, footY: ENEMY_FOOT_Y, displayScale: UNIT_FRAME_SIZE / ENEMY_FRAME_SIZE }
    : { size: HERO_FRAME_SIZE, footY: HERO_FOOT_Y, displayScale: UNIT_FRAME_SIZE / HERO_FRAME_SIZE };
}

export function resolveUnitArt(sprite: string, role: string, enemy: boolean): string {
  if (enemy ? getEnemyAppearance(sprite) : heroIds.has(sprite)) return sprite;
  return enemy ? 'goblin_scout' : role === 'tank' ? 'guardian' : role === 'healer' ? 'priest' : 'mage';
}

function collapse(pixels: Pixel[], frame: number, id: string): Pixel[] {
  if (!pixels.length) return pixels;
  const progress = frame / (UNIT_CLIPS.death.frames - 1);
  const result = new PixelCanvas(ENEMY_FRAME_SIZE);
  const profile = getEnemyAppearance(id);
  const soft = profile && ['larva', 'leech', 'spider', 'wyrm', 'wraith'].includes(profile.form);
  const center = ENEMY_FRAME_SIZE / 2;
  const falling = pixels.map((pixel) => {
    if (soft) {
      return { ...pixel, x: Math.round(center + (pixel.x - center) * (1 + progress * 0.06)), y: Math.round(ENEMY_FOOT_Y + (pixel.y - ENEMY_FOOT_Y) * (1 - progress * 0.76)) };
    } else {
      // Broad bodies buckle to their knees, keeping antlers/wings inside the atlas.
      const x = pixel.x - center, y = pixel.y - ENEMY_FOOT_Y;
      return { ...pixel, x: Math.round(center + x * (1 - progress * .13) + Math.sin(-y / 14) * progress * 2),
        y: Math.round(ENEMY_FOOT_Y + y * (1 - progress * .72) + x * progress * .06) };
    }
  });
  // Fallen bodies settle on the same floor; normalize before clipping the atlas.
  const groundOffset = ENEMY_FOOT_Y - 1 - Math.max(...falling.map((pixel) => pixel.y));
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
  const pose = unitPose(motion === 'attackLeft' ? 'attack' : motion, frame);
  const profile = getEnemyAppearance(id)!;
  const art = new PixelCanvas(ENEMY_FRAME_SIZE);
  if (profile.boss) drawBoss(art, profile, drawingFacing, pose);
  else drawEnemy(art, profile, drawingFacing, pose);
  let result = art.result();
  if (motion === 'death') result = collapse(result, pose.frame, id);
  if (facing === 'west') result = result.map((pixel) => ({ ...pixel, x: ENEMY_FRAME_SIZE - 1 - pixel.x }));
  return result.sort((left, right) => left.y - right.y || left.x - right.x);
}
