import type { EnemyAppearance } from './enemyAppearance';
import { PixelCanvas } from './pixelCanvas';
import type { UnitFacing, UnitPose } from './unitPose';
import type { UnitPalette } from './unitPalette';

type Point = readonly [number, number];
interface EnemyInk {
  a: PixelCanvas;
  p: UnitPalette;
  appearance: EnemyAppearance;
  pose: UnitPose;
  side: boolean;
  back: boolean;
  x: number;
  bob: number;
  reach: number;
  stride: number;
  tier: number;
  variant: number;
  style: number;
  breadth: number;
}

const bone = '#d5ccb0';
const boneShade = '#8e8976';
const tooth = '#f0dfba';
const flesh = '#7e414a';
const mouth = '#24191f';
const wood = '#72543a';
const woodLight = '#a18757';

function polygon(a: PixelCanvas, points: readonly Point[], color: string) {
  a.polygon(points.map(([x, y]) => ({ x, y })), color);
}

function oval(a: PixelCanvas, x: number, y: number, rx: number, ry: number, fill: string, outline: string) {
  a.ellipse(x, y, Math.max(1, Math.round(rx)), Math.max(1, Math.round(ry)), outline);
  a.ellipse(x, y - 1, Math.max(1, Math.round(rx - 1)), Math.max(1, Math.round(ry - 1)), fill);
}

/** Thick joints retain a readable volume when limbs cross the torso. */
function limb(c: EnemyInk, points: readonly Point[], width: number, fill: string, highlight?: string) {
  const { a, p } = c;
  const edge = Math.floor((width + 2) / 2), inset = Math.floor(width / 2);
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    a.line(x0 - edge, y0 - edge, x1 - edge, y1 - edge, p.outline, width + 2);
    a.line(x0 - inset, y0 - inset, x1 - inset, y1 - inset, fill, width);
    if (highlight) a.line(x0 - inset, y0 - inset, x1 - inset, y1 - inset, highlight, Math.max(1, width - 2));
  }
}

function spike(c: EnemyInk, base: Point, tip: Point, width: number, fill = c.p.light) {
  const [x, y] = base, [tx, ty] = tip;
  polygon(c.a, [[x - width, y + 1], [tx, ty], [x + width, y + 1]], c.p.outline);
  polygon(c.a, [[x - width + 1, y], [tx, ty + 1], [x + width - 1, y]], fill);
}

function plate(c: EnemyInk, x: number, y: number, width: number, height: number, color = c.p.main) {
  const { a, p } = c;
  polygon(a, [[x + 2, y], [x + width - 2, y], [x + width, y + 2], [x + width - 1, y + height], [x + 1, y + height], [x, y + 2]], p.outline);
  polygon(a, [[x + 2, y + 1], [x + width - 2, y + 1], [x + width - 1, y + 3], [x + width - 2, y + height - 1], [x + 2, y + height - 1], [x + 1, y + 2]], color);
  a.line(x + 2, y + 1, x + width - 3, y + 1, p.light);
  a.line(x + 2, y + 2, x + 2, y + height - 2, p.shade);
  if (width > 8) a.point(x + width - 3, y + 3, p.trim);
}

function eyes(c: EnemyInk, x: number, y: number, separation = 5) {
  if (c.back) return;
  const { a, p } = c;
  if (c.side) {
    a.rect(x + 2, y - 1, 4, 3, p.outline);
    a.rect(x + 3, y, 2, 1, p.eye);
  } else {
    for (const sign of [-1, 1]) {
      a.rect(x + sign * separation - 1, y - 1, 3, 3, p.outline);
      a.rect(x + sign * separation, y, 2, 1, p.eye);
    }
  }
}

/** Carved marks form deliberate material clusters, rather than scattered noise. */
function bark(c: EnemyInk, x: number, y: number, width: number, height: number) {
  const { a, p } = c;
  for (let n = 0; n < 4; n++) {
    const bx = x + Math.round(width * (n + 1) / 5);
    const by = y + (n % 2) * 3;
    a.line(bx, by, bx - 1, by + height - 5, p.shade);
    a.line(bx + 1, by + 1, bx, by + height - 7, p.light);
    if ((n + c.style) % 2 === 0) a.line(bx - 1, by + 5, bx - 3, by + 8, p.outline);
  }
}

function scales(c: EnemyInk, x: number, y: number, columns: number, rows: number, color = c.p.light) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const sx = x + col * 5 + row % 2 * 2;
      const sy = y + row * 4;
      c.a.line(sx, sy, sx + 2, sy + 1, color);
      c.a.point(sx + 3, sy, c.p.shade);
    }
  }
}

function claw(c: EnemyInk, x: number, y: number, direction: number, count = 3) {
  for (let i = 0; i < count; i++) {
    c.a.line(x + i * 2, y, x + i * 2 + direction * 2, y + 2, c.p.outline, 2);
    c.a.line(x + i * 2, y, x + i * 2 + direction * 2, y + 1, bone);
  }
}

function skull(c: EnemyInk, x: number, y: number, width = 6) {
  const { a, p, side, back } = c;
  oval(a, x, y + 5, side ? width - 1 : width, 6, boneShade, p.outline);
  a.rect(x - width + 2, y + 1, side ? width + 1 : width * 2 - 3, 5, bone);
  if (back) {
    a.line(x + 1, y + 1, x, y + 5, p.shade);
    a.line(x, y + 5, x + 2, y + 7, p.shade);
    a.rect(x - 2, y + 9, 4, 2, boneShade);
    return;
  }
  const faceX = x + (side ? 3 : 0);
  a.rect(faceX - 3, y + 8, side ? 6 : 7, 3, boneShade);
  eyes(c, x, y + 5, 3);
  polygon(a, [[faceX, y + 6], [faceX - 1, y + 8], [faceX + 2, y + 8]], p.outline);
  for (let n = -2; n <= 2; n += 2) a.rect(faceX + n, y + 9, 1, 2, bone);
  a.line(x - 1, y + 1, x + 1, y + 3, boneShade);
}

function humanoidLegs(c: EnemyInk, x: number, hipY: number, heavy = false, skeletal = false) {
  const { a, p, side, stride } = c;
  for (const sign of [-1, 1]) {
    const step = stride * sign;
    const hx = x + sign * (side ? 2 : 4);
    const fx = hx + (side ? step : step * 0.35);
    const fy = 53 - Math.max(0, -step) * 0.55;
    const kneeY = hipY + 7 - Math.max(0, step) * 0.6;
    limb(c, [[hx - 1, hipY], [hx - 1 + step * 0.3, kneeY], [fx - 1, fy]], skeletal ? 2 : heavy ? 5 : 4,
      skeletal ? boneShade : p.cloth, skeletal ? bone : p.clothLight);
    if (skeletal) {
      a.rect(fx - 2, fy + 1, side ? 7 : 5, 2, p.outline);
      a.rect(fx - 1, fy + 1, side ? 6 : 4, 1, bone);
      a.rect(hx - 1 + step * 0.3, kneeY, 3, 2, bone);
    } else {
      plate(c, fx - 2, fy - (heavy ? 6 : 4), heavy ? 7 : 6, heavy ? 7 : 5, heavy ? p.main : p.shade);
      a.rect(fx - 2, fy + 2, side ? 9 : 7, 2, p.outline);
      a.rect(fx - 1, fy + 2, side ? 8 : 6, 1, p.main);
    }
  }
}

function goblinHead(c: EnemyInk, x: number, y: number, helmet: boolean, hood: boolean) {
  const { a, p, side, back, style, tier } = c;
  // Cheekbones, angular nose and long swept ears keep the head adult and hostile.
  polygon(a, [[x - 5, y + 3], [x - 12, y + 1], [x - 8, y + 7], [x - 3, y + 8]], p.outline);
  polygon(a, [[x - 5, y + 4], [x - 10, y + 3], [x - 7, y + 6], [x - 3, y + 7]], p.skinShade);
  if (!side) {
    polygon(a, [[x + 5, y + 3], [x + 12, y + 1], [x + 8, y + 7], [x + 3, y + 8]], p.outline);
    a.line(x + 6, y + 4, x + 9, y + 3, p.skin, 2);
  }
  oval(a, x, y + 5, side ? 5 : 6, 7, hood ? p.cloth : p.skinShade, p.outline);
  if (hood) {
    polygon(a, [[x - 6, y + 2], [x - 4, y - 2], [x + 3, y - 3], [x + 6, y + 2]], p.cloth);
    a.line(x - 5, y + 1, x - 2, y - 1, p.clothLight, 2);
  }
  if (!back) {
    const fx = x + (side ? 3 : 0);
    a.rect(fx - 3, y + 3, side ? 6 : 7, 5, p.skin);
    polygon(a, [[fx - 2, y + 7], [fx + 4, y + 6], [fx + 2, y + 11], [fx - 2, y + 10]], p.skinShade);
    eyes(c, x, y + 5, 3);
    a.line(fx - 3, y + 3, fx - 1, y + 4, p.skinShade, 2);
    a.rect(fx + (side ? 3 : 0), y + 5, 2, 4, p.skin);
    a.line(fx - 2, y + 9, fx + 3, y + 9, mouth);
    a.rect(fx - 2, y + 8, 1, 2, tooth);
    if (!side) a.rect(fx + 3, y + 8, 1, 2, tooth);
    if (style === 2) a.line(fx - 2, y + 2, fx, y + 7, flesh);
  } else {
    a.line(x - 3, y + 3, x - 3, y + 7, hood ? p.clothLight : p.skin, 2);
    a.line(x + 1, y + 1, x + 2, y + 6, hood ? p.shade : p.skinShade, 2);
  }
  if (helmet) {
    plate(c, x - 6, y - 1, side ? 11 : 13, 5);
    a.rect(x - 6, y + 3, 2, 5, p.main);
    if (tier > 2 || style === 3) spike(c, [x, y - 1], [x + (style - 2), y - 5], 2, p.trim);
    if (tier > 3) for (const sign of [-1, 1]) spike(c, [x + sign * 5, y + 1], [x + sign * 9, y - 4], 2, bone);
  } else if (!hood && style % 2 === 0) {
    for (let n = 0; n < 3; n++) spike(c, [x - 3 + n * 3, y + 1], [x - 2 + n * 3, y - 3 - n % 2], 2, p.clothLight);
  }
}

