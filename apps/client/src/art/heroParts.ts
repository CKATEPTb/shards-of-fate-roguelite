import type { EquipmentSlot } from '@shards/shared';
import { PixelCanvas } from './pixelCanvas';
import { heroVisualItem, type ResolvedHeroLoadout } from './heroLoadout';
import type { HeroRig, HeroSide, RigPoint } from './heroRigTypes';
import { drawHeroHeadProfile } from './heroHeadProfile';
import { heroWalkStep } from './heroGait';
import { drawEquipmentMotif, equipmentAccents, equipmentIsPlate as plate, equipmentStyle, equipmentTheme } from './heroEquipmentTheme';
import { boneSegment, equipmentMaterial,
  drawHeroWeapon, heroMaterial, partPainter } from './heroPartEquipment';

const robe = (id?: string) => !plate(id) && ['ivory-pilgrim', 'ash-weaver', 'grave-keeper', 'wildwood'].includes(equipmentStyle(id) ?? '');
const item = (loadout: ResolvedHeroLoadout, slot: EquipmentSlot) => heroVisualItem(loadout[slot], slot)?.appearanceId;
const between = (a: RigPoint, b: RigPoint, fraction: number): RigPoint => ({ x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction });

function torsoPainter(art: PixelCanvas, rig: HeroRig) {
  const chest = rig.points.chest, pelvis = rig.points.pelvis;
  return partPainter(art, chest, Math.atan2(chest.x - pelvis.x, pelvis.y - chest.y));
}

/** Capes end above a missing leg; cloth never paints an absent limb back into the silhouette. */
function drawCloak(art: PixelCanvas, rig: HeroRig, chestId?: string) {
  if (!chestId || !rig.body.present.torso) return;
  const p = equipmentMaterial(chestId), d = torsoPainter(art, rig);
  const fullLegs = rig.body.present.leftLeg && rig.body.present.rightLeg;
  const bodyLength = Math.hypot(rig.points.pelvis.x - rig.points.chest.x, rig.points.pelvis.y - rig.points.chest.y);
  const short = equipmentStyle(chestId) === 'night-stalker' || equipmentStyle(chestId) === 'greenwood';
  const length = bodyLength + (rig.crawling || !fullLegs ? 1 : short ? 3 : equipmentStyle(chestId) === 'crimson-oath' ? 15 : 12);
  const width = rig.side ? 6 : plate(chestId) ? 9 : 8;
  const hem = Math.round(length);
  const drift = rig.pose.motion === 'walk' ? rig.pose.sway * 0.8 : rig.pose.breath * 0.3;
  const flare = short ? 0 : 2;
  d.shape([[-width + 1, -4], [-3, -5], [3, -5], [width, -2],
    [width + flare + drift, hem - 3], [width - 2 + drift, hem], [1 + drift, hem - 1],
    [-width - flare + drift, hem]], p.dark);
  d.shape([[-width + 2, -3], [-2, -4], [2, -4], [width - 1, -1],
    [width + flare - 1 + drift, hem - 3], [width - 2 + drift, hem - 1],
    [-width - flare + 1 + drift, hem - 1]], p.cloth);
  // The cloth has broad folded surfaces, rather than a dark triangle with bright seams.
  d.shape([[-width + 2, -2], [-3, 0], [-3 + drift, hem - 3],
    [-width - flare + 2 + drift, hem - 1]], p.fold);
  d.shape([[2, -2], [width - 1, 0], [width + flare - 1 + drift, hem - 3],
    [2 + drift, hem - 2], [0, 5]], p.shadow);
  d.shape([[-2, 3], [0, 7], [1 + drift, hem - 2], [-2 + drift, hem - 4]], p.shadow);
  if (equipmentStyle(chestId) === 'crimson-oath') {
    d.shape([[-width + 2, 4], [-width + 4, 8], [-width + drift, hem - 3],
      [-width - flare + 2 + drift, hem - 1]], '#995063');
  }
  if (equipmentStyle(chestId) === 'grave-keeper') {
    d.shape([[-width, hem - 5], [-5, hem - 4], [-6, hem], [-width - 1, hem]], p.fold);
    d.shape([[3, hem - 4], [width, hem - 5], [width - 1, hem - 1], [5, hem]], p.shadow);
  }
  const theme = equipmentTheme(chestId);
  if (theme) {
    if (theme.variant % 3 === 1) d.line(-width + 3, 0, -width - flare + 3 + drift, hem - 2, p.trim);
    else if (theme.variant % 3 === 2) { d.line(-width + 2, hem - 3, width - 2, hem - 3, p.trim); d.line(-width + 3, hem - 5, width - 3, hem - 5, p.fold); }
    if (rig.back && !rig.side) drawEquipmentMotif(d, chestId, 0, Math.min(hem - 5, 12), 3);
  }
}

