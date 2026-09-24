import { BODY_PARTS, type BodyPart, type BodyResources, type CombatState, type GameContent, type HeroBody, type Modifiers, type RewardRarity, type StarterEquipment } from '@shards/shared';
import { activeEquipmentSetBonuses, canBodyAct, bodyPartArmor, bodyMovementMultiplier, equipmentCondition, isBodyAlive } from '@shards/game-core';
import { gameContent, roleNames } from '../../catalog';
import { activeLoadoutSlot, passiveLoadoutSlot } from './loadoutSkills';
import type { DiceRule } from '../DiceText';

export type EquipmentSlotId = 'helmet' | 'chest' | 'gloves' | 'pants' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'rightHand' | 'leftHand';
export type SkillSlotId = 'class' | 'characterActive' | 'passive' | 'extra1' | 'extra2';
export type LoadoutIconKind = EquipmentSlotId | 'class' | 'characterActive' | 'passive' | 'extra'
  | 'mend' | 'burst' | 'blood' | 'radiance' | 'prayer' | 'regrowth' | 'ward' | 'boneRenewal' | 'precision' | 'volley' | 'fire' | 'evasion';
export interface LoadoutSlot {
  id: EquipmentSlotId | SkillSlotId;
  icon: LoadoutIconKind;
  name: string;
  category: string;
  slotLabel?: string;
  description: string;
  diceRules?: DiceRule[];
  empty: boolean;
  rarity?: RewardRarity;
  contentId?: string;
  equipment?: StarterEquipment;
  occupiedBy?: string;
  cooldown?: { base: number; remaining: number };
  badge?: string;
  condition?: 'active' | 'partial' | 'unavailable';
  armor?: number;
  resources?: Partial<BodyResources>;
  bonuses?: StarterEquipment['bonuses'];
  weapon?: StarterEquipment['weapon'];
  bodyParts?: BodyPart[];
  body?: HeroBody;
}