function bow(c: EnemyInk, x: number, y: number) {
  const { a, p, reach, variant } = c;
  const height = 12 + variant % 3;
  const bend = 5 + (variant % 2);
  limb(c, [[x - 2, y - height], [x + bend, y - 6], [x + bend + 1, y + 5], [x - 1, y + height]], 1, wood, woodLight);
  a.line(x - 2, y - height, x - reach * 1.2, y, boneShade);
  a.line(x - reach * 1.2, y, x - 1, y + height, boneShade);
  a.line(x - 8 - reach, y, x + 8, y, woodLight);
  polygon(a, [[x + 11, y], [x + 6, y - 2], [x + 6, y + 2]], p.light);
  a.line(x - 8 - reach, y - 2, x - 5 - reach, y, p.clothLight);
  if (c.tier > 2) {
    a.rect(x - 2, y - height, 2, 3, p.trim);
    a.rect(x - 1, y + height - 2, 2, 3, p.trim);
  }
}

function axe(c: EnemyInk, x: number, y: number, great: boolean) {
  const { a, p, reach, style } = c;
  const tx = x + 2 + reach * 1.1, ty = y - 11 + reach * 1.3;
  limb(c, [[x - 2, y + 8], [tx, ty - 2]], 1, wood, woodLight);
  polygon(a, [[tx - 1, ty - 2], [tx + 6, ty - 5], [tx + 8, ty - 1], [tx + 7, ty + 5], [tx, ty + 4]], p.outline);
  polygon(a, [[tx, ty - 1], [tx + 5, ty - 3], [tx + 6, ty], [tx + 5, ty + 3], [tx, ty + 3]], p.main);
  a.line(tx + 6, ty - 2, tx + 6, ty + 2, p.light);
  if (great || style === 1) {
    polygon(a, [[tx, ty - 2], [tx - 5, ty - 4], [tx - 7, ty + 2], [tx - 3, ty + 5], [tx, ty + 3]], p.outline);
    a.line(tx - 5, ty - 2, tx - 5, ty + 2, p.light, 2);
  }
  a.rect(tx - 1, ty, 3, 2, p.trim);
}

function staff(c: EnemyInk, x: number, y: number, lich = false) {
  const { a, p, reach, tier, style } = c;
  const top = Math.max(8, y - 20 - reach);
  limb(c, [[x, 53], [x + 1, top + 5]], 2, wood, woodLight);
  if (lich) {
    oval(a, x + 2, top + 2, 5, 6, p.cloth, p.outline);
    a.line(x - 2, top + 2, x + 2, top - 2, p.trim, 2);
    a.line(x + 6, top + 2, x + 3, top + 7, p.trim, 2);
    a.rect(x + 1, top + 1, 3, 4, p.eye);
    a.point(x + 2, top + 1, tooth);
  } else {
    skull({ ...c, side: false, back: false }, x + 2, top, 4);
    for (const sign of [-1, 1]) {
      a.line(x + 2 + sign * 3, top + 2, x + 2 + sign * 5, top - 3, boneShade, 2);
      a.point(x + 2 + sign * 5, top - 3, bone);
    }
    a.line(x - 2, top + 9, x - 4, top + 16 + style % 3, p.clothLight, 2);
  }
  if (tier > 2) for (let n = 0; n < tier - 1; n++) a.rect(x, top + 13 + n * 4, 3, 1, p.trim);
  if (c.pose.motion === 'cast' && reach > 0) {
    for (const sign of [-1, 1]) {
      a.rect(x + 2 + sign * 7, top + 4, 2, 2, p.eye);
      a.point(x + 2 + sign * 9, top + 1, p.light);
    }
  }
}

function shield(c: EnemyInk, x: number, y: number) {
  const { a, p, style, tier } = c;
  const width = c.side ? 8 : 11;
  polygon(a, [[x - width, y - 8], [x + width - 1, y - 8], [x + width, y + 4], [x + 1, y + 12], [x - width, y + 5]], p.outline);
  polygon(a, [[x - width + 2, y - 6], [x + width - 3, y - 6], [x + width - 2, y + 3], [x + 1, y + 9], [x - width + 2, y + 4]], p.main);
  a.line(x - width + 2, y - 6, x + width - 3, y - 6, p.light, 2);
  a.line(x - width + 2, y - 5, x - width + 2, y + 3, p.light);
  a.line(x, y - 5, x, y + 7, p.cloth, 3);
  if (style % 2 === 0) a.line(x - width + 3, y - 1, x + width - 3, y - 1, p.cloth, 3);
  oval(a, x + 1, y, 3, 3, p.trim, p.outline);
  a.point(x, y - 1, tooth);
  if (tier > 2) for (const sign of [-1, 1]) spike(c, [x + sign * (width - 2), y - 7], [x + sign * width, y - 12], 2, bone);
  a.line(x + width - 4, y + 3, x + width - 6, y + 5, p.shade);
}

function humanoid(c: EnemyInk) {
  const { a, p, appearance, side, back, pose, tier, style } = c;
  const form = appearance.form;
  const heavy = form === 'bulwark';
  const caster = form === 'shaman';
  const crouch = form === 'stalker' ? 4 : 0;
  const x = c.x, y = 24 + c.bob + crouch;
  const half = (side ? 6 : heavy ? 11 : 8) + c.breadth;
  const shoulder = x + half;
  const handX = Math.min(49, shoulder + 3 + c.reach * (form === 'archer' ? 0.5 : 1));
  const handY = y + 10 - c.reach * 1.5 + Math.max(0, c.stride * 0.5);
  // Capes have a shoulder yoke, woven folds and separate torn tails.
  if (caster || form === 'stalker' || tier >= 3) {
    polygon(a, [[x - half, y], [x + half, y + 2], [x + half + 2, 49], [x + 4, 46], [x + c.pose.sway, 51], [x - 5, 47], [x - half - 2, 50]], p.outline);
    polygon(a, [[x - half + 2, y + 1], [x + half - 2, y + 2], [x + half, 47], [x + 3, 44], [x, 48], [x - 5, 44], [x - half, 47]], p.cloth);
    for (let n = -1; n <= 1; n++) a.line(x + n * 5, y + 7, x + n * 6 + pose.sway, 45, p.clothLight);
  }
  if (form === 'archer') {
    limb(c, [[x - 6, y + 12], [x - 8, y - 7]], 4, wood);
    for (let n = 0; n < 3; n++) {
      a.line(x - 10 + n * 3, y + 1, x - 12 + n * 3, y - 11, boneShade);
      a.line(x - 13 + n * 3, y - 10, x - 11 + n * 3, y - 7, p.clothLight, 2);
    }
  }
  humanoidLegs(c, x, y + 15, heavy);
  const farY = y + 10 + c.stride * 0.7 - (caster ? c.reach * 2 : 0);
  limb(c, [[x - half, y + 2], [x - half - 4, y + 7], [x - half - 3, farY]], heavy ? 5 : 4, p.cloth, p.clothLight);
  a.rect(x - half - 3, farY, 5, 4, p.skinShade);
  // Broad ribcage tapers at the belt; inset plates never replace the anatomy.
  polygon(a, [[x - half, y], [x + half, y], [x + half - 2, y + 12], [x + 6, y + 17], [x - 6, y + 17], [x - half + 1, y + 9]], p.outline);
  polygon(a, [[x - half + 2, y + 1], [x + half - 2, y + 1], [x + half - 3, y + 11], [x + 5, y + 15], [x - 5, y + 15], [x - half + 2, y + 9]], caster ? p.cloth : p.main);
  a.line(x - half + 2, y + 2, x - half + 3, y + 10, caster ? p.clothLight : p.light, 2);
  if (caster) {
    polygon(a, [[x - 6, y + 9], [x + 6, y + 9], [x + 10, 53], [x + 2, 51], [x - 1, 54], [x - 10, 52]], p.cloth);
    a.line(x - 4, y + 7, x - 6, 50, p.clothLight, 2);
    a.line(x + 4, y + 5, x + 5, 50, p.trim);
    for (let n = 0; n < 3; n++) a.rect(x - 2, y + 5 + n * 5, 3, 2, bone);
  } else {
    if (heavy) {
      plate(c, x - half - 3, y - 2, side ? 9 : 11, 8);
      plate(c, x + half - 7, y - 2, 10, 8);
      plate(c, x - half + 3, y + 5, half * 2 - 5, 7);
      for (const sign of [-1, 1]) if (tier >= 2) spike(c, [x + sign * (half - 1), y], [x + sign * (half + 3), y - 6], 2, bone);
    } else {
      a.line(x - half + 2, y + 1, x + half - 3, y + 12, p.cloth, 3);
      a.line(x - half + 3, y + 1, x + half - 2, y + 12, p.trim);
      if (style === 1 || tier >= 3) plate(c, x - half - 2, y - 1, 8, 6);
      if (style === 3) scales(c, x - half + 3, y + 5, side ? 1 : 2, 2);
    }
    a.rect(x - half + 2, y + 13, half * 2 - 3, 3, p.outline);
    a.rect(x - half + 2, y + 14, half * 2 - 3, 1, woodLight);
    if (!back) a.rect(x, y + 13, 3, 3, p.trim);
  }
  limb(c, [[shoulder - 2, y + 3], [shoulder + 2, y + 8], [handX, handY]], heavy ? 5 : 4, caster ? p.clothLight : p.main, heavy ? p.light : p.skinShade);
  a.rect(handX, handY, 4, 4, p.skin);
  if (form === 'shaman') {
    goblinHead(c, x, y - 13, false, true);
    if (!back) skull(c, x + (side ? 1 : 0), y - 11, 5);
    for (const sign of [-1, 1]) {
      limb(c, [[x + sign * 5, y - 10], [x + sign * 10, y - 15], [x + sign * 11, y - 20]], 1, boneShade, bone);
      a.line(x + sign * 8, y - 13, x + sign * 12, y - 16, bone);
    }
    staff(c, Math.max(10, x - half - 7), y + 8);
    if (c.reach > 0) oval(a, handX + 1, handY - 3, 3, 4, p.eye, p.cloth);
  } else {
    goblinHead(c, x + (form === 'stalker' ? 3 : 0), y - 12, heavy || (form === 'raider' && style % 2 === 1), form === 'archer' || form === 'stalker');
    if (form === 'archer') bow(c, Math.min(49, handX + 1), handY);
    else if (heavy) {
      axe(c, Math.min(48, handX), handY, true);
      shield(c, Math.max(14, x - half + 1 + (pose.motion === 'shieldBlock' || pose.motion === 'block' ? c.reach * 2 : 0)), y + 12);
    } else if (form === 'stalker') {
      for (const sign of [-1, 1]) {
        const hx = sign < 0 ? x - half - 1 : handX;
        const hy = sign < 0 ? farY + 2 : handY + 1;
        polygon(a, [[hx, hy], [hx + sign * 9, hy - 8 + c.reach], [hx + sign * 4, hy + 1]], p.outline);
        a.line(hx + sign, hy - 1, hx + sign * 7, hy - 6 + c.reach, p.light, 2);
        a.line(hx - 1, hy + 2, hx + 3, hy + 2, p.trim);
      }
    } else axe(c, Math.min(47, handX), handY, tier >= 4);
  }
}

