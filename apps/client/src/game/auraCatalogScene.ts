import Phaser from 'phaser';
import type { ProjectileKind, StatusDefinition } from '@shards/shared';
import { gameContent } from '../catalog';
import { createUnitSprite, getUnitSocket, setUnitAnimation, setUnitScale, unitCastingHand, type UnitFacing, type UnitMotion } from './unitAnimation';
import { UnitEffects } from './unitEffects';
import { SkillProjectiles } from './skillProjectiles';

export interface AuraCatalogSettings {
  heroId: string; facing: UnitFacing; motion: UnitMotion;
  selected: StatusDefinition[]; stacks: number; paused: boolean; reduced: boolean;
}

/** The workshop shares the game's sprite, aura renderer and projectile renderer. */
export class AuraCatalogScene extends Phaser.Scene {
  private settings: AuraCatalogSettings;
  private sprite?: Phaser.GameObjects.Sprite;
  private effects?: UnitEffects;
  private body?: Phaser.GameObjects.Container;
  private projectiles?: SkillProjectiles;
  private ready = false;
  private timer = 0;
  private growth = 1;
  private shooting = false;
  private impact = 0;
  private target?: Phaser.GameObjects.Graphics;
  private readonly anchor = { x: 337, y: 395 };
  private readonly aim = { x: 611, y: 297 };

  constructor(settings: AuraCatalogSettings) { super('aura-catalog'); this.settings = settings; }

  create(): void {
    const floor = this.add.graphics();
    floor.fillStyle(0x101b20, .75).fillEllipse(337, 403, 514, 99);
    floor.lineStyle(1, 0x758c83, .14).strokeEllipse(337, 403, 438, 79).strokeEllipse(337, 403, 370, 64);
    for (let index = 0; index < 18; index++) {
      const angle = index / 18 * Math.PI * 2;
      const x = 337 + Math.cos(angle) * 198, y = 403 + Math.sin(angle) * 34;
      floor.lineStyle(2, 0x8d9c83, .22).lineBetween(x, y, x + Math.cos(angle) * 11, y + Math.sin(angle) * 2);
    }
    floor.lineStyle(1, 0x4c6260, .13);
    for (let index = -3; index <= 3; index++) floor.lineBetween(337 + index * 49, 345, 337 + index * 99, 500);
    this.target = this.add.graphics().setDepth(450);
    this.drawTarget();
    this.add.text(this.aim.x, this.aim.y + 57, 'МИШЕНЬ', { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#73847b', letterSpacing: 3 }).setOrigin(.5);
    this.projectiles = new SkillProjectiles(this);
    this.ready = true;
    this.rebuild();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.ready = false; this.effects?.destroy(); this.projectiles?.destroy(); });
  }

  configure(settings: AuraCatalogSettings): void {
    const previous = this.settings;
    this.settings = settings;
    if (!this.ready) return;
    if (previous.heroId !== settings.heroId) this.rebuild();
    else if (previous.facing !== settings.facing || previous.motion !== settings.motion || previous.reduced !== settings.reduced) this.pose(true);
    if (settings.paused) this.sprite?.anims.pause();
    else if (previous.paused && !settings.reduced) this.sprite?.anims.resume();
    this.applyAuras();
  }

  update(_time: number, delta: number): void {
    if (!this.sprite || this.settings.paused) return;
    const elapsed = Math.min(delta, 100);
    const targetGrowth = this.settings.selected.some(status => status.id === 'taunted') ? 1.32 : 1;
    this.growth = this.settings.reduced ? targetGrowth : this.growth + (targetGrowth - this.growth) * (1 - Math.exp(-elapsed / 160));
    setUnitScale(this.sprite, 6.7 * this.growth);
    this.effects?.update(elapsed, this.settings.reduced);
    this.projectiles?.update(elapsed, this.settings.reduced);
    this.timer += elapsed;
    if (this.shooting && this.timer > 800) { this.shooting = false; this.pose(true); this.timer = 0; }
    else if (!this.shooting && this.timer > 1800 && !['idle', 'walk'].includes(this.settings.motion)) { this.pose(true); this.timer = 0; }
    if (this.impact > 0) { this.impact = Math.max(0, this.impact - elapsed); this.drawTarget(); }
  }

  fire(kind: ProjectileKind): void {
    if (!this.sprite || !this.projectiles || this.settings.paused) return;
    this.timer = 0; this.shooting = true; this.impact = 1000;
    setUnitAnimation(this.sprite, kind === 'arrow' ? 'attack' : 'cast', this.settings.facing, this.settings.reduced, true);
    const socket = getUnitSocket(this.sprite, unitCastingHand(this.sprite)) ?? { x: 20, y: -130 };
    this.effects?.trigger('cast');
    this.projectiles.fire({ x: this.anchor.x + socket.x, y: this.anchor.y + socket.y }, this.aim, 800, kind);
  }

  private rebuild(): void {
    this.effects?.destroy(); this.body?.destroy(true);
    const hero = gameContent.characters.find(unit => unit.id === this.settings.heroId) ?? gameContent.characters[0];
    this.sprite = setUnitScale(createUnitSprite(this, hero), 6.7 * this.growth);
    this.effects = new UnitEffects(this, this.sprite);
    const shadow = this.add.ellipse(0, 0, 120, 25, 0x02090c, .65);
    this.body = this.add.container(this.anchor.x, this.anchor.y, [shadow, this.effects.rear, this.sprite, this.effects.front]).setDepth(400);
    this.pose(true); this.applyAuras();
  }

  private pose(restart: boolean): void {
    if (!this.sprite) return;
    setUnitAnimation(this.sprite, this.settings.motion, this.settings.facing, this.settings.reduced, restart);
    if (this.settings.paused) this.sprite.anims.pause();
  }

  private applyAuras(): void {
    this.effects?.setState({ shield: false, burning: false, poisoned: false, dead: false,
      auras: this.settings.selected.flatMap(status => status.visual ? [{ id: status.id, visual: status.visual, stacks: this.settings.stacks }] : []) }, this.settings.reduced);
  }

  private drawTarget(): void {
    const g = this.target?.clear();
    if (!g) return;
    const { x, y } = this.aim;
    const flash = this.impact > 0 && this.impact < 250 ? this.impact / 250 : 0;
    g.fillStyle(0x102127, .8).fillTriangle(x, y - 34, x + 27, y, x, y + 34).fillTriangle(x, y - 34, x - 27, y, x, y + 34);
    g.lineStyle(2, flash ? 0xead6a0 : 0x6d827e, .35 + flash * .55).strokeRect(x - 17, y - 17, 34, 34);
    g.lineStyle(1, 0xa1bbaa, .3 + flash * .5).strokeCircle(x, y, 25);
    g.fillStyle(0xc1bb86, .45 + flash * .4).fillRect(x - 3, y - 12, 6, 24).fillRect(x - 12, y - 3, 24, 6);
  }
}
