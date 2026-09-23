import type { HeroSide, HeroWeaponPose, RigPoint } from './heroRigTypes';
import { heroWeaponDefinition, type HeroWeaponKind } from './heroWeapons';
import type { UnitPose } from './unitPose';
import { heroWalkStep } from './heroGait';

/** Grip targets and painted geometry use the same projected transform. */
export function weaponPoint(weapon: Pick<HeroWeaponPose, 'origin' | 'mirror' | 'widthScale' | 'lengthScale'>, x: number, y: number): RigPoint {
  const { origin, mirror, widthScale, lengthScale } = weapon;
  const cos = Math.cos(origin.rotation), sin = Math.sin(origin.rotation);
  return { x: origin.x + x * mirror * widthScale * cos - y * lengthScale * sin,
    y: origin.y + x * mirror * widthScale * sin + y * lengthScale * cos };
}

const silhouettes: Record<HeroWeaponKind, readonly [number, number, number, number]> = {
  bow: [-11, -17, 16, 17], staff: [-6, -30, 7, 15], dagger: [-3, -15, 3, 5],
  sword: [-4, -20, 4, 7], greatsword: [-6, -28, 6, 13], mace: [-5, -19, 5, 6],
  greatmace: [-7, -27, 7, 14], hammer: [-6, -18, 6, 6], greathammer: [-8, -26, 8, 14],
  shield: [-6, -10, 7, 8], sickle: [-3, -17, 7, 4], scythe: [-3, -29, 17, 16], wand: [-2, -17, 4, 5],
};

/** Keep a long blade or staff inside the atlas without shortening its artwork. */
export function containWeapon(weapon: HeroWeaponPose): void {
  const [left, top, right, bottom] = silhouettes[weapon.kind];
  const corners = [[left, top], [right, top], [left, bottom], [right, bottom]]
    .map(([x, y]) => weaponPoint(weapon, x, y));
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  weapon.origin.x += Math.max(0, 1 - minX) - Math.max(0, maxX - 62);
  weapon.origin.y += Math.max(0, 1 - minY) - Math.max(0, maxY - 62);
}

/** Authored beats are eased, then sampled into the shared pixel atlas. */
export function poseTrack(progress: number, values: readonly number[]): number {
  const at = Math.max(0, Math.min(1, progress)) * (values.length - 1);
  const index = Math.min(values.length - 2, Math.floor(at));
  const fraction = at - index, eased = fraction * fraction * (3 - 2 * fraction);
  return values[index] + (values[index + 1] - values[index]) * eased;
}

interface WeaponBeat { x: readonly number[]; y: readonly number[]; angle: readonly number[] }
const strikes: Partial<Record<HeroWeaponKind, WeaponBeat>> = {
  dagger: { x: [0, -2, 8, 6, 0], y: [0, -3, -6, -4, 0], angle: [-0.2, 0.3, 1.55, 1.3, -0.2] },
  sword: { x: [0, -3, 5, 7, 0], y: [0, -6, -9, -1, 0], angle: [-0.15, -0.9, 0.25, 1.7, -0.15] },
  greatsword: { x: [0, -3, -1, -6, 0], y: [0, -6, -7, 1, 0], angle: [-0.3, -0.8, -0.6, 1.35, -0.3] },
  mace: { x: [0, -3, -2, 7, 0], y: [0, -7, -8, 1, 0], angle: [-0.2, -0.8, -0.4, 1.3, -0.2] },
  greatmace: { x: [0, -3, -2, -6, 0], y: [0, -5, -7, 1, 0], angle: [-0.3, -0.65, -0.5, 1.3, -0.3] },
  hammer: { x: [0, -2, -1, 6, 0], y: [0, -8, -9, 2, 0], angle: [-0.25, -0.7, -0.3, 1.55, -0.25] },
  greathammer: { x: [0, -3, -3, -6, 0], y: [0, -5, -7, 1, 0], angle: [-0.35, -0.7, -0.55, 1.45, -0.35] },
  sickle: { x: [0, -3, 6, 4, 0], y: [0, -5, -7, -1, 0], angle: [-0.2, -0.8, 1.35, 2, -0.2] },
  scythe: { x: [0, -3, -2, -7, 0], y: [0, -3, -5, 1, 0], angle: [-0.35, -1, -0.55, 1.6, -0.35] },
};

