import { skillSchool } from './skill-catalog-builders';

export const elementalSkills = [
  ...skillSchool('arcane', 20, [
    {
      id: 'prism_bolts', rarity: 'epic', name: 'Призматические стрелы', cooldown: 5, target: 'enemy', projectile: 'arcane',
      description: 'Три независимых удара по одной цели, каждый со своей проверкой попадания 1d20 и уроном 1d6. После гибели цели оставшиеся стрелы не переносятся на другую.',
      actions: [{ type: 'damage', dice: '1d6', hits: 3 }],
      tags: ['MULTIHIT', 'DAMAGE'], icon: { frame: 'arrows', motif: 'crystal', accent: 'rune' },
    },
    {
      id: 'runic_overcharge', rarity: 'rare', name: 'Избыток чар', cooldown: 5, target: 'ally', projectile: 'arcane',
      description: 'На 2 хода даёт союзнику Перенасыщение (отдельный 1d10 к урону каждого прямого удара, броня −5, уклонение −2) и Чародейское зрение (точность +4).',
      actions: [{ type: 'status', statusId: 'overcharge', duration: 2 }, { type: 'status', statusId: 'arcane_sight', duration: 2 }],
      tags: ['BUFF', 'DAMAGE'], icon: { frame: 'burst', motif: 'rune', accent: 'bolt' },
    },
    {
      id: 'mirror_shelter', rarity: 'rare', name: 'Зеркальное убежище', cooldown: 5, target: 'ally', projectile: 'arcane',
      description: 'Даёт союзнику щит на 2d6 + Силу на 3 хода. Заклинатель получает Зеркальный покров на 3 хода: уклонение +1; при расходе созданного им щита бросает 1d4, на 4 поглощает урон без расхода ёмкости.',
      actions: [{ type: 'shield', dice: '2d6', scaling: 'power', duration: 3 }, { type: 'status', statusId: 'mirror_ward', duration: 3, target: 'self' }],
      tags: ['SHIELD'], icon: { frame: 'ward', motif: 'crystal', accent: 'eye' },
    },
    {
      id: 'runic_transmutation', rarity: 'legendary', name: 'Переплетение рун', cooldown: 6, target: 'any', projectile: 'arcane',
      description: 'Союзника лечит на 2d6 + Силу и даёт Эфирный барьер на 3 хода: в начале хода — щит на 2d4, срок слоя 1 ход. Врага атакует на 2d6 + Силу; при попадании — Разлад чар на 3 хода (Сила −5, точность −2). Можно выбрать себя.',
      actions: [{ type: 'heal', dice: '2d6', scaling: 'power', targetRelation: 'ally' }, { type: 'status', statusId: 'aether_barrier', duration: 3, targetRelation: 'ally' }, { type: 'damage', dice: '2d6', scaling: 'power', targetRelation: 'enemy', onHitStatusId: 'arcane_disruption', onHitDuration: 3 }],
      tags: ['HYBRID', 'HEAL', 'SHIELD'], icon: { frame: 'weave', motif: 'rune', accent: 'cross' },
    },
    {
      id: 'unstable_spark', rarity: 'common', name: 'Неверная искра', cooldown: 2, target: 'randomUnit', projectile: 'arcane',
      description: 'Атакует одного случайного живого участника на 1d10 + Силу; может попасть в союзника или себя. Попадание накладывает Сковывающий глиф на 2 хода: проворность −2, следующий бросок инициативы −4; текущая очередь не меняется.',
      actions: [{ type: 'damage', dice: '1d10', scaling: 'power', onHitStatusId: 'binding_glyph', onHitDuration: 2 }],
      tags: ['RANDOM', 'FRIENDLY_FIRE'], icon: { frame: 'orbit', motif: 'bolt', accent: 'rune' },
    },
  ]),
  ...skillSchool('fire', 25, [
    {
      id: 'ember_lance', rarity: 'common', name: 'Копьё углей', cooldown: 3, target: 'enemy', projectile: 'fire',
      description: 'Удар на 2d6 + Силу. При попадании накладывает Тление на 3 хода: в конце хода цели — 1d6 урона с учётом брони.',
      actions: [{ type: 'damage', dice: '2d6', scaling: 'power', onHitStatusId: 'smoldering', onHitDuration: 3 }],
      tags: ['DOT'], icon: { frame: 'slash', motif: 'flame', accent: 'blade' },
    },
    {
      id: 'fire_rain', rarity: 'epic', name: 'Дождь искр', cooldown: 6, target: 'allEnemies', projectile: 'fire',
      description: 'Каждому врагу — удар на 1d6 + половину Силы. Попадание добавляет 1 заряд Горения: в конце хода оно наносит урон по числу зарядов и теряет 1 заряд.',
      actions: [{ type: 'damage', dice: '1d6', scaling: 'power', factor: .5, onHitStatusId: 'burning', onHitDuration: null }],
      tags: ['MASS', 'BURN'], icon: { frame: 'arrows', motif: 'flame', accent: 'star' },
    },
    {
      id: 'cinder_pact', rarity: 'rare', name: 'Пакт горнила', cooldown: 6, target: 'self', projectile: 'fire',
      description: 'Атакует себя на 1d6 без брони. При попадании и выживании получает на 3 хода Угольную кожу (броня +3, дополнительный 1d4 к прямому урону) и Неистовые искры (ещё 1d6 к прямому урону; после действия с уроном 1d6, на 6 — повтор базовой атаки). Может сразу повторить удар по себе с новыми бонусами.',
      actions: [{ type: 'damage', dice: '1d6', bypassArmor: true }, { type: 'status', statusId: 'cinder_skin', duration: 3 }, { type: 'status', statusId: 'volatile_sparks', duration: 3 }],
      tags: ['SACRIFICE', 'REPEAT'], icon: { frame: 'seal', motif: 'flame', accent: 'skull' },
    },
    {
      id: 'flame_tending', rarity: 'rare', name: 'Огонь очага', cooldown: 5, target: 'ally', projectile: 'fire',
      description: 'Сразу восстанавливает выбранному союзнику, включая себя, 3d8 + Силу здоровья.',
      actions: [{ type: 'heal', dice: '3d8', scaling: 'power' }],
      tags: ['HEAL'], icon: { frame: 'rays', motif: 'flame', accent: 'cross' },
    },
    {
      id: 'brand_of_furnace', rarity: 'common', name: 'Клеймо горнила', cooldown: 3, target: 'any', projectile: 'fire',
      description: 'На любую живую цель, включая союзника или себя, сначала накладывает Обугленную броню на 3 хода (броня −6), затем атакует на 2d4 + Силу. Клеймо остаётся даже при промахе.',
      actions: [{ type: 'status', statusId: 'charred_armor', duration: 3 }, { type: 'damage', dice: '2d4', scaling: 'power' }],
      tags: ['FRIENDLY_FIRE', 'DEBUFF'], icon: { frame: 'ward', motif: 'flame', accent: 'shield' },
    },
  ]),
  ...skillSchool('frost', 30, [
    {
      id: 'glacial_spear', rarity: 'common', name: 'Ледяное копьё', cooldown: 3, target: 'enemy', projectile: 'frost',
      description: 'Удар на 2d6 + Силу. Попадание накладывает Обморожение на 3 хода: уклонение −1; в начале хода цели — 1d4 урона без брони.',
      actions: [{ type: 'damage', dice: '2d6', scaling: 'power', onHitStatusId: 'frostbite', onHitDuration: 3 }],
      tags: ['DOT', 'DEBUFF'], icon: { frame: 'slash', motif: 'crystal', accent: 'blade' },
    },
    {
      id: 'winter_sanctum', rarity: 'legendary', name: 'Зимний приют', cooldown: 7, target: 'allAllies', projectile: 'frost',
      description: 'На 2 хода весь отряд получает Иней на доспехе (броня +7, проворность −2) и Снежную пелену (уклонение +3, броня +2). Бонусы брони складываются.',
      actions: [{ type: 'status', statusId: 'rime_armor', duration: 2 }, { type: 'status', statusId: 'snowveil', duration: 2 }],
      tags: ['MASS', 'ARMOR', 'EVASION'], icon: { frame: 'ward', motif: 'crystal', accent: 'feather' },
    },
    {
      id: 'crystal_reliquary', rarity: 'epic', name: 'Хрустальный ковчег', cooldown: 6, target: 'ally', projectile: 'frost',
      description: 'Щит союзнику на 2d8 + Силу на 3 хода. Хрустальная оболочка на 2 хода в начале хода создаёт ещё один слой щита на 1d8, срок каждого слоя — 2 хода.',
      actions: [{ type: 'shield', dice: '2d8', scaling: 'power', duration: 3 }, { type: 'status', statusId: 'crystal_shell', duration: 2 }],
      tags: ['SHIELD'], icon: { frame: 'seal', motif: 'shield', accent: 'crystal' },
    },
    {
      id: 'whiteout', rarity: 'rare', name: 'Белая мгла', cooldown: 5, target: 'allEnemies', projectile: 'frost',
      description: 'На 2 хода всем врагам: Леденящее онемение (крит −4) и Белое безмолвие (урон −3, Сила −3). Не запрещает применять навыки.',
      actions: [{ type: 'status', statusId: 'numbing_cold', duration: 2 }, { type: 'status', statusId: 'white_silence', duration: 2 }],
      tags: ['MASS', 'DEBUFF'], icon: { frame: 'weave', motif: 'crystal', accent: 'moon' },
    },
    {
      id: 'wandering_ice', rarity: 'common', name: 'Блуждающий лёд', cooldown: 5, target: 'randomEnemy', projectile: 'frost',
      description: 'Кубик выбирает одного врага для двух независимых ударов по 1d8. Каждое попадание даёт отдельный Ледяной надлом на 2 хода: броня −3 и 2d4 урона в конце хода за каждый заряд.',
      actions: [{ type: 'damage', dice: '1d8', hits: 2, onHitStatusId: 'glacial_fracture', onHitDuration: 2 }],
      tags: ['RANDOM', 'MULTIHIT', 'DOT'], icon: { frame: 'orbit', motif: 'crystal', accent: 'claw' },
    },
  ]),
  ...skillSchool('storm', 35, [
    {
      id: 'forked_thunder', rarity: 'epic', name: 'Тройной разряд', cooldown: 5, target: 'enemy', projectile: 'lightning',
      description: 'Три независимых удара по одной цели, каждый на 1d6. Попадание накладывает отдельный Статический заряд на 2 хода: крит −1 и 1d4 урона в конце хода за каждый заряд.',
      actions: [{ type: 'damage', dice: '1d6', hits: 3, onHitStatusId: 'static_charge', onHitDuration: 2 }],
      tags: ['MULTIHIT', 'DOT'], icon: { frame: 'arrows', motif: 'bolt', accent: 'claw' },
    },
    {
      id: 'storm_oath', rarity: 'rare', name: 'Обет бури', cooldown: 5, target: 'ally', projectile: 'lightning',
      description: 'На 3 хода даёт союзнику Заряженное острие (отдельный 1d6 к прямому урону, точность +1) и Поступь бури (уклонение и проворность +3).',
      actions: [{ type: 'status', statusId: 'charged_edge', duration: 3 }, { type: 'status', statusId: 'storm_stride', duration: 3 }],
      tags: ['BUFF', 'EVASION'], icon: { frame: 'slash', motif: 'bolt', accent: 'blade' },
    },
    {
      id: 'eye_sanctuary', rarity: 'rare', name: 'Укрытие в буре', cooldown: 6, target: 'self', projectile: 'lightning',
      description: 'Щит себе на 2d6 + Силу на 3 хода. На 3 хода получает Око бури: уменьшает оставшийся урон прямых ударов по отряду броском 1d6, собственная проворность −1.',
      actions: [{ type: 'shield', dice: '2d6', scaling: 'power', duration: 3 }, { type: 'status', statusId: 'eye_of_storm', duration: 3 }],
      tags: ['SHIELD', 'PARTY_GUARD'], icon: { frame: 'ward', motif: 'eye', accent: 'bolt' },
    },
    {
      id: 'random_thunder', rarity: 'common', name: 'Громовой жребий', cooldown: 4, target: 'randomEnemy', projectile: 'lightning',
      description: 'Один случайный враг получает удар на 3d6 + Силу. При попадании — Проводящая метка на 2 хода: броня −4, точность −1.',
      actions: [{ type: 'damage', dice: '3d6', scaling: 'power', onHitStatusId: 'conductive_brand', onHitDuration: 2 }],
      tags: ['RANDOM', 'DEBUFF'], icon: { frame: 'burst', motif: 'bolt', accent: 'rune' },
    },
    {
      id: 'thunderous_roar', rarity: 'legendary', name: 'Голос грозы', cooldown: 7, target: 'allEnemies', projectile: 'lightning',
      description: 'Всем врагам — Оглушительный раскат на 3 хода (точность и следующий бросок инициативы −2). Всем союзникам — Ясность грозы на 2 хода (точность и следующий бросок инициативы +3). Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'deafening_roar', duration: 3 }, { type: 'status', statusId: 'storm_clarity', duration: 2, target: 'allAllies' }],
      tags: ['MASS', 'BUFF', 'DEBUFF'], icon: { frame: 'rays', motif: 'bolt', accent: 'feather' },
    },
  ]),
];
