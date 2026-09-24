import type { EnemyAppearance } from './enemyAppearance';
import { PixelCanvas } from './pixelCanvas';
import type { UnitFacing, UnitPose } from './unitPose';
import type { UnitPalette } from './unitPalette';

type Point = readonly [number, number];
interface BossScene {
  art: PixelCanvas;
  profile: EnemyAppearance;
  pose: UnitPose;
  p: UnitPalette;
  side: boolean;
  back: boolean;
  x: number;
  bob: number;
  strike: number;
  bone: string;
  bright: string;
}

const polygon = (a: PixelCanvas, points: readonly Point[], color: string) => a.polygon(points.map(([x, y]) => ({ x, y })), color);
const mix = (left: string, right: string, amount: number) => {
  const channels = [1, 3, 5].map(i => Math.round(parseInt(left.slice(i, i + 2), 16) * (1 - amount) + parseInt(right.slice(i, i + 2), 16) * amount));
  return `#${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`;
};

/** Broad pixel clusters, rather than single-pixel noise, retain their material at battle scale. */
function plate(s: BossScene, x: number, y: number, rx: number, ry: number, color = s.p.main) {
  const { art: a, p } = s;
  a.ellipse(x, y, rx, ry, p.outline);
  a.ellipse(x, y - 1, rx - 1, Math.max(1, ry - 1), p.shade);
  a.ellipse(x - 1, y - 2, Math.max(1, rx - 2), Math.max(1, ry - 2), color);
  a.line(x - rx + 3, y - ry + 2, x - 1, y - ry + 1, p.light, 2);
}

function limb(s: BossScene, from: Point, joint: Point, end: Point, thickness: number, color = s.p.main) {
  const { art: a, p } = s;
  a.line(...from, ...joint, p.outline, thickness + 2);
  a.line(...joint, ...end, p.outline, thickness + 2);
  a.line(from[0], from[1], joint[0], joint[1], p.shade, thickness);
  a.line(joint[0], joint[1], end[0], end[1], color, thickness);
  a.line(from[0], from[1], joint[0], joint[1], color, Math.max(1, thickness - 2));
  a.line(joint[0], joint[1], end[0], end[1], p.light, 1);
}

function horn(s: BossScene, base: Point, bend: Point, tip: Point, width = 4) {
  const { art: a, p, bone } = s;
  polygon(a, [[base[0] - width, base[1] + 1], [bend[0] - 2, bend[1]], tip, [bend[0] + 2, bend[1] + 3], [base[0] + width, base[1] + 2]], p.outline);
  a.line(base[0], base[1], bend[0], bend[1], p.trim, width);
  a.line(bend[0], bend[1], tip[0], tip[1], bone, 2);
  a.line(base[0] - 1, base[1], bend[0], bend[1], bone);
}

function skull(s: BossScene, x: number, y: number, width = 7, height = 8) {
  const { art: a, p, side, back, bone, pose } = s;
  plate(s, x, y, width, height, bone);
  if (back) {
    a.line(x, y - height + 2, x - 1, y + height - 2, p.shade);
    a.line(x - 4, y - 1, x + 3, y + 2, p.light);
    return;
  }
  for (const offset of side ? [3] : [-3, 3]) {
    a.rect(x + offset - 1, y - 1, 3, 3, p.outline);
    a.rect(x + offset, y, 2, 1, pose.blink ? p.shade : p.eye);
  }
  a.line(x + (side ? 4 : 0), y + 2, x + (side ? 5 : -1), y + 4, p.outline, 2);
  a.rect(x - (side ? 0 : 3), y + 5, side ? 6 : 7, 2, p.outline);
  for (let tooth = 0; tooth < 3; tooth++) a.rect(x - (side ? 0 : 3) + tooth * 2, y + 5, 1, 3, bone);
}

function eyes(s: BossScene, x: number, y: number, gap = 4) {
  if (s.back) return;
  const { art: a, p, side, pose } = s;
  const offsets = side ? [gap] : [-gap, gap];
  for (const offset of offsets) {
    a.rect(x + offset - 2, y - 1, 5, 3, p.outline);
    a.rect(x + offset - 1, y, 3, 1, pose.blink ? p.shade : p.eye);
    if (!pose.blink) a.point(x + offset, y, s.bright);
  }
}

function crystal(s: BossScene, x: number, y: number, width: number, height: number, color = s.p.light) {
  const { art: a, p } = s;
  polygon(a, [[x, y - height], [x + width, y - 2], [x + width - 1, y + height / 2], [x, y + height], [x - width, y + 2], [x - width + 1, y - height / 2]], p.outline);
  polygon(a, [[x, y - height + 2], [x + width - 2, y - 2], [x, y + height - 2], [x - width + 2, y + 1]], color);
  polygon(a, [[x, y - height + 2], [x, y + height - 2], [x - width + 2, y + 1]], p.main);
  a.line(x, y - height + 2, x - 1, y + 1, s.bright);
  a.line(x - width + 2, y + 1, x - 1, y + 1, p.trim);
}

function crown(s: BossScene, x: number, y: number, width = 9) {
  const { art: a, p, profile } = s;
  polygon(a, [[x - width, y + 3], [x - width - 1, y - 5], [x - 4, y - 1], [x, y - 8 - profile.variant % 3], [x + 4, y - 1], [x + width + 1, y - 5], [x + width, y + 3]], p.outline);
  polygon(a, [[x - width + 2, y + 2], [x - width + 1, y - 3], [x - 3, y + 1], [x, y - 6], [x + 3, y + 1], [x + width - 1, y - 3], [x + width - 2, y + 2]], p.trim);
  a.line(x - width + 2, y + 2, x + width - 2, y + 2, s.bone);
  a.rect(x - 1, y, 3, 3, p.eye);
}

function roots(s: BossScene, y: number) {
  const { art: a, x, p, pose } = s;
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * 6;
    const step = i % 2 ? pose.step * 0.8 : -pose.step * 0.8;
    limb(s, [x + dx / 2, y], [x + dx, 49 - Math.abs(dx) / 5], [x + dx + step, 54 - Math.max(0, step)], 4, p.clothLight);
    a.line(x + dx + step, 54 - Math.max(0, step), x + dx + (i < 2 ? -4 : 4), 55 - Math.max(0, step), p.light, 2);
  }
}

