import { skillSchool } from './skill-catalog-builders';

/** Legendary support arts emphasize different party plans, costs and aura interactions. */
export const legendarySupportSkills = [
  ...skillSchool('spirit', 220, [
    {
      id: 'phalanx_of_dead_kings', name: 'Фаланга мёртвых королей', rarity: 'legendary', cooldown: 9, target: 'allAllies', projectile: 'bone',
      description: 'Создаёт каждому союзнику щит на 3d8 + Силу на 3 его хода. Заклинатель получает Завет оссуария на 3 хода: Защита каждой части тела +2; когда созданный им щит должен терять ёмкость, бросает 1d8, на 6+ весь остаток удара поглощается без расхода ёмкости, пока заклинатель в строю.',
      actions: [{ type: 'status', statusId: 'ossuary_pact', duration: 3, target: 'self' }, { type: 'shield', dice: '3d8', scaling: 'power', duration: 3 }],
      tags: ['MASS', 'SHIELD', 'PRESERVE'], icon: { frame: 'ward', motif: 'skull', accent: 'bone' },
    },
    {
      id: 'duet_beyond_the_veil', name: 'Дуэт за гранью', rarity: 'legendary', cooldown: 8, target: 'ally', projectile: 'bone',
      description: 'На 3 хода даёт союзнику Эхо духа и Призрачный шаг: Сила +1, Уклонение +4, Защита каждой части тела −3. После действия с уроном союзник бросает 1d6: на 5+ повторяет базовую атаку по той же живой цели без цепочки повторов. Сразу создаёт щит на 2d8 + Силу заклинателя на 3 хода.',
      actions: [{ type: 'status', statusId: 'spirit_echo', duration: 3 }, { type: 'status', statusId: 'ghost_step', duration: 3 }, { type: 'shield', dice: '2d8', scaling: 'power', duration: 3 }],
      tags: ['REPEAT', 'EVASION', 'SHIELD', 'TRADEOFF'], icon: { frame: 'weave', motif: 'wisp', accent: 'blade' },
    },
  ]),
  ...skillSchool('time', 222, [
    {
      id: 'beyond_the_enemy_moment', name: 'За пределами вражеского мига', rarity: 'legendary', cooldown: 9, target: 'allAllies', projectile: 'arcane',
      description: 'На 3 хода весь отряд получает Заимствованный миг и Ускользающую секунду: Уклонение +5, Проворность +2, Критический удар −2. После действия с уроном каждый носитель бросает 1d4: на 4 повторяет базовую атаку по той же живой цели. Повтор не запускает цепочку; дополнительных ходов навык не даёт.',
      actions: [{ type: 'status', statusId: 'borrowed_moment', duration: 3 }, { type: 'status', statusId: 'fading_second', duration: 3 }],
      tags: ['MASS', 'REPEAT', 'EVASION', 'TRADEOFF'], icon: { frame: 'weave', motif: 'hourglass', accent: 'feather' },
    },
    {
      id: 'prison_of_unmoving_hours', name: 'Темница неподвижных часов', rarity: 'legendary', cooldown: 9, target: 'allEnemies', projectile: 'arcane',
      description: 'Всем врагам на 3 хода — Вязкое время и Эрозия мгновений: Точность −1, следующий бросок инициативы −5; в начале хода — 1d6 урона без защиты плюс плоский бонус урона источника. Текущая очередь и доступность действий не меняются. Заклинатель на 3 хода получает Ускользающую секунду: Уклонение +5, Критический удар −2. В ход наложения периодического урона нет.',
      actions: [{ type: 'status', statusId: 'temporal_drag', duration: 3 }, { type: 'status', statusId: 'chronal_erosion', duration: 3 }, { type: 'status', statusId: 'fading_second', duration: 3, target: 'self' }],
      tags: ['MASS', 'DOT', 'DEBUFF', 'EVASION'], icon: { frame: 'seal', motif: 'hourglass', accent: 'moon' },
    },
  ]),
  ...skillSchool('astral', 224, [
    {
      id: 'crown_of_nine_constellations', name: 'Венец девяти созвездий', rarity: 'legendary', cooldown: 9, target: 'ally', projectile: 'arcane',
      description: 'На 4 хода союзник получает Стража созвездий, Звёздную точность и Клинок звёздного огня: Точность +4, суммарно Критический удар +2 и дополнительный 1d8 к каждому прямому удару. В начале хода Страж создаёт слой щита на 2d4 + Силу заклинателя со сроком 1 ход; в ход наложения слой не создаётся.',
      actions: [{ type: 'status', statusId: 'constellation_guard', duration: 4 }, { type: 'status', statusId: 'stellar_precision', duration: 4 }, { type: 'status', statusId: 'starfire_blade', duration: 4 }],
      tags: ['BUFF', 'SHIELD', 'CRITICAL'], icon: { frame: 'orbit', motif: 'star', accent: 'shield' },
    },
    {
      id: 'scales_of_the_eclipse', name: 'Весы затмения', rarity: 'legendary', cooldown: 8, target: 'any', projectile: 'arcane',
      description: 'Союзнику сначала даёт Лунную благодать на 3 хода: Уклонение +3, Сила +3; затем лечит на 4d8 + Силу заклинателя. Врагу сначала накладывает Затмение на 3 хода: Точность −3, Сила −4; затем атакует на 4d8 + Силу, игнорируя Защиту. Затмение остаётся и при промахе.',
      actions: [{ type: 'status', statusId: 'lunar_grace', duration: 3, targetRelation: 'ally' }, { type: 'heal', dice: '4d8', scaling: 'power', targetRelation: 'ally' }, { type: 'status', statusId: 'eclipse', duration: 3, targetRelation: 'enemy' }, { type: 'damage', dice: '4d8', scaling: 'power', bypassArmor: true, targetRelation: 'enemy' }],
      tags: ['HYBRID', 'HEAL', 'EVASION', 'PIERCE', 'DEBUFF'], icon: { frame: 'rays', motif: 'moon', accent: 'cross' },
    },
  ]),
  ...skillSchool('venom', 226, [
    {
      id: 'garden_of_the_last_poison', name: 'Сад последнего яда', rarity: 'legendary', cooldown: 9, target: 'allEnemies', projectile: 'poison',
      description: 'На 3 хода всем врагам — Ядовитая лихорадка и Ядовитая коррозия: Сила −4, Защита каждой части тела −3, следующий бросок инициативы −2; в конце хода — 1d4 урона с учётом защиты плюс плоский бонус урона источника. Текущая очередь не меняется. Весь отряд получает Споровую мантию на 3 хода: в начале хода — слой щита на 1d4 + Силу источника со сроком 1 ход. В ход наложения тиков нет.',
      actions: [{ type: 'status', statusId: 'venom_fever', duration: 3 }, { type: 'status', statusId: 'toxic_corrosion', duration: 3 }, { type: 'status', statusId: 'spore_mantle', duration: 3, target: 'allAllies' }],
      tags: ['MASS', 'DEBUFF', 'DOT', 'SHIELD'], icon: { frame: 'burst', motif: 'leaf', accent: 'fang' },
    },
    {
      id: 'blood_of_the_basilisk', name: 'Кровь василиска', rarity: 'legendary', cooldown: 8, target: 'ally', projectile: 'poison',
      description: 'На 3 хода даёт союзнику Взгляд змея, Змеиный голод и Ядовитое покрытие: Точность +2, Критический удар +3, Защита каждой части тела −2 и отдельный 1d6 к каждому прямому удару. После прямого урона здоровью врага союзник лечится на 1d6, не больше нанесённого урона. Ядовитое покрытие не накладывает периодический яд.',
      actions: [{ type: 'status', statusId: 'serpent_focus', duration: 3 }, { type: 'status', statusId: 'venom_hunger', duration: 3 }, { type: 'status', statusId: 'venom_coating', duration: 3 }],
      tags: ['BUFF', 'VAMPIRISM', 'CRITICAL', 'TRADEOFF'], icon: { frame: 'seal', motif: 'fang', accent: 'drop' },
    },
  ]),
  ...skillSchool('war', 228, [
    {
      id: 'last_line_of_kings', name: 'Последний рубеж королей', rarity: 'legendary', cooldown: 9, target: 'allEnemies', projectile: 'arrow',
      description: 'Всем врагам — Боевое истощение на 3 хода: −3 к броскам урона, Уклонение −2, следующий бросок инициативы −2; текущая очередь не меняется. Затем на 3 хода получает Клятву несгибаемого: враги обязаны атаковать носителя, Защита каждой части тела +5. Создаёт себе щит на 3d8 + Силу на 3 хода. Полного иммунитета к урону нет; при нескольких провокациях действует последняя.',
      actions: [{ type: 'status', statusId: 'battle_fatigue', duration: 3 }, { type: 'status', statusId: 'unyielding_oath', duration: 3, target: 'self' }, { type: 'shield', dice: '3d8', scaling: 'power', duration: 3, target: 'self' }],
      tags: ['TAUNT', 'MASS', 'DEBUFF', 'SHIELD'], icon: { frame: 'ward', motif: 'shield', accent: 'blade' },
    },
    {
      id: 'standard_of_conquest', name: 'Штандарт завоевания', rarity: 'legendary', cooldown: 9, target: 'allAllies', projectile: 'arrow',
      description: 'Весь отряд лечится на 2d6 + Силу и получает Метку дуэлянта на 3 хода: Точность и Критический удар +3. Все враги получают Боевое истощение на 2 хода: −3 к броскам урона, Уклонение −2, следующий бросок инициативы −2. Уже определённая очередь остаётся прежней.',
      actions: [{ type: 'heal', dice: '2d6', scaling: 'power' }, { type: 'status', statusId: 'duelists_mark', duration: 3 }, { type: 'status', statusId: 'battle_fatigue', duration: 2, target: 'allEnemies' }],
      tags: ['MASS', 'HEAL', 'CRITICAL', 'DEBUFF'], icon: { frame: 'rays', motif: 'blade', accent: 'shield' },
    },
  ]),
  ...skillSchool('holy', 230, [
    {
      id: 'mercy_of_the_unsetting_sun', name: 'Милость незаходящего солнца', rarity: 'legendary', cooldown: 10, target: 'ally', projectile: 'holy',
      description: 'Союзник получает Бастион: полностью блокирует любой входящий урон до начала своего следующего хода. Получает Хор милосердия на 3 хода: Сила +2; после реального исцеления передаёт всему отряду 1d6 здоровья без цепочки передач. Затем лечится на 3d8 + Силу заклинателя; это лечение тоже запускает передачу, если здоровье восстановлено.',
      actions: [{ type: 'status', statusId: 'bastion', duration: 1 }, { type: 'status', statusId: 'merciful_chorus', duration: 3 }, { type: 'heal', dice: '3d8', scaling: 'power' }],
      tags: ['HEAL', 'IMMUNITY', 'BUFF'], icon: { frame: 'seal', motif: 'cross', accent: 'flame' },
    },
  ]),
  ...skillSchool('nature', 231, [
    {
      id: 'great_circle_of_thorns', name: 'Великий терновый круг', rarity: 'legendary', cooldown: 10, target: 'allAllies', projectile: 'nature',
      description: 'На 3 хода каждый союзник получает Терновый дозор: +1d4 к прямым ударам; когда по участнику отряда остаётся прямой урон после защиты, каждый живой носитель по очереди уменьшает его броском 1d4, пока урон не обнулится. Сразу каждый союзник получает щит на 2d6 + Силу на 3 хода. Всем врагам — Корневая хватка на 2 хода: Уклонение и Проворность −3, действие не отнимается.',
      actions: [{ type: 'status', statusId: 'thorn_guard', duration: 3 }, { type: 'shield', dice: '2d6', scaling: 'power', duration: 3 }, { type: 'status', statusId: 'rootbound', duration: 2, target: 'allEnemies' }],
      tags: ['MASS', 'PARTY_GUARD', 'SHIELD', 'DEBUFF'], icon: { frame: 'orbit', motif: 'leaf', accent: 'claw' },
    },
  ]),
];
