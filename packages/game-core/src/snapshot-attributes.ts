import type { Combatant, GameContent, HeroBody, Stats, UnitDefinition } from '@shards/shared';
import { bodyCombatHealth, bodyCombatStats, bodyMaxHealth, legacyHeroBody } from './anatomy';
import { array, finite, record, same } from './snapshot-values';
import { legacyBodyHealth, readLegacyHeroBody, restoreSavedHeroBody } from './snapshot-body';
import { LEGACY_RATINGS } from './snapshot-manual-combat';
import { LEGACY_HAND_BONUSES } from './snapshot-equipment';

// Shipped pre-unified attributes. These values must not be derived from new
// content: a healer's new Power and a hero's new local armour have changed.
const PREVIOUS_ATTRIBUTES: Record<string, readonly [power: number, armor: number, healing: number]> = {
  guardian: [8, 18, 0], priest: [5, 7, 11], mage: [14, 5, 0], vampire: [11, 12, 0],
  paladin: [9, 16, 10], druid: [7, 8, 10], necromancer: [9, 6, 10], rogue: [12, 7, 0], ranger: [12, 8, 0],
  rat: [4, 1, 0], wolf: [7, 3, 0], slime: [5, 8, 0], spider: [6, 3, 0], goblin_scout: [7, 5, 0],
  goblin_archer: [8, 4, 0], goblin_shaman: [5, 4, 8], boar: [11, 12, 0], thornling: [7, 13, 0], elite_warden: [14, 17, 10],
};
const PREVIOUS_ITEM_BONUSES: Record<string, readonly [power: number, healing: number]> = {
  'steel-sword': [6, 0], 'riveted-shield': [0, 0], 'pilgrim-staff': [4, 8], 'ember-wand': [10, 0],
  'bloodletting-sickle': [8, 0], 'oath-hammer': [6, 0], 'sunward-shield': [0, 7], 'elderbranch-staff': [5, 7],
  'bonewood-staff': [6, 7], 'forged-steel-dagger': [5, 0], 'worn-steel-dagger': [2, 0], 'hunting-bow': [8, 0],
};

function previousStats(definition: UnitDefinition, baseline: Combatant, body: HeroBody | undefined,
  content: GameContent, partySize: number, autobattle: boolean, oldHands: boolean): Stats {
  let [power, armor, healing] = PREVIOUS_ATTRIBUTES[definition.id];
  if (body) {
    for (const item of definition.anatomy?.equipment ?? []) {
      const needsBothHands = item.weapon?.hands === 2;
      const usable = !item.weapon || (needsBothHands ? body.leftArm.current > 0 && body.rightArm.current > 0
        : body[item.slot === 'leftHand' ? 'leftArm' : 'rightArm'].current > 0);
      const fraction = usable ? item.bodyParts.filter(part => body[part].current > 0).length / item.bodyParts.length : 0;
      armor -= item.armor * (1 - fraction);
      if (!oldHands) {
        const [itemPower, itemHealing] = PREVIOUS_ITEM_BONUSES[item.id ?? ''] ?? [0, 0];
        power -= itemPower * (1 - fraction);
        healing -= itemHealing * (1 - fraction);
      }
    }
    if (oldHands) {
      const [rightPower, leftPower, leftHealing] = LEGACY_HAND_BONUSES[definition.id];
      power -= (body.rightArm.current > 0 ? 0 : rightPower) + (body.leftArm.current > 0 ? 0 : leftPower);
      healing -= body.leftArm.current > 0 ? 0 : leftHealing;
    }
  } else if (baseline.team === 'enemies') power = Math.max(0, Math.round(power * content.balance.partyScaling[partySize].damage));
  const stats: Stats = { maxHp: body ? bodyMaxHealth(body) : baseline.team === 'enemies' ? baseline.stats.maxHp : definition.stats.maxHp,
    power: Math.max(0, power), armor: Math.max(0, armor), initiative: definition.stats.initiative,
    crit: definition.stats.crit, evasion: definition.stats.evasion, healing: Math.max(0, healing) };
  if (autobattle) [stats.initiative, stats.crit, stats.evasion] = LEGACY_RATINGS[definition.id];
  else if (definition.stats.agility !== undefined) stats.agility = definition.stats.agility;
  return stats;
}

/** Exact shipped versions only. Validate old values before replacing derived stats. */
export function migrateCombatAttributes(value: unknown, expected: Combatant[], content: GameContent,
  options: { partySize: number; autobattle: boolean; oldHands: boolean }): void {
  array(value, 'units', 128).forEach((entry, index) => {
    const baseline = expected[index];
    if (!baseline) return;
    const unit = record(entry, `units[${index}]`, ['id', 'definitionId', 'name', 'team', 'stats', 'hp', 'body', 'shield', 'shieldLayers', 'cooldowns', 'effectCooldowns', 'statuses', 'turnsTaken', 'escaped']);
    const definition = [...content.characters, ...content.enemies].find(candidate => candidate.id === baseline.definitionId)!;
    const oldBody = baseline.body && unit.body !== undefined ? readLegacyHeroBody(unit.body, baseline.body) : undefined;
    const previous = previousStats(definition, baseline, oldBody, content, options.partySize, options.autobattle, options.oldHands);
    const path = `units[${index}].stats`;
    const saved = record(unit.stats, path, Object.keys(previous));
    for (const key of Object.keys(previous) as (keyof Stats)[]) same(saved[key], previous[key], `${path}.${key}`);
    if (baseline.body) {
      if (oldBody) same(unit.hp, legacyBodyHealth(oldBody), `units[${index}].hp`);
      const nextBody = oldBody ? restoreSavedHeroBody(oldBody, baseline.body, true)
        : legacyHeroBody(definition, finite(unit.hp, `units[${index}].hp`, 0, definition.stats.maxHp), definition.stats.maxHp);
      unit.body = nextBody;
      unit.hp = bodyCombatHealth(nextBody);
      unit.stats = bodyCombatStats(definition, nextBody);
    } else unit.stats = { ...baseline.stats };
  });
}
