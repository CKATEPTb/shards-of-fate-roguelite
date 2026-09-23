import type { HeroAppearance } from './heroAppearance';
import type { UnitFacing, UnitPose } from './unitPose';
import type { HeroWeaponKind } from './heroWeapons';

export const HERO_FRAME_SIZE = 64;
export const HERO_FOOT_Y = 56;
export type RigPoint = { x: number; y: number };
export type HeroSide = 'left' | 'right';
export type HeroJoint = 'root' | 'pelvis' | 'chest' | 'neck' | 'head'
  | 'leftShoulder' | 'leftElbow' | 'leftHand' | 'rightShoulder' | 'rightElbow' | 'rightHand'
  | 'leftHip' | 'leftKnee' | 'leftFoot' | 'rightHip' | 'rightKnee' | 'rightFoot';
export type HeroSocketName = 'ground' | 'chest' | 'head' | 'rightHand' | 'leftHand';
export interface HeroSocket extends RigPoint { rotation: number }
/** One prop transform drives both hands and the weapon's visible contact points. */
export interface HeroWeaponPose {
  kind: HeroWeaponKind;
  appearanceId: string;
  gripSide: HeroSide;
  origin: HeroSocket;
  mirror: 1 | -1;
  /** Foreshortening belongs to the prop and its grip targets together. */
  widthScale: number;
  /** Projected shaft/blade length; grip targets use this same scale. */
  lengthScale: number;
  twoHanded: boolean;
  /** Only the striking/casting prop emits action effects; the other stays in guard. */
  active: boolean;
  supportGrip?: RigPoint;
  /** Bow nock in world coordinates, shared with the drawing hand. */
  stringPoint?: RigPoint;
  draw: number;
  arrowVisible: boolean;
  arrowOffset: number;
}
export interface HeroBone {
  parent: HeroJoint | null;
  /** Translation and rotation relative to the parent bone. */
  x: number;
  y: number;
  rotation: number;
  world: HeroSocket;
}
export interface HeroRig {
  id: string;
  facing: UnitFacing;
  pose: UnitPose;
  body: HeroAppearance;
  side: boolean;
  back: boolean;
  crawling: boolean;
  nearSide: HeroSide;
  points: Record<HeroJoint, RigPoint>;
  bones: Record<HeroJoint, HeroBone>;
  rightHandWeapon?: HeroWeaponPose;
  leftHandWeapon?: HeroWeaponPose;
  /** Missing body parts expose no attachment socket. Ground is always present. */
  sockets: Partial<Record<HeroSocketName, HeroSocket>>;
}
