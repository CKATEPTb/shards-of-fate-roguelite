import { armoredHero, drawHeroHead, drawHeroTorso, heroHalfWidth } from './heroOutfit';
import { drawHeroItem, type HeroHand } from './heroEquipment';
import { screenLimb, type HeroAppearance, type HeroLimb } from './heroAppearance';
import { PixelCanvas } from './pixelCanvas';
import type { UnitPalette } from './unitPalette';
import { type UnitFacing, type UnitPose } from './unitPose';

/** A low torso, separate reaching hands and trailing hips form a crawl, not a rotated walk. */
function drawCrawlingHero(art: PixelCanvas, id: string, facing: UnitFacing, pose: UnitPose, p: UnitPalette, body: HeroAppearance, mirrored: boolean) {
  const side = facing === 'east';
  const back = facing === 'north';
  const pull = pose.motion === 'walk' ? [0, 1, 2, 1, 0, -1][pose.frame] : 0;
  const reach = Math.max(0, pose.reach);
  const cx = 16 + pose.recoil;
  const hands: HeroHand[] = [];
  // Far arm first; the hips remain at ground level throughout the pull.
  for (const sign of [-1, 1]) {
    const limb = screenLimb(sign, back);
    if (!body.present[limb]) continue;
    const phase = pull * sign;
    const shoulderX = side ? cx + 2 : cx + sign * 3;
    const shoulderY = (side ? 22 : back ? 22 : 23) + pose.breath;
    const handX = side ? cx + 8 + phase + reach : cx + sign * (5 + Math.max(0, phase) + reach);
    const handY = (side ? 27 : back ? 21 - Math.max(0, phase) : 27) - reach;
    art.line(shoulderX, shoulderY, handX - (side ? 2 : sign), handY - 2, p.outline, 3);
    art.line(shoulderX, shoulderY, handX - (side ? 2 : sign), handY - 2, armoredHero(id) ? p.main : p.clothLight, 2);
    art.rect(handX - 1, handY - 1, 3, 2, p.skin);
    hands.push({ x: handX, y: handY - 1, limb: itemArm(limb, mirrored) });
  }
  if (body.present.torso) {
    if (side) {
      art.ellipse(cx - 2, 24, 7, 3, p.outline);
      art.ellipse(cx - 2, 23 + pose.breath, 6, 2, armoredHero(id) ? p.main : p.cloth);
      art.line(cx - 7, 23, cx + 2, 21 + pose.breath + (pull > 1 ? 1 : 0), p.clothLight, 2);
      art.rect(cx - 7, 26, 5, 2, p.cloth);
    } else {
      drawHeroTorso(art, id, cx, 21 + pose.breath, 4, back, p, 7 - pose.breath);
      art.line(cx - 4, 26, cx + 4, 26, p.clothLight);
    }
  }
  const headY = (side ? 16 + (pull > 1 ? 1 : 0) : back ? 15 : 19) + pose.breath;
  if (body.present.head) drawHeroHead(art, id, side ? cx + 4 : cx, headY, facing, pose, p);
  for (const hand of hands) drawHeroItem(art, id, hand, pose, p, true);
}

/** Anatomical sides are authored independently; only present limbs carry equipment. */
function itemArm(limb: HeroLimb, mirrored: boolean): HeroLimb {
  return mirrored ? limb === 'leftArm' ? 'rightArm' : 'leftArm' : limb;
}

export function drawHero(art: PixelCanvas, id: string, facing: UnitFacing, pose: UnitPose, p: UnitPalette, body: HeroAppearance, mirrored = false) {
  if (!body.present.leftLeg && !body.present.rightLeg) {
    drawCrawlingHero(art, id, facing, pose, p, body, mirrored);
    return;
  }
  const side = facing === 'east';
  const back = facing === 'north';
  const singleLeg = !body.present.leftLeg || !body.present.rightLeg;
  const injury = Math.max(body.leftLegInjury, body.rightLegInjury);
  const weakerLeft = body.leftLegInjury > body.rightLegInjury;
  const shuffling = !singleLeg && injury > 0 && body.leftLegInjury === body.rightLegInjury;
  const supportSign = body.present.leftLeg ? back ? -1 : 1 : back ? 1 : -1;
  const limpPhase = !shuffling && pose.motion === 'walk' && (weakerLeft ? pose.step > 0 : pose.step < 0);
  const lean = singleLeg ? supportSign * 2 : limpPhase ? (weakerLeft ? -1 : 1) * injury : 0;
  const cx = 16 + pose.recoil + lean + Math.max(0, Math.floor(pose.reach / 2));
  const y = 15 + pose.breath - (singleLeg || shuffling ? 0 : pose.lift) + (limpPhase || shuffling ? injury : 0);
  const half = heroHalfWidth(id, side);
  const hands: HeroHand[] = [];

  if (body.present.torso) {
    // Short hems leave missing legs visible, even on robed heroes.
    art.rect(cx - half, y + 1, half * 2 + 1, 7, p.cloth);
    art.line(cx - half, Math.min(24, y + 7), cx + half + pose.sway, Math.min(24, y + 8), p.clothLight);
  }
  for (const sign of [-1, 1]) {
    const limb = screenLimb(sign, back, true);
    if (!body.present[limb]) continue;
    const legInjury = limb === 'leftLeg' ? body.leftLegInjury : body.rightLegInjury;
    const advance = singleLeg ? 0 : Math.round(pose.step * sign * (1 - legInjury * 0.3));
    const footX = singleLeg ? 16 : 16 + (side ? sign + advance : sign * 3);
    const footY = singleLeg ? 26 : 26 - Math.max(0, -advance);
    art.line(cx + sign * 2, y + 6, footX, footY - 1, p.outline, 3);
    art.line(cx + sign * 2, y + 6, footX, footY - 1, p.shade, 2);
    art.rect(footX - 1, footY, side ? 4 : 3, 2, '#625846');
    art.point(footX + 1, footY, p.light);
  }
  for (const sign of [-1, 1]) {
    const limb = screenLimb(sign, back);
    if (!body.present[limb]) continue;
    const swing = pose.motion === 'walk' ? pose.step * sign : -Math.max(0, pose.reach);
    const handX = cx + sign * (half + 1 + Math.max(0, pose.reach));
    const handY = Math.min(24, y + 5 + swing);
    art.line(cx + sign * half, y + 1, handX, handY - 1, armoredHero(id) ? p.main : p.clothLight, 2);
    art.rect(handX - (sign < 0 ? 1 : 0), handY, 2, 2, sign < 0 ? p.skinShade : p.skin);
    hands.push({ x: handX, y: handY, limb: itemArm(limb, mirrored) });
  }
  if (body.present.torso) drawHeroTorso(art, id, cx, y, half, back, p);
  if (body.present.head) drawHeroHead(art, id, cx, y - 7, facing, pose, p);
  for (const hand of hands) drawHeroItem(art, id, hand, pose, p);
}
