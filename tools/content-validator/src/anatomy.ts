import { BODY_PARTS } from '@shards/shared';
import { z } from 'zod';
import { nonnegative, text } from './common';

const resource = z.number().int().min(1).max(1_000_000);
const resources = z.object({ head: resource, torso: resource, leftArm: resource, rightArm: resource, leftLeg: resource, rightLeg: resource }).strict();
const equipment = z.object({
  slot: z.enum(['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'mainHand', 'offHand']),
  name: text, description: text, resources: resources.partial(), armor: nonnegative,
  bodyParts: z.array(z.enum(BODY_PARTS)).min(1).max(6),
  bonuses: z.object({ power: nonnegative.optional(), healing: nonnegative.optional() }).strict().optional(),
}).strict().superRefine((item, context) => {
  if (new Set(item.bodyParts).size !== item.bodyParts.length) context.addIssue({ code: 'custom', path: ['bodyParts'], message: 'Body part bindings must be unique' });
  for (const part of BODY_PARTS) if (item.resources[part] !== undefined && !item.bodyParts.includes(part)) context.addIssue({ code: 'custom', path: ['resources', part], message: 'Resource must belong to an equipped body part' });
});

export const anatomySchema = z.object({ base: resources, equipment: z.array(equipment).max(10) }).strict().superRefine((anatomy, context) => {
  if (new Set(anatomy.equipment.map(item => item.slot)).size !== anatomy.equipment.length) context.addIssue({ code: 'custom', path: ['equipment'], message: 'Equipment slots must be unique' });
});
