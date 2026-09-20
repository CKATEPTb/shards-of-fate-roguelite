import { PixelCanvas } from './pixelCanvas';
import { UNIT_FOOT_Y, type UnitFacing, type UnitPose } from './unitPose';
import type { UnitPalette } from './unitPalette';

function drawBoots(art: PixelCanvas, centre: number, side: boolean, pose: UnitPose, p: UnitPalette) {
  const spacing = side ? 1 : 3;
  for (const leg of [-1, 1]) {
    const advance = pose.step * leg;
    const x = centre + spacing * leg + (side ? advance : 0);
    const knee = 23 - Math.max(0, advance);
    art.rect(x - 1, 22, 3, 4, p.outline);
    art.rect(x, knee, 2, 4, p.shade);
    art.rect(x - 1, UNIT_FOOT_Y - 2 - Math.max(0, -advance), side ? 4 : 3, 2, '#625846');
    art.point(x + 1, UNIT_FOOT_Y - 2 - Math.max(0, -advance), p.light);
  }
}

export function drawHead(art: PixelCanvas, id: string, cx: number, y: number, facing: UnitFacing, pose: UnitPose, p: UnitPalette) {
  const side = facing === 'east';
  const back = facing === 'north';
  const goblin = id.startsWith('goblin');
  const hooded = id === 'priest' || id === 'goblin_shaman';
  const hair = id === 'guardian' ? p.shade : hooded ? p.cloth : '#30302b';
  art.rect(cx - 3, y, side ? 6 : 7, 7, p.outline);
  art.rect(cx - 2, y - 1, side ? 4 : 5, 2, hair);
  art.rect(cx - 3, y + 1, side ? 5 : 7, 5, hair);
  if (goblin) {
    art.line(cx - 3, y + 3, cx - 6, y + 1, p.skinShade, 2);
    if (!side) art.line(cx + 3, y + 3, cx + 6, y + 1, p.skinShade, 2);
    art.point(cx - 5, y + 2, p.skin);
  }
  if (back) {
    art.rect(cx - 2, y + 1, 5, 4, hooded ? p.clothLight : id === 'guardian' ? p.main : '#575343');
    art.rect(cx - 1, y + 5, 3, 2, hooded ? p.cloth : '#39382e');
    if (id === 'guardian') art.line(cx - 2, y + 4, cx + 2, y + 4, p.light);
  } else {
    const faceX = side ? cx : cx - 2;
    art.rect(faceX, y + 2, side ? 4 : 5, 4, p.skinShade);
    art.rect(faceX + 1, y + 2, side ? 3 : 4, 3, p.skin);
    if (side) art.point(cx + 4, y + 3, p.skin);
    if (!pose.blink) {
      art.point(side ? cx + 2 : cx - 1, y + 3, p.outline);
      if (!side) art.point(cx + 2, y + 3, p.outline);
    } else art.line(faceX + 1, y + 3, faceX + (side ? 2 : 3), y + 3, p.skinShade);
    art.point(cx + (side ? 3 : 1), y + 5, p.skinShade);
    if (id === 'guardian') {
      art.rect(cx - 3, y, side ? 6 : 7, 2, p.main);
      art.line(cx - 2, y, cx + 2, y, p.light);
      art.rect(cx - 3, y + 2, 1, 4, p.shade);
    }
    if (id === 'mage') art.rect(cx - 3, y + 1, side ? 4 : 3, 2, '#575343');
  }
  if (id === 'priest') {
    art.rect(cx - 4, y, 2, 7, p.main);
    if (!side) art.rect(cx + 3, y, 2, 7, p.main);
    art.rect(cx - 3, y - 1, 7, 2, p.light);
    art.point(cx - 3, y + 3, p.light);
  }
  if (id === 'goblin_shaman') {
    art.line(cx - 2, y, cx - 3, y - 3, p.trim, 2);
    art.line(cx + 2, y, cx + 3, y - 2, p.light);
  }
}

