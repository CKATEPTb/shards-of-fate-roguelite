import { ACT_ONE_ENEMY_FAMILIES, actOneBosses } from '@shards/game-data';
import type { Season } from '@shards/shared';
import { unitPalette, type UnitPalette } from './unitPalette';

export type EnemyForm = 'raider' | 'archer' | 'shaman' | 'bulwark' | 'stalker' | 'skeleton' | 'revenant' | 'lich'
  | 'treant' | 'thorn' | 'mushroom' | 'flower' | 'leech' | 'crab' | 'larva' | 'eye' | 'rat' | 'wolf' | 'boar' | 'spider' | 'wraith' | 'wyrm';
export type BossForm = 'colossus' | 'broodQueen' | 'antlerTitan' | 'oracle' | 'reaper' | 'leviathan' | 'golem'
  | 'boneSovereign' | 'drake' | 'behemoth' | 'jotunn' | 'phoenix' | 'locust' | 'crystal';
export interface EnemyAppearance {
  id: string; form: EnemyForm; bossForm?: BossForm; family: string; season: Season;
  tier: number; variant: number; boss: boolean; palette: UnitPalette; scale: number;
}

export const ENEMY_FRAME_SIZE = 64;
export const ENEMY_FOOT_Y = 56;

// Every family has an anatomical vocabulary, including its five combat roles.
const FAMILY_FORMS: Record<string, readonly EnemyForm[]> = {
  reed_clan: ['raider', 'archer', 'bulwark', 'shaman', 'stalker'],
  briar_court: ['thorn', 'flower', 'treant', 'mushroom', 'wyrm'],
  flood_brood: ['leech', 'larva', 'crab', 'eye', 'spider'],
  cellar_nest: ['rat', 'spider', 'larva', 'mushroom', 'leech'],
  thicket_pack: ['wolf', 'rat', 'boar', 'wolf', 'spider'],
  sun_scour: ['raider', 'archer', 'bulwark', 'shaman', 'stalker'],
  ember_hive: ['larva', 'eye', 'crab', 'mushroom', 'spider'],
  saltwater_spawn: ['leech', 'wyrm', 'crab', 'larva', 'spider'],
  charred_crypt: ['skeleton', 'skeleton', 'revenant', 'lich', 'wraith'],
  dry_fang: ['wolf', 'wolf', 'boar', 'rat', 'spider'],
  harvest_clan: ['raider', 'archer', 'bulwark', 'shaman', 'stalker'],
  rot_court: ['thorn', 'flower', 'treant', 'mushroom', 'wyrm'],
  blackwater_spawn: ['leech', 'eye', 'crab', 'larva', 'wyrm'],
  ossuary_order: ['skeleton', 'skeleton', 'revenant', 'lich', 'wraith'],
  carrion_pack: ['wolf', 'rat', 'boar', 'wolf', 'spider'],
  rime_clan: ['raider', 'archer', 'bulwark', 'shaman', 'stalker'],
  snow_grove: ['thorn', 'flower', 'treant', 'mushroom', 'wyrm'],
  underice_brood: ['leech', 'wyrm', 'crab', 'eye', 'larva'],
  frozen_vault: ['skeleton', 'skeleton', 'revenant', 'lich', 'wraith'],
  white_fang: ['wolf', 'wolf', 'boar', 'rat', 'spider'],
};

// Authored boss identities select their own anatomy, independent of old sprite aliases.
export const BOSS_FORMS: Record<string, BossForm> = {
  briar_king: 'colossus', thousand_fangs: 'broodQueen', first_thunder: 'antlerTitan', blind_florist: 'oracle',
  torn_leaves: 'reaper', meltwater_lady: 'leviathan', moss_colossus: 'golem', plague_beekeeper: 'oracle',
  silver_huntress: 'reaper', reed_tyrant: 'reaper', buried_bell: 'boneSovereign', red_antler: 'antlerTitan', glass_seed: 'crystal',
  brass_sun: 'golem', dune_queen: 'broodQueen', scarlet_admiral: 'reaper', storm_matriarch: 'jotunn',
  cinder_butcher: 'behemoth', salt_prophet: 'oracle', golden_hydra: 'leviathan', noon_executioner: 'reaper',
  ember_phoenix: 'phoenix', copper_huntsman: 'reaper', mirage_sultan: 'oracle', locust_emperor: 'locust', obsidian_ram: 'behemoth',
  harvest_reaper: 'reaper', hollow_duchess: 'oracle', ossuary_archon: 'boneSovereign', rot_gardener: 'colossus',
  carrion_king: 'phoenix', rust_marshal: 'reaper', blood_granary: 'behemoth', last_lantern: 'oracle',
  witch_of_falling_hours: 'oracle', grave_boar: 'behemoth', amber_widow: 'broodQueen', ashen_pilgrim: 'oracle',
  white_sovereign: 'boneSovereign', polar_devourer: 'drake', glass_empress: 'crystal', grave_frost: 'boneSovereign',
  starved_aurora: 'phoenix', frozen_executioner: 'reaper', mother_white_web: 'broodQueen', iron_icebreaker: 'behemoth',
  last_hour_keeper: 'oracle', black_snow_abbess: 'oracle', comet_wolf: 'drake', heart_of_last_glacier: 'crystal',
};