function colossus(s: BossScene) {
  const { art: a, p, x, bob: b, strike, side, profile, back, pose } = s;
  const bark = mix(p.clothLight, '#785035', .72);
  const barkShade = mix(p.cloth, '#30201c', .70);
  const barkLight = mix(p.trim, '#b38350', .68);
  const mossShade = mix(p.main, '#253b2c', .62);
  roots(s, 39 + b);
  // Split roots cross one another before gripping the floor with hooked, uneven tips.
  limb(s, [x - 6, 40 + b], [x - 1, 49], [x - 11 - pose.step * .5, 54], 5, bark);
  limb(s, [x + 8, 39 + b], [x + 17, 47], [x + 21, 53], 4, barkShade);
  a.line(x + 20, 53, x + 25, 50, barkLight, 2);
  a.line(x - 17, 51, x - 22, 53, bark, 3);
  a.line(x - 22, 53, x - 25, 49, barkLight);
  for (const sign of [-1, 1]) {
    const reach = sign > 0 ? strike : -strike * 0.3;
    limb(s, [x + sign * 9, 25 + b], [x + sign * 19, 31 + b - reach], [x + sign * 22, 42 + b - reach], 8, bark);
    const elbowX = x + sign * 19, elbowY = 31 + b - reach;
    polygon(a, [[elbowX - 5, elbowY - 4], [elbowX + 3, elbowY - 7], [elbowX + 6, elbowY], [elbowX + 2, elbowY + 7], [elbowX - 4, elbowY + 4]], barkShade);
    a.line(elbowX - 4, elbowY - 3, elbowX + 2, elbowY - 5, barkLight, 2);
    a.line(elbowX + 2, elbowY - 5, elbowX + 1, elbowY, bark, 3);
    a.line(elbowX - 2, elbowY + 2, elbowX + 3, elbowY + 5, p.outline, 2);
    for (let finger = 0; finger < 3; finger++) {
      const fx = x + sign * (19 + finger * 2);
      const fy = 47 + b - reach + finger % 2 * 2;
      a.line(fx, 41 + b - reach, fx + sign * (finger - 1), fy, p.outline, 3);
      a.line(fx, 41 + b - reach, fx + sign * (finger - 1), fy, barkLight);
      a.line(fx + sign * (finger - 1), fy, fx - sign * 2, fy + 3, barkLight);
    }
    a.line(x + sign * 18, 30 + b, x + sign * 23, 23 + b - sign, barkShade, 4);
    a.line(x + sign * 19, 29 + b, x + sign * 23, 23 + b - sign, barkLight);
    a.line(x + sign * 23, 23 + b - sign, x + sign * 26, 25 + b, bark);
  }
  polygon(a, [[x - 11, 18 + b], [x - 17, 26 + b], [x - 18, 35 + b], [x - 13, 40 + b], [x - 14, 47], [x - 4, 44], [x + 4, 49], [x + 13, 44], [x + 17, 32 + b], [x + 13, 25 + b], [x + 12, 17 + b]], p.outline);
  polygon(a, [[x - 10, 21 + b], [x - 14, 29 + b], [x - 15, 35 + b], [x - 10, 40 + b], [x - 11, 44], [x - 3, 42], [x + 4, 46], [x + 10, 42], [x + 14, 32 + b], [x + 10, 26 + b], [x + 9, 21 + b]], barkShade);
  // Large twisting planes expose warm cut wood beside the cold green growth.
  polygon(a, [[x - 13, 27 + b], [x - 7, 23 + b], [x - 4, 31 + b], [x - 8, 36 + b], [x - 6, 42], [x - 11, 39 + b], [x - 15, 33 + b]], bark);
  polygon(a, [[x + 6, 23 + b], [x + 11, 27 + b], [x + 13, 34 + b], [x + 8, 37 + b], [x + 9, 44], [x + 4, 42], [x + 4, 33 + b]], bark);
  polygon(a, [[x - 5, 32 + b], [x - 1, 28 + b], [x + 3, 34 + b], [x + 1, 38 + b], [x + 6, 44], [x + 2, 47], [x - 4, 41], [x - 2, 36 + b]], p.outline);
  a.line(x - 11, 28 + b, x - 7, 25 + b, barkLight, 2);
  a.line(x - 7, 26 + b, x - 6, 31 + b, barkLight);
  a.line(x - 7, 35 + b, x - 5, 40, barkLight);
  a.line(x + 6, 25 + b, x + 10, 29 + b, barkLight, 2);
  a.line(x + 11, 34 + b, x + 6, 37 + b, barkLight);
  a.line(x + 5, 40, x + 7, 43, barkLight);
  for (const [dx, dy, direction] of [[-11, 31, 1], [10, 31, -1], [-8, 40, -1], [7, 44, 1]] as const) {
    a.line(x + dx, dy + b, x + dx + direction * 3, dy + b + 2, p.outline, 2);
    a.line(x + dx + direction * 3, dy + b + 2, x + dx + direction, dy + b + 5, p.outline);
  }
  // Irregular dead boughs replace the smooth, round canopy of a living tree.
  for (const [dx, dy, size] of [[-13, 19, 8], [11, 16, 9], [-4, 13, 7]] as const) {
    const bx = x + dx * (side ? .8 : 1), by = dy + b;
    polygon(a, [[bx - size, by + 1], [bx - size + 2, by - 5], [bx - 2, by - 7], [bx + 3, by - 4], [bx + size, by - 2], [bx + size - 1, by + 5], [bx + 2, by + 7], [bx - 5, by + 5]], p.outline);
    polygon(a, [[bx - size + 2, by], [bx - 4, by - 4], [bx + 1, by - 5], [bx + 3, by - 2], [bx + size - 2, by], [bx + 4, by + 4], [bx - 3, by + 3]], mossShade);
    polygon(a, [[bx - 6, by - 2], [bx - 2, by - 5], [bx + 2, by - 3], [bx + 4, by], [bx - 1, by + 1]], p.main);
    a.line(bx - 5, by - 2, bx - 2, by - 4, p.light);
    a.line(bx + 2, by + 2, bx + 5, by + 5, bark, 2);
    a.line(bx - 4, by + 4, bx - 6, by + 8, p.outline, 2);
  }
  for (const sign of [-1, 1]) {
    limb(s, [x + sign * 6, 16 + b], [x + sign * 12, 9 + b], [x + sign * 16, 5 + b], 3, bark);
    a.line(x + sign * 11, 10 + b, x + sign * 10, 4 + b, barkLight, 2);
    a.line(x + sign * 12, 10 + b, x + sign * 19, 11 + b, barkLight);
    a.line(x + sign * 18, 11 + b, x + sign * 21, 7 + b, barkShade, 2);
  }
  const hx = x + (side ? 3 : 0);
  polygon(a, [[hx - 9, 17 + b], [hx - 3, 15 + b], [hx + 3, 17 + b], [hx + 9, 15 + b], [hx + 11, 23 + b], [hx + 7, 29 + b], [hx + 5, 35 + b], [hx - 2, 33 + b], [hx - 7, 35 + b], [hx - 9, 28 + b], [hx - 11, 23 + b]], p.outline);
  polygon(a, [[hx - 8, 18 + b], [hx - 3, 17 + b], [hx + 2, 20 + b], [hx + 8, 17 + b], [hx + 9, 24 + b], [hx + 5, 28 + b], [hx + 4, 32 + b], [hx - 2, 30 + b], [hx - 6, 32 + b], [hx - 8, 26 + b]], barkShade);
  a.line(hx - 9, 19 + b, hx - 7, 25 + b, bark, 2);
  a.line(hx + 8, 20 + b, hx + 7, 27 + b, barkLight);
  if (!back) {
    // Tiny embers sit deep under downward-sloping splintered brows.
    for (const sign of side ? [1] : [-1, 1]) {
      const ex = hx + sign * 4;
      polygon(a, [[ex - 3, 22 + b], [ex + 3, 23 + b], [ex + 2, 27 + b], [ex - 2, 26 + b]], p.outline);
      a.rect(ex, 24 + b, 2, 1, pose.blink ? barkShade : p.eye);
      if (!pose.blink) a.point(ex + (sign < 0 ? 1 : 0), 24 + b, s.bright);
      polygon(a, sign < 0
        ? [[hx - 10, 20 + b], [hx - 5, 18 + b], [hx - 1, 22 + b], [hx - 1, 24 + b], [hx - 7, 22 + b]]
        : [[hx + 1, 22 + b], [hx + 5, 19 + b], [hx + 10, 18 + b], [hx + 9, 22 + b], [hx + 2, 24 + b]], bark);
      a.line(ex - (sign < 0 ? 3 : 0), 20 + b, ex + (sign < 0 ? 0 : 3), 21 + b, barkLight);
    }
    polygon(a, [[hx - 1, 23 + b], [hx + 2, 23 + b], [hx + 3, 28 + b], [hx, 27 + b], [hx - 2, 29 + b]], bark);
    polygon(a, [[hx - 6, 27 + b], [hx - 3, 29 + b], [hx - 1, 27 + b], [hx + 1, 30 + b], [hx + 4, 28 + b], [hx + 6, 29 + b], [hx + 4, 35 + b], [hx + 1, 33 + b], [hx - 1, 36 + b], [hx - 3, 32 + b], [hx - 6, 34 + b]], p.outline);
    a.line(hx - 5, 28 + b, hx - 4, 31 + b, barkLight);
    a.line(hx + 4, 29 + b, hx + 3, 32 + b, barkLight);
    a.line(hx - 3, 34 + b, hx - 4, 38 + b, bark, 2);
    a.line(hx + 3, 34 + b, hx + 5, 37 + b, barkShade, 2);
  } else {
    polygon(a, [[hx - 4, 20 + b], [hx + 4, 21 + b], [hx + 6, 28 + b], [hx, 32 + b], [hx - 6, 28 + b]], p.outline);
    a.line(hx - 3, 22 + b, hx + 2, 23 + b, barkLight);
    a.line(hx + 2, 23 + b, hx + 3, 27 + b, bark);
    a.line(hx + 3, 27 + b, hx - 2, 29 + b, bark);
  }
  if (profile.id.includes('briar')) {
    // The king's crown is broken living timber, with one old gold binding.
    for (const [dx, height] of [[-7, 7], [-2, 10], [4, 6], [8, 9]] as const) {
      a.line(hx + dx, 17 + b, hx + dx - 1, 17 + b - height, p.outline, 3);
      a.line(hx + dx, 16 + b, hx + dx - 1, 18 + b - height, barkLight);
    }
    a.line(hx - 7, 15 + b, hx - 2, 17 + b, p.trim, 2);
    a.line(hx + 2, 16 + b, hx + 7, 14 + b, bark);
  }
  if (profile.id.includes('moss')) {
    for (const [dx, dy] of [[-13, 23], [12, 19], [-4, 38]] as const) {
      plate(s, x + dx, dy + b, 5, 4, p.main);
      a.line(x + dx - 3, dy + b + 2, x + dx - 2, dy + b + 7, p.main, 2);
    }
  }
  if (profile.id.includes('rot')) {
    for (const [dx, dy] of [[-13, 16], [10, 26], [-6, 36]] as const) {
      a.rect(x + dx, dy + b, 2, 5, s.bone);
      a.ellipse(x + dx, dy + b, 5, 2, p.clothLight);
      a.line(x + dx - 3, dy + b - 1, x + dx, dy + b - 1, p.trim);
    }
  }
}

