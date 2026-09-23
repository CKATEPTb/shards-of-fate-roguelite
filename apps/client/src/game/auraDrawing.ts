import type Phaser from 'phaser';
import { AURA_MOTIFS, type AuraVisualDefinition } from '@shards/shared';
import type { AuraCanvas } from './auraVisuals';

export const AURA_TAU = Math.PI * 2;
export interface AuraPoint { x: number; y: number; depth?: number; alpha?: number; angle?: number }
export interface AuraBrush {
  canvas: AuraCanvas;
  visual: AuraVisualDefinition;
  colors: readonly [number, number, number];
  time: number;
  radius: number;
  height: number;
  count: number;
  alpha: number;
  detail: number;
  phase: number;
  pulse: number;
}

const MOTIFS: Record<AuraVisualDefinition['motif'], readonly string[]> = {
  drop: ['00100','00100','01210','12221','12221','01210','00100'],
  cross: ['00200','01210','22222','01210','00200','00200'],
  leaf: ['000010','000121','001221','012210','122100','010000'],
  skull: ['011110','122221','121121','122221','012210','010010'],
  star: ['0002000','0002000','0012100','2223222','0012100','0100010','1000001'],
  flame: ['000100','001210','011210','122121','123221','012210'],
  crystal: ['00100','01210','12321','12321','01210','00100','00100'],
  bolt: ['000220','002210','022100','012220','000210','002100','021000'],
  rock: ['001110','012221','122211','122111','011110'],
  blade: ['000002','000023','000231','002310','023100','121000','110000'],
  fang: ['122221','012210','012210','001210','000210','000100'],
  wisp: ['000010','001210','012210','123210','012100','001210','000010'],
  hourglass: ['22222','01110','00100','01210','12321','22222'],
  claw: ['100010001','210021002','021002100','002100210','000200020'],
  moon: ['001210','012100','121000','121000','012100','001210'],
  bone: ['1100011','1211121','0122210','0012100','0122210','1211121','1100011'],
  eye: ['0011100','0122210','1223221','0122210','0011100'],
  feather: ['000010','000121','001221','012210','122100','010000','100000'],
  rune: ['012100','021020','120210','012100','020120','002010'],
  shield: ['0122210','1222221','1223221','0122210','0012100','0001000'],
};
interface MotifPixel { x: number; y: number; shade: number }
const MOTIF_PIXELS = new Map<AuraVisualDefinition['motif'], readonly MotifPixel[]>(AURA_MOTIFS.map(name => {
  const rows = MOTIFS[name];
  const pixels: MotifPixel[] = [];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const shade = Number(rows[y][x]);
    if (shade) pixels.push({ x: x - rows[y].length / 2, y: y - rows.length / 2, shade: shade - 1 });
  }
  return [name, pixels] as const;
}));
const polygonPoints: AuraPoint[] = Array.from({ length: 12 }, () => ({ x: 0, y: 0 }));

export function fract(value: number): number { return value - Math.floor(value); }
export function auraLayer(b: AuraBrush, depth: number): Phaser.GameObjects.Graphics { return depth < 0 ? b.canvas.rear : b.canvas.front; }

export function auraPixel(b: AuraBrush, g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha = 1, size = 0.7): void {
  const c = b.canvas, edge = Math.max(1, Math.round(size * c.scale));
  g.fillStyle(color, alpha * b.alpha).fillRect(Math.round(c.x + x * c.scale), Math.round(c.y + y * c.scale), edge, edge);
}

export function auraLine(b: AuraBrush, g: Phaser.GameObjects.Graphics, a: AuraPoint, z: AuraPoint, color: number, alpha = 1, width = 0.55): void {
  const c = b.canvas;
  g.lineStyle(Math.max(1, c.scale * width), color, alpha * b.alpha).lineBetween(
    Math.round(c.x + a.x * c.scale), Math.round(c.y + a.y * c.scale), Math.round(c.x + z.x * c.scale), Math.round(c.y + z.y * c.scale));
}

export function auraPolygon(b: AuraBrush, g: Phaser.GameObjects.Graphics, points: readonly AuraPoint[], color: number, alpha = 1): void {
  const c = b.canvas;
  const count = Math.min(polygonPoints.length, points.length);
  for (let i = 0; i < count; i++) {
    polygonPoints[i].x = Math.round(c.x + points[i].x * c.scale);
    polygonPoints[i].y = Math.round(c.y + points[i].y * c.scale);
  }
  // Phaser records coordinates immediately; the small scratch buffer is safe to reuse.
  g.fillStyle(color, alpha * b.alpha).fillPoints(polygonPoints, true, true, count);
}

export function auraEllipse(b: AuraBrush, g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number, alpha: number, fill = false): void {
  const c = b.canvas;
  if (fill) g.fillStyle(color, alpha * b.alpha).fillEllipse(c.x + x * c.scale, c.y + y * c.scale, width * c.scale, height * c.scale);
  else g.lineStyle(Math.max(1, c.scale * 0.5), color, alpha * b.alpha).strokeEllipse(c.x + x * c.scale, c.y + y * c.scale, width * c.scale, height * c.scale);
}