function undead(c: EnemyInk) {
  const { a, p, appearance, side, back, tier, style } = c;
  const x = c.x, y = 24 + c.bob;
  const lich = appearance.form === 'lich';
  const revenant = appearance.form === 'revenant';
  const half = side ? 5 : revenant ? 9 : 7;
  if (lich) {
    // A lich is a hovering triangular vestment with high, split collar and sleeves.
    polygon(a, [[x - 8, y - 4], [x + 8, y - 4], [x + 14, 50], [x + 8, 48], [x + 6, 54], [x, 49], [x - 5, 53], [x - 13, 51]], p.outline);
    polygon(a, [[x - 6, y - 2], [x + 6, y - 2], [x + 11, 49], [x + 6, 47], [x + 4, 51], [x, 47], [x - 5, 50], [x - 10, 49]], p.cloth);
    for (let n = -1; n <= 1; n++) a.line(x + n * 4, y + 7, x + n * 7 + c.pose.sway, 47 + Math.abs(n) * 2, p.clothLight, 2);
    a.line(x - 4, y + 5, x - 5, 46, p.trim);
    a.line(x + 4, y + 5, x + 6, 46, p.trim);
    polygon(a, [[x - 4, y + 3], [x - 11, y - 10], [x - 12, y + 2]], p.main);
    polygon(a, [[x + 4, y + 3], [x + 11, y - 10], [x + 12, y + 2]], p.main);
  } else {
    if (revenant || tier > 2) {
      polygon(a, [[x - half, y - 1], [x + half, y], [x + 11, 49], [x + 6, 46], [x + 2, 51], [x - 4, 46], [x - 10, 50]], p.cloth);
      a.line(x - 7, y + 4, x - 7 + c.pose.sway, 46, p.clothLight, 2);
    }
    humanoidLegs(c, x, y + 15, revenant, !revenant);
  }
  const leftHand: Point = [x - half - 6, y + 14 + c.stride * 0.7 - (lich ? c.reach * 2 : 0)];
  const rightHand: Point = [x + half + 4 + c.reach, y + 12 - c.reach * 1.8];
  limb(c, [[x - half, y + 1], [x - half - 4, y + 7], leftHand], revenant ? 4 : 2, revenant ? p.skinShade : boneShade, revenant ? p.skin : bone);
  oval(a, x, y + 7, half + 1, 10, revenant ? p.skinShade : p.outline, p.outline);
  a.line(x, y, x, y + 15, boneShade, 3);
  if (!back) {
    for (let n = 0; n < 4; n++) {
      const ry = y + 3 + n * 3;
      const ribWidth = half - Math.max(0, n - 1);
      a.line(x - ribWidth, ry - 1, x - 2, ry + 1, boneShade, 2);
      a.line(x + 2, ry + 1, x + ribWidth, ry - 1, boneShade, 2);
      a.line(x - ribWidth + 1, ry - 1, x - 2, ry, bone);
      a.line(x + 2, ry, x + ribWidth - 1, ry - 1, bone);
    }
    if (revenant) {
      a.rect(x + 2, y + 5, 4, 5, flesh);
      a.line(x - half + 1, y + 2, x - half + 3, y + 10, p.skin, 2);
    }
  } else for (let n = 0; n < 5; n++) a.rect(x - 1, y + n * 3, 4, 2, bone);
  if (!lich) {
    a.line(x - 5, y + 15, x - 2, y + 18, boneShade, 3);
    a.line(x + 5, y + 15, x + 2, y + 18, boneShade, 3);
    if (revenant || style % 2 === 1) {
      plate(c, x - half - 3, y - 2, 9, 6);
      a.rect(x - half, y + 14, half * 2, 3, p.cloth);
      a.rect(x, y + 14, 3, 3, p.trim);
      if (tier > 2) plate(c, x + 1, y, 7, 8);
    }
  }
  limb(c, [[x + half - 1, y + 1], [x + half + 2, y + 7], rightHand], lich ? 3 : revenant ? 4 : 2, lich ? p.cloth : revenant ? p.skinShade : boneShade, lich ? p.clothLight : bone);
  for (let n = 0; n < 3; n++) a.line(rightHand[0] + n, rightHand[1], rightHand[0] + n + 1, rightHand[1] + 3, bone);
  skull(c, x, y - 13, revenant ? 6 : 5);
  if (lich || tier > 3) {
    a.rect(x - 6, y - 14, 13, 3, p.main);
    a.line(x - 5, y - 14, x + 5, y - 14, p.trim);
    for (let n = -1; n <= 1; n++) spike(c, [x + n * 4, y - 13], [x + n * 5, y - 20 + Math.abs(n) * 2], 2, p.trim);
    if (tier >= 4) for (const sign of [-1, 1]) spike(c, [x + sign * 6, y - 11], [x + sign * 10, y - 17], 2, bone);
  } else if (revenant || style === 2) {
    plate(c, x - 6, y - 13, 12, 4);
    a.line(x - 5, y - 10, x - 4, y - 5, p.main, 2);
  }
  if (lich) {
    staff(c, x - 16, y + 11, true);
    if (c.reach > 0) {
      oval(a, rightHand[0] + 1, rightHand[1] - 4, 4, 5, p.eye, p.shade);
      a.rect(rightHand[0], rightHand[1] - 6, 2, 3, tooth);
    }
  } else if (revenant) {
    const hx = Math.min(47, rightHand[0]), hy = rightHand[1];
    polygon(a, [[hx, hy], [hx + 4 + c.reach, hy - 18], [hx + 7 + c.reach, hy - 16], [hx + 4, hy + 1]], p.outline);
    a.line(hx + 2, hy - 2, hx + 5 + c.reach, hy - 15, p.light, 2);
    a.line(hx - 2, hy + 1, hx + 6, hy + 2, p.trim, 2);
  } else axe(c, Math.min(46, rightHand[0]), rightHand[1], false);
}