function broodQueen(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, pose, strike, profile } = s;
  const ax = x - (side ? 7 : 0), ay = 26 + b;
  for (let leg = 0; leg < 4; leg++) for (const sign of [-1, 1]) {
    const lift = Math.max(0, pose.step * (leg % 2 ? -sign : sign));
    const kx = x + sign * (20 + leg % 2 * 3);
    const ky = 20 + leg * 6 - lift + b;
    const fx = x + sign * (27 - leg % 2 * 2);
    limb(s, [ax + sign * 7, ay + leg * 3], [kx, ky], [fx, 35 + leg * 6 - lift], 3);
    a.line(kx, ky, kx + sign * 2, ky - 4, p.trim, 2);
  }
  plate(s, ax, ay, side ? 16 : 15, side ? 13 : 17);
  const pattern = profile.variant % 3;
  for (let row = 0; row < 4; row++) {
    const yy = ay - 10 + row * 6;
    a.line(ax - 8 - row % 2 * 2, yy, ax + 7, yy + 2, p.shade, 2);
    for (const sign of [-1, 1]) {
      plate(s, ax + sign * (4 + row % 2 * 3), yy + 1, 3 + (pattern === 1 ? 1 : 0), 3, row % 2 ? p.light : p.trim);
    }
  }
  a.line(ax, ay - 12, ax + 1, ay + 11, p.outline, 2);
  const hx = x + (side ? 13 : 0) + strike * 0.45, hy = (back ? 19 : 43) + b;
  plate(s, hx, hy - 3, 10, 9, p.clothLight);
  if (!back) {
    for (let row = 0; row < 2; row++) for (const sign of side ? [1] : [-1, 1]) {
      a.ellipse(hx + sign * (4 + row * 2), hy - 5 + row * 4, row ? 2 : 1, row ? 2 : 1, p.outline);
      a.rect(hx + sign * (4 + row * 2), hy - 5 + row * 4, row ? 2 : 1, 1, p.eye);
    }
    for (const sign of [-1, 1]) {
      horn(s, [hx + sign * 5, hy + 1], [hx + sign * 7, hy + 6 - strike * 0.3], [hx + sign * 2, hy + 10 - strike * 0.3], 3);
      a.line(hx + sign * 8, hy - 2, hx + sign * 11, hy + 4, p.shade, 2);
    }
    a.rect(hx - 2, hy + 1, 5, 5, p.outline);
  }
  if (profile.id.includes('dune')) crown(s, ax, ay - 10, 10);
  if (profile.id.includes('white')) {
    for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
      a.line(ax, ay - 11 + i * 7, x + sign * 19, 20 + i * 7, s.bone);
      a.line(x + sign * 19, 20 + i * 7, x + sign * 25, 34 + i * 5, p.light);
    }
  }
  if (profile.id.includes('amber')) crystal(s, ax, ay - 3, 5, 8, p.trim);
  if (profile.id.includes('thousand')) for (let i = 0; i < 4; i++) {
    a.line(ax - 9 + i * 6, ay - 10, ax - 10 + i * 6, ay - 16 + i % 2 * 3, s.bone, 2);
  }
}

function antlerTitan(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, pose, strike, profile } = s;
  const hx = x + (side ? 10 : 0) + strike * 0.3;
  for (const sign of [-1, 1]) {
    limb(s, [x + sign * 8, 39 + b], [x + sign * 11, 47 - pose.step * sign], [x + sign * 10 + pose.step * sign, 53], 5);
    a.rect(x + sign * 10 - 2 + pose.step * sign, 53, 7, 3, p.outline);
    limb(s, [x + sign * 10, 27 + b], [x + sign * 17, 35 - strike * 0.4], [x + sign * 17, 47 - strike], 4, p.shade);
    a.line(x + sign * 17, 46 - strike, x + sign * 20, 50 - strike, s.bone, 2);
  }
  plate(s, x, 34 + b, side ? 15 : 13, 15);
  for (let row = 0; row < 5; row++) {
    const yy = 27 + b + row * 4;
    for (const sign of [-1, 1]) a.line(x + sign * 2, yy, x + sign * (11 - row), yy + 2, row % 2 ? p.shade : p.light, 2);
  }
  for (const sign of [-1, 1]) {
    limb(s, [hx + sign * 5, 19 + b], [hx + sign * 13, 13 + b], [hx + sign * 18, 6 + b], 3, p.trim);
    for (let tine = 0; tine < 3; tine++) {
      const tx = hx + sign * (8 + tine * 4);
      const ty = 18 + b - tine * 4;
      a.line(tx, ty, tx - sign * 1, ty - 7 + tine, p.outline, 3);
      a.line(tx, ty, tx - sign * 1, ty - 7 + tine, s.bone, 1);
    }
  }
  polygon(a, [[hx - 9, 18 + b], [hx - 7, 12 + b], [hx, 15 + b], [hx + 7, 12 + b], [hx + 10, 19 + b], [hx + 6, 28 + b], [hx + 3, 33 + b], [hx - 3, 33 + b], [hx - 6, 27 + b]], p.outline);
  polygon(a, [[hx - 6, 18 + b], [hx, 17 + b], [hx + 7, 18 + b], [hx + 4, 28 + b], [hx, 31 + b], [hx - 4, 27 + b]], profile.id.includes('red') ? p.clothLight : s.bone);
  a.line(hx - 1, 18 + b, hx - 2, 26 + b, p.trim, 2);
  eyes(s, hx, 22 + b, 4);
  if (!back) {
    a.rect(hx - 2 + (side ? 3 : 0), 28 + b, 5, 3, p.outline);
    a.line(hx - 3, 31 + b, hx - 5, 34 + b, s.bone);
    a.line(hx + 3, 31 + b, hx + 5, 34 + b, s.bone);
  }
  if (profile.id.includes('thunder')) for (const sign of [-1, 1]) {
    const dx = sign * 11;
    a.line(hx + dx, 8 + b, hx + dx - sign * 3, 12 + b, p.eye);
    a.line(hx + dx - sign * 3, 12 + b, hx + dx + sign * 1, 12 + b, p.eye);
    a.line(hx + dx + sign * 1, 12 + b, hx + dx - sign * 2, 17 + b, p.eye);
  }
}

function robe(s: BossScene, x: number, top: number, bottom: number, width: number) {
  const { art: a, p, back, profile } = s;
  polygon(a, [[x - width / 2, top], [x + width / 2, top], [x + width, bottom - 3], [x + width - 5, bottom], [x + 6, bottom - 3], [x, bottom], [x - 5, bottom - 2], [x - width, bottom]], p.outline);
  polygon(a, [[x - width / 2 + 2, top + 1], [x + width / 2 - 1, top + 1], [x + width - 3, bottom - 4], [x + 4, bottom - 5], [x, bottom - 2], [x - width + 3, bottom - 2]], p.cloth);
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * 4;
    a.line(x + dx * 0.5, top + 4, x + dx * 1.5, bottom - 5 + i % 2, i % 2 ? p.shade : p.clothLight, 2);
  }
  a.line(x - width / 2 + 2, top + 2, x - width + 4, bottom - 4, p.trim);
  a.line(x + width / 2 - 1, top + 2, x + width - 4, bottom - 4, p.trim);
  if (back) for (let i = 0; i < 4; i++) a.rect(x - 2, top + 5 + i * 5, 4, 2, i % 2 ? p.light : p.trim);
  else for (let i = 0; i < 3 + profile.variant % 2; i++) a.rect(x - 1, top + 8 + i * 4, 3, 2, p.trim);
}

function oracle(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, strike, profile, pose } = s;
  const float = b - (pose.motion === 'cast' ? 2 : 0);
  a.ellipse(x, 14 + float, side ? 11 : 16, 10, p.outline);
  a.ellipse(x, 14 + float, side ? 9 : 14, 8, p.trim);
  a.ellipse(x, 14 + float, side ? 7 : 12, 6, p.outline);
  // Fill the aureole interior with the hood: the unfilled outer ring remains a distinct silhouette.
  robe(s, x, 25 + float, 53 + float, 17);
  for (const sign of [-1, 1]) {
    const hy = 31 + float - strike * (sign > 0 ? 1 : 0.6);
    polygon(a, [[x + sign * 7, 23 + float], [x + sign * 19, hy - 2], [x + sign * 22, hy + 10], [x + sign * 13, hy + 8]], p.outline);
    polygon(a, [[x + sign * 8, 25 + float], [x + sign * 17, hy], [x + sign * 19, hy + 7], [x + sign * 13, hy + 5]], p.clothLight);
    plate(s, x + sign * 20, hy - 1, 4, 3, s.bone);
    for (let finger = 0; finger < 3; finger++) a.line(x + sign * (19 + finger), hy - 2, x + sign * (19 + finger), hy - 6 - finger % 2, s.bone);
    if (pose.motion === 'cast') crystal(s, x + sign * 20, hy - 12, 3, 4, p.eye);
  }
  polygon(a, [[x, 7 + float], [x + 11, 17 + float], [x + 10, 28 + float], [x, 32 + float], [x - 11, 27 + float], [x - 10, 17 + float]], p.outline);
  polygon(a, [[x, 9 + float], [x + 8, 17 + float], [x + 7, 27 + float], [x, 29 + float], [x - 8, 26 + float], [x - 7, 17 + float]], p.clothLight);
  if (!back) {
    a.ellipse(x + (side ? 3 : 0), 21 + float, 5, 7, p.outline);
    a.line(x - 3 + (side ? 3 : 0), 18 + float, x + 2 + (side ? 3 : 0), 17 + float, s.bone, 2);
    eyes(s, x, 21 + float, 3);
    a.line(x, 24 + float, x + 1, 27 + float, p.skinShade, 2);
  } else a.line(x, 12 + float, x + 1, 26 + float, p.trim, 2);
  const id = profile.id;
  if (id.includes('florist')) {
    for (const [dx, dy] of [[-8, 11], [6, 10], [-11, 18], [10, 20]] as const) flower(s, x + dx, dy + float, 4);
    if (!back) a.rect(x - 5, 20 + float, 11, 3, s.bone);
  } else if (id.includes('beekeeper')) {
    a.ellipse(x, 30 + float, 9, 7, p.outline);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      a.ellipse(x - 5 + col * 5 + row % 2, 26 + float + row * 4, 2, 2, p.trim);
      a.point(x - 5 + col * 5 + row % 2, 26 + float + row * 4, p.outline);
    }
  } else if (id.includes('hour') || profile.family === 'time') {
    hourglass(s, x, 36 + float, 6);
    if (id.includes('witch')) {
      polygon(a, [[x - 13, 16 + float], [x - 6, 11 + float], [x - 1, 3 + float], [x + 8, 5 + float], [x + 4, 8 + float], [x + 7, 13 + float], [x + 13, 16 + float]], p.outline);
      a.line(x - 8, 14 + float, x + 7, 14 + float, p.trim, 2);
      a.line(x - 3, 10 + float, x, 5 + float, p.clothLight, 2);
    } else {
      a.ellipse(x, 12 + float, 6, 6, p.outline);
      a.ellipse(x, 12 + float, 4, 4, p.trim);
      a.line(x, 9 + float, x, 12 + float, p.outline);
      a.line(x, 12 + float, x + 3, 12 + float, p.outline);
    }
  }
  else if (id.includes('lantern') || id.includes('pilgrim')) {
    const lx = x + 21, ly = 37 + float - strike;
    a.line(lx, ly - 8, lx, ly - 2, p.trim);
    a.rect(lx - 5, ly, 10, 11, p.outline);
    a.rect(lx - 3, ly + 2, 6, 7, p.eye);
    a.line(lx, ly + 2, lx, ly + 8, s.bright);
    a.line(lx - 6, ly, lx, ly - 4, p.trim, 2);
    a.line(lx, ly - 4, lx + 5, ly, p.trim, 2);
    if (id.includes('pilgrim')) {
      for (let coal = 0; coal < 4; coal++) {
        a.rect(x - 5 + coal * 3, 34 + float + coal % 2 * 3, 2, 3, p.eye);
        a.point(x - 4 + coal * 3, 34 + float + coal % 2 * 3, s.bright);
      }
      a.line(x - 4, 15 + float, x + 1, 15 + float, p.shade, 2);
    }
  } else if (id.includes('salt')) {
    for (const sign of [-1, 1]) crystal(s, x + sign * 11, 26 + float, 4, 8, s.bone);
    crown(s, x, 12 + float, 8);
  } else if (id.includes('meltwater')) {
    crown(s, x, 12 + float, 8);
    for (let row = 0; row < 3; row++) {
      a.line(x - 14 + row, 43 + float + row * 4, x + 9, 41 + float + row * 4, p.light, 2);
      a.line(x + 9, 41 + float + row * 4, x + 14 - row, 44 + float + row * 4, p.eye);
    }
  } else if (id.includes('sultan')) {
    plate(s, x, 13 + float, 11, 5, p.clothLight);
    crystal(s, x + (side ? 3 : 0), 14 + float, 3, 4, p.eye);
    a.line(x + 6, 12 + float, x + 12, 6 + float, p.trim, 3);
  } else if (id.includes('abbess')) {
    a.line(x, 32 + float, x, 44 + float, s.bone, 2);
    a.line(x - 5, 36 + float, x + 5, 36 + float, s.bone, 2);
    crown(s, x, 12 + float, 7);
  } else if (id.includes('hollow')) {
    for (const sign of [-1, 1]) skull(s, x + sign * 11, 30 + float, 4, 5);
  }
}

