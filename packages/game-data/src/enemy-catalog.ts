import type { EnemyDefinition, Season } from '@shards/shared';
import { ACT_ONE_ENEMY_FAMILIES, type ActOneEnemyFamily } from './enemy-catalog-families';

export { ACT_ONE_ENEMY_FAMILIES } from './enemy-catalog-families';

export interface ActOneEnemyMetadata {
  season: Season;
  family: string;
  tier: number;
  habitat: 'surface' | 'aquatic' | 'basement';
  pack: boolean;
}

/** Tags keep catalog metadata compatible with saved/custom enemy definitions. */
export function actOneEnemyMetadata(enemy: EnemyDefinition): ActOneEnemyMetadata | undefined {
  if (!enemy.tags.includes('ACT_1')) return undefined;
  const season = (['spring', 'summer', 'autumn', 'winter'] as const)
    .find(value => enemy.tags.includes(`SEASON_${value.toUpperCase()}`));
  const family = enemy.tags.find(tag => tag.startsWith('FAMILY_'))?.slice(7).toLowerCase();
  const tier = Number(enemy.tags.find(tag => /^TIER_[1-5]$/.test(tag))?.slice(5));
  if (!season || !family || !tier) return undefined;
  return { season, family, tier, habitat: enemy.tags.includes('BASEMENT') ? 'basement'
    : enemy.tags.includes('AQUATIC') ? 'aquatic' : 'surface', pack: enemy.tags.includes('PACK') };
}

/** Exact band selection; event callers choose their own seeded draw from the returned pool. */
export function selectActOneEnemyPool(enemies: readonly EnemyDefinition[], options: {
  season: Season; tier?: number; habitat?: ActOneEnemyMetadata['habitat'];
}): EnemyDefinition[] {
  return enemies.filter(enemy => {
    const metadata = actOneEnemyMetadata(enemy);
    return metadata?.season === options.season && metadata.habitat === (options.habitat ?? 'surface')
      && (options.tier === undefined || metadata.tier === options.tier);
  });
}

interface SchoolKit { damage: readonly string[]; tank: readonly string[]; healer: readonly string[] }
const KITS: Record<ActOneEnemyFamily['school'], SchoolKit> = {
  war: {
    damage: ['scout_stab', 'blindside_volley', 'break_the_stance', 'covered_lunge', 'three_veteran_cuts'],
    tank: ['slime_shell', 'duelists_salute', 'covered_lunge', 'challenge_from_the_crag', 'rampart_sweep'],
    healer: ['shaman_mend', 'drummers_cadence', 'catch_the_fallen_banner', 'school_of_the_first_blade', 'heart_of_the_company'],
  },
  nature: {
    damage: ['rat_gnaw', 'binding_roots', 'thorn_volley', 'blinding_hex', 'warden_sweep'],
    tank: ['thornling_guard', 'thornling_guard', 'barkskin_ritual', 'mountain_shelter', 'grove_sanctuary'],
    healer: ['shaman_mend', 'wandering_seed', 'wormwood_poultice', 'grove_sanctuary', 'bitter_camp_kettle'],
  },
  venom: {
    damage: ['spider_venom', 'fevered_needle', 'stray_plague_spine', 'acid_notch', 'plaguekeepers_feast'],
    tank: ['slime_shell', 'mushroom_cowl', 'serpents_molt', 'venomers_choice', 'scales_of_the_brood'],
    healer: ['shaman_mend', 'wormwood_poultice', 'viper_eye_salve', 'bitter_camp_kettle', 'apothecarys_final_recipe'],
  },
  blood: {
    damage: ['wolf_pounce', 'crimson_incision', 'scent_of_failing_pulse', 'three_crimson_barbs', 'pursuit_of_the_last_heartbeat'],
    tank: ['boar_charge', 'iron_heartbeat', 'blood_offering', 'chalice_of_kinship', 'banner_of_blood_kin'],
    healer: ['shaman_mend', 'vessel_of_first_blood', 'sanguine_gift', 'physicians_red_suture', 'banner_of_blood_kin'],
  },
  fire: {
    damage: ['twin_candle_fangs', 'ember_lance', 'ashblind_whisper', 'feast_of_the_last_ember', 'breath_of_the_brass_wyrm'],
    tank: ['slime_shell', 'mantle_of_warm_cinders', 'coal_under_the_heart', 'cinder_pact', 'heart_of_the_ashen_phoenix'],
    healer: ['shaman_mend', 'hearthkeepers_palm', 'flame_tending', 'brazier_of_comrades', 'courier_of_wild_sparks'],
  },
  bone: {
    damage: ['rat_gnaw', 'name_on_the_gravestone', 'knocking_from_the_crypt', 'answer_of_the_echo', 'ossuary_spear'],
    tank: ['thornling_guard', 'ancestral_call', 'wick_of_memory', 'chosen_of_the_ossuary', 'bone_procession'],
    healer: ['shaman_mend', 'quiet_requiem', 'ancestor_at_the_shoulder', 'relic_for_the_living', 'procession_under_white_veils'],
  },
  shadow: {
    damage: ['rat_gnaw', 'shadow_gamble', 'blinding_hex', 'nightfang', 'eclipse_beneath_the_ribs'],
    tank: ['slime_shell', 'slip_through_the_shroud', 'mirror_shelter', 'chosen_of_the_ossuary', 'black_mirror_companion'],
    healer: ['shaman_mend', 'quiet_requiem', 'ancestor_at_the_shoulder', 'relic_for_the_living', 'dusk_shared_by_all'],
  },
  frost: {
    damage: ['rat_gnaw', 'glacial_spear', 'frost_on_the_wound', 'duet_of_white_blades', 'needle_of_the_polar_star'],
    tank: ['slime_shell', 'snow_travelers_rest', 'winter_gatekeeper', 'sentinel_of_the_ice_gate', 'crystal_reliquary'],
    healer: ['shaman_mend', 'rime_tailors_touch', 'ice_drifters_gift', 'procession_of_the_thaw', 'spring_beneath_the_glacier'],
  },
  spirit: {
    damage: ['rat_gnaw', 'debt_to_the_departed', 'glacial_spear', 'knocking_from_the_crypt', 'lament_and_lantern'],
    tank: ['thornling_guard', 'wick_of_memory', 'ancestral_call', 'sentinel_of_the_ice_gate', 'vow_at_the_silent_gate'],
    healer: ['shaman_mend', 'quiet_requiem', 'relic_for_the_living', 'procession_of_the_thaw', 'procession_under_white_veils'],
  },
};