function drawLeg(art: PixelCanvas, rig: HeroRig, side: HeroSide, loadout: ResolvedHeroLoadout, far: boolean) {
  if (!rig.body.present[`${side}Leg`]) return;
  const hip = rig.points[`${side}Hip`], knee = rig.points[`${side}Knee`], foot = rig.points[`${side}Foot`];
  const pantsId = item(loadout, 'pants'), bootsId = item(loadout, 'boots');
  const p = equipmentMaterial(pantsId), skin = heroMaterial(rig.id);
  const armored = plate(pantsId);
  const fill = pantsId ? armored ? p.metal : p.cloth : '#514a40';
  const lit = pantsId ? armored ? p.edge : p.fold : '#6f6554';
  boneSegment(art, hip, knee, armored ? 4 : 3.6, armored ? 3 : 2.8,
    far ? p.shadow : fill, p.shadow, far ? fill : lit);
  boneSegment(art, knee, foot, armored ? 3 : 2.7, 2.2,
    far ? p.shadow : fill, p.shadow, far ? fill : lit);
  const kneeArt = partPainter(art, knee, rig.bones[`${side}Knee`].world.rotation);
  if (armored) {
    kneeArt.shape([[-3, -2], [2, -3], [4, 0], [2, 3], [-2, 3], [-3, 1]], p.shadow);
    kneeArt.shape([[-2, -2], [2, -2], [3, 0], [1, 2], [-2, 1]], p.metal);
    if (!far) kneeArt.shape([[-2, -2], [1, -2], [0, 1], [-2, 0]], p.edge);
  } else {
    kneeArt.shape([[-2, -1], [2, 0], [2, 2], [-1, 1]], far ? p.cloth : p.shadow);
    if (equipmentStyle(pantsId) === 'night-stalker' || equipmentStyle(pantsId) === 'greenwood') kneeArt.line(-2, 3, 2, 3, '#88765a');
  }
  if (bootsId) {
    const b = equipmentMaterial(bootsId), greave = plate(bootsId);
    const accents = equipmentAccents(bootsId);
    // Both feet wear the same item. Depth changes occlusion, never the material:
    // using the cloth shadow here turned the far leather boot blue/green.
    const bootFill = greave ? b.metal : accents.leather;
    const bootShadow = greave ? b.shadow : accents.leatherShadow;
    const bootEdge = greave ? b.edge : accents.leatherEdge;
    const bootOutline = greave || equipmentTheme(bootsId) ? b.dark : '#30291f';
    const top = between(knee, foot, greave ? 0.2 : 0.4);
    boneSegment(art, top, foot, 3, 2.5, bootFill, bootShadow, bootEdge);
    const boot = partPainter(art, foot, rig.bones[`${side}Foot`].world.rotation);
    if (rig.pose.motion === 'walk' && !rig.side && !rig.crawling && rig.body.functional.leftLeg && rig.body.functional.rightLeg) {
      // Toes follow the direction of travel. Frontal steps don't show the
      // long lateral boot silhouette used for a standing, turned-out stance.
      const step = heroWalkStep(rig.pose, side);
      const toe = rig.back ? 1 - step.heel : 3 - step.lift * 0.5;
      boot.shape([[-2.5, -3], [2.5, -3], [3, toe - 1], [2, toe + 1], [-2, toe + 1], [-3, toe - 1]], bootOutline);
      boot.shape([[-1.5, -2], [1.5, -2], [2, toe - 1], [1.5, toe], [-1.5, toe], [-2, toe - 1]], bootFill);
      boot.line(-1, -2, 1, -2, bootEdge);
      boot.line(-2, toe + 1, 2, toe + 1, bootShadow);
      return;
    }
    const toe = rig.facing === 'west' ? -1 : rig.side ? 1 : side === 'left' ? 1 : -1;
    const heel = -toe * 2, tip = toe * 5;
    boot.shape([[heel, -3], [toe * 2, -3], [tip, 0], [tip, 2], [heel, 2]], bootOutline);
    boot.shape([[heel, -2], [toe * 2, -2], [toe * 4, 0], [toe * 4, 1], [heel, 1]],
      bootFill);
    boot.line(heel, -2, toe * 2, -2, bootEdge);
    boot.line(heel, 2, tip, 2, '#30302b');
  } else {
    const bare = partPainter(art, foot, rig.bones[`${side}Foot`].world.rotation);
    if (rig.pose.motion === 'walk' && !rig.side && !rig.crawling && rig.body.functional.leftLeg && rig.body.functional.rightLeg) {
      const toe = rig.back ? 1 : 3;
      bare.shape([[-2, -2], [2, -2], [2.5, toe], [1, toe + 1], [-2, toe + 1]], skin.skinShadow);
      bare.shape([[-1, -1], [1, -1], [1.5, toe], [-1, toe]], skin.skin);
      return;
    }
    bare.shape([[-2, -2], [2, -2], [4, 0], [3, 2], [-2, 2]], skin.skinShadow);
    bare.shape([[-1, -1], [2, -1], [3, 0], [2, 1], [-1, 1]], far ? skin.skinShadow : skin.skin);
  }
}

