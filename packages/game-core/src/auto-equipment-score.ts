import { applyNativeSkillRarities, baseEquipmentItemId, BODY_PARTS, equipmentBodyPartsForSlot, equipmentItemFitsSlot, REWARD_RARITIES,
  resolveEquipmentItem, strongerRepeatCheck, weaponAttackBonusMultiplier, type ActionDefinition, type DiceCheck, type EquipmentItemDefinition, type EquipmentSetBonusDefinition, type EquipmentSlot,
  type GameContent, type HeroBody, type HeroProgress, type Modifiers, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { parseDice } from './dice';

const attributes = ['power', 'initiative', 'accuracy', 'evasion', 'crit', 'resilience', 'agility', 'luck'] as const;
const modifierKeys = ['powerBonus', 'initiativeBonus', 'accuracyBonus', 'evasionBonus', 'critBonus', 'resilienceBonus', 'agilityBonus', 'luckBonus'] as const;
const slots: EquipmentSlot[] = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const softCap = (value: number, cap: number, excess = .2) => Math.min(value, cap) + Math.max(0, value - cap) * excess;
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const armorMean = (value: number) => {
  const armor = Math.max(0, Math.floor(value));
  return Math.floor(armor / 20) * 10.5 + (armor % 20 ? (armor % 20 + 1) / 2 : 0);
};
const hitWeights = [.05, .55, .1, .1, .1, .1];

export const AUTO_EQUIPMENT_WEIGHTS = Object.freeze({ power: 5, evasion: 4, accuracy: 3, crit: 2.8,
  resilience: 2.6, initiative: 1.5, agility: .15, durability: .18, armor: 8, luckEarly: 20, luckLate: .4 });

/** Pure dice expectations: evaluation never reads or advances the room's dice. */
function expectations() {
  const means = new Map<string, number>(), chances = new Map<string, number>();
  const mean = (expression?: string): number => {
    if (!expression) return 0;
    if (!means.has(expression)) {
      const die = parseDice(expression);
      means.set(expression, die.count * (die.sides + 1) / 2 + die.modifier);
    }
    return means.get(expression)!;
  };
  const chance = (check?: DiceCheck): number => {
    if (!check) return 0;
    const key = `${check.dice}:${check.atLeast}`;
    if (!chances.has(key)) {
      const { count, sides, modifier } = parseDice(check.dice), threshold = Math.ceil(check.atLeast - modifier);
      if (count === 1) chances.set(key, clamp((sides - threshold + 1) / sides, 0, 1));
      else if (threshold <= count) chances.set(key, 1);
      else if (threshold > count * sides) chances.set(key, 0);
      else if (count * sides <= 400 && count <= 20) {
        let distribution = [1];
        for (let die = 0; die < count; die++) {
          const next = new Array(distribution.length + sides).fill(0) as number[];
          distribution.forEach((probability, total) => {
            if (probability) for (let face = 1; face <= sides; face++) next[total + face] += probability / sides;
          });
          distribution = next;
        }
        chances.set(key, distribution.reduce((sum, probability, total) => sum + (total >= threshold ? probability : 0), 0));
      } else chances.set(key, clamp((count * sides - threshold + 1) / (count * (sides - 1) + 1), 0, 1));
    }
    return chances.get(key)!;
  };
  return { mean, chance };
}

/** Quality is based on owned alternatives, not the candidate being scored. A
 * returned item remains owned, so automatic swaps cannot oscillate the policy. */
export function autoEquipmentQuality(progress: HeroProgress, content: GameContent, body?: HeroBody): number {
  const cache = new Map<string, EquipmentItemDefinition | undefined>();
  const items = [...progress.equipment.map(entry => entry.itemId), ...(progress.inventory ?? []).filter(entry => entry.kind === 'equipment').map(entry => entry.definitionId)]
    .flatMap(id => {
      if (!cache.has(id)) cache.set(id, resolveEquipmentItem(content.equipmentCatalog?.items, id));
      const item = cache.get(id);
      return item ? [item] : [];
    });
  const fits = (item: EquipmentItemDefinition, slot: EquipmentSlot) => {
    if (!equipmentItemFitsSlot(item, slot)) return false;
    const parts = equipmentBodyPartsForSlot(item, slot);
    return !body || !(item.weapon ? parts.some(part => body[part].lost) : parts.length && parts.every(part => body[part].lost));
  };
  const rank = (item: EquipmentItemDefinition) => REWARD_RARITIES.indexOf(item.rarity);
  let total = 0;
  for (const slot of slots.slice(0, 6)) total += Math.max(0, ...items.filter(item => fits(item, slot)).map(rank));
  // Each real ring/hand instance is spent at most once. A two-handed weapon
  // fills both hand slots; it never combines with a second held item here.
  const pair = (left: EquipmentSlot, right: EquipmentSlot) => {
    let best = 0;
    const pool = (slot: EquipmentSlot) => items.map((item, index) => ({ item, index })).filter(entry => fits(entry.item, slot))
      .sort((a, b) => rank(b.item) - rank(a.item) || a.index - b.index).slice(0, 3);
    const a = pool(left), b = pool(right);
    for (const entry of [...a, ...b]) best = Math.max(best, rank(entry.item) * (entry.item.weapon?.hands === 2 ? 2 : 1));
    for (const first of a) for (const second of b) if (first.index !== second.index && first.item.weapon?.hands !== 2 && second.item.weapon?.hands !== 2) {
      best = Math.max(best, rank(first.item) + rank(second.item));
    }
    return best;
  };
  total += pair('ring1', 'ring2') + pair('rightHand', 'leftHand');
  return total / (slots.length * (REWARD_RARITIES.length - 1));
}

interface ItemFeatures {
  item: StarterEquipment; baseId: string; hands: number[];
  resources: number[]; bonuses: number[]; armor: number[]; fraction: number; rank: number; damage: number;
}

/** Weighted whole-outfit utility. Temporary combat statuses are deliberately
 * excluded: this chooses durable equipment, not a different outfit each turn. */
export function createEquipmentScorer(hero: UnitDefinition, progress: HeroProgress, content: GameContent, body?: HeroBody, partySize = 1) {
  const quality = autoEquipmentQuality(progress, content, body);
  const luckWeight = AUTO_EQUIPMENT_WEIGHTS.luckLate + (AUTO_EQUIPMENT_WEIGHTS.luckEarly - AUTO_EQUIPMENT_WEIGHTS.luckLate) * (1 - quality) ** 2;
  const party = clamp(partySize, 1, 4), { mean, chance } = expectations();
  const definition = applyNativeSkillRarities(hero, progress, content);
  const base = attributes.map(key => (definition.stats[key] ?? 0) - (definition.anatomy?.equipment ?? []).reduce((sum, item) => sum + (item.bonuses?.[key] ?? 0), 0));
  const attached = BODY_PARTS.map(part => !body?.[part].lost);
  const baseMaxima = BODY_PARTS.map(part => definition.anatomy?.base[part] ?? 0);
  const features = new WeakMap<StarterEquipment, ItemFeatures>();
  const feature = (item: StarterEquipment): ItemFeatures => {
    let found = features.get(item);
    if (!found) {
      found = { item, baseId: baseEquipmentItemId(item.id ?? item.name),
        hands: item.weapon ? item.weapon.hands === 2 ? [2, 3] : [item.slot === 'leftHand' ? 2 : 3] : [],
        resources: BODY_PARTS.map(part => item.resources[part] ?? 0), bonuses: attributes.map(key => item.bonuses?.[key] ?? 0),
        armor: BODY_PARTS.map((part, index) => item.bodyParts.includes(BODY_PARTS[attached[index] ? index : 1]) ? item.armor : 0),
        fraction: item.bodyParts.length ? item.bodyParts.filter(part => attached[BODY_PARTS.indexOf(part)]).length / item.bodyParts.length : 1,
        rank: REWARD_RARITIES.indexOf(item.rarity ?? 'common'), damage: item.weapon?.kind === 'shield' ? 0 : mean(item.weapon?.damage) };
      features.set(item, found);
    }
    return found;
  };

  // Determine which preservation auras the chosen (unchanged) abilities can use.
  // A set cannot gain shield/HOT value on a build that never produces either.
  const statuses = new Map(content.statuses.map(status => [status.id, status]));
  const learned = new Set([...definition.skillIds, ...progress.skills.filter((id): id is string => !!id)]);
  const capacities: { shield: Array<[number, number]>; hot: Array<[number, number]>; healing: Array<[number, number]> } = { shield: [], hot: [], healing: [] };
  const record = (action: ActionDefinition, friendly: boolean, rate: number, preservableHot: boolean, depth: number) => {
    if (action.targetRelation === 'enemy') return;
    const target = action.target;
    const helpful = target && ['enemy', 'lowestHealthEnemy', 'allEnemies', 'randomEnemy'].includes(target) ? false
      : target === 'self' && depth === 0 || target && ['ally', 'lowestHealthAlly', 'allAllies', 'randomAlly'].includes(target) ? true : friendly;
    if (!helpful) return;
    const count = target === 'allAllies' ? party : 1;
    const amount: [number, number] = [mean(action.dice) * rate * count, (action.scaling ? action.factor ?? 1 : 0) * rate * count];
    if (action.type === 'heal') {
      capacities.healing.push(amount);
      if (preservableHot) capacities.hot.push(amount);
    }
    if (action.type === 'shield' && action.duration != null) capacities.shield.push(amount);
    if (action.type !== 'status' || depth >= 2 || !action.statusId) return;
    const status = statuses.get(action.statusId);
    if (!status) return;
    const finite = action.duration !== null && (action.duration !== undefined || status.defaultDuration !== null);
    const duration = Math.min(4, action.duration ?? status.defaultDuration ?? 3);
    for (const child of status.actions) record(child, helpful, rate * duration * count,
      finite && !!status.trigger && status.tags.includes('HOT') && status.stacking !== 'decay', depth + 1);
  };
  for (const skill of content.skills) if (learned.has(skill.id) && (party > 1 || skill.condition !== 'hasOtherAlly')) for (const action of skill.actions) {
    record({ ...action, target: action.target ?? skill.target }, !['enemy', 'lowestHealthEnemy', 'allEnemies', 'randomEnemy'].includes(skill.target), 1 / Math.max(2, skill.cooldown + 1), false, 0);
  }
  const trainedRepeat = definition.id === 'ranger' && definition.passive?.rarity && definition.passive.rarity !== 'common' ? definition.modifiers.repeatAttack : undefined;
  // Catalogue order and item anatomy are fixed throughout this search.
  const sortedBonuses = new Map<string, EquipmentSetBonusDefinition[]>();
  const bonusesFor = (id: string) => {
    let bonuses = sortedBonuses.get(id);
    if (!bonuses) { bonuses = [...(content.equipmentCatalog?.sets[id]?.bonuses ?? [])].sort((a, b) => a.pieces - b.pieces); sortedBonuses.set(id, bonuses); }
    return bonuses;
  };
  const capacity = (kind: keyof typeof capacities, power: number) => {
    let maximum = 0;
    for (const [constant, scaling] of capacities[kind]) maximum = Math.max(maximum, constant + power * scaling);
    return maximum;
  };

  const score = (equipment: readonly StarterEquipment[]): number => {
    const gear = equipment.map(feature), stats = [...base];
    const maxima = [...baseMaxima], armor = BODY_PARTS.map(() => 0);
    for (let index = 0; index < BODY_PARTS.length; index++) {
      let resources = 0;
      for (const entry of gear) { resources += entry.resources[index]; armor[index] += entry.armor[index]; }
      maxima[index] += resources;
    }
    const functional = BODY_PARTS.map((part, index) => attached[index] && (!body || Math.floor(body[part].current / body[part].max * maxima[index]) > 0));
    const pieces = new Map<string, Set<string>>(), weapons: Array<{ feature: ItemFeatures; power: number }> = [];
    let rarity = 0;
    for (const entry of gear) {
      const active = entry.hands.every(index => functional[index]) ? entry.fraction : 0;
      for (let index = 0; index < attributes.length; index++) stats[index] += entry.bonuses[index] * active;
      rarity += entry.rank * active;
      if (!active) continue;
      if (entry.item.setId) {
        let ids = pieces.get(entry.item.setId);
        if (!ids) pieces.set(entry.item.setId, ids = new Set());
        ids.add(entry.baseId);
      }
      if (entry.item.weapon?.damage && entry.item.weapon.kind !== 'shield') weapons.push({ feature: entry, power: entry.bonuses[0] * active });
    }
    const sources: Modifiers[] = [definition.modifiers];
    for (const id of [...pieces.keys()].sort(compareIds)) {
      for (const bonus of bonusesFor(id)) {
        if (bonus.pieces > pieces.get(id)!.size) continue;
        sources.push(bonus.modifiers);
        if (bonus.aura) sources.push(bonus.aura.modifiers);
      }
    }
    // Same override order as modifiersFor; extra damage dice alone are separate
    // sources and must add together, even when the authored dice are identical.
    const modifiers: Modifiers = {};
    let bonusDamage = 0, armorBonus = 0, reduction = 0;
    let invulnerable = false, guaranteedCrit = false;
    for (const source of sources) {
      const previousRepeat = modifiers.repeatAttack;
      Object.assign(modifiers, source);
      modifiers.repeatAttack = strongerRepeatCheck(trainedRepeat, source.repeatAttack ?? previousRepeat);
      for (let index = 0; index < attributes.length; index++) stats[index] += source[modifierKeys[index]] ?? 0;
      bonusDamage += mean(source.damageBonusDice) + (source.damageBonus ?? 0);
      armorBonus += source.armorBonus ?? 0;
      reduction += (source.damageReduction ?? 0) + (source.partyDamageReduction ?? 0) * party;
      invulnerable ||= !!source.invulnerable; guaranteedCrit ||= !!source.guaranteedCrit;
    }
    const [rawPower, initiative, accuracy, evasion, crit, resilience, agility, luck] = stats;
    const power = Math.max(0, rawPower);
    let result = power * AUTO_EQUIPMENT_WEIGHTS.power
      + softCap(evasion, 19) * AUTO_EQUIPMENT_WEIGHTS.evasion
      + softCap(accuracy, 20) * AUTO_EQUIPMENT_WEIGHTS.accuracy
      + softCap(crit, 19) * AUTO_EQUIPMENT_WEIGHTS.crit
      + softCap(resilience, 20) * AUTO_EQUIPMENT_WEIGHTS.resilience
      + softCap(initiative, 20) * AUTO_EQUIPMENT_WEIGHTS.initiative
      + softCap(agility, 20) * AUTO_EQUIPMENT_WEIGHTS.agility
      + Math.min(19, luck) * luckWeight;

    const hit = clamp((20 - (8 + quality * 8 - accuracy)) / 20, .05, .95);
    const critical = guaranteedCrit ? 1 : clamp((1 + crit - quality * 6) / 20, .05, 1);
    const otherPower = weapons.reduce((sum, weapon) => sum + weapon.power, 0);
    let attack = weapons.reduce((sum, weapon) => sum + Math.max(0, weapon.feature.damage
      + weaponAttackBonusMultiplier(weapon.feature.item.weapon)
        * ((definition.basicAttack.scaling ? Math.max(0, power - otherPower + weapon.power) * (definition.basicAttack.factor ?? 1) : 0) + bonusDamage)), 0);
    if (!gear.some(entry => entry.item.weapon)) attack = Math.max(0, mean(definition.basicAttack.dice)
      + (definition.basicAttack.scaling ? power * (definition.basicAttack.factor ?? 1) : 0) + bonusDamage) * (definition.basicAttack.hits ?? 1);
    attack *= hit * (1 + critical);
    result += attack * 1.4 * (1 + chance(modifiers.repeatAttack));

    for (let index = 0; index < BODY_PARTS.length; index++) {
      if (attached[index]) result += maxima[index] * AUTO_EQUIPMENT_WEIGHTS.durability * (index < 2 ? 1.5 : 1);
      result += armorMean(armorBonus + armor[index]) * hitWeights[index] * AUTO_EQUIPMENT_WEIGHTS.armor;
    }
    result += clamp(reduction, 0, content.balance.maxDamageReduction) * 5;
    result += mean(modifiers.partyGuardDice) * (1 + (party - 1) * .65) * 5;
    const drain = Math.min(attack, mean(modifiers.vampirismDice) * Math.max(1, weapons.length) * hit);
    result += drain * 3;
    // A solo hero without healing or life drain cannot trigger healing sharing.
    if (party > 1 || drain > 0 || capacity('healing', power) > 0) result += mean(modifiers.healingShareDice) * (1 + (party - 1) * .65) * 2;
    result += capacity('shield', power) * clamp(chance(modifiers.preserveShield) / Math.max(.05, 1 - chance(modifiers.preserveShield)), 0, 2) * 2;
    result += capacity('hot', power) * clamp(chance(modifiers.preserveHot) / Math.max(.05, 1 - chance(modifiers.preserveHot)), 0, 2) * 2;
    if (invulnerable) result += 120;
    // Colour breaks only practically equal utility; it never substitutes for stats.
    return Math.round((result + rarity * .001) * 10000) / 10000;
  };
  return { score, luckWeight, quality };
}
