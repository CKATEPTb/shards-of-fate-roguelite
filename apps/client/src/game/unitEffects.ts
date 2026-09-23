import Phaser from 'phaser';
import type { HeroSocketName } from '../art/heroRigTypes';
import { getUnitSocket, unitCastingHand } from './unitAnimation';
import { drawPersistentAuras, hasPersistentAura, persistentAuraStateKey, type AuraVisualState } from './auraVisuals';

export type UnitEffectKind = 'cast' | 'heal' | 'shield' | 'fire' | 'block';
export interface UnitEffectState extends AuraVisualState { dead: boolean }
interface Mote { socket: HeroSocketName; age: number; life: number; index: number; color: number }

const MAX_MOTES = 12;
const DRAW_INTERVAL = 50;
const EMPTY_STATE: UnitEffectState = { shield: false, burning: false, poisoned: false, dead: false };

/** Two reusable drawing layers, no emitters, textures, timers or gameplay RNG. */
export class UnitEffects {
  readonly rear: Phaser.GameObjects.Graphics;
  readonly front: Phaser.GameObjects.Graphics;
  private state: UnitEffectState = EMPTY_STATE;
  private stateKey = '';
  private poseKey = '';
  private persistent = false;
  private particles: Mote[] = [];
  private clock = 0;
  private sinceDraw = 0;
  private castRemaining = 0;
  private healRemaining = 0;
  private castColor = 0xb9d6dd;
  private burstRemaining = 0;
  private burstColor = 0xcbdba5;
  private burstKind: 'rays' | 'flame' | 'guard' | 'leaves' = 'rays';
  private serial = 0;
  private reduced = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, private readonly sprite: Phaser.GameObjects.Sprite) {
    this.rear = scene.add.graphics();
    this.front = scene.add.graphics();
    sprite.once(Phaser.GameObjects.Events.DESTROY, this.destroy, this);
  }

  setState(state: UnitEffectState, reduced = this.reduced): void {
    if (this.destroyed) return;
    const key = `${state.dead}|${persistentAuraStateKey(state)}`;
    const changed = key !== this.stateKey;
    const reducedChanged = this.reduced !== reduced;
    if (changed) { this.state = state; this.stateKey = key; this.persistent = hasPersistentAura(state); }
    this.reduced = reduced;
    if ((state.dead && changed) || reducedChanged) this.clear();
    if (changed || reducedChanged) this.draw();
  }

  trigger(kind: UnitEffectKind, color?: number): void {
    if (this.destroyed || this.state.dead || !this.sprite.active) return;
    if (kind === 'cast') { this.castRemaining = 560; this.castColor = color ?? 0xb9d6dd; }
    if (kind === 'heal') this.healRemaining = 620;
    if (kind === 'fire' || kind === 'block') {
      this.burstRemaining = 650;
      this.burstColor = kind === 'fire' ? 0xe49351 : 0xe1c68e;
      this.burstKind = kind === 'fire' ? 'flame' : 'guard';
    }
    if (!this.reduced) {
      const socket: HeroSocketName = kind === 'cast' ? unitCastingHand(this.sprite) : kind === 'shield' ? 'ground' : 'chest';
      const count = kind === 'shield' ? 4 : 6;
      for (let i = 0; i < count; i++) {
        this.particles.push({ socket, age: i * -28, life: 620 + i * 30, index: this.serial++,
          color: color ?? (kind === 'heal' ? 0xcadf9a : kind === 'shield' ? 0x94c6cb : this.castColor) });
      }
      if (this.particles.length > MAX_MOTES) this.particles.splice(0, this.particles.length - MAX_MOTES);
    }
    this.draw();
  }

  /** Skill-specific release, followed by persistent effects driven by presented aura state. */
  triggerSkill(skillId: string): void {
    const profiles: Record<string, [number, 'rays' | 'flame' | 'guard' | 'leaves']> = {
      tank_taunt: [0xd8ad74, 'guard'], guardian_bastion: [0xe3c17c, 'guard'],
      vampire_bloodlust: [0xc6657e, 'flame'], paladin_radiance: [0xf0d792, 'rays'],
      healer_mend: [0xc4dca1, 'rays'], druid_regrowth: [0xa4c97e, 'leaves'],
      ranger_volley: [0xc5d8b5, 'leaves'], rogue_precision: [0xcad8e1, 'guard'],
      mage_ignite: [0xf0a160, 'flame'], necromancer_ward: [0xc7b692, 'leaves'],
      priest_prayer: [0xf0d790, 'rays'], damage_burst: [0xd9b999, 'rays'],
    };
    const profile = profiles[skillId];
    if (!profile || this.state.dead) return;
    this.trigger('cast', profile[0]);
    this.burstColor = profile[0];
    this.burstKind = profile[1];
    this.burstRemaining = 650;
    this.draw();
  }

  update(delta: number, reduced = this.reduced): void {
    if (this.destroyed || !this.sprite.active) return;
    if (reduced !== this.reduced) { this.reduced = reduced; this.clear(); }
    if (this.state.dead) return;
    const hadTransient = Boolean(this.castRemaining || this.healRemaining || this.burstRemaining || this.particles.length);
    if (!this.persistent && !hadTransient) return;
    const elapsed = Math.max(0, Math.min(delta, 100));
    this.clock += elapsed;
    this.sinceDraw += elapsed;
    this.castRemaining = Math.max(0, this.castRemaining - elapsed);
    this.healRemaining = Math.max(0, this.healRemaining - elapsed);
    this.burstRemaining = Math.max(0, this.burstRemaining - elapsed);
    for (const mote of this.particles) mote.age += elapsed;
    this.particles = this.particles.filter(mote => mote.age < mote.life);
    if (hadTransient && !this.castRemaining && !this.healRemaining && !this.burstRemaining && !this.particles.length) { this.draw(); return; }
    if (this.sinceDraw >= DRAW_INTERVAL) {
      this.sinceDraw %= DRAW_INTERVAL;
      const transient = this.castRemaining || this.healRemaining || this.burstRemaining || this.particles.length;
      // A reduced-motion scene keeps a real static frame instead of repainting it twenty times a second.
      if (!this.reduced || transient || hadTransient || this.poseKey !== this.currentPoseKey()) this.draw();
    }
  }

  clear(): void {
    this.particles = [];
    this.castRemaining = this.healRemaining = this.burstRemaining = 0;
    this.poseKey = '';
    if (!this.destroyed) { this.rear.clear(); this.front.clear(); }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
    this.sprite.off(Phaser.GameObjects.Events.DESTROY, this.destroy, this);
    if (this.rear.scene) this.rear.destroy();
    if (this.front.scene) this.front.destroy();
  }

  private draw(): void {
    if (this.destroyed) return;
    this.poseKey = this.currentPoseKey();
    const back = this.rear.clear(), front = this.front.clear();
    if (this.state.dead || !this.sprite.active) return;
    if (!hasPersistentAura(this.state) && !this.castRemaining && !this.healRemaining && !this.burstRemaining && !this.particles.length) return;
    const ground = getUnitSocket(this.sprite, 'ground');
    const chest = getUnitSocket(this.sprite, 'chest');
    const hand = getUnitSocket(this.sprite, unitCastingHand(this.sprite));
    const scale = Math.max(0.25, this.sprite.displayHeight / 32);
    if (ground) drawPersistentAuras({ rear: back, front, x: ground.x, y: ground.y, scale,
      time: this.reduced ? 1.37 : this.clock / 1000, reduced: this.reduced }, this.state);
    if (this.castRemaining && hand) {
      const strength = Math.min(1, this.castRemaining / 160);
      front.fillStyle(this.castColor, 0.13 * strength).fillCircle(hand.x, hand.y, 7 * scale);
      front.lineStyle(Math.max(1, scale * 0.6), this.castColor, 0.65 * strength).strokeCircle(hand.x, hand.y, 4 * scale);
      front.fillStyle(0xf0e8d0, 0.85 * strength).fillRect(Math.round(hand.x - scale), Math.round(hand.y - scale), 2 * scale, 2 * scale);
    }
    if (this.healRemaining && chest) {
      const strength = Math.min(1, this.healRemaining / 220);
      back.fillStyle(0xb8cb82, 0.12 * strength).fillCircle(chest.x, chest.y, 10 * scale);
      front.lineStyle(Math.max(1, scale * 0.7), 0xd2e4a4, 0.45 * strength).strokeCircle(chest.x, chest.y, 5 * scale);
    }
    if (this.burstRemaining && chest && ground) this.drawBurst(front, back, chest, ground, scale);
    if (this.reduced) return;
    for (const mote of this.particles) {
      if (mote.age < 0) continue;
      const socket = getUnitSocket(this.sprite, mote.socket);
      if (!socket) continue;
      const progress = mote.age / mote.life;
      const side = mote.index % 2 ? 1 : -1;
      const x = socket.x + (side * (2 + mote.index % 4) + Math.sin(progress * 5 + mote.index) * 3) * scale;
      const y = socket.y + (3 - progress * 16) * scale;
      front.fillStyle(mote.color, (1 - progress) * 0.8).fillRect(Math.round(x), Math.round(y), Math.max(1, scale), Math.max(1, scale));
    }
  }

  private currentPoseKey(): string {
    return [this.sprite.frame.name, this.sprite.x, this.sprite.y, this.sprite.scaleX, this.sprite.scaleY,
      this.sprite.rotation, this.sprite.flipX, this.sprite.flipY].join('|');
  }

  private drawBurst(front: Phaser.GameObjects.Graphics, back: Phaser.GameObjects.Graphics,
    chest: { x: number; y: number }, ground: { x: number; y: number }, scale: number): void {
    const phase = this.reduced ? 0.55 : 1 - this.burstRemaining / 650;
    const alpha = Math.sin(phase * Math.PI) * 0.7;
    back.fillStyle(this.burstColor, alpha * 0.12).fillEllipse(chest.x, chest.y, 27 * scale, 29 * scale);
    if (this.burstKind === 'guard') {
      front.lineStyle(Math.max(1, scale * 0.6), this.burstColor, alpha * 0.5)
        .strokeEllipse(ground.x, ground.y - scale, (18 + phase * 24) * scale, (4 + phase * 5) * scale);
    }
    const origin = this.burstKind === 'guard' ? ground : chest;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6 + (this.burstKind === 'leaves' ? phase * 1.8 : 0);
      const radius = 3 + phase * (this.burstKind === 'flame' ? 12 : 18);
      const x = origin.x + Math.cos(angle) * radius * scale;
      const y = origin.y + (Math.sin(angle) * radius * (this.burstKind === 'guard' ? 0.27 : 0.65) - phase * 4) * scale;
      const g = Math.sin(angle) < 0 ? back : front;
      g.fillStyle(this.burstColor, alpha).fillRect(Math.round(x), Math.round(y), Math.max(1, scale), Math.max(1, scale));
      if (this.burstKind === 'rays' || this.burstKind === 'flame') {
        g.lineStyle(Math.max(1, scale * 0.7), this.burstColor, alpha * 0.42)
          .lineBetween(x, y, x - Math.cos(angle) * 4 * scale, y - Math.sin(angle) * 3 * scale);
      } else if (this.burstKind === 'leaves') {
        g.fillStyle(0xf0dfb1, alpha * 0.75).fillRect(Math.round(x + scale), Math.round(y - scale), Math.max(1, scale * 1.5), Math.max(1, scale));
      }
    }
  }
}