function foliage(c: EnemyInk, x: number, y: number, radius: number) {
  const { a, p, appearance, style } = c;
  if (appearance.season === 'winter') {
    a.line(x - radius, y + 2, x + radius, y, p.shade, 2);
    a.line(x - radius, y + 1, x + radius - 1, y - 1, p.light, 2);
    for (let n = -1; n <= 1; n++) spike(c, [x + n * 3, y + 1], [x + n * 3, y + 5 + (n + style) % 2], 1, p.trim);
    return;
  }
  for (let n = -1; n <= 1; n++) {
    const lx = x + n * (radius - 1), ly = y + Math.abs(n) * 2;
    polygon(a, [[lx - 4, ly], [lx, ly - 4], [lx + 5, ly - 1], [lx + 3, ly + 3], [lx - 2, ly + 3]], p.shade);
    a.line(lx - 2, ly, lx + 2, ly - 2, p.main, 2);
    a.line(lx, ly, lx + 2, ly + 1, p.light);
    if (appearance.season === 'spring') {
      a.rect(lx + 1, ly - 1, 3, 2, p.clothLight);
      a.point(lx + 2, ly - 1, p.trim);
    } else if (appearance.season === 'summer' && n === 0) a.rect(lx + 1, ly + 2, 3, 3, p.clothLight);
  }
}

function treant(c: EnemyInk) {
  const { a, p, side, back, tier, style } = c;
  const x = c.x, y = 24 + c.bob;
  const half = side ? 8 : 11 + c.breadth;
  for (const sign of [-1, 1]) {
    const footX = x + sign * 7 + c.stride * sign * 0.7;
    limb(c, [[x + sign * 5, 42], [footX, 48], [footX + sign * 4, 53]], 5, p.main, p.light);
    for (let n = 0; n < 3; n++) a.line(footX + sign * 3, 52, footX + sign * (5 + n * 3), 55 - n % 2, p.shade, 2);
    const elbowX = x + sign * (half + 6), handY = y + 15 - (sign > 0 ? c.reach * 2 : -c.stride);
    limb(c, [[x + sign * half, y + 1], [elbowX, y + 8], [elbowX + sign * 2, handY]], 5, p.main, p.light);
    for (let n = 0; n < 3; n++) limb(c, [[elbowX + sign * 2, handY], [elbowX + sign * (4 + n), handY + 4 + n * 2]], 1, p.shade, p.light);
    limb(c, [[x + sign * 5, y - 2], [x + sign * 11, y - 11], [x + sign * 14, y - 18]], 3, p.main, p.light);
    a.line(x + sign * 11, y - 11, x + sign * 18, y - 13, p.shade, 2);
    foliage(c, x + sign * 12, y - 13, 4);
    if (tier > 2) foliage(c, x + sign * 18, y - 8, 3);
  }
  polygon(a, [[x - half, y - 2], [x + half, y - 2], [x + half - 2, 39], [x + half + 2, 47], [x + 5, 44], [x, 47], [x - 7, 44], [x - half - 1, 47]], p.outline);
  polygon(a, [[x - half + 2, y - 1], [x + half - 2, y - 1], [x + half - 4, 40], [x + half, 44], [x + 4, 41], [x, 45], [x - 6, 41], [x - half + 1, 44]], p.main);
  bark(c, x - half + 1, y, half * 2 - 2, 20);
  oval(a, x, y - 3, side ? 7 : 9, 10, p.main, p.outline);
  bark(c, x - 7, y - 10, 14, 15);
  foliage(c, x + style - 2, y - 12, 5);
  if (!back) {
    eyes(c, x, y - 3, 4);
    polygon(a, [[x - 4, y + 2], [x + 5, y + 1], [x + 3, y + 7], [x - 3, y + 6]], p.outline);
    a.line(x - 2, y + 2, x - 1, y + 4, p.light);
    a.line(x + 2, y + 5, x + 3, y + 3, woodLight);
  }
  if (style % 2 === 0 || tier > 3) {
    oval(a, x - 3, y + 13, 3, 4, p.shade, p.outline);
    a.line(x - 4, y + 11, x - 2, y + 10, p.light);
  }
}

function thorn(c: EnemyInk) {
  const { a, p, tier, side, back } = c;
  const x = c.x, y = 28 + c.bob;
  for (const sign of [-1, 1]) {
    const endX = x + sign * 21 + (sign > 0 ? c.reach : 0);
    limb(c, [[x + sign * 5, y], [x + sign * 16, y - 6], [endX, y + 3], [endX - sign * 2, y + 12]], 3, p.main, p.light);
    for (let n = 0; n < 3; n++) spike(c, [x + sign * (12 + n * 4), y - 3 + n * 2], [x + sign * (14 + n * 4), y - 9 + n * 2], 2, p.trim);
    limb(c, [[x + sign * 4, 41], [x + sign * 7, 49 - c.stride * sign * 0.4], [x + sign * 14, 54]], 4, p.main, p.light);
    a.line(x + sign * 12, 53, x + sign * 19, 54, p.shade, 2);
  }
  oval(a, x, y + 7, side ? 7 : 10, 13, p.main, p.outline);
  for (let n = -1; n <= 1; n++) limb(c, [[x + n * 5, y - 4], [x + n * 4 + 2, y + 5], [x + n * 5 - 1, y + 16]], 2, p.shade, p.light);
  for (let n = 0; n < 3 + Math.min(2, tier - 1); n++) {
    const sign = n % 2 ? 1 : -1;
    spike(c, [x + sign * 7, y - 1 + n * 4], [x + sign * (13 + n % 3), y - 6 + n * 4], 3, p.trim);
  }
  oval(a, x + (side ? 3 : 0), y - 8, 7, 8, p.shade, p.outline);
  for (const sign of [-1, 1]) spike(c, [x + sign * 4, y - 12], [x + sign * 8, y - 22], 3, p.main);
  a.line(x - 3, y - 14, x - 2, y - 5, p.light, 2);
  if (!back) {
    eyes(c, x, y - 8, 3);
    a.line(x - 3, y - 3, x + 3, y - 2, p.outline, 2);
    for (let n = -2; n <= 2; n += 2) a.line(x + n, y - 3, x + n + 1, y, tooth);
  }
  foliage(c, x - 4, y - 17, 3);
}

function mushroom(c: EnemyInk) {
  const { a, p, side, back, variant, tier } = c;
  const x = c.x, y = 23 + c.bob;
  const cap = 17 + variant % 3;
  for (const sign of [-1, 1]) {
    limb(c, [[x + sign * 5, 43], [x + sign * 9 + c.stride * sign, 51], [x + sign * 15, 54]], 4, p.skinShade, p.skin);
    limb(c, [[x + sign * 6, 35 + c.bob], [x + sign * 12, 40 - c.reach], [x + sign * 15, 45 - c.reach * 2]], 3, p.skinShade, p.skin);
  }
  polygon(a, [[x - 7, y + 2], [x + 7, y + 2], [x + 5, 36], [x + 9, 49], [x + 4, 53], [x - 5, 52], [x - 10, 48], [x - 5, 35]], p.outline);
  polygon(a, [[x - 5, y + 3], [x + 5, y + 3], [x + 3, 36], [x + 7, 48], [x + 3, 50], [x - 4, 50], [x - 8, 47], [x - 3, 35]], p.skinShade);
  a.line(x - 2, y + 5, x - 3, 47, p.skin, 3);
  a.line(x + 3, y + 9, x + 4, 46, p.shade);
  // Lamellae are radial strips under a heavy, irregular shelf cap.
  oval(a, x, y + 2, cap, 7, p.skinShade, p.outline);
  for (let n = -4; n <= 4; n++) a.line(x + n * 3.5, y + 1, x + n * 1.2, y + 7, p.skin);
  polygon(a, [[x - cap - 1, y], [x - cap + 3, y - 7], [x - 8, y - 12], [x + 3, y - 14 - variant % 3], [x + 12, y - 10], [x + cap, y - 3], [x + cap + 1, y + 1], [x + 7, y + 3], [x - 7, y + 2]], p.outline);
  polygon(a, [[x - cap + 1, y - 1], [x - cap + 5, y - 6], [x - 7, y - 10], [x + 3, y - 12 - variant % 3], [x + 11, y - 8], [x + cap - 2, y - 3], [x + cap - 1, y], [x + 7, y + 1], [x - 7, y]], p.main);
  a.line(x - 11, y - 7, x - 4, y - 10, p.light, 2);
  for (let n = 0; n < 5; n++) {
    const px = x - 11 + n * 5, py = y - 3 - (n % 3) * 3;
    a.rect(px, py, n % 2 + 3, 2, p.trim);
    a.rect(px + 1, py - 1, 2, 2, p.light);
  }
  if (!back) {
    eyes(c, x, y + 12, side ? 2 : 3);
    a.line(x - 2, y + 17, x + 3, y + 17, mouth, 2);
  }
  if (tier > 2 || variant % 4 === 0) {
    a.rect(x + 9, 43, 3, 9, p.skinShade);
    oval(a, x + 10, 42, 7, 3, p.clothLight, p.outline);
    a.line(x + 6, 41, x + 10, 40, p.light, 2);
  }
}

