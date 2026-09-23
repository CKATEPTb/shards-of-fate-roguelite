import { skillSchool } from './skill-catalog-builders';

/** Additional learnable techniques. Every duration counts the recipient's own turns. */
export const elementalExpansionSkills = [
  ...skillSchool('fire', 150, [
    {
      id: 'searing_brand', name: 'Раскалённое тавро', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'fire',
      description: 'Удар на 1d8 + Силу. При попадании — Тление на 2 хода: в конце хода цели наносит 1d6 урона с учётом Защиты.',
      actions: [{ type: 'damage', dice: '1d8', scaling: 'power', onHitStatusId: 'smoldering', onHitDuration: 2 }],
      tags: ['DAMAGE', 'DOT'], icon: { frame: 'seal', motif: 'flame', accent: 'fang' },
    },
    {
      id: 'hearth_coal', name: 'Живой уголёк', rarity: 'common', cooldown: 3, target: 'ally', projectile: 'fire',
      description: 'Лечит союзника на 1d6 + Силу. Даёт Сердце горнила на 2 хода: +2 к броскам урона и лечение на 1d4 без Силы в конце собственного хода.',
      actions: [{ type: 'heal', dice: '1d6', scaling: 'power' }, { type: 'status', statusId: 'furnace_heart', duration: 2 }],
      tags: ['HEAL', 'HOT', 'BUFF'], icon: { frame: 'orbit', motif: 'flame', accent: 'drop' },
    },
    {
      id: 'ash_curtain', name: 'Завеса пепла', rarity: 'rare', cooldown: 5, target: 'allEnemies', projectile: 'fire',
      description: 'На 2 хода накладывает на всех врагов Пепельное удушье: Точность −3, Сила −2. Попадание не проверяется.',
      actions: [{ type: 'status', statusId: 'ash_choke', duration: 2 }],
      tags: ['MASS', 'DEBUFF'], icon: { frame: 'weave', motif: 'flame', accent: 'feather' },
    },
    {
      id: 'phoenix_vigil', name: 'Бдение феникса', rarity: 'epic', cooldown: 6, target: 'ally', projectile: 'fire',
      description: 'Лечит союзника на 2d6 + Силу. На 3 хода даёт Искры жизни (1d8 + Сила источника в начале хода) и Огненный заслон: Защита каждой части тела +2, в начале хода новый щит на 1d8 со сроком 1 ход.',
      actions: [{ type: 'heal', dice: '2d6', scaling: 'power' }, { type: 'status', statusId: 'embers_of_life', duration: 3 }, { type: 'status', statusId: 'flameward', duration: 3 }],
      tags: ['HEAL', 'HOT', 'SHIELD'], icon: { frame: 'rays', motif: 'feather', accent: 'flame' },
    },
    {
      id: 'sun_pyre', name: 'Погребальный костёр солнца', rarity: 'legendary', cooldown: 9, target: 'allEnemies', projectile: 'fire',
      description: 'Два независимых удара по каждому врагу, каждый на 2d6 + половину Силы. Каждое попадание добавляет заряд Горения. Всем союзникам на 2 хода даёт Знак огненного клинка: Критический удар +3, Точность +1.',
      actions: [{ type: 'damage', dice: '2d6', scaling: 'power', factor: .5, hits: 2, onHitStatusId: 'burning', onHitDuration: null }, { type: 'status', statusId: 'firebrand', duration: 2, target: 'allAllies' }],
      tags: ['MASS', 'MULTIHIT', 'BURN', 'BUFF'], icon: { frame: 'burst', motif: 'star', accent: 'flame' },
    },
  ]),
  ...skillSchool('frost', 155, [
    {
      id: 'brittle_needles', name: 'Хрупкие иглы', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'frost',
      description: 'Два независимых удара по выбранному врагу, каждый на 1d4. Каждое попадание накладывает отдельное Обморожение на 2 хода: Уклонение −1, в начале хода 1d4 урона без Защиты за каждый заряд.',
      actions: [{ type: 'damage', dice: '1d4', hits: 2, onHitStatusId: 'frostbite', onHitDuration: 2 }],
      tags: ['MULTIHIT', 'DOT'], icon: { frame: 'arrows', motif: 'crystal', accent: 'fang' },
    },
    {
      id: 'meltwater_cup', name: 'Чаша талой воды', rarity: 'common', cooldown: 4, target: 'ally', projectile: 'frost',
      description: 'Лечит союзника на 2d4 + Силу. На 2 хода даёт Пульс оттепели: в конце хода восстанавливает 1d6 + Силу источника.',
      actions: [{ type: 'heal', dice: '2d4', scaling: 'power' }, { type: 'status', statusId: 'thawing_pulse', duration: 2 }],
      tags: ['HEAL', 'HOT'], icon: { frame: 'seal', motif: 'drop', accent: 'crystal' },
    },
    {
      id: 'winter_hunter', name: 'Обет зимнего охотника', rarity: 'rare', cooldown: 5, target: 'self', projectile: 'frost',
      description: 'На 3 хода получает Зимнюю сосредоточенность: Точность +3, Критический удар +2. На 2 хода — Снежную пелену: Уклонение +3, Защита каждой части тела +2.',
      actions: [{ type: 'status', statusId: 'winter_focus', duration: 3 }, { type: 'status', statusId: 'snowveil', duration: 2 }],
      tags: ['BUFF', 'EVASION'], icon: { frame: 'rays', motif: 'eye', accent: 'crystal' },
    },
    {
      id: 'ice_prison', name: 'Узилище вечной мерзлоты', rarity: 'epic', cooldown: 6, target: 'enemy', projectile: 'frost',
      description: 'Сначала на 3 хода накладывает Промерзание (следующая Инициатива −3, Проворность −2) и Леденящее онемение (Критический удар −4). Затем атакует на 3d6 + Силу; попадание оставляет Ледяной надлом на 2 хода: Защита −3, 2d4 урона в конце хода. Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'chilled', duration: 3 }, { type: 'status', statusId: 'numbing_cold', duration: 3 }, { type: 'damage', dice: '3d6', scaling: 'power', onHitStatusId: 'glacial_fracture', onHitDuration: 2 }],
      tags: ['DAMAGE', 'DEBUFF', 'DOT'], icon: { frame: 'weave', motif: 'crystal', accent: 'bone' },
    },
    {
      id: 'polar_vault', name: 'Свод полярной ночи', rarity: 'legendary', cooldown: 9, target: 'allAllies', projectile: 'frost',
      description: 'Каждому союзнику создаёт щит на 3d6 + Силу сроком 3 хода. На 3 хода даёт Хрустальную оболочку (в начале хода щит на 1d8, срок слоя 2 хода) и Снежную пелену (Уклонение +3, Защита каждой части тела +2).',
      actions: [{ type: 'shield', dice: '3d6', scaling: 'power', duration: 3 }, { type: 'status', statusId: 'crystal_shell', duration: 3 }, { type: 'status', statusId: 'snowveil', duration: 3 }],
      tags: ['MASS', 'SHIELD', 'EVASION'], icon: { frame: 'ward', motif: 'moon', accent: 'crystal' },
    },
  ]),
  ...skillSchool('storm', 160, [
    {
      id: 'swift_current', name: 'Попутный разряд', rarity: 'common', cooldown: 3, target: 'ally', projectile: 'lightning',
      description: 'Даёт выбранному союзнику Поступь бури на 2 хода: Уклонение +3, Проворность +3.',
      actions: [{ type: 'status', statusId: 'storm_stride', duration: 2 }],
      tags: ['BUFF', 'EVASION'], icon: { frame: 'slash', motif: 'feather', accent: 'bolt' },
    },
    {
      id: 'spark_net', name: 'Сеть искр', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'lightning',
      description: 'Удар на 1d6 + Силу. При попадании — Статический заряд на 2 хода: Критический удар −1, в конце хода цели 1d4 урона с учётом Защиты.',
      actions: [{ type: 'damage', dice: '1d6', scaling: 'power', onHitStatusId: 'static_charge', onHitDuration: 2 }],
      tags: ['DAMAGE', 'DOT'], icon: { frame: 'weave', motif: 'bolt', accent: 'rune' },
    },
    {
      id: 'sky_wound', name: 'Рана небосвода', rarity: 'rare', cooldown: 4, target: 'randomEnemy', projectile: 'lightning',
      description: 'Кубик выбирает одного врага: удар на 2d8 + Силу. При попадании — Проводящая метка на 3 хода: Защита каждой части тела −4, Точность −1.',
      actions: [{ type: 'damage', dice: '2d8', scaling: 'power', onHitStatusId: 'conductive_brand', onHitDuration: 3 }],
      tags: ['RANDOM', 'DAMAGE', 'DEBUFF'], icon: { frame: 'seal', motif: 'bolt', accent: 'claw' },
    },
    {
      id: 'tempest_invocation', name: 'Воззвание к шквалу', rarity: 'epic', cooldown: 6, target: 'self', projectile: 'lightning',
      description: 'На 3 хода получает Заряженное острие (1d6 к каждому прямому удару, Точность +1) и Порыв шквала: после действия с уроном бросает 1d8, на 6+ повторяет базовую атаку по той же живой цели. Следующая Инициатива +1; текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'charged_edge', duration: 3 }, { type: 'status', statusId: 'tempest_surge', duration: 3 }],
      tags: ['BUFF', 'REPEAT'], icon: { frame: 'orbit', motif: 'bolt', accent: 'blade' },
    },
    {
      id: 'thunder_judgement', name: 'Приговор громовержца', rarity: 'legendary', cooldown: 9, target: 'allEnemies', projectile: 'lightning',
      description: 'По каждому врагу — три независимых удара, каждый на 1d8 + половину Силы. Каждое попадание накладывает отдельный Статический заряд на 2 хода: Критический удар −1 и 1d4 урона в конце хода за каждый заряд. Удары не переходят с погибшей цели на другую.',
      actions: [{ type: 'damage', dice: '1d8', scaling: 'power', factor: .5, hits: 3, onHitStatusId: 'static_charge', onHitDuration: 2 }],
      tags: ['MASS', 'MULTIHIT', 'DOT'], icon: { frame: 'arrows', motif: 'bolt', accent: 'star' },
    },
  ]),
  ...skillSchool('stone', 165, [
    {
      id: 'falling_crag', name: 'Падение утёса', rarity: 'common', cooldown: 2, target: 'enemy', projectile: 'stone',
      description: 'Один удар по выбранному врагу на 1d10 + Силу; попадание и критический удар проверяются отдельными 1d20.',
      actions: [{ type: 'damage', dice: '1d10', scaling: 'power' }],
      tags: ['DAMAGE'], icon: { frame: 'slash', motif: 'rock', accent: 'claw' },
    },
    {
      id: 'steadfast_heart', name: 'Несдвигаемое сердце', rarity: 'common', cooldown: 4, target: 'self', projectile: 'stone',
      description: 'На 2 хода получает Решимость горы: оставшийся после Защиты входящий урон уменьшается на 5, Проворность −2. Урон, игнорирующий Защиту, обходит это уменьшение.',
      actions: [{ type: 'status', statusId: 'mountain_resolve', duration: 2 }],
      tags: ['GUARD'], icon: { frame: 'seal', motif: 'rock', accent: 'shield' },
    },
    {
      id: 'cairn_rest', name: 'Покой у менгира', rarity: 'rare', cooldown: 5, target: 'ally', projectile: 'stone',
      description: 'Лечит союзника на 1d8 + Силу. На 3 хода даёт Мох веков: в начале собственного хода восстанавливает 1d10 здоровья без Силы.',
      actions: [{ type: 'heal', dice: '1d8', scaling: 'power' }, { type: 'status', statusId: 'moss_of_ages', duration: 3 }],
      tags: ['HEAL', 'HOT'], icon: { frame: 'weave', motif: 'leaf', accent: 'rock' },
    },
    {
      id: 'fault_crown', name: 'Венец разломов', rarity: 'epic', cooldown: 6, target: 'allEnemies', projectile: 'stone',
      description: 'На всех врагов сначала накладывает Линию разлома на 2 хода: Защита каждой части тела −8, Проворность −1. Затем каждому — удар на 1d6 + половину Силы. Разлом сохраняется при промахе.',
      actions: [{ type: 'status', statusId: 'fault_line', duration: 2 }, { type: 'damage', dice: '1d6', scaling: 'power', factor: .5 }],
      tags: ['MASS', 'DAMAGE', 'DEBUFF'], icon: { frame: 'burst', motif: 'rock', accent: 'rune' },
    },
    {
      id: 'worldroot_bastion', name: 'Опора мироздания', rarity: 'legendary', cooldown: 9, target: 'self', projectile: 'stone',
      description: 'Создаёт на себе щит на 4d6 + Силу сроком 4 хода. На 4 хода получает Укрытие монолита (своя Защита +2, урон после Защиты по отряду −3) и Гравийный заслон: в начале хода новый щит на 2d6, срок слоя 1 ход.',
      actions: [{ type: 'shield', dice: '4d6', scaling: 'power', duration: 4 }, { type: 'status', statusId: 'sheltering_monolith', duration: 4 }, { type: 'status', statusId: 'gravel_guard', duration: 4 }],
      tags: ['SHIELD', 'PARTY_GUARD'], icon: { frame: 'ward', motif: 'rock', accent: 'star' },
    },
  ]),
  ...skillSchool('metal', 170, [
    {
      id: 'corroded_nail', name: 'Ржавый гвоздь', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'arrow',
      description: 'Удар на 1d6 + Силу. При попадании — Ржавчина на 2 хода: Защита каждой части тела −5, броски урона −2.',
      actions: [{ type: 'damage', dice: '1d6', scaling: 'power', onHitStatusId: 'rust', onHitDuration: 2 }],
      tags: ['DAMAGE', 'DEBUFF'], icon: { frame: 'slash', motif: 'blade', accent: 'drop' },
    },
    {
      id: 'iron_stitch', name: 'Железный шов', rarity: 'common', cooldown: 3, target: 'ally', projectile: 'stone',
      description: 'Создаёт на выбранном союзнике прочный, но недолговечный щит ёмкостью 2d6 + Сила на 1 его собственный ход.',
      actions: [{ type: 'shield', dice: '2d6', scaling: 'power', duration: 1 }],
      tags: ['SHIELD'], icon: { frame: 'weave', motif: 'shield', accent: 'blade' },
    },
    {
      id: 'mercurial_dance', name: 'Танец ртутных лезвий', rarity: 'rare', cooldown: 5, target: 'self', projectile: 'arrow',
      description: 'Ртутный шаг на 3 хода: Проворность +5, Защита −2, следующая Инициатива +2. Танец клинков на 2 хода: Уклонение +2; после действия с уроном 1d4, на 4 — повтор базовой атаки по той же живой цели. Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'mercury_step', duration: 3 }, { type: 'status', statusId: 'sword_dance', duration: 2 }],
      tags: ['EVASION', 'REPEAT'], icon: { frame: 'orbit', motif: 'blade', accent: 'drop' },
    },
    {
      id: 'bladed_cage', name: 'Клетка из лезвий', rarity: 'epic', cooldown: 6, target: 'enemy', projectile: 'arrow',
      description: 'Четыре независимых удара по одному врагу, каждый на 1d4. Каждое попадание накладывает отдельные Зазубренные оковы на 3 хода: Проворность −3 и 1d4 урона без Защиты в конце хода за каждый заряд.',
      actions: [{ type: 'damage', dice: '1d4', hits: 4, onHitStatusId: 'barbed_shackles', onHitDuration: 3 }],
      tags: ['MULTIHIT', 'DOT', 'BLEED'], icon: { frame: 'arrows', motif: 'blade', accent: 'fang' },
    },
    {
      id: 'steel_cathedral', name: 'Стальной собор', rarity: 'legendary', cooldown: 10, target: 'allAllies', projectile: 'stone',
      description: 'На 4 хода заклинатель получает Железный хор: уменьшает оставшийся урон прямых ударов по отряду броском 1d8, следующая Инициатива −3. Каждому союзнику — щит на 2d6 + половину Силы на 3 хода и Железный цветок на 3 хода (в начале хода щит на 1d10, срок слоя 2 хода). Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'iron_chorus', duration: 4, target: 'self' }, { type: 'shield', dice: '2d6', scaling: 'power', factor: .5, duration: 3 }, { type: 'status', statusId: 'iron_bloom', duration: 3 }],
      tags: ['MASS', 'SHIELD', 'PARTY_GUARD'], icon: { frame: 'ward', motif: 'shield', accent: 'rune' },
    },
  ]),
  ...skillSchool('venom', 175, [
    {
      id: 'viper_cut', name: 'Порез гадюки', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'poison',
      description: 'Удар на 1d8 + Силу. При попадании — Ядовитая коррозия на 3 хода: Защита каждой части тела −3, в конце хода цели 1d4 урона с учётом Защиты.',
      actions: [{ type: 'damage', dice: '1d8', scaling: 'power', onHitStatusId: 'toxic_corrosion', onHitDuration: 3 }],
      tags: ['DAMAGE', 'DOT', 'DEBUFF'], icon: { frame: 'slash', motif: 'fang', accent: 'blade' },
    },
    {
      id: 'bitter_tincture', name: 'Настой горьких трав', rarity: 'common', cooldown: 4, target: 'ally', projectile: 'poison',
      description: 'Лечит союзника на 1d6 + Силу. На 2 хода даёт Горький бальзам: в начале собственного хода восстанавливает 1d6 + Силу источника.',
      actions: [{ type: 'heal', dice: '1d6', scaling: 'power' }, { type: 'status', statusId: 'bitter_balm', duration: 2 }],
      tags: ['HEAL', 'HOT'], icon: { frame: 'seal', motif: 'leaf', accent: 'drop' },
    },
    {
      id: 'noxious_censer', name: 'Кадило миазмов', rarity: 'rare', cooldown: 6, target: 'allEnemies', projectile: 'poison',
      description: 'На 2 хода всем врагам — Ядовитая лихорадка (Сила −4, следующая Инициатива −2) и Тошнотворная дымка (Критический удар −3, Проворность −3). Попадание не проверяется; текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'venom_fever', duration: 2 }, { type: 'status', statusId: 'nauseating_haze', duration: 2 }],
      tags: ['MASS', 'DEBUFF'], icon: { frame: 'orbit', motif: 'skull', accent: 'drop' },
    },
    {
      id: 'fanged_contract', name: 'Договор с аспидом', rarity: 'rare', cooldown: 4, target: 'any', projectile: 'poison',
      description: 'Союзнику на 3 хода даёт Змеиный голод: Защита −2, после прямого урона здоровью врага лечится на 1d6, не больше нанесённого урона. На врага накладывает Гибельное дыхание на 3 хода: 1d8 урона без Защиты в начале хода. Можно выбрать себя; попадание не проверяется.',
      actions: [{ type: 'status', statusId: 'venom_hunger', duration: 3, targetRelation: 'ally' }, { type: 'status', statusId: 'virulent_breath', duration: 3, targetRelation: 'enemy' }],
      tags: ['HYBRID', 'VAMPIRISM', 'DOT'], icon: { frame: 'weave', motif: 'fang', accent: 'rune' },
    },
    {
      id: 'serpent_crown', name: 'Корона змеиного царя', rarity: 'epic', cooldown: 6, target: 'randomEnemy', projectile: 'poison',
      description: 'Сначала на 3 хода усиливает себя Ядовитым покрытием (1d6 к каждому прямому удару) и Взглядом змея (Критический удар +3, Точность +2). Затем атакует случайного врага на 1d6 + Силу с новыми бонусами; попадание оставляет Гибельное дыхание на 2 хода: 1d8 урона без Защиты в начале хода.',
      actions: [{ type: 'status', statusId: 'venom_coating', duration: 3, target: 'self' }, { type: 'status', statusId: 'serpent_focus', duration: 3, target: 'self' }, { type: 'damage', dice: '1d6', scaling: 'power', onHitStatusId: 'virulent_breath', onHitDuration: 2 }],
      tags: ['RANDOM', 'BUFF', 'DAMAGE', 'DOT'], icon: { frame: 'rays', motif: 'fang', accent: 'eye' },
    },
  ]),
  ...skillSchool('spirit', 180, [
    {
      id: 'soul_candle', name: 'Свеча поминовения', rarity: 'common', cooldown: 3, target: 'ally', projectile: 'bone',
      description: 'Даёт союзнику Последнее тепло на 2 хода: в начале собственного хода восстанавливает 1d12 здоровья без Силы. В ход наложения не срабатывает.',
      actions: [{ type: 'status', statusId: 'last_warmth', duration: 2 }],
      tags: ['HOT'], icon: { frame: 'rays', motif: 'wisp', accent: 'flame' },
    },
    {
      id: 'bone_knuckles', name: 'Костяшки мертвеца', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'bone',
      description: 'Удар на 2d4 + Силу. При попадании — Бледное возмездие на 2 хода: в конце хода цели 1d6 урона без Защиты.',
      actions: [{ type: 'damage', dice: '2d4', scaling: 'power', onHitStatusId: 'pale_rebuke', onHitDuration: 2 }],
      tags: ['DAMAGE', 'DOT'], icon: { frame: 'slash', motif: 'bone', accent: 'claw' },
    },
    {
      id: 'tomb_warden', name: 'Обет хранителя склепа', rarity: 'rare', cooldown: 5, target: 'ally', projectile: 'bone',
      description: 'Заклинатель получает Завет оссуария на 3 хода: Защита +2; когда созданный им щит должен тратить ёмкость, бросает 1d8, на 6+ поглощает урон без расхода ёмкости. Затем создаёт на выбранном союзнике щит на 2d8 + Силу сроком 3 хода.',
      actions: [{ type: 'status', statusId: 'ossuary_pact', duration: 3, target: 'self' }, { type: 'shield', dice: '2d8', scaling: 'power', duration: 3 }],
      tags: ['SHIELD'], icon: { frame: 'ward', motif: 'skull', accent: 'shield' },
    },
    {
      id: 'ancestor_whisper', name: 'Шёпот пращура', rarity: 'rare', cooldown: 5, target: 'randomAlly', projectile: 'bone',
      description: 'Случайному союзнику — Эхо духа на 3 хода (Сила +1; после действия с уроном 1d6, на 5+ — повтор базовой атаки по той же живой цели) и Заживление души на 2 хода: в конце хода лечит на 2d4 + Силу источника.',
      actions: [{ type: 'status', statusId: 'spirit_echo', duration: 3 }, { type: 'status', statusId: 'soul_mending', duration: 2 }],
      tags: ['RANDOM', 'HOT', 'REPEAT'], icon: { frame: 'orbit', motif: 'wisp', accent: 'eye' },
    },
    {
      id: 'spirits_crossroads', name: 'Перекрёсток душ', rarity: 'epic', cooldown: 5, target: 'randomUnit', projectile: 'bone',
      description: 'Кубик выбирает живого участника. Союзника лечит на 3d6 + Силу и даёт Призрачный шаг на 2 хода (Уклонение +4, Защита −3). Врага атакует на 3d6 + Силу; попадание накладывает Погребальный плач на 3 хода (Точность и Критический удар −2).',
      actions: [{ type: 'heal', dice: '3d6', scaling: 'power', targetRelation: 'ally' }, { type: 'status', statusId: 'ghost_step', duration: 2, targetRelation: 'ally' }, { type: 'damage', dice: '3d6', scaling: 'power', targetRelation: 'enemy', onHitStatusId: 'funeral_lament', onHitDuration: 3 }],
      tags: ['RANDOM', 'HYBRID', 'HEAL', 'DAMAGE'], icon: { frame: 'weave', motif: 'wisp', accent: 'rune' },
    },
  ]),
  ...skillSchool('time', 185, [
    {
      id: 'sand_stitch', name: 'Шов из песчинок', rarity: 'common', cooldown: 4, target: 'ally', projectile: 'arcane',
      description: 'Лечит союзника на 1d6 + Силу. На 2 хода даёт Пески восстановления: в конце собственного хода восстанавливает 1d6 + Силу источника.',
      actions: [{ type: 'heal', dice: '1d6', scaling: 'power' }, { type: 'status', statusId: 'hourglass_mending', duration: 2 }],
      tags: ['HEAL', 'HOT'], icon: { frame: 'weave', motif: 'hourglass', accent: 'cross' },
    },
    {
      id: 'eroding_touch', name: 'Прикосновение веков', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'arcane',
      description: 'Удар на 1d6 + Силу. При попадании — Эрозия мгновений на 3 хода: в начале хода цели наносит 1d6 урона без Защиты.',
      actions: [{ type: 'damage', dice: '1d6', scaling: 'power', onHitStatusId: 'chronal_erosion', onHitDuration: 3 }],
      tags: ['DAMAGE', 'DOT'], icon: { frame: 'slash', motif: 'hourglass', accent: 'bone' },
    },
    {
      id: 'second_skin', name: 'Кожа между секундами', rarity: 'rare', cooldown: 5, target: 'self', projectile: 'arcane',
      description: 'На 3 хода получает Ускользающую секунду (Уклонение +5, Критический удар −2) и Застывший барьер: в конце собственного хода создаёт слой щита на 1d6 со сроком 2 хода.',
      actions: [{ type: 'status', statusId: 'fading_second', duration: 3 }, { type: 'status', statusId: 'suspended_barrier', duration: 3 }],
      tags: ['EVASION', 'SHIELD'], icon: { frame: 'ward', motif: 'hourglass', accent: 'feather' },
    },
    {
      id: 'precise_interval', name: 'Отмеренный миг', rarity: 'rare', cooldown: 5, target: 'ally', projectile: 'arcane',
      description: 'Даёт союзнику Выверенный удар на 3 хода (Точность +5, следующая Инициатива −3) и Заимствованный миг на 2 хода: Проворность +2; после действия с уроном 1d4, на 4 — повтор базовой атаки по той же живой цели. Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'measured_strike', duration: 3 }, { type: 'status', statusId: 'borrowed_moment', duration: 2 }],
      tags: ['BUFF', 'REPEAT'], icon: { frame: 'seal', motif: 'hourglass', accent: 'blade' },
    },
    {
      id: 'unbroken_chronicle', name: 'Непрерванная летопись', rarity: 'epic', cooldown: 7, target: 'allAllies', projectile: 'arcane',
      description: 'Заклинатель на 4 хода получает Обновлённую нить: Сила +1; после тика наложенного им периодического лечения бросает 1d4, на 4 продлевает этот заряд на 1 ход. Всем союзникам — Пески восстановления на 3 хода: в конце хода лечение на 1d6 + Силу источника.',
      actions: [{ type: 'status', statusId: 'renewed_thread', duration: 4, target: 'self' }, { type: 'status', statusId: 'hourglass_mending', duration: 3 }],
      tags: ['MASS', 'HOT', 'BUFF'], icon: { frame: 'rays', motif: 'hourglass', accent: 'leaf' },
    },
  ]),
  ...skillSchool('war', 190, [
    {
      id: 'veterans_brace', name: 'Выправка ветерана', rarity: 'common', cooldown: 3, target: 'ally', projectile: 'arrow',
      description: 'Даёт союзнику Авангард на 3 хода: Защита каждой части тела +3, следующая Инициатива +3. Уже определённая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'vanguard', duration: 3 }],
      tags: ['BUFF', 'ARMOR'], icon: { frame: 'ward', motif: 'shield', accent: 'feather' },
    },
    {
      id: 'impaling_thrust', name: 'Укол копейщика', rarity: 'common', cooldown: 3, target: 'enemy', projectile: 'arrow',
      description: 'Один удар по выбранному врагу на 2d6 + Силу. Отдельный 1d20 определяет попадание, ещё один — критический удар.',
      actions: [{ type: 'damage', dice: '2d6', scaling: 'power' }],
      tags: ['DAMAGE'], icon: { frame: 'slash', motif: 'blade', accent: 'claw' },
    },
    {
      id: 'challenging_oath', name: 'Клятва перед строем', rarity: 'rare', cooldown: 6, target: 'self', projectile: 'arrow',
      description: 'На 3 хода получает Клятву несгибаемого (провокация, Защита каждой части тела +5) и Знамя сплочения: Сила +2, уменьшает оставшийся урон прямых ударов по отряду броском 1d4. Враги обязаны атаковать заклинателя; при нескольких провокациях действует последняя.',
      actions: [{ type: 'status', statusId: 'unyielding_oath', duration: 3 }, { type: 'status', statusId: 'rallying_standard', duration: 3 }],
      tags: ['TAUNT', 'PARTY_GUARD'], icon: { frame: 'seal', motif: 'shield', accent: 'rune' },
    },
    {
      id: 'severing_instinct', name: 'Чутьё палача', rarity: 'rare', cooldown: 5, target: 'ally', projectile: 'arrow',
      description: 'На 3 хода даёт союзнику Рвение палача: Критический удар +4, 1d6 к каждому прямому удару, Сила −3. На 2 хода — Метку дуэлянта: Точность и Критический удар +3. Числовые бонусы складываются.',
      actions: [{ type: 'status', statusId: 'executioners_zeal', duration: 3 }, { type: 'status', statusId: 'duelists_mark', duration: 2 }],
      tags: ['BUFF', 'CRIT'], icon: { frame: 'orbit', motif: 'eye', accent: 'blade' },
    },
    {
      id: 'crimson_advance', name: 'Багровое наступление', rarity: 'epic', cooldown: 8, target: 'allAllies', projectile: 'arrow',
      description: 'Всем союзникам на 2 хода — Боевой транс (Точность +2, броски урона +3, Уклонение −2) и Ярость (Критический удар +5, Точность −3). Всем врагам на 2 хода — Боевое истощение: броски урона −3, Уклонение −2, следующая Инициатива −2. Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'battle_trance', duration: 2 }, { type: 'status', statusId: 'rage', duration: 2 }, { type: 'status', statusId: 'battle_fatigue', duration: 2, target: 'allEnemies' }],
      tags: ['MASS', 'BUFF', 'DEBUFF'], icon: { frame: 'burst', motif: 'claw', accent: 'blade' },
    },
  ]),
  ...skillSchool('astral', 195, [
    {
      id: 'moonwater_draught', name: 'Глоток лунной воды', rarity: 'common', cooldown: 4, target: 'ally', projectile: 'arcane',
      description: 'Лечит союзника на 2d4 + Силу. На 2 хода даёт Лунный источник: в конце собственного хода восстанавливает 1d8 + Силу источника.',
      actions: [{ type: 'heal', dice: '2d4', scaling: 'power' }, { type: 'status', statusId: 'moonwell', duration: 2 }],
      tags: ['HEAL', 'HOT'], icon: { frame: 'seal', motif: 'moon', accent: 'drop' },
    },
    {
      id: 'star_needle', name: 'Игла далёкой звезды', rarity: 'common', cooldown: 4, target: 'enemy', projectile: 'arcane',
      description: 'Удар на 1d8 + Силу. При попадании — След кометы на 2 хода: в конце хода цели наносит 2d4 урона без Защиты.',
      actions: [{ type: 'damage', dice: '1d8', scaling: 'power', onHitStatusId: 'comet_wake', onHitDuration: 2 }],
      tags: ['DAMAGE', 'DOT'], icon: { frame: 'slash', motif: 'star', accent: 'blade' },
    },
    {
      id: 'orbital_accord', name: 'Согласие орбит', rarity: 'rare', cooldown: 5, target: 'ally', projectile: 'arcane',
      description: 'Даёт союзнику Орбиты судьбы на 3 хода: Точность +2; после действия с уроном бросает 1d8, на 7+ повторяет базовую атаку по той же живой цели. На 2 хода — Звёздную точность: Точность +4, Критический удар +1.',
      actions: [{ type: 'status', statusId: 'orbiting_fate', duration: 3 }, { type: 'status', statusId: 'stellar_precision', duration: 2 }],
      tags: ['BUFF', 'REPEAT'], icon: { frame: 'orbit', motif: 'star', accent: 'eye' },
    },
    {
      id: 'night_tithe', name: 'Дань безлунной ночи', rarity: 'rare', cooldown: 4, target: 'any', projectile: 'arcane',
      description: 'Союзнику на 3 хода даёт Лунную благодать: Уклонение +3, Сила +3. Врагу — Холод пустоты на 3 хода (Защита −4, Критический удар −3, Проворность −2) и Затмение на 2 хода (Точность −3, Сила −4). Можно выбрать себя; попадание не проверяется.',
      actions: [{ type: 'status', statusId: 'lunar_grace', duration: 3, targetRelation: 'ally' }, { type: 'status', statusId: 'void_chill', duration: 3, targetRelation: 'enemy' }, { type: 'status', statusId: 'eclipse', duration: 2, targetRelation: 'enemy' }],
      tags: ['HYBRID', 'BUFF', 'DEBUFF'], icon: { frame: 'weave', motif: 'moon', accent: 'rune' },
    },
    {
      id: 'celestial_canticle', name: 'Песнь небесного свода', rarity: 'epic', cooldown: 8, target: 'allAllies', projectile: 'arcane',
      description: 'Заклинатель получает Небесный резонанс на 3 хода: получив реальное исцеление, лечит весь отряд, включая себя, на 1d4; после тика наложенного им лечения бросает 1d6, на 6 продлевает заряд на ход. Всем союзникам на 3 хода даёт Лунный источник (1d8 + Сила источника в конце хода) и Стража созвездий (щит на 2d4 + Силу источника в начале хода, срок слоя 1 ход).',
      actions: [{ type: 'status', statusId: 'celestial_resonance', duration: 3, target: 'self' }, { type: 'status', statusId: 'moonwell', duration: 3 }, { type: 'status', statusId: 'constellation_guard', duration: 3 }],
      tags: ['MASS', 'HOT', 'SHIELD'], icon: { frame: 'rays', motif: 'star', accent: 'moon' },
    },
  ]),
];
