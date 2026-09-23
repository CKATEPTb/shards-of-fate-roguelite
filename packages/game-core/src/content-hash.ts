import type { GameContent, UnitDefinition } from '@shards/shared';
import { hashValue } from './canonical';
import { same } from './snapshot-values';

const HERO_SKILLS_CONTENT_HASH = '62d7f4af';
const AURA_CATALOGUE_CONTENT_HASH = '3399186d';
const DICE_ATTRIBUTES_CONTENT_HASH = '53347fe5';
const EXPANDED_SKILLS_CONTENT_HASH = 'd16e0adc';
const LEGENDARY_SKILLS_CONTENT_HASH = '66e1246f';
const PROPORTIONAL_SKILLS_CONTENT_HASH = '87d96171';
const ADVENTURE_CONTENT_HASH = '8f8659ac';
const FLEXIBLE_RINGS_CONTENT_HASH = '93c5fb00';
const SEASON_BOSSES_CONTENT_HASH = '5211d046';
const ATTRIBUTE_CATALOGUE_HASHES = [DICE_ATTRIBUTES_CONTENT_HASH, EXPANDED_SKILLS_CONTENT_HASH, LEGENDARY_SKILLS_CONTENT_HASH, PROPORTIONAL_SKILLS_CONTENT_HASH, ADVENTURE_CONTENT_HASH, FLEXIBLE_RINGS_CONTENT_HASH, SEASON_BOSSES_CONTENT_HASH];
const PRE_ATTRIBUTE_CONTENT_HASHES = ['33ed97ff', '3399186d', '62d7f4af', '6feb4657', '66930e12', '63e56d1e', '67834a12', '7a70f3ee', '2a2aa66a'];

/** Never accept a known predecessor against arbitrary modified game content. */
export function isCurrentShippedContent(content: GameContent): boolean {
  const value = hashValue(content);
  return ATTRIBUTE_CATALOGUE_HASHES.includes(value);
}

export function isLegacyAttributesContentHash(value: unknown, content: GameContent): boolean {
  return typeof value === 'string' && PRE_ATTRIBUTE_CONTENT_HASHES.includes(value) && isCurrentShippedContent(content);
}
const ORIGINAL_AURA_IDS = ['taunted', 'bastion', 'bloodlust', 'regrowth', 'sure_strike', 'rapid_fire', 'inspired', 'burning', 'poisoned', 'fortified', 'battle_fervor'];
const ORIGINAL_SKILL_IDS = [
  'tank_taunt', 'guardian_bastion', 'healer_mend', 'priest_prayer', 'damage_burst', 'mage_ignite',
  'vampire_bloodlust', 'paladin_radiance', 'druid_regrowth', 'necromancer_ward', 'rogue_precision', 'ranger_volley',
  'rat_gnaw', 'wolf_pounce', 'slime_shell', 'spider_venom', 'scout_stab', 'archer_volley',
  'shaman_mend', 'shaman_fervor', 'boar_charge', 'thornling_guard', 'warden_sweep', 'warden_renewal',
];

function beforeSkillCatalogue(content: GameContent): GameContent {
  return { ...content, skills: ORIGINAL_SKILL_IDS.flatMap(id => {
    const skill = content.skills.find(candidate => candidate.id === id);
    return skill ? [skill] : [];
  }) };
}

/** Added enemy-only definitions do not alter an encounter already saved with its own roster. */
function beforeBossCatalogue(content: GameContent): GameContent {
  return { ...content, enemies: content.enemies.filter(enemy => !enemy.tags.includes('BOSS')),
    skills: content.skills.filter(skill => !skill.tags.includes('BOSS')) };
}

/** Ring text changed together with flexible slots; existing IDs and item bonuses stayed intact. */
function beforeFlexibleRingDescriptions(content: GameContent): GameContent {
  const restore = <T extends { slot: string; description: string }>(item: T): T => !['ring1', 'ring2'].includes(item.slot) ? item
    : { ...item, description: item.description.replace('Кольцо. Можно надеть в любой из двух слотов', item.slot === 'ring1' ? 'Перстень на правой руке' : 'Кольцо на левой руке') };
  return { ...content, ...(content.equipmentCatalog ? { equipmentCatalog: { ...content.equipmentCatalog,
    items: Object.fromEntries(Object.entries(content.equipmentCatalog.items).map(([id, item]) => [id, restore(item)])) } } : {}),
    characters: content.characters.map(hero => hero.anatomy ? { ...hero, anatomy: { ...hero.anatomy, equipment: hero.anatomy.equipment.map(restore) } } : hero) };
}

/** Adding unused catalogue entries and presentation metadata does not invalidate
 * an existing expedition. Compare the exact shipped predecessor, retaining all
 * original rules, roster, skills, equipment and balance in the comparison. */
function beforeAuraCatalogue(content: GameContent): GameContent {
  const original = ORIGINAL_AURA_IDS.flatMap(id => {
    const status = content.statuses.find(candidate => candidate.id === id);
    if (!status) return [];
    const { visual: _visual, defaultDuration: _duration, ...mechanics } = status;
    return [mechanics];
  });
  return { ...beforeSkillCatalogue(content), statuses: original };
}

