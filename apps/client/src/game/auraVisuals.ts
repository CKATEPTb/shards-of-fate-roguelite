import type Phaser from 'phaser';
import { activeAurasKey, authoredAuraIds, drawAuthoredAuras, type ActiveAuraVisual } from './authoredAuras';
export type { ActiveAuraVisual } from './authoredAuras';

export interface AuraVisualState {
  shield: boolean;
  burning: boolean;
  poisoned: boolean;
  boneShield?: boolean;
  taunted?: boolean;
  bastion?: boolean;
  regrowth?: boolean;
  bloodlust?: boolean;
  inspired?: boolean;
  rapidFire?: boolean;
  sureStrike?: boolean;
  fortified?: boolean;
  battleFervor?: boolean;
  burningStacks?: number;
  auras?: readonly ActiveAuraVisual[];
}

export interface AuraCanvas {
  rear: Phaser.GameObjects.Graphics;
  front: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  scale: number;
  /** Seconds, frozen by the caller for reduced motion. */
  time: number;
  reduced: boolean;
}

const TAU = Math.PI * 2;
const BONE = ['11000011', '12111121', '01222210', '00122100', '01222210', '12111121', '11000011'];
const LEAF = ['000100', '001210', '012210', '122210', '012100', '001000'];
const FEATHER = ['000100', '001210', '012210', '122100', '012000', '010000', '100000'];
const CINDER = ['00100', '01210', '12321', '01210', '00100'];

/** Pixel motifs are drawn into two reusable layers, never into the character atlas. */
function glyph(g: Phaser.GameObjects.Graphics, rows: string[], colors: number[], x: number, y: number,
  scale: number, angle: number, alpha: number) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let row = 0; row < rows.length; row++) for (let col = 0; col < rows[row].length; col++) {
    const color = Number(rows[row][col]);
    if (!color) continue;
    const dx = (col - rows[row].length / 2) * scale, dy = (row - rows.length / 2) * scale;
    g.fillStyle(colors[color - 1], alpha).fillRect(Math.round(x + dx * cos - dy * sin), Math.round(y + dx * sin + dy * cos), Math.ceil(scale), Math.ceil(scale));
  }
}

function pixel(c: AuraCanvas, g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number, size = 1) {
  const edge = Math.max(1, Math.ceil(size * c.scale));
  g.fillStyle(color, alpha).fillRect(Math.round(c.x + x * c.scale), Math.round(c.y + y * c.scale), edge, edge);
}

function glint(c: AuraCanvas, g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number, size = 2) {
  pixel(c, g, x - size, y, color, alpha * 0.5, 1);
  pixel(c, g, x + size, y, color, alpha * 0.5, 1);
  pixel(c, g, x, y - size, color, alpha * 0.5, 1);
  pixel(c, g, x, y + size, color, alpha * 0.5, 1);
  pixel(c, g, x, y, 0xfff3d4, alpha, 1.35);
}

function haze(c: AuraCanvas, color: number, alpha: number, radius = 16) {
  c.rear.fillStyle(color, alpha * 0.3).fillEllipse(c.x, c.y - 10 * c.scale, radius * 2.3 * c.scale, 28 * c.scale);
  c.rear.fillStyle(color, alpha).fillEllipse(c.x, c.y - c.scale, radius * 2 * c.scale, 7 * c.scale);
}

/** A helix is split at its depth plane so bones, leaves and ribbons pass behind the body. */
function ribbon(c: AuraCanvas, color: number, phase: number, alpha: number, radius: number, height: number, turns = 1.3) {
  const steps = 38;
  for (let i = 0; i < steps; i++) {
    const t = i / steps, next = (i + 1) / steps;
    const angle = phase + t * TAU * turns, nextAngle = phase + next * TAU * turns;
    const r = radius * (0.65 + t * 0.35), nextR = radius * (0.65 + next * 0.35);
    const g = Math.sin(angle) < 0 ? c.rear : c.front;
    const x = Math.cos(angle) * r, y = -t * height + Math.sin(angle) * 3;
    const nx = Math.cos(nextAngle) * nextR, ny = -next * height + Math.sin(nextAngle) * 3;
    g.lineStyle(Math.max(1, c.scale * (0.65 + (1 - t) * 0.55)), color, alpha * Math.sin(t * Math.PI))
      .lineBetween(Math.round(c.x + x * c.scale), Math.round(c.y + y * c.scale), Math.round(c.x + nx * c.scale), Math.round(c.y + ny * c.scale));
  }
}

