import type Phaser from 'phaser';
import type { ProjectileKind } from '@shards/shared';
import type { SpellBolt } from './skillProjectiles';
type Graphics = Phaser.GameObjects.Graphics;
interface Point { x: number; y: number }
const TAU = Math.PI * 2;
const COLORS: Record<ProjectileKind, [number, number, number]> = {
  arrow: [0xa5865e, 0xe1d3ad, 0x697e55], fire: [0x92342c, 0xe67c37, 0xffe6a1],
  frost: [0x3d769c, 0x99e0e6, 0xe2ffff], lightning: [0x6753a9, 0x9eacf4, 0xebedff],
  holy: [0xa28335, 0xebc966, 0xfff5bd], shadow: [0x30223f, 0x8a62a5, 0xc5a3d8],
  nature: [0x3e6942, 0x95b96b, 0xe2e7a3], blood: [0x5b1d36, 0xc04659, 0xf39a85],
  arcane: [0x4b427d, 0xa695df, 0xe5ddff], poison: [0x42602b, 0x9dc155, 0xe1eb9a],
  bone: [0x6c7168, 0xc6c1a6, 0xf2e7c6], stone: [0x58554c, 0xa49270, 0xdacfaf],
};

export function projectilePoint(bolt: SpellBolt, p: number): Point {
  const arc = bolt.kind === 'arrow' || bolt.kind === 'lightning' ? 0 : bolt.kind === 'stone' ? 35 : 12 + bolt.serial % 3 * 5;
  const wave = ['shadow', 'nature', 'poison', 'arcane'].includes(bolt.kind) ? Math.sin(p * TAU * 2 + bolt.serial) * Math.sin(p * Math.PI) * 8 : 0;
  return { x: bolt.from.x + (bolt.to.x - bolt.from.x) * p + wave,
    y: bolt.from.y + (bolt.to.y - bolt.from.y) * p - Math.sin(p * Math.PI) * arc };
}
function pixel(g: Graphics, p: Point, color: number, alpha: number, size: number): void {
  g.fillStyle(color, alpha).fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
}
function diamond(g: Graphics, p: Point, size: number, color: number, alpha = 1, angle = 0): void {
  const points = [[0, -size], [size * .56, 0], [0, size], [-size * .56, 0]].map(([x, y]) => ({
    x: p.x + x * Math.cos(angle) - y * Math.sin(angle), y: p.y + x * Math.sin(angle) + y * Math.cos(angle),
  }));
  g.fillStyle(color, alpha).fillPoints(points, true);
}

