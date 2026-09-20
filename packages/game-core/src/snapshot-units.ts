import type { Combatant, GameContent } from '@shards/shared';
import { array, fail, finite, integer, record, same, string } from './snapshot-values';
import { bodyCombatHealth, bodyCombatStats, legacyHeroBody, restoreHeroBody } from './anatomy';

/** Upgrade scalar hero health only when the enclosing hash identifies old content. */
export function migrateCombatBodies(value: unknown, expected: Combatant[], content: GameContent, legacy: boolean): void {
  array(value, 'units', 128).forEach((entry, index) => {
    const baseline = expected[index];
    if (!baseline || baseline.team !== 'heroes') return;
    const unit = entry as Record<string, unknown> | null;
    if (!unit || typeof unit !== 'object' || Array.isArray(unit) || unit.body !== undefined || !legacy) return;
    const definition = content.characters.find(candidate => candidate.id === baseline.definitionId)!;
    const stats = record(unit.stats, `units[${index}].stats`, Object.keys(definition.stats));
    for (const key of Object.keys(definition.stats) as (keyof Combatant['stats'])[]) same(stats[key], definition.stats[key], `units[${index}].stats.${key}`);
    const hp = finite(unit.hp, `units[${index}].hp`, 0, definition.stats.maxHp);
    const body = legacyHeroBody(definition, hp, definition.stats.maxHp);
    unit.body = body;
    unit.stats = bodyCombatStats(definition, body);
    unit.hp = bodyCombatHealth(body);
  });
}

export function validateUnits(value: unknown, expected: Combatant[], turn: number, content: GameContent): void {
  const units = array(value, 'units', 128);
  if (units.length !== expected.length) fail('units', 'roster does not match encounter and party');
  let turnsTaken = 0;
  units.forEach((entry, index) => {
    const path = `units[${index}]`;
    const baseline = expected[index];
    const unit = record(entry, path, ['id', 'definitionId', 'name', 'team', 'stats', 'hp', 'body', 'shield', 'shieldLayers', 'cooldowns', 'effectCooldowns', 'statuses', 'turnsTaken']);
    for (const key of ['id', 'definitionId', 'name', 'team'] as const) same(unit[key], baseline[key], `${path}.${key}`);
    const stats = record(unit.stats, `${path}.stats`, ['maxHp', 'power', 'armor', 'initiative', 'crit', 'evasion', 'healing']);
    let expectedStats = baseline.stats;
    if (baseline.body) {
      const body = restoreHeroBody(unit.body, baseline.body);
      unit.body = body;
      expectedStats = bodyCombatStats(content.characters.find(definition => definition.id === baseline.definitionId)!, body);
      same(unit.hp, bodyCombatHealth(body), `${path}.hp`);
    } else if (unit.body !== undefined) fail(`${path}.body`, 'enemies do not have hero anatomy');
    for (const key of Object.keys(expectedStats) as (keyof Combatant['stats'])[]) same(stats[key], expectedStats[key], `${path}.stats.${key}`);
    finite(unit.hp, `${path}.hp`, 0, baseline.stats.maxHp);
    finite(unit.shield, `${path}.shield`, 0);
    if (unit.shieldLayers !== undefined) {
      const layers = array(unit.shieldLayers, `${path}.shieldLayers`, 1024);
      if (!layers.length) fail(`${path}.shieldLayers`, 'empty shield layers must be omitted');
      let capacity = 0;
      layers.forEach((entry, i) => {
        const layerPath = `${path}.shieldLayers[${i}]`;
        const layer = record(entry, layerPath, ['sourceId', 'capacity', 'remaining', 'appliedTurn']);
        if (!expected.some(source => source.id === layer.sourceId)) fail(layerPath, 'unknown shield source');
        capacity += finite(layer.capacity, `${layerPath}.capacity`, Number.MIN_VALUE);
        integer(layer.remaining, `${layerPath}.remaining`, 1, 1_000_000);
        integer(layer.appliedTurn, `${layerPath}.appliedTurn`, 0, turn);
      });
      if (capacity > (unit.shield as number)) fail(`${path}.shieldLayers`, 'timed capacity exceeds total shield');
    }
    turnsTaken += integer(unit.turnsTaken, `${path}.turnsTaken`, 0, turn);
    for (const key of ['cooldowns', 'effectCooldowns'] as const) {
      const cooldowns = record(unit[key], `${path}.${key}`, Object.keys(baseline[key]));
      for (const id of Object.keys(baseline[key])) {
        const max = key === 'cooldowns' ? content.skills.find(skill => skill.id === id)!.cooldown : content.effects.find(effect => effect.id === id)!.internalCooldown;
        integer(cooldowns[id], `${path}.${key}.${id}`, 0, max);
      }
    }
    const statusIds = new Set<string>();
    array(unit.statuses, `${path}.statuses`, content.statuses.length).forEach((entry, i) => {
      const statusPath = `${path}.statuses[${i}]`;
      const status = record(entry, statusPath, ['id', 'sourceId', 'remaining', 'appliedTurn']);
      const id = string(status.id, `${statusPath}.id`);
      if (!content.statuses.some(definition => definition.id === id) || statusIds.has(id)) fail(statusPath, 'unknown or duplicate status');
      statusIds.add(id);
      if (!expected.some(source => source.id === status.sourceId)) fail(statusPath, 'unknown status source');
      integer(status.remaining, `${statusPath}.remaining`, 1, 1_000_000);
      integer(status.appliedTurn, `${statusPath}.appliedTurn`, 0, turn);
    });
  });
  same(turnsTaken, turn, 'units.turnsTaken');
}