function drawArm(art: PixelCanvas, rig: HeroRig, side: HeroSide, loadout: ResolvedHeroLoadout, far: boolean) {
  if (!rig.body.present[`${side}Arm`]) return;
  const shoulder = rig.points[`${side}Shoulder`], elbow = rig.points[`${side}Elbow`], hand = rig.points[`${side}Hand`];
  const chestId = item(loadout, 'chest'), gloveId = item(loadout, 'gloves');
  const p = equipmentMaterial(chestId), skin = heroMaterial(rig.id);
  const armored = plate(chestId);
  const sleeve = chestId ? armored ? p.metal : p.cloth : '#656355';
  boneSegment(art, shoulder, elbow, armored ? 3.8 : 3.3, 2.7, far ? p.shadow : sleeve, p.shadow,
    far ? sleeve : chestId ? armored ? p.edge : p.fold : '#a69d81');
  boneSegment(art, elbow, hand, 2.7, 2, far ? skin.skinShadow : skin.skin, skin.skinShadow,
    far ? undefined : '#d3b895');
  if (chestId && !armored) {
    const cuff = between(elbow, hand, robe(chestId) ? 0.74 : 0.32);
    boneSegment(art, elbow, cuff, robe(chestId) ? 3.1 : 2.7, robe(chestId) ? 3.7 : 2.4,
      far ? p.shadow : p.cloth, p.shadow, far ? p.cloth : p.fold);
  }
  if (armored) {
    const s = partPainter(art, shoulder, rig.bones[`${side}Shoulder`].world.rotation);
    s.shape([[-4, -2], [-2, -4], [2, -4], [5, -1], [4, 3], [1, 5], [-4, 3]], p.shadow);
    s.shape([[-3, -2], [-1, -3], [2, -3], [4, -1], [3, 2], [0, 4], [-3, 2]], p.metal);
    if (!far) s.shape([[-3, -2], [-1, -3], [2, -3], [2, -1], [-2, 1]], p.edge);
    s.line(-2, 3, 2, 3, p.trim);
    const e = partPainter(art, elbow, rig.bones[`${side}Elbow`].world.rotation);
    e.shape([[-3, -1], [2, -2], [3, 1], [1, 3], [-2, 2]], p.metal);
    if (!far) e.line(-2, -1, 1, -1, p.edge);
  }
  if (gloveId) {
    const g = equipmentMaterial(gloveId), gauntlet = plate(gloveId);
    boneSegment(art, between(elbow, hand, 0.4), hand, 3, 2.3,
      far ? g.shadow : gauntlet ? g.metal : g.cloth, g.shadow, far ? g.metal : gauntlet ? g.edge : g.fold);
  }
}

/** Fingers are a separate foreground skin piece, closing over the shared grip or bow nock. */
function drawHand(art: PixelCanvas, rig: HeroRig, side: HeroSide, loadout: ResolvedHeroLoadout, far: boolean) {
  if (!rig.body.present[`${side}Arm`]) return;
  const hand = rig.points[`${side}Hand`], gloveId = item(loadout, 'gloves');
  if (gloveId) {
    const g = equipmentMaterial(gloveId), gauntlet = plate(gloveId);
    const accents = equipmentAccents(gloveId), themed = !!equipmentTheme(gloveId);
    const h = partPainter(art, hand, rig.bones[`${side}Hand`].world.rotation);
    h.rect(-2, -1, 4, 4, g.dark); h.rect(-1, -1, 3, 3, far ? themed && !gauntlet ? accents.leatherShadow : g.shadow : gauntlet ? g.metal : themed ? accents.leather : '#62564a');
    if (!far) h.line(-1, -1, 1, -1, gauntlet ? g.edge : themed ? accents.leatherEdge : '#99866b');
    if (equipmentStyle(gloveId) === 'grave-keeper') h.line(-1, 0, -1, 2, '#a0a18a');
  } else {
    const skin = heroMaterial(rig.id);
    const h = partPainter(art, hand, rig.bones[`${side}Hand`].world.rotation);
    h.rect(-1, -1, 3, 4, skin.skinShadow); if (!far) h.rect(-1, -1, 2, 3, skin.skin);
  }
  const ring = item(loadout, side === 'right' ? 'ring1' : 'ring2');
  if (ring && rig.body.functional[`${side}Arm`]) {
    const h = partPainter(art, hand, rig.bones[`${side}Hand`].world.rotation), p = equipmentMaterial(ring);
    h.line(-1, 1, 1, 1, far ? p.shadow : p.trim);
    if (!far) h.rect(0, 1, 1, 1, equipmentAccents(ring).gem);
  }
}

