import type { SkillDefinition } from '@shards/shared';

export const skills: SkillDefinition[] = [
  {
    schemaVersion: 1, id: 'tank_taunt', name: 'Вызов', description: 'Привлекает атаки врагов на 3 хода.',
    cooldown: 6, priority: 100, target: 'self', condition: 'hasOtherAlly',
    actions: [{ type: 'status', statusId: 'taunted', duration: 3 }], tags: ['ROLE', 'TAUNT'],
  },
  {
    schemaVersion: 1, id: 'guardian_bastion', name: 'Несокрушимый бастион', description: 'Усиливает защиту всего отряда, включая себя, до 75% на 4 хода.',
    cooldown: 10, priority: 90, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'bastion', duration: 4 }], tags: ['CHARACTER', 'ARMOR', 'ALLY_PROTECTION'],
  },
  {
    schemaVersion: 1, id: 'healer_mend', name: 'Исцеляющий свет', description: 'Восстанавливает 2d8 + силу исцеления самому раненому союзнику.',
    cooldown: 6, priority: 100, target: 'lowestHealthAlly', condition: 'allyWounded',
    actions: [{ type: 'heal', dice: '2d8', scaling: 'healing', factor: 1 }], tags: ['ROLE', 'HEAL'],
  },
  {
    schemaVersion: 1, id: 'priest_prayer', name: 'Общая молитва', description: 'Исцеляет весь отряд на 2d6 + силу исцеления.',
    cooldown: 10, priority: 110, target: 'allAllies', condition: 'allyWounded',
    actions: [{ type: 'heal', dice: '2d6', scaling: 'healing', factor: 1 }], tags: ['CHARACTER', 'HEAL', 'HOLY'],
  },
  {
    schemaVersion: 1, id: 'damage_burst', name: 'Решающий удар', description: 'Наносит одной цели 2d10 + силу урона.',
    cooldown: 6, priority: 100, target: 'enemy', condition: 'always',
    actions: [{ type: 'damage', dice: '2d10', scaling: 'power', factor: 1 }], tags: ['ROLE', 'BURST'],
  },
  {
    schemaVersion: 1, id: 'mage_ignite', name: 'Печать пламени', description: 'Наносит 1d6 урона и поджигает врага на 4 хода.',
    cooldown: 10, priority: 110, target: 'enemy', condition: 'always',
    actions: [{ type: 'damage', dice: '1d6' }, { type: 'status', statusId: 'burning', duration: 4 }], tags: ['CHARACTER', 'FIRE', 'BURN'],
  },
  {
    schemaVersion: 1, id: 'vampire_bloodlust', name: 'Жажда крови', description: 'Увеличивает наносимый урон на 50% на 4 хода.',
    cooldown: 10, priority: 90, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'bloodlust', duration: 4 }], tags: ['CHARACTER', 'VAMPIRISM', 'PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'paladin_radiance', name: 'Свет клятвы', description: 'Восстанавливает себе 3d8 + силу исцеления. Полученное лечение запускает «Общий свет».',
    cooldown: 10, priority: 110, target: 'self', condition: 'selfWounded',
    actions: [{ type: 'heal', dice: '3d8', scaling: 'healing' }], tags: ['CHARACTER', 'HEAL', 'HOLY'],
  },
  {
    schemaVersion: 1, id: 'druid_regrowth', name: 'Живая роща', description: 'Дарует каждому живому герою, включая себя, 4 тика регенерации. В конце его хода восстанавливает 1d4 + 50% силы исцеления Друида.',
    cooldown: 10, priority: 90, target: 'allAllies', condition: 'allyWounded',
    actions: [{ type: 'status', statusId: 'regrowth', duration: 4 }], tags: ['CHARACTER', 'HOT', 'NATURE', 'REGENERATION'],
  },
  {
    schemaVersion: 1, id: 'necromancer_ward', name: 'Покров праха', description: 'Создаёт каждому живому герою, включая себя, щит на 2d8 + силу исцеления. Щит действует 4 хода получателя.',
    cooldown: 10, priority: 110, target: 'allAllies', condition: 'always',
    actions: [{ type: 'shield', dice: '2d8', scaling: 'healing', duration: 4 }], tags: ['CHARACTER', 'SHIELD', 'ABSORB', 'DARK'],
  },
  {
    schemaVersion: 1, id: 'rogue_precision', name: 'Смертельная точность', description: 'На 4 хода каждое попавшее прямое попадание становится критическим. Враг всё ещё может уклониться.',
    cooldown: 10, priority: 110, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'sure_strike', duration: 4 }], tags: ['CHARACTER', 'CRITICAL', 'EXECUTE'],
  },
  {
    schemaVersion: 1, id: 'ranger_volley', name: 'Шквал стрел', description: 'На 4 хода добавляет 95 процентных пунктов повторной атаки. С базовыми 25% даёт один дополнительный выстрел и 20% дополнительного прямого урона.',
    cooldown: 10, priority: 110, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'rapid_fire', duration: 4 }], tags: ['CHARACTER', 'REPEAT', 'PROJECTILE'],
  },
  {
    schemaVersion: 1, id: 'rat_gnaw', name: 'Грызущий укус', description: 'Быстрый укус самой раненой цели.',
    cooldown: 4, priority: 10, target: 'lowestHealthEnemy', condition: 'always',
    actions: [{ type: 'damage', dice: '1d4', scaling: 'power', factor: 1 }], tags: ['PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'wolf_pounce', name: 'Прыжок', description: 'Волк обрушивается на противника.',
    cooldown: 5, priority: 10, target: 'enemy', condition: 'always',
    actions: [{ type: 'damage', dice: '2d6', scaling: 'power', factor: 0.6 }], tags: ['PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'slime_shell', name: 'Слизистая оболочка', description: 'Создаёт поглощающий щит.',
    cooldown: 6, priority: 10, target: 'self', condition: 'always',
    actions: [{ type: 'shield', dice: '2d6', scaling: 'power', factor: 0.5 }], tags: ['SHIELD', 'ABSORB'],
  },
  {
    schemaVersion: 1, id: 'spider_venom', name: 'Ядовитые клыки', description: 'Укус отравляет цель на 3 хода.',
    cooldown: 5, priority: 10, target: 'enemy', condition: 'always',
    actions: [{ type: 'damage', dice: '1d4' }, { type: 'status', statusId: 'poisoned', duration: 3 }], tags: ['POISON', 'DOT'],
  },
  {
    schemaVersion: 1, id: 'scout_stab', name: 'Точный выпад', description: 'Разведчик атакует ослабленную цель.',
    cooldown: 4, priority: 10, target: 'lowestHealthEnemy', condition: 'always',
    actions: [{ type: 'damage', dice: '1d8', scaling: 'power', factor: 0.8 }], tags: ['PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'archer_volley', name: 'Град стрел', description: 'Задевает всех противников.',
    cooldown: 6, priority: 10, target: 'allEnemies', condition: 'always',
    actions: [{ type: 'damage', dice: '1d4', scaling: 'power', factor: 0.35 }], tags: ['PROJECTILE'],
  },
  {
    schemaVersion: 1, id: 'shaman_mend', name: 'Лесное заклятие', description: 'Восстанавливает здоровье раненому союзнику.',
    cooldown: 5, priority: 20, target: 'lowestHealthAlly', condition: 'allyWounded',
    actions: [{ type: 'heal', dice: '2d6', scaling: 'healing', factor: 0.7 }], tags: ['HEAL', 'NATURE'],
  },
  {
    schemaVersion: 1, id: 'shaman_fervor', name: 'Барабан войны', description: 'Усиливает урон союзников на 3 хода.',
    cooldown: 8, priority: 10, target: 'allAllies', condition: 'always',
    actions: [{ type: 'status', statusId: 'battle_fervor', duration: 3 }], tags: ['BUFF'],
  },
  {
    schemaVersion: 1, id: 'boar_charge', name: 'Разбег', description: 'Мощный удар клыками.',
    cooldown: 6, priority: 10, target: 'enemy', condition: 'always',
    actions: [{ type: 'damage', dice: '2d8', scaling: 'power', factor: 0.8 }], tags: ['PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'thornling_guard', name: 'Колючая кора', description: 'Укрепляет кору на 3 хода.',
    cooldown: 6, priority: 10, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'fortified', duration: 3 }, { type: 'shield', dice: '1d6' }], tags: ['NATURE', 'ARMOR'],
  },
  {
    schemaVersion: 1, id: 'warden_sweep', name: 'Удар корней', description: 'Лесной дозорный бьёт весь отряд живыми корнями.',
    cooldown: 5, priority: 20, target: 'allEnemies', condition: 'always',
    actions: [{ type: 'damage', dice: '1d8', scaling: 'power', factor: 0.45 }], tags: ['NATURE', 'PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'warden_renewal', name: 'Сила рощи', description: 'Восстанавливает собственное здоровье.',
    cooldown: 8, priority: 30, target: 'self', condition: 'selfWounded',
    actions: [{ type: 'heal', dice: '2d8', scaling: 'healing', factor: 1 }], tags: ['HEAL', 'NATURE'],
  },
];
