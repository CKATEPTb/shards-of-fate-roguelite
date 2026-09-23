import Phaser from 'phaser';
import type { CombatEvent } from '@shards/shared';
import { COMBAT_DIE_MS, COMBAT_DICE_TOTAL_MS, COMBAT_DICE_BONUS_MS, combatDiceDuration } from '@shards/shared';

export interface DiceOwner {
  x: number;
  y: number;
  name: string;
  team: 'heroes' | 'enemies';
}
interface Point { x: number; y: number }
interface Palette { dark: number; middle: number; light: number; edge: number }
interface DieView {
  body: Phaser.GameObjects.Container;
  shape: Phaser.GameObjects.Graphics;
  number: Phaser.GameObjects.Text;
  shadow: Phaser.GameObjects.Ellipse;
  x: number;
  y: number;
  result: number;
  sides: number;
  phase: number;
}
interface RowView {
  event: CombatEvent;
  dice: DieView[];
  total: Phaser.GameObjects.Text;
  bonus: Phaser.GameObjects.Text;
  totalX: number;
  totalY: number;
  bonusX: number;
  sum: number;
}
interface Tray {
  actorId: string;
  container: Phaser.GameObjects.Container;
  rows: RowView[];
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  owner: DiceOwner;
}

function reasonLabel(reason = ''): string {
  const labels: Record<string, string> = { initiative: 'Инициатива', initiativeTie: 'Спор', damage: 'Урон', criticalDamage: 'Крит', critical: 'Крит', armor: 'Броня', heal: 'Лечение', shield: 'Щит', accuracy: 'Попадание', attackCheck: 'Попадание', body: 'Тело', flee: 'Побег', target: 'Цель' };
  if (labels[reason]) return labels[reason];
  const text = reason.toLowerCase();
  if (text.includes('бонус')) return 'Бонус';
  if (text.includes('защита')) return 'Защита';
  if (text.includes('сохранение щита')) return 'Щит';
  if (text.includes('повтор')) return 'Повтор';
  if (text.includes('продление')) return 'Продление';
  if (text.includes('вампиризм')) return 'Вампиризм';
  if (text.includes('свет')) return 'Свет';
  return 'Бросок';
}

function palette(sides: number): Palette {
  if (sides === 4) return { dark: 0x244337, middle: 0x477a60, light: 0x78b894, edge: 0xb8e0b7 };
  if (sides === 6) return { dark: 0x65402b, middle: 0x9a6540, light: 0xcf9b5e, edge: 0xf4d39a };
  if (sides === 8) return { dark: 0x29445b, middle: 0x457797, light: 0x8cb5c6, edge: 0xc0e3e5 };
  if (sides === 10) return { dark: 0x433653, middle: 0x705a8c, light: 0xab8fbc, edge: 0xddc6e9 };
  if (sides === 12) return { dark: 0x5b3038, middle: 0x985362, light: 0xcc8a8e, edge: 0xf5c2b5 };
  return { dark: 0x59503c, middle: 0x8c7954, light: 0xc9b784, edge: 0xffe8af };
}

function polygon(g: Phaser.GameObjects.Graphics, points: Point[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha).fillPoints(points, true);
}

