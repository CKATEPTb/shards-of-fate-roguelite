import type { Combatant, GameContent, Stats } from '@shards/shared';
import { bodyCombatStats, restoreHeroBody } from './anatomy';
import { array, record, same } from './snapshot-values';

// The preceding shipped rules used fractional crit/evasion ratings and speed-like initiative.
export const LEGACY_RATINGS: Record<string, readonly [number, number, number]> = {
  guardian: [9, .06, .03], priest: [11, .08, .07], mage: [13, .16, .09], vampire: [12, .1, .06],
  paladin: [8, .08, .04], druid: [12, .08, .08], necromancer: [10, .1, .05], rogue: [16, .15, .05], ranger: [14, .12, .1],
  rat: [15, .05, .08], wolf: [14, .1, .09], slime: [3, .02, .02], spider: [13, .06, .1],
  goblin_scout: [12, .12, .1], goblin_archer: [11, .1, .08], goblin_shaman: [8, .05, .04],
  boar: [6, .06, .02], thornling: [5, .04, .03], elite_warden: [7, .09, .04],
};

/** Earlier equipment migration still validates against the attributes used when that save was written. */
export function contentWithLegacyRatings(content: GameContent): GameContent {
  const legacy = <T extends GameContent['characters'][number]>(definition: T): T => {
    const [initiative, crit, evasion] = LEGACY_RATINGS[definition.id];
    const { agility: _agility, ...stats } = { ...definition.stats, initiative, crit, evasion };
    return { ...definition, stats };
  };
  return { ...content, characters: content.characters.map(legacy), enemies: content.enemies.map(legacy) };
}

/** Called only behind the exact legacy content guard. HP, wounds, dice counters and history survive. */
export function migrateManualCombatStats(value: unknown, expected: Combatant[], content: GameContent): void {
  array(value, 'units', 128).forEach((entry, index) => {
    const baseline = expected[index];
    if (!baseline) return;
    const unit = entry as Record<string, unknown>;
    const definition = [...content.characters, ...content.enemies].find(candidate => candidate.id === baseline.definitionId)!;
    const nextStats = baseline.body ? bodyCombatStats(definition, restoreHeroBody(unit.body, baseline.body)) : baseline.stats;
    const [initiative, crit, evasion] = LEGACY_RATINGS[definition.id];
    const { agility: _agility, ...oldStats } = { ...nextStats, initiative, crit, evasion };
    const path = `units[${index}].stats`;
    const savedStats = record(unit.stats, path, Object.keys(oldStats));
    for (const key of Object.keys(oldStats) as (keyof Stats)[]) same(savedStats[key], oldStats[key as keyof typeof oldStats], `${path}.${key}`);
    unit.stats = nextStats;
  });
}
