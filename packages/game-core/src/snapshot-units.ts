import type { Combatant, GameContent } from '@shards/shared';
import { array, fail, finite, integer, record, same, string } from './snapshot-values';
import { bodyCombatHealth, bodyCombatStats, legacyHeroBody } from './anatomy';
import { restoreSavedHeroBody } from './snapshot-body';

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

export function validateUnits(value: unknown, expected: Combatant[], turn: number, content: GameContent, allowLegacyBodies = false): void {
  const units = array(value, 'units', 128);
  if (units.length !== expected.length) fail('units', 'roster does not match encounter and party');
  let turnsTaken = 0;
  units.forEach((entry, index) => {
    const path = `units[${index}]`;
    const baseline = expected[index];
    const unit = record(entry, path, ['id', 'definitionId', 'name', 'team', 'stats', 'hp', 'body', 'shield', 'shieldLayers', 'cooldowns', 'effectCooldowns', 'statuses', 'turnsTaken', 'escaped']);
    if (unit.escaped !== undefined && typeof unit.escaped !== 'boolean') fail(`${path}.escaped`, 'expected boolean');
    if (unit.escaped && (unit.team !== 'heroes' || Number(unit.hp) <= 0)) fail(`${path}.escaped`, 'only living heroes can escape');
    for (const key of ['id', 'definitionId', 'name', 'team'] as const) same(unit[key], baseline[key], `${path}.${key}`);
    let expectedStats = baseline.stats;
    if (baseline.body) {
      const body = restoreSavedHeroBody(unit.body, baseline.body, allowLegacyBodies);
      unit.body = body;
      expectedStats = bodyCombatStats(content.characters.find(definition => definition.id === baseline.definitionId)!, body);
      same(unit.hp, bodyCombatHealth(body), `${path}.hp`);
    } else if (unit.body !== undefined) fail(`${path}.body`, 'enemies do not have hero anatomy');
    const optionalRatings = ['agility', 'accuracy', 'resilience', 'luck'] as const;
    const stats = record(unit.stats, `${path}.stats`, [...Object.keys(expectedStats), ...optionalRatings]);
    for (const key of Object.keys(expectedStats) as (keyof Combatant['stats'])[]) {
      if (!optionalRatings.includes(key as typeof optionalRatings[number])) same(stats[key], expectedStats[key], `${path}.stats.${key}`);
    }
    for (const key of optionalRatings) same(stats[key] === undefined ? 0 : stats[key], expectedStats[key] ?? 0, `${path}.stats.${key}`);
    unit.stats = { ...expectedStats };
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
    const instanceIds = new Set<string>();
    const decayingIds = new Set<string>();
    array(unit.statuses, `${path}.statuses`, 4096).forEach((entry, i) => {
      const statusPath = `${path}.statuses[${i}]`;
      const status = record(entry, statusPath, ['id', 'instanceId', 'sourceId', 'remaining', 'appliedTurn', 'stacks']);
      const id = string(status.id, `${statusPath}.id`);
      const definition = content.statuses.find(definition => definition.id === id);
      if (!definition) fail(statusPath, 'unknown status');
      if (status.stacks !== undefined) integer(status.stacks, `${statusPath}.stacks`, 1, 1_000_000);
      if (definition!.stacking === 'decay') {
        integer(status.stacks, `${statusPath}.stacks`, 1, 1_000_000);
        same(status.remaining, null, `${statusPath}.remaining`);
        if (decayingIds.has(id)) fail(statusPath, 'decaying stacks must use one pool');
        decayingIds.add(id);
      }
      if (status.instanceId !== undefined) {
        const instanceId = string(status.instanceId, `${statusPath}.instanceId`);
        if (instanceIds.has(instanceId)) fail(statusPath, 'duplicate aura instance');
        instanceIds.add(instanceId);
      }
      if (!expected.some(source => source.id === status.sourceId)) fail(statusPath, 'unknown status source');
      if (status.remaining !== null) integer(status.remaining, `${statusPath}.remaining`, 1, 1_000_000);
      integer(status.appliedTurn, `${statusPath}.appliedTurn`, 0, turn);
    });
  });
  same(turnsTaken, turn, 'units.turnsTaken');
}