/** Faceted silhouettes, not a rounded square reused for every number of sides. */
function drawDie(g: Phaser.GameObjects.Graphics, sides: number, radius: number): void {
  const p = palette(sides);
  const v = (x: number, y: number) => ({ x: x * radius, y: y * radius });
  let outline: Point[];
  if (sides === 4) {
    outline = [v(0, -1.1), v(1, 0.82), v(-1, 0.82)];
    polygon(g, outline, p.middle);
    polygon(g, [outline[0], outline[1], v(0, 0.48)], p.light);
    polygon(g, [outline[2], outline[1], v(0, 0.48)], p.dark);
    g.lineStyle(1, p.edge, 0.45).lineBetween(0, radius * 0.48, 0, -radius * 1.1);
  } else if (sides === 6) {
    outline = [v(-0.9, -0.62), v(-0.35, -1), v(0.92, -0.79), v(0.92, 0.63), v(0.35, 1), v(-0.9, 0.7)];
    polygon(g, outline, p.middle);
    polygon(g, [outline[0], outline[1], outline[2], v(0.35, -0.42)], p.light);
    polygon(g, [outline[2], outline[3], outline[4], v(0.35, -0.42)], p.dark);
    g.lineStyle(1, p.edge, 0.45).lineBetween(radius * 0.35, -radius * 0.42, radius * 0.35, radius);
    g.lineBetween(-radius * 0.9, -radius * 0.62, radius * 0.35, -radius * 0.42);
  } else if (sides === 8) {
    outline = [v(0, -1.12), v(0.97, 0), v(0, 1.12), v(-0.97, 0)];
    polygon(g, outline, p.middle);
    polygon(g, [outline[0], outline[1], v(0.2, 0.3)], p.light);
    polygon(g, [outline[1], outline[2], v(0.2, 0.3)], p.dark);
    polygon(g, [outline[2], outline[3], v(0.2, 0.3)], p.dark, 0.6);
    g.lineStyle(1, p.edge, 0.35).lineBetween(-radius * 0.97, 0, radius * 0.2, radius * 0.3);
  } else {
    const count = sides === 10 ? 5 : sides === 12 ? 10 : 6;
    outline = Array.from({ length: count }, (_, i) => v(Math.cos(-Math.PI / 2 + i * Math.PI * 2 / count), Math.sin(-Math.PI / 2 + i * Math.PI * 2 / count)));
    polygon(g, outline, p.middle);
    for (let i = 0; i < count; i++) {
      const a = outline[i], b = outline[(i + 1) % count];
      const center = v(i % 2 ? 0.2 : -0.16, i % 3 === 0 ? -0.2 : 0.23);
      polygon(g, [a, b, center], i < count / 2 ? p.light : p.dark, i % 2 ? 0.65 : 0.9);
    }
    const face = sides === 20 ? [v(0, 0.77), v(-0.73, -0.42), v(0.73, -0.42)]
      : [v(0, -0.64), v(0.58, -0.17), v(0.35, 0.56), v(-0.35, 0.56), v(-0.58, -0.17)];
    polygon(g, face, p.middle);
    g.lineStyle(1, p.edge, 0.42).strokePoints(face, true);
  }
  g.lineStyle(1.15, p.edge, 0.85).strokePoints(outline, true);
  g.lineStyle(1.4, 0xffffff, 0.43).lineBetween(outline[0].x, outline[0].y, outline[1].x, outline[1].y);
}

function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: `${size}px`, color, stroke: '#11211d', strokeThickness: 2 }).setOrigin(0.5);
}

/** One bounded presentation owns every die for a strike; all roll results are read-only event data. */
export class DicePresentation {
  private trays: Tray[] = [];
  private elapsed = 0;
  private duration = 0;
  private readonly leaders: Phaser.GameObjects.Graphics;
  private dense = false;

  constructor(private readonly scene: Phaser.Scene, private readonly ownerFor: (actorId: string) => DiceOwner | undefined) {
    this.leaders = scene.add.graphics().setDepth(1190);
  }

  show(events: readonly CombatEvent[], reduced: boolean): void {
    this.clear();
    const groups = new Map<string, CombatEvent[]>();
    for (const event of events) {
      if (!event.actorId || !event.rolls?.length || !this.ownerFor(event.actorId)) continue;
      const group = groups.get(event.actorId) ?? [];
      group.push(event);
      groups.set(event.actorId, group);
    }
    this.dense = groups.size > 6;
    for (const [actorId, rolls] of groups) {
      this.trays.push(this.createTray(actorId, rolls, this.dense));
      this.duration = Math.max(this.duration, ...rolls.map(event => combatDiceDuration(event) + 35));
    }
    this.resize();
    this.paint(reduced);
  }

