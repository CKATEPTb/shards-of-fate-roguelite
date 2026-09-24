import type {
  EffectDefinition, EnemyDefinition, EquipmentItemDefinition, EquipmentSetAuraDefinition, EquipmentSetDefinition,
  GameContent, RewardRarity, Season, SkillDefinition, StatusDefinition, TargetSelector, UnitDefinition, WeaponKind,
} from '@shards/shared';

export type KnowledgeTabId = 'heroes' | 'enemies' | 'bosses' | 'equipment' | 'sets' | 'skills' | 'auras';

export const KNOWLEDGE_TABS: readonly { id: KnowledgeTabId; label: string }[] = [
  { id: 'heroes', label: 'Герои' }, { id: 'enemies', label: 'Противники' }, { id: 'bosses', label: 'Боссы' },
  { id: 'equipment', label: 'Экипировка' }, { id: 'sets', label: 'Комплекты' }, { id: 'skills', label: 'Навыки' },
  { id: 'auras', label: 'Ауры и эффекты' },
];

interface KnowledgeBase {
  /** Namespaced identity: a skill and an aura may legitimately share a source ID. */
  id: string;
  sourceId: string;
  tab: KnowledgeTabId;
  name: string;
  description: string;
  subtitle: string;
  searchText: string;
  rarity?: RewardRarity;
  season?: Season;
  /** A human-readable category, ready for the category filter. */
  group: string;
}

export type KnowledgeEntry = KnowledgeBase & (
  | { kind: 'unit'; tab: 'heroes'; unit: UnitDefinition }
  | { kind: 'unit'; tab: 'enemies' | 'bosses'; unit: EnemyDefinition }
  | { kind: 'equipment'; tab: 'equipment'; item: EquipmentItemDefinition }
  | { kind: 'set'; tab: 'sets'; set: EquipmentSetDefinition }
  | { kind: 'skill'; tab: 'skills'; skill: SkillDefinition }
  | { kind: 'aura'; tab: 'auras'; status: StatusDefinition }
  | { kind: 'effect'; tab: 'auras'; effect: EffectDefinition }
  | { kind: 'setAura'; tab: 'auras'; aura: EquipmentSetAuraDefinition; sets: EquipmentSetDefinition[] }
);

const rarityNames: Record<RewardRarity, string> = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' };
const seasonNames: Record<Season, string> = { spring: 'Весна', summer: 'Лето', autumn: 'Осень', winter: 'Зима' };
const roleNames: Record<UnitDefinition['role'], string> = { tank: 'Защитник', healer: 'Целитель', damage: 'Урон' };
const weaponNames: Record<WeaponKind, string> = {
  bow: 'Луки', staff: 'Посохи', dagger: 'Кинжалы', sword: 'Мечи', greatsword: 'Двуручные мечи',
  mace: 'Булавы', greatmace: 'Двуручные булавы', hammer: 'Молоты', greathammer: 'Двуручные молоты',
  shield: 'Щиты', sickle: 'Серпы', scythe: 'Косы', wand: 'Жезлы',
};
const slotNames: Record<EquipmentItemDefinition['slot'], string> = {
  head: 'Головные уборы', chest: 'Доспехи', gloves: 'Перчатки', pants: 'Поножи', boots: 'Обувь',
  amulet: 'Амулеты', ring1: 'Кольца', ring2: 'Кольца', hand: 'Предметы в руках',
};
const materialNames = { cloth: 'Ткань', leather: 'Кожа', mail: 'Кольчуга', plate: 'Латы', bone: 'Кость' } as const;
const targetNames: Record<TargetSelector, string> = {
  self: 'На себя', enemy: 'Противник', ally: 'Союзник', lowestHealthEnemy: 'Самый раненый противник',
  lowestHealthAlly: 'Самый раненый союзник', allAllies: 'Весь отряд', allEnemies: 'Все противники',
  eventTarget: 'Цель события', any: 'Любая цель', randomEnemy: 'Случайный противник',
  randomAlly: 'Случайный союзник', randomUnit: 'Случайная цель',
};
const auraFamilies = {
  blood: 'Кровь', holy: 'Свет', nature: 'Природа', shadow: 'Тень', arcane: 'Тайная магия', fire: 'Огонь',
  frost: 'Мороз', storm: 'Буря', stone: 'Камень', metal: 'Металл', venom: 'Яд', spirit: 'Духи',
  time: 'Время', war: 'Война', astral: 'Астрал',
} as const;