function flower(s: BossScene, x: number, y: number, radius: number) {
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]] as const) s.art.ellipse(x + dx, y + dy, radius - 1, radius - 1, s.p.clothLight);
  s.art.ellipse(x, y, 2, 2, s.p.outline);
  s.art.point(x, y, s.p.eye);
}

function hourglass(s: BossScene, x: number, y: number, width: number) {
  const { art: a, p } = s;
  polygon(a, [[x - width, y - 7], [x + width, y - 7], [x + 2, y], [x + width, y + 7], [x - width, y + 7], [x - 2, y]], p.outline);
  polygon(a, [[x - width + 2, y - 5], [x + width - 2, y - 5], [x, y], [x + width - 2, y + 5], [x - width + 2, y + 5], [x, y]], p.light);
  a.line(x - width, y - 7, x + width, y - 7, p.trim, 2);
  a.line(x - width, y + 6, x + width, y + 6, p.trim, 2);
  a.line(x, y - 1, x, y + 4, p.eye);
}

function reaper(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, pose, strike, profile } = s;
  const archer = /huntress|huntsman/.test(profile.id);
  const duelist = /torn_leaves|scarlet|reed|marshal/.test(profile.id);
  const handX = x + 15 + strike * 0.35, handY = 33 + b - strike;
  robe(s, x - 1, 25 + b, 54, 16);
  for (const sign of [-1, 1]) {
    const step = pose.step * sign;
    a.line(x + sign * 7, 42, x + sign * 8 + step, 53, p.shade, 5);
    a.rect(x + sign * 8 - 2 + step, 53, 7, 3, p.outline);
    plate(s, x + sign * 10, 26 + b, 7, 5);
  }
  limb(s, [x - 12, 29 + b], [x - 17, 37 + b], [x - 11, 42 + b], 4, s.bone);
  limb(s, [x + 11, 28 + b], [x + 18, 31 + b], [handX, handY], 4, s.bone);
  plate(s, x, 30 + b, 9, 10, p.main);
  for (let row = 0; row < 4; row++) a.line(x - 6, 28 + b + row * 4, x + 6, 30 + b + row * 4, row % 2 ? p.light : p.trim);
  if (!back) skull(s, x + (side ? 3 : 0), 18 + b, 6, 8);
  else plate(s, x, 18 + b, 8, 9, p.clothLight);
  polygon(a, [[x - 8, 20 + b], [x - 9, 11 + b], [x + 1, 6 + b], [x + 9, 12 + b], [x + 9, 21 + b], [x + 5, 14 + b], [x - 4, 13 + b]], p.outline);
  a.line(x - 6, 13 + b, x, 9 + b, p.trim, 2);
  if (archer) {
    a.line(handX + 2, 12 + b - strike, handX + 9, 22 + b - strike, p.outline, 3);
    a.line(handX + 9, 22 + b - strike, handX + 9, 39 + b - strike, p.outline, 3);
    a.line(handX + 9, 39 + b - strike, handX + 2, 48 + b - strike, p.outline, 3);
    a.line(handX + 2, 13 + b - strike, handX + 8, 23 + b - strike, p.trim, 2);
    a.line(handX + 8, 38 + b - strike, handX + 2, 47 + b - strike, p.trim, 2);
    a.line(handX + 2, 13 + b - strike, handX - strike, handY, s.bone);
    a.line(handX - strike, handY, handX + 2, 47 + b - strike, s.bone);
    a.line(handX - 8 - strike, handY, handX + 11, handY, p.light);
    polygon(a, [[handX + 8, handY - 3], [handX + 13, handY], [handX + 8, handY + 3]], p.trim);
  } else if (duelist) {
    a.line(handX, handY + 5, handX - 3, handY - 23, p.outline, 5);
    a.line(handX + 1, handY - 1, handX - 2, handY - 22, p.light, 3);
    a.line(handX + 2, handY - 1, handX - 1, handY - 21, s.bone);
    a.line(handX - 5, handY + 1, handX + 6, handY - 1, p.trim, 2);
    if (/reed|marshal/.test(profile.id)) {
      const flagX = x - 19;
      a.line(flagX, 9 + b, flagX, 50, p.trim, 2);
      polygon(a, [[flagX + 2, 11 + b], [flagX + 13, 15 + b], [flagX + 11, 26 + b], [flagX + 5, 22 + b], [flagX + 2, 25 + b]], p.clothLight);
      a.line(flagX + 5, 14 + b, flagX + 8, 21 + b, p.trim);
    }
  } else {
    const shaftX = handX + 1;
    a.line(shaftX, 12 + b - strike * 0.6, shaftX - 3, 54 - strike * 0.25, p.outline, 4);
    a.line(shaftX, 12 + b - strike * 0.6, shaftX - 3, 54 - strike * 0.25, p.clothLight, 2);
    polygon(a, [[shaftX + 2, 10 + b - strike * 0.6], [shaftX - 7, 6 + b], [shaftX - 21, 9 + b], [shaftX - 26, 17 + b], [shaftX - 15, 12 + b], [shaftX - 5, 13 + b], [shaftX + 2, 17 + b]], p.outline);
    polygon(a, [[shaftX, 11 + b - strike * 0.4], [shaftX - 7, 8 + b], [shaftX - 19, 11 + b], [shaftX - 23, 15 + b], [shaftX - 15, 11 + b], [shaftX - 5, 12 + b], [shaftX, 15 + b]], p.light);
    a.line(shaftX - 18, 11 + b, shaftX - 7, 9 + b, s.bone);
  }
  if (/executioner/.test(profile.id) && !back) a.rect(x - 5, 15 + b, 12, 5, p.cloth);
  if (profile.id.includes('silver')) {
    a.ellipse(x - 9, 14 + b, 5, 6, p.trim);
    a.ellipse(x - 7, 12 + b, 4, 5, p.cloth);
    a.line(x + 7, 20 + b, x + 10, 34 + b, p.light);
  } else if (profile.id.includes('copper')) {
    for (const sign of [-1, 1]) horn(s, [x + sign * 6, 13 + b], [x + sign * 11, 10 + b], [x + sign * 12, 5 + b], 2);
    if (!back) a.rect(x - 5, 19 + b, 12, 3, p.main);
  } else if (profile.id.includes('scarlet')) {
    polygon(a, [[x - 14, 13 + b], [x - 11, 7 + b], [x - 5, 10 + b], [x, 5 + b], [x + 6, 10 + b], [x + 12, 7 + b], [x + 14, 13 + b]], p.outline);
    a.line(x - 11, 10 + b, x - 6, 13 + b, p.trim, 2);
    a.line(x + 6, 13 + b, x + 12, 10 + b, p.trim, 2);
    a.line(x - 4, 23 + b, x + 7, 36 + b, p.clothLight, 3);
  } else if (profile.id.includes('torn')) {
    for (const sign of [-1, 1]) for (let leaf = 0; leaf < 3; leaf++) {
      const lx = x + sign * (10 + leaf * 3), ly = 22 + b + leaf * 3;
      polygon(a, [[lx, ly - 4], [lx + sign * 5, ly], [lx + sign * 2, ly + 6], [lx - sign * 1, ly + 2]], p.clothLight);
      a.line(lx, ly - 1, lx + sign * 2, ly + 4, p.trim);
    }
  } else if (profile.id.includes('frozen')) {
    for (const sign of [-1, 1]) for (let ice = 0; ice < 3; ice++) crystal(s, x + sign * (9 + ice * 3), 25 + b - ice * 2, 2, 5, p.light);
  } else if (profile.id.includes('noon')) {
    for (const sign of [-1, 1]) {
      a.line(x + sign * 7, 12 + b, x + sign * 13, 7 + b, p.trim, 2);
      a.line(x + sign * 8, 15 + b, x + sign * 16, 14 + b, p.trim);
    }
  }
  if (profile.id.includes('harvest')) for (const sign of [-1, 1]) {
    for (let straw = 0; straw < 3; straw++) a.line(x + sign * 12, 27 + b, x + sign * (15 + straw * 2), 20 + b + straw, p.trim);
  }
}