/** Each projectile has its own body, flight path, trail and impact silhouette. */
export function drawProjectile(g: Graphics, bolt: SpellBolt, point: Point): void {
  const p = bolt.age / bolt.duration, previous = projectilePoint(bolt, Math.max(0, p - .02));
  const angle = Math.atan2(point.y - previous.y, point.x - previous.x);
  const [dark, middle, light] = COLORS[bolt.kind];
  if (bolt.kind === 'arrow') {
    const dx = Math.cos(angle), dy = Math.sin(angle), px = -dy, py = dx;
    const tail = { x: point.x - dx * 20, y: point.y - dy * 20 };
    g.lineStyle(2, middle).lineBetween(tail.x, tail.y, point.x, point.y);
    g.lineStyle(1, dark).lineBetween(tail.x + px, tail.y + py, point.x + px, point.y + py);
    g.fillStyle(middle).fillTriangle(point.x + dx * 5, point.y + dy * 5, point.x - dx * 5 + px * 4, point.y - dy * 5 + py * 4, point.x - dx * 5 - px * 4, point.y - dy * 5 - py * 4);
    for (const side of [-1, 1]) g.lineStyle(2, light, .8).lineBetween(tail.x, tail.y, tail.x - dx * 5 + px * 4 * side, tail.y - dy * 5 + py * 4 * side);
    return;
  }
  for (let i = 8; i >= 0; i--) {
    const q = projectilePoint(bolt, Math.max(0, p - i * .018)), alpha = (1 - i / 10) * .6;
    if (bolt.kind === 'lightning') {
      const last = projectilePoint(bolt, Math.max(0, p - (i + 1) * .018));
      const offset = Math.sin(i * 4.5 + Math.floor(bolt.age / 45) + bolt.serial) * 8;
      g.lineStyle(4, dark, alpha * .45).lineBetween(last.x, last.y, q.x + offset, q.y);
      g.lineStyle(1.5, light, alpha).lineBetween(last.x, last.y, q.x + offset, q.y);
    } else if (bolt.kind === 'frost') diamond(g, q, 3 + i % 3, i % 2 ? middle : light, alpha, angle);
    else if (bolt.kind === 'nature') diamond(g, { x: q.x + Math.sin(i + p * 15) * 7, y: q.y + Math.cos(i + p * 15) * 7 }, 4, i % 2 ? middle : light, alpha, i + p * 4);
    else if (bolt.kind === 'poison') g.lineStyle(1, middle, alpha).strokeCircle(q.x + Math.sin(i + p * 14) * 5, q.y - i % 3 * 3, 2 + i % 3);
    else if (bolt.kind === 'shadow') g.fillStyle(i % 2 ? dark : middle, alpha * .4).fillEllipse(q.x, q.y, 13 - i * .6, 9 + i * .4);
    else pixel(g, q, i < 2 ? middle : dark, alpha, bolt.kind === 'stone' ? 3 : 6 - i * .4);
  }
  switch (bolt.kind) {
    case 'fire':
      g.fillStyle(middle, .13).fillCircle(point.x, point.y, 13);
      diamond(g, point, 9, middle, .95, angle + Math.PI / 2); pixel(g, point, light, 1, 5);
      for (let i = 0; i < 5; i++) pixel(g, { x: point.x - Math.cos(angle) * i * 4, y: point.y + Math.sin(i * 2.1 + p * 19) * (3 + i) }, i % 2 ? middle : light, .7 - i * .1, 2);
      break;
    case 'frost': diamond(g, point, 14, middle, .9, angle + Math.PI / 2); diamond(g, point, 10, light, .95, angle + Math.PI / 2); break;
    case 'lightning':
      g.fillStyle(middle, .18).fillCircle(point.x, point.y, 12); pixel(g, point, light, 1, 5);
      for (let i = 0; i < 3; i++) g.lineStyle(1, light, .75).lineBetween(point.x, point.y, point.x + Math.cos(p * 19 + i * 2) * 13, point.y + Math.sin(p * 19 + i * 2) * 13);
      break;
    case 'holy':
      g.fillStyle(middle, .15).fillCircle(point.x, point.y, 14); g.lineStyle(1, middle, .8).strokeCircle(point.x, point.y, 8);
      g.fillStyle(light, .95).fillRect(point.x - 1, point.y - 6, 3, 12).fillRect(point.x - 5, point.y - 1, 11, 3); break;
    case 'shadow':
      g.fillStyle(dark, .92).fillCircle(point.x, point.y, 9);
      g.lineStyle(2, middle, .85).beginPath().arc(point.x, point.y, 9, angle - 2, angle + 1).strokePath();
      diamond(g, point, 4, light, .75, p * 7); break;
    case 'nature':
      for (let i = 0; i < 3; i++) diamond(g, { x: point.x + Math.cos(p * 12 + i * 2.1) * 6, y: point.y + Math.sin(p * 12 + i * 2.1) * 6 }, 7, i ? middle : light, .95, p * 8 + i);
      break;
    case 'blood': case 'poison':
      g.fillStyle(dark, .5).fillCircle(point.x, point.y, 9); diamond(g, point, 9, middle, .98, angle + Math.PI / 2);
      g.fillStyle(middle).fillCircle(point.x, point.y, 4); pixel(g, { x: point.x - 1, y: point.y - 2 }, light, .85, 2); break;
    case 'arcane':
      g.lineStyle(1, middle, .65).strokeCircle(point.x, point.y, 11); diamond(g, point, 8, middle, .8, p * 8); diamond(g, point, 4, light, 1, -p * 8);
      for (let i = 0; i < 4; i++) pixel(g, { x: point.x + Math.cos(p * 9 + i * Math.PI / 2) * 11, y: point.y + Math.sin(p * 9 + i * Math.PI / 2) * 11 }, light, .9, 2);
      break;
    case 'bone':
      for (let i = 0; i < 3; i++) {
        const a = p * 8 + i * 2.1, x = point.x + Math.cos(a) * 6, y = point.y + Math.sin(a) * 5, dx = Math.cos(a) * 5, dy = Math.sin(a) * 5;
        g.lineStyle(3, middle, .95).lineBetween(x - dx, y - dy, x + dx, y + dy);
        pixel(g, { x: x - dx, y: y - dy }, light, .9, 4); pixel(g, { x: x + dx, y: y + dy }, light, .9, 4);
      }
      break;
    case 'stone': {
      const vertices = Array.from({ length: 6 }, (_, i) => ({ x: point.x + Math.cos(i * TAU / 6 + p * 4) * (i % 2 ? 8 : 11), y: point.y + Math.sin(i * TAU / 6 + p * 4) * 8 }));
      g.fillStyle(dark).fillPoints(vertices, true); g.fillStyle(middle).fillTriangle(vertices[0].x, vertices[0].y, vertices[1].x, vertices[1].y, point.x, point.y);
      g.lineStyle(1, light, .7).strokePoints(vertices, true); break;
    }
  }
}

export function drawProjectileImpact(g: Graphics, bolt: SpellBolt): void {
  const p = (bolt.age - bolt.duration) / 240, alpha = 1 - p, radius = 3 + p * 19;
  const [, middle, light] = COLORS[bolt.kind];
  if (['holy', 'arcane', 'shadow', 'poison'].includes(bolt.kind)) g.lineStyle(1.5, middle, alpha * .7).strokeEllipse(bolt.to.x, bolt.to.y, radius * 2, radius * 1.4);
  else g.fillStyle(middle, alpha * .12).fillCircle(bolt.to.x, bolt.to.y, radius * .8);
  const count = bolt.kind === 'arrow' ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const angle = i * TAU / count + bolt.serial * .6;
    const q = { x: bolt.to.x + Math.cos(angle) * radius, y: bolt.to.y + Math.sin(angle) * radius * .7 + (bolt.kind === 'blood' ? p * p * 10 : 0) };
    if (bolt.kind === 'frost' || bolt.kind === 'stone') diamond(g, q, (1 - p) * 4 + 1, i % 2 ? middle : light, alpha, angle);
    else pixel(g, q, i % 2 ? middle : light, alpha * .85, bolt.kind === 'blood' ? 3 : 2);
  }
}