function boneStorm(c: AuraCanvas) {
  haze(c, 0xa69573, 0.16, 18);
  // Three translucent sand bands have different angular velocities; gaps keep the body readable.
  ribbon(c, 0xb7a887, c.time * 2.3, 0.28, 18, 29, 1.7);
  ribbon(c, 0x87795e, -1.6 + c.time * 1.6, 0.22, 19, 28, 1.8);
  ribbon(c, 0xe3d3a6, 2.5 + c.time * 2.6, 0.18, 17, 27, 1.6);
  for (let i = 0; i < 20; i++) {
    const height = (i * 0.137 + c.time * 0.21) % 1;
    const angle = i * 2.399 + c.time * (1.8 + i % 3 * 0.25);
    const depth = Math.sin(angle), radius = 12 + height * 7;
    const g = depth < 0 ? c.rear : c.front;
    pixel(c, g, Math.cos(angle) * radius, -height * 29 + depth * 3,
      i % 3 ? 0xc7b48a : 0xe6d4aa, (0.13 + (1 - height) * 0.24) * (depth < 0 ? 0.6 : 1), i % 4 ? 0.6 : 1.2);
  }
  for (let i = 0; i < 8; i++) {
    const angle = c.time * (1.45 + i % 2 * 0.25) + i * TAU / 8;
    const depth = Math.sin(angle), radius = 16 + i % 3;
    const height = 4 + i / 8 * 23 + Math.sin(c.time * 1.4 + i) * 1.5;
    glyph(depth < 0 ? c.rear : c.front, BONE, [0x746955, 0xe1d6b4],
      c.x + Math.cos(angle) * radius * c.scale, c.y + (depth * 3 - height) * c.scale,
      c.scale * (depth < 0 ? 0.47 : 0.62), Math.cos(angle) * 0.8 + i, depth < 0 ? 0.43 : 0.85);
  }
}

function bastion(c: AuraCanvas, muted = false) {
  const pulse = c.reduced ? 1 : 0.9 + Math.sin(c.time * 3.2) * 0.1;
  haze(c, muted ? 0x889b93 : 0xddb85e, muted ? 0.08 : 0.17, 19);
  for (let i = 0; i < 5; i++) {
    const angle = i * TAU / 5 + (c.reduced ? 0.5 : c.time * 0.32);
    const depth = Math.sin(angle), g = depth < 0 ? c.rear : c.front;
    const x = c.x + Math.cos(angle) * 20 * c.scale;
    const y = c.y - (13 - depth * 3) * c.scale;
    const width = (3.2 + Math.abs(depth) * 2.3) * c.scale, height = 12 * c.scale;
    const alpha = (depth < 0 ? 0.25 : 0.47) * pulse * (muted ? 0.7 : 1);
    const points = [
      { x: x - width, y: y - height * 0.5 }, { x: x, y: y - height * 0.64 },
      { x: x + width, y: y - height * 0.5 }, { x: x + width * 0.8, y: y + height * 0.2 },
      { x, y: y + height * 0.66 }, { x: x - width * 0.8, y: y + height * 0.2 },
    ];
    g.fillStyle(0x657777, alpha * 0.65).fillPoints(points, true);
    g.lineStyle(Math.max(1, c.scale * 0.7), muted ? 0xa7bab0 : 0xe3c47f, alpha).strokePoints(points, true);
    g.lineStyle(Math.max(1, c.scale * 0.65), 0xf5ddab, alpha * 1.3).lineBetween(x, y - height * 0.3, x, y + height * 0.36);
    g.lineBetween(x - width * 0.45, y - height * 0.06, x + width * 0.45, y - height * 0.06);
    glint(c, g, (x - c.x) / c.scale, (y - c.y - height * 0.53) / c.scale, 0xf5ddab, alpha, 1.5);
  }
}