function serpentHead(s: BossScene, x: number, y: number, facingSide: boolean) {
  const { art: a, p, back } = s;
  plate(s, x, y, 6, 6);
  for (const sign of [-1, 1]) horn(s, [x + sign * 4, y - 2], [x + sign * 6, y - 5], [x + sign * 5, y - 9], 2);
  if (back) { a.line(x, y - 4, x, y + 4, p.trim, 2); return; }
  const jawX = x + (facingSide ? 4 : 0);
  a.ellipse(jawX, y + 3, 5, 4, p.outline);
  a.ellipse(jawX, y + 2, 4, 2, p.main);
  a.rect(jawX - 3, y + 3, 7, 2, p.outline);
  for (let tooth = 0; tooth < 3; tooth++) a.line(jawX - 2 + tooth * 2, y + 3, jawX - 2 + tooth * 2, y + 5, s.bone);
  a.rect(x + (facingSide ? 2 : -4), y - 2, 3, 2, p.eye);
  if (!facingSide) a.rect(x + 2, y - 2, 3, 2, p.eye);
}

function leviathan(s: BossScene) {
  const { art: a, p, x, bob: b, pose, side, strike, profile } = s;
  a.ellipse(x, 48 + b, 23, 7, p.outline);
  a.ellipse(x - 1, 47 + b, 21, 5, p.shade);
  a.line(x - 16, 45 + b, x + 16, 48 + b, p.light, 3);
  limb(s, [x - 14, 45 + b], [x - 25, 39 + b], [x - 22, 33 + b + pose.sway], 4);
  plate(s, x, 40 + b, 16, 12);
  const hydra = profile.id.includes('hydra');
  const heads = hydra ? 4 : 1;
  for (let head = 0; head < heads; head++) {
    const dx = (head - (heads - 1) / 2) * (side ? 9 : 12);
    const hx = x + dx + (side ? 4 : 0) + strike * (head % 2 ? 0.6 : 0.25);
    const hy = 18 + b + head % 2 * 7 + Math.round(pose.sway * (head % 2 ? -1 : 1));
    const bendX = x + dx * 0.9;
    limb(s, [x + dx * 0.45, 40 + b], [bendX, 30 + b], [hx - 1, hy + 3], 6);
    for (let scute = 0; scute < 4; scute++) a.line(bendX - 1, 33 + b - scute * 4, bendX + 3, 34 + b - scute * 4, p.trim, 2);
    serpentHead(s, hx, hy, side);
    if (!hydra) {
      crown(s, hx, hy - 5, 8);
      for (const sign of [-1, 1]) {
        polygon(a, [[hx + sign * 5, hy + 1], [hx + sign * 13, hy + 8], [hx + sign * 10, hy + 15], [hx + sign * 5, hy + 11]], p.outline);
        a.line(hx + sign * 6, hy + 3, hx + sign * 11, hy + 8, p.light, 2);
        a.line(hx + sign * 6, hy + 7, hx + sign * 9, hy + 13, p.trim);
      }
    }
  }
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    const xx = x - 11 + col * 5 + row % 2 * 2;
    a.line(xx, 40 + b + row * 4, xx + 2, 42 + b + row * 4, col % 2 ? p.main : p.light);
  }
  if (!hydra) for (const sign of [-1, 1]) {
    a.line(x + sign * 10, 39 + b, x + sign * 22, 34 + b - strike, p.light, 3);
    a.line(x + sign * 22, 34 + b - strike, x + sign * 26, 28 + b - strike, p.light, 2);
    a.ellipse(x + sign * 25, 26 + b - strike, 3, 4, p.eye);
    a.line(x + sign * 24, 24 + b - strike, x + sign * 24, 26 + b - strike, s.bright);
  }
}

function golem(s: BossScene) {
  const { art: a, p, x, bob: b, pose, strike, side, back, profile } = s;
  const moss = profile.id.includes('moss');
  for (const sign of [-1, 1]) {
    const step = pose.step * sign * 0.6;
    plate(s, x + sign * 10, 46 + b, 8, 8, p.shade);
    a.rect(x + sign * 10 - 6 + step, 50, 14, 6, p.outline);
    a.rect(x + sign * 10 - 5 + step, 50, 11, 4, p.main);
    limb(s, [x + sign * 10, 22 + b], [x + sign * 19, 31 + b - strike * (sign > 0 ? 1 : 0)], [x + sign * 20, 41 + b - strike * (sign > 0 ? 1.2 : 0)], sign > 0 ? 9 : 7);
    plate(s, x + sign * 20 + 1, 43 + b - strike * (sign > 0 ? 1.2 : 0), sign > 0 ? 9 : 7, 7);
  }
  polygon(a, [[x - 16, 18 + b], [x + 15, 18 + b], [x + 16, 34 + b], [x + 9, 45 + b], [x - 11, 44 + b], [x - 17, 31 + b]], p.outline);
  polygon(a, [[x - 13, 20 + b], [x + 11, 20 + b], [x + 13, 34 + b], [x + 7, 42 + b], [x - 8, 41 + b], [x - 14, 30 + b]], p.main);
  a.line(x - 12, 21 + b, x - 10, 33 + b, p.light, 3);
  a.line(x + 9, 21 + b, x + 11, 35 + b, p.shade, 3);
  const faceX = x + (side ? 3 : 0);
  plate(s, faceX, 14 + b, 8, 8);
  if (moss) {
    polygon(a, [[faceX - 9, 13 + b], [faceX - 9, 7 + b], [faceX - 2, 5 + b], [faceX + 4, 8 + b], [faceX + 8, 6 + b], [faceX + 9, 13 + b]], p.outline);
    a.line(faceX - 7, 8 + b, faceX - 1, 7 + b, p.light, 2);
    a.line(faceX + 1, 8 + b, faceX + 5, 10 + b, p.main, 3);
  } else crown(s, faceX, 11 + b, 9);
  eyes(s, faceX, 15 + b, 4);
  if (!back) {
    a.ellipse(x, 31 + b, 9, 9, p.outline);
    if (moss) {
      a.line(x - 7, 28 + b, x - 1, 32 + b, p.light, 2);
      a.line(x - 1, 32 + b, x + 4, 26 + b, p.light, 2);
      a.line(x - 1, 32 + b, x + 5, 36 + b, p.eye, 2);
      a.line(x - 1, 32 + b, x - 4, 39 + b, p.eye);
      crystal(s, x - 1, 31 + b, 3, 5, p.eye);
    } else {
      a.ellipse(x, 31 + b, 7, 7, p.clothLight);
      a.ellipse(x, 31 + b, 5, 6, p.eye);
      a.ellipse(x - 1, 30 + b, 3, 4, s.bright);
      for (let bar = -1; bar <= 1; bar++) a.line(x + bar * 4, 24 + b, x + bar * 4, 38 + b, p.shade, 2);
    }
  } else {
    for (let seam = 0; seam < 3; seam++) a.line(x - 10, 25 + b + seam * 6, x + 9, 26 + b + seam * 6, p.shade, 2);
  }
  for (const sign of [-1, 1]) {
    plate(s, x + sign * 13, 22 + b, 5, 5, p.trim);
    for (let rivet = 0; rivet < 3; rivet++) a.rect(x + sign * 13 - 2 + rivet * 2, 23 + b, 1, 2, s.bone);
  }
  if (moss) for (const [dx, dy] of [[-15, 18], [12, 20], [-21, 38], [7, 45]] as const) {
    a.ellipse(x + dx, dy + b, 5, 2, p.main);
    a.line(x + dx - 3, dy + b, x + dx - 3, dy + b + 6, p.main, 2);
    a.line(x + dx + 1, dy + b, x + dx + 2, dy + b + 4, p.light);
  }
  if (profile.id.includes('sun')) for (let ray = 0; ray < 6; ray++) {
    const angle = (ray / 5 * 1.5 + 0.75) * Math.PI;
    a.line(faceX + Math.cos(angle) * 7, 14 + b + Math.sin(angle) * 7, faceX + Math.cos(angle) * 12, 14 + b + Math.sin(angle) * 12, p.trim, 2);
  }
}

