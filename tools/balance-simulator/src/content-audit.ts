import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actOneBossMetadata, actOneEnemyMetadata, applyEquipmentToHero, equipmentForSet, equipItem, gameContent } from '@shards/game-data';
import { activeEquipmentSetBonuses, bodyPartArmor, parseDice, startHeroBody } from '@shards/game-core';
import { BODY_PARTS, equipmentItemFitsSlot, type ActionDefinition, type GameContent, type RewardRarity, type UnitDefinition } from '@shards/shared';
import { equipmentLootPool, featuredEquipmentSetIds } from '../../../packages/game-core/src/coop/equipment-loot-pool';

const rarities: RewardRarity[] = ['common', 'rare', 'epic', 'legendary'];
const attributes = ['power', 'initiative', 'evasion', 'crit', 'agility', 'accuracy', 'resilience', 'luck'] as const;
const round = (value: number) => Number(value.toFixed(5));
function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
  return { count: sorted.length, min: quantile(0), median: quantile(.5), p90: quantile(.9), max: quantile(1), mean: round(values.reduce((sum, value) => sum + value, 0) / (values.length || 1)) };
}
const tally = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map(key => [key, values.filter(value => value === key).length]));
const diceMean = (expression?: string) => {
  if (!expression) return 0;
  const dice = parseDice(expression);
  return dice.count * (dice.sides + 1) / 2 + dice.modifier;
};

/** Exact probability of each final rarity under the current repeated d20 upgrade rule. */
export function rarityProbabilities(base: RewardRarity, luck: number): Record<RewardRarity, number> {
  const upgrade = Array.from({ length: 20 }, (_, index) => index + 1).filter(face => face >= 20 - luck).length / 20;
  const result = { common: 0, rare: 0, epic: 0, legendary: 0 };
  let remaining = 1;
  for (let index = rarities.indexOf(base); index < rarities.length; index++) {
    const final = index === rarities.length - 1;
    result[rarities[index]] = remaining * (final ? 1 : 1 - upgrade);
    remaining *= upgrade;
  }
  return result;
}

/** Seeded diagnostic RNG, independent of all gameplay streams. */
function auditRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Possession is an upper bound on wearable set bonuses: hand conflicts and lost limbs are ignored. */
export function setCollectionOdds(content: GameContent, draws: number, trials = 20_000, base: RewardRarity | 'uniform-catalog' = 'common', luck = 0, mode: 'uniform' | 'featured' = 'uniform') {
  if (!Number.isInteger(draws) || draws < 1 || !Number.isInteger(trials) || trials < 1) throw new Error('draws and trials must be positive integers');
  const catalog = content.equipmentCatalog;
  if (!catalog) throw new Error('Equipment catalog is required');
  const items = Object.values(catalog.items).filter(item => item.setId && catalog.sets[item.setId]?.bonuses?.length);
  const pools = rarities.map(rarity => items.filter(item => item.rarity === rarity));
  const odds = base === 'uniform-catalog' ? undefined : rarityProbabilities(base, luck);
  const random = auditRandom(0xA71D17 + draws * 17 + rarities.indexOf(base as RewardRarity) + luck * 31);
  // Reuse 64 independently seeded theme rosters to avoid re-sorting a large catalog for every drop.
  const themes = mode === 'featured' ? Array.from({ length: 64 }, (_, index) => rarities.map(rarity => featuredEquipmentSetIds(catalog, `collection-model-v1:${index}`, 'guardian', rarity))) : [];
  const focused = themes.map(roster => roster.map((ids, index) => equipmentLootPool(pools[index], ids, 1)));
  const hit = [0, 0, 0], totals = [0, 0, 0];
  let maxPieces = 0;
  for (let trial = 0; trial < trials; trial++) {
    const used = new Set<string>(), sets = new Map<string, number>();
    for (let draw = 0; draw < draws; draw++) {
      let pool = items, rarityIndex = -1;
      if (odds) {
        const face = random(); let cumulative = 0;
        rarityIndex = rarities.findIndex(rarity => (cumulative += odds[rarity]) > face);
        pool = pools[rarityIndex < 0 ? 3 : rarityIndex];
      }
      if (!pool.length) continue;
      const unrestricted = pool;
      if (mode === 'featured' && rarityIndex >= 0 && random() < .8) pool = focused[trial % themes.length][rarityIndex];
      let item = pool[Math.floor(random() * pool.length)];
      // Gameplay excludes definitions already collected by this hero.
      if (used.has(item.id)) {
        let available = pool.filter(candidate => !used.has(candidate.id));
        if (!available.length) available = unrestricted.filter(candidate => !used.has(candidate.id));
        if (!available.length) continue;
        item = available[Math.floor(random() * available.length)];
      }
      used.add(item.id);
      sets.set(item.setId!, (sets.get(item.setId!) ?? 0) + 1);
    }
    const counts = [...sets.values()];
    maxPieces += Math.max(0, ...counts);
    [2, 4, 6].forEach((threshold, index) => {
      const count = counts.filter(pieces => pieces >= threshold).length;
      if (count) hit[index]++;
      totals[index] += count;
    });
  }
  return { draws, trials, base, luck, mode, meanLargestSet: round(maxPieces / trials), thresholds: [2, 4, 6].map((pieces, index) => {
    const p = hit[index] / trials, z = 1.959963984540054, denominator = 1 + z * z / trials;
    const center = (p + z * z / (2 * trials)) / denominator;
    const radius = z * Math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials)) / denominator;
    return { pieces, probabilityAny: round(p), confidence95: [round(Math.max(0, center - radius)), round(Math.min(1, center + radius))], meanSets: round(totals[index] / trials), ...(hit[index] === 0 ? { zeroObserved95PercentUpperBound: round(3 / trials) } : {}) };
  }) };
}