export function normalizeKnowledgeSearch(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const join = (values: readonly (string | undefined)[]) => values.filter(Boolean).join(' · ');
const seasonOf = (unit: UnitDefinition) => (Object.keys(seasonNames) as Season[])
  .find(season => unit.tags.includes(`SEASON_${season.toUpperCase()}`));

function base(kind: KnowledgeEntry['kind'], tab: KnowledgeTabId, definition: { id: string; name: string; description?: string },
  group: string, subtitle: string, options: { rarity?: RewardRarity; season?: Season; search?: string[] } = {}): KnowledgeBase {
  const description = definition.description ?? '';
  return {
    id: `${tab}:${kind}:${definition.id}`, sourceId: definition.id, tab, name: definition.name, description, subtitle, group,
    ...(options.rarity ? { rarity: options.rarity } : {}), ...(options.season ? { season: options.season } : {}),
    searchText: normalizeKnowledgeSearch(join([definition.name, description, group, subtitle,
      options.rarity && rarityNames[options.rarity], options.season && seasonNames[options.season], ...(options.search ?? [])])),
  };
}

/** A read-only index over the loaded game content; the payloads remain the actual runtime definitions. */
export function createKnowledgeCatalog(content: GameContent): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  const units = [...content.characters, ...content.enemies];
  const skills = new Map(content.skills.map(skill => [skill.id, skill]));
  const effects = new Map(content.effects.map(effect => [effect.id, effect]));
  const statuses = new Map(content.statuses.map(status => [status.id, status]));
  const items = content.equipmentCatalog?.items ?? {};
  const sets = content.equipmentCatalog?.sets ?? {};
  const skillOwners = new Map<string, UnitDefinition[]>();
  const effectOwners = new Map<string, UnitDefinition[]>();
  for (const unit of units) {
    for (const id of unit.skillIds) skillOwners.set(id, [...(skillOwners.get(id) ?? []), unit]);
    for (const id of unit.effectIds) effectOwners.set(id, [...(effectOwners.get(id) ?? []), unit]);
  }
  const heroIds = new Set(content.characters.map(unit => unit.id));
  const classSkillIds = new Set(content.characters.flatMap(unit => unit.skillIds.slice(0, 1)));
  const unitSearch = (unit: UnitDefinition) => [unit.title, unit.passive?.name ?? '', unit.passive?.description ?? '',
    ...unit.skillIds.flatMap(id => skills.get(id) ? [skills.get(id)!.name] : []),
    ...unit.effectIds.flatMap(id => effects.get(id) ? [effects.get(id)!.name] : [])];

  for (const unit of content.characters) {
    entries.push({ ...base('unit', 'heroes', unit, roleNames[unit.role], join([roleNames[unit.role], unit.title]),
      { search: unitSearch(unit) }), kind: 'unit', tab: 'heroes', unit });
  }
  for (const unit of content.enemies) {
    const boss = unit.tags.includes('BOSS'), tab = boss ? 'bosses' : 'enemies', season = seasonOf(unit);
    const habitat = unit.tags.includes('AQUATIC') ? 'Водные' : unit.tags.includes('BASEMENT') ? 'Подземные' : 'Наземные';
    const group = boss ? season ? seasonNames[season] : 'Боссы' : habitat;
    entries.push({ ...base('unit', tab, unit, group, join([roleNames[unit.role], season && seasonNames[season],
      !boss ? habitat : undefined, unit.level === undefined ? undefined : `Уровень ${unit.level}`]),
    { season, search: unitSearch(unit) }), kind: 'unit', tab, unit });
  }
  for (const item of Object.values(items)) {
    const group = item.weapon ? weaponNames[item.weapon.kind] : slotNames[item.slot];
    const setName = item.setId ? sets[item.setId]?.name : undefined;
    entries.push({ ...base('equipment', 'equipment', item, group, join([rarityNames[item.rarity], group, setName]),
      { rarity: item.rarity, search: [setName ?? '', item.weapon?.hands === 2 ? 'Двуручное оружие' : item.weapon ? 'Одна рука' : ''] }),
    kind: 'equipment', tab: 'equipment', item });
  }
  const setAuras = new Map<string, { aura: EquipmentSetAuraDefinition; sets: EquipmentSetDefinition[] }>();
  for (const set of Object.values(sets)) {
    const group = set.visual?.material ? materialNames[set.visual.material] : 'Комплекты';
    const names = set.itemIds.flatMap(id => items[id] ? [items[id].name] : []);
    entries.push({ ...base('set', 'sets', set, group, join([set.rarity && rarityNames[set.rarity], `${set.itemIds.length} предметов`, group]),
      { rarity: set.rarity, search: [...names, ...(set.bonuses ?? []).flatMap(bonus => [bonus.name, bonus.description])] }),
    kind: 'set', tab: 'sets', set });
    for (const bonus of set.bonuses ?? []) {
      if (!bonus.aura) continue;
      const existing = setAuras.get(bonus.aura.id);
      if (existing) {
        if (!existing.sets.some(source => source.id === set.id)) existing.sets.push(set);
      } else setAuras.set(bonus.aura.id, { aura: bonus.aura, sets: [set] });
    }
  }
  for (const skill of content.skills) {
    const owners = skillOwners.get(skill.id) ?? [];
    const group = skill.rarity ? 'Изучаемые' : classSkillIds.has(skill.id) ? 'Классовые'
      : owners.some(owner => heroIds.has(owner.id)) ? 'Навыки героев'
        : owners.some(owner => owner.tags.includes('BOSS')) ? 'Навыки боссов'
          : owners.length ? 'Навыки противников' : 'Другие навыки';
    const auraNames = skill.actions.flatMap(action => [action.statusId, action.onHitStatusId])
      .flatMap(id => id && statuses.get(id) ? [statuses.get(id)!.name] : []);
    entries.push({ ...base('skill', 'skills', skill, group,
      join([skill.rarity && rarityNames[skill.rarity], targetNames[skill.target], `Перезарядка: ${skill.cooldown}`]),
      { rarity: skill.rarity, search: [...owners.map(owner => owner.name), ...auraNames] }), kind: 'skill', tab: 'skills', skill });
  }
  for (const status of content.statuses) {
    const group = status.polarity === 'positive' ? 'Положительные' : status.polarity === 'negative' ? 'Отрицательные' : 'Ауры';
    const timing = status.trigger === 'TURN_STARTED' ? 'В начале хода' : status.trigger === 'TURN_ENDED' ? 'В конце хода' : undefined;
    entries.push({ ...base('aura', 'auras', status, group,
      join([group, status.visual && auraFamilies[status.visual.family], timing])), kind: 'aura', tab: 'auras', status });
  }
  for (const effect of content.effects) {
    const owners = (effectOwners.get(effect.id) ?? []).map(unit => unit.name);
    entries.push({ ...base('effect', 'auras', effect, 'Пассивные эффекты', join(['Пассивный эффект', ...owners]),
      { search: owners }), kind: 'effect', tab: 'auras', effect });
  }
  for (const { aura, sets: sources } of setAuras.values()) {
    const rarities = new Set(sources.map(set => set.rarity));
    const rarity = rarities.size === 1 ? sources[0].rarity : undefined;
    entries.push({ ...base('setAura', 'auras', aura, 'Ауры комплектов', join(['Аура комплекта', rarity && rarityNames[rarity]]),
      { rarity, search: sources.map(set => set.name) }), kind: 'setAura', tab: 'auras', aura, sets: sources });
  }
  return entries;
}