const BAND_HP = [14, 29, 53, 86, 132];
const BAND_POWER = [3, 6, 10, 15, 21];
const BAND_ARMOR = [0, 3, 6, 10, 15];
const ROLE_LABELS = { damage: 'Охотник', tank: 'Защитник', healer: 'Хранитель' } as const;
const PACK_SPRITES = ['wolf', 'rat', 'boar', 'wolf', 'spider'];
const SPEEDS: Record<string, number> = {
  rat: 82, wolf: 91, boar: 66, spider: 81, slime: 55, thornling: 57,
  elite_warden: 59, goblin_scout: 76, goblin_archer: 71, goblin_shaman: 64,
};

function spriteFor(family: ActOneEnemyFamily, slot: number, tier: number): string {
  if (family.kind === 'pack') return PACK_SPRITES[slot];
  if (family.kind === 'clan' || family.kind === 'dead') {
    return ['goblin_scout', 'goblin_archer', 'goblin_scout', 'goblin_shaman', 'goblin_scout'][slot];
  }
  if (family.kind === 'grove') return slot === 2 && tier >= 3 ? 'elite_warden' : 'thornling';
  if (slot === 2 || slot === 3) return 'slime';
  return family.habitat === 'basement' && slot === 0 ? 'rat' : 'spider';
}

function paletteColor(hex: string, tier: number, slot: number): string {
  const shift = (tier - 3) * 5 + (slot - 2) * 3;
  return '#' + [1, 3, 5].map(offset => Math.max(32, Math.min(232,
    parseInt(hex.slice(offset, offset + 2), 16) + shift)).toString(16).padStart(2, '0')).join('');
}