function drawHeroAmulet(art: PixelCanvas, rig: HeroRig, loadout: ResolvedHeroLoadout) {
  const id = item(loadout, 'amulet');
  if (!id || !rig.body.present.torso || rig.back) return;
  const d = torsoPainter(art, rig), p = equipmentMaterial(id);
  if (rig.side) { d.line(0, -3, 3, 1, p.trim); d.rect(2, 1, 2, 2, equipmentAccents(id).gem); }
  else {
    d.line(-3, -3, -1, 1, p.trim); d.line(3, -3, 1, 1, p.trim);
    d.shape([[0, 0], [2, 2], [0, 4], [-2, 2]], p.dark);
    d.shape([[0, 1], [1, 2], [0, 3], [-1, 2]], equipmentAccents(id).gem);
  }
}

/** Every prop belongs to one anatomical grip, including a shared two-handed weapon. */
function drawArmPass(art: PixelCanvas, rig: HeroRig, side: HeroSide, loadout: ResolvedHeroLoadout, far: boolean) {
  if (!rig.body.present[`${side}Arm`]) return;
  drawArm(art, rig, side, loadout, far);
  if (!rig.body.functional[`${side}Arm`]) return;
  for (const weapon of [rig.rightHandWeapon, rig.leftHandWeapon]) {
    if (weapon?.gripSide === side) drawHeroWeapon(art, rig, weapon);
  }

}

function drawHandPass(art: PixelCanvas, rig: HeroRig, side: HeroSide, loadout: ResolvedHeroLoadout, far: boolean) {
  const shieldFace = !rig.back && (!rig.side || side === rig.nearSide)
    && [rig.rightHandWeapon, rig.leftHandWeapon].some(weapon => weapon?.kind === 'shield' && weapon.gripSide === side);
  if (!shieldFace) drawHand(art, rig, side, loadout, far);
}

/** Front and rear views share a depth plane; fingers close over both props last. */
function drawPairedArms(art: PixelCanvas, rig: HeroRig, loadout: ResolvedHeroLoadout) {
  const near = rig.nearSide, far = near === 'left' ? 'right' : 'left';
  drawArmPass(art, rig, far, loadout, true);
  drawArmPass(art, rig, near, loadout, false);
  drawHandPass(art, rig, far, loadout, true);
  drawHandPass(art, rig, near, loadout, false);
}

/** Restore only the exposed far fingertips when the near prop crosses their contact. */
function drawExposedSupportHand(art: PixelCanvas, rig: HeroRig, loadout: ResolvedHeroLoadout, body: PixelCanvas) {
  const far = rig.nearSide === 'left' ? 'right' : 'left';
  const hand = new PixelCanvas(art.size);
  drawHandPass(hand, rig, far, loadout, true);
  const occluded = new Set(body.result().map(pixel => pixel.y * art.size + pixel.x));
  for (const pixel of hand.result()) {
    if (!occluded.has(pixel.y * art.size + pixel.x)) art.point(pixel.x, pixel.y, pixel.color);
  }
}