export interface CharacterAttribute { id: string; name: string; value: string; numericValue: number; description: string; boosted?: boolean }
const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${number(Math.abs(value))}`;

export interface LoadoutColumn {
  id: 'armor' | 'accessories' | 'skills';
  label: string;
  slots: LoadoutSlot[];
}

const armorSlots = new Set<LoadoutSlot['id']>(['helmet', 'chest', 'gloves', 'pants', 'boots']);

/** Preserve all slots while keeping armor, other equipment and abilities easy to scan. */
export function loadoutColumns(model: ReturnType<typeof buildLoadout>): LoadoutColumn[] {
  return [
    { id: 'armor', label: 'Броня', slots: model.equipment.filter(slot => armorSlots.has(slot.id)) },
    { id: 'accessories', label: 'Оружие и аксессуары', slots: model.equipment.filter(slot => !armorSlots.has(slot.id)) },
    { id: 'skills', label: 'Умения', slots: model.skills },
  ];
}

const equipment: Array<[EquipmentSlotId, string, string]> = [
  ['helmet', 'Шлем', 'Голова'], ['amulet', 'Амулет', 'Амулет'],
  ['chest', 'Нагрудник', 'Тело'], ['gloves', 'Перчатки', 'Кисти рук'],
  ['pants', 'Штаны', 'Ноги'], ['ring1', 'Первое кольцо', 'Кольцо 1'],
  ['boots', 'Сапоги', 'Ступни'], ['ring2', 'Второе кольцо', 'Кольцо 2'],
  ['rightHand', 'Правая рука', 'Правая рука'], ['leftHand', 'Левая рука', 'Левая рука'],
];

/** Presentation only: the content catalogue and current combatant remain the sole source of effects. */
export function buildLoadout(state: CombatState, controlledActorId: string, content: GameContent = gameContent) {
  const heroes = state.units.filter(unit => unit.team === 'heroes');
  const unit = heroes.find(candidate => candidate.id === controlledActorId || candidate.definitionId === controlledActorId);
  const definition = content.characters.find(candidate => candidate.id === unit?.definitionId);
  const skills = definition?.skillIds.flatMap(id => content.skills.find(skill => skill.id === id) ?? []) ?? [];
  const extraSkills = skills.filter(skill => !skill.tags.includes('ROLE') && !skill.tags.includes('CHARACTER')).slice(0, 2);
  const body = unit?.body;
  const passive = passiveLoadoutSlot(definition, unit, content);
  const activeStatuses = state.status === 'running' ? unit?.statuses ?? [] : [];
  const setBonuses = definition ? activeEquipmentSetBonuses(definition, body).flatMap(group => group.bonuses) : [];
  const sources: Array<Modifiers | undefined> = [definition?.modifiers,
    ...setBonuses.flatMap(bonus => [bonus.modifiers, bonus.aura?.modifiers]),
    ...activeStatuses.flatMap(status => content.statuses.find(candidate => candidate.id === status.id)?.modifiers ?? [])];
  const sum = (key: 'evasionBonus' | 'initiativeBonus' | 'agilityBonus' | 'accuracyBonus' | 'critBonus' | 'armorBonus' | 'powerBonus' | 'resilienceBonus' | 'luckBonus') => sources.reduce((total, source) => total + (source?.[key] ?? 0), 0);
  const armor = 0;
  const bodyArmor = definition && body ? Object.fromEntries(BODY_PARTS.map(part => [part,
    body[part].lost ? 0 : Math.max(0, Math.floor(bodyPartArmor(definition, body, part) + sum('armorBonus'))),
  ])) as BodyResources : undefined;
  const stats = unit?.stats;
  const values = stats ? {
    power: stats.power + sum('powerBonus'),
    initiative: stats.initiative + sum('initiativeBonus'), accuracy: (stats.accuracy ?? 0) + sum('accuracyBonus'),
    crit: stats.crit + sum('critBonus'), evasion: stats.evasion + sum('evasionBonus'),
    agility: (stats.agility ?? 0) + sum('agilityBonus'), resilience: (stats.resilience ?? 0) + sum('resilienceBonus'),
    luck: (stats.luck ?? 0) + sum('luckBonus'),
  } : undefined;
  const attributes: CharacterAttribute[] = values ? [
    { id: 'initiative', name: 'Инициатива', numericValue: values.initiative, value: signed(values.initiative), boosted: Boolean(sum('initiativeBonus')), description: 'Добавляется к 1d20 в начале боя. При равенстве участники перебрасывают отдельный 1d20 без бонусов.' },
    { id: 'power', name: 'Сила', numericValue: values.power, value: number(values.power), boosted: Boolean(sum('powerBonus')), description: 'Увеличивает урон, исцеление и щиты, если это указано в навыке. Не влияет на попадание и проверку крита.' },
    { id: 'evasion', name: 'Уклонение', numericValue: values.evasion, value: number(values.evasion), boosted: Boolean(sum('evasionBonus')), description: 'Для попадания враг должен выбросить больше, чем Уклонение минус его Точность. Натуральная 1 всегда промах, 20 всегда попадание. Без Точности полезный порог — от 2 до 19; избыток противодействует Точности.' },
    { id: 'accuracy', name: 'Точность', numericValue: values.accuracy, value: signed(values.accuracy), boosted: Boolean(sum('accuracyBonus')), description: 'Вычитается из Уклонения цели при проверке попадания. Не меняет результат кубика и шанс критического удара.' },
    { id: 'resilience', name: 'Стойкость', numericValue: values.resilience, value: number(values.resilience), boosted: Boolean(sum('resilienceBonus')), description: 'Вычитается из Критического удара атакующего. Натуральная 20 на отдельном кубике крита всё равно даёт крит.' },
    { id: 'crit', name: 'Критический удар', numericValue: values.crit, value: signed(values.crit), boosted: Boolean(sum('critBonus')), description: 'Отдельный 1d20: крит при результате не ниже 20 − Критический удар + Стойкость цели. Для лечения Стойкость не учитывается. Натуральная 20 всегда крит. Весь результат урона или лечения удваивается.' },
    { id: 'agility', name: 'Проворность', numericValue: values.agility, value: signed(values.agility), boosted: Boolean(sum('agilityBonus')), description: 'Снижает порог побега: нужно выбросить на 1d20 не меньше 15 + уровень сильнейшего врага − Проворность.' },
    { id: 'luck', name: 'Удача', numericValue: values.luck, value: signed(values.luck), boosted: Boolean(sum('luckBonus')), description: 'Порог повышения редкости награды: 20 − Удача на 1d20. Успех повышает редкость на одну ступень и даёт новый бросок. Первая неудача или легендарная редкость останавливает цепочку.' },
  ] : [];
  return {
    heroName: unit?.name ?? 'Герой',
    heroTitle: definition?.title ?? '',
    role: definition ? roleNames[definition.role] : '',
    hp: unit?.hp ?? 0,
    maxHp: unit?.stats.maxHp ?? 0,
    shield: unit?.shield ?? 0,
    unit,
    allAttributes: attributes,
    attributes: attributes.filter(attribute => attribute.numericValue !== 0),
    body,
    armor,
    bodyArmor,
    bodyNote: !body ? '' : !isBodyAlive(body) ? 'Герой погиб.' : [
      !canBodyAct(body) ? 'Не может атаковать и применять активные умения.' : '',
      bodyMovementMultiplier(body) === 0 ? 'Не может передвигаться.' : body.leftLeg.current <= 0 && body.rightLeg.current <= 0 ? 'Передвигается ползком.'
        : body.leftLeg.current <= 0 || body.rightLeg.current <= 0 ? 'Передвигается с хромотой.' : '',
    ].filter(Boolean).join(' '),
    equipment: equipment.map(([id, name, area]): LoadoutSlot => {
      const item = definition?.anatomy?.equipment.find(item => item.slot === (id === 'helmet' ? 'head' : id));
      if (!item) {
        const heldWithBothHands = (id === 'rightHand' || id === 'leftHand')
          ? definition?.anatomy?.equipment.find(item => item.weapon?.hands === 2
            && item.slot === (id === 'rightHand' ? 'leftHand' : 'rightHand')) : undefined;
        if (heldWithBothHands) {
          const active = !body || equipmentCondition(heldWithBothHands, body).active;
          return { id, icon: id, name, slotLabel: area, category: `Экипировка · ${area}`, empty: false,
            description: `Эту руку занимает «${heldWithBothHands.name}». Чтобы взять сюда другой предмет, снимите двуручное оружие.`,
            contentId: heldWithBothHands.id, equipment: heldWithBothHands, occupiedBy: heldWithBothHands.name, rarity: heldWithBothHands.rarity ?? 'common',
            condition: active ? 'active' : 'unavailable', body, bodyParts: heldWithBothHands.bodyParts,
            badge: active ? '↔' : '×' };
        }
        const hand = id === 'ring1' || id === 'rightHand' ? 'rightArm' : id === 'ring2' || id === 'leftHand' ? 'leftArm' : undefined;
        const unavailable = hand && body && body[hand].current <= 0;
        return { id, icon: id, name, slotLabel: area, category: `Экипировка · ${area}`,
          description: 'Пустой слот. Предмет не экипирован.', empty: true,
          ...(unavailable ? { condition: 'unavailable', body, bodyParts: [hand], badge: '×' } : {}) };
      }
      const condition = body ? equipmentCondition(item, body) : { active: true, fraction: 1, bonusFraction: 1, armor: item.armor, resources: item.resources };
      return { id, icon: id, name: item.name, slotLabel: area, category: `Экипировка · ${area}`, description: item.description,
        empty: false, contentId: item.id, equipment: item, rarity: item.rarity ?? 'common', body, bodyParts: item.bodyParts,
        condition: !condition.active ? 'unavailable' : condition.fraction < 1 ? 'partial' : 'active',
        armor: condition.fraction > 0 ? item.armor : 0, resources: condition.resources, weapon: item.weapon,
        bonuses: item.bonuses && Object.fromEntries(Object.entries(item.bonuses).filter(([key]) => key !== 'healing').map(([key, value]) => [key, (value ?? 0) * condition.bonusFraction])),
        badge: !condition.active ? '×' : condition.fraction < 1 ? '½' : undefined };
    }),
    skills: [
      activeLoadoutSlot('class', `Классовая способность${definition ? ` · ${roleNames[definition.role]}` : ''}`, skills.find(skill => skill.tags.includes('ROLE')), unit, content),
      activeLoadoutSlot('characterActive', 'Активная способность героя', skills.find(skill => skill.tags.includes('CHARACTER')), unit, content),
      passive,
      ...(['extra1', 'extra2'] as const).map((id, index): LoadoutSlot => extraSkills[index]
        ? activeLoadoutSlot(id, 'Найденная способность', extraSkills[index], unit, content)
        : { id, icon: 'extra', name: `Дополнительный слот ${index + 1}`,
          category: 'Найденная способность', description: 'Здесь можно экипировать найденную в походе способность.', empty: true }),
    ],
  };
}
