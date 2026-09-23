import type Phaser from 'phaser';
import type { ProjectileKind } from '@shards/shared';
import { drawProjectile, drawProjectileImpact, projectilePoint } from './projectileVisuals';

interface Point { x: number; y: number }
export interface SpellBolt { from: Point; to: Point; age: number; duration: number; serial: number; kind: ProjectileKind }

/** Every release owns one bounded flight and impact; no gameplay randomness. */
export class SkillProjectiles {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private bolts: SpellBolt[] = [];
  private serial = 0;
  private sinceDraw = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(900);
  }

  fire(from: Point, to: Point, duration: number, kind: ProjectileKind = 'fire'): void {
    this.bolts.push({ from: { ...from }, to: { ...to }, age: 0, duration: Math.max(80, duration), serial: this.serial++, kind });
    if (this.bolts.length > 12) this.bolts.shift();
  }

  update(delta: number, reduced: boolean): void {
    const elapsed = Math.max(0, delta);
    for (const bolt of this.bolts) bolt.age += elapsed;
    this.bolts = this.bolts.filter(bolt => bolt.age < bolt.duration + 240);
    this.sinceDraw += elapsed;
    if (this.sinceDraw < 40) return;
    this.sinceDraw %= 40;
    const g = this.graphics.clear();
    if (reduced) return;
    for (const bolt of this.bolts) {
      if (bolt.age >= bolt.duration) drawProjectileImpact(g, bolt);
      else drawProjectile(g, bolt, projectilePoint(bolt, bolt.age / bolt.duration));
    }
  }

  clear(): void { this.bolts = []; this.sinceDraw = 0; this.graphics.clear(); }
  destroy(): void { this.bolts = []; this.graphics.destroy(); }

}
