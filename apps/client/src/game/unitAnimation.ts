import Phaser from 'phaser';
import type { HeroBody, UnitDefinition } from '@shards/shared';
import { resolveUnitArt, unitFrameMetrics, unitFramePixels } from '../art/unitFrames';
import { heroAppearanceKey } from '../art/heroAppearance';
import { heroLoadoutKey, heroVisualItem, resolveHeroVisualLoadout, type HeroRenderState, type HeroVisualLoadout, type ResolvedHeroLoadout } from '../art/heroLoadout';
import { getHeroRig } from '../art/heroRig';
import type { HeroRig, HeroSocket, HeroSocketName } from '../art/heroRigTypes';
import { UnitAtlasLifetime } from './unitAtlasLifetime';
import { UNIT_CLIPS, UNIT_FACINGS, UNIT_MOTIONS, unitFrameName, type UnitFacing, type UnitMotion } from '../art/unitPose';

export { facingFromDelta } from '../art/unitPose';
export type { UnitFacing, UnitMotion } from '../art/unitPose';

type UnitArtDefinition = Pick<UnitDefinition, 'id' | 'sprite' | 'role' | 'anatomy'>;
interface Playback { motion: UnitMotion; facing: UnitFacing; reduced: boolean }
interface UnitBinding {
  definition: UnitArtDefinition;
  enemy: boolean;
  key: string;
  appearanceKey: string;
  body?: HeroBody;
  equipment?: HeroVisualLoadout;
  loadout: ResolvedHeroLoadout;
  socketFrame?: string;
  rig?: HeroRig;
}
const playback = new WeakMap<Phaser.GameObjects.Sprite, Playback>();
const idlePhase = new WeakMap<Phaser.GameObjects.Sprite, number>();
const bindings = new WeakMap<Phaser.GameObjects.Sprite, UnitBinding>();
const lifetimes = new WeakMap<Phaser.Textures.TextureManager, UnitAtlasLifetime>();

function animationKey(texture: string, facing: UnitFacing, motion: UnitMotion) {
  return `${texture}/${facing}/${motion}`;
}