function blessing(c: AuraCanvas) {
  haze(c, 0xe6c758, 0.12, 15);
  for (let i = 0; i < 6; i++) {
    const phase = (i / 6 + c.time * 0.17) % 1;
    const x = Math.sin(i * 2.399) * 12, y = -2 - phase * 24;
    const alpha = Math.sin(phase * Math.PI) * 0.38;
    const g = i % 2 ? c.front : c.rear;
    g.fillStyle(0xd5b657, alpha * 0.14).fillRect(c.x + (x - 1) * c.scale, c.y + y * c.scale, 2 * c.scale, 13 * c.scale);
    glint(c, g, x, y, 0xf1d78a, alpha, i % 2 ? 1 : 2);
  }
  c.rear.lineStyle(Math.max(1, c.scale * 0.55), 0xcdb56e, 0.25).strokeEllipse(c.x, c.y - c.scale, 27 * c.scale, 6 * c.scale);
}

function growth(c: AuraCanvas) {
  haze(c, 0x78ad68, 0.13, 15);
  ribbon(c, 0x70894b, -c.time * 0.7, 0.38, 14, 24, 1.2);
  ribbon(c, 0xbed38a, 2.3 - c.time * 0.7, 0.2, 15, 23, 1.2);
  for (let i = 0; i < 7; i++) {
    const phase = (i / 7 + c.time * 0.14) % 1, angle = phase * TAU * 1.3 - c.time * 0.7;
    const depth = Math.sin(angle), g = depth < 0 ? c.rear : c.front;
    glyph(g, LEAF, [0x526a41, 0xb4cf83], c.x + Math.cos(angle) * 15 * c.scale,
      c.y + (-phase * 25 + depth * 2) * c.scale, c.scale * 0.65, angle + Math.PI / 3,
      Math.sin(phase * Math.PI) * (depth < 0 ? 0.5 : 0.8));
  }
}

function blood(c: AuraCanvas) {
  const pulse = 0.8 + Math.sin(c.time * 4.2) * 0.2;
  haze(c, 0xa4364b, 0.17 * pulse, 16);
  ribbon(c, 0x953d59, c.time * -1.1, 0.28, 15, 25);
  for (let i = 0; i < 6; i++) {
    const phase = (i / 6 + c.time * 0.25) % 1, side = i % 2 ? 1 : -1;
    const x = side * (9 + Math.sin(phase * 4 + i) * 3), y = -phase * 26;
    for (let j = 0; j < 4; j++) pixel(c, i % 3 ? c.front : c.rear, x + side * j * 0.4, y + j * 1.6,
      j ? 0xa44b64 : 0xe2989d, Math.sin(phase * Math.PI) * (0.65 - j * 0.13), j ? 0.7 : 1.1);
  }
}

function wind(c: AuraCanvas) {
  ribbon(c, 0xacd6c2, -c.time * 3, 0.28, 18, 26, 1.5);
  ribbon(c, 0xe1e5bd, 2 - c.time * 2.4, 0.2, 17, 25, 1.2);
  for (let i = 0; i < 4; i++) {
    const angle = -c.time * 2.1 + i * TAU / 4, depth = Math.sin(angle);
    glyph(depth < 0 ? c.rear : c.front, FEATHER, [0x718d7a, 0xd5ddbd], c.x + Math.cos(angle) * 17 * c.scale,
      c.y + (-5 - i * 5 + depth * 3) * c.scale, c.scale * 0.65, -angle, depth < 0 ? 0.35 : 0.7);
  }
}

function precision(c: AuraCanvas) {
  haze(c, 0x9d9eae, 0.07, 14);
  for (let i = 0; i < 4; i++) {
    const angle = i * TAU / 4 + c.time * 0.65, depth = Math.sin(angle);
    const g = depth < 0 ? c.rear : c.front, x = Math.cos(angle) * 14, y = -15 + depth * 7;
    const alpha = 0.28 + (Math.sin(c.time * 4 + i) + 1) * 0.2;
    for (let p = 0; p < 5; p++) pixel(c, g, x + p * 0.45, y - p * 0.8, p === 2 ? 0xedebeb : 0xa4b7bb, alpha, 0.75);
    glint(c, g, x + 1, y - 3, 0xccd9dc, alpha, 1.6);
  }
}