function shippedHeroSkills(content: GameContent): boolean {
  return isCurrentShippedContent(content) || hashValue(content) === HERO_SKILLS_CONTENT_HASH || hashValue(beforeAuraCatalogue(content)) === HERO_SKILLS_CONTENT_HASH;
}

/** Exact content on either side of the manual-combat migration, never a wildcard hash bypass. */
export function isLegacyAutobattleContentHash(value: unknown, content: GameContent): boolean {
  return typeof value === 'string' && ['66930e12', '63e56d1e', '67834a12', '7a70f3ee', '2a2aa66a'].includes(value)
    && (hashValue(content) === '6feb4657' || shippedHeroSkills(content));
}

/** The first manual-combat release and its older migrated snapshots share the old skills. */
export function isLegacyHeroSkillsContentHash(value: unknown, content: GameContent): boolean {
  return shippedHeroSkills(content)
    && (value === '6feb4657' || isLegacyAutobattleContentHash(value, content));
}

function withoutMovementSpeed<T extends UnitDefinition>(definition: T): Omit<T, 'movementSpeed'> {
  const { movementSpeed: _movementSpeed, ...legacyDefinition } = definition;
  return legacyDefinition;
}

function withoutAnatomy<T extends UnitDefinition>(definition: T): Omit<T, 'anatomy'> {
  const { anatomy: _anatomy, ...legacyDefinition } = definition;
  return legacyDefinition;
}

function withoutWeaponData<T extends UnitDefinition>(definition: T): T {
  if (!definition.anatomy) return definition;
  return { ...definition, anatomy: { ...definition.anatomy, equipment: definition.anatomy.equipment.map(item => {
    const { weapon: _weapon, ...legacyItem } = item;
    return legacyItem;
  }) } };
}

export function isLegacyAnatomyContentHash(value: unknown, content: GameContent): boolean {
  const legacy = { ...content, characters: content.characters.map(withoutAnatomy), enemies: content.enemies.map(withoutAnatomy) };
  return value === hashValue(legacy) || value === hashValue({ ...legacy, characters: legacy.characters.map(withoutMovementSpeed), enemies: legacy.enemies.map(withoutMovementSpeed) });
}

/** Exact shipped content before independent item IDs and anatomical hand slots. */
export function isLegacyEquipmentContentHash(value: unknown, content: GameContent): boolean {
  const hashes = ['63e56d1e', '67834a12', '7a70f3ee', '2a2aa66a'];
  if (typeof value !== 'string' || !hashes.includes(value)) return false;
  // Names and loadouts may migrate, but unrelated balance/content changes cannot.
  const withoutEquipment = { ...content, characters: content.characters.map(withoutAnatomy), enemies: content.enemies.map(withoutAnatomy) };
  return hashValue(withoutEquipment) === 'f7247365' || isLegacyAutobattleContentHash(value, content);
}

/** Accept exact earlier content shapes, including saves from before per-weapon attacks. */
export function restoreContentHash(value: unknown, content: GameContent, path: string): string {
  const currentHash = hashValue(content);
  if (value === currentHash) return currentHash;
  // Compare exact previous shapes, including heroes with saved fitted loadouts.
  // This does not accept unrelated changes to old skills, enemies or equipment.
  const previousBossContent = beforeBossCatalogue(content);
  if (value === hashValue(previousBossContent) || value === hashValue(beforeFlexibleRingDescriptions(previousBossContent))) return currentHash;
  // These predecessors already have the current anatomy/attributes. Only unused
  // skills and rarity metadata changed; do not run attribute migrations again.
  const predecessor = typeof value === 'string' ? ATTRIBUTE_CATALOGUE_HASHES.indexOf(value) : -1;
  if (predecessor >= 0 && ATTRIBUTE_CATALOGUE_HASHES.indexOf(currentHash) > predecessor) return currentHash;
  if (isLegacyAttributesContentHash(value, content) || value === HERO_SKILLS_CONTENT_HASH && shippedHeroSkills(content)
    || value === AURA_CATALOGUE_CONTENT_HASH && hashValue(beforeSkillCatalogue(content)) === AURA_CATALOGUE_CONTENT_HASH
    || isLegacyHeroSkillsContentHash(value, content) || isLegacyAutobattleContentHash(value, content) || isLegacyAnatomyContentHash(value, content) || isLegacyEquipmentContentHash(value, content)) return currentHash;
  const beforeWeapons = { ...content, characters: content.characters.map(withoutWeaponData), enemies: content.enemies.map(withoutWeaponData) };
  for (const candidate of [content, beforeWeapons]) {
    if (value === hashValue(candidate) || value === hashValue({
      ...candidate,
      characters: candidate.characters.map(withoutMovementSpeed),
      enemies: candidate.enemies.map(withoutMovementSpeed),
    })) return currentHash;
  }
  same(value, currentHash, path);
  return currentHash;
}
