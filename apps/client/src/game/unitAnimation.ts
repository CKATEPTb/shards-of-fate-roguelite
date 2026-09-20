import Phaser from 'phaser';
import type { HeroBody, UnitDefinition } from '@shards/shared';
import { unitFramePixels } from '../art/unitFrames';
import { heroAppearanceKey } from '../art/heroAppearance';
import { UnitAtlasLifetime } from './unitAtlasLifetime';
import { UNIT_CLIPS, UNIT_FACINGS, UNIT_FRAME_SIZE, UNIT_GROUND_ORIGIN, UNIT_MOTIONS, unitFrameName, type UnitFacing, type UnitMotion } from '../art/unitPose';

export { facingFromDelta } from '../art/unitPose';
export type { UnitFacing, UnitMotion } from '../art/unitPose';

type UnitArtDefinition = Pick<UnitDefinition, 'id' | 'sprite' | 'role'>;
interface Playback { motion: UnitMotion; facing: UnitFacing; reduced: boolean }
const playback = new WeakMap<Phaser.GameObjects.Sprite, Playback>();
const idlePhase = new WeakMap<Phaser.GameObjects.Sprite, number>();
const bindings = new WeakMap<Phaser.GameObjects.Sprite, { definition: UnitArtDefinition; enemy: boolean; key: string }>();
const lifetimes = new WeakMap<Phaser.Textures.TextureManager, UnitAtlasLifetime>();

function animationKey(texture: string, facing: UnitFacing, motion: UnitMotion) {
  return `${texture}/${facing}/${motion}`;
}

function atlasLifetime(scene: Phaser.Scene): UnitAtlasLifetime {
  let lifetime = lifetimes.get(scene.textures);
  if (!lifetime) {
    const { textures, anims } = scene;
    lifetime = new UnitAtlasLifetime((key) => {
      for (const facing of UNIT_FACINGS) for (const motion of UNIT_MOTIONS) anims.remove(animationKey(key, facing, motion));
      textures.remove(key);
    });
    lifetimes.set(textures, lifetime);
  }
  return lifetime;
}

/** One small canvas atlas per unit, reused by every instance within a Phaser game. */
export function ensureUnitAtlas(scene: Phaser.Scene, definition: UnitArtDefinition, enemy = false, body?: HeroBody): string {
  const textureKey = `animated-unit-v4:${enemy ? 'enemy' : 'hero'}:${definition.id}${enemy ? '' : `:${heroAppearanceKey(body)}`}`;
  if (scene.textures.exists(textureKey)) return textureKey;
  const framesPerFacing = UNIT_MOTIONS.reduce((sum, motion) => sum + UNIT_CLIPS[motion].frames, 0);
  const columns = 8;
  const width = columns * UNIT_FRAME_SIZE;
  const height = Math.ceil(framesPerFacing * UNIT_FACINGS.length / columns) * UNIT_FRAME_SIZE;
  const texture = scene.textures.createCanvas(textureKey, width, height);
  if (!texture) throw new Error(`Cannot create sprite atlas: ${definition.id}`);
  const context = texture.getContext();
  const image = context.createImageData(width, height);
  const colors = new Map<string, number[]>();
  let index = 0;
  for (const facing of UNIT_FACINGS) {
    for (const motion of UNIT_MOTIONS) {
      const clip = UNIT_CLIPS[motion];
      const animationFrames: { key: string; frame: string }[] = [];
      for (let frame = 0; frame < clip.frames; frame++) {
        const x = (index % columns) * UNIT_FRAME_SIZE;
        const y = Math.floor(index / columns) * UNIT_FRAME_SIZE;
        const frameName = unitFrameName(facing, motion, frame);
        for (const pixel of unitFramePixels(definition.sprite || definition.id, definition.role, enemy, facing, motion, frame, body)) {
          let color = colors.get(pixel.color);
          if (!color) {
            const value = Number.parseInt(pixel.color.slice(1), 16);
            color = [value >>> 16, (value >>> 8) & 255, value & 255, 255];
            colors.set(pixel.color, color);
          }
          image.data.set(color, ((y + pixel.y) * width + x + pixel.x) * 4);
        }
        texture.add(frameName, 0, x, y, UNIT_FRAME_SIZE, UNIT_FRAME_SIZE);
        animationFrames.push({ key: textureKey, frame: frameName });
        index++;
      }
      scene.anims.create({ key: animationKey(textureKey, facing, motion), frames: animationFrames, frameRate: clip.frameRate, repeat: clip.repeat });
    }
  }
  context.putImageData(image, 0, 0);
  texture.refresh();
  return textureKey;
}