  update(delta: number, reduced: boolean): void {
    if (!this.trays.length) return;
    this.elapsed += Math.max(0, delta);
    if (this.elapsed >= this.duration) { this.clear(); return; }
    this.paint(reduced);
  }

  resize(): void {
    if (!this.trays.length) return;
    const stage = { width: this.scene.scale.width, height: this.scene.scale.height };
    for (const tray of this.trays) tray.owner = this.ownerFor(tray.actorId) ?? tray.owner;
    const maxWidth = Math.max(...this.trays.map(tray => tray.width));
    const maxHeight = Math.max(...this.trays.map(tray => tray.height));
    let bestColumns = 1, bestScale = 0;
    for (let columns = 1; columns <= this.trays.length; columns++) {
      const rows = Math.ceil(this.trays.length / columns);
      const scale = Math.min(1, (stage.width - 16 - (columns - 1) * 6) / (columns * maxWidth), (stage.height - 16 - (rows - 1) * 7) / (rows * maxHeight));
      if (scale > bestScale) { bestScale = scale; bestColumns = columns; }
    }
    const arranged: Tray[] = [];
    const sorted = [...this.trays].sort((a, b) => a.owner.y - b.owner.y || a.owner.x - b.owner.x);
    let overlaps = this.dense;
    for (const tray of this.dense ? [] : sorted) {
      tray.scale = Math.min(1, (stage.width - 16) / tray.width, (stage.height - 16) / tray.height);
      const width = tray.width * tray.scale, height = tray.height * tray.scale;
      const preferred = { x: tray.owner.x - width / 2, y: tray.owner.y - height - 10 };
      const clamp = (point: Point) => ({ x: Phaser.Math.Clamp(point.x, 8, Math.max(8, stage.width - width - 8)), y: Phaser.Math.Clamp(point.y, 8, Math.max(8, stage.height - height - 8)) });
      let best = clamp(preferred), score = Number.POSITIVE_INFINITY, collides = false;
      const candidates = [best];
      for (let y = 8; y <= stage.height - height - 8; y += 16) for (let x = 8; x <= stage.width - width - 8; x += 16) candidates.push({ x, y });
      for (const candidate of candidates) {
        let overlap = 0;
        for (const other of arranged) overlap += Math.max(0, Math.min(candidate.x + width + 4, other.x + other.width * other.scale + 4) - Math.max(candidate.x - 4, other.x - 4))
          * Math.max(0, Math.min(candidate.y + height + 4, other.y + other.height * other.scale + 4) - Math.max(candidate.y - 4, other.y - 4));
        const value = overlap * 100000 + (candidate.x - preferred.x) ** 2 + (candidate.y - preferred.y) ** 2;
        if (value < score) { score = value; best = candidate; collides = overlap > 0; }
      }
      tray.x = best.x; tray.y = best.y;
      overlaps ||= collides;
      arranged.push(tray);
    }
    if (overlaps) {
      const rows = Math.ceil(sorted.length / bestColumns);
      const totalWidth = bestColumns * maxWidth * bestScale + (bestColumns - 1) * 6;
      const totalHeight = rows * maxHeight * bestScale + (rows - 1) * 7;
      const top = Phaser.Math.Clamp(sorted.reduce((sum, tray) => sum + tray.owner.y, 0) / sorted.length - totalHeight * 0.7, 8, Math.max(8, stage.height - totalHeight - 8));
      sorted.forEach((tray, index) => {
        tray.scale = Math.max(0.1, bestScale);
        tray.x = (stage.width - totalWidth) / 2 + index % bestColumns * (maxWidth * tray.scale + 6);
        tray.y = top + Math.floor(index / bestColumns) * (maxHeight * tray.scale + 7);
      });
    }
    this.leaders.clear();
    for (const tray of this.trays) {
      tray.container.setPosition(Math.round(tray.x), Math.round(tray.y)).setScale(tray.scale);
      const bottom = tray.y + tray.height * tray.scale;
      const center = tray.x + tray.width * tray.scale / 2;
      const fromY = bottom < tray.owner.y ? bottom + 2 : tray.y - 2;
      this.leaders.lineStyle(1, tray.owner.team === 'heroes' ? 0xc4c99a : 0xd1a28c, 0.36)
        .lineBetween(center, fromY, tray.owner.x, tray.owner.y);
      this.leaders.fillStyle(0xe7d5a1, 0.75).fillCircle(tray.owner.x, tray.owner.y, 2);
    }
  }

