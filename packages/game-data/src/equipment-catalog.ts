import type { BodyPart, EquipmentItemDefinition, EquipmentSetDefinition, EquipmentSetVisualDefinition, EquipmentSlot, RewardRarity, WeaponKind } from '@shards/shared';
import { EQUIPMENT_THEME_COLLECTIONS, type EquipmentThemeCollection, type EquipmentThemeName } from './equipment-themes';
import { catalogueSetBonuses, EQUIPMENT_BUILD_PROFILES, type EquipmentBuildProfile } from './equipment-catalog-profiles';

const armorSlots = ['head', 'chest', 'gloves', 'pants', 'boots'] as const;
const rarities: RewardRarity[] = ['common', 'rare', 'epic', 'legendary'];
const armorNames: Record<NonNullable<EquipmentSetVisualDefinition['material']>, readonly string[]> = {
  cloth: ['Капюшон', 'Одеяние', 'Перчатки', 'Штаны', 'Башмаки'],
  leather: ['Кожаный шлем', 'Камзол', 'Наручи', 'Кожаные штаны', 'Сапоги'],
  mail: ['Кольчужный капюшон', 'Кольчуга', 'Кольчужные перчатки', 'Кольчужные поножи', 'Сапоги'],
  plate: ['Шлем', 'Кираса', 'Латные рукавицы', 'Поножи', 'Латные сапоги'],
  bone: ['Костяная корона', 'Костяной панцирь', 'Костяные наручи', 'Костяные поножи', 'Сапоги'],
};
const weaponNames: Record<WeaponKind, string> = {
  sword: 'Меч', dagger: 'Кинжал', mace: 'Булава', hammer: 'Молот', sickle: 'Серп', wand: 'Жезл',
  bow: 'Лук', staff: 'Посох', greatsword: 'Двуручный меч', greatmace: 'Двуручная булава',
  greathammer: 'Двуручный молот', scythe: 'Коса', shield: 'Щит',
};
const hands = (kind: WeaponKind): 1 | 2 => ['bow', 'staff', 'greatsword', 'greatmace', 'greathammer', 'scythe'].includes(kind) ? 2 : 1;
/** Every family appears throughout the rarity ladder. No shield is paired with a two-handed weapon. */
const handPlans: readonly (readonly [WeaponKind, WeaponKind?])[] = [
  ['sword', 'shield'], ['bow'], ['dagger', 'dagger'], ['staff'], ['hammer', 'shield'],
  ['greatsword'], ['wand', 'shield'], ['mace', 'shield'], ['greatmace'], ['sickle', 'dagger'],
  ['greathammer'], ['scythe'], ['sword', 'dagger'], ['wand', 'wand'], ['mace', 'sickle'],
];
const motifs: Record<EquipmentThemeCollection['family'], NonNullable<EquipmentSetVisualDefinition['motif']>> = {
  blood: 'claw', holy: 'sun', nature: 'leaf', shadow: 'eye', arcane: 'rune', fire: 'flame', frost: 'crystal',
  storm: 'bolt', stone: 'rune', metal: 'cross', venom: 'eye', spirit: 'skull', time: 'star', war: 'claw', astral: 'moon',
};

