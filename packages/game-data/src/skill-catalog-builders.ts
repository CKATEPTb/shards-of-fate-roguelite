import type { SkillDefinition, SkillIconDefinition } from '@shards/shared';
import { auraVisual } from './aura-profiles';

type SkillDraft = Omit<SkillDefinition, 'schemaVersion' | 'condition' | 'priority' | 'tags' | 'icon' | 'rarity'> & {
  rarity: NonNullable<SkillDefinition['rarity']>;
  tags?: string[];
  icon: Pick<SkillIconDefinition, 'frame' | 'motif' | 'accent'>;
};

/** Schools organize authored skills; they do not restrict who may learn them. */
export function skillSchool(family: SkillIconDefinition['family'], firstVariant: number, drafts: SkillDraft[]): SkillDefinition[] {
  return drafts.map(({ icon, tags = [], ...draft }, index) => ({
    schemaVersion: 1, condition: 'always', priority: 50, ...draft,
    tags: ['LEARNABLE', family.toUpperCase(), ...tags],
    icon: { family, ...icon, colors: [...auraVisual(family, 0).colors], variant: firstVariant + index },
  }));
}