function drawTorso(art: PixelCanvas, rig: HeroRig, chestId?: string) {
  if (!rig.body.present.torso) return;
  const p = equipmentMaterial(chestId), skin = heroMaterial(rig.id);
  const d = torsoPainter(art, rig), armored = plate(chestId);
  const length = Math.hypot(rig.points.chest.x - rig.points.pelvis.x, rig.points.chest.y - rig.points.pelvis.y);
  const theme = equipmentTheme(chestId);
  const hem = Math.round(length), width = rig.side ? 6 : armored ? 8 : 7;
  const waist = rig.side ? 4 : 5, hips = rig.side ? 5 : 6;
  const fill = chestId ? armored ? p.metal : p.cloth : '#776d58';
  const highlight = chestId ? armored ? p.edge : p.fold : '#a39a7c';
  // Neck, collar and shoulders overlap into a continuous mass, with no black gap below the head.
  boneSegment(art, between(rig.points.head, rig.points.neck, 0.65), rig.points.chest,
    2.4, 3, skin.skin, skin.skinShadow, '#d3b895');
  d.shape([[-width, -3], [-4, -5], [4, -5], [width, -3], [width, 1],
    [waist + 1, 6], [waist, hem - 2], [hips, hem + 3], [-hips, hem + 3],
    [-waist, hem - 2], [-waist - 1, 6], [-width, 1]], p.shadow);
  d.shape([[-width + 1, -3], [-3, -4], [3, -4], [width - 1, -2], [width - 1, 1],
    [waist, 6], [waist, hem], [hips - 1, hem + 2], [-hips + 1, hem + 2],
    [-waist, hem], [-waist, 6], [-width + 1, 1]], fill);
  d.shape([[-width + 1, -2], [-3, -3], [-1, 1], [-2, 5], [-waist, 7],
    [-width + 1, 1]], highlight);
  d.shape([[2, -3], [width - 1, -2], [width - 1, 2], [waist, 7], [waist, hem],
    [2, hem - 1], [3, 5]], p.shadow);
  d.shape([[-waist, 7], [-2, 5], [0, 7], [-1, hem], [-waist + 1, hem + 1]], fill);
  if (armored) {
    d.shape([[-5, -4], [-2, -5], [2, -5], [5, -4], [3, -1], [-3, -1]], p.metal);
    d.shape([[-4, -4], [-2, -4], [-1, -2], [-3, -2]], p.edge);
    // Curved breastplate and broad overlapping waist plates share the same material planes.
    d.shape([[-width + 2, 0], [-1, -1], [1, 3], [-1, 5], [-width + 3, 4]], rig.back ? p.metal : p.edge);
    d.shape([[0, -1], [width - 2, 0], [width - 3, 4], [1, 5]], p.metal);
    d.line(-waist, 6, waist, 6, p.shadow);
    d.shape([[-waist, 7], [waist, 7], [waist - 1, hem], [-waist + 1, hem]], p.metal);
    d.shape([[-waist, 7], [-1, 7], [-2, hem], [-waist + 1, hem]], p.edge);
    if (equipmentStyle(chestId) === 'dawn-forged' && !rig.back) {
      d.rect(-1, -1, 2, 6, p.trim); d.rect(-3, 1, 6, 2, p.trim);
      d.rect(-1, 1, 2, 2, '#e2d5a0');
    } else if (!rig.back) {
      d.shape([[-1, 0], [2, 1], [1, 4], [-1, 3]], p.trim);
    }
  } else {
    d.shape([[-5, -4], [-2, -5], [0, -2], [3, -5], [5, -3], [1, 1], [-2, 0]],
      chestId ? p.fold : '#a69b7f');
    d.shape([[-1, 1], [2, 3], [1, hem - 2], [-2, hem - 1]], p.shadow);
    if (equipmentStyle(chestId) === 'night-stalker' || equipmentStyle(chestId) === 'greenwood' || equipmentStyle(chestId) === 'crimson-oath') {
      d.shape([[-width + 1, -2], [-width + 4, -3], [waist, hem - 3],
        [waist - 2, hem - 1]], '#584735');
      d.line(-width + 2, -2, waist - 1, hem - 2, '#b09569');
      if (!rig.back) { d.rect(0, 3, 3, 3, p.trim); d.rect(1, 4, 1, 1, '#584735'); }
      if (equipmentStyle(chestId) === 'night-stalker') {
        d.shape([[-width + 1, -3], [-3, -2], [-4, 2], [-width, 3]], p.fold);
        d.shape([[3, -2], [width, -2], [width - 1, 3], [4, 2]], p.shadow);
      }
      if (equipmentStyle(chestId) === 'greenwood') {
        d.shape([[-width - 1, -3], [-3, -5], [-1, -1], [-3, 3], [-width, 2]], p.fold);
        d.shape([[2, -4], [width, -2], [width + 1, 2], [4, 3], [1, -1]], p.cloth);
        d.line(-width + 1, 1, -4, 2, p.trim);
        d.shape([[-5, -5], [-1, -4], [4, -5], [5, -2], [2, 0], [-4, -1], [-6, -3]], '#713c4b');
        d.shape([[-5, -4], [-1, -3], [3, -4], [3, -2], [-3, -2]], '#a6636b');
        d.shape([[3, -2], [5, -2], [5, 4], [3, 6], [2, 2]], '#864857');
      }
      if (equipmentStyle(chestId) === 'crimson-oath') {
        d.shape([[-width, -3], [-4, -6], [-1, -1], [-3, 4], [-5, 1]], '#a65a6c');
        d.shape([[width, -3], [4, -6], [1, -1], [3, 4], [5, 1]], '#713348');
      }
    }
    if (equipmentStyle(chestId) === 'wildwood') {
      d.shape([[-width - 1, -2], [-5, -5], [-1, -3], [-3, 3], [-6, 4], [-width, 2]], '#7f975a');
      d.shape([[-5, -4], [-2, -3], [-4, 2], [-7, 1]], '#b2b981');
      d.shape([[1, -3], [5, -5], [width + 1, -1], [width, 3], [4, 4]], '#627b45');
      d.line(4, -3, 5, 2, '#91a462');
      d.shape([[-1, 0], [2, -1], [3, 2], [1, 5], [-1, 3]], '#9eaa6e');
    }
    if (equipmentStyle(chestId) === 'grave-keeper') {
      d.shape([[-width, -2], [-4, -4], [-1, -2], [-2, 1], [-6, 1]], '#b6b6a0');
      d.shape([[1, -2], [4, -4], [width, -2], [6, 1], [2, 1]], '#898f7f');
      d.shape([[-2, 0], [1, -1], [3, 1], [2, 4], [-1, 5], [-3, 2]], '#b8b9a2');
      d.rect(-1, 1, 1, 2, '#586860'); d.rect(1, 1, 1, 2, '#586860');
      d.shape([[-4, 3], [-2, 4], [-1, 7], [-4, 6]], p.fold);
    }
    if (equipmentStyle(chestId) === 'ivory-pilgrim') {
      d.shape([[-width, -3], [-3, -5], [0, -2], [-3, 2], [-width, 1]], p.fold);
      d.shape([[-3, -3], [-1, 0], [-1, hem + 2], [-4, hem + 2]], '#57765a');
      d.shape([[2, -3], [4, -2], [4, hem + 2], [1, hem + 2], [1, 0]], '#6d8867');
      if (!rig.back) { d.rect(-1, 1, 2, 5, '#c7b580'); d.rect(-2, 2, 4, 2, '#dacc9f'); }
    }
    if (equipmentStyle(chestId) === 'ash-weaver') {
      d.shape([[-width, -2], [-3, -4], [2, 3], [-1, 6], [-4, 0]], p.fold);
      d.shape([[3, -3], [width, -2], [3, 5], [0, 7], [-1, 4]], p.cloth);
      d.line(-3, -3, 1, 3, p.trim);
    }
  }
  if (theme) {
    const emboss = theme.variant % 4;
    if (emboss === 0) d.line(-width + 2, 0, -waist + 1, hem - 4, p.trim);
    if (emboss === 1) { d.line(-4, 5, 4, 5, p.trim); d.line(-4, 7, 4, 7, p.trim); }
    if (emboss === 2) { d.shape([[-4, 0], [-2, 1], [-3, 4], [-5, 3]], p.metal); d.shape([[4, 0], [2, 1], [3, 4], [5, 3]], p.metal); }
    if (!rig.back && !rig.side) drawEquipmentMotif(d, chestId, 0, 2, 2);
  }
  // A full-width belt and hip panels join torso and thighs into one silhouette.
  d.shape([[-waist - 1, hem - 3], [waist + 1, hem - 3], [waist + 1, hem],
    [-waist - 1, hem]], '#4d3d31');
  d.line(-waist, hem - 3, waist, hem - 3, '#a58d65');
  if (!rig.back) {
    d.rect(-2, hem - 3, 4, 3, p.trim); d.rect(-1, hem - 2, 2, 1, '#594837');
    if (!armored) {
      d.shape([[waist - 1, hem - 1], [waist + 2, hem - 1], [waist + 2, hem + 3], [waist - 1, hem + 3]], '#80694b');
      d.line(waist - 1, hem, waist + 1, hem, '#b19a6f');
    }
  }
  if (chestId) {
    const long = rig.body.present.leftLeg && rig.body.present.rightLeg && !rig.crawling;
    const skirt = long ? (robe(chestId) ? 12 : equipmentStyle(chestId) === 'crimson-oath' ? 9 : armored ? 7 : 4) - (theme ? theme.variant % 3 : 0) : 2;
    const skirtWidth = armored ? 3 : hips;
    d.shape([[-skirtWidth, hem], [skirtWidth, hem], [skirtWidth + 1, hem + skirt - 1],
      [1, hem + skirt], [0, hem + skirt - 4], [-2, hem + skirt],
      [-skirtWidth - 1, hem + skirt - 1]], p.shadow);
    d.shape([[-skirtWidth + 1, hem], [-1, hem], [-1, hem + skirt - 3], [-2, hem + skirt - 1],
      [-skirtWidth, hem + skirt - 1]], p.fold);
    d.shape([[0, hem], [skirtWidth - 1, hem], [skirtWidth, hem + skirt - 2],
      [2, hem + skirt - 1], [1, hem + 3]], p.cloth);
    if (long) {
      d.shape([[-3, hem + 3], [-1, hem + 1], [-1, hem + skirt - 3], [-3, hem + skirt - 1]], p.cloth);
      if (equipmentStyle(chestId) === 'ivory-pilgrim' || equipmentStyle(chestId) === 'ash-weaver' || equipmentStyle(chestId) === 'dawn-forged') {
        d.line(-skirtWidth, hem + skirt - 2, -2, hem + skirt - 2, p.trim);
      }
    }
    if (armored) {
      d.shape([[-hips, hem], [-3, hem], [-3, hem + 4], [-hips - 1, hem + 3]], p.metal);
      d.shape([[3, hem], [hips, hem], [hips + 1, hem + 3], [3, hem + 4]], p.shadow);
      d.line(-hips, hem + 1, -3, hem + 1, p.edge);
    }
  }
}