const SEASON_MATERIALS: Record<Season, { cloth: string; skin: string; bone: string; eye: string }> = {
  spring: { cloth: '#435d52', skin: '#8f9b72', bone: '#ddcda0', eye: '#cdec98' },
  summer: { cloth: '#794340', skin: '#c69a6b', bone: '#edd3a0', eye: '#ffbe6a' },
  autumn: { cloth: '#58435e', skin: '#9f7768', bone: '#cdbfa0', eye: '#e8aa71' },
  winter: { cloth: '#364969', skin: '#a4b4c5', bone: '#dce5df', eye: '#8bebee' },
};

function mix(a: string, b: string, amount: number): string {
  return '#' + [1, 3, 5].map(offset => Math.round(parseInt(a.slice(offset, offset + 2), 16) * (1 - amount)
    + parseInt(b.slice(offset, offset + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
}

function palette(base: string, season: Season, variant: number, undead = false): UnitPalette {
  const material = SEASON_MATERIALS[season];
  const accent = [material.cloth, '#694b57', '#4e6874', '#626143', '#85584b'][variant % 5];
  const main = mix(base, accent, .10 + Math.floor(variant / 5) * .035);
  return { outline: '#131b23', shade: mix(main, '#182330', .55), main, light: mix(main, '#edf1d3', .40),
    skin: undead ? material.bone : material.skin, skinShade: mix(undead ? material.bone : material.skin, '#302832', .48),
    cloth: mix(accent, '#151b28', .20), clothLight: mix(accent, '#e2c394', .33), trim: material.bone, eye: material.eye };
}

const appearances = new Map<string, EnemyAppearance>();
for (const family of ACT_ONE_ENEMY_FAMILIES) {
  for (let variant = 0; variant < family.names.length; variant++) {
    const tier = Math.floor(variant / 5) + 1, slot = variant % 5;
    const id = `act1_${family.id}_${variant + 1}`;
    const form = FAMILY_FORMS[family.id]?.[slot] ?? 'raider';
    appearances.set(id, { id, form, family: family.id, season: family.season, tier, variant, boss: false,
      palette: palette(family.color, family.season, variant, family.kind === 'dead'),
      scale: (slot === 2 ? 1.04 : slot === 3 ? .96 : .87) + (tier - 1) * .035 });
  }
}
for (const [variant, boss] of actOneBosses.entries()) {
  const season = (['spring', 'summer', 'autumn', 'winter'] as const).find(value => boss.tags.includes(`SEASON_${value.toUpperCase()}`)) ?? 'spring';
  const family = boss.id.replace(/^boss_/, '');
  const bossForm = BOSS_FORMS[family] ?? 'golem';
  const heavy = ['colossus', 'golem', 'behemoth', 'jotunn', 'boneSovereign'].includes(bossForm);
  appearances.set(boss.id, { id: boss.id, form: 'revenant', bossForm, family, season, tier: 5, variant,
    boss: true, palette: palette(boss.color, season, variant, bossForm === 'boneSovereign'), scale: heavy ? 2.65 : 2.35 });
}

const legacy: Record<string, EnemyForm> = { rat: 'rat', wolf: 'wolf', boar: 'boar', slime: 'larva', spider: 'spider',
  goblin_scout: 'raider', goblin_archer: 'archer', goblin_shaman: 'shaman', thornling: 'thorn', elite_warden: 'treant' };
const legacyTiers: Record<string, number> = { goblin_archer: 2, goblin_shaman: 2, boar: 2, thornling: 2, elite_warden: 4 };
for (const [id, form] of Object.entries(legacy)) appearances.set(id, { id, form, family: id, season: 'spring', tier: legacyTiers[id] ?? 1,
  variant: 0, boss: false, palette: unitPalette(id), scale: id === 'elite_warden' ? 1.18 : 1 });

/** Art has no RNG or gameplay fields: identical definitions always render identically. */
export function getEnemyAppearance(id: string): EnemyAppearance | undefined { return appearances.get(id); }
export function enemyArtId(definition: { id: string; sprite?: string; role?: string }): string {
  return appearances.has(definition.id) ? definition.id : appearances.has(definition.sprite ?? '') ? definition.sprite! : 'goblin_scout';
}