interface WeaponReadyStance {
  /** Canonical east: wrist x relative to the chest, wrist y, clockwise angle. */
  side: readonly [number, number, number];
  /** Inward wrist offset from the old lateral grip, then absolute wrist height. */
  frontGrip?: readonly [number, number];
  frontAngle: number;
  frontLength?: number;
  /** Front-view cuts and thrusts return to the same inward guard. */
  frontAction?: readonly number[];
  /** Inward/downward wrist travel relative to frontGrip during an action. */
  frontReach?: Pick<WeaponBeat, 'x' | 'y'>;
}

/** Relaxed wrists lead the weapon forward; each family carries its own weight. */
const readyStances: Partial<Record<HeroWeaponKind, WeaponReadyStance>> = {
  dagger: { side: [4, 32, 1.25], frontAngle: 0.95, frontLength: 0.55,
    frontAction: [0.95, 0.5, 1.05, 1.1, 0.95] },
  sword: { side: [3, 33, 1.02], frontGrip: [2, 34], frontAngle: 0.6, frontLength: 0.9,
    frontAction: [0.6, -0.35, 0.75, 1.5, 0.6],
    frontReach: { x: [0, -3, 3, 5, 0], y: [0, -5, -8, 0, 0] } },
  greatsword: { side: [3, 32, 0.65], frontAngle: -0.5 },
  mace: { side: [3, 34, 0.65], frontGrip: [1, 34], frontAngle: 0.45 },
  greatmace: { side: [3, 32, 0.6], frontAngle: -0.5 },
  hammer: { side: [3, 34, 0.72], frontGrip: [1, 34], frontAngle: 0.5 },
  greathammer: { side: [3, 32, 0.65], frontAngle: -0.55 },
  sickle: { side: [4, 32, 1.05], frontGrip: [2, 33], frontAngle: 0.55, frontLength: 0.88,
    frontAction: [0.55, 0.05, 1.1, 1.7, 0.55],
    frontReach: { x: [0, -2, 1, 0, 0], y: [0, -5, -1, 2, 0] } },
  scythe: { side: [1, 32, 0.4], frontAngle: -0.35 },
  staff: { side: [5, 34, 0.6], frontAngle: -0.55 },
  wand: { side: [4, 32, 1.2], frontAngle: 0.8, frontLength: 0.75,
    frontAction: [0.8, 0.25, 0.5, 1.15, 0.8] },
};