function directAmount(action: ActionDefinition, power: number) {
  return (diceMean(action.dice) + (action.scaling ? Math.floor(power * (action.factor ?? 1)) : 0)) * (action.hits ?? 1);
}
function unitStats(units: UnitDefinition[]) {
  return { count: units.length, roles: tally(units.map(unit => unit.role)), stats: Object.fromEntries(['maxHp', 'armor', ...attributes].map(key => [key, distribution(units.map(unit => unit.stats[key as keyof UnitDefinition['stats']] ?? 0))])) };
}

/** A feasible mixed-set witness, not a claim of a globally optimal build. */
function mixedLuckWitness(content: GameContent, reference: UnitDefinition) {
  const catalog = content.equipmentCatalog!;
  const items = Object.values(catalog.items);
  const slots = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2'] as const;
  let best: { luck: number; rarity: RewardRarity; equipment: { id: string; slot: string }[] } | undefined;
  for (const set of Object.values(catalog.sets).filter(set => set.rarity && set.bonuses?.some(bonus => bonus.pieces === 6 && bonus.modifiers.luckBonus))) {
    const outfit = equipmentForSet(set.id);
    const fillers = slots.map(slot => items.filter(item => item.rarity === set.rarity && equipmentItemFitsSlot(item, slot))
      .sort((a, b) => (b.bonuses?.luck ?? 0) - (a.bonuses?.luck ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
    for (let mask = 0; mask < 1 << outfit.length; mask++) {
      const selected = outfit.filter((_, index) => mask & 1 << index);
      if (selected.length !== 6) continue;
      const used = new Set(selected.map(item => item.id));
      slots.forEach((slot, index) => {
        if (selected.some(item => item.slot === slot)) return;
        const item = fillers[index].find(item => !used.has(item.id));
        if (item) { selected.push(equipItem(item.id, slot)); used.add(item.id); }
      });
      const hero = applyEquipmentToHero(reference, selected);
      const luck = (hero.stats.luck ?? 0) + activeEquipmentSetBonuses(hero).reduce((sum, active) => sum + active.bonuses.reduce((total, bonus) => total + (bonus.modifiers.luckBonus ?? 0), 0), 0);
      if (!best || luck > best.luck) best = { luck, rarity: set.rarity!, equipment: selected.map(item => ({ id: item.id!, slot: item.slot })) };
    }
  }
  return best;
}

export function buildContentAudit(content: GameContent = gameContent, collectionTrials = 20_000) {
  const catalog = content.equipmentCatalog;
  if (!catalog) throw new Error('Equipment catalog is required');
  const items = Object.values(catalog.items), sets = Object.values(catalog.sets);
  const enemies = content.enemies.filter(enemy => actOneEnemyMetadata(enemy));
  const bosses = content.enemies.filter(enemy => actOneBossMetadata(enemy));
  const reference = content.characters.find(hero => hero.id === 'guardian') ?? content.characters[0];
  // The canonical loadout helpers use the shipped catalog; custom-catalog audits must supply matching IDs.
  const outfits = sets.filter(set => set.bonuses?.length && set.rarity).map(set => {
    const hero = applyEquipmentToHero(reference, equipmentForSet(set.id));
    const bonuses = activeEquipmentSetBonuses(hero).flatMap(active => active.bonuses.flatMap(bonus => [bonus.modifiers, bonus.aura?.modifiers ?? {}]));
    const stats = Object.fromEntries(attributes.map(key => [key, (hero.stats[key] ?? 0) + bonuses.reduce((total, bonus) => total + (bonus[`${key}Bonus` as keyof typeof bonus] as number ?? 0), 0)]));
    const body = startHeroBody(hero);
    return { setId: set.id, rarity: set.rarity!, pieces: hero.anatomy!.equipment.length, maxHp: hero.stats.maxHp, ...stats, armorByPart: Object.fromEntries(BODY_PARTS.map(part => [part, bodyPartArmor(hero, body, part)])), capstone: set.bonuses!.find(bonus => bonus.pieces === 6)?.aura?.modifiers ?? set.bonuses!.find(bonus => bonus.pieces === 6)?.modifiers ?? {} };
  });
  const skills = content.skills.map(skill => ({ id: skill.id, rarity: skill.rarity ?? 'innate-or-enemy', cooldown: skill.cooldown, target: skill.target, condition: skill.condition,
    directAtPower20: Object.fromEntries(['damage', 'heal', 'shield'].map(type => [type, round(skill.actions.filter(action => action.type === type).reduce((sum, action) => sum + directAmount(action, 20), 0))])),
    allTargetDamageAtPower20: round(skill.actions.filter(action => action.type === 'damage').reduce((sum, action) => sum + directAmount(action, 20) * ((action.target ?? skill.target) === 'allEnemies' ? 4 : 1), 0)),
  }));
  const itemBoundsByRarityAndSlot = Object.fromEntries(rarities.map(rarity => [rarity, Object.fromEntries(['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'hand'].map(slot => {
    const matching = items.filter(item => item.rarity === rarity && item.slot === slot);
    return [slot, {
      count: matching.length,
      totalAddedBodyResources: distribution(matching.map(item => Object.values(item.resources).reduce((sum, value) => sum + value, 0))),
      localArmor: distribution(matching.map(item => item.armor)),
      attributeBonusTotal: distribution(matching.map(item => Object.values(item.bonuses ?? {}).reduce((sum, value) => sum + value, 0))),
      weaponDiceMean: distribution(matching.filter(item => item.weapon?.damage).map(item => diceMean(item.weapon!.damage))),
    }];
  }))]));
  const skillsByRarity = Object.fromEntries(rarities.map(rarity => {
    const matching = skills.filter(skill => skill.rarity === rarity);
    return [rarity, {
      count: matching.length, cooldown: distribution(matching.map(skill => skill.cooldown)), targets: tally(matching.map(skill => skill.target)),
      directDamageAtPower20: distribution(matching.filter(skill => skill.directAtPower20.damage > 0).map(skill => skill.directAtPower20.damage)),
      directHealingAtPower20: distribution(matching.filter(skill => skill.directAtPower20.heal > 0).map(skill => skill.directAtPower20.heal)),
      directShieldsAtPower20: distribution(matching.filter(skill => skill.directAtPower20.shield > 0).map(skill => skill.directAtPower20.shield)),
      fourTargetDamageAtPower20: distribution(matching.filter(skill => skill.allTargetDamageAtPower20 > 0).map(skill => skill.allTargetDamageAtPower20)),
    }];
  }));
  const invulnerability = content.statuses.filter(status => status.modifiers.invulnerable).map(status => ({ statusId: status.id, stacking: status.stacking, expiresAt: status.expiresAt, applications: content.skills.flatMap(skill => skill.actions.filter(action => action.statusId === status.id || action.onHitStatusId === status.id).map(action => ({ skillId: skill.id, cooldown: skill.cooldown, target: action.target ?? skill.target, duration: action.duration ?? action.onHitDuration ?? status.defaultDuration }))) }));
  const indefiniteApplications = content.skills.flatMap(skill => skill.actions.filter(action => action.type === 'status' && action.duration === null).map(action => ({ skillId: skill.id, statusId: action.statusId, cooldown: skill.cooldown, stacking: content.statuses.find(status => status.id === action.statusId)?.stacking ?? 'independent' })));
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), assumptions: [
      'Static action means exclude accuracy, critical hits, armor, shields, secondary statuses, cooldown opportunity cost, and target availability.',
      'Set collection counts equipment drops only, excludes duplicate definitions, and uses possession as an upper bound on wearable thresholds. Combat also awards skills.',
      'Uniform-catalog is a diagnostic comparison. Fixed-base scenarios reproduce repeated rarity upgrades but omit distance progression and equipped luck changes.',
      'Featured scenarios reuse 64 independently seeded theme rosters and a diagnostic RNG for the same d5 probabilities; these are collection models, not complete campaign simulations.',
      'Zero observed events are not proof of impossibility; the report includes the rule-of-three approximate 95% upper bound.',
      'Full-outfit stats use the guardian as a fixed reference and include cumulative 2/4/6-piece bonuses with intact anatomy.',
    ],
    counts: { heroes: content.characters.length, enemies: content.enemies.length, ordinaryActOneEnemies: enemies.length, bosses: bosses.length, skills: content.skills.length, learnableSkills: content.skills.filter(skill => skill.rarity).length, statuses: content.statuses.length, equipmentItems: items.length, sets: sets.length },
    equipment: { itemRarities: tally(items.map(item => item.rarity)), eligibleLootItemRarities: tally(items.filter(item => item.setId && catalog.sets[item.setId]?.bonuses?.length).map(item => item.rarity)), setRarities: tally(sets.map(set => set.rarity ?? 'starter')), itemBoundsByRarityAndSlot, fullOutfitReference: reference.id,
      fullOutfitsByRarity: Object.fromEntries(rarities.map(rarity => { const matching = outfits.filter(outfit => outfit.rarity === rarity); return [rarity, Object.fromEntries(['maxHp', ...attributes].map(key => [key, distribution(matching.map(outfit => Number(outfit[key as keyof typeof outfit])))]))]; })),
      luckiestOutfits: [...outfits].sort((a, b) => Number(b['luck' as keyof typeof b]) - Number(a['luck' as keyof typeof a])).slice(0, 8),
      capstoneFrequencies: tally(outfits.map(outfit => Object.keys(outfit.capstone).sort().join('+'))),
    },
    ordinaryEnemies: { overall: unitStats(enemies), seasons: tally(enemies.map(enemy => actOneEnemyMetadata(enemy)!.season)), habitats: tally(enemies.map(enemy => actOneEnemyMetadata(enemy)!.habitat)), tiers: Object.fromEntries([1, 2, 3, 4, 5].map(tier => [tier, unitStats(enemies.filter(enemy => actOneEnemyMetadata(enemy)!.tier === tier))])) },
    bosses: { overall: unitStats(bosses), bySeason: Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map(season => [season, unitStats(bosses.filter(enemy => actOneBossMetadata(enemy)!.season === season))])), highestHp: [...bosses].sort((a, b) => b.stats.maxHp - a.stats.maxHp).slice(0, 5).map(enemy => ({ id: enemy.id, stats: enemy.stats, skillIds: enemy.skillIds })) },
    scaling: { difficulties: content.difficulties, party: content.balance.partyScaling, note: 'Party damage scaling multiplies enemy power, not the flat dice portion. Difficulty damage scaling multiplies direct and ordinary status damage, excluding fixed decay damage.' },
    rarity: { rule: 'Each rarity step succeeds when d20 >= 20 - luck; repeat until failure or legendary.', feasibleMixedLuckBuild: mixedLuckWitness(content, reference), curves: [0, 2, 5, 10, 15, 19, 25].map(luck => ({ luck, fromCommon: rarityProbabilities('common', luck), fromEpic: rarityProbabilities('epic', luck) })) },
    skillsByRarity,
    skillExtremes: { highestDirectSingleTargetDamageAtPower20: [...skills].sort((a, b) => b.directAtPower20.damage - a.directAtPower20.damage).slice(0, 12), highestFourTargetDamageAtPower20: [...skills].sort((a, b) => b.allTargetDamageAtPower20 - a.allTargetDamageAtPower20).slice(0, 12), highestDirectHealingAtPower20: [...skills].sort((a, b) => b.directAtPower20.heal - a.directAtPower20.heal).slice(0, 12) },
    statuses: { invulnerability, indefiniteApplications, remainingDurationScaling: content.statuses.filter(status => status.actions.some(action => action.scaleWithRemainingDuration)).map(status => status.id), independentPositiveStatuses: content.statuses.filter(status => status.polarity === 'positive' && (!status.stacking || status.stacking === 'independent')).map(status => status.id) },
    setCollection: [20, 30, 40, 60].flatMap(draws => ['uniform-catalog', 'common', 'epic'].map(base => setCollectionOdds(content, draws, collectionTrials, base as RewardRarity | 'uniform-catalog'))),
    featuredSetCollection: [20, 30, 40, 60].flatMap(draws => (['common', 'epic'] as const).map(base => setCollectionOdds(content, draws, collectionTrials, base, 0, 'featured'))),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  const trialsIndex = process.argv.indexOf('--trials');
  const report = buildContentAudit(gameContent, trialsIndex >= 0 ? Number(process.argv[trialsIndex + 1]) : 20_000);
  const output = resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : 'docs/reports/content-audit.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Content audit: ${output}; ${report.counts.ordinaryActOneEnemies} ordinary enemies, ${report.counts.bosses} bosses.`);
  console.log(JSON.stringify({ outfitStats: report.equipment.fullOutfitsByRarity, luckiest: report.equipment.luckiestOutfits[0], setCollection: report.setCollection }, null, 2));
}