  clear(): void {
    for (const tray of this.trays) tray.container.destroy();
    this.trays = [];
    this.elapsed = 0;
    this.duration = 0;
    this.leaders.clear();
  }

  destroy(): void { this.clear(); this.leaders.destroy(); }

  private createTray(actorId: string, events: CombatEvent[], compact: boolean): Tray {
    const owner = this.ownerFor(actorId)!;
    const rowWidth = compact ? 104 : Math.min(316, Math.max(160, 94 + Math.max(...events.map(event => event.rolls!.length)) * 35));
    const perLine = compact ? 1 : Math.max(1, Math.floor((rowWidth - 85) / 35));
    const rowHeights = events.map(event => (compact ? 29 : 15) + Math.ceil(event.rolls!.length / perLine) * 35);
    const height = 22 + rowHeights.reduce((sum, value) => sum + value, 0);
    const container = this.scene.add.container(0, 0).setDepth(1200);
    const art = this.scene.add.graphics();
    art.fillStyle(0x091511, 0.6).fillRoundedRect(3, 5, rowWidth, height, 10);
    art.fillStyle(0x12251f, 0.94).fillRoundedRect(0, 0, rowWidth, height, 10);
    art.lineStyle(1, owner.team === 'heroes' ? 0x96a986 : 0xb78f73, 0.65).strokeRoundedRect(0, 0, rowWidth, height, 10);
    art.fillStyle(0xbac798, 0.06).fillRoundedRect(2, 2, rowWidth - 4, 22, 8);
    const name = label(this.scene, rowWidth / 2, 12, owner.name, compact ? 10 : 11, '#c9d2b3');
    while (name.width > rowWidth - 14 && name.text.length > 2) name.setText(name.text.slice(0, -2) + '…');
    container.add([art, name]);
    let y = 22;
    const rows: RowView[] = events.map((event, index) => {
      const rolls = event.rolls!;
      const sides = event.sides ?? 20;
      const caption = label(this.scene, compact ? rowWidth / 2 : 35, y + (compact ? 7 : 14), reasonLabel(event.rollReason), compact ? 9 : 10, '#b7c5ae');
      const notation = label(this.scene, compact ? rowWidth / 2 : 35, y + (compact ? rowHeights[index] - 10 : 28), `d${sides}`, 9, '#829d8b');
      container.add([caption, notation]);
      const dice: DieView[] = rolls.map((result, dieIndex) => {
        const x = compact ? 32 + dieIndex % perLine * 34 : 80 + dieIndex % perLine * 35;
        const dieY = y + (compact ? 32 : 22) + Math.floor(dieIndex / perLine) * 35;
        const shadow = this.scene.add.ellipse(x, dieY + 13, 25, 7, 0x050d0b, 0.65);
        const shape = this.scene.add.graphics();
        drawDie(shape, sides, compact ? 17 : 16);
        const number = label(this.scene, sides === 6 ? -3 : 0, sides === 4 ? 3 : 0, String(result), compact ? 17 : 16, '#fff3d0');
        const body = this.scene.add.container(x, dieY, [shape, number]);
        container.add([shadow, body]);
        return { body, shape, number, shadow, x, y: dieY, result, sides, phase: event.sequence * 7 + dieIndex * 11 };
      });
      const sum = rolls.reduce((total, value) => total + value, 0);
      const totalX = rowWidth - (compact ? 20 : 21), totalY = y + (compact ? 30 : 23);
      const total = label(this.scene, totalX, totalY, '', compact ? 20 : 19, '#f7dc9c');
      const totalCaption = label(this.scene, totalX, totalY - 16, 'Σ', 9, '#afbc99').setVisible(rolls.length > 1 || Boolean(event.modifier));
      const bonusX = totalX - (compact ? 5 : 3);
      const bonus = label(this.scene, bonusX, totalY + 19, '', compact ? 11 : 12, '#b8d999');
      container.add([totalCaption, total, bonus]);
      if (index < events.length - 1) art.lineStyle(1, 0x78927a, 0.12).lineBetween(10, y + rowHeights[index] - 1, rowWidth - 10, y + rowHeights[index] - 1);
      y += rowHeights[index];
      return { event, dice, total, bonus, totalX, totalY, bonusX, sum };
    });
    return { actorId, container, rows, width: rowWidth, height, x: 0, y: 0, scale: 1, owner };
  }