function flower(c: EnemyInk) {
  const { a, p, back, tier, variant } = c;
  const x = c.x, y = 24 + c.bob;
  for (const sign of [-1, 1]) {
    limb(c, [[x, 44], [x + sign * 8, 50], [x + sign * 21, 54]], 3, p.main, p.light);
    polygon(a, [[x + sign * 3, 41], [x + sign * 16, 33], [x + sign * 19, 41], [x + sign * 9, 45]], p.outline);
    polygon(a, [[x + sign * 4, 41], [x + sign * 15, 35], [x + sign * 16, 40], [x + sign * 9, 43]], p.main);
    a.line(x + sign * 5, 42, x + sign * 15, 37, p.light);
  }
  limb(c, [[x - 1, 49], [x + 2 + c.pose.sway, 39], [x - 2, y + 8]], 6, p.main, p.light);
  const petals = 7 + variant % 3;
  for (let n = 0; n < petals; n++) {
    const angle = n / petals * Math.PI * 2 - Math.PI / 2;
    const reach = 16 + (n % 2) * 3 + Math.min(1.5, c.reach * 0.5);
    const px = x + Math.cos(angle) * reach, py = y + Math.sin(angle) * reach;
    const crossX = Math.cos(angle + Math.PI / 2) * 6, crossY = Math.sin(angle + Math.PI / 2) * 6;
    polygon(a, [[x, y], [px + crossX, py + crossY], [px + Math.cos(angle) * 2, py + Math.sin(angle) * 2], [px - crossX, py - crossY]], p.outline);
    polygon(a, [[x + Math.cos(angle) * 3, y + Math.sin(angle) * 3], [px + crossX * 0.75, py + crossY * 0.75], [px, py], [px - crossX * 0.75, py - crossY * 0.75]], n % 2 ? p.cloth : p.clothLight);
    a.line(x + Math.cos(angle) * 9, y + Math.sin(angle) * 9, px, py, p.trim);
  }
  oval(a, x, y, 11, 10, p.shade, p.outline);
  if (back) {
    scales(c, x - 7, y - 5, 3, 3);
    oval(a, x, y + 4, 4, 6, p.main, p.shade);
  } else {
    oval(a, x, y + 1, c.side ? 8 : 9, 8 + Math.round(c.reach * 0.4), mouth, p.cloth);
    for (let n = -3; n <= 3; n++) {
      a.line(x + n * 2, y - 5 + Math.abs(n), x + n * 1.6, y - 1, tooth);
      a.line(x + n * 2, y + 7 - Math.abs(n), x + n * 1.6, y + 3, boneShade);
    }
    a.line(x - 3, y + 4, x + 2, y + 3, flesh, 2);
  }
  if (tier >= 3) for (const sign of [-1, 1]) spike(c, [x + sign * 9, 45], [x + sign * 15, 47], 2, p.trim);
}

function quadruped(c: EnemyInk) {
  const { a, p, appearance, side, back, tier, variant } = c;
  const form = appearance.form;
  const boar = form === 'boar', wolf = form === 'wolf', rat = form === 'rat';
  const x = c.x, y = (boar ? 37 : wolf ? 39 : 43) + c.bob;
  const long = side ? (boar ? 16 : wolf ? 17 : 13) : boar ? 13 : wolf ? 10 : 9;
  const tall = boar ? 11 : wolf ? 8 : 7;
  const headX = x + (side ? long - 1 : 0), headY = y + (back ? -8 : 2) - c.reach * 0.45;
  const tailRootX = x - (side ? long - 2 : 0);
  const tailSign = side ? -1 : variant % 2 ? -1 : 1;
  const tailX = Math.max(wolf ? 8 : 4, Math.min(55, tailRootX + tailSign * (rat ? 17 : 15)));
  const tailY = y + (rat ? 4 : -8);
  if (rat) {
    limb(c, [[tailRootX, y + 3], [tailX + (side ? 5 : -3), y + 9], [tailX, tailY], [tailX + 3, tailY - 7 - c.pose.sway]], 1, p.skinShade, p.skin);
  } else if (boar) {
    limb(c, [[tailRootX, y], [tailX + (side ? 6 : -6), y - 6], [tailX + (side ? 5 : -5), y - 2]], 1, p.shade, p.light);
  } else {
    limb(c, [[tailRootX, y], [tailX + tailSign * -3, tailY + 5], [tailX, tailY - c.pose.sway]], 4, p.shade, p.light);
    polygon(a, [[tailX - 2, tailY - 3], [tailX + 2, tailY + 2], [tailX + tailSign * 4, tailY - 5]], p.main);
  }
  const legs: readonly Point[] = side ? [[x - 11, y + 4], [x + 8, y + 4], [x - 8, y + 6], [x + 11, y + 6]] : [[x - long + 3, y], [x + long - 4, y], [x - long + 3, y + 5], [x + long - 3, y + 5]];
  legs.forEach(([lx, ly], n) => {
    const stride = c.stride * (n % 2 ? 1 : -1) * (n < 2 ? -0.8 : 0.8);
    const foot = Math.min(54, 52 + (n >= 2 ? 1 : -1) - Math.max(0, stride));
    limb(c, [[lx, ly], [lx - (wolf ? 2 : 0) + stride * 0.4, 47], [lx + stride, foot]], boar ? 4 : rat ? 2 : 3, n < 2 ? p.shade : p.main, n < 2 ? undefined : p.light);
    a.rect(lx + stride - 1, foot + 1, boar ? 6 : 5, 2, p.outline);
    if (!boar) claw(c, lx + stride, foot, side ? 1 : 0, 2);
  });
  oval(a, x, y, long, tall, p.main, p.outline);
  oval(a, x - (side ? 5 : 0), y - 2, Math.max(3, long - 5), Math.max(3, tall - 3), p.light, p.main);
  a.ellipse(x + (side ? 4 : 0), y + 4, Math.max(3, long - 4), 4, p.shade);
  // The mane runs in stepped locks, separating wolf fur and boar bristle from rat hide.
  if (!rat) {
    for (let n = 0; n < 5; n++) {
      const mx = x - long + 6 + n * (long * 2 - 12) / 4;
      spike(c, [mx, y - tall + 4], [mx - (side ? 3 : 0), y - tall - 3 - n % 2 * 2], 3, boar ? p.shade : p.light);
    }
    for (let n = 0; n < 4; n++) a.line(x - long + 4 + n * 5, y, x - long + 6 + n * 5, y + 3, p.shade, 2);
  } else {
    a.line(x - 7, y - 4, x - 2, y - 5, p.light, 2);
    a.line(x - 8, y + 1, x - 5, y + 3, p.shade, 2);
  }
  if (back) {
    oval(a, headX, headY, boar ? 8 : 6, boar ? 8 : 7, p.main, p.outline);
    a.line(headX - 3, headY - 4, headX + 2, headY - 4, p.light, 2);
  } else {
    const headWidth = boar ? 9 : wolf ? 7 : 6;
    oval(a, headX, headY, side ? headWidth - 1 : headWidth, boar ? 9 : 7, p.main, p.outline);
    if (rat) {
      for (const sign of [-1, 1]) {
        if (side && sign === 1) continue;
        oval(a, headX + sign * 5, headY - 7, 4, 5, p.skinShade, p.outline);
        a.rect(headX + sign * 5 - 1, headY - 9, 2, 4, p.skin);
      }
    } else {
      for (const sign of [-1, 1]) spike(c, [headX + sign * 5, headY - 4], [headX + sign * (wolf ? 7 : 9), headY - (wolf ? 13 : 9)], boar ? 4 : 3, p.shade);
    }
    const muzzleX = Math.min(57, headX + (side ? (wolf ? 6 : 4) : 0));
    const muzzleY = Math.min(49, headY + (side ? 2 : 5));
    oval(a, muzzleX, muzzleY, boar ? 6 : wolf ? 5 : 4, boar ? 5 : 3, boar || rat ? p.skinShade : p.light, p.outline);
    eyes(c, headX + (side ? 0 : -1), headY - 1, 4);
    a.rect(muzzleX + (side ? 2 : -2), muzzleY, side ? 3 : 5, 2, p.outline);
    if (boar) {
      for (const sign of side ? [1] : [-1, 1]) {
        limb(c, [[muzzleX + sign * 3, muzzleY + 3], [muzzleX + sign * 6, muzzleY + 1], [muzzleX + sign * 6, muzzleY - 5]], 1, boneShade, tooth);
      }
    } else if (wolf) {
      a.line(muzzleX - 3, muzzleY + 3, muzzleX + 3, muzzleY + 2, mouth, 2);
      a.line(muzzleX - 2, muzzleY + 2, muzzleX - 1, muzzleY + 4, tooth);
      a.line(muzzleX + 2, muzzleY + 2, muzzleX + 1, muzzleY + 4, tooth);
    } else {
      a.rect(muzzleX - 1, muzzleY + 2, 2, 3, tooth);
      for (const sign of [-1, 1]) a.line(muzzleX + sign * 3, muzzleY + 1, muzzleX + sign * 9, muzzleY - 1, boneShade);
    }
  }
  if (tier > 2 || variant % 5 === 4) {
    plate(c, x - long + 6, y - tall + 3, side ? 11 : 13, 7);
    for (let n = 0; n < Math.min(3, tier - 1); n++) spike(c, [x - 4 + n * 4, y - tall + 3], [x - 5 + n * 4, y - tall - 4], 2, bone);
  } else if (variant % 3 === 1) {
    a.line(x - 3, y - tall + 2, x + 2, y + 4, p.cloth, 3);
    a.rect(x - 1, y - 2, 3, 2, p.trim);
  }
}

