import { skillSchool } from './skill-catalog-builders';

export const mysticSkills = [
  ...skillSchool('stone', 40, [
    {
      id: 'fault_strike', rarity: 'common', name: 'Удар разлома', cooldown: 4, target: 'enemy', projectile: 'stone',
      description: 'Удар на 3d4 + Силу. При попадании — Линия разлома на 3 хода: броня −8, проворность −1.',
      actions: [{ type: 'damage', dice: '3d4', scaling: 'power', onHitStatusId: 'fault_line', onHitDuration: 3 }],
      tags: ['DEBUFF'], icon: { frame: 'slash', motif: 'rock', accent: 'bolt' },
    },
    {
      id: 'mountain_shelter', rarity: 'rare', name: 'Плечо горы', cooldown: 6, target: 'self', projectile: 'stone',
      description: 'На 3 хода: Гранитная кожа (броня +9, следующий бросок инициативы −3) и Укрытие монолита (броня +2, урон по отряду после брони −3). Броня складывается; текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'granite_skin', duration: 3 }, { type: 'status', statusId: 'sheltering_monolith', duration: 3 }],
      tags: ['ARMOR', 'PARTY_GUARD'], icon: { frame: 'ward', motif: 'rock', accent: 'shield' },
    },
    {
      id: 'gravel_cradle', rarity: 'rare', name: 'Каменная колыбель', cooldown: 5, target: 'ally', projectile: 'stone',
      description: 'Создаёт на выбранном союзнике, включая себя, щит ёмкостью 3d6 + Сила. Срок щита — 3 собственных хода получателя.',
      actions: [{ type: 'shield', dice: '3d6', scaling: 'power', duration: 3 }],
      tags: ['SHIELD'], icon: { frame: 'orbit', motif: 'rock', accent: 'rune' },
    },
    {
      id: 'stone_quake', rarity: 'epic', name: 'Дрожь земли', cooldown: 6, target: 'allEnemies', projectile: 'stone',
      description: 'Каждому врагу — удар на 1d8 + половину Силы. Попадание накладывает Оковы земли на 2 хода: уклонение −2, следующий бросок инициативы −5; текущая очередь не меняется.',
      actions: [{ type: 'damage', dice: '1d8', scaling: 'power', factor: .5, onHitStatusId: 'earthbound', onHitDuration: 2 }],
      tags: ['MASS', 'DEBUFF'], icon: { frame: 'burst', motif: 'rock', accent: 'claw' },
    },
    {
      id: 'stone_oracle', rarity: 'common', name: 'Шёпот кургана', cooldown: 4, target: 'randomAlly', projectile: 'stone',
      description: 'Одному случайному союзнику на 3 хода: Благословение кургана (броня +4, Сила +3) и Мох веков (в начале хода восстанавливает 1d10 здоровья без Силы).',
      actions: [{ type: 'status', statusId: 'cairn_blessing', duration: 3 }, { type: 'status', statusId: 'moss_of_ages', duration: 3 }],
      tags: ['RANDOM', 'HOT', 'BUFF'], icon: { frame: 'rays', motif: 'rock', accent: 'leaf' },
    },
  ]),
  ...skillSchool('spirit', 45, [
    {
      id: 'bone_procession', rarity: 'epic', name: 'Шествие костей', cooldown: 6, target: 'ally', projectile: 'bone',
      description: 'Союзник получает Костяной смерч на 3 хода: в начале хода — слой щита на 1d8 со сроком 2 хода. Заклинатель получает Завет оссуария на 3 хода: броня +2; его щит при расходе бросает 1d8, на 6+ поглощает урон без расхода ёмкости.',
      actions: [{ type: 'status', statusId: 'bone_cyclone', duration: 3 }, { type: 'status', statusId: 'ossuary_pact', duration: 3, target: 'self' }],
      tags: ['SHIELD'], icon: { frame: 'orbit', motif: 'bone', accent: 'shield' },
    },
    {
      id: 'soul_balance', rarity: 'rare', name: 'Весы душ', cooldown: 5, target: 'any', projectile: 'bone',
      description: 'Союзника, включая себя, лечит на 2d8 + Силу и даёт Заживление души на 3 хода (2d4 + Сила источника в конце хода). Врага атакует на 2d8 + Силу; попадание оставляет Бледное возмездие на 2 хода (1d6 урона в конце хода без брони).',
      actions: [{ type: 'heal', dice: '2d8', scaling: 'power', targetRelation: 'ally' }, { type: 'status', statusId: 'soul_mending', duration: 3, targetRelation: 'ally' }, { type: 'damage', dice: '2d8', scaling: 'power', targetRelation: 'enemy', onHitStatusId: 'pale_rebuke', onHitDuration: 2 }],
      tags: ['HYBRID', 'HEAL', 'HOT', 'DOT'], icon: { frame: 'weave', motif: 'wisp', accent: 'skull' },
    },
    {
      id: 'ancestral_call', rarity: 'common', name: 'Зов предков', cooldown: 5, target: 'self', projectile: 'bone',
      description: 'На 3 хода получает Дозор предков (уменьшает оставшийся урон прямых ударов по отряду броском 1d6) и Фонарь души (Сила +5, следующий бросок инициативы +1). Текущая очередь не меняется.',
      actions: [{ type: 'status', statusId: 'ancestral_guard', duration: 3 }, { type: 'status', statusId: 'soul_lantern', duration: 3 }],
      tags: ['PARTY_GUARD', 'HEAL'], icon: { frame: 'rays', motif: 'skull', accent: 'wisp' },
    },
    {
      id: 'funeral_chorus', rarity: 'legendary', name: 'Хор забвения', cooldown: 8, target: 'allEnemies', projectile: 'bone',
      description: 'Всем врагам — Погребальный плач на 3 хода (точность и крит −2). Всем союзникам — Заживление души на 2 хода: в конце собственного хода лечит на 2d4 + Силу источника.',
      actions: [{ type: 'status', statusId: 'funeral_lament', duration: 3 }, { type: 'status', statusId: 'soul_mending', duration: 2, target: 'allAllies' }],
      tags: ['MASS', 'DEBUFF', 'HOT'], icon: { frame: 'arrows', motif: 'wisp', accent: 'cross' },
    },
    {
      id: 'wisp_lottery', rarity: 'common', name: 'Блуждающая душа', cooldown: 3, target: 'randomUnit', projectile: 'bone',
      description: 'Кубик выбирает одного живого участника. Союзника, включая себя, лечит на 2d6 + Силу и даёт Призрачный шаг на 2 хода (уклонение +4, броня −3). Врага атакует на 2d6 + Силу; попадание оставляет Бледное возмездие на 2 хода (1d6 урона в конце хода без брони).',
      actions: [{ type: 'heal', dice: '2d6', scaling: 'power', targetRelation: 'ally' }, { type: 'status', statusId: 'ghost_step', duration: 2, targetRelation: 'ally' }, { type: 'damage', dice: '2d6', scaling: 'power', targetRelation: 'enemy', onHitStatusId: 'pale_rebuke', onHitDuration: 2 }],
      tags: ['RANDOM', 'HYBRID', 'HEAL', 'DOT'], icon: { frame: 'seal', motif: 'wisp', accent: 'moon' },
    },
  ]),
];