function drawEquipment(art: PixelCanvas, id: string, cx: number, y: number, side: boolean, back: boolean, pose: UnitPose, p: UnitPalette) {
  const cast = pose.reach;
  const handX = cx + (side ? 3 : 6) + Math.max(0, cast);
  const handY = y + 5 - Math.max(0, cast);
  if (id === 'guardian') {
    const shieldX = cx - (side ? 2 : 8) + (side ? cast : 0);
    art.rect(shieldX, y + 1, 5, 7, p.outline);
    art.rect(shieldX + 1, y + 1, 3, 7, '#788d91');
    art.rect(shieldX + 1, y + 2, 2, 4, p.cloth);
    art.point(shieldX + 2, y + 3, p.trim);
    art.rect(shieldX + 1, y + 8, 3, 1, p.shade);
    const bladeX = handX + (cast > 0 ? 1 : 0);
    art.line(bladeX, handY, bladeX + (cast > 0 ? 3 : 0), handY - 7, '#d0d4bf');
    art.point(bladeX + (cast > 0 ? 3 : 0), handY - 8, '#788d91');
    art.rect(bladeX - 1, handY - 1, 3, 1, p.trim);
  } else if (id === 'goblin_archer') {
    // The curved bow, quiver and feathered arrows distinguish the archer from a scout.
    const bowX = handX;
    art.line(bowX, y, bowX + 2, y + 2, '#b29666');
    art.line(bowX + 2, y + 2, bowX + 2, y + 7, '#b29666');
    art.line(bowX + 2, y + 7, bowX, y + 9, '#b29666');
    art.line(bowX, y, bowX - (cast > 0 ? 2 : 0), y + 5, '#ddd0a2');
    art.line(bowX - (cast > 0 ? 2 : 0), y + 5, bowX, y + 9, '#ddd0a2');
    if (pose.motion === 'attack') {
      art.line(bowX - 3, y + 4, bowX + 4, y + 4, p.trim);
      art.point(bowX + 4, y + 3, p.light);
    }
  } else if (id === 'priest' || id === 'goblin_shaman') {
    const staffX = cx - (side ? 2 : 8) + Math.max(0, cast);
    const staffY = y - 7 - Math.max(0, cast);
    art.rect(staffX, staffY + 2, 1, 17, '#8d734b');
    art.rect(staffX + 1, staffY + 3, 1, 15, '#483b2f');
    art.rect(staffX - 1, staffY, 3, 5, p.trim);
    art.rect(staffX - 2, staffY + 1, 5, 2, p.trim);
    art.rect(staffX, staffY + 1, 1, 2, id === 'priest' ? '#fff0bd' : '#d9c9e4');
    if (cast > 0) {
      art.point(staffX - 3, staffY - 1, p.light);
      art.point(staffX + 4, staffY + 1, p.trim);
    }
  } else if (id === 'mage') {
    for (const sign of side ? [1] : [-1, 1]) {
      const fireX = sign > 0 ? handX : cx - 7;
      const flicker = (pose.frame + (sign > 0 ? 1 : 0)) % 3;
      art.rect(fireX, handY, 3, 2, '#d87843');
      art.rect(fireX + 1, handY - 2 - flicker, 2, 4 + flicker, '#ff9c51');
      art.rect(fireX + 1, handY - 1, 1, 2, '#ffe1a0');
      if (cast > 0) art.point(fireX - 1, handY - 4, '#ffc773');
    }
  } else {
    art.line(handX, handY, handX + Math.max(1, cast), handY - 4, '#bac2ae');
    art.point(handX, handY + 1, '#745841');
  }
  if (back && id === 'guardian') art.rect(cx - 1, y + 1, 2, 5, p.clothLight);
}

/** Layered anatomy lets feet, hands, hems and head move independently. */
export function drawHumanoid(art: PixelCanvas, id: string, facing: UnitFacing, pose: UnitPose, p: UnitPalette) {
  const side = facing === 'east';
  const back = facing === 'north';
  const goblin = id.startsWith('goblin');
  const robed = ['mage', 'priest', 'goblin_shaman'].includes(id);
  const cx = 16 + pose.recoil + Math.max(0, Math.floor(pose.reach / 2));
  const y = 15 + (goblin ? 1 : 0) + pose.breath - pose.lift;
  const half = side ? 3 : 4;

  // Cloak and quiver sit behind the body, not behind the whole rendered unit.
  if (!goblin || id === 'goblin_shaman') {
    art.rect(cx - half - 1, y + 1, half * 2 + 3, robed ? 9 : 8, p.cloth);
    art.line(cx - half - 1, y + 8, cx + half + pose.sway, y + 9, p.clothLight);
  }
  if (id === 'goblin_archer') {
    art.line(cx - 4, y + 7, cx - 2, y - 3, '#6c4e34', 2);
    art.line(cx - 3, y + 1, cx - 2, y - 5, '#d1bd88');
    art.rect(cx - 3, y - 5, 3, 2, '#b8c5a5');
  }
  drawBoots(art, cx, side, pose, p);
  const nearSwing = pose.motion === 'walk' ? -pose.step : -pose.reach;
  art.line(cx - half - 1, y + 1, cx - half - 2, y + 5 + nearSwing, p.clothLight, 2);
  art.rect(cx - half - 2, y + 5 + nearSwing, 2, 2, p.skinShade);
  art.rect(cx - half, y, half * 2 + 1, 8, p.outline);
  art.rect(cx - half + 1, y, half * 2 - 1, 7, id === 'guardian' ? p.main : p.cloth);
  art.rect(cx - half + 1, y + 1, 2, 5, id === 'guardian' ? p.light : p.clothLight);
  if (robed) {
    art.rect(cx - half, y + 5, half * 2 + 1, 5, p.cloth);
    art.rect(cx - 1, y + 2, 2, 8, back ? p.clothLight : p.trim);
    art.line(cx - half, y + 9, cx + half + pose.sway, y + 9, p.clothLight);
    if (id === 'priest') art.line(cx - half, y + 10, cx + half, y + 10, p.light);
  } else {
    art.rect(cx - half, y + 6, half * 2 + 1, 1, '#4a3e2e');
    if (!back) art.rect(cx, y + 6, 2, 1, p.trim);
  }
  if (back) art.rect(cx - half + 1, y + 1, half * 2 - 1, 6, p.cloth);
  const handX = cx + half + Math.max(0, pose.reach);
  const handY = y + 5 - Math.max(0, pose.reach) + Math.max(0, pose.step);
  art.line(cx + half - 1, y + 1, handX, handY - 1, id === 'guardian' ? p.main : p.clothLight, 2);
  art.rect(handX, handY, 2, 2, p.skin);
  drawHead(art, id, cx, y - 7, facing, pose, p);
  drawEquipment(art, id, cx, y, side, back, pose, p);
}
