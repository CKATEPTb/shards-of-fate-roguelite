import type { SkillDefinition } from '@shards/shared';
import { additionalSkills } from './skill-catalog';
import { bossSkills } from './boss-catalog';

export { additionalSkills } from './skill-catalog';

const existingSkills: SkillDefinition[] = [
  {
    schemaVersion: 1, id: 'tank_taunt', name: 'Вызов', description: 'На 3 собственных хода увеличивается в размере и вынуждает всех врагов атаковать только себя, включая атаки по отряду.',
    cooldown: 6, priority: 100, target: 'self', condition: 'hasOtherAlly',
    actions: [{ type: 'status', statusId: 'taunted', duration: 3 }], tags: ['ROLE', 'TAUNT'],
  },
  {
    schemaVersion: 1, id: 'guardian_bastion', name: 'Несокрушимый бастион', description: 'Полностью блокирует любой входящий урон до начала следующего собственного хода. Перезарядка: 3 хода.',
    cooldown: 3, priority: 90, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'bastion', duration: 1 }], tags: ['CHARACTER', 'ARMOR', 'BLOCK'],
  },
  {
    schemaVersion: 1, id: 'healer_mend', name: 'Исцеляющий свет', description: 'Восстанавливает выбранному союзнику 3d8 + Силу.',
    cooldown: 6, priority: 100, target: 'ally', condition: 'allyWounded',
    actions: [{ type: 'heal', dice: '3d8', scaling: 'power', factor: 1 }], tags: ['ROLE', 'HEAL'],
  },
  {
    schemaVersion: 1, id: 'priest_prayer', name: 'Общая молитва', description: 'Исцеляет каждого живого участника отряда на 3d8 + Силу. Получившие лечение обретают Благословение на 2 хода.',
    cooldown: 6, priority: 110, target: 'allAllies', condition: 'allyWounded',
    actions: [{ type: 'heal', dice: '3d8', scaling: 'power', factor: 1 }], tags: ['CHARACTER', 'HEAL', 'HOLY'],
  },
  {
    schemaVersion: 1, id: 'damage_burst', name: 'Решающий удар', description: 'Наносит одной цели 3d8 + Силу.',
    cooldown: 6, priority: 100, target: 'enemy', condition: 'always',
    actions: [{ type: 'damage', dice: '3d8', scaling: 'power', factor: 1 }], tags: ['ROLE', 'BURST'],
  },
  {
    schemaVersion: 1, id: 'mage_ignite', name: 'Печать пламени', description: 'Четыре огненных заряда: каждый отдельно проверяет попадание броском 1d20 и при успехе наносит 1d6 урона. Каждое попадание добавляет 1 заряд Горения, а критическое — ещё 1 от Тлеющей искры.',
    cooldown: 6, priority: 110, target: 'enemy', condition: 'always',
    actions: [{ type: 'damage', dice: '1d6', hits: 4, onHitStatusId: 'burning', onHitDuration: null }], tags: ['CHARACTER', 'FIRE', 'BURN', 'MULTIHIT'],
  },
  {
    schemaVersion: 1, id: 'vampire_bloodlust', name: 'Жажда крови', description: 'На 3 собственных хода добавляет отдельный бросок 1d6 к урону каждого удара.',
    cooldown: 6, priority: 90, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'bloodlust', duration: 3 }], tags: ['CHARACTER', 'VAMPIRISM', 'PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'paladin_radiance', name: 'Свет клятвы', description: 'Восстанавливает себе 3d8 здоровья. Полученное лечение запускает «Общий свет»: 1d4 исцеления каждому живому участнику отряда.',
    cooldown: 6, priority: 110, target: 'self', condition: 'selfWounded',
    actions: [{ type: 'heal', dice: '3d8' }], tags: ['CHARACTER', 'HEAL', 'HOLY'],
  },
  {
    schemaVersion: 1, id: 'druid_regrowth', name: 'Живая роща', description: 'Накладывает на выбранного союзника регенерацию на 3 его хода: в начале каждого хода восстанавливает 1d8 + Силу Друида. Перезарядка: 3 хода.',
    cooldown: 3, priority: 90, target: 'ally', condition: 'always',
    actions: [{ type: 'status', statusId: 'regrowth', duration: 3 }], tags: ['CHARACTER', 'HOT', 'NATURE', 'REGENERATION'],
  },
  {
    schemaVersion: 1, id: 'necromancer_ward', name: 'Костяной щит', description: 'Окружает выбранного союзника костяным вихрем: щит поглощает 3d8 + Силу урона и действует 3 хода получателя.',
    cooldown: 6, priority: 110, target: 'ally', condition: 'always',
    actions: [{ type: 'shield', dice: '3d8', scaling: 'power', duration: 3 }], tags: ['CHARACTER', 'SHIELD', 'ABSORB', 'DARK'],
  },
  {
    schemaVersion: 1, id: 'rogue_precision', name: 'Смертельная точность', description: 'На 3 собственных хода каждое прямое попадание становится критическим. Враг всё ещё может уклониться.',
    cooldown: 6, priority: 110, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'sure_strike', duration: 3 }], tags: ['CHARACTER', 'CRITICAL', 'EXECUTE'],
  },
  {
    schemaVersion: 1, id: 'ranger_volley', name: 'Шквал стрел', description: 'На 3 собственных хода усиливает Вторую стрелу: вместо 1d4 бросает 1d6, и на 4–6 выполняет дополнительную атаку по той же цели.',
    cooldown: 6, priority: 110, target: 'self', condition: 'always',
    actions: [{ type: 'status', statusId: 'rapid_fire', duration: 3 }], tags: ['CHARACTER', 'REPEAT', 'PROJECTILE'],
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
    actions: [{ type: 'heal', dice: '2d6', scaling: 'power', factor: 0.7 }], tags: ['HEAL', 'NATURE'],
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
    actions: [{ type: 'heal', dice: '2d8', scaling: 'power', factor: 1 }], tags: ['HEAL', 'NATURE'],
  },
];

export const skills: SkillDefinition[] = [...existingSkills, ...additionalSkills, ...bossSkills];
