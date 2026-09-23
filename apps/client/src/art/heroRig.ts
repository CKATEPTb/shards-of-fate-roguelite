import type { HeroBody } from '@shards/shared';
import { heroAppearance } from './heroAppearance';
import { heroWalkStep } from './heroGait';
import { unitPose, type UnitFacing, type UnitMotion } from './unitPose';
import { heroVisualItem, resolveHeroVisualLoadout, type HeroVisualLoadout } from './heroLoadout';
import { containWeapon, poseTrack, weaponPoint, weaponStance } from './heroWeaponPose';
import { HERO_FOOT_Y, type HeroBone, type HeroJoint, type HeroRig, type HeroSide, type HeroSocket, type HeroWeaponPose, type RigPoint } from './heroRigTypes';

export { HERO_FRAME_SIZE, HERO_FOOT_Y } from './heroRigTypes';
export type { HeroRig, HeroSocketName } from './heroRigTypes';

const parent: Record<HeroJoint, HeroJoint | null> = {
  root: null, pelvis: 'root', chest: 'pelvis', neck: 'chest', head: 'neck',
  leftShoulder: 'chest', leftElbow: 'leftShoulder', leftHand: 'leftElbow',
  rightShoulder: 'chest', rightElbow: 'rightShoulder', rightHand: 'rightElbow',
  leftHip: 'pelvis', leftKnee: 'leftHip', leftFoot: 'leftKnee',
  rightHip: 'pelvis', rightKnee: 'rightHip', rightFoot: 'rightKnee',
};
const sides: HeroSide[] = ['left', 'right'];
const point = (x: number, y: number): RigPoint => ({ x, y });

/** Translate the whole prop into both arms' reach before solving either elbow. */
function fitWeapon(weapon: HeroWeaponPose, points: Record<HeroJoint, RigPoint>) {
  const contacts = [{ side: weapon.gripSide, local: { x: 0, y: 0 } }];
  if (weapon.twoHanded && weapon.supportGrip) contacts.push({
    side: weapon.gripSide === 'left' ? 'right' : 'left', local: weapon.supportGrip,
  });
  for (let pass = 0; pass < 12; pass++) {
    const previousX = weapon.origin.x, previousY = weapon.origin.y;
    for (const contact of contacts) {
      const shoulder = points[`${contact.side}Shoulder`];
      const target = weaponPoint(weapon, contact.local.x, contact.local.y);
      const dx = target.x - shoulder.x, dy = target.y - shoulder.y, distance = Math.hypot(dx, dy);
      if (distance > 15) {
        weapon.origin.x -= dx * (1 - 15 / distance);
        weapon.origin.y -= dy * (1 - 15 / distance);
      }
    }
    containWeapon(weapon);
    if (Math.abs(weapon.origin.x - previousX) + Math.abs(weapon.origin.y - previousY) < 0.001) break;
  }
  if (weapon.kind === 'bow' && weapon.supportGrip) weapon.stringPoint = weaponPoint(weapon, weapon.supportGrip.x, weapon.supportGrip.y);
}

/** Two rigid bones bend at one joint; target clamping prevents stretching arms. */
function limb(start: RigPoint, target: RigPoint, upper: number, lower: number, bend: number) {
  const dx = target.x - start.x, dy = target.y - start.y;
  const distance = Math.hypot(dx, dy) || 0.01;
  const reach = Math.max(Math.abs(upper - lower) + 0.01, Math.min(upper + lower - 0.01, distance));
  const axis = Math.atan2(dy, dx);
  const angle = Math.acos(Math.max(-1, Math.min(1, (upper * upper + reach * reach - lower * lower) / (2 * upper * reach))));
  return {
    joint: point(start.x + Math.cos(axis + bend * angle) * upper, start.y + Math.sin(axis + bend * angle) * upper),
    end: point(start.x + Math.cos(axis) * reach, start.y + Math.sin(axis) * reach),
  };
}

