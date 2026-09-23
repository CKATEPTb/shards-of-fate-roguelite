import type { EquipmentSetBonusDefinition, Modifiers, StarterEquipment } from '@shards/shared';
import { auraVisual, type AuraDesign, type AuraFamily } from './aura-profiles';

export type EquipmentAttribute = keyof NonNullable<StarterEquipment['bonuses']>;
export interface EquipmentBuildProfile {
  name: string;
  primary: EquipmentAttribute;
  secondary: EquipmentAttribute;
  supporting: EquipmentAttribute;
  capstone: 'strike' | 'guard' | 'drain' | 'mercy' | 'ward' | 'renewal' | 'echo' | 'precision' | 'resolve' | 'fortune';
}

/** Roles describe a build, never a restriction on the character who can wear it. */
export const EQUIPMENT_BUILD_PROFILES: readonly EquipmentBuildProfile[] = [
  { name: 'Натиск', primary: 'power', secondary: 'accuracy', supporting: 'initiative', capstone: 'strike' },
  { name: 'Защита отряда', primary: 'resilience', secondary: 'power', supporting: 'agility', capstone: 'guard' },
  { name: 'Похищение жизни', primary: 'power', secondary: 'crit', supporting: 'resilience', capstone: 'drain' },
  { name: 'Общее исцеление', primary: 'power', secondary: 'resilience', supporting: 'luck', capstone: 'mercy' },
  { name: 'Сохранение щитов', primary: 'resilience', secondary: 'power', supporting: 'initiative', capstone: 'ward' },
  { name: 'Долгая регенерация', primary: 'power', secondary: 'initiative', supporting: 'evasion', capstone: 'renewal' },
  { name: 'Повтор атаки', primary: 'accuracy', secondary: 'evasion', supporting: 'crit', capstone: 'echo' },
  { name: 'Точный удар', primary: 'crit', secondary: 'accuracy', supporting: 'agility', capstone: 'precision' },
  { name: 'Несгибаемость', primary: 'resilience', secondary: 'evasion', supporting: 'power', capstone: 'resolve' },
  { name: 'Поиск сокровищ', primary: 'luck', secondary: 'agility', supporting: 'evasion', capstone: 'fortune' },
];

export const EQUIPMENT_ATTRIBUTE_NAMES: Record<EquipmentAttribute, string> = {
  power: 'Сила', initiative: 'Инициатива', evasion: 'Уклонение', crit: 'Критический удар',
  agility: 'Проворность', accuracy: 'Точность', resilience: 'Стойкость', luck: 'Удача', healing: 'Сила',
};
const modifierKeys: Record<EquipmentAttribute, keyof Modifiers> = {
  power: 'powerBonus', initiative: 'initiativeBonus', evasion: 'evasionBonus', crit: 'critBonus',
  agility: 'agilityBonus', accuracy: 'accuracyBonus', resilience: 'resilienceBonus', luck: 'luckBonus', healing: 'powerBonus',
};

interface SetAuraSpec {
  name: string;
  summary: string;
  description: string;
  modifiers: Modifiers;
  family: AuraFamily;
  design: AuraDesign;
}

function auraBonus(profile: EquipmentBuildProfile, rank: number, spec: SetAuraSpec): EquipmentSetBonusDefinition {
  const sharedRule = profile.capstone === 'strike' ? ''
    : ' Если действует несколько эффектов с таким особым свойством, используется последний из них; дополнительных проверок они не дают.';
  return {
    pieces: 6, name: profile.name, description: `Аура «${spec.name}»: ${spec.summary}`, modifiers: {},
    aura: {
      id: `equipment-${profile.capstone}-${rank}`, name: spec.name,
      description: `${spec.description}${sharedRule} Действует в бою, пока активны 6 разных предметов комплекта.`,
      modifiers: spec.modifiers,
      visual: auraVisual(spec.family, 20 + rank, {
        count: 6 + rank * 2, radius: 14 + rank, height: 32 + rank * 2, speed: .7 + rank * .1,
        ...spec.design,
      }),
    },
  };
}