function createEnemy(family: ActOneEnemyFamily, name: string, index: number): EnemyDefinition {
  const tier = Math.floor(index / 5) + 1;
  const slot = index % 5;
  const role = slot === 2 ? 'tank' : slot === 3 && family.kind !== 'pack' ? 'healer' : 'damage';
  const sprite = spriteFor(family, slot, tier);
  const kit = KITS[family.school];
  const primary = kit[role][tier - 1];
  const skillIds = [primary];
  // Different jobs add distinct tactical choices; low bands have only one special action.
  if (tier >= 2 && role === 'healer' && primary !== 'shaman_mend') skillIds.push('shaman_mend');
  if (tier >= 3 && role === 'tank') skillIds.push(family.kind === 'pack' ? 'boar_charge' : 'tank_taunt');
  if (tier >= 3 && role === 'damage') skillIds.push(slot === 1 ? 'archer_volley'
    : slot === 4 ? (family.kind === 'pack' ? 'spider_venom' : 'scout_stab') : kit.damage[tier - 3]);
  const maxHp = Math.round(BAND_HP[tier - 1] * (role === 'tank' ? 1.6 : role === 'healer' ? 1.1 : 1)) + slot;
  const rank = tier === 5 && role === 'tank' ? 'ELITE' : tier >= 3 ? 'VETERAN'
    : family.kind === 'pack' && tier === 1 ? 'SWARM' : 'NORMAL';
  const tags = ['ACT_1', `SEASON_${family.season.toUpperCase()}`, `FAMILY_${family.id.toUpperCase()}`, `TIER_${tier}`,
    family.school.toUpperCase(), role === 'healer' ? 'HEAL' : role === 'tank' ? 'ARMOR' : 'DAMAGE'];
  if (family.habitat !== 'surface') tags.push(family.habitat.toUpperCase());
  if (family.kind === 'pack') tags.push('BEAST', 'PACK');
  if (family.kind === 'clan') tags.push('GOBLIN');
  if (family.kind === 'dead') tags.push('UNDEAD');
  return {
    schemaVersion: 1, id: `act1_${family.id}_${index + 1}`, name,
    title: `${ROLE_LABELS[role]} · ${family.name}`, description: family.description,
    role, rank, encounterCost: tier + (role === 'tank' ? 1 : 0), level: tier * 2 - 1,
    color: paletteColor(family.color, tier, slot), sprite,
    movementSpeed: SPEEDS[sprite] + (tier >= 4 ? 4 : 0),
    stats: { maxHp, power: BAND_POWER[tier - 1] + (role === 'damage' && slot === 0 ? 1 : 0),
      armor: BAND_ARMOR[tier - 1] + (role === 'tank' ? tier + 1 : 0),
      initiative: tier + (role === 'damage' ? 2 : 0), crit: Math.max(0, tier - 1) + (slot === 4 ? 1 : 0),
      evasion: role === 'tank' ? 1 : Math.min(7, tier + (slot === 4 ? 2 : 0)),
      agility: role === 'tank' ? tier - 1 : tier + 1, accuracy: Math.max(0, tier - 2),
      resilience: role === 'tank' ? tier : Math.max(0, tier - 3), luck: 0 },
    basicAttack: { type: 'damage', dice: tier <= 2 ? '1d4' : tier === 3 ? '1d6' : tier === 4 ? '1d8' : '1d10',
      scaling: 'power', factor: role === 'healer' ? 0.4 : 0.6 },
    skillIds: [...new Set(skillIds)], effectIds: [], modifiers: {}, tags,
  };
}

/** 490 new definitions; the ten legacy inhabitants are appended by enemies.ts. */
export const actOneCatalogEnemies: EnemyDefinition[] = ACT_ONE_ENEMY_FAMILIES.flatMap(family =>
  family.names.map((name, index) => createEnemy(family, name, index)));

const LEGACY_METADATA: Record<string, { family: string; tier: number; pack?: boolean }> = {
  rat: { family: 'thicket_pack', tier: 1, pack: true }, wolf: { family: 'thicket_pack', tier: 1, pack: true },
  slime: { family: 'briar_court', tier: 1 }, spider: { family: 'thicket_pack', tier: 1, pack: true },
  goblin_scout: { family: 'reed_clan', tier: 1 }, goblin_archer: { family: 'reed_clan', tier: 2 },
  goblin_shaman: { family: 'reed_clan', tier: 2 }, boar: { family: 'thicket_pack', tier: 2, pack: true },
  thornling: { family: 'briar_court', tier: 2 }, elite_warden: { family: 'briar_court', tier: 4 },
};

export function tagLegacyActOneEnemy(enemy: EnemyDefinition): EnemyDefinition {
  const metadata = LEGACY_METADATA[enemy.id];
  if (!metadata) return enemy;
  return { ...enemy, tags: [...enemy.tags, 'ACT_1', 'SEASON_SPRING', `FAMILY_${metadata.family.toUpperCase()}`,
    `TIER_${metadata.tier}`, ...(metadata.pack ? ['PACK'] : [])] };
}