function boneSovereign(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, strike, profile, pose } = s;
  robe(s, x, 30 + b, 55, 20);
  for (const sign of [-1, 1]) {
    limb(s, [x + sign * 10, 23 + b], [x + sign * 22, 31 + b - strike * (sign > 0 ? 0.6 : 0)], [x + sign * 23, 46 + b - strike], 4, s.bone);
    for (let finger = 0; finger < 3; finger++) a.line(x + sign * (22 + finger), 45 + b - strike, x + sign * (21 + finger * 2), 51 + b - strike, s.bone);
    // Shoulders are stacked, curved rib arches, not conventional pauldrons.
    for (let rib = 0; rib < 4; rib++) {
      const xx = x + sign * (10 + rib * 4);
      limb(s, [x + sign * 5, 31 + b], [xx, 22 + b - rib], [xx - sign * 2, 13 + b + rib * 2], 2, s.bone);
    }
  }
  a.ellipse(x, 32 + b, 13, 15, p.outline);
  a.line(x, 23 + b, x, 48 + b, s.bone, 3);
  for (let rib = 0; rib < 5; rib++) for (const sign of [-1, 1]) {
    const ry = 25 + b + rib * 4;
    a.line(x + sign * 2, ry + 2, x + sign * (11 - rib), ry, p.trim, 3);
    a.line(x + sign * (11 - rib), ry, x + sign * (10 - rib), ry + 3, s.bone, 2);
    a.point(x + sign * 4, ry + 1, s.bone);
  }
  if (!back) a.ellipse(x, 34 + b, 3, 5, p.eye);
  skull(s, x + (side ? 4 : 0), 17 + b, 7, 8);
  crown(s, x + (side ? 4 : 0), 10 + b, 10);
  if (profile.id.includes('bell')) {
    const bellY = 36 + b - Math.max(0, strike * 0.3);
    polygon(a, [[x - 5, bellY - 7], [x + 5, bellY - 7], [x + 7, bellY + 4], [x + 11, bellY + 7], [x - 11, bellY + 7], [x - 7, bellY + 4]], p.outline);
    polygon(a, [[x - 3, bellY - 5], [x + 3, bellY - 5], [x + 5, bellY + 4], [x + 8, bellY + 5], [x - 8, bellY + 5], [x - 5, bellY + 4]], p.trim);
    a.line(x - 3, bellY - 3, x - 5, bellY + 4, s.bone, 2);
    a.rect(x - 1 + pose.sway, bellY + 7, 3, 4, p.light);
  } else if (profile.id.includes('frost') || profile.id.includes('white')) {
    for (const sign of [-1, 1]) crystal(s, x + sign * 20, 25 + b, 4, 9);
  } else if (profile.id.includes('ossuary')) {
    for (const sign of [-1, 1]) skull(s, x + sign * 14, 44 + b, 4, 4);
  }
}

function drake(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, strike, pose, profile } = s;
  const wingLift = pose.motion === 'cast' ? 3 : Math.round(pose.sway + strike * 0.7);
  for (const sign of [-1, 1]) {
    polygon(a, [[x + sign * 8, 31 + b], [x + sign * 17, 10 + b - wingLift], [x + sign * 27, 8 + b], [x + sign * 26, 29 + b], [x + sign * 19, 24 + b], [x + sign * 17, 35 + b]], p.outline);
    polygon(a, [[x + sign * 10, 29 + b], [x + sign * 18, 13 + b - wingLift], [x + sign * 25, 12 + b], [x + sign * 24, 25 + b], [x + sign * 19, 22 + b], [x + sign * 17, 32 + b]], p.cloth);
    a.line(x + sign * 10, 29 + b, x + sign * 24, 12 + b, p.clothLight, 2);
    a.line(x + sign * 18, 14 + b, x + sign * 19, 26 + b, p.trim);
    limb(s, [x + sign * 9, 39 + b], [x + sign * 16, 47 - pose.step * sign], [x + sign * 17 + pose.step * sign, 53], 5);
    for (let toe = 0; toe < 3; toe++) a.line(x + sign * 17 - 2 + toe * 2 + pose.step * sign, 52, x + sign * 18 - 2 + toe * 2 + pose.step * sign, 55, s.bone);
  }
  limb(s, [x - 9, 43 + b], [x - 23, 49 + b], [x - 27, 38 + b + pose.sway], 4);
  plate(s, x, 36 + b, 15, 14);
  for (let row = 0; row < 4; row++) {
    a.line(x - 7, 30 + b + row * 5, x + 7, 32 + b + row * 5, p.trim, 3);
    a.line(x - 7, 29 + b + row * 5, x + 4, 30 + b + row * 5, p.light);
  }
  const hx = x + (side ? 13 : 0) + strike * 0.4, hy = 24 + b;
  plate(s, hx, hy, 9, 9);
  for (const sign of [-1, 1]) {
    horn(s, [hx + sign * 5, hy - 6], [hx + sign * 9, hy - 10], [hx + sign * 8, hy - 16], 3);
    a.line(hx + sign * 7, hy + 1, hx + sign * 13, hy + 5, p.light, 2);
  }
  eyes(s, hx, hy - 1, 5);
  if (!back) {
    const mx = hx + (side ? 5 : 0);
    polygon(a, [[mx - 7, hy + 2], [mx + 8, hy + 2], [mx + 10, hy + 7], [mx + 4, hy + 13], [mx - 6, hy + 10]], p.outline);
    a.line(mx - 5, hy + 3, mx + 6, hy + 3, p.light, 3);
    for (let tooth = 0; tooth < 4; tooth++) a.line(mx - 5 + tooth * 3, hy + 5, mx - 5 + tooth * 3, hy + 8, s.bone);
    a.line(mx - 3, hy + 10, mx + 4, hy + 11, p.trim, 2);
  }
  if (profile.id.includes('comet')) {
    crystal(s, x - 20, 45 + b, 4, 7, p.eye);
    a.line(x - 22, 42 + b, x - 27, 31 + b, p.eye);
  }
  if (profile.id.includes('polar')) for (let spine = 0; spine < 4; spine++) crystal(s, x - 11 + spine * 5, 28 + b + spine % 2 * 4, 2, 4, s.bone);
}

function behemoth(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, pose, strike, profile } = s;
  for (const sign of [-1, 1]) {
    const step = pose.step * sign * 0.7;
    limb(s, [x + sign * 9, 40 + b], [x + sign * 12, 46], [x + sign * 12 + step, 52], 7);
    a.rect(x + sign * 12 - 4 + step, 52, 11, 4, p.outline);
    for (let toe = 0; toe < 3; toe++) a.rect(x + sign * 12 - 3 + step + toe * 3, 53, 2, 2, s.bone);
    const ay = 36 + b - (sign > 0 ? strike : -strike * 0.2);
    limb(s, [x + sign * 12, 26 + b], [x + sign * 22, ay], [x + sign * 22, ay + 10], 8, p.skinShade);
    plate(s, x + sign * 23, ay + 10, 7, 6, p.skin);
    for (let claw = 0; claw < 3; claw++) a.line(x + sign * (19 + claw * 2), ay + 12, x + sign * (20 + claw * 2), ay + 16, s.bone, 2);
  }
  plate(s, x, 30 + b, 20, 19, p.skinShade);
  for (const sign of [-1, 1]) {
    plate(s, x + sign * 13, 23 + b, 9, 8);
    for (let spike = 0; spike < 3; spike++) horn(s, [x + sign * (10 + spike * 4), 20 + b + spike * 2], [x + sign * (12 + spike * 4), 15 + b + spike * 2], [x + sign * (14 + spike * 4), 11 + b + spike * 3], 2);
  }
  for (let rib = 0; rib < 4; rib++) {
    const yy = 33 + b + rib * 3;
    a.line(x - 11 + rib, yy, x - 2, yy + 2, p.skin, 2);
    a.line(x + 3, yy + 1, x + 13 - rib, yy, p.shade, 2);
  }
  const hx = x + (side ? 8 : 0), hy = 26 + b;
  plate(s, hx, hy, 10, 10, p.main);
  for (const sign of [-1, 1]) horn(s, [hx + sign * 6, hy - 6], [hx + sign * 12, hy - 10], [hx + sign * 10, hy - 17], 4);
  eyes(s, hx, hy - 1, 5);
  if (!back) {
    polygon(a, [[hx - 7, hy + 4], [hx + 7, hy + 4], [hx + 4, hy + 10], [hx - 4, hy + 11]], p.outline);
    for (const sign of [-1, 1]) horn(s, [hx + sign * 5, hy + 9], [hx + sign * 7, hy + 5], [hx + sign * 6, hy + 1], 2);
    a.line(hx - 2, hy + 9, hx + 3, hy + 9, p.clothLight);
  }
  if (/obsidian|icebreaker/.test(profile.id)) {
    for (let slab = 0; slab < 3; slab++) crystal(s, x - 10 + slab * 9, 19 + b + slab % 2 * 2, 5, 8, profile.id.includes('obsidian') ? p.shade : p.light);
  } else if (profile.id.includes('granary')) {
    a.ellipse(x, 41 + b, 9, 6, p.outline);
    for (let tooth = 0; tooth < 5; tooth++) a.line(x - 6 + tooth * 3, 37 + b, x - 6 + tooth * 3, 41 + b, s.bone, 2);
    a.line(x - 6, 44 + b, x + 6, 44 + b, p.clothLight, 2);
  } else if (profile.id.includes('grave')) {
    for (const sign of [-1, 1]) skull(s, x + sign * 13, 23 + b, 4, 5);
  } else if (profile.id.includes('butcher')) {
    a.line(x + 24, 35 + b - strike, x + 24, 51 - strike, p.trim, 3);
    polygon(a, [[x + 18, 28 + b - strike], [x + 28, 28 + b - strike], [x + 28, 40 + b - strike], [x + 20, 42 + b - strike]], p.outline);
    a.rect(x + 21, 30 + b - strike, 6, 10, p.light);
    a.line(x + 21, 39 + b - strike, x + 26, 38 + b - strike, p.clothLight, 2);
  }
}