/** A prop pose leads the arms, instead of swinging loose wrist sprites. */
export function weaponStance(appearanceId: string, kind: HeroWeaponKind, pose: UnitPose,
  cx: number, bob: number, side: boolean, back: boolean, bothArms: boolean,
  shoulderWidth: number, hand: HeroSide = kind === 'bow' ? 'left' : 'right', nearSide: HeroSide = 'right', guardWeight = 1): HeroWeaponPose {
  const definition = heroWeaponDefinition(kind), mirror = back ? -1 : 1;
  const twoHanded = definition.hands === 2 && bothArms;
  const p = pose.progress;
  const active = (pose.motion === 'attack' || pose.motion === 'attackLeft' || pose.motion === 'cast') && (definition.hands === 1 || twoHanded);
  const guard = pose.motion === 'block' || pose.motion === 'shieldBlock';
  const defenseWeight = pose.motion === 'shieldBlock' && kind !== 'shield' ? 0.3
    : pose.motion === 'block' && kind === 'shield' ? 0.15 : 1;
  const brace = guard ? poseTrack(p, [0, 0.85, 1, 0.75, 0]) * defenseWeight * guardWeight : 0;
  const dodge = pose.motion === 'dodge' ? poseTrack(p, [0, 0.7, 1, 0.7, 0]) : 0;
  const sway = pose.motion === 'walk' ? pose.sway * 0.04 : pose.sway * 0.015;
  const gripSide = hand, handed = hand === 'right' ? 1 : -1;
  let x = side ? -1 : -shoulderWidth - 1, y = 34, angle = -0.2 + sway;
  let authoredRest = { x, y, angle: -0.2 };
  let draw = 0, arrowVisible = false, arrowOffset = 0;
  let supportGrip: RigPoint | undefined;
  let widthScale = side ? 1 : 0.88;
  let lengthScale = 1;

  if (kind === 'bow') {
    x = side ? 11 : 12; y = 32; angle = 0.12 + sway;
    widthScale = side ? 1 : 0.65;
    if (active) {
      draw = poseTrack(p, [0, 0.5, 1, 0.05, 0]);
      y -= poseTrack(p, side ? [0, 7, 12, 10, 0] : [0, 5, 9, 7, 0]);
      angle = poseTrack(p, [0.12, 0.04, 0, -0.04, 0.12]);
      arrowVisible = p > 0.05 && p < 0.82;
      arrowOffset = p > 0.55 ? (p - 0.55) * 34 : 0;
    }
    x -= brace * 2 + dodge * 3; y += brace * 2 + dodge * 2;
    angle -= dodge * 0.22;
    supportGrip = { x: -7 - draw * 4, y: 0 };
  } else if (kind === 'staff') {
    x = side ? 6 : shoulderWidth - 13; y = 35; angle = -0.18 + sway;
    authoredRest = { x, y, angle: -0.18 };
    supportGrip = { x: 0, y: -8 };
    if (active) {
      x += poseTrack(p, pose.motion === 'cast' ? [0, 2, 2, 3, 0] : [0, 2, 2, -5, 0]);
      y += poseTrack(p, [0, -1, -2, 0, 0]);
      angle = poseTrack(p, pose.motion === 'cast' ? [-0.18, -0.3, -0.25, 0.05, -0.18]
        : [-0.18, -0.4, -0.2, 0.9, -0.18]);
    }
    x += brace * 4; y -= brace * 3; angle += brace * 0.95;
    x -= dodge * 2; angle -= dodge * 0.25;
  } else if (kind === 'shield') {
    x = side ? 8 : -shoulderWidth - 1; y = 32; angle = -0.08;
    widthScale = side ? 0.52 + brace * 0.26 : 1;
    const bash = active ? poseTrack(p, [0, -0.2, 1, 0.4, 0]) : 0;
    x += side ? brace * 3 + bash * 5 : brace * 3;
    y -= brace * 7 + bash * 3; angle += brace * 0.12;
  } else if (kind === 'wand') {
    if (active) {
      x += poseTrack(p, [0, -2, 2, 7, 0]);
      y += poseTrack(p, [0, -5, -10, -7, 0]);
      angle = poseTrack(p, [-0.2, -0.65, -0.25, 0.95, -0.2]);
    }
    x += brace * 3; y -= brace * 7; angle += brace * 0.9;
  } else {
    const heavy = definition.hands === 2;
    if (heavy) { x = side ? 5 : -3; y = 32; supportGrip = { x: 0, y: kind === 'scythe' ? 8 : 6 }; }
    const beat = strikes[kind];
    angle = (beat?.angle[0] ?? -0.2) + sway;
    authoredRest = { x, y, angle: beat?.angle[0] ?? -0.2 };
    if (active && beat) {
      x += poseTrack(p, beat.x) * (side ? 1 : 0.65);
      y += poseTrack(p, beat.y);
      angle = poseTrack(p, beat.angle);
    }
    x += brace * (side ? 4 : 2); y -= brace * (heavy ? 3 : 7);
    angle += brace * (heavy ? 1.1 : 1.25);
    x -= dodge * 2; y += dodge; angle -= dodge * 0.4;
  }
  const ready = readyStances[kind];
  if (ready) {
    // Keep the authored action beats and the absolute blocking pose.
    // Enter and leave both actions through the same stance used by idle/walk.
    const actionWeight = active ? poseTrack(p, [0, 1, 1, 1, 0]) : 0;
    const restWeight = 1 - Math.max(actionWeight, brace);
    const front = !side && !back;
    const readyX = side ? ready.side[0] : authoredRest.x + (front ? ready.frontGrip?.[0] ?? 0 : 0);
    const readyY = side ? ready.side[1] : front ? ready.frontGrip?.[1] ?? authoredRest.y : authoredRest.y;
    const readyAngle = side ? ready.side[2] : back ? authoredRest.angle : ready.frontAngle;
    x += (readyX - authoredRest.x) * restWeight;
    y += (readyY - authoredRest.y) * restWeight;
    if (active && front && ready.frontReach) {
      x = readyX + poseTrack(p, ready.frontReach.x);
      y = readyY + poseTrack(p, ready.frontReach.y);
    }
    angle = active && front && ready.frontAction ? poseTrack(p, ready.frontAction)
      : angle + (readyAngle - authoredRest.angle) * restWeight;
    if (front) lengthScale = 1 + ((ready.frontLength ?? 1) - 1) * restWeight;
  }
  if (pose.motion === 'walk' && definition.hands === 1) {
    const step = heroWalkStep(pose, hand), restraint = kind === 'shield' ? 0.4 : 1;
    // A carried item follows its wrist's small counter-swing, never a marching salute.
    if (side) x -= step.forward * 0.9 * restraint;
    else y -= step.forward * 0.75 * (back ? -1 : 1) * restraint;
    angle += step.forward * 0.025 * restraint;
  }
  // Canonical east projection: the right hand is at the trailing, near
  // shoulder; the left is at the leading, far shoulder. West reflects X once.
  if (side && definition.hands === 1) {
    if (hand === 'left' && kind !== 'shield') { x += 4; y -= 1; angle -= 0.1; }
    y += hand === nearSide ? 0.5 : -0.5;
  }
  if (back && definition.hands === 1) {
    // Hands held in front of the chest project inside the back silhouette.
    // The forward reach goes up/away in a rear view, not toward the camera.
    x *= kind === 'shield' ? 0.78 : 0.62;
    y -= 3 + (active ? poseTrack(p, [0, 1, 3, 2, 0]) : 0);
    widthScale = kind === 'shield' ? 0.85 : 0.6;
    if (kind === 'dagger' || kind === 'sickle' || kind === 'wand') {
      lengthScale = kind === 'dagger' ? 0.7 : 0.84;
      angle *= kind === 'dagger' ? 0.2 : 0.55;
    }
  }
  const lateral = side ? 1 : kind === 'bow' ? hand === 'left' ? 1 : -1 : handed;
  // Reflect the entire scythe sweep together with its hooked blade. Reflecting
  // only the blade made its broad inner cutting edge trail the blunt spine.
  const scytheProjection = kind === 'scythe' && !side ? -1 : 1;
  // A three-quarter bow projects the arrow down toward the camera in front,
  // and up away from it in the rear view, rather than aiming sideways in both.
  const rotation = kind === 'bow' && !side ? (angle + 0.45) * lateral : angle * mirror * lateral * scytheProjection;
  // Keep this handedness constant through rest, preparation, contact and recovery.
  const weaponMirror = mirror * lateral * scytheProjection;
  const weapon: HeroWeaponPose = {
    kind, appearanceId, gripSide, origin: { x: cx + x * mirror * lateral, y: y + bob, rotation },
    mirror: weaponMirror as 1 | -1, widthScale, lengthScale, twoHanded, active, supportGrip, draw, arrowVisible, arrowOffset,
  };
  if (kind === 'bow') weapon.stringPoint = weaponPoint(weapon, supportGrip!.x, supportGrip!.y);
  return weapon;
}