/** Fixed arithmetic swatches: generating catalogue art never consumes a gameplay die. */
function swatch(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360 / 30, s = saturation / 100, l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function visualFor(collection: EquipmentThemeCollection, index: number, rank: number, variant: number): EquipmentSetVisualDefinition {
  const hue = collection.hue + (index % 5 - 2) * 9;
  const contrast = Math.floor(index / 5), saturation = 24 + (index % 3) * 8;
  const accentHue = hue + [32, -28, 65, -55, 150][contrast];
  return {
    silhouette: collection.silhouette, material: collection.material, motif: motifs[collection.family], variant,
    palette: {
      dark: swatch(hue, 22, 9 + contrast), shadow: swatch(hue, 22, 19 + contrast),
      metal: swatch(hue + 12, 12 + rank * 4, 43 + index % 4 * 3), edge: swatch(accentHue, 18, 72 + rank * 3),
      cloth: swatch(hue, saturation, 27 + contrast * 3), fold: swatch(hue, saturation, 16 + contrast * 2),
      trim: swatch(accentHue, 35 + rank * 8, 48 + rank * 6),
    },
    accents: { leather: swatch(hue + 20, 25, 18 + contrast * 2), wood: swatch(22 + index, 30, 26),
      bone: swatch(35 + contrast * 5, 24, 65 + rank * 4), gem: swatch(accentHue, 62, 66) },
  };
}

function rarityFor(collectionIndex: number, index: number): RewardRarity {
  // Ten collections: 10/8/5/2; ten: 10/7/5/3. Total 200/150/100/50.
  const rareEnd = collectionIndex % 2 === 0 ? 18 : 17;
  return index < 10 ? 'common' : index < rareEnd ? 'rare' : index < rareEnd + 5 ? 'epic' : 'legendary';
}

function createSet(collection: EquipmentThemeCollection, theme: EquipmentThemeName, collectionIndex: number, index: number): { set: EquipmentSetDefinition; items: EquipmentItemDefinition[] } {
  const setId = `relic-${theme.id}`, rarity = rarityFor(collectionIndex, index), rank = rarities.indexOf(rarity);
  const variant = collectionIndex * 25 + index;
  const profile: EquipmentBuildProfile = EQUIPMENT_BUILD_PROFILES[(collectionIndex * 7 + index) % EQUIPMENT_BUILD_PROFILES.length];
  const visual = visualFor(collection, index, rank, variant);
  const weight = { cloth: 0, leather: 1, mail: 2, bone: 2, plate: 3 }[collection.material];
  const resourceParts: BodyPart[][] = [['head'], ['torso'], ['leftArm', 'rightArm'], ['leftLeg', 'rightLeg'], ['leftLeg', 'rightLeg']];
  const resources = [17 + weight * 2, 32 + weight * 5, 20 + weight * 2, 12 + weight, 12 + weight];
  const armor = [Math.floor(weight / 2), weight + 1, Math.floor(weight / 2), Math.floor(weight / 2), Math.floor(weight / 2)];
  const items: EquipmentItemDefinition[] = armorSlots.map((slot, slotIndex) => {
    const value = resources[slotIndex] + rank * (slot === 'chest' ? 7 : 3) + (index + slotIndex) % 3;
    const paired = slotIndex >= 2;
    const bonusKey = slotIndex % 2 === 0 ? profile.supporting : profile.secondary;
    const bonus = paired ? 2 * Math.floor((rank + 1) / 2) : 1 + Math.floor(rank / 2);
    return {
      id: `${setId}-${slot}`, name: `${armorNames[collection.material][slotIndex]} ${theme.genitive}`,
      description: `${theme.name}. ${slotIndex === 0 ? 'Защищает голову' : slotIndex === 1 ? 'Защищает тело' : slotIndex === 2 ? 'Защищают обе руки' : 'Защищают обе ноги'}. Прочность добавляется указанным частям тела, Защита действует только на них.`,
      slot, appearanceId: setId, setId, rarity,
      resources: Object.fromEntries(resourceParts[slotIndex].map(part => [part, value])), bodyParts: [...resourceParts[slotIndex]],
      armor: armor[slotIndex] + rank + (index % 4 === slotIndex ? 1 : 0),
      ...(bonus ? { bonuses: { [bonusKey]: bonus } } : {}),
    };
  });
  const jewelSlots = ['amulet', 'ring1', 'ring2'] as const;
  const jewelNames = ['Амулет', 'Перстень обета', 'Кольцо печати'];
  for (let i = 0; i < jewelSlots.length; i++) {
    const slot = jewelSlots[i], attribute = i === 0 ? profile.primary : i === 1 ? profile.secondary : profile.supporting;
    items.push({ id: `${setId}-${slot}`, name: `${jewelNames[i]} ${theme.genitive}`, description: `${theme.name}. ${i === 0 ? 'Амулет на груди' : 'Кольцо. Можно надеть в любой из двух слотов'}. Даёт атрибуты и считается отдельным предметом комплекта.`,
      slot, appearanceId: setId, setId, rarity, resources: {}, armor: 0,
      bodyParts: [i === 0 ? 'torso' : i === 1 ? 'rightArm' : 'leftArm'], bonuses: { [attribute]: 1 + Math.floor((rank + (i === 0 ? 1 : 0)) / 2) } });
  }
  const plan = handPlans[(collectionIndex * 11 + index) % handPlans.length];
  const loadout: Partial<Record<EquipmentSlot, string>> = Object.fromEntries(items.map(item => [item.slot, item.id]));
  for (let handIndex = 0; handIndex < plan.length; handIndex++) {
    const kind = plan[handIndex]!;
    const slot = handIndex === 0 ? 'rightHand' : 'leftHand';
    const repeated = handIndex === 1 && kind === plan[0];
    const id = `${setId}-${slot}-${kind}`;
    const damage = kind === 'dagger' ? ['1d4', '1d6', '1d8', '2d4'][rank]
      : hands(kind) === 2 ? ['1d10', '2d6', '2d8', '3d6'][rank] : ['1d6', '1d8', '1d10', '2d6'][rank];
    const bonuses = kind === 'shield' ? { resilience: 1 + rank } : { power: (hands(kind) === 2 ? 7 : 4) + rank * 2 + index % 3 };
    items.push({ id, name: `${repeated ? 'Парный ' + weaponNames[kind].toLocaleLowerCase('ru') : weaponNames[kind]} ${theme.genitive}`,
      description: kind === 'shield' ? `${theme.name}. Щит можно взять в любую свободную руку. Защищает несущую его руку и даёт Стойкость.`
        : `${theme.name}. ${hands(kind) === 2 ? 'Двуручное оружие: занимает обе руки и считается одним предметом комплекта.' : 'Одноручное оружие: подходит для любой руки. При двух оружиях каждый удар использует свои кубики.'}`,
      slot: 'hand', appearanceId: setId, setId, rarity, resources: {}, bodyParts: [],
      armor: kind === 'shield' ? 3 + rank * 3 + index % 3 : 0, bonuses,
      weapon: { kind, hands: hands(kind), ...(kind !== 'shield' ? { damage } : {}) },
    });
    loadout[slot] = id;
  }
  const set: EquipmentSetDefinition = {
    id: setId, name: theme.name, rarity,
    description: `${collection.name}. ${profile.name}. Пять частей брони, амулет, два кольца и ${plan.length === 1 ? 'двуручное оружие' : plan[1] === 'shield' ? 'оружие со щитом' : 'два одноручных оружия'}. Бонусы за 2, 4 и 6 разных активных предметов складываются.`,
    itemIds: items.map(item => item.id), loadout, visual, bonuses: catalogueSetBonuses(profile, rank),
  };
  return { set, items };
}

const built = EQUIPMENT_THEME_COLLECTIONS.flatMap((collection, collectionIndex) => collection.themes.map((theme, index) => createSet(collection, theme, collectionIndex, index)));
export const CATALOG_EQUIPMENT_SETS: EquipmentSetDefinition[] = built.map(entry => entry.set);
export const CATALOG_EQUIPMENT_ITEMS: EquipmentItemDefinition[] = built.flatMap(entry => entry.items);
export const equipmentSetPoolsByRarity: Record<RewardRarity, EquipmentSetDefinition[]> = Object.fromEntries(rarities.map(rarity => [rarity, CATALOG_EQUIPMENT_SETS.filter(set => set.rarity === rarity)])) as Record<RewardRarity, EquipmentSetDefinition[]>;
