import type { EnemyDefinition, Season, SkillDefinition, SkillIconDefinition } from '@shards/shared';
import { auraVisual } from './aura-profiles';
import { BOSS_HEALTH_SCALE } from './balance';

export interface BossSkillDraft extends Omit<SkillDefinition, 'schemaVersion' | 'id' | 'icon' | 'tags' | 'priority' | 'condition' | 'rarity'> {
  family: SkillIconDefinition['family'];
  icon: Pick<SkillIconDefinition, 'frame' | 'motif' | 'accent'>;
  tags?: string[];
  priority?: number;
  condition?: SkillDefinition['condition'];
}

export interface BossDraft {
  id: string;
  name: string;
  title: string;
  description: string;
  role: EnemyDefinition['role'];
  sprite: EnemyDefinition['sprite'];
  color: string;
  stats: Pick<EnemyDefinition['stats'], 'maxHp' | 'power' | 'armor' | 'initiative' | 'crit' | 'evasion'> & Partial<EnemyDefinition['stats']>;
  signature: BossSkillDraft;
  support: [string, string];
  modifiers?: EnemyDefinition['modifiers'];
  passive?: EnemyDefinition['passive'];
  tags?: string[];
}

export function bossSkill(id: string, draft: BossSkillDraft, variant: number): SkillDefinition {
  const { family, icon, tags = [], ...skill } = draft;
  return {
    schemaVersion: 1, id, priority: 80, condition: 'always', ...skill,
    tags: ['BOSS', family.toUpperCase(), ...tags],
    icon: { family, ...icon, colors: [...auraVisual(family, 0).colors], variant },
  };
}

const SEASON_LEVEL: Record<Season, number> = { spring: 12, summer: 16, autumn: 20, winter: 24 };
const SEASON_INDEX: Record<Season, number> = { spring: 0, summer: 1, autumn: 2, winter: 3 };

/** Authored content has no random draws; room generation selects one stable ID from its season. */
export function createBossCatalog(season: Season, drafts: BossDraft[]): { enemies: EnemyDefinition[]; skills: SkillDefinition[] } {
  const skills = drafts.map((draft, index) => bossSkill(`boss_${draft.id}_signature`, draft.signature,
    200 + SEASON_INDEX[season] * 20 + index));
  const enemies: EnemyDefinition[] = drafts.map((draft, index) => ({
    schemaVersion: 1, id: `boss_${draft.id}`, name: draft.name, title: draft.title, description: draft.description,
    role: draft.role, rank: 'ELITE', encounterCost: 20 + SEASON_INDEX[season] * 5,
    level: SEASON_LEVEL[season], sprite: draft.sprite, color: draft.color, movementSpeed: 72,
    stats: { agility: 5, accuracy: 3 + SEASON_INDEX[season], resilience: 4 + SEASON_INDEX[season], luck: 0, ...draft.stats,
      maxHp: Math.max(1, Math.round(draft.stats.maxHp * BOSS_HEALTH_SCALE)) },
    basicAttack: { type: 'damage', dice: season === 'winter' ? '2d8' : '2d6', scaling: 'power', factor: .55 },
    skillIds: [skills[index].id, ...draft.support], effectIds: [],
    modifiers: draft.modifiers ?? {}, ...(draft.passive ? { passive: draft.passive } : {}),
    // No FAMILY_/TIER_/AQUATIC/BASEMENT tags: bosses are excluded from ordinary encounter pools.
    tags: ['ACT_1', 'BOSS', `SEASON_${season.toUpperCase()}`, ...(draft.tags ?? [])],
  }));
  return { enemies, skills };
}
