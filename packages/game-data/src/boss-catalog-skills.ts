import type { SkillDefinition } from '@shards/shared';
import { bossSkill, type BossSkillDraft } from './boss-catalog-builders';

/** Enemy-only repertoire. No rarity or LEARNABLE tag, so these never enter skill rewards. */
const support: [string, BossSkillDraft][] = [
  ['boss_briar_wall', {
    name: 'Стена древней коры', family: 'nature', cooldown: 5, priority: 65, target: 'self', projectile: 'nature',
    description: 'Щит на 3d8 + половину Силы на 2 хода. На 2 хода получает Сердце дуба: броня +6; бонус инициативы −2 не меняет текущую очередь.',
    actions: [{ type: 'shield', dice: '3d8', scaling: 'power', factor: .5, duration: 2 }, { type: 'status', statusId: 'oak_heart', duration: 2 }],
    icon: { frame: 'ward', motif: 'leaf', accent: 'shield' },
  }],
  ['boss_green_renewal', {
    name: 'Сок первозданной рощи', family: 'nature', cooldown: 7, priority: 110, condition: 'selfWounded', target: 'self', projectile: 'nature',
    description: 'Восстанавливает себе 3d8 + половину Силы. На 2 хода получает Дыхание весны: Сила +4.',
    actions: [{ type: 'heal', dice: '3d8', scaling: 'power', factor: .5 }, { type: 'status', statusId: 'spring_breath', duration: 2 }],
    icon: { frame: 'rays', motif: 'leaf', accent: 'cross' },
  }],
  ['boss_hunting_fervor', {
    name: 'Зов великой охоты', family: 'blood', cooldown: 6, priority: 65, target: 'self', projectile: 'blood',
    description: 'На 2 хода получает Жажду крови (+1d6 к каждому прямому удару) и Звериное чутьё (точность +2, уклонение +2).',
    actions: [{ type: 'status', statusId: 'bloodlust', duration: 2 }, { type: 'status', statusId: 'wild_instinct', duration: 2 }],
    icon: { frame: 'seal', motif: 'fang', accent: 'eye' },
  }],
  ['boss_spore_carapace', {
    name: 'Панцирь спор', family: 'venom', cooldown: 5, priority: 65, target: 'self', projectile: 'poison',
    description: 'Щит на 2d8 + половину Силы на 3 хода. Споровая мантия на 2 хода в начале хода создаёт ещё 1d4 + Силу щита.',
    actions: [{ type: 'shield', dice: '2d8', scaling: 'power', factor: .5, duration: 3 }, { type: 'status', statusId: 'spore_mantle', duration: 2 }],
    icon: { frame: 'ward', motif: 'fang', accent: 'leaf' },
  }],
  ['boss_furnace_form', {
    name: 'Пробуждение горнила', family: 'fire', cooldown: 6, priority: 65, target: 'self', projectile: 'fire',
    description: 'На 2 хода Угольная кожа даёт броню +3 и +1d4 к урону, Неистовые искры добавляют +1d6 к урону и повтор базовой атаки на 6 при броске 1d6 после атаки.',
    actions: [{ type: 'status', statusId: 'cinder_skin', duration: 2 }, { type: 'status', statusId: 'volatile_sparks', duration: 2 }],
    icon: { frame: 'burst', motif: 'flame', accent: 'rock' },
  }],
  ['boss_slag_rain', {
    name: 'Ливень шлака', family: 'fire', cooldown: 5, priority: 60, target: 'allEnemies', projectile: 'fire',
    description: 'По каждому противнику — отдельное попадание на 1d6 + треть Силы. Успех обугливает броню на 2 хода: броня −6.',
    actions: [{ type: 'damage', dice: '1d6', scaling: 'power', factor: 1 / 3, onHitStatusId: 'charred_armor', onHitDuration: 2 }],
    icon: { frame: 'arrows', motif: 'flame', accent: 'shield' },
  }],
  ['boss_blood_feast', {
    name: 'Чаша хищника', family: 'blood', cooldown: 7, priority: 110, condition: 'selfWounded', target: 'self', projectile: 'blood',
    description: 'Восстанавливает 2d8 + Силу. На 3 хода получает Жажду хищника: попадания лечат на 1d4, точность +1.',
    actions: [{ type: 'heal', dice: '2d8', scaling: 'power' }, { type: 'status', statusId: 'predators_thirst', duration: 3 }],
    icon: { frame: 'rays', motif: 'drop', accent: 'fang' },
  }],
  ['boss_predators_gaze', {
    name: 'Взгляд неминуемого', family: 'shadow', cooldown: 6, priority: 65, target: 'self', projectile: 'shadow',
    description: 'На 2 хода Чародейское зрение даёт точность +4, Смертоносность — критический удар +5.',
    actions: [{ type: 'status', statusId: 'arcane_sight', duration: 2 }, { type: 'status', statusId: 'lethality', duration: 2 }],
    icon: { frame: 'seal', motif: 'eye', accent: 'blade' },
  }],
  ['boss_ossuary_wall', {
    name: 'Крепость оссуария', family: 'spirit', cooldown: 6, priority: 65, target: 'self', projectile: 'bone',
    description: 'Щит на 3d8 + Силу на 3 хода. На 2 хода Завет оссуария даёт броню +2 и поглощение без расхода щита на 6–8 при броске 1d8.',
    actions: [{ type: 'shield', dice: '3d8', scaling: 'power', duration: 3 }, { type: 'status', statusId: 'ossuary_pact', duration: 2 }],
    icon: { frame: 'ward', motif: 'bone', accent: 'shield' },
  }],
  ['boss_night_mantle', {
    name: 'Облачение безлунья', family: 'shadow', cooldown: 6, priority: 65, target: 'self', projectile: 'shadow',
    description: 'На 2 хода получает Доспех сумрака (броня +4, уклонение +2) и Эхо тени (крит +1; на 5–6 при 1d6 повторяет базовую атаку).',
    actions: [{ type: 'status', statusId: 'gloom_armor', duration: 2 }, { type: 'status', statusId: 'shadow_echo', duration: 2 }],
    icon: { frame: 'weave', motif: 'moon', accent: 'feather' },
  }],
  ['boss_grave_mending', {
    name: 'Память погребённых', family: 'spirit', cooldown: 7, priority: 110, condition: 'selfWounded', target: 'self', projectile: 'bone',
    description: 'Лечит себя на 3d8 + половину Силы. На 2 хода получает Заживление души: в конце хода восстанавливает 2d4 + Силу.',
    actions: [{ type: 'heal', dice: '3d8', scaling: 'power', factor: .5 }, { type: 'status', statusId: 'soul_mending', duration: 2 }],
    icon: { frame: 'rays', motif: 'skull', accent: 'wisp' },
  }],
  ['boss_rending_sweep', {
    name: 'Распарывающий взмах', family: 'war', cooldown: 4, priority: 60, target: 'enemy',
    description: 'Удар на 2d6 + Силу. Попадание вызывает Кровотечение на 2 хода: 1d4 урона без брони в конце хода цели.',
    actions: [{ type: 'damage', dice: '2d6', scaling: 'power', onHitStatusId: 'bleeding', onHitDuration: 2 }],
    icon: { frame: 'slash', motif: 'blade', accent: 'drop' },
  }],
  ['boss_glacial_shell', {
    name: 'Панцирь ледника', family: 'frost', cooldown: 6, priority: 65, target: 'self', projectile: 'frost',
    description: 'Щит на 3d10 + половину Силы на 3 хода. На 2 хода Снежная пелена даёт уклонение +3 и броню +2.',
    actions: [{ type: 'shield', dice: '3d10', scaling: 'power', factor: .5, duration: 3 }, { type: 'status', statusId: 'snowveil', duration: 2 }],
    icon: { frame: 'ward', motif: 'crystal', accent: 'shield' },
  }],
  ['boss_winter_edict', {
    name: 'Приговор стужи', family: 'frost', cooldown: 6, priority: 60, target: 'allEnemies', projectile: 'frost',
    description: 'На 2 хода всем противникам: Леденящее онемение (крит −4) и Белое безмолвие (Сила −3, урон −3).',
    actions: [{ type: 'status', statusId: 'numbing_cold', duration: 2 }, { type: 'status', statusId: 'white_silence', duration: 2 }],
    icon: { frame: 'seal', motif: 'crystal', accent: 'moon' },
  }],
  ['boss_stellar_oath', {
    name: 'Клятва холодных звёзд', family: 'astral', cooldown: 6, priority: 65, target: 'self', projectile: 'arcane',
    description: 'На 2 хода Звёздная точность даёт точность +4 и крит +1, Клинок звёздного огня — отдельный 1d8 к урону и ещё крит +1.',
    actions: [{ type: 'status', statusId: 'stellar_precision', duration: 2 }, { type: 'status', statusId: 'starfire_blade', duration: 2 }],
    icon: { frame: 'orbit', motif: 'star', accent: 'blade' },
  }],
  ['boss_last_thaw', {
    name: 'Оттепель под ледником', family: 'frost', cooldown: 7, priority: 110, condition: 'selfWounded', target: 'self', projectile: 'frost',
    description: 'Восстанавливает себе 3d10 + половину Силы. На 2 хода Иней на доспехе даёт броню +7 и проворность −2.',
    actions: [{ type: 'heal', dice: '3d10', scaling: 'power', factor: .5 }, { type: 'status', statusId: 'rime_armor', duration: 2 }],
    icon: { frame: 'rays', motif: 'crystal', accent: 'cross' },
  }],
];

export const bossSupportSkills: SkillDefinition[] = support.map(([id, skill], index) => bossSkill(id, skill, 300 + index));
