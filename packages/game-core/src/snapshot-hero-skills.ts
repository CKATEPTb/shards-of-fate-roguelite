import type { GameContent } from '@shards/shared';
import { array, integer, record } from './snapshot-values';

/** Only exact known content hashes enter this upgrade; anatomy and dice streams are untouched. */
export function migrateHeroSkills(value: unknown, content: GameContent): void {
  array(value, 'units', 128).forEach((entry, index) => {
    const unit = entry as Record<string, unknown>;
    for (const key of ['cooldowns', 'effectCooldowns'] as const) {
      const definitions = key === 'cooldowns' ? content.skills : content.effects;
      const values = record(unit[key], `units[${index}].${key}`, definitions.map(definition => definition.id));
      for (const [id, remaining] of Object.entries(values)) {
        const definition = definitions.find(candidate => candidate.id === id)!;
        const limit = 'cooldown' in definition ? definition.cooldown : definition.internalCooldown;
        values[id] = Math.min(integer(remaining, `units[${index}].${key}.${id}`, 0, 1_000_000), limit);
      }
    }
    const statuses = array(unit.statuses, `units[${index}].statuses`, 4096) as Record<string, unknown>[];
    const burning = statuses.filter(status => status.id === 'burning');
    if (burning.length) {
      const first = burning[0];
      first.stacks = burning.reduce((sum, status) => sum + (status.stacks === undefined ? 1
        : integer(status.stacks, `units[${index}].burning.stacks`, 1, 1_000_000)), 0);
      first.remaining = null;
      first.appliedTurn = Math.min(...burning.map(status => integer(status.appliedTurn, `units[${index}].burning.appliedTurn`)));
      unit.statuses = statuses.filter(status => status.id !== 'burning' || status === first);
    }
    for (const status of statuses) if (status.id === 'bastion') {
      status.remaining = Math.min(integer(status.remaining, `units[${index}].bastion.remaining`, 1, 1_000_000), 1);
    }
  });
}
