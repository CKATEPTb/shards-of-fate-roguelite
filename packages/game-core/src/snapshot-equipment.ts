import type { Combatant, GameContent } from '@shards/shared';
import { bodyCombatStats, restoreHeroBody } from './anatomy';
import { array, record, same } from './snapshot-values';

/** Previous starter loadouts attached offensive bonuses to the right arm and healing to the left. */
export const LEGACY_HAND_BONUSES: Record<string, readonly [rightPower: number, leftPower: number, leftHealing: number]> = {
  guardian: [6, 0, 0], priest: [4, 0, 8], mage: [10, 0, 0], vampire: [8, 0, 0],
  paladin: [6, 0, 7], druid: [5, 0, 7], necromancer: [6, 0, 7], rogue: [5, 2, 0], ranger: [8, 0, 0],
};

/** Called only for exact legacy content hashes; retain injuries and recompute relocated item bonuses. */
export function migrateEquipmentStats(value: unknown, expected: Combatant[], content: GameContent): void {
  array(value, 'units', 128).forEach((entry, index) => {
    const baseline = expected[index];
    if (baseline?.team !== 'heroes' || !baseline.body) return;
    const unit = entry as Record<string, unknown>;
    const definition = content.characters.find(candidate => candidate.id === baseline.definitionId)!;
    const bonuses = LEGACY_HAND_BONUSES[definition.id];
    if (!bonuses || !unit || typeof unit !== 'object' || Array.isArray(unit)) return;
    const body = restoreHeroBody(unit.body, baseline.body);
    const currentStats = bodyCombatStats(definition, body);
    const [rightPower, leftPower, leftHealing] = bonuses;
    const previousStats = {
      ...currentStats,
      power: Math.max(0, definition.stats.power - (body.rightArm.current > 0 ? 0 : rightPower) - (body.leftArm.current > 0 ? 0 : leftPower)),
      healing: Math.max(0, (definition.stats.healing ?? 0) - (body.leftArm.current > 0 ? 0 : leftHealing)),
    };
    const path = `units[${index}].stats`;
    const savedStats = record(unit.stats, path, Object.keys(previousStats));
    for (const key of Object.keys(previousStats) as (keyof Combatant['stats'])[]) same(savedStats[key], previousStats[key], `${path}.${key}`);
    unit.stats = currentStats;
  });
}
