import { PixelCanvas } from './pixelCanvas';
import { UNIT_FOOT_Y, type UnitFacing, type UnitPose } from './unitPose';
import type { UnitPalette } from './unitPalette';

function creatureEyes(art: PixelCanvas, x: number, y: number, side: boolean, back: boolean, pose: UnitPose, p: UnitPalette) {
  if (back) return;
  if (pose.blink) {
    art.point(x, y, p.shade);
    if (!side) art.point(x + 4, y, p.shade);
  } else {
    art.rect(x, y, 2, 1, p.eye);
    art.point(x + 1, y, p.outline);
    if (!side) {
      art.rect(x + 4, y, 2, 1, p.eye);
      art.point(x + 4, y, p.outline);
    }
  }
}

export function drawQuadruped(art: PixelCanvas, id: string, facing: UnitFacing, pose: UnitPose, p: UnitPalette) {
  const side = facing === 'east';
  const back = facing === 'north';
  const rat = id === 'rat';
  const boar = id === 'boar';
  const cx = 15 + pose.recoil + Math.max(0, pose.reach - 1);
  const bodyY = 21 + pose.breath - pose.lift;
  const halfWidth = side ? boar ? 7 : 6 : boar ? 6 : 4;
  for (let leg = 0; leg < 4; leg++) {
    const near = leg % 2 === 0;
    const advance = pose.step * (near ? 1 : -1);
    const x = cx + (side ? (leg < 2 ? -4 : 4) : (near ? -3 : 3));
    const footX = x + (side ? advance : 0);
    const footY = UNIT_FOOT_Y - 1 - Math.max(0, side ? -advance : advance);
    art.line(x, bodyY + 1, footX, footY - 1, near ? p.main : p.shade, 2);
    art.rect(footX, footY, rat ? 2 : 3, 1, near ? p.light : p.shade);
  }
  if (side) {
    art.line(cx - halfWidth, bodyY, cx - halfWidth - 4, bodyY - 2 + pose.sway, rat ? p.skinShade : p.shade, rat ? 1 : 2);
    if (rat) art.line(cx - halfWidth - 4, bodyY - 2 + pose.sway, cx - halfWidth - 5, bodyY - 4 + pose.sway, p.skin);
  } else if (!back) art.line(cx + halfWidth - 1, bodyY, cx + halfWidth + 3, bodyY - 4 + pose.sway, p.shade, rat ? 1 : 2);
  art.ellipse(cx, bodyY, halfWidth + 1, boar ? 5 : 4, p.outline);
  art.ellipse(cx, bodyY - 1, halfWidth, boar ? 4 : 3, p.shade);
  art.ellipse(cx, bodyY - 2, halfWidth - 1, 2, p.main);
  art.line(cx - halfWidth + 3, bodyY - 3, cx + 2, bodyY - 3, p.light);
  if (boar) {
    for (let spike = 0; spike < 5; spike++) art.line(cx - 4 + spike * 2, bodyY - 4, cx - 5 + spike * 2, bodyY - 6, p.shade);
  }
  const headX = side ? cx + halfWidth : cx;
  const headY = side ? bodyY - 3 : back ? bodyY - 4 : bodyY + 1;
  art.ellipse(headX, headY, boar ? 4 : 3, 3, p.outline);
  art.ellipse(headX, headY - 1, 3, 2, p.main);
  if (rat) {
    art.ellipse(headX - 2, headY - 4, 2, 2, p.shade);
    art.ellipse(headX + 2, headY - 4, 2, 2, p.shade);
    art.point(headX - 2, headY - 4, p.skin);
    art.point(headX + 2, headY - 4, p.skin);
  } else {
    art.line(headX - 2, headY - 2, headX - 2, headY - (boar ? 4 : 5), p.main, 2);
    art.line(headX + 1, headY - 2, headX + 2, headY - (boar ? 3 : 5), p.light);
  }
  creatureEyes(art, side ? headX + 1 : headX - 3, headY, side, back, pose, p);
  if (!back) {
    const snoutX = side ? headX + 3 : headX - 1;
    const snoutY = side ? headY + 1 : headY + 2;
    art.rect(snoutX, snoutY, boar ? 3 : 2, 2, boar ? p.skinShade : p.light);
    art.point(snoutX + (side ? 1 : 0), snoutY + 1, p.outline);
    if (boar) {
      art.line(snoutX, snoutY + 2, snoutX - 1, snoutY, p.trim);
      art.point(snoutX + 3, snoutY, p.trim);
    }
    if (rat) {
      art.line(snoutX - 2, snoutY, snoutX - 4, snoutY - 1, p.light);
      art.line(snoutX + 2, snoutY, snoutX + 4, snoutY - 1, p.light);
    }
  } else {
    art.line(cx, bodyY + 2, cx + pose.sway, bodyY + 5, rat ? p.skinShade : p.shade, rat ? 1 : 2);
  }
}