function spider(c: EnemyInk) {
  const { a, p, side, back, variant, tier } = c;
  const x = c.x, y = 36 + c.bob;
  for (const sign of [-1, 1]) {
    for (let n = 0; n < 4; n++) {
      const sway = c.stride * (n % 2 ? 0.8 : -0.8);
      const rootY = y - 3 + n * 3;
      const kneeX = x + sign * (18 + n % 2 * 5), kneeY = y - 12 + n * 5 + sway;
      const footX = Math.max(3, Math.min(59, x + sign * (24 + n % 2 * 3) + sway));
      const footY = 48 + n * 2 - Math.max(0, sway);
      limb(c, [[x + sign * 5, rootY], [kneeX, kneeY], [footX, footY]], n % 2 ? 2 : 3, p.shade, p.light);
      a.rect(kneeX, kneeY, 3, 3, p.main);
      if (tier > 2) spike(c, [kneeX, kneeY], [kneeX + sign * 2, kneeY - 4], 2, p.trim);
    }
  }
  const abdomenY = y - (back ? -2 : 8);
  oval(a, x - (side ? 4 : 0), abdomenY, side ? 13 : 12 + variant % 2, 12, p.main, p.outline);
  a.ellipse(x - (side ? 6 : 2), abdomenY - 4, 8, 5, p.light);
  for (let n = -1; n <= 1; n++) {
    a.line(x + n * 5, abdomenY - 8, x + n * 3, abdomenY + 3, p.cloth, 2);
    a.line(x + n * 3, abdomenY + 3, x + n * 6, abdomenY + 7, p.shade, 2);
  }
  if (variant % 3 === 2) scales(c, x - 8, abdomenY - 4, 3, 2, p.trim);
  const hx = x + (side ? 11 : 0), hy = y + (back ? -9 : 8);
  oval(a, hx, hy, 8, 7, p.shade, p.outline);
  a.line(hx - 4, hy - 4, hx + 3, hy - 4, p.main, 2);
  if (!back) {
    for (let n = -2; n <= 2; n++) a.rect(hx + n * 3, hy - 2 + Math.abs(n), n % 2 === 0 ? 2 : 1, 2, p.eye);
    for (const sign of [-1, 1]) {
      limb(c, [[hx + sign * 4, hy + 2], [hx + sign * 6, hy + 6 - c.reach], [hx + sign * 2, hy + 9 - c.reach]], 2, p.main, p.light);
      a.line(hx + sign * 2, hy + 7 - c.reach, hx + sign, hy + 10 - c.reach, bone);
    }
  }
}

function crab(c: EnemyInk) {
  const { a, p, side, back, tier, variant } = c;
  const x = c.x, y = 37 + c.bob;
  for (const sign of [-1, 1]) {
    for (let n = 0; n < 3; n++) {
      const shift = c.stride * (n % 2 ? -1 : 1) * 0.6;
      limb(c, [[x + sign * 10, y + n * 3], [x + sign * (18 + n), y + 3 + n * 4 + shift], [x + sign * (23 - n), 53 - Math.max(0, shift)]], 2, p.main, p.light);
    }
    const cx = Math.max(11, Math.min(51, x + sign * (18 + (side && sign < 0 ? -3 : 0)))), cy = y - 10 - (sign > 0 ? c.reach : 0);
    limb(c, [[x + sign * 9, y], [x + sign * 17, y - 2], [cx, cy + 2]], 4, p.main, p.light);
    const big = sign === (variant % 2 ? -1 : 1) ? 2 : 0;
    oval(a, cx, cy, 7 + big, 6 + big, p.main, p.outline);
    const open = 2 + c.reach;
    polygon(a, [[cx - 2, cy - 1], [cx - 5, cy - 10 - big], [cx + 1, cy - 7 - big], [cx + 2, cy - 1]], p.outline);
    polygon(a, [[cx + 2, cy + 1], [cx + 8, cy - 8 - open], [cx + 8, cy - 1], [cx + 5, cy + 4]], p.outline);
    a.line(cx - 2, cy - 7 - big, cx, cy - 2, p.light, 2);
    a.line(cx + 6, cy - 5 - open * 0.3, cx + 5, cy + 1, p.light, 2);
  }
  oval(a, x, y, side ? 13 : 17, 11, p.main, p.outline);
  polygon(a, [[x - 12, y - 5], [x - 5, y - 9], [x + 5, y - 9], [x + 12, y - 5], [x + 8, y], [x - 8, y]], p.light);
  for (let n = -2; n <= 2; n++) a.line(x + n * 5, y + 2, x + n * 4, y + 7, p.shade, 2);
  a.line(x - 10, y + 8, x + 10, y + 8, p.outline);
  scales(c, x - 8, y - 5, 3, 2, p.trim);
  if (!back) for (const sign of [-1, 1]) {
    limb(c, [[x + sign * 5, y - 5], [x + sign * 7, y - 12]], 1, p.main, p.light);
    oval(a, x + sign * 7, y - 12, 2, 2, p.eye, p.outline);
  }
  if (tier > 2) for (let n = -1; n <= 1; n++) spike(c, [x + n * 8, y - 8], [x + n * 9, y - 14 - (n === 0 ? 2 : 0)], 2, bone);
}

function segmented(c: EnemyInk) {
  const { a, p, appearance, side, back, variant, tier } = c;
  const leech = appearance.form === 'leech';
  const x = c.x, y = 40 + c.bob;
  const segments = leech ? 7 : 5 + variant % 2;
  // A leech coils flat; larval segments climb toward a raised, plated head.
  for (let n = 0; n < segments; n++) {
    const phase = n / (segments - 1);
    const sx = side ? x - 18 + n * 5.5 : x + Math.sin(phase * Math.PI * 1.4) * (leech ? 12 : 7) - 5;
    const sy = side ? y + Math.sin(phase * Math.PI) * 3 : y + 6 - n * 3.5;
    const motion = Math.sin(n * 0.8 + c.pose.frame * (c.pose.motion === 'walk' ? 0.65 : 0.15)) * (c.pose.motion === 'walk' ? 1.5 : 0.6);
    const r = leech ? 5 + Math.round(phase * 3) : 7 + Math.round(phase * 2);
    oval(a, sx, sy + motion, r, leech ? 5 : 8, n % 2 ? p.main : p.skinShade, p.outline);
    a.line(sx - r + 3, sy - 3 + motion, sx + 2, sy - 4 + motion, p.light, 2);
    a.line(sx - r + 2, sy + 2 + motion, sx + r - 2, sy + 3 + motion, p.shade);
    if (!leech && n < segments - 1) for (const sign of [-1, 1]) {
      const lx = sx + sign * (r - 1);
      a.line(lx, sy + 3, lx + sign * 3, Math.min(54, sy + 7), p.outline, 2);
      a.point(lx + sign * 3, Math.min(54, sy + 7), bone);
    }
    if (tier > 2 && n % 2 === 0) spike(c, [sx, sy - 4], [sx - 2, sy - 11], 2, p.trim);
  }
  const hx = side ? x + 18 : x - 4, hy = side ? y - 3 : y - 14;
  oval(a, hx, hy, leech ? 8 : 10, leech ? 9 : 10, p.shade, p.outline);
  if (back) {
    scales(c, hx - 6, hy - 5, 2, 3);
    a.line(hx, hy - 8, hx + 1, hy + 7, p.main, 2);
  } else if (leech) {
    oval(a, hx + (side ? 2 : 0), hy + 2, 6 + Math.round(c.reach * 0.4), 7, mouth, flesh);
    for (let n = 0; n < 9; n++) {
      const angle = n / 9 * Math.PI * 2;
      a.line(hx + Math.cos(angle) * 5 + (side ? 2 : 0), hy + 2 + Math.sin(angle) * 6, hx + Math.cos(angle) * 3 + (side ? 2 : 0), hy + 2 + Math.sin(angle) * 3, tooth);
    }
    a.rect(hx, hy + 1, 2, 3, flesh);
  } else {
    plate(c, hx - 7, hy - 9, 14, 7);
    eyes(c, hx, hy - 1, 4);
    for (const sign of [-1, 1]) {
      limb(c, [[hx + sign * 5, hy + 3], [hx + sign * 9, hy + 8 - c.reach], [hx + sign * 3, hy + 10 - c.reach]], 2, p.main, bone);
      limb(c, [[hx + sign * 3, hy - 7], [hx + sign * 6, hy - 16], [hx + sign * 10, hy - 18]], 1, p.shade, p.light);
    }
  }
}

