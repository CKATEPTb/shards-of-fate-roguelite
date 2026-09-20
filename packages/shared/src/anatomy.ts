export const BODY_PARTS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
export const LIMB_PARTS = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
export type BodyPart = typeof BODY_PARTS[number];
export type BodyResources = Record<BodyPart, number>;
export type HeroBody = Record<BodyPart, { current: number; max: number }>;
export type EquipmentSlot = 'head' | 'chest' | 'gloves' | 'pants' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'mainHand' | 'offHand';

/** Fixed starting equipment; resources protect body parts, while armor reduces damage. */
export interface StarterEquipment {
  slot: EquipmentSlot;
  name: string;
  description: string;
  resources: Partial<BodyResources>;
  armor: number;
  bodyParts: BodyPart[];
  bonuses?: { power?: number; healing?: number };
}
export interface HeroAnatomy { base: BodyResources; equipment: StarterEquipment[] }