function drawHead(art: PixelCanvas, rig: HeroRig, headId?: string) {
  if (!rig.body.present.head) return;
  if (rig.side) { drawHeroHeadProfile(art, rig, headId); return; }
  const skin = heroMaterial(rig.id), gear = equipmentMaterial(headId);
  const d = partPainter(art, rig.points.head, rig.bones.head.world.rotation);
  const armored = plate(headId), hood = !!headId && !armored && equipmentStyle(headId) !== 'wildwood';
  // Width, not height, gives the face room to read without returning to a chibi head.
  if (armored || hood) {
    d.shape([[-6, -3], [-4, -6], [1, -7], [5, -4], [6, 0], [5, 6], [2, 7], [-5, 6]], gear.shadow);
    d.shape([[-5, -3], [-3, -5], [1, -6], [4, -4], [5, 0], [4, 5], [-4, 5]], armored ? gear.metal : gear.cloth);
    d.shape([[-5, -2], [-4, -4], [-2, -5], [0, -5], [-2, -2], [-3, 3], [-5, 4]], armored ? gear.edge : gear.fold);
  }
  if (rig.back) {
    if (!headId || equipmentStyle(headId) === 'wildwood') {
      d.rect(-2, 3, 4, 4, skin.skinShadow);
      d.shape([[-5, -2], [-4, -4], [-2, -5], [2, -5], [4, -4], [5, -2],
        [5, 2], [3, 4], [-3, 4], [-5, 2]], skin.dark);
      d.shape([[-4, -2], [-3, -3], [-2, -4], [2, -4], [4, -2], [4, 2],
        [2, 3], [-2, 3], [-4, 2]], skin.hair);
      d.line(-3, 0, -3, 2, skin.dark); d.line(2, 2, 3, 1, skin.dark);
      if (rig.id === 'priest' || rig.id === 'vampire') {
        d.shape([[-5, 0], [-3, 1], [-3, 6], [-5, 7], [-5, 4]], skin.hair);
        d.shape([[3, 1], [5, 0], [5, 6], [3, 7]], skin.hair);
      }
    } else {
      d.shape([[-3, -3], [0, -5], [2, -2], [1, 4], [-2, 5]], armored ? gear.metal : gear.fold);
      d.shape([[2, -3], [4, -2], [5, 2], [3, 5], [1, 4]], gear.shadow);
      if (armored) { d.line(-4, 3, 4, 3, gear.shadow); d.line(-3, 4, 3, 4, gear.edge); }
    }
  } else {
    d.shape([[-4, -2], [-2, -4], [2, -4], [4, -2], [4, 2],
      [3, 4], [2, 5], [-2, 5], [-3, 4], [-4, 2]], skin.skinShadow);
    d.shape([[-3, -2], [-2, -3], [2, -3], [3, -2], [3, 2], [2, 4],
      [-2, 4], [-3, 2]], skin.skin);
    d.shape([[-3, -2], [0, -3], [1, 0], [-1, 2], [-3, 1]], '#e4bd95');
    d.shape([[3, 0], [4, 1], [3, 3], [1, 4], [1, 2]], skin.skinShadow);
    d.line(-3, -1, -1, -1, skin.hair); d.line(1, -1, 3, -1, skin.hair);
    d.rect(-2, -1, 1, 2, rig.id === 'vampire' ? '#773941' : '#2a342b');
    d.rect(2, -1, 1, 2, rig.id === 'necromancer' ? '#48685b' : '#2a342b');
    d.line(0, 0, 0, 1, '#f0cba6'); d.line(-1, 3, 1, 3, '#a27460');
    if (!armored) {
      d.shape([[-5, -2], [-4, -4], [-2, -5], [2, -5], [4, -4], [5, -2],
        [5, 2], [4, 2], [3, -2], [1, -3], [-1, -2], [-3, -2], [-4, 2], [-5, 2]], skin.dark);
      d.shape([[-4, -3], [-2, -4], [2, -4], [3, -3], [1, -2], [0, -3],
        [-3, -2], [-4, 1]], skin.hair);
      d.line(4, -2, 4, 1, skin.hair);
      if (rig.id === 'priest' || rig.id === 'vampire') {
        d.shape([[-5, 0], [-3, 2], [-3, 7], [-5, 6]], skin.hair);
        d.shape([[4, 1], [5, 0], [5, 6], [3, 5]], skin.hair);
      }
    }
    if (['guardian', 'paladin', 'druid', 'mage'].includes(rig.id)) {
      d.shape([[-3, 2], [-1, 3], [1, 3], [3, 2], [3, 4], [1, 5], [-1, 5], [-3, 4]], skin.hair);
      d.line(-1, 3, 1, 3, skin.skinShadow);
      if (rig.id === 'druid' || rig.id === 'mage') d.line(-1, 5, 1, 5, skin.skinShadow);
    }
  }
  if (armored) {
    d.shape([[-6, -3], [-4, -6], [2, -6], [5, -3], [4, -1], [-4, -1]], gear.shadow);
    d.shape([[-5, -3], [-3, -5], [1, -5], [4, -3], [3, -2], [-4, -2]], gear.metal);
    d.shape([[-4, -3], [-2, -5], [0, -5], [1, -2], [-3, -2]], gear.edge);
    d.line(-4, -1, 4, -1, gear.shadow);
    d.shape([[-5, -1], [-4, -1], [-3, 4], [-5, 5]], gear.metal);
    d.shape([[4, -1], [5, -1], [5, 4], [3, 4]], gear.shadow);
    d.line(-5, 0, -4, 3, gear.edge);
    if (equipmentStyle(headId) === 'dawn-forged') {
      d.rect(0, -6, 2, 4, gear.trim); d.point(0, -5, '#e2d5a0');
      d.line(-4, -2, 4, -2, gear.trim);
    }
  } else if (hood) {
    d.shape([[-6, -1], [-5, -3], [-4, -2], [-4, 3], [-3, 6], [-5, 6]], gear.fold);
    d.shape([[4, -3], [6, -1], [5, 5], [3, 6], [4, 2]], gear.cloth);
    d.shape([[-5, -4], [-3, -6], [1, -6], [4, -4], [2, -4], [0, -5], [-3, -4]], gear.fold);
    if (equipmentStyle(headId) === 'night-stalker' && !rig.back) {
      d.shape([[-4, 3], [-1, 4], [3, 3], [3, 6], [-3, 6]], gear.cloth);
      d.line(-3, 3, 1, 4, gear.fold);
    }
    if (equipmentStyle(headId) === 'ivory-pilgrim') {
      d.shape([[-6, 1], [-4, 3], [-4, 7], [-6, 5]], '#c7c5a6');
      d.shape([[4, 3], [6, 1], [6, 5], [4, 7]], '#969b7d');
    }
  }
  if (equipmentStyle(headId) === 'wildwood') {
    d.line(-4, -3, 4, -3, '#788057'); d.rect(-1, -3, 2, 2, '#c0b77d');
    for (const sign of [-1, 1]) {
      d.line(sign * 4, -3, sign * 6, -7, '#a69a70', 2);
      d.line(sign * 6, -7, sign * 5, -10, '#c7b78c');
      d.line(sign * 6, -7, sign * 8, -8, '#958963');
      d.line(sign * 5, -5, sign * 8, -5, '#a69a70');
    }
    d.shape([[-5, -4], [-3, -5], [-2, -3], [-4, -2]], '#9aaf69');
  }
  const theme = equipmentTheme(headId);
  if (theme) {
    if (armored && theme.variant % 3 === 0) { d.shape([[-4, -5], [-3, -8], [-1, -5]], gear.metal); d.shape([[1, -5], [3, -8], [4, -5]], gear.shadow); }
    if (theme.variant % 3 === 1) d.line(-3, -5, 3, -5, gear.trim);
    if (!rig.back) d.rect(0, -5, 1, 2, equipmentAccents(headId).gem);
  }
}

