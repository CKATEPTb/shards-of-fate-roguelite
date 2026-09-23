import { equipmentBodyPartsForSlot, equipmentItemFitsSlot, type BodyResources, type EquipmentItemDefinition, type EquipmentSetDefinition, type EquipmentSlot, type EquipmentWeapon, type StarterEquipment, type WeaponKind } from '@shards/shared';
import { CATALOG_EQUIPMENT_ITEMS, CATALOG_EQUIPMENT_SETS } from './equipment-catalog';

type ArmorSlot = 'head' | 'chest' | 'gloves' | 'pants' | 'boots';
const armorSlots: ArmorSlot[] = ['head', 'chest', 'gloves', 'pants', 'boots'];
interface ArmorSetSpec {
  id: string; name: string;
  names: [string, string, string, string, string];
  resources: [number, number, number, number];
  armor: [number, number, number, number, number];
}

/** Equipment collections are independent of character classes. */
const armorSets: ArmorSetSpec[] = [
  { id: 'iron-vanguard', name: 'Железный авангард', resources: [28, 64, 40, 44], armor: [2, 8, 2, 3, 3], names: ['Шлем железного авангарда', 'Кираса железного авангарда', 'Латные перчатки авангарда', 'Поножи железного авангарда', 'Сапоги железного авангарда'] },
  { id: 'ivory-pilgrim', name: 'Светлый пилигрим', resources: [28, 52, 32, 36], armor: [1, 3, 1, 1, 1], names: ['Капюшон светлого пилигрима', 'Облачение светлого пилигрима', 'Перчатки светлого пилигрима', 'Штаны светлого пилигрима', 'Сапоги светлого пилигрима'] },
  { id: 'ash-weaver', name: 'Пепельная нить', resources: [28, 44, 32, 32], armor: [1, 2, 0, 1, 1], names: ['Капюшон пепельной нити', 'Мантия пепельной нити', 'Перчатки пепельной нити', 'Штаны пепельной нити', 'Сапоги пепельной нити'] },
  { id: 'crimson-oath', name: 'Багровая клятва', resources: [28, 60, 40, 44], armor: [2, 4, 2, 2, 2], names: ['Капюшон багровой клятвы', 'Камзол багровой клятвы', 'Перчатки багровой клятвы', 'Штаны багровой клятвы', 'Сапоги багровой клятвы'] },
  { id: 'dawn-forged', name: 'Кузня рассвета', resources: [32, 64, 40, 40], armor: [2, 6, 2, 3, 3], names: ['Шлем кузни рассвета', 'Доспех кузни рассвета', 'Рукавицы кузни рассвета', 'Поножи кузни рассвета', 'Сапоги кузни рассвета'] },
  { id: 'wildwood', name: 'Древняя чаща', resources: [28, 48, 36, 36], armor: [1, 3, 1, 1, 2], names: ['Венец древней чащи', 'Накидка древней чащи', 'Перчатки древней чащи', 'Штаны древней чащи', 'Сапоги древней чащи'] },
  { id: 'grave-keeper', name: 'Погребальный дозор', resources: [28, 48, 32, 36], armor: [1, 2, 1, 1, 1], names: ['Капюшон погребального дозора', 'Облачение погребального дозора', 'Перчатки погребального дозора', 'Штаны погребального дозора', 'Сапоги погребального дозора'] },
  { id: 'night-stalker', name: 'Ночной след', resources: [28, 48, 32, 36], armor: [1, 2, 1, 1, 2], names: ['Капюшон ночного следа', 'Кожаный жилет ночного следа', 'Перчатки ночного следа', 'Штаны ночного следа', 'Мягкие сапоги ночного следа'] },
  { id: 'greenwood', name: 'Зелёная тропа', resources: [28, 52, 36, 40], armor: [1, 3, 1, 1, 2], names: ['Капюшон зелёной тропы', 'Охотничий камзол зелёной тропы', 'Перчатки зелёной тропы', 'Штаны зелёной тропы', 'Сапоги зелёной тропы'] },
];

function armorItems(set: ArmorSetSpec): EquipmentItemDefinition[] {
  const [head, torso, arm, leg] = set.resources;
  const legGear = leg * 3 / 4;
  const pants = Math.ceil(legGear / 2);
  const resources: Partial<BodyResources>[] = [
    { head: head * 3 / 4 }, { torso: torso * 3 / 4 },
    { leftArm: arm * 3 / 4, rightArm: arm * 3 / 4 },
    { leftLeg: pants, rightLeg: pants },
    { leftLeg: legGear - pants, rightLeg: legGear - pants },
  ];
  const descriptions = [
    'Защищает голову. Прочность вещи не расходуется.', 'Защищает тело. Прочность вещи не расходуется.',
    'Защищают обе руки. Каждая сохранённая рука использует свою половину пары.',
    'Защищают обе ноги. Каждая сохранённая нога использует свою половину пары.',
    'Защищают обе ноги. Каждая сохранённая нога использует свой сапог.',
  ];
  return armorSlots.map((slot, i) => ({
    id: `${set.id}-${slot}`, name: set.names[i], description: descriptions[i],
    slot, appearanceId: set.id, setId: set.id, rarity: 'common', resources: resources[i],
    armor: set.armor[i], bodyParts: Object.keys(resources[i]) as (keyof BodyResources)[],
  }));
}

