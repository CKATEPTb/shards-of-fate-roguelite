import type { BodyPart, BodyResources, CombatState, HeroBody } from '@shards/shared';
import { canBodyAct, effectiveBodyArmor, equipmentCondition, isBodyAlive } from '@shards/game-core';
import { gameContent, roleNames } from '../../catalog';
import { activeLoadoutSlot, passiveLoadoutSlot } from './loadoutSkills';

export type EquipmentSlotId = 'helmet' | 'chest' | 'gloves' | 'pants' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'mainHand' | 'offHand';
export type SkillSlotId = 'class' | 'characterActive' | 'passive' | 'extra1' | 'extra2';
export type LoadoutIconKind = EquipmentSlotId | 'class' | 'characterActive' | 'passive' | 'extra'
  | 'mend' | 'burst' | 'blood' | 'radiance' | 'prayer' | 'regrowth' | 'ward' | 'precision' | 'volley' | 'fire' | 'evasion';
export interface LoadoutSlot {
  id: EquipmentSlotId | SkillSlotId;
  icon: LoadoutIconKind;
  name: string;
  category: string;
  description: string;
  empty: boolean;
  contentId?: string;
  cooldown?: { base: number; remaining: number };
  badge?: string;
  condition?: 'active' | 'partial' | 'unavailable';
  armor?: number;
  resources?: Partial<BodyResources>;
  bonuses?: { power?: number; healing?: number };
  bodyParts?: BodyPart[];
  body?: HeroBody;
}

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
  ['helmet', 'Шлем', 'Голова'], ['chest', 'Нагрудник', 'Тело'], ['gloves', 'Перчатки', 'Кисти рук'],
  ['pants', 'Штаны', 'Ноги'], ['boots', 'Сапоги', 'Ступни'],
  ['amulet', 'Амулет', 'Шея'], ['ring1', 'Первое кольцо', 'Кольцо I'], ['ring2', 'Второе кольцо', 'Кольцо II'],
  ['mainHand', 'Основная рука', 'Оружие'], ['offHand', 'Вторая рука', 'Дополнительное снаряжение'],
];

/** Presentation only: the content catalogue and current combatant remain the sole source of effects. */
export function buildLoadout(state: CombatState, controlledActorId: string) {
  const heroes = state.units.filter(unit => unit.team === 'heroes');
  const unit = heroes.find(candidate => candidate.id === controlledActorId || candidate.definitionId === controlledActorId);
  const definition = gameContent.characters.find(candidate => candidate.id === unit?.definitionId);
  const skills = definition?.skillIds.flatMap(id => gameContent.skills.find(skill => skill.id === id) ?? []) ?? [];
  const body = unit?.body;
  const passive = passiveLoadoutSlot(definition, unit);
  return {
    heroName: unit?.name ?? 'Герой',
    body,
    armor: definition && body ? effectiveBodyArmor(definition, body) : unit?.stats.armor ?? 0,
    bodyNote: !body ? '' : !isBodyAlive(body) ? 'Герой погиб.' : [
      !canBodyAct(body) ? 'Не может атаковать и применять активные умения.' : '',
      body.leftLeg.current <= 0 && body.rightLeg.current <= 0 ? 'Передвигается ползком.'
        : body.leftLeg.current <= 0 || body.rightLeg.current <= 0 ? 'Передвигается с хромотой.' : '',
    ].filter(Boolean).join(' '),
    equipment: equipment.map(([id, name, area]): LoadoutSlot => {
      const item = definition?.anatomy?.equipment.find(item => item.slot === (id === 'helmet' ? 'head' : id));
      if (!item) {
        const hand = id === 'ring1' || id === 'mainHand' ? 'rightArm' : id === 'ring2' || id === 'offHand' ? 'leftArm' : undefined;
        const unavailable = hand && body && body[hand].current <= 0;
        return { id, icon: id, name, category: `Экипировка · ${area}`,
          description: 'Пустой слот. Предмет не экипирован.', empty: true,
          ...(unavailable ? { condition: 'unavailable', body, bodyParts: [hand], badge: '×' } : {}) };
      }
      const condition = body ? equipmentCondition(item, body) : { active: true, fraction: 1, armor: item.armor, resources: item.resources };
      return { id, icon: id, name: item.name, category: `Экипировка · ${area}`, description: item.description,
        empty: false, contentId: `${definition!.id}:${item.slot}`, body, bodyParts: item.bodyParts,
        condition: !condition.active ? 'unavailable' : condition.fraction < 1 ? 'partial' : 'active',
        armor: condition.armor, resources: condition.resources,
        bonuses: item.bonuses && { power: (item.bonuses.power ?? 0) * condition.fraction,
          healing: (item.bonuses.healing ?? 0) * condition.fraction },
        badge: !condition.active ? '×' : condition.fraction < 1 ? '½' : undefined };
    }),
    skills: [
      activeLoadoutSlot('class', `Классовая способность${definition ? ` · ${roleNames[definition.role]}` : ''}`, skills.find(skill => skill.tags.includes('ROLE')), unit),
      activeLoadoutSlot('characterActive', 'Активная способность героя', skills.find(skill => skill.tags.includes('CHARACTER')), unit),
      passive,
      ...(['extra1', 'extra2'] as const).map((id, index): LoadoutSlot => ({ id, icon: 'extra', name: `Дополнительный слот ${index + 1}`,
        category: 'Дополнительная способность', description: 'Пустой слот. Дополнительная способность не назначена.', empty: true })),
    ],
  };
}