/** Position is the shared ground contact, independent of padding or display scale. */
export function createUnitSprite(scene: Phaser.Scene, definition: UnitArtDefinition, enemy = false, x = 0, y = 0, body?: HeroBody): Phaser.GameObjects.Sprite {
  const key = ensureUnitAtlas(scene, definition, enemy, body);
  const sprite = scene.add.sprite(x, y, key, unitFrameName('south', 'idle', 0)).setOrigin(0.5, UNIT_GROUND_ORIGIN);
  const binding = { definition, enemy, key };
  bindings.set(sprite, binding);
  const lifetime = atlasLifetime(scene);
  lifetime.retain(key);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => lifetime.release(binding.key));
  idlePhase.set(sprite, (scene.children.length % 7) / 7);
  sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    const current = playback.get(sprite);
    if (current && ['attack', 'cast', 'hit'].includes(current.motion)) {
      setUnitAnimation(sprite, 'idle', current.facing, current.reduced);
    }
  });
  setUnitAnimation(sprite, 'idle', 'south');
  return sprite;
}

/** Replace the atlas only at a visual injury boundary, preserving the current action. */
export function updateUnitBody(sprite: Phaser.GameObjects.Sprite, body?: HeroBody): void {
  const binding = bindings.get(sprite);
  if (!binding || binding.enemy) return;
  const key = ensureUnitAtlas(sprite.scene, binding.definition, false, body);
  if (key === binding.key) return;
  const lifetime = atlasLifetime(sprite.scene);
  lifetime.retain(key);
  const previous = binding.key;
  binding.key = key;
  const current = playback.get(sprite);
  const progress = sprite.anims.getProgress();
  const playing = sprite.anims.isPlaying;
  sprite.anims.stop();
  sprite.setTexture(key);
  if (current) {
    setUnitAnimation(sprite, current.motion, current.facing, current.reduced, true);
    if (!current.reduced) {
      sprite.anims.setProgress(progress);
      if (!playing) sprite.anims.pause();
    }
  }
  lifetime.release(previous);
}

/** Repeated render updates keep the clip playing instead of restarting frame zero. */
export function setUnitAnimation(sprite: Phaser.GameObjects.Sprite, motion: UnitMotion, facing: UnitFacing, reducedMotion = false, restart = false) {
  const current = playback.get(sprite);
  if (current?.motion === 'death' && motion !== 'death' && !restart) return;
  if (!restart && current?.motion === motion && current.facing === facing && current.reduced === reducedMotion) return;
  const next = { motion, facing, reduced: reducedMotion };
  playback.set(sprite, next);
  if (reducedMotion) {
    sprite.anims.stop();
    const staticMotion = motion === 'walk' ? 'idle' : motion;
    const frame = motion === 'death' ? UNIT_CLIPS.death.frames - 1 : motion === 'attack' || motion === 'cast' ? 2 : 0;
    sprite.setFrame(unitFrameName(facing, staticMotion, frame));
    if (motion === 'attack' || motion === 'cast' || motion === 'hit') {
      sprite.scene.time.delayedCall(250, () => {
        if (sprite.active && playback.get(sprite) === next) setUnitAnimation(sprite, 'idle', facing, true);
      });
    }
  } else {
    sprite.play(animationKey(sprite.texture.key, facing, motion), !restart);
    if (motion === 'idle') sprite.anims.setProgress(idlePhase.get(sprite) ?? 0);
  }
}
