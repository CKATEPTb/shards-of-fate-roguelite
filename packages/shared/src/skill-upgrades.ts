import type { HeroLoadout, NativeSkillRarities } from './adventure';
import type { DiceCheck, GameContent, SkillDefinition, UnitDefinition } from './model';
import { REWARD_RARITIES, type RewardRarity } from './rewards';
import type { SkillIconDefinition } from './skills';

export const COMMON_NATIVE_SKILL_RARITIES: Readonly<NativeSkillRarities> = Object.freeze({ class: 'common', active: 'common', passive: 'common' });
export type HeroAbilitySlot = keyof NativeSkillRarities | 'skill0' | 'skill1';

/** Canonical identity is also used by animation aliases and duplicate-slot checks. */
export function baseSkillId(id: string): string { return id.replace(/__(?:rare|epic|legendary)$/, ''); }
export function skillUpgradeId(id: string, rarity: RewardRarity): string {
  return rarity === 'common' ? baseSkillId(id) : `${baseSkillId(id)}__${rarity}`;
}
export function nextSkillUpgradeId(skill: SkillDefinition, content: Pick<GameContent, 'skills'>): string | undefined {
  const next = REWARD_RARITIES[REWARD_RARITIES.indexOf(skill.rarity ?? 'common') + 1];
  if (!next) return undefined;
  const id = skillUpgradeId(skill.id, next);
  return content.skills.some(candidate => candidate.id === id && candidate.tags.includes('UPGRADED')) ? id : undefined;
}
export function nativePassiveCheck(rarity: RewardRarity): DiceCheck {
  return rarity === 'common' ? { dice: '1d4', atLeast: 4 }
    : { dice: '1d20', atLeast: rarity === 'rare' ? 14 : rarity === 'epic' ? 12 : 10 };
}

/** Authored repeat checks use one die. A temporary buff must not weaken a trained passive. */
export function strongerRepeatCheck(current?: DiceCheck, incoming?: DiceCheck): DiceCheck | undefined {
  if (!current || !incoming) return incoming ?? current;
  const probability = (check: DiceCheck) => {
    const match = /^1?d(\d+)$/i.exec(check.dice);
    return match ? Math.max(0, Math.min(1, (Number(match[1]) - check.atLeast + 1) / Number(match[1]))) : undefined;
  };
  const a = probability(current), b = probability(incoming);
  return a !== undefined && b !== undefined && a > b ? current : incoming;
}

/** Result dice only. Callers must never use this for accuracy, critical or chance checks. */
export function upgradeResultDice(expression: string, tiers: number): string {
  if (!tiers) return expression;
  const match = /^(\d*)d(\d+)(\s*[+-]\s*\d+)?$/i.exec(expression.trim());
  if (!match) throw new Error('Неверная формула кубика улучшаемого навыка.');
  const sides = Number(match[2]) + tiers * 2;
  if (sides < 1 || sides > 1_000_000) throw new Error('Недопустимое усиление кубика.');
  return `${match[1] || '1'}d${sides}${match[3]?.replace(/\s/g, '') ?? ''}`;
}