function returnsToIdle(motion: UnitMotion): boolean {
  return motion !== 'death' && UNIT_CLIPS[motion].repeat === 0;
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
export function ensureUnitAtlas(scene: Phaser.Scene, definition: UnitArtDefinition, enemy = false, body?: HeroBody, equipment?: HeroVisualLoadout): string {
  const loadout = resolveHeroVisualLoadout(definition, equipment);
  const artId = resolveUnitArt(definition.sprite || definition.id, definition.role, enemy);
  const textureKey = `animated-unit-v19:${enemy ? 'enemy' : 'hero'}:${artId}${enemy ? '' : `:${heroAppearanceKey(body)}:${heroLoadoutKey(loadout)}`}`;
  if (scene.textures.exists(textureKey)) return textureKey;
  const framesPerFacing = UNIT_MOTIONS.reduce((sum, motion) => sum + UNIT_CLIPS[motion].frames, 0);
  const columns = 8;
  const { size } = unitFrameMetrics(enemy);
  const width = columns * size;
  const height = Math.ceil(framesPerFacing * UNIT_FACINGS.length / columns) * size;
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
        const x = (index % columns) * size;
        const y = Math.floor(index / columns) * size;
        const frameName = unitFrameName(facing, motion, frame);
        for (const pixel of unitFramePixels(artId, definition.role, enemy, facing, motion, frame, body, loadout)) {
          let color = colors.get(pixel.color);
          if (!color) {
            const value = Number.parseInt(pixel.color.slice(1), 16);
            color = [value >>> 16, (value >>> 8) & 255, value & 255, 255];
            colors.set(pixel.color, color);
          }
          image.data.set(color, ((y + pixel.y) * width + x + pixel.x) * 4);
        }
        texture.add(frameName, 0, x, y, size, size);
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
export function createUnitSprite(scene: Phaser.Scene, definition: UnitArtDefinition, enemy = false, x = 0, y = 0, body?: HeroBody, equipment?: HeroVisualLoadout): Phaser.GameObjects.Sprite {
  const key = ensureUnitAtlas(scene, definition, enemy, body, equipment);
  const metrics = unitFrameMetrics(enemy);
  const sprite = scene.add.sprite(x, y, key, unitFrameName('south', 'idle', 0)).setOrigin(0.5, metrics.footY / metrics.size).setScale(metrics.displayScale);
  const binding: UnitBinding = { definition, enemy, key, appearanceKey: heroAppearanceKey(body), body,
    equipment: equipment ? { ...equipment } : undefined, loadout: resolveHeroVisualLoadout(definition, equipment) };
  bindings.set(sprite, binding);
  const lifetime = atlasLifetime(scene);
  lifetime.retain(key);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => lifetime.release(binding.key));
  idlePhase.set(sprite, (scene.children.length % 7) / 7);
  sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    const current = playback.get(sprite);
    if (current && returnsToIdle(current.motion)) {
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
  if (binding.appearanceKey === heroAppearanceKey(body)) { binding.body = body; return; }
  updateUnitAppearance(sprite, { body, equipment: binding.equipment });
}

/** Equipment definitions can change while the world actor and its animation stay alive. */
export function updateUnitDefinition(sprite: Phaser.GameObjects.Sprite, definition: UnitArtDefinition, body?: HeroBody): void {
  const binding = bindings.get(sprite);
  if (!binding || binding.enemy) return;
  if (binding.definition === definition) { updateUnitBody(sprite, body); return; }
  binding.definition = definition;
  updateUnitAppearance(sprite, { body, equipment: binding.equipment });
}

/** Appearance changes reuse pose atlases; gameplay and effect updates never rebake them. */
export function updateUnitAppearance(sprite: Phaser.GameObjects.Sprite, state: HeroRenderState): void {
  const binding = bindings.get(sprite);
  if (!binding || binding.enemy) return;
  binding.body = state.body;
  binding.appearanceKey = heroAppearanceKey(state.body);
  binding.equipment = state.equipment ? { ...state.equipment } : undefined;
  binding.loadout = resolveHeroVisualLoadout(binding.definition, binding.equipment);
  const key = ensureUnitAtlas(sprite.scene, binding.definition, false, state.body, binding.loadout);
  if (key === binding.key) return;
  binding.socketFrame = undefined;
  binding.rig = undefined;
  const lifetime = atlasLifetime(sprite.scene);
  lifetime.retain(key);
  const previous = binding.key;
  binding.key = key;
  const current = playback.get(sprite);
  const progress = sprite.anims.getProgress();
  const previousFrame = sprite.frame.name;
  const playing = sprite.anims.isPlaying;
  sprite.anims.stop();
  sprite.setTexture(key, previousFrame);
  if (current) {
    setUnitAnimation(sprite, current.motion, current.facing, current.reduced, true);
    if (!current.reduced) {
      sprite.anims.setProgress(progress);
      if (!playing) sprite.anims.pause();
    }
  }
  lifetime.release(previous);
}

/** Logical game scale is unchanged when a hero atlas has twice the resolution. */
export function setUnitScale(sprite: Phaser.GameObjects.Sprite, scale: number): Phaser.GameObjects.Sprite {
  const binding = bindings.get(sprite);
  return sprite.setScale(scale * unitFrameMetrics(binding?.enemy ?? false).displayScale);
}

/** A complete left/right stride spans about one tile at the normal world scale. */
export function setUnitWalkDistance(sprite: Phaser.GameObjects.Sprite, facing: UnitFacing, distance: number, reducedMotion = false): void {
  if (playback.get(sprite)?.motion === 'death') return;
  setUnitAnimation(sprite, 'walk', facing, reducedMotion);
  if (reducedMotion) return;
  const binding = bindings.get(sprite);
  const metrics = unitFrameMetrics(binding?.enemy ?? false);
  // Twenty logical pixels per cycle scales naturally with heroes and larger mobs.
  // Distance and sprite scale are both in world space, so camera zoom is irrelevant.
  const stride = 20 * Math.abs(sprite.scaleY) / metrics.displayScale;
  const cycles = Math.max(0, distance) / Math.max(1, stride);
  const frame = Math.floor((cycles % 1) * UNIT_CLIPS.walk.frames);
  // Movement owns the phase. Phaser's clock must not add steps at stops or turns.
  const animationFrame = sprite.anims.currentAnim?.frames[frame];
  sprite.anims.pause(sprite.anims.currentFrame === animationFrame ? undefined : animationFrame);
}

/** Casting effects follow the equipped casting implement in either hand. */
export function unitCastingHand(sprite: Phaser.GameObjects.Sprite): 'rightHand' | 'leftHand' {
  const binding = bindings.get(sprite);
  if (!binding || binding.enemy) return 'rightHand';
  const hands = (['rightHand', 'leftHand'] as const).filter(slot => {
    const part = slot === 'rightHand' ? 'rightArm' : 'leftArm';
    return !binding.body || binding.body[part].current > 0;
  });
  return hands.find(slot => ['wand', 'staff'].includes(heroVisualItem(binding.loadout[slot], slot)?.weaponKind ?? ''))
    ?? hands.find(slot => {
      const kind = heroVisualItem(binding.loadout[slot], slot)?.weaponKind;
      return kind && kind !== 'shield';
    }) ?? hands[0] ?? 'rightHand';
}

/** Blocking follows equipped hands, including shields equipped in the right hand. */
export function unitBlockMotion(sprite: Phaser.GameObjects.Sprite): 'block' | 'shieldBlock' {
  const binding = bindings.get(sprite);
  if (!binding || binding.enemy) return 'block';
  return (['rightHand', 'leftHand'] as const).some(slot => {
    const part = slot === 'rightHand' ? 'rightArm' : 'leftArm';
    return (!binding.body || binding.body[part].current > 0) && heroVisualItem(binding.loadout[slot], slot)?.weaponKind === 'shield';
  }) ? 'shieldBlock' : 'block';
}

/** Socket in the sprite's parent coordinates, ready for another object in that container. */
export function getUnitSocket(sprite: Phaser.GameObjects.Sprite, name: HeroSocketName): HeroSocket | undefined {
  const binding = bindings.get(sprite);
  if (!binding) return undefined;
  const frameName = String(sprite.frame.name);
  const [rawFacing, rawMotion, rawFrame] = frameName.split(':');
  const facing = UNIT_FACINGS.includes(rawFacing as UnitFacing) ? rawFacing as UnitFacing : 'south';
  const motion = UNIT_MOTIONS.includes(rawMotion as UnitMotion) ? rawMotion as UnitMotion : 'idle';
  const frame = Number(rawFrame) || 0;
  let socket: HeroSocket | undefined;
  if (binding.enemy) {
    const { size, footY } = unitFrameMetrics(true);
    const x = name === 'rightHand' ? 22 : name === 'leftHand' ? 10 : size / 2;
    socket = { x: facing === 'west' ? size - 1 - x : x,
      y: name === 'ground' ? footY : name === 'head' ? 10 : name === 'chest' ? 18 : 20, rotation: 0 };
  } else {
    if (binding.socketFrame !== frameName || !binding.rig) {
      binding.rig = getHeroRig(resolveUnitArt(binding.definition.sprite || binding.definition.id, binding.definition.role, false), facing, motion, frame, binding.body, binding.loadout);
      binding.socketFrame = frameName;
    }
    socket = binding.rig.sockets[name];
  }
  if (!socket) return undefined;
  const metrics = unitFrameMetrics(binding.enemy);
  const localX = (socket.x - sprite.originX * metrics.size) * sprite.scaleX * (sprite.flipX ? -1 : 1);
  const localY = (socket.y - sprite.originY * metrics.size) * sprite.scaleY * (sprite.flipY ? -1 : 1);
  const cos = Math.cos(sprite.rotation), sin = Math.sin(sprite.rotation);
  // Socket angles are measured clockwise from upright, including mirrored items.
  const axisX = Math.sin(socket.rotation) * sprite.scaleX * (sprite.flipX ? -1 : 1);
  const axisY = -Math.cos(socket.rotation) * sprite.scaleY * (sprite.flipY ? -1 : 1);
  return { x: sprite.x + localX * cos - localY * sin, y: sprite.y + localX * sin + localY * cos,
    rotation: Math.atan2(axisX, -axisY) + sprite.rotation };
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
    const frame = motion === 'death' ? UNIT_CLIPS.death.frames - 1
      : returnsToIdle(motion) ? Math.floor(UNIT_CLIPS[motion].frames / 2) : 0;
    sprite.setFrame(unitFrameName(facing, staticMotion, frame));
    if (returnsToIdle(motion)) {
      sprite.scene.time.delayedCall(250, () => {
        if (sprite.active && playback.get(sprite) === next) setUnitAnimation(sprite, 'idle', facing, true);
      });
    }
  } else {
    sprite.play(animationKey(sprite.texture.key, facing, motion), !restart);
    if (motion === 'idle') sprite.anims.setProgress(idlePhase.get(sprite) ?? 0);
  }
}