function jotunn(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, pose, strike, profile } = s;
  robe(s, x, 22 + b, 54, 22);
  for (const sign of [-1, 1]) {
    const step = pose.step * sign * 0.8;
    limb(s, [x + sign * 8, 38 + b], [x + sign * 10, 47], [x + sign * 11 + step, 52], 7);
    a.rect(x + sign * 11 - 4 + step, 53, 11, 3, p.outline);
    limb(s, [x + sign * 12, 23 + b], [x + sign * 21, 32 + b], [x + sign * 23, 40 + b - strike * (sign > 0 ? 1 : 0)], 6, p.skinShade);
  }
  plate(s, x, 30 + b, 15, 16);
  for (const sign of [-1, 1]) {
    plate(s, x + sign * 12, 22 + b, 8, 7, s.bone);
    for (let fur = 0; fur < 4; fur++) a.line(x + sign * (8 + fur * 3), 21 + b, x + sign * (9 + fur * 3), 27 + b - fur % 2 * 2, p.light, 2);
  }
  a.line(x - 11, 39 + b, x + 11, 39 + b, p.cloth, 4);
  crystal(s, x, 39 + b, 4, 4, p.trim);
  const hx = x + (side ? 3 : 0);
  plate(s, hx, 15 + b, 8, 9, p.skin);
  if (!back) {
    polygon(a, [[hx - 7, 18 + b], [hx - 5, 29 + b], [hx, 35 + b], [hx + 6, 27 + b], [hx + 7, 18 + b]], p.outline);
    polygon(a, [[hx - 5, 19 + b], [hx - 3, 28 + b], [hx, 32 + b], [hx + 4, 26 + b], [hx + 5, 19 + b]], s.bone);
    for (let braid = -1; braid <= 1; braid++) a.line(hx + braid * 3, 21 + b, hx + braid * 2, 29 + b, p.trim);
  }
  eyes(s, hx, 15 + b, 4);
  crown(s, hx, 10 + b, 9);
  const weaponX = x + 23, weaponY = 24 + b - strike;
  a.line(weaponX, weaponY - 2, weaponX - 1, 49 - strike, p.outline, 4);
  a.line(weaponX, weaponY, weaponX - 1, 49 - strike, p.trim, 2);
  polygon(a, [[weaponX - 8, weaponY - 9], [weaponX + 6, weaponY - 9], [weaponX + 7, weaponY + 1], [weaponX - 8, weaponY + 3], [weaponX - 11, weaponY - 3]], p.outline);
  a.rect(weaponX - 7, weaponY - 7, 12, 8, p.main);
  a.line(weaponX - 6, weaponY - 6, weaponX + 3, weaponY - 6, p.light, 2);
  if (profile.family === 'storm' || profile.id.includes('storm')) {
    a.line(weaponX - 2, weaponY - 6, weaponX - 5, weaponY - 2, p.eye, 2);
    a.line(weaponX - 5, weaponY - 2, weaponX, weaponY - 2, p.eye, 2);
    a.line(weaponX, weaponY - 2, weaponX - 3, weaponY + 2, p.eye, 2);
  }
}

function phoenix(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, strike, pose, profile } = s;
  const flap = Math.round((pose.motion === 'walk' ? pose.step : pose.sway) * 1.2 + strike * 0.7) - (pose.motion === 'cast' ? 3 : 0);
  for (const sign of [-1, 1]) {
    const wingY = 18 + b + flap;
    polygon(a, [[x + sign * 5, 31 + b], [x + sign * 13, wingY], [x + sign * 28, wingY - 7], [x + sign * 25, wingY + 8], [x + sign * 16, 40 + b]], p.outline);
    polygon(a, [[x + sign * 6, 30 + b], [x + sign * 14, wingY + 1], [x + sign * 26, wingY - 4], [x + sign * 22, wingY + 8], [x + sign * 15, 36 + b]], p.clothLight);
    for (let feather = 0; feather < 6; feather++) {
      const bx = x + sign * (11 + feather * 2.4);
      const by = wingY + 4 - feather * 1.5;
      const ex = x + sign * (14 + feather * 2.3);
      const ey = 41 + b - feather * 2.4 + flap;
      polygon(a, [[bx - 2, by], [bx + 2, by], [ex + sign * 2, ey - 3], [ex, ey + 2], [ex - sign * 2, ey]], p.outline);
      a.line(bx, by, ex, ey, feather % 2 ? p.main : p.trim, 2);
      a.line(bx, by, ex, ey - 2, p.light);
    }
    a.line(x + sign * 6, 40 + b, x + sign * 9, 49, p.trim, 2);
    for (let toe = 0; toe < 3; toe++) a.line(x + sign * 9, 48, x + sign * (6 + toe * 3), 52, s.bone);
  }
  for (let feather = -2; feather <= 2; feather++) {
    const tx = x + feather * 5 + pose.sway;
    polygon(a, [[x - 3 + feather, 36 + b], [x + 3 + feather, 36 + b], [tx + 2, 52 - Math.abs(feather)], [tx, 56 - Math.abs(feather)], [tx - 3, 51]], p.outline);
    a.line(x + feather, 38 + b, tx, 53 - Math.abs(feather), feather % 2 ? p.eye : p.clothLight, 3);
    a.line(x + feather, 40 + b, tx, 53 - Math.abs(feather), p.trim);
  }
  plate(s, x, 32 + b, 9, 13);
  for (let row = 0; row < 4; row++) {
    const yy = 27 + b + row * 4;
    a.line(x - 5 + row % 2, yy, x, yy + 3, p.trim, 2);
    a.line(x, yy + 3, x + 5 - row % 2, yy, p.light, 2);
  }
  const hx = x + (side ? 6 : 0) + strike * 0.3, hy = 18 + b;
  plate(s, hx, hy, 7, 8);
  for (let crest = 0; crest < 3; crest++) {
    a.line(hx - 3 + crest * 3, hy - 5, hx - 6 + crest * 4, hy - 12 - crest % 2 * 2, p.outline, 3);
    a.line(hx - 3 + crest * 3, hy - 5, hx - 6 + crest * 4, hy - 12 - crest % 2 * 2, p.eye, 1);
  }
  if (!back) {
    const beakX = hx + (side ? 5 : 0);
    polygon(a, side ? [[beakX - 1, hy], [beakX + 9, hy + 3], [beakX + 5, hy + 8], [beakX + 5, hy + 4], [beakX - 1, hy + 4]] : [[beakX - 4, hy + 2], [beakX + 4, hy + 2], [beakX + 2, hy + 10], [beakX - 1, hy + 7]], p.outline);
    polygon(a, side ? [[beakX, hy + 1], [beakX + 7, hy + 3], [beakX + 3, hy + 4], [beakX, hy + 3]] : [[beakX - 2, hy + 3], [beakX + 3, hy + 3], [beakX + 1, hy + 8]], p.trim);
  }
  eyes(s, hx, hy - 1, 4);
  if (profile.id.includes('carrion')) crown(s, hx, hy - 6, 8);
  if (profile.id.includes('aurora')) {
    for (const sign of [-1, 1]) {
      a.line(x + sign * 18, 16 + b + flap, x + sign * 25, 9 + b + flap, p.eye, 2);
      a.line(x + sign * 23, 29 + b, x + sign * 28, 37 + b, p.eye);
    }
  }
}

function locust(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, strike, pose } = s;
  for (const sign of [-1, 1]) {
    polygon(a, [[x + sign * 4, 25 + b], [x + sign * 22, 12 + b], [x + sign * 26, 17 + b], [x + sign * 17, 39 + b], [x + sign * 5, 43 + b]], p.outline);
    polygon(a, [[x + sign * 5, 26 + b], [x + sign * 21, 15 + b], [x + sign * 23, 18 + b], [x + sign * 15, 37 + b], [x + sign * 6, 40 + b]], p.clothLight);
    for (let vein = 0; vein < 4; vein++) a.line(x + sign * 6, 27 + b + vein * 2, x + sign * (21 - vein * 2), 17 + b + vein * 5, p.light);
    const step = pose.step * sign;
    limb(s, [x + sign * 7, 38 + b], [x + sign * 22, 32 + b - step], [x + sign * 17 + step, 54], 5);
    a.line(x + sign * 18, 53, x + sign * 25 + step, 55, p.trim, 2);
    limb(s, [x + sign * 7, 29 + b], [x + sign * 15, 31 + b], [x + sign * 20, 45 - strike], 3);
    polygon(a, [[x + sign * 20, 44 - strike], [x + sign * 25, 31 - strike], [x + sign * 24, 43 - strike], [x + sign * 19, 51 - strike]], p.outline);
    a.line(x + sign * 20, 46 - strike, x + sign * 24, 33 - strike, s.bone, 2);
  }
  for (let segment = 0; segment < 5; segment++) plate(s, x, 47 + b - segment * 5, 5 + segment, 5, segment % 2 ? p.shade : p.main);
  plate(s, x, 28 + b, 10, 9);
  const hx = x + (side ? 3 : 0), hy = 17 + b;
  plate(s, hx, hy, 8, 9);
  for (const sign of [-1, 1]) {
    a.line(hx + sign * 4, hy - 6, hx + sign * 7, hy - 11, p.outline, 2);
    a.line(hx + sign * 7, hy - 11, hx + sign * 13, hy - 12, p.trim);
    if (!back && (!side || sign > 0)) {
      a.ellipse(hx + sign * 5, hy, 4, 5, p.outline);
      a.ellipse(hx + sign * 5, hy - 1, 3, 4, p.eye);
      for (let lens = 0; lens < 3; lens++) a.point(hx + sign * 5 + lens % 2, hy - 3 + lens * 2, s.bright);
    }
    a.line(hx + sign * 3, hy + 5, hx + sign * 5, hy + 9, p.trim, 2);
    a.line(hx + sign * 5, hy + 9, hx + sign * 1, hy + 11, s.bone);
  }
  crown(s, hx, hy - 5, 7);
}