/** Derive only this hero. Shared class definitions are never overwritten. */
export function applyNativeSkillRarities(hero: UnitDefinition, loadout: Pick<HeroLoadout, 'nativeSkillRarities'>, content: GameContent): UnitDefinition {
  const ranks = loadout.nativeSkillRarities ?? COMMON_NATIVE_SKILL_RARITIES;
  const level = REWARD_RARITIES.indexOf(ranks.passive);
  if ((['class', 'active', 'passive'] as const).some(slot => !REWARD_RARITIES.includes(ranks[slot]))) throw new Error('Неизвестная редкость врождённого навыка.');
  const prior = REWARD_RARITIES.indexOf(hero.passive?.rarity ?? 'common');
  if (Object.values(ranks).every(rank => rank === 'common') && prior === 0
    && !hero.skillIds.some(id => id !== baseSkillId(id))) return hero;
  const delta = level - prior;
  const skillIds = hero.skillIds.map(id => {
    const skill = content.skills.find(candidate => candidate.id === id);
    const rarity = skill?.tags.includes('ROLE') ? ranks.class : skill?.tags.includes('CHARACTER') ? ranks.active : undefined;
    if (!rarity) return id;
    const upgraded = skillUpgradeId(id, rarity);
    if (!content.skills.some(candidate => candidate.id === upgraded)) throw new Error('Вариант врождённого навыка не найден.');
    return upgraded;
  });
  const modifiers = { ...hero.modifiers };
  let description = hero.passive?.description;
  if (hero.id === 'guardian' && modifiers.partyGuardDice) {
    modifiers.partyGuardDice = upgradeResultDice(modifiers.partyGuardDice, delta);
    description = `Перед каждым прямым ударом по живому участнику своего отряда, включая себя, бросает ${modifiers.partyGuardDice} и уменьшает оставшийся урон на результат, вплоть до нуля. Сила к этому кубику не добавляется.`;
  } else if (hero.id === 'vampire' && modifiers.vampirismDice) {
    modifiers.vampirismDice = upgradeResultDice(modifiers.vampirismDice, delta);
    description = `После прямого урона здоровью врага восстанавливает ${modifiers.vampirismDice} HP, не больше нанесённого урона. Сила к броску не добавляется. Поглощённый щитом урон не лечит; утраченные части тела не отрастают.`;
  } else if (hero.id === 'paladin' && modifiers.healingShareDice) {
    modifiers.healingShareDice = upgradeResultDice(modifiers.healingShareDice, delta);
    description = `Получив реальное лечение, бросает ${modifiers.healingShareDice} и восстанавливает столько HP каждому живому участнику своего отряда, включая себя. Сила не добавляется. Это лечение не запускает новую передачу.`;
  } else if (hero.id === 'rogue' && modifiers.evasionBonus !== undefined) {
    modifiers.evasionBonus += delta;
    description = `+${modifiers.evasionBonus} к Уклонению. Чтобы попасть, враг должен выбросить на 1d20 больше Уклонения минус его Точность. Натуральная 1 — промах, натуральная 20 — попадание.`;
  } else if (hero.id === 'priest') {
    description = `Каждое исцеление Жрицы накладывает отдельное Благословение: +1d4 к урону каждого удара на ${2 + level} хода получателя. У каждого заряда свой срок и свой бросок; Сила к дополнительному кубику не добавляется.`;
  } else if (hero.id === 'mage') {
    description = `Каждое критическое попадание добавляет ${1 + level} заряд${level === 0 ? '' : 'а'} Горения. В конце хода цель получает урон по общему числу зарядов, после чего теряет 1 заряд. Критическое исцеление Горение не накладывает.`;
  } else if (hero.id === 'druid') {
    modifiers.preserveHot = nativePassiveCheck(ranks.passive);
    description = `После каждого срабатывания наложенного Друидом периодического исцеления бросает ${modifiers.preserveHot.dice}: на ${modifiers.preserveHot.atLeast}+ продлевает эту ауру на 1 ход. В конце хода получателя срок уменьшается как обычно. Бонусы к проверке не добавляются; работает, пока Друид участвует в бою.`;
  } else if (hero.id === 'necromancer') {
    modifiers.preserveShield = nativePassiveCheck(ranks.passive);
    description = `Когда созданный Некромантом временный щит должен поглотить урон, бросает ${modifiers.preserveShield.dice}: на ${modifiers.preserveShield.atLeast}+ полностью поглощает оставшийся удар без расхода ёмкости. Бонусы к проверке не добавляются. Срок щита уменьшается как обычно; работает, пока Некромант участвует в бою.`;
  } else if (hero.id === 'ranger') {
    modifiers.repeatAttack = nativePassiveCheck(ranks.passive);
    description = `После действия с уроном бросает ${modifiers.repeatAttack.dice}: на ${modifiers.repeatAttack.atLeast}+ выполняет дополнительную базовую атаку по той же живой цели. Бонусы к проверке не добавляются; повтор не вызывает цепочку. Из действующих правил повтора используется наиболее вероятное.`;
  }
  const effectIds = hero.effectIds.map(id => {
    const base = baseSkillId(id);
    if (base !== 'priest_benediction' && base !== 'mage_ember_spark') return id;
    const upgraded = skillUpgradeId(base, ranks.passive);
    if (!content.effects.some(effect => effect.id === upgraded)) throw new Error('Вариант пассивного эффекта не найден.');
    return upgraded;
  });
  return { ...hero, skillIds, effectIds, modifiers,
    ...(hero.passive ? { passive: { ...hero.passive, description: level === 0 && prior === 0 ? hero.passive.description : description!, rarity: ranks.passive } } : {}) };
}

export interface HeroAbilityPreview {
  id: string;
  name: string;
  description: string;
  rarity: RewardRarity;
  /** Native icons retain their canonical identity; learned skills carry authored artwork. */
  iconId: string;
  icon?: SkillIconDefinition;
  skill?: SkillDefinition;
}
export interface HeroAbilityUpgrade {
  slot: HeroAbilitySlot;
  current: HeroAbilityPreview | null;
  next: HeroAbilityPreview | null;
}

function skillPreview(skill: SkillDefinition): HeroAbilityPreview {
  return { id: skill.id, name: skill.name, description: skill.description, rarity: skill.rarity ?? 'common',
    iconId: baseSkillId(skill.id), ...(skill.icon ? { icon: skill.icon } : {}), skill };
}

/** All five inspectable slots, including empty extra slots; no purchase or state mutation. */
export function listHeroAbilityUpgrades(hero: UnitDefinition, loadout: HeroLoadout, content: GameContent): HeroAbilityUpgrade[] {
  const ranks = loadout.nativeSkillRarities ?? COMMON_NATIVE_SKILL_RARITIES;
  const derived = applyNativeSkillRarities(hero, loadout, content);
  return (['class', 'active', 'passive', 'skill0', 'skill1'] as const).map(slot => {
    if (slot === 'passive') {
      const rarity = ranks.passive, nextRarity = REWARD_RARITIES[REWARD_RARITIES.indexOf(rarity) + 1];
      const preview = (unit: UnitDefinition): HeroAbilityPreview | null => unit.passive ? {
        id: `${hero.id}_passive`, name: unit.passive.name, description: unit.passive.description,
        rarity: unit.passive.rarity ?? 'common', iconId: `${hero.id}:passive`,
      } : null;
      const next = nextRarity ? applyNativeSkillRarities(hero, { nativeSkillRarities: { ...ranks, passive: nextRarity } }, content) : undefined;
      return { slot, current: preview(derived), next: next ? preview(next) : null };
    }
    const id = slot === 'skill0' || slot === 'skill1' ? loadout.skills[slot === 'skill0' ? 0 : 1]
      : derived.skillIds.find(id => content.skills.find(skill => skill.id === id)?.tags.includes(slot === 'class' ? 'ROLE' : 'CHARACTER'));
    const skill = content.skills.find(skill => skill.id === id);
    const nextId = skill && nextSkillUpgradeId(skill, content), next = content.skills.find(skill => skill.id === nextId);
    return { slot, current: skill ? skillPreview(skill) : null, next: next ? skillPreview(next) : null };
  });
}