function eye(c: EnemyInk) {
  const { a, p, side, back, variant, tier } = c;
  const x = c.x, y = 29 + c.bob;
  const radius = 12 + variant % 3;
  // Rooted optic nerves and a toothed lower socket make this an anatomical horror.
  for (let n = 0; n < 6; n++) {
    const sign = n % 2 ? 1 : -1, spread = 4 + Math.floor(n / 2) * 7;
    const rootX = x + sign * spread * 0.5;
    const endX = x + sign * spread + c.pose.sway * (n % 3 + 1);
    const endY = 49 + n % 3 * 3;
    limb(c, [[rootX, y + 9], [rootX + sign * 5, y + 18 - c.reach], [endX, endY - 3], [endX - sign * 3, endY]], 2, flesh, p.skinShade);
  }
  for (const sign of [-1, 1]) {
    limb(c, [[x + sign * (radius - 2), y], [x + sign * 20, y - 6], [x + sign * 22, y - 15 - c.reach]], 2, flesh, p.skinShade);
    spike(c, [x + sign * 20, y - 11], [x + sign * 23, y - 19], 2, bone);
  }
  oval(a, x, y, radius + 3, radius + 2, p.main, p.outline);
  for (let n = -2; n <= 2; n++) spike(c, [x + n * 5, y - radius + 3], [x + n * 6, y - radius - 5 - Math.abs(n % 2)], 2, p.trim);
  if (back) {
    oval(a, x, y, radius, radius - 1, flesh, p.shade);
    for (let n = -2; n <= 2; n++) {
      a.line(x + n * 4, y - 9, x + n * 2, y, p.skinShade, 2);
      a.line(x + n * 2, y, x + n * 5, y + 9, p.shade, 2);
    }
    oval(a, x, y + 2, 5, 6, p.shade, p.outline);
    return;
  }
  const ex = x + (side ? 3 : 0), rx = side ? radius - 4 : radius - 1;
  oval(a, ex, y - 1, rx + 1, radius - 2, flesh, p.outline);
  oval(a, ex, y - 2, rx, radius - 4, '#b6ac91', p.skinShade);
  a.ellipse(ex - 2, y - 4, Math.max(2, rx - 4), Math.max(2, radius - 7), '#d0c4a6');
  for (const sign of [-1, 1]) {
    a.line(ex + sign * (rx - 1), y - 3, ex + sign * 5, y - 1, flesh);
    a.line(ex + sign * 7, y - 2, ex + sign * 7, y - 5, flesh);
    a.line(ex + sign * (rx - 2), y + 3, ex + sign * 5, y + 2, flesh);
  }
  oval(a, ex + (side ? 2 : 0), y - 2, 5, 7, p.eye, p.shade);
  a.rect(ex + (side ? 2 : 0) - 1, y - 8, 3, 12, p.outline);
  a.point(ex + (side ? 2 : 0) - 2, y - 6, tooth);
  polygon(a, [[x - 10, y + 8], [x + 11, y + 7], [x + 7, y + 16], [x - 6, y + 16]], mouth);
  for (let n = -3; n <= 3; n++) a.line(x + n * 3, y + 8, x + n * 2, y + 12 + Math.abs(n) % 2, tooth);
  for (let n = -2; n <= 2; n++) a.line(x + n * 3, y + 15, x + n * 2, y + 12, boneShade);
  if (tier > 3) for (const sign of [-1, 1]) {
    oval(a, x + sign * 17, y + 5, 4, 5, flesh, p.outline);
    a.rect(x + sign * 17 - 1, y + 3, 2, 3, p.eye);
  }
}

function wraith(c: EnemyInk) {
  const { a, p, side, back, tier, variant } = c;
  const x = c.x, y = 24 + c.bob;
  const wide = 9 + variant % 3;
  for (const sign of [-1, 1]) {
    const hx = x + sign * 20 + (sign > 0 ? c.reach : 0), hy = y + 12 - c.reach * 2;
    polygon(a, [[x + sign * 5, y + 1], [x + sign * 13, y + 3], [hx, hy], [hx - sign * 3, hy + 6], [x + sign * 11, y + 12]], p.outline);
    a.line(x + sign * 9, y + 4, hx - sign * 2, hy, p.main, 4);
    a.line(x + sign * 8, y + 3, hx - sign * 2, hy - 1, p.light, 2);
    for (let n = 0; n < 3; n++) a.line(hx + sign * n, hy, hx + sign * (n + 2), hy + 4 + n * 2, boneShade);
  }
  polygon(a, [[x - wide, y - 1], [x + wide, y - 1], [x + 10, y + 17], [x + 14 + c.pose.sway, 52], [x + 7, 49], [x + 4, 55], [x - 1, 50], [x - 7, 54], [x - 6, 47], [x - 15, 51], [x - 10, y + 16]], p.outline);
  polygon(a, [[x - wide + 2, y], [x + wide - 2, y], [x + 7, y + 17], [x + 10 + c.pose.sway, 49], [x + 5, 46], [x + 3, 51], [x - 1, 47], [x - 5, 51], [x - 4, 44], [x - 11, 48], [x - 7, y + 15]], p.cloth);
  for (let n = -1; n <= 1; n++) {
    a.line(x + n * 5, y + 4, x + n * 5 + c.pose.sway, 45 + n % 2 * 2, p.main, 2);
    a.line(x + n * 5 + 1, y + 10, x + n * 6, 42, p.light);
  }
  polygon(a, [[x - 8, y + 1], [x - 7, y - 9], [x - 2, y - 17], [x + 3, y - 15], [x + 9, y - 5], [x + 8, y + 3]], p.outline);
  polygon(a, [[x - 6, y], [x - 5, y - 8], [x - 1, y - 14], [x + 2, y - 12], [x + 7, y - 4], [x + 6, y + 1]], p.main);
  a.line(x - 5, y - 7, x - 1, y - 12, p.light, 2);
  if (!back) {
    oval(a, x + (side ? 3 : 0), y - 5, side ? 4 : 5, 6, p.outline, p.shade);
    eyes(c, x, y - 6, 3);
    a.rect(x + (side ? 2 : -1), y - 2, 2, 4, mouth);
    a.line(x - 5, y - 1, x - 3, y + 3, boneShade);
  }
  if (tier > 2) {
    a.line(x - 6, y + 5, x + 6, y + 5, p.trim);
    oval(a, x, y + 7, 3, 3, p.eye, p.outline);
    if (tier >= 4) for (const sign of [-1, 1]) spike(c, [x + sign * 7, y + 1], [x + sign * 12, y - 7], 2, bone);
  }
}

function wyrm(c: EnemyInk) {
  const { a, p, side, back, variant, tier } = c;
  const x = c.x, y = 42 + c.bob;
  // Foreground coils, a rising neck and a tapering tail create a serpentine S.
  const coils: readonly Point[] = [[x - 21, y + 7], [x - 14, y + 8], [x - 5, y + 8], [x + 7, y + 8], [x + 14, y + 3], [x + 10, y - 4], [x + 1, y - 7], [x - 6, y - 14], [x - 3, y - 22]];
  coils.forEach(([sx, sy], n) => {
    const radius = n === 0 ? 3 : n < 3 ? 5 : 7 + variant % 2;
    const sway = Math.sin(c.pose.frame * (c.pose.motion === 'walk' ? 0.5 : 0.15) + n * 0.5) * (c.pose.motion === 'walk' ? 1.2 : 0.5);
    oval(a, sx + sway, sy, radius, n < 5 ? 5 : 7, p.main, p.outline);
    a.line(sx - radius + 3, sy - 3, sx + 2, sy - 3, p.light, 2);
    a.line(sx - radius + 2, sy + 2, sx + radius - 2, sy + 2, p.skinShade, 2);
    if (n > 1 && n < 8) {
      spike(c, [sx - 3, sy - 3], [sx - 6, sy - 10 - (tier > 3 ? 2 : 0)], 2, p.trim);
      a.line(sx - 1, sy - 1, sx + 1, sy, p.shade);
      a.line(sx + 3, sy - 1, sx + 5, sy, p.shade);
    }
  });
  const hx = x + (side ? 2 : -2) + c.reach, hy = y - 24 - c.reach * 0.5;
  oval(a, hx, hy, side ? 10 : 9, 8, p.main, p.outline);
  for (const sign of [-1, 1]) {
    spike(c, [hx + sign * 5, hy - 4], [hx + sign * 9, hy - 13], 3, boneShade);
    if (tier >= 3) spike(c, [hx + sign * 7, hy + 2], [hx + sign * 14, hy - 2], 3, p.trim);
  }
  if (back) {
    scales(c, hx - 6, hy - 5, 2, 3);
    a.line(hx, hy - 5, hx, hy + 5, p.light, 2);
  } else {
    const muzzle = hx + (side ? 6 : 0);
    oval(a, muzzle, hy + 4, side ? 7 : 6, 4, p.main, p.outline);
    eyes(c, hx, hy - 1, 4);
    a.line(muzzle - 4, hy + 5, muzzle + 5, hy + 5, mouth, 2);
    a.line(muzzle - 3, hy + 4, muzzle - 2, hy + 8, tooth);
    a.line(muzzle + 3, hy + 4, muzzle + 2, hy + 8, tooth);
    a.rect(muzzle + (side ? 4 : -2), hy + 2, 2, 1, p.outline);
    if (c.reach > 0) {
      a.line(muzzle + 2, hy + 7, muzzle + 7, hy + 11, flesh);
      a.line(muzzle + 7, hy + 11, muzzle + 10, hy + 10, flesh);
    }
  }
}