function flames(c: AuraCanvas, stacks: number) {
  const intensity = Math.min(1, Math.max(1, stacks) / 7);
  haze(c, 0xd05b32, 0.1 + intensity * 0.1, 11 + intensity * 3);
  const count = 4 + Math.min(6, stacks);
  for (let i = 0; i < count; i++) {
    const phase = (c.time * 0.6 + i / count) % 1;
    const x = Math.sin(i * 2.399) * (8 + intensity * 3) + Math.sin(phase * 6 + i) * 1.5;
    const y = -1 - phase * (10 + intensity * 13);
    const g = i % 3 ? c.front : c.rear;
    const alpha = (1 - phase) * 0.72;
    glyph(g, CINDER, [0x973826, 0xe4823b, 0xffd17a], c.x + x * c.scale, c.y + y * c.scale,
      c.scale * (0.35 + (1 - phase) * 0.43), 0, alpha);
    pixel(c, g, x + 1, y - 3, 0xf2b165, (1 - phase) * 0.5, 0.6);
  }
}

function poison(c: AuraCanvas) {
  haze(c, 0x839958, 0.16, 13);
  for (let i = 0; i < 5; i++) {
    const phase = (c.time * 0.22 + i / 5) % 1, x = Math.sin(i * 2.3 + phase * 2) * 10, y = -phase * 17;
    const alpha = Math.sin(phase * Math.PI) * 0.43;
    const g = i % 2 ? c.front : c.rear;
    g.lineStyle(Math.max(1, c.scale * 0.55), 0xa8b67b, alpha).strokeCircle(c.x + x * c.scale, c.y + y * c.scale, (1 + phase) * c.scale);
    pixel(c, g, x - 0.5, y - 0.8, 0xc4d696, alpha, 0.6);
  }
}

export function hasPersistentAura(state: AuraVisualState): boolean {
  return Boolean(state.auras?.length || state.shield || state.burning || state.poisoned || state.boneShield || state.taunted
    || state.bastion || state.regrowth || state.bloodlust || state.inspired || state.rapidFire || state.sureStrike || state.fortified || state.battleFervor);
}

/** New arrays with identical authored metadata do not invalidate the graphics command buffers. */
export function persistentAuraStateKey(state: AuraVisualState): string {
  return [state.shield, state.burning, state.poisoned, state.boneShield, state.taunted, state.bastion, state.regrowth,
    state.bloodlust, state.inspired, state.rapidFire, state.sureStrike, state.fortified, state.battleFervor, state.burningStacks,
    activeAurasKey(state.auras)].join('|');
}

export function drawPersistentAuras(c: AuraCanvas, state: AuraVisualState): void {
  const authored = authoredAuraIds(state.auras);
  const legacy = (id: string, active?: boolean) => active && !authored.has(id);
  if (state.boneShield) boneStorm(c);
  else if (state.shield && !state.bastion) {
    haze(c, 0x7eb6b9, 0.065, 15);
    ribbon(c, 0xafced0, c.time * 0.5, 0.23, 16, 29, 1);
    for (let i = 0; i < 4; i++) glint(c, i % 2 ? c.front : c.rear, Math.sin(i * 2.5 + c.time * 0.5) * 14, -4 - i * 6, 0xb9dedb, 0.48, 1.2);
  }
  if (legacy('bastion', state.bastion)) bastion(c);
  else if (legacy('fortified', state.fortified)) bastion(c, true);
  if (legacy('inspired', state.inspired)) blessing(c);
  if (legacy('regrowth', state.regrowth)) growth(c);
  if (legacy('bloodlust', state.bloodlust)) blood(c);
  if (legacy('rapid_fire', state.rapidFire)) wind(c);
  if (legacy('sure_strike', state.sureStrike)) precision(c);
  if (legacy('burning', state.burning)) flames(c, state.burningStacks ?? 1);
  if (legacy('poisoned', state.poisoned)) poison(c);
  if (legacy('taunted', state.taunted)) {
    haze(c, 0xc58b54, 0.09, 17);
    // Low amber shards pulse around the planted feet, leaving the enlarged body unobscured.
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6, phase = (i / 6 + c.time * 0.25) % 1;
      const g = Math.sin(angle) < 0 ? c.rear : c.front;
      pixel(c, g, Math.cos(angle) * 15, Math.sin(angle) * 3 - phase * 5, 0xd2ac73, Math.sin(phase * Math.PI) * 0.6, 1);
    }
  }
  if (legacy('battle_fervor', state.battleFervor)) {
    haze(c, 0xb98657, 0.1, 13);
    ribbon(c, 0xcfa769, c.time, 0.3, 12, 19, 0.8);
  }
  drawAuthoredAuras(c, state.auras, state.boneShield);
}