function weaponItem(id: string, name: string, kind: WeaponKind, hands: 1 | 2, appearanceId: string, power: number, damage?: string): EquipmentItemDefinition {
  const weapon: EquipmentWeapon = { kind, hands, ...(damage ? { damage } : {}) };
  return {
    id, name, slot: 'hand', appearanceId, rarity: 'common',
    description: kind === 'shield' ? 'Щит для левой или правой руки.' : hands === 2 ? 'Двуручное оружие. Занимает обе руки.' : 'Одноручное оружие. Можно взять в любую свободную руку.',
    resources: {}, armor: 0, bodyParts: [], weapon,
    ...(power ? { bonuses: { power } } : {}),
  };
}

const weapons: EquipmentItemDefinition[] = [
  weaponItem('steel-sword', 'Стальной меч', 'sword', 1, 'iron-vanguard', 6, '1d6'),
  weaponItem('riveted-shield', 'Клёпаный щит', 'shield', 1, 'iron-vanguard', 0),
  weaponItem('pilgrim-staff', 'Посох тихого света', 'staff', 2, 'ivory-pilgrim', 8, '1d6'),
  weaponItem('ember-wand', 'Жезл тлеющей искры', 'wand', 1, 'ash-weaver', 10, '1d8'),
  weaponItem('bloodletting-sickle', 'Серп багровой клятвы', 'sickle', 1, 'crimson-oath', 8, '1d8'),
  weaponItem('oath-hammer', 'Молот рассветной клятвы', 'hammer', 1, 'dawn-forged', 6, '1d8'),
  weaponItem('sunward-shield', 'Щит восходящего солнца', 'shield', 1, 'dawn-forged', 7),
  weaponItem('elderbranch-staff', 'Посох старой рощи', 'staff', 2, 'wildwood', 7, '1d6'),
  weaponItem('bonewood-staff', 'Посох костяного древа', 'staff', 2, 'grave-keeper', 7, '1d6'),
  weaponItem('forged-steel-dagger', 'Кинжал кованой стали', 'dagger', 1, 'night-stalker', 5, '1d8'),
  weaponItem('worn-steel-dagger', 'Потёртый стальной кинжал', 'dagger', 1, 'night-stalker', 2, '1d8'),
  weaponItem('hunting-bow', 'Ясеневый охотничий лук', 'bow', 2, 'greenwood', 8, '1d8'),
  weaponItem('steel-greatsword', 'Двуручный стальной меч', 'greatsword', 2, 'iron-vanguard', 8, '1d10'),
  weaponItem('flanged-mace', 'Железная булава', 'mace', 1, 'iron-vanguard', 6, '1d6'),
  weaponItem('flanged-greatmace', 'Тяжёлая железная булава', 'greatmace', 2, 'iron-vanguard', 8, '1d10'),
  weaponItem('forge-greathammer', 'Двуручный кузнечный молот', 'greathammer', 2, 'dawn-forged', 8, '1d10'),
  weaponItem('reaping-scythe', 'Коса последней жатвы', 'scythe', 2, 'crimson-oath', 8, '1d10'),
];

export const EQUIPMENT_ITEMS: Readonly<Record<string, EquipmentItemDefinition>> = Object.fromEntries([
  ...armorSets.flatMap(armorItems), ...weapons, ...CATALOG_EQUIPMENT_ITEMS,
].map(item => [item.id, item]));

export const EQUIPMENT_SETS: Readonly<Record<string, EquipmentSetDefinition>> = Object.fromEntries([...armorSets.map(set => [set.id, {
  id: set.id, name: set.name, itemIds: armorSlots.map(slot => `${set.id}-${slot}`),
}]), ...CATALOG_EQUIPMENT_SETS.map(set => [set.id, set])]);

/** Make a new equipped instance; anatomical requirements follow the selected slot. */
export function equipItem(itemId: string, slot: EquipmentSlot): StarterEquipment {
  const item = EQUIPMENT_ITEMS[itemId];
  if (!item) throw new Error(`Unknown equipment item: ${itemId}`);
  if (!equipmentItemFitsSlot(item, slot)) throw new Error(`Cannot equip ${itemId} in ${slot}`);
  return { ...item, slot, resources: { ...item.resources }, bodyParts: equipmentBodyPartsForSlot(item, slot), ...(item.bonuses ? { bonuses: { ...item.bonuses } } : {}), ...(item.weapon ? { weapon: { ...item.weapon } } : {}) };
}