/** Region-specific growth and equipment change contour as well as material. */
function seasonalAnatomy(c: EnemyInk) {
  const { a, p, appearance, side, tier, style } = c;
  const { form, season, family } = appearance;
  const humanoidForm = ['raider', 'archer', 'shaman', 'bulwark', 'stalker', 'skeleton', 'revenant', 'lich', 'wraith'].includes(form);
  const beast = form === 'wolf' || form === 'boar' || form === 'rat';
  if (humanoidForm) {
    const x = c.x, y = 25 + c.bob + (form === 'stalker' ? 4 : 0);
    const sx = x - (side ? 6 : 9);
    if (season === 'spring') {
      // Bundled reeds are lashed to a leather shoulder guard.
      for (let n = 0; n < 3; n++) {
        const rx = sx - 3 + n * 3;
        a.line(rx, y + 3, rx - 2, y - 5 - n % 2 * 3, woodLight);
        a.line(rx - 2, y - 4 - n % 2 * 3, rx - 2, y - 7 - n % 2 * 3, p.clothLight, 2);
      }
      a.line(sx - 4, y + 1, sx + 3, y + 2, p.trim);
    } else if (season === 'summer') {
      // Overlapping bronze lamellae extend the exposed shoulder.
      for (let n = 0; n < 3; n++) plate(c, sx - 4 + n * 2, y - 2 + n * 2, 7, 4, n % 2 ? p.shade : p.main);
      if (tier >= 2) spike(c, [sx - 1, y - 1], [sx - 4, y - 8], 2, p.trim);
      a.line(x - 3, y + 11, x + 3, y + 11, p.trim);
    } else if (season === 'autumn') {
      // Ragged hide overlaps the shoulder; bone clasps hang below its fringe.
      polygon(a, [[sx - 5, y - 2], [sx + 4, y - 3], [sx + 6, y + 3], [sx + 2, y + 2], [sx + 1, y + 6], [sx - 2, y + 3], [sx - 5, y + 5]], p.shade);
      for (let n = 0; n < 3; n++) a.line(sx - 3 + n * 3, y - 1, sx - 2 + n * 3, y + 2, p.clothLight, 2);
      for (let n = 0; n < 2 + (tier >= 4 ? 1 : 0); n++) {
        a.line(x - 4 + n * 4, y + 12, x - 4 + n * 4, y + 17 + n % 2, woodLight);
        a.rect(x - 5 + n * 4, y + 16 + n % 2, 3, 2, boneShade);
      }
    } else {
      // A heavy fur collar and hanging ice make the rime units broader at the neck.
      for (let n = -2; n <= 2; n++) {
        const fx = x + n * 4;
        polygon(a, [[fx - 3, y - 3], [fx + 2, y - 3], [fx + 3, y], [fx + 1, y + 3], [fx - 2, y + 1]], p.shade);
        a.line(fx - 2, y - 2, fx + 1, y - 1, p.light, 2);
      }
      if (tier >= 2) {
        a.line(sx - 3, y, sx + 3, y, p.trim, 2);
        spike(c, [sx - 2, y + 1], [sx - 1, y + 8], 2, p.light);
      }
    }
    return;
  }
  if (beast) {
    const y = (form === 'boar' ? 30 : form === 'wolf' ? 32 : 38) + c.bob;
    const x = c.x - (side ? 5 : 0);
    if (season === 'winter') {
      for (let n = -2; n <= 2; n++) {
        spike(c, [x + n * 4, y + 3], [x + n * 4 - 2, y - 5 - Math.abs(n) % 2], 3, p.light);
        a.line(x + n * 4 - 1, y + 3, x + n * 4 + 1, y + 5, p.trim);
      }
    } else if (season === 'autumn') {
      for (let n = 0; n < 3; n++) {
        a.line(x - 6 + n * 5, y + 1, x - 3 + n * 5, y + 7, p.skinShade, 2);
        a.line(x - 5 + n * 5, y + 2, x - 2 + n * 5, y + 6, flesh);
      }
      if (tier > 1) for (const sign of [-1, 1]) spike(c, [x + sign * 5, y + 3], [x + sign * 7, y - 5], 2, bone);
    } else if (season === 'summer') {
      for (let n = 0; n < 4; n++) a.line(x - 7 + n * 4, y, x - 4 + n * 4, y + 6, p.shade, 2);
      if (family === 'dry_fang') a.line(x - 5, y + 6, x + 6, y + 7, p.skinShade, 2);
    } else if (family === 'thicket_pack') {
      for (let n = 0; n < 3; n++) spike(c, [x - 5 + n * 5, y + 1], [x - 7 + n * 5, y - 4 - n % 2], 2, p.clothLight);
    }
    return;
  }
  if (form === 'treant' || form === 'thorn') return; // Branch foliage already carries seasonal anatomy.
  if (form === 'mushroom') {
    const x = c.x, y = 24 + c.bob;
    if (season === 'winter') {
      a.line(x - 13, y - 2, x - 7, y - 4, p.trim, 2);
      for (let n = -2; n <= 2; n++) spike(c, [x + n * 7, y + 1], [x + n * 7 + 1, y + 6 + Math.abs(n % 2) * 3], 2, p.light);
    } else if (season === 'autumn') {
      for (let n = -1; n <= 1; n++) {
        a.rect(x + n * 9 - 1, y - 5 - Math.abs(n) * 2, 4, 3, p.shade);
        a.point(x + n * 9 + 1, y - 3 - Math.abs(n) * 2, p.light);
      }
      a.line(x + 10, y - 7, x + 8, y - 1, p.outline);
    } else if (season === 'summer') {
      for (let n = -1; n <= 1; n++) spike(c, [x + n * 9, y - 6], [x + n * 11, y - 13 - (n === 0 ? 3 : 0)], 3, p.trim);
    }
    return;
  }
  if (form === 'flower') {
    const y = 24 + c.bob;
    if (season === 'winter') for (const sign of [-1, 1]) {
      spike(c, [c.x + sign * 16, y + 6], [c.x + sign * 21, y + 12], 3, p.trim);
      a.line(c.x + sign * 13, y - 7, c.x + sign * 17, y - 12, p.light, 2);
    }
    else if (season === 'autumn') for (const sign of [-1, 1]) a.line(c.x + sign * 14, y - 7, c.x + sign * 16, y - 12, p.outline, 2);
    else if (season === 'summer') for (const sign of [-1, 1]) spike(c, [c.x + sign * 11, y], [c.x + sign * 23, y - 2], 3, p.trim);
    return;
  }
  const y = (form === 'eye' ? 29 : form === 'wyrm' ? 40 : form === 'larva' || form === 'leech' ? 39 : form === 'spider' ? 27 : 35) + c.bob;
  const x = c.x - (side && form === 'spider' ? 4 : 0);
  if (season === 'winter') {
    for (let n = -1; n <= 1; n++) spike(c, [x + n * 6, y - 4], [x + n * 7, y - 12 - (n === 0 ? 3 : 0)], 3, p.light);
    a.line(x - 7, y + 1, x - 1, y + 3, p.trim, 2);
  } else if (family === 'saltwater_spawn' || family === 'flood_brood' || family === 'blackwater_spawn') {
    for (const sign of [-1, 1]) {
      const fx = x + sign * 8;
      polygon(a, [[fx, y - 4], [fx + sign * 8, y - 7 - style], [fx + sign * 6, y + 3], [fx, y + 5]], p.outline);
      polygon(a, [[fx + sign, y - 3], [fx + sign * 6, y - 5 - style], [fx + sign * 4, y + 2], [fx, y + 3]], p.clothLight);
      a.line(fx + sign, y - 1, fx + sign * 5, y - 3 - style, p.light);
    }
    if (tier > 2) {
      a.rect(x - 3, y - 3, 3, 3, boneShade);
      a.rect(x + 2, y, 3, 3, bone);
      a.point(x + 3, y + 1, p.shade);
    }
  } else if (family === 'ember_hive') {
    for (let n = -1; n <= 1; n++) {
      a.line(x + n * 5, y - 6, x + n * 5 - 1, y, p.outline, 3);
      a.line(x + n * 5, y - 5, x + n * 5 - 1, y - 1, p.eye);
      spike(c, [x + n * 5, y - 5], [x + n * 7, y - 12], 2, p.shade);
    }
  }
}

/** Authored 64px enemy anatomies. West is mirrored by the shared frame pipeline. */
export function drawEnemy(art: PixelCanvas, appearance: EnemyAppearance, facing: UnitFacing, pose: UnitPose): void {
  let familyHash = 0;
  for (const char of appearance.family) familyHash = (familyHash * 31 + char.charCodeAt(0)) >>> 0;
  const variant = Math.max(0, Math.round(appearance.variant)) + familyHash % 7;
  const tier = Math.max(1, Math.min(5, appearance.tier));
  const c: EnemyInk = {
    a: art, p: appearance.palette, appearance, pose,
    side: facing === 'east' || facing === 'west', back: facing === 'north',
    x: 31 + Math.max(-3, Math.min(3, pose.recoil)) + Math.max(0, Math.min(1, pose.reach * 0.25)),
    bob: Math.max(-1, Math.min(1, pose.breath - pose.lift)),
    reach: Math.max(-1, Math.min(3, pose.reach)),
    stride: Math.max(-3, Math.min(3, pose.step * 1.25)),
    tier, variant, style: (familyHash + variant) % 5,
    breadth: (variant % 3 === 2 ? 1 : 0) + (tier >= 4 ? 1 : 0),
  };
  switch (appearance.form) {
    case 'raider': case 'archer': case 'shaman': case 'bulwark': case 'stalker': humanoid(c); break;
    case 'skeleton': case 'revenant': case 'lich': undead(c); break;
    case 'treant': treant(c); break;
    case 'thorn': thorn(c); break;
    case 'mushroom': mushroom(c); break;
    case 'flower': flower(c); break;
    case 'rat': case 'wolf': case 'boar': quadruped(c); break;
    case 'spider': spider(c); break;
    case 'crab': crab(c); break;
    case 'leech': case 'larva': segmented(c); break;
    case 'eye': eye(c); break;
    case 'wraith': wraith(c); break;
    case 'wyrm': wyrm(c); break;
  }
  seasonalAnatomy(c);
}