  private paint(reduced: boolean): void {
    const settle = COMBAT_DIE_MS * 0.73;
    for (const tray of this.trays) for (const row of tray.rows) {
      const multiple = row.dice.length > 1;
      const bonusAt = COMBAT_DIE_MS + (multiple ? COMBAT_DICE_TOTAL_MS : 0);
      const modifier = row.event.modifier ?? 0;
      const bonusPhase = Phaser.Math.Clamp((this.elapsed - bonusAt) / Math.max(1, COMBAT_DICE_BONUS_MS * 0.62), 0, 1);
      const revealed = reduced || this.elapsed >= settle;
      row.dice.forEach(die => {
        const phase = Phaser.Math.Clamp(this.elapsed / settle, 0, 1);
        const momentum = reduced ? 0 : 1 - phase;
        const bounce = Math.abs(Math.sin(phase * Math.PI * 3 + die.phase % 3)) * momentum * 8;
        die.body.setPosition(die.x, die.y - bounce);
        die.shape.setRotation(Math.sin(phase * Math.PI * 5 + die.phase) * momentum * 0.7)
          .setScale(1 + Math.sin(phase * Math.PI * 6 + die.phase) * momentum * 0.15, 1 - momentum * 0.15);
        die.number.setAlpha(revealed ? 1 : 0.86);
        die.number.setText(String(revealed ? die.result : (die.phase + Math.floor(this.elapsed / 46) * 7) % die.sides + 1));
        die.shadow.setScale(1 - bounce / 24, 1 - bounce / 22).setAlpha(0.65 - bounce / 40);
      });
      const showTotal = multiple || modifier !== 0;
      const merged = reduced || modifier !== 0 && bonusPhase >= 1;
      row.total.setVisible(showTotal).setAlpha(revealed ? 1 : 0.3);
      row.total.setText(revealed ? String(merged ? row.event.amount ?? row.sum + modifier : row.sum) : '·');
      if (multiple && !modifier && !reduced) row.total.setAlpha(Phaser.Math.Clamp((this.elapsed - settle) / (COMBAT_DIE_MS - settle), 0, 1));
      const signed = `${modifier >= 0 ? '+' : '−'}${Math.abs(modifier)}`;
      row.bonus.setText(modifier ? signed : '').setVisible(modifier !== 0 && !merged);
      row.bonus.setPosition(row.bonusX, row.totalY + 19 - bonusPhase * 19).setAlpha(1 - bonusPhase);
      if (reduced && modifier !== 0) {
        row.bonus.setVisible(true).setText(signed).setPosition(row.bonusX, row.totalY + 18).setAlpha(0.8);
      }
      if (!reduced && modifier && bonusPhase > 0 && bonusPhase < 1) row.total.setScale(1 + Math.sin(bonusPhase * Math.PI) * 0.13);
      else row.total.setScale(1);
    }
  }
}