/** Every motif has its own pixel silhouette; color is only the final material. */
export function auraMotif(b: AuraBrush, g: Phaser.GameObjects.Graphics, point: AuraPoint, size = 0.58, motif = b.visual.motif, alpha = 0.75): void {
  const pixels = MOTIF_PIXELS.get(motif), c = b.canvas;
  if (!pixels) return;
  const angle = point.angle ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
  const pixelSize = Math.max(1, Math.ceil(size * c.scale));
  for (const pixel of pixels) {
    const dx = pixel.x * size, dy = pixel.y * size;
    g.fillStyle(b.colors[pixel.shade], alpha * (point.alpha ?? 1) * b.alpha).fillRect(
      Math.round(c.x + (point.x + dx * cos - dy * sin) * c.scale),
      Math.round(c.y + (point.y + dx * sin + dy * cos) * c.scale), pixelSize, pixelSize);
  }
}

export function auraGlint(b: AuraBrush, g: Phaser.GameObjects.Graphics, point: AuraPoint, alpha = 0.75, size = 1.5): void {
  auraLine(b, g, { x: point.x - size, y: point.y }, { x: point.x + size, y: point.y }, b.colors[2], alpha * 0.6);
  auraLine(b, g, { x: point.x, y: point.y - size }, { x: point.x, y: point.y + size }, b.colors[2], alpha * 0.6);
  auraPixel(b, g, point.x, point.y, 0xfff7df, alpha, 0.8);
}

/** All seven authored rhythms alter paths, including the orbit's direction and vertical phase. */
export function auraMotion(b: AuraBrush, index: number, count = b.count): AuraPoint {
  const seed = index * 2.399963 + b.phase;
  const phase = fract(index / Math.max(1, count) + b.time * 0.18);
  let angle = seed + b.time, radius = b.radius, y = -b.height * 0.5;
  let alpha = 0.85;
  switch (b.visual.motion) {
    case 'orbit': y += Math.sin(seed + b.time * 0.6) * b.height * 0.2; break;
    case 'rise': angle = seed + Math.sin(b.time + seed) * 0.35; y = -phase * b.height; alpha = Math.sin(phase * Math.PI); break;
    case 'fall': angle = seed + Math.sin(b.time * 0.5 + seed) * 0.2; y = -(1 - phase) * b.height; alpha = Math.sin(phase * Math.PI); break;
    case 'pulse': radius *= 0.68 + fract(b.time * 0.32 + index / count) * 0.38; y += Math.sin(seed) * b.height * 0.25; alpha = 0.3 + b.pulse * 0.6; break;
    case 'spiral': angle = seed + b.time * 1.8 + phase * AURA_TAU; radius *= 0.45 + phase * 0.6; y = -phase * b.height; alpha = Math.sin(phase * Math.PI); break;
    case 'zigzag': angle = seed - b.time * 0.6; radius *= 0.6 + Math.abs(Math.sin(b.time * 2.8 + seed)) * 0.45; y = -phase * b.height + Math.sin(b.time * 4 + seed) * 2; break;
    case 'breathe': angle = seed + b.time * 0.2; radius *= 0.92 + b.pulse * 0.08; y += Math.sin(b.time + seed) * 2; break;
  }
  const depth = Math.sin(angle);
  return { x: Math.cos(angle) * radius, y: y + depth * radius * 0.18, depth, angle, alpha };
}

/** A segmented perspective ring puts its far half behind the body. */
export function auraRing(b: AuraBrush, radius: number, y: number, tilt: number, alpha: number, phase = 0, gap = 0, color = b.colors[1]): void {
  const steps = b.detail < 0.65 ? 18 : 30;
  for (let i = 0; i < steps; i++) {
    if (gap && i % gap === gap - 1) continue;
    const a = phase + i / steps * AURA_TAU, z = phase + (i + 1) / steps * AURA_TAU;
    auraLine(b, auraLayer(b, Math.sin(a)), { x: Math.cos(a) * radius, y: y + Math.sin(a) * radius * tilt },
      { x: Math.cos(z) * radius, y: y + Math.sin(z) * radius * tilt }, color, alpha);
  }
}

export function auraRibbon(b: AuraBrush, phase: number, turns: number, alpha: number, color = b.colors[1], radius = b.radius, height = b.height): void {
  const steps = b.detail < 0.65 ? 19 : 32;
  for (let i = 0; i < steps; i++) {
    const t = i / steps, next = (i + 1) / steps;
    const a = phase + t * AURA_TAU * turns, z = phase + next * AURA_TAU * turns;
    auraLine(b, auraLayer(b, Math.sin(a)), { x: Math.cos(a) * radius * (0.6 + t * 0.4), y: -t * height + Math.sin(a) * 2 },
      { x: Math.cos(z) * radius * (0.6 + next * 0.4), y: -next * height + Math.sin(z) * 2 }, color, alpha * Math.sin(t * Math.PI), 0.65);
  }
}