/** Every tier is an additive threshold; no percentages or hidden RNG. */
export function catalogueSetBonuses(profile: EquipmentBuildProfile, rank: number): EquipmentSetBonusDefinition[] {
  const primary = 1 + Math.floor(rank / 2), secondary = 1 + Math.floor((rank + 1) / 2);
  const smallDice = ['1d2', '1d4', '1d4', '1d6'][rank];
  const strikeDice = ['1d4', '1d4', '1d6', '1d8'][rank];
  const preserveThreshold = [6, 6, 5, 4][rank];
  const repeatThreshold = [8, 8, 7, 6][rank];
  const final: Record<EquipmentBuildProfile['capstone'], EquipmentSetBonusDefinition> = {
    strike: auraBonus({ ...profile, capstone: 'strike' }, rank, {
      name: 'Печать натиска', summary: `+${strikeDice} к каждому прямому удару.`,
      description: `Каждый прямой удар получает дополнительный ${strikeDice} к урону. Это отдельный бросок без прибавки Силы; критическое попадание удваивает и этот урон.`,
      modifiers: { damageBonusDice: strikeDice }, family: 'war', design: { form: 'arcs', motion: 'pulse', motif: 'claw' },
    }),
    guard: auraBonus({ ...profile, capstone: 'guard' }, rank, {
      name: 'Дозор реликвии', summary: `уменьшает прямой урон по отряду на ${smallDice}.`,
      description: `Если после Защиты и полного блокирования остаётся прямой урон по живому участнику отряда, носитель бросает ${smallDice} и уменьшает урон на результат, вплоть до нуля. Защищает и самого носителя, пока он жив и не покинул бой. При нулевом уроне броска нет.`,
      modifiers: { partyGuardDice: smallDice }, family: 'holy', design: { form: 'wings', motion: 'breathe', motif: 'shield' },
    }),
    drain: auraBonus({ ...profile, capstone: 'drain' }, rank, {
      name: 'Алый отголосок', summary: `после прямого урона здоровью врага лечит носителя на ${smallDice}.`,
      description: `После прямого урона здоровью врага носитель лечится на ${smallDice} без Силы, не больше нанесённого урона. Урон, целиком поглощённый щитом, не лечит.`,
      modifiers: { vampirismDice: smallDice }, family: 'blood', design: { form: 'mist', motion: 'rise', motif: 'drop' },
    }),
    mercy: auraBonus({ ...profile, capstone: 'mercy' }, rank, {
      name: 'Свет сопричастия', summary: `полученное лечение восстанавливает отряду ещё ${smallDice} здоровья.`,
      description: `Получив реальное исцеление, носитель бросает ${smallDice} без Силы и лечит на результат всех живых участников своего отряда, включая себя. Лечение без восстановления здоровья не запускает ауру. Переданное лечение не запускает новую передачу.`,
      modifiers: { healingShareDice: smallDice }, family: 'holy', design: { form: 'halo', motion: 'rise', motif: 'cross' },
    }),
    ward: auraBonus({ ...profile, capstone: 'ward' }, rank, {
      name: 'Нерушимая вязь', summary: `1d6, на ${preserveThreshold}+ сохраняет ёмкость созданного носителем щита.`,
      description: `Когда созданный носителем временный щит должен потратить ёмкость, носитель бросает 1d6: на ${preserveThreshold}+ весь оставшийся урон поглощается без расхода ёмкости. Создатель щита должен быть жив и оставаться в бою. Срок щита уменьшается как обычно.`,
      modifiers: { preserveShield: { dice: '1d6', atLeast: preserveThreshold } }, family: 'arcane', design: { form: 'dome', motion: 'breathe', motif: 'rune' },
    }),
    renewal: auraBonus({ ...profile, capstone: 'renewal' }, rank, {
      name: 'Нить восстановления', summary: `1d6, на ${preserveThreshold}+ продлевает наложенное носителем периодическое лечение на ход.`,
      description: `После тика периодического лечения с конечным сроком, наложенного носителем, бросает 1d6: на ${preserveThreshold}+ этот заряд продлевается на 1 ход. Носитель должен быть жив и оставаться в бою; обычное уменьшение срока в конце хода сохраняется. Чужое периодическое лечение аура не продлевает.`,
      modifiers: { preserveHot: { dice: '1d6', atLeast: preserveThreshold } }, family: 'nature', design: { form: 'roots', motion: 'rise', motif: 'leaf' },
    }),
    echo: auraBonus({ ...profile, capstone: 'echo' }, rank, {
      name: 'Отзвук удара', summary: `1d8, на ${repeatThreshold}+ повторяет базовую атаку по той же цели.`,
      description: `После действия с уроном носитель бросает 1d8: на ${repeatThreshold}+ выполняет дополнительную базовую атаку по той же живой цели. Умение целиком не повторяется; новая цепочка повторов не запускается, погибшая цель не заменяется другой.`,
      modifiers: { repeatAttack: { dice: '1d8', atLeast: repeatThreshold } }, family: 'spirit', design: { form: 'orbit', motion: 'spiral', motif: 'wisp' },
    }),
    precision: { pieces: 6, name: profile.name, modifiers: { accuracyBonus: 1 + rank, critBonus: 2 + rank }, description: `Точность +${1 + rank}, Критический удар +${2 + rank}.` },
    resolve: { pieces: 6, name: profile.name, modifiers: { resilienceBonus: 2 + rank, evasionBonus: 1 + Math.floor(rank / 2) }, description: `Стойкость +${2 + rank}, Уклонение +${1 + Math.floor(rank / 2)}.` },
    fortune: { pieces: 6, name: profile.name, modifiers: { luckBonus: 2 + rank, agilityBonus: 1 + rank }, description: `Удача +${2 + rank}, Проворность +${1 + rank}.` },
  };
  return [
    { pieces: 2, name: 'Первый обет', description: `${EQUIPMENT_ATTRIBUTE_NAMES[profile.primary]} +${primary}.`, modifiers: { [modifierKeys[profile.primary]]: primary } },
    { pieces: 4, name: 'Общая поступь', description: `${EQUIPMENT_ATTRIBUTE_NAMES[profile.secondary]} +${secondary}.`, modifiers: { [modifierKeys[profile.secondary]]: secondary } },
    final[profile.capstone],
  ];
}