/** Resolve parent-relative bones once; all skin layers and effect sockets share this pose. */
function bonesFromPoints(points: Record<HeroJoint, RigPoint>, angles: Partial<Record<HeroJoint, number>>) {
  const bones = {} as Record<HeroJoint, HeroBone>;
  for (const name of Object.keys(parent) as HeroJoint[]) {
    const ancestor = parent[name];
    const base = ancestor ? bones[ancestor].world : { x: 0, y: 0, rotation: 0 };
    const target = points[name];
    const dx = target.x - base.x, dy = target.y - base.y;
    const cos = Math.cos(base.rotation), sin = Math.sin(base.rotation);
    const x = dx * cos + dy * sin, y = -dx * sin + dy * cos;
    const rotation = (angles[name] ?? 0) - base.rotation;
    const world = { x: base.x + x * cos - y * sin, y: base.y + x * sin + y * cos, rotation: base.rotation + rotation };
    bones[name] = { parent: ancestor, x, y, rotation, world };
    points[name] = { x: Math.round(world.x), y: Math.round(world.y) };
  }
  return bones;
}

export function getHeroRig(id: string, facing: UnitFacing, motion: UnitMotion, frame: number, body?: HeroBody, equipment?: HeroVisualLoadout): HeroRig {
  const appearance = heroAppearance(body);
  const hasArms = appearance.functional.leftArm || appearance.functional.rightArm;
  const hasLegs = appearance.functional.leftLeg || appearance.functional.rightLeg;
  if ((motion === 'walk' || motion === 'dodge') && !hasLegs && !hasArms
    || motion === 'attack' && !appearance.functional.rightArm
    || motion === 'attackLeft' && !appearance.functional.leftArm
    || (motion === 'cast' || motion === 'block' || motion === 'shieldBlock') && !hasArms) motion = 'idle';
  const pose = unitPose(motion, frame);
  const loadout = resolveHeroVisualLoadout({ id, sprite: id, role: 'damage' }, equipment);
  const rightItem = heroVisualItem(loadout.rightHand, 'rightHand');
  const leftItem = heroVisualItem(loadout.leftHand, 'leftHand');
  const bothArms = appearance.functional.leftArm && appearance.functional.rightArm;
  const usable = (item: typeof rightItem, hand: HeroSide) => !!item?.weaponKind
    && appearance.functional[`${hand}Arm`] && (item.hands === 1 || bothArms);
  const hasRightWeapon = usable(rightItem, 'right'), hasLeftWeapon = usable(leftItem, 'left');
  const attackingLeft = motion === 'attackLeft' && hasLeftWeapon && leftItem?.weaponKind !== 'shield';
  const attackingRight = motion === 'attack' && hasRightWeapon && rightItem?.weaponKind !== 'shield';
  const attacking = attackingRight || attackingLeft;
  const strikingItem = attackingLeft ? leftItem : attackingRight ? rightItem
    : hasRightWeapon && rightItem?.hands === 2 ? rightItem : hasLeftWeapon && leftItem?.hands === 2 ? leftItem : undefined;
  const side = facing === 'east' || facing === 'west';
  const back = facing === 'north';
  const west = facing === 'west';
  const crawling = !hasLegs;
  const oneLeg = appearance.functional.leftLeg !== appearance.functional.rightLeg;
  const injured = Math.max(appearance.leftLegInjury, appearance.rightLegInjury);
  const walking = motion === 'walk';
  const stride = id === 'guardian' || id === 'paladin' ? 0.8 : 0.9;
  const phase = walking ? pose.step * stride : 0;
  const weightShift = walking && !oneLeg && !crawling && !side ? -pose.sway * 0.7 * (back ? -1 : 1) : 0;
  const lean = oneLeg ? (appearance.functional.leftLeg ? 1 : -1) * (back ? -2 : 2)
    : injured && walking ? phase * (appearance.leftLegInjury - appearance.rightLegInjury) * 0.45 : 0;
  const dodging = motion === 'dodge' ? poseTrack(pose.progress, [0, 0.75, 1, 0.55, 0]) : 0;
  const guarding = motion === 'block' || motion === 'shieldBlock' ? poseTrack(pose.progress, [0, 0.85, 1, 0.7, 0]) : 0;
  const heavy = strikingItem?.hands === 2 && strikingItem.weaponKind !== 'bow' && strikingItem.weaponKind !== 'staff';
  const striking = attacking ? poseTrack(pose.progress, [0, -0.6, -0.2, 1, 0]) : 0;
  const bob = pose.breath - (oneLeg ? 0 : pose.lift) + (injured && walking ? 1 : 0)
    + (crawling ? 0 : dodging * 3 + guarding * 1.5 + (heavy ? Math.max(0, striking) * 1.5 : 0));
  const cx = 32 + pose.recoil * 1.5 + lean + weightShift * 0.35 - dodging * (side ? 5 : 4)
    + striking * (heavy ? 2.5 : 1.5) * (attackingLeft && !side ? -1 : 1);
  const broad = id === 'paladin' ? 8.5 : id === 'guardian' ? 8 : id === 'rogue' || id === 'ranger' || id === 'priest' ? 6.5 : 7;
  const points = {} as Record<HeroJoint, RigPoint>;
  points.root = point(32, HERO_FOOT_Y);
  points.pelvis = point(32 + lean + weightShift - dodging * 1.5 + (crawling && side ? -7 : 0), crawling ? 49 : 35 + bob);
  points.chest = point(cx + (crawling && side ? 3 : 0), (crawling ? 43 : 25) + bob);
  points.neck = point(cx + (crawling && side ? 9 : 0), (crawling ? 41 : 20) + bob);
  points.head = point(cx + (crawling && side ? 12 : 0), (crawling ? 36 : 14) + bob);
  const angles: Partial<Record<HeroJoint, number>> = {};
  const nearSide: HeroSide = west ? 'left' : 'right';
  // Both anatomical slots use the same pose rules. Only the striking hand attacks;
  // the other weapon stays in guard. A two-handed prop solves both arm contacts.
  const poseForHand = (which: HeroSide, item: typeof rightItem) => {
    const ownsStrike = which === 'right' ? attackingRight : attackingLeft;
    if (motion === 'attack' || motion === 'attackLeft') {
      return ownsStrike ? pose : { ...pose, motion: attacking && item?.weaponKind !== 'shield' ? 'block' as const : 'idle' as const };
    }
    return item?.weaponKind === 'shield' && motion === 'cast' ? { ...pose, motion: 'idle' as const } : pose;
  };
  const heldRight = rightItem?.weaponKind && hasRightWeapon
    ? weaponStance(rightItem.appearanceId, rightItem.weaponKind, poseForHand('right', rightItem),
      cx, bob, side, back, bothArms && !crawling, broad, 'right', nearSide, attackingLeft ? 0.32 : 1) : undefined;
  const heldLeft = leftItem?.weaponKind && hasLeftWeapon
    ? weaponStance(leftItem.appearanceId, leftItem.weaponKind, poseForHand('left', leftItem),
      cx, bob, side, back, bothArms && !crawling, broad, 'left', nearSide, attackingRight ? 0.32 : 1) : undefined;
  const sharedWeapon = heldRight?.twoHanded ? heldRight : heldLeft?.twoHanded ? heldLeft : undefined;
  for (const which of sides) {
    const sign = (which === 'left' ? 1 : -1) * (back ? -1 : 1);
    points[`${which}Shoulder`] = point(points.chest.x + sign * (side ? 2.5 : broad), points.chest.y - 3 + (side && which === nearSide ? 1 : 0));
  }
  if (!crawling) {
    if (heldRight) fitWeapon(heldRight, points);
    if (heldLeft) fitWeapon(heldLeft, points);
  }
  for (const which of sides) {
    const sign = (which === 'left' ? 1 : -1) * (back ? -1 : 1);
    const step = heroWalkStep(pose, which);
    const armFunctional = appearance.functional[`${which}Arm`];
    const legFunctional = appearance.functional[`${which}Leg`];
    const advance = legFunctional ? step.forward * 2 * stride * (1 - appearance[`${which}LegInjury`] * 0.3) : 0;
    const shoulder = points[`${which}Shoulder`];
    const swing = walking && armFunctional ? (crawling ? -step.forward * 2 * stride : -advance) * 1.4 : 0;
    const active = (attackingRight && which === 'right') || (attackingLeft && which === 'left');
    const casting = motion === 'cast' && armFunctional;
    let hand: RigPoint;
    const handWeapon = which === 'right' ? heldRight : heldLeft;
    if (!armFunctional) {
      // An attached disabled arm hangs with the torso, without gripping or reaching.
      hand = point(shoulder.x + (side ? -2 : sign), shoulder.y + 14);
    } else if (handWeapon && !crawling) {
      hand = handWeapon.origin;
    } else if (sharedWeapon?.supportGrip && !crawling) {
      hand = weaponPoint(sharedWeapon, sharedWeapon.supportGrip.x, sharedWeapon.supportGrip.y);
    } else if (crawling) {
      hand = point(side ? cx + 13 + swing : cx + sign * (10 + phase), back ? 40 + phase : 54 - Math.max(0, swing));
    } else if (guarding) {
      hand = point(shoulder.x + sign * 2, 34 + bob - guarding * 10);
    } else if (side) {
      hand = point(shoulder.x + swing + (active || casting ? Math.max(0, pose.reach) * 2.1 : 2), 36 + bob - (active || casting ? Math.max(0, pose.reach) * 3 : 0));
    } else {
      hand = point(cx + sign * (broad + 1.5 + (active || casting ? Math.max(0, pose.reach) * 1.7 : 0)), 36 + bob + swing * 0.4 * (back ? -1 : 1) - (active || casting ? Math.max(0, pose.reach) * 2 : 0));
    }
    const armPose = limb(shoulder, hand, 8, 7.5, side ? 1 : -sign);
    points[`${which}Elbow`] = armPose.joint;
    points[`${which}Hand`] = armPose.end;
    angles[`${which}Shoulder`] = Math.atan2(armPose.joint.y - shoulder.y, armPose.joint.x - shoulder.x) - Math.PI / 2;
    angles[`${which}Elbow`] = Math.atan2(armPose.end.y - armPose.joint.y, armPose.end.x - armPose.joint.x) - Math.PI / 2;
    const attackAngle = poseTrack(pose.progress, [-0.35, -0.8, 1.15, 0.65, 0]);
    angles[`${which}Hand`] = !armFunctional ? 0.12 * sign : crawling ? -0.9 : handWeapon ? handWeapon.origin.rotation : sharedWeapon ? sharedWeapon.origin.rotation
      : active ? attackAngle : casting ? -0.25 : which === 'left' ? -0.15 : 0;
    const hip = point(points.pelvis.x + sign * (side ? 2 : 3.5), points.pelvis.y);
    const walkingLeg = walking && legFunctional && !oneLeg && !crawling;
    const foot = crawling ? point(side ? hip.x - 16 : hip.x + sign * 10, 55 + (sign < 0 ? 0 : 1))
      : !legFunctional ? point(hip.x + (side ? -4 : sign * 3), 54)
      : point(oneLeg ? 32 : 32 + (side ? sign * 2 + advance * 2.5 : sign * (walkingLeg ? 4.2 : 5))
      - dodging * (sign < 0 ? 4 : 0),
      55 + (walkingLeg && !side ? advance * 1.25 * (back ? -1 : 1) : 0) - (walkingLeg ? step.lift * 1.3 : 0));
    // A standing knee stays nearly straight; spare length is visible as a bend
    // only when the walking foot lifts instead of making every idle pose bow-legged.
    // In front/rear views the knee bends in depth. A side-view IK solution
    // projected directly into this plane used to kick both knees out sideways.
    const legPose = walkingLeg && !side ? {
      joint: point(hip.x * 0.52 + foot.x * 0.48,
        hip.y + (foot.y - hip.y) * 0.51 - step.lift * 0.65),
      end: foot,
    } : limb(hip, foot, 10, 10.1, side ? -1 : -sign);
    points[`${which}Hip`] = hip;
    points[`${which}Knee`] = legPose.joint;
    points[`${which}Foot`] = legPose.end;
    angles[`${which}Hip`] = Math.atan2(legPose.joint.y - hip.y, legPose.joint.x - hip.x) - Math.PI / 2;
    angles[`${which}Knee`] = Math.atan2(legPose.end.y - legPose.joint.y, legPose.end.x - legPose.joint.x) - Math.PI / 2;
    if (walkingLeg && side) angles[`${which}Foot`] = -step.heel * 0.16 + step.lift * 0.1;
  }
  if (west) {
    for (const joint of Object.keys(points) as HeroJoint[]) {
      points[joint].x = 63 - points[joint].x;
      if (angles[joint] !== undefined) angles[joint] = -angles[joint]!;
    }
  }
  // Death bends the whole articulated hierarchy around a moving hip pivot.
  // Skin is drawn on the fallen pose instead of stretching a finished bitmap.
  if (motion === 'death') {
    const progress = pose.progress;
    const direction = west ? -1 : 1;
    const rotation = progress * Math.PI / 2 * direction;
    const cosine = Math.cos(rotation), sine = Math.sin(rotation);
    for (const joint of Object.keys(points) as HeroJoint[]) {
      if (joint === 'root') continue;
      const x = points[joint].x - 32, y = points[joint].y - 36;
      points[joint] = point(32 - progress * 10 * direction + x * cosine - y * sine * 0.82,
        36 + progress * 14 + x * sine * 0.65 + y * cosine * (1 - progress * 0.1));
      angles[joint] = (angles[joint] ?? 0) + rotation;
    }
  }
  // Settle the support grip against the final prop transform in either hand,
  // including west-facing and fallen poses.
  if (sharedWeapon?.supportGrip) {
    const grip = `${sharedWeapon.gripSide}Hand` as HeroJoint;
    const support = sharedWeapon.gripSide === 'right' ? 'left' : 'right';
    const shoulder = points[`${support}Shoulder`];
    const finalWeapon = { origin: { ...points[grip], rotation: angles[grip] ?? 0 },
      mirror: (sharedWeapon.mirror * (west ? -1 : 1)) as 1 | -1, widthScale: sharedWeapon.widthScale, lengthScale: sharedWeapon.lengthScale };
    const target = weaponPoint(finalWeapon, sharedWeapon.supportGrip.x, sharedWeapon.supportGrip.y);
    const bend = (side ? sharedWeapon.kind === 'bow' ? -1 : 1 : (support === 'left' ? -1 : 1) * (back ? -1 : 1)) * (west ? -1 : 1);
    const arm = limb(shoulder, target, 8, 7.5, bend);
    points[`${support}Elbow`] = arm.joint;
    points[`${support}Hand`] = arm.end;
    angles[`${support}Shoulder`] = Math.atan2(arm.joint.y - shoulder.y, arm.joint.x - shoulder.x) - Math.PI / 2;
    angles[`${support}Elbow`] = Math.atan2(arm.end.y - arm.joint.y, arm.end.x - arm.joint.x) - Math.PI / 2;
  }
  const bones = bonesFromPoints(points, angles);
  const finalPose = (held: HeroWeaponPose | undefined): HeroWeaponPose | undefined => {
    if (!held) return undefined;
    const grip = `${held.gripSide}Hand` as const;
    const support = held.gripSide === 'left' ? 'rightHand' : 'leftHand';
    return { ...held, origin: { ...points[grip], rotation: bones[grip].world.rotation },
      mirror: (held.mirror * (west ? -1 : 1)) as 1 | -1,
      ...(held.kind === 'bow' && held.twoHanded ? { stringPoint: points[support] } : {}) };
  };
  const socket = (name: HeroJoint): HeroSocket => ({ ...points[name], rotation: bones[name].world.rotation });
  return {
    id, facing, pose, body: appearance, side, back, crawling, nearSide, points, bones, rightHandWeapon: finalPose(heldRight), leftHandWeapon: finalPose(heldLeft),
    sockets: {
      ground: { x: 32, y: HERO_FOOT_Y, rotation: 0 },
      ...(appearance.present.torso ? { chest: socket('chest') } : {}),
      ...(appearance.present.head ? { head: socket('head') } : {}),
      ...(appearance.present.rightArm ? { rightHand: socket('rightHand') } : {}),
      ...(appearance.present.leftArm ? { leftHand: socket('leftHand') } : {}),
    },
  };
}
