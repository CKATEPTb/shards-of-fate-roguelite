import { skillSchool } from './skill-catalog-builders';

export const lifeSkills = [
  ...skillSchool('blood', 0, [
    {
      id: 'crimson_incision', rarity: 'common', name: 'Алый надрез', cooldown: 3, target: 'enemy', projectile: 'blood',
      description: 'Удар на 2d4 + Силу. При попадании накладывает Кровотечение на 3 хода: в конце хода цели — 1d4 урона, игнорирующего броню.',
      actions: [{ type: 'damage', dice: '2d4', scaling: 'power', onHitStatusId: 'bleeding', onHitDuration: 3 }],
      tags: ['PHYSICAL', 'BLEED'], icon: { frame: 'slash', motif: 'blade', accent: 'drop' },
    },
    {
      id: 'blood_offering', rarity: 'rare', name: 'Кровная клятва', cooldown: 5, target: 'self', projectile: 'blood',
      description: 'Атакует себя на 1d4, игнорируя броню. Если удар попал и заклинатель выжил, на 3 хода получает Жажду хищника (вампиризм 1d4, точность +1) и Цену крови (урон +4, броня −4).',
      actions: [{ type: 'damage', dice: '1d4', bypassArmor: true }, { type: 'status', statusId: 'predators_thirst', duration: 3 }, { type: 'status', statusId: 'blood_price', duration: 3 }],
      tags: ['SACRIFICE', 'VAMPIRISM'], icon: { frame: 'ward', motif: 'fang', accent: 'drop' },
    },
    {
      id: 'crimson_tide', rarity: 'epic', name: 'Багровый прилив', cooldown: 6, target: 'allEnemies', projectile: 'blood',
      description: 'Каждому врагу — удар на 1d6 + половину Силы. Каждое попадание оставляет Рваную рану на 2 хода: 1d6 урона в конце хода без брони и −2 к Силе.',
      actions: [{ type: 'damage', dice: '1d6', scaling: 'power', factor: .5, onHitStatusId: 'open_wound', onHitDuration: 2 }],
      tags: ['MASS', 'BLEED'], icon: { frame: 'arrows', motif: 'claw', accent: 'drop' },
    },
    {
      id: 'sanguine_gift', rarity: 'rare', name: 'Дар алой росы', cooldown: 4, target: 'ally', projectile: 'blood',
      description: 'Лечит союзника на 2d6 + Силу и даёт Багровое восстановление на 3 хода: в начале хода — ещё 1d4 + Силу источника.',
      actions: [{ type: 'heal', dice: '2d6', scaling: 'power' }, { type: 'status', statusId: 'crimson_mending', duration: 3 }],
      tags: ['HEAL', 'HOT'], icon: { frame: 'rays', motif: 'drop', accent: 'cross' },
    },
    {
      id: 'crimson_lottery', rarity: 'common', name: 'Жребий крови', cooldown: 3, target: 'randomUnit', projectile: 'blood',
      description: 'Кубик выбирает одного живого участника, включая союзников и себя. Атакует его на 2d6; попадание оставляет Кровотечение на 2 хода. Может ранить свой отряд.',
      actions: [{ type: 'damage', dice: '2d6', onHitStatusId: 'bleeding', onHitDuration: 2 }],
      tags: ['RANDOM', 'FRIENDLY_FIRE', 'BLEED'], icon: { frame: 'burst', motif: 'drop', accent: 'skull' },
    },
  ]),
  ...skillSchool('holy', 5, [
    {
      id: 'verdict_of_dawn', rarity: 'rare', name: 'Суд рассвета', cooldown: 4, target: 'any', projectile: 'holy',
      description: 'Выберите любую живую цель. Союзника, включая себя, лечит на 2d8 + Силу. Врага атакует на 2d8 + Силу; при попадании — Светлый приговор на 2 хода (точность −3, крит −2).',
      actions: [{ type: 'heal', dice: '2d8', scaling: 'power', targetRelation: 'ally' }, { type: 'damage', dice: '2d8', scaling: 'power', targetRelation: 'enemy', onHitStatusId: 'radiant_censure', onHitDuration: 2 }],
      tags: ['HYBRID', 'HEAL'], icon: { frame: 'seal', motif: 'cross', accent: 'blade' },
    },
    {
      id: 'sheltering_prayer', rarity: 'epic', name: 'Молитва укрытия', cooldown: 5, target: 'ally', projectile: 'holy',
      description: 'Даёт союзнику щит на 2d6 + Силу на 3 хода и Божественную защиту на 2 хода: броня +8, входящий урон после брони −3.',
      actions: [{ type: 'shield', dice: '2d6', scaling: 'power', duration: 3 }, { type: 'status', statusId: 'divine_protection', duration: 2 }],
      tags: ['SHIELD', 'ARMOR'], icon: { frame: 'ward', motif: 'cross', accent: 'shield' },
    },
    {
      id: 'lantern_procession', rarity: 'legendary', name: 'Шествие светочей', cooldown: 6, target: 'allAllies', projectile: 'holy',
      description: 'Весь отряд получает Исцеление рассвета на 3 хода: в начале собственного хода каждый восстанавливает 1d6 + Силу источника.',
      actions: [{ type: 'status', statusId: 'dawn_mending', duration: 3 }],
      tags: ['MASS', 'HOT'], icon: { frame: 'weave', motif: 'cross', accent: 'star' },
    },
    {
      id: 'sanctified_edge', rarity: 'common', name: 'Помазание клинка', cooldown: 3, target: 'ally', projectile: 'holy',
      description: 'Освящённое лезвие на 3 хода: союзник получает +2 к попаданию и отдельный дополнительный 1d4 к урону каждого прямого удара.',
      actions: [{ type: 'status', statusId: 'consecrated_edge', duration: 3 }],
      tags: ['BUFF', 'DAMAGE'], icon: { frame: 'slash', motif: 'cross', accent: 'blade' },
    },
    {
      id: 'mercy_lottery', rarity: 'rare', name: 'Воля милосердия', cooldown: 4, target: 'randomAlly', projectile: 'holy',
      description: 'Кубик выбирает одного живого союзника, включая себя. Лечит его на 3d6 + Силу и даёт Благодать паломника на 2 хода: проворность +3, уклонение +2.',
      actions: [{ type: 'heal', dice: '3d6', scaling: 'power' }, { type: 'status', statusId: 'pilgrims_grace', duration: 2 }],
      tags: ['RANDOM', 'HEAL'], icon: { frame: 'orbit', motif: 'feather', accent: 'cross' },
    },
  ]),
  ...skillSchool('nature', 10, [
    {
      id: 'thorn_volley', rarity: 'rare', name: 'Залп шипов', cooldown: 5, target: 'allEnemies', projectile: 'nature',
      description: 'Каждому врагу — удар на 1d4 + половину Силы. Попадание накладывает Терновую рану на 2 хода: 1d6 урона в конце хода, с учётом брони.',
      actions: [{ type: 'damage', dice: '1d4', scaling: 'power', factor: .5, onHitStatusId: 'briar_wound', onHitDuration: 2 }],
      tags: ['MASS', 'PHYSICAL', 'DOT'], icon: { frame: 'arrows', motif: 'leaf', accent: 'claw' },
    },
    {
      id: 'binding_roots', rarity: 'common', name: 'Узел корней', cooldown: 2, target: 'enemy', projectile: 'nature',
      description: 'Накладывает Корневую хватку на 3 хода: уклонение и проворность врага −3. Не лишает цель её действия.',
      actions: [{ type: 'status', statusId: 'rootbound', duration: 3 }],
      tags: ['DEBUFF'], icon: { frame: 'weave', motif: 'leaf', accent: 'rock' },
    },
    {
      id: 'grove_sanctuary', rarity: 'epic', name: 'Убежище рощи', cooldown: 5, target: 'ally', projectile: 'nature',
      description: 'Даёт союзнику щит на 1d6 + Силу на 2 хода и Дикое обновление на 3 хода: в начале хода лечит на 2d4 + Силу источника.',
      actions: [{ type: 'shield', dice: '1d6', scaling: 'power', duration: 2 }, { type: 'status', statusId: 'wild_renewal', duration: 3 }],
      tags: ['SHIELD', 'HOT'], icon: { frame: 'ward', motif: 'leaf', accent: 'cross' },
    },
    {
      id: 'barkskin_ritual', rarity: 'rare', name: 'Обет дуба', cooldown: 4, target: 'self', projectile: 'nature',
      description: 'На 3 хода получает Сердце дуба (броня +6, следующий бросок инициативы −2) и Дыхание весны (Сила +4). Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'oak_heart', duration: 3 }, { type: 'status', statusId: 'spring_breath', duration: 3 }],
      tags: ['ARMOR', 'HEAL'], icon: { frame: 'seal', motif: 'rock', accent: 'leaf' },
    },
    {
      id: 'wandering_seed', rarity: 'common', name: 'Блуждающее семя', cooldown: 4, target: 'randomAlly', projectile: 'nature',
      description: 'Случайный союзник получает Семя возвращения на 3 хода: в начале хода создаёт щит на 1d4 + Силу источника, срок слоя — 2 хода. Звериное чутьё на 2 хода даёт +2 к точности, уклонению и следующему броску инициативы.',
      actions: [{ type: 'status', statusId: 'seed_of_return', duration: 3 }, { type: 'status', statusId: 'wild_instinct', duration: 2 }],
      tags: ['RANDOM', 'SHIELD', 'BUFF'], icon: { frame: 'orbit', motif: 'leaf', accent: 'eye' },
    },
  ]),
  ...skillSchool('shadow', 15, [
    {
      id: 'nightfang', rarity: 'epic', name: 'Клыки ночи', cooldown: 5, target: 'enemy', projectile: 'shadow',
      description: 'Два независимых удара по одной цели, каждый на 1d8 + Силу. Каждое попадание оставляет отдельную Ночную рану на 2 хода: 1d8 урона в конце хода.',
      actions: [{ type: 'damage', dice: '1d8', scaling: 'power', hits: 2, onHitStatusId: 'night_wound', onHitDuration: 2 }],
      tags: ['MULTIHIT', 'DOT'], icon: { frame: 'slash', motif: 'fang', accent: 'moon' },
    },
    {
      id: 'veil_of_retreat', rarity: 'legendary', name: 'Покров отступления', cooldown: 6, target: 'allAllies', projectile: 'shadow',
      description: 'Отряд на 2 хода получает Изворотливость (+4 к уклонению) и Беззвучный шаг (+4 к проворности, +3 к следующему броску инициативы). Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'evasiveness', duration: 2 }, { type: 'status', statusId: 'silent_step', duration: 2 }],
      tags: ['MASS', 'EVASION', 'ESCAPE'], icon: { frame: 'weave', motif: 'feather', accent: 'moon' },
    },
    {
      id: 'blinding_hex', rarity: 'rare', name: 'Проклятие слепца', cooldown: 4, target: 'enemy', projectile: 'shadow',
      description: 'Враг получает Тьму в глазах на 3 хода: точность −4. Заклинатель получает Смертоносность на 2 собственных хода: +5 к критическому броску.',
      actions: [{ type: 'status', statusId: 'blackout', duration: 3 }, { type: 'status', statusId: 'lethality', duration: 2, target: 'self' }],
      tags: ['DEBUFF', 'CRITICAL'], icon: { frame: 'seal', motif: 'eye', accent: 'blade' },
    },
    {
      id: 'shadow_gamble', rarity: 'common', name: 'Жребий сумрака', cooldown: 3, target: 'randomEnemy', projectile: 'shadow',
      description: 'Кубик выбирает одного врага. Удар на 3d4 + Силу; при попадании — Тьма в глазах на 2 хода (точность −4).',
      actions: [{ type: 'damage', dice: '3d4', scaling: 'power', onHitStatusId: 'blackout', onHitDuration: 2 }],
      tags: ['RANDOM', 'DEBUFF'], icon: { frame: 'burst', motif: 'moon', accent: 'eye' },
    },
    {
      id: 'forbidden_cut', rarity: 'common', name: 'Запретный разрез', cooldown: 3, target: 'any', projectile: 'shadow',
      description: 'Атакует любую выбранную живую цель, включая союзника или себя, на 2d8 + Силу. Попадание накладывает Рваную рану на 3 хода: 1d6 урона в конце хода без брони, Сила цели −2.',
      actions: [{ type: 'damage', dice: '2d8', scaling: 'power', onHitStatusId: 'open_wound', onHitDuration: 3 }],
      tags: ['FRIENDLY_FIRE', 'BLEED'], icon: { frame: 'slash', motif: 'blade', accent: 'skull' },
    },
  ]),
];