function crystalSovereign(s: BossScene) {
  const { art: a, p, x, bob: b, side, back, pose, strike, profile } = s;
  const float = b - (pose.motion === 'cast' ? 2 : 0);
  const phase = pose.sway * 1.5;
  for (const sign of [-1, 1]) {
    crystal(s, x + sign * 20, 23 + float + sign * phase, 6, 13, p.light);
    crystal(s, x + sign * 23, 44 + float - sign * phase - strike * (sign > 0 ? 1 : 0), 5, 8, p.main);
    crystal(s, x + sign * 10, 47 + float + sign * phase, 5, 8, p.light);
    a.line(x + sign * 9, 28 + float, x + sign * 16, 26 + float + sign * phase, p.eye);
    a.line(x + sign * 16, 26 + float + sign * phase, x + sign * 20, 40 + float - sign * phase, p.eye);
  }
  crystal(s, x, 28 + float, side ? 10 : 14, 22, p.light);
  crystal(s, x - 4, 22 + float, 5, 12, p.trim);
  crystal(s, x + 7, 32 + float, 6, 11, p.main);
  if (!back) {
    const cx = x + (side ? 4 : 0);
    a.ellipse(cx, 29 + float, 5, 7, p.outline);
    a.ellipse(cx, 29 + float, 3, 5, p.eye);
    a.line(cx, 26 + float, cx, 31 + float, s.bright, 2);
    a.line(cx - 5, 23 + float, cx - 9, 20 + float, p.outline);
    a.line(cx + 4, 34 + float, cx + 8, 40 + float, p.outline);
  } else a.line(x, 12 + float, x + 2, 42 + float, p.trim, 2);
  if (profile.id.includes('empress')) crown(s, x, 14 + float, 11);
  if (profile.id.includes('seed')) {
    for (const sign of [-1, 1]) {
      a.line(x + sign * 5, 45 + float, x + sign * 13, 52 + float, p.clothLight, 2);
      a.line(x + sign * 13, 52 + float, x + sign * 20, 50 + float, p.main, 2);
      a.ellipse(x + sign * 17, 50 + float, 4, 2, p.main);
    }
  } else if (profile.id.includes('glacier')) {
    for (let tooth = 0; tooth < 3; tooth++) crystal(s, x - 9 + tooth * 9, 14 + float + tooth % 2 * 4, 3, 9);
  }
}

/** Small authored seals distinguish individuals even when several share an anatomical family. */
function identitySeal(s: BossScene) {
  const { art: a, p, profile, x, bob: b, back, side } = s;
  const id = profile.id.replace(/^boss_/, '');
  const seals: Record<string, 'moon' | 'sun' | 'thorn' | 'scar' | 'rune' | 'bone' | 'drop' | 'clock'> = {
    briar_king: 'thorn', thousand_fangs: 'drop', first_thunder: 'rune', blind_florist: 'thorn', torn_leaves: 'thorn', meltwater_lady: 'drop', moss_colossus: 'rune', plague_beekeeper: 'drop', silver_huntress: 'moon', reed_tyrant: 'thorn', buried_bell: 'bone', red_antler: 'scar', glass_seed: 'thorn',
    brass_sun: 'sun', dune_queen: 'sun', scarlet_admiral: 'scar', storm_matriarch: 'rune', cinder_butcher: 'scar', salt_prophet: 'rune', golden_hydra: 'sun', noon_executioner: 'sun', ember_phoenix: 'sun', copper_huntsman: 'moon', mirage_sultan: 'moon', locust_emperor: 'rune', obsidian_ram: 'scar',
    harvest_reaper: 'thorn', hollow_duchess: 'moon', ossuary_archon: 'bone', rot_gardener: 'drop', carrion_king: 'bone', rust_marshal: 'scar', blood_granary: 'drop', last_lantern: 'rune', witch_of_falling_hours: 'clock', grave_boar: 'bone', amber_widow: 'clock', ashen_pilgrim: 'sun',
    white_sovereign: 'rune', polar_devourer: 'moon', glass_empress: 'rune', grave_frost: 'bone', starved_aurora: 'moon', frozen_executioner: 'scar', mother_white_web: 'rune', iron_icebreaker: 'scar', last_hour_keeper: 'clock', black_snow_abbess: 'bone', comet_wolf: 'moon', heart_of_last_glacier: 'moon',
  };
  const seal = seals[id];
  if (!seal) return;
  const placement = profile.bossForm === 'broodQueen' ? [side ? -7 : 0, 26] : profile.bossForm === 'leviathan' ? [0, 46]
    : profile.bossForm === 'antlerTitan' ? [-6, 39] : profile.bossForm === 'phoenix' ? [0, 35]
      : profile.bossForm === 'drake' ? [-6, 40] : profile.bossForm === 'colossus' ? [6, 39]
        : profile.bossForm === 'crystal' ? [side ? 2 : -7, 34] : [-5, 37];
  const sx = x + placement[0], sy = placement[1] + b;
  if (seal === 'moon') {
    a.ellipse(sx, sy, 3, 4, p.trim);
    a.ellipse(sx + 2, sy - 1, 2, 3, back ? p.shade : p.main);
    a.point(sx - 4, sy - 4, p.eye);
  } else if (seal === 'sun') {
    a.ellipse(sx, sy, 3, 3, p.trim);
    a.ellipse(sx, sy, 1, 1, p.eye);
    for (const sign of [-1, 1]) {
      a.line(sx + sign * 4, sy, sx + sign * 5, sy, p.trim);
      a.line(sx, sy + sign * 4, sx, sy + sign * 5, p.trim);
    }
  } else if (seal === 'thorn') {
    a.line(sx, sy - 4, sx, sy + 4, p.trim, 2);
    a.line(sx, sy, sx - 4, sy - 3, p.light);
    a.line(sx, sy + 2, sx + 4, sy - 1, p.light);
  } else if (seal === 'scar') {
    a.line(sx - 3, sy - 4, sx + 2, sy + 4, p.outline, 2);
    for (let stitch = 0; stitch < 3; stitch++) a.line(sx - 3 + stitch * 2, sy - 2 + stitch * 2, sx + stitch * 2, sy - 3 + stitch * 2, p.trim);
  } else if (seal === 'bone') {
    a.line(sx - 3, sy - 3, sx + 3, sy + 3, s.bone, 2);
    a.line(sx + 3, sy - 3, sx - 3, sy + 3, s.bone, 2);
    a.rect(sx - 1, sy - 2, 3, 3, p.outline);
    a.point(sx, sy - 1, p.eye);
  } else if (seal === 'drop') {
    polygon(a, [[sx, sy - 5], [sx + 3, sy], [sx + 2, sy + 3], [sx - 2, sy + 3], [sx - 3, sy]], p.trim);
    a.line(sx - 1, sy - 1, sx - 1, sy + 1, p.eye);
  } else if (seal === 'clock') {
    a.ellipse(sx, sy, 4, 4, p.outline);
    a.ellipse(sx, sy, 3, 3, p.trim);
    a.line(sx, sy - 2, sx, sy, p.outline);
    a.line(sx, sy, sx + 2, sy + 1, p.outline);
  } else {
    a.line(sx - 3, sy - 4, sx - 3, sy + 4, p.trim);
    a.line(sx - 3, sy - 4, sx + 3, sy, p.trim);
    a.line(sx + 3, sy, sx - 3, sy + 2, p.trim);
    a.line(sx, sy, sx + 3, sy + 4, p.eye);
  }
}

/** Every boss owns a full 64px composition, with planted feet at 56 and room for action keys. */
export function drawBoss(art: PixelCanvas, profile: EnemyAppearance, facing: UnitFacing, pose: UnitPose): void {
  const canvas = new PixelCanvas(64);
  const p = profile.palette;
  const s: BossScene = {
    art: canvas, profile, pose, p, side: facing === 'east', back: facing === 'north',
    x: 31 + Math.round(pose.recoil * 0.55), bob: Math.round(pose.breath * 0.6 - pose.lift),
    strike: pose.reach * 1.35, bone: mix(p.trim, '#f3e5c8', 0.55), bright: mix(p.eye, '#fff4dc', 0.68),
  };
  switch (profile.bossForm) {
    case 'colossus': colossus(s); break;
    case 'broodQueen': broodQueen(s); break;
    case 'antlerTitan': antlerTitan(s); break;
    case 'oracle': oracle(s); break;
    case 'reaper': reaper(s); break;
    case 'leviathan': leviathan(s); break;
    case 'golem': golem(s); break;
    case 'boneSovereign': boneSovereign(s); break;
    case 'drake': drake(s); break;
    case 'behemoth': behemoth(s); break;
    case 'jotunn': jotunn(s); break;
    case 'phoenix': phoenix(s); break;
    case 'locust': locust(s); break;
    case 'crystal': crystalSovereign(s); break;
    default: behemoth(s);
  }
  identitySeal(s);
  // Reserve the atlas gutters even for the longest horn, weapon windup or striking claw.
  for (const pixel of canvas.result()) {
    if (pixel.x >= 2 && pixel.x <= 61 && pixel.y >= 2 && pixel.y <= 56) art.point(pixel.x, pixel.y, pixel.color);
  }
}
