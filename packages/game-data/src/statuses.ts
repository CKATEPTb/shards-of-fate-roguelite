import type { StatusDefinition } from '@shards/shared';

export const statuses: StatusDefinition[] = [
  {
    schemaVersion: 1, id: 'taunted', name: 'Вызов', description: 'Враги обязаны выбирать этого бойца основной целью.',
    color: '#f2b45c', actions: [], modifiers: { taunt: true }, tags: ['TAUNT'],
  },
  {
    schemaVersion: 1, id: 'bastion', name: 'Бастион', description: 'Защита всего отряда, включая Стража, усилена с 25% до 75%.',
    color: '#f3d489', actions: [], modifiers: { partyDamageReduction: 0.5 }, tags: ['ARMOR', 'ALLY_PROTECTION'],
  },
  {
    schemaVersion: 1, id: 'bloodlust', name: 'Жажда крови', description: 'Наносимый урон увеличен на 50%.',
    color: '#c46c80', actions: [], modifiers: { damageMultiplier: 1.5 }, tags: ['VAMPIRISM', 'PHYSICAL', 'BUFF'],
  },
  {
    schemaVersion: 1, id: 'regrowth', name: 'Регенерация', description: 'В конце хода восстанавливает 1d4 + 50% силы исцеления источника.',
    color: '#a7ca83', trigger: 'TURN_ENDED', actions: [{ type: 'heal', dice: '1d4', scaling: 'healing', factor: 0.5, target: 'self' }],
    modifiers: {}, tags: ['HOT', 'NATURE', 'REGENERATION'],
  },
  {
    schemaVersion: 1, id: 'sure_strike', name: 'Смертельная точность', description: 'Попавшие прямые удары всегда критические.',
    color: '#d6c2a3', actions: [], modifiers: { guaranteedCrit: true }, tags: ['CRITICAL', 'BUFF'],
  },
  {
    schemaVersion: 1, id: 'rapid_fire', name: 'Шквал стрел', description: 'Рейтинг повторной атаки увеличен на 95 процентных пунктов.',
    color: '#bfd88f', actions: [], modifiers: { repeatChance: 0.95 }, tags: ['REPEAT', 'PROJECTILE', 'BUFF'],
  },
  {
    schemaVersion: 1, id: 'inspired', name: 'Благословение', description: 'Исцелённый союзник наносит на 20% больше урона.',
    color: '#a2eadb', actions: [], modifiers: { damageMultiplier: 1.2 }, tags: ['HOLY', 'BUFF'],
  },
  {
    schemaVersion: 1, id: 'burning', name: 'Горение', description: 'В конце хода получает урон: 30% силы источника × оставшиеся ходы.',
    color: '#f19258', trigger: 'TURN_ENDED',
    actions: [{ type: 'damage', scaling: 'power', factor: 0.3, target: 'self', scaleWithRemainingDuration: true }],
    modifiers: {}, tags: ['FIRE', 'BURN', 'DOT'],
  },
  {
    schemaVersion: 1, id: 'poisoned', name: 'Яд', description: 'В конце хода получает небольшой урон от яда.',
    color: '#b4ce6b', trigger: 'TURN_ENDED', actions: [{ type: 'damage', dice: '1d4', target: 'self' }],
    modifiers: {}, tags: ['POISON', 'DOT', 'NATURE'],
  },
  {
    schemaVersion: 1, id: 'fortified', name: 'Панцирь', description: 'Входящий урон снижен на 25%.',
    color: '#98bf7c', actions: [], modifiers: { damageReduction: 0.25 }, tags: ['ARMOR', 'BUFF'],
  },
  {
    schemaVersion: 1, id: 'battle_fervor', name: 'Боевой дух', description: 'Урон увеличен на 15%.',
    color: '#de946f', actions: [], modifiers: { damageMultiplier: 1.15 }, tags: ['BUFF'],
  },
];
