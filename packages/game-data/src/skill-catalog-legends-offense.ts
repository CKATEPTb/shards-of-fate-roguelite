import { skillSchool } from './skill-catalog-builders';

/** Legendary battle arts. Durations count the affected unit's own turns. */
export const legendaryOffenseSkills = [
  ...skillSchool('blood', 240, [
    {
      id: 'crown_of_the_crimson_sovereign', name: 'Корона алого государя', rarity: 'legendary', cooldown: 8, target: 'enemy', projectile: 'blood',
      description: 'На 3 хода получает Цену крови (+4 к броскам урона, Защита каждой части тела −4) и Жажду хищника: Точность +1, после прямого урона здоровью врага лечится на 1d4, не больше нанесённого урона. Затем трижды атакует выбранного врага, каждый удар — 1d8 + половина Силы; каждое попадание оставляет отдельное Кровотечение на 3 хода: 1d4 урона без Защиты в конце хода. Цена крови усиливает и эти броски урона.',
      actions: [{ type: 'status', statusId: 'blood_price', duration: 3, target: 'self' }, { type: 'status', statusId: 'predators_thirst', duration: 3, target: 'self' }, { type: 'damage', dice: '1d8', scaling: 'power', factor: .5, hits: 3, onHitStatusId: 'bleeding', onHitDuration: 3 }],
      tags: ['MULTIHIT', 'BLEED', 'VAMPIRISM', 'TRADEOFF'], icon: { frame: 'rays', motif: 'fang', accent: 'star' },
    },
    {
      id: 'seal_of_the_final_pulse', name: 'Печать последнего пульса', rarity: 'legendary', cooldown: 9, target: 'any', projectile: 'blood',
      description: 'Союзнику создаёт щит на 4d8 + Силу на 3 хода и Багровое восстановление на 4 хода: 1d4 + Сила источника в начале хода. Врагу сначала оставляет Рваную рану на 4 хода (Сила −2, в конце хода 1d6 урона без Защиты), затем атакует на 4d8 + Силу, игнорируя Защиту. Рана остаётся при промахе. Щиты и полное блокирование продолжают защищать от удара.',
      actions: [{ type: 'shield', dice: '4d8', scaling: 'power', duration: 3, targetRelation: 'ally' }, { type: 'status', statusId: 'crimson_mending', duration: 4, targetRelation: 'ally' }, { type: 'status', statusId: 'open_wound', duration: 4, targetRelation: 'enemy' }, { type: 'damage', dice: '4d8', scaling: 'power', bypassArmor: true, targetRelation: 'enemy' }],
      tags: ['HYBRID', 'SHIELD', 'HOT', 'BLEED', 'PIERCE'], icon: { frame: 'seal', motif: 'drop', accent: 'hourglass' },
    },
  ]),
  ...skillSchool('shadow', 242, [
    {
      id: 'starless_sentence', name: 'Беззвёздный приговор', rarity: 'legendary', cooldown: 8, target: 'enemy', projectile: 'shadow',
      description: 'Сначала получает Изворотливость на 3 хода (Уклонение +4) и накладывает на выбранного врага Тьму в глазах на 4 хода (Точность −4). Затем наносит один удар на 5d8 + Силу. Обе ауры остаются при промахе; естественная 20 врага всё ещё гарантирует попадание.',
      actions: [{ type: 'status', statusId: 'evasiveness', duration: 3, target: 'self' }, { type: 'status', statusId: 'blackout', duration: 4 }, { type: 'damage', dice: '5d8', scaling: 'power' }],
      tags: ['DAMAGE', 'DEBUFF', 'EVASION'], icon: { frame: 'slash', motif: 'moon', accent: 'star' },
    },
    {
      id: 'mantle_of_a_thousand_shadows', name: 'Мантия тысячи теней', rarity: 'legendary', cooldown: 8, target: 'allEnemies', projectile: 'shadow',
      description: 'Всем врагам на 3 хода накладывает Тьму в глазах: Точность −4. Заклинателю на 4 хода даёт Сокрытое лезвие (Точность +3, дополнительный 1d4 к прямым ударам) и Эхо тени: Критический удар +1; после действия с уроном — 1d6, на 5+ повтор базовой атаки по той же живой цели без цепочки повторов. При применении урона и проверки повтора нет.',
      actions: [{ type: 'status', statusId: 'blackout', duration: 3 }, { type: 'status', statusId: 'veiled_blade', duration: 4, target: 'self' }, { type: 'status', statusId: 'shadow_echo', duration: 4, target: 'self' }],
      tags: ['MASS', 'DEBUFF', 'BUFF', 'REPEAT'], icon: { frame: 'weave', motif: 'moon', accent: 'feather' },
    },
  ]),
  ...skillSchool('arcane', 244, [
    {
      id: 'judgement_of_the_broken_star', name: 'Суд расколотой звезды', rarity: 'legendary', cooldown: 7, target: 'randomUnit', projectile: 'arcane',
      description: 'Кубик выбирает одного живого участника. Союзнику — щит на 4d8 + Силу на 3 хода, затем Безупречная формула на 3 хода: Точность, Критический удар и Сила +2. Врагу сначала даёт Разлад чар на 3 хода (Сила −5, Точность −2), затем удар на 3d10 + Силу без Защиты. Попадание оставляет Ожог эфира на 3 хода: 1d6 урона без Защиты в начале хода. Разлад остаётся при промахе.',
      actions: [{ type: 'shield', dice: '4d8', scaling: 'power', duration: 3, targetRelation: 'ally' }, { type: 'status', statusId: 'perfect_formula', duration: 3, targetRelation: 'ally' }, { type: 'status', statusId: 'arcane_disruption', duration: 3, targetRelation: 'enemy' }, { type: 'damage', dice: '3d10', scaling: 'power', bypassArmor: true, targetRelation: 'enemy', onHitStatusId: 'mana_scorch', onHitDuration: 3 }],
      tags: ['RANDOM', 'HYBRID', 'SHIELD', 'PIERCE', 'DOT'], icon: { frame: 'orbit', motif: 'crystal', accent: 'star' },
    },
    {
      id: 'limit_of_incantation', name: 'Предел заклятия', rarity: 'legendary', cooldown: 10, target: 'enemy', projectile: 'arcane',
      description: 'Получает Перенасыщение на 3 хода: каждый прямой удар получает дополнительный 1d10, но Защита каждой части тела −5 и Уклонение −2. Затем четыре независимых удара по выбранному врагу, каждый на 1d6 + половину Силы и уже с дополнительным 1d10. После гибели цели оставшиеся удары не перенаправляются. Перенасыщение остаётся даже при всех промахах.',
      actions: [{ type: 'status', statusId: 'overcharge', duration: 3, target: 'self' }, { type: 'damage', dice: '1d6', scaling: 'power', factor: .5, hits: 4 }],
      tags: ['MULTIHIT', 'BUFF', 'TRADEOFF'], icon: { frame: 'arrows', motif: 'rune', accent: 'bolt' },
    },
  ]),
  ...skillSchool('fire', 246, [
    {
      id: 'heart_of_the_black_sun', name: 'Сердце чёрного солнца', rarity: 'legendary', cooldown: 9, target: 'enemy', projectile: 'fire',
      description: 'Сначала получает Угольную кожу на 3 хода: Защита каждой части тела +3 и дополнительный 1d4 к прямым ударам. Врагу на 4 хода накладывает Обугленную броню: Защита −6. Затем три удара по нему, каждый на 1d12 + половину Силы и 1d4 от кожи; каждое попадание добавляет заряд Горения. В конце хода Горение наносит урон по числу зарядов и теряет один заряд. Обугленная броня остаётся при промахах.',
      actions: [{ type: 'status', statusId: 'cinder_skin', duration: 3, target: 'self' }, { type: 'status', statusId: 'charred_armor', duration: 4 }, { type: 'damage', dice: '1d12', scaling: 'power', factor: .5, hits: 3, onHitStatusId: 'burning', onHitDuration: null }],
      tags: ['MULTIHIT', 'BURN', 'ARMOR', 'DEBUFF'], icon: { frame: 'rays', motif: 'flame', accent: 'moon' },
    },
  ]),
  ...skillSchool('frost', 247, [
    {
      id: 'decree_of_the_frozen_throne', name: 'Указ ледяного трона', rarity: 'legendary', cooldown: 9, target: 'allEnemies', projectile: 'frost',
      description: 'На 3 хода всем врагам — Белое безмолвие (Сила −3, броски урона −3) и Леденящее онемение (Критический удар −4). Всем союзникам на 3 хода — Зимняя сосредоточенность: Точность +3, Критический удар +2. Бросков попадания нет; умения врагов и их ходы не блокируются.',
      actions: [{ type: 'status', statusId: 'white_silence', duration: 3 }, { type: 'status', statusId: 'numbing_cold', duration: 3 }, { type: 'status', statusId: 'winter_focus', duration: 3, target: 'allAllies' }],
      tags: ['MASS', 'BUFF', 'DEBUFF', 'CRITICAL'], icon: { frame: 'seal', motif: 'crystal', accent: 'eye' },
    },
  ]),
  ...skillSchool('storm', 248, [
    {
      id: 'spear_of_the_storm_king', name: 'Копьё короля бурь', rarity: 'legendary', cooldown: 9, target: 'enemy', projectile: 'lightning',
      description: 'До атаки создаёт на себе щит на 2d6 + Силу на 3 хода. Затем один удар по выбранному врагу на 5d10 + Силу, игнорирующий Защиту, но не щиты и полное блокирование. Попадание накладывает Статический заряд на 3 хода: Критический удар −1, в конце хода 1d4 урона с учётом Защиты. Собственный щит сохраняется при промахе.',
      actions: [{ type: 'shield', dice: '2d6', scaling: 'power', duration: 3, target: 'self' }, { type: 'damage', dice: '5d10', scaling: 'power', bypassArmor: true, onHitStatusId: 'static_charge', onHitDuration: 3 }],
      tags: ['DAMAGE', 'PIERCE', 'SHIELD', 'DOT'], icon: { frame: 'slash', motif: 'bolt', accent: 'shield' },
    },
  ]),
  ...skillSchool('stone', 249, [
    {
      id: 'fall_of_the_heavenly_vault', name: 'Падение небесной тверди', rarity: 'legendary', cooldown: 9, target: 'enemy', projectile: 'stone',
      description: 'Сначала получает Намерение лавины на 3 хода: дополнительный 1d8 к прямым ударам, Критический удар +2, Точность −2. На врага накладывает Линию разлома на 3 хода (Защита каждой части тела −8, Проворность −1), затем атакует на 6d6 + Силу и 1d8 от лавины. Обе ауры остаются при промахе.',
      actions: [{ type: 'status', statusId: 'avalanche_intent', duration: 3, target: 'self' }, { type: 'status', statusId: 'fault_line', duration: 3 }, { type: 'damage', dice: '6d6', scaling: 'power' }],
      tags: ['DAMAGE', 'DEBUFF', 'BUFF', 'TRADEOFF'], icon: { frame: 'burst', motif: 'rock', accent: 'star' },
    },
  ]),
  ...skillSchool('metal', 250, [
    {
      id: 'birth_of_a_thousand_blades', name: 'Рождение тысячи клинков', rarity: 'legendary', cooldown: 10, target: 'allEnemies', projectile: 'arrow',
      description: 'Получает Магнитный покров на 3 хода: Уклонение +2, Защита каждой части тела +4. Всем врагам сначала накладывает Ржавчину на 3 хода (Защита −5, броски урона −2), затем по каждому — три независимых удара, каждый на 1d4 + половину Силы. Ржавчина остаётся при промахах; удары не переходят с погибшего врага на другого.',
      actions: [{ type: 'status', statusId: 'magnetic_ward', duration: 3, target: 'self' }, { type: 'status', statusId: 'rust', duration: 3 }, { type: 'damage', dice: '1d4', scaling: 'power', factor: .5, hits: 3 }],
      tags: ['MASS', 'MULTIHIT', 'DEBUFF', 'EVASION'], icon: { frame: 'arrows', motif: 'blade', accent: 'shield' },
    },
  ]),
  ...skillSchool('war', 251, [
    {
      id: 'oath_of_the_last_rampart', name: 'Клятва последнего рубежа', rarity: 'legendary', cooldown: 8, target: 'enemy', projectile: 'arrow',
      description: 'На 3 хода получает Клятву несгибаемого (провокация, Защита каждой части тела +5) и Боевой транс: Точность +2, броски урона +3, Уклонение −2. Затем атакует выбранного врага на 4d8 + Силу и уже с бонусом +3. Враги обязаны атаковать заклинателя, при нескольких провокациях действует последняя. Обе ауры сохраняются при промахе.',
      actions: [{ type: 'status', statusId: 'unyielding_oath', duration: 3, target: 'self' }, { type: 'status', statusId: 'battle_trance', duration: 3, target: 'self' }, { type: 'damage', dice: '4d8', scaling: 'power' }],
      tags: ['DAMAGE', 'TAUNT', 'ARMOR', 'TRADEOFF'], icon: { frame: 'ward', motif: 'blade', accent: 'claw' },
    },
  ]),
];