/** One composed skin, assembled from the same articulated joints in every view. */
export function drawHeroParts(art: PixelCanvas, rig: HeroRig, loadout: ResolvedHeroLoadout): void {
  const near = rig.nearSide, far = near === 'left' ? 'right' : 'left';
  const chestId = item(loadout, 'chest');
  if (!rig.back) {
    drawCloak(art, rig, chestId);
  }
  drawLeg(art, rig, far, loadout, true);
  if (rig.side) {
    drawArmPass(art, rig, far, loadout, true);
    drawHandPass(art, rig, far, loadout, true);
  }
  drawLeg(art, rig, near, loadout, false);
  if (rig.back) {
    drawPairedArms(art, rig, loadout);
    // The rear-facing cape covers the chest-side grips and lower blade as well
    // as the torso, while exposed elbows and weapon tips remain outside it.
    drawCloak(art, rig, chestId);
    drawTorso(art, rig, chestId);
    drawHead(art, rig, item(loadout, 'head'));
    return;
  }
  const nearSharedWeapon = rig.side && [rig.rightHandWeapon, rig.leftHandWeapon]
    .some(weapon => weapon?.twoHanded && weapon.gripSide === near);
  const body = nearSharedWeapon ? new PixelCanvas(art.size) : art;
  drawTorso(body, rig, chestId);
  drawHeroAmulet(body, rig, loadout);
  drawHead(body, rig, item(loadout, 'head'));
  if (body !== art) for (const pixel of body.result()) art.point(pixel.x, pixel.y, pixel.color);
  if (rig.side) {
    drawArmPass(art, rig, near, loadout, false);
    drawHandPass(art, rig, near, loadout, false);
    if (nearSharedWeapon) drawExposedSupportHand(art, rig, loadout, body);
  } else drawPairedArms(art, rig, loadout);
}