export function drawSlime(art: PixelCanvas, facing: UnitFacing, pose: UnitPose, p: UnitPalette) {
  const bounce = pose.motion === 'walk' ? [0, -2, -1, 0, 1, 0][pose.frame] : pose.breath;
  const width = 8 + (bounce > 0 ? 1 : bounce < -1 ? -1 : 0);
  const cx = 16 + pose.recoil + Math.max(0, pose.reach - 1);
  const cy = UNIT_FOOT_Y - 7 + bounce;
  art.ellipse(cx, cy, width + 1, 6 - bounce, p.outline);
  art.ellipse(cx, cy - 1, width, 5 - bounce, p.shade);
  art.ellipse(cx - 1, cy - 2, width - 1, 4 - bounce, p.main);
  art.line(cx - 6, UNIT_FOOT_Y - 1, cx + 6, UNIT_FOOT_Y - 1, p.shade);
  art.rect(cx - 4, cy - 5, 4, 2, p.light);
  art.point(cx - 5, cy - 3, p.light);
  const side = facing === 'east';
  creatureEyes(art, side ? cx + 4 : cx - 3, cy, side, facing === 'north', pose, p);
  if (facing !== 'north') art.point(side ? cx + 5 : cx, cy + 2, p.shade);
  else art.rect(cx + 2, cy - 2, 2, 2, p.light);
  if (pose.motion === 'attack' && pose.reach > 0) {
    art.ellipse(cx + (side ? 8 : 0), side ? cy : cy + 3, 2, 2, p.light);
  }
}

export function drawSpider(art: PixelCanvas, facing: UnitFacing, pose: UnitPose, p: UnitPalette) {
  const cx = 16 + pose.recoil;
  const y = 21 - pose.lift + pose.breath;
  for (let leg = 0; leg < 4; leg++) {
    for (const side of [-1, 1]) {
      const lift = (leg % 2 ? -pose.step : pose.step) * side;
      const kneeX = cx + side * (7 + leg % 2);
      const kneeY = y - 5 + leg * 3 - Math.max(0, lift);
      const footX = cx + side * (10 + leg % 2);
      // Breathing bends the knees; planted tips never follow the abdomen upward.
      const footY = UNIT_FOOT_Y - 1 - (3 - leg) * 3 - Math.max(0, lift);
      art.line(cx + side * 3, y - 2 + leg, kneeX, kneeY, p.shade, 2);
      art.line(kneeX, kneeY, footX, footY, p.main);
      art.point(footX, footY, p.light);
    }
  }
  art.ellipse(cx, y - 3, 5, 5, p.outline);
  art.ellipse(cx, y - 4, 4, 4, p.shade);
  art.ellipse(cx - 1, y - 5, 3, 2, p.main);
  art.rect(cx - 1, y - 6, 2, 3, p.light);
  const side = facing === 'east';
  const hx = cx + (side ? 4 : 0) + Math.max(0, pose.reach - 1);
  const hy = y + (facing === 'north' ? -5 : 3);
  art.ellipse(hx, hy, 3, 2, p.shade);
  creatureEyes(art, side ? hx + 1 : hx - 3, hy, side, facing === 'north', pose, p);
  if (facing !== 'north') {
    art.line(hx - 2, hy + 1, hx - 1, hy + 3, p.light);
    art.line(hx + 2, hy + 1, hx + 1, hy + 3, p.light);
  }
}

export function drawNature(art: PixelCanvas, id: string, facing: UnitFacing, pose: UnitPose, p: UnitPalette) {
  const large = id === 'elite_warden';
  const side = facing === 'east';
  const cx = 16 + pose.recoil;
  const y = (large ? 15 : 19) + pose.breath - pose.lift;
  for (const sign of [-1, 1]) {
    const leg = pose.step * sign;
    art.line(cx + sign * 2, y + 4, cx + sign * 4 + leg, 26, p.cloth, 2);
    art.line(cx + sign * 4 + leg, 26, cx + sign * 6 + leg, 27 - Math.max(0, -leg), p.clothLight);
    const armX = cx + sign * (large ? 8 : 6) + Math.max(0, pose.reach);
    const armY = y + 1 + sign * pose.sway - pose.reach;
    art.line(cx + sign * 2, y + 2, armX, armY, p.cloth, 2);
    art.line(armX, armY, armX + sign * 2, armY - 4, p.clothLight);
    art.ellipse(armX, armY - 4, 2, 2, p.main);
  }
  art.rect(cx - 3, y - 2, 7, 10, p.outline);
  art.rect(cx - 2, y - 2, 5, 9, p.cloth);
  art.line(cx, y - 1, cx - 1, y + 7, p.clothLight);
  art.point(cx + 1, y + 4, p.shade);
  const crownY = y - (large ? 5 : 4);
  for (const [dx, dy, radius] of [[-4, 0, 4], [3, -2, 4], [0, 3, 5]] as const) {
    art.ellipse(cx + dx + pose.sway, crownY + dy, radius, radius - 1, p.shade);
    art.ellipse(cx + dx - 1 + pose.sway, crownY + dy - 1, radius - 1, radius - 2, p.main);
    art.line(cx + dx - 2 + pose.sway, crownY + dy - 2, cx + dx + pose.sway, crownY + dy - 2, p.light);
  }
  if (large) {
    art.line(cx - 4, crownY - 2, cx - 6, crownY - 6, p.clothLight);
    art.line(cx + 4, crownY - 3, cx + 6, crownY - 6, p.clothLight);
    art.line(cx - 6, crownY - 4, cx - 8, crownY - 5, p.trim);
    art.line(cx + 6, crownY - 4, cx + 8, crownY - 5, p.trim);
  } else {
    for (const sign of [-1, 1]) art.line(cx + sign * 5, crownY + 1, cx + sign * 7, crownY - 2, p.light);
  }
  creatureEyes(art, side ? cx + 3 : cx - 3, crownY + 3, side, facing === 'north', pose, p);
  if (facing !== 'north') art.line(cx, crownY + 5, cx + 2, crownY + 5, p.outline);
}
