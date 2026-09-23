import type { StatusDefinition } from '@shards/shared';
import { auraVisual } from './aura-profiles';
import { additionalStatuses } from './status-catalog';

const existingStatuses: StatusDefinition[] = [
  {
    schemaVersion: 1, id: 'taunted', name: 'Вызов', description: 'Враги обязаны атаковать только этого бойца. Атаки по всему отряду также направляются исключительно в него. Действует 3 собственных хода.',
    color: '#f2b45c', actions: [], modifiers: { taunt: true }, tags: ['TAUNT'], polarity: 'positive', stacking: 'refresh',
  },
  {
    schemaVersion: 1, id: 'bastion', name: 'Бастион', description: 'Полностью блокирует любой входящий урон до начала следующего собственного хода.',
    color: '#f3d489', actions: [], modifiers: { invulnerable: true }, tags: ['ARMOR', 'BLOCK'], polarity: 'positive', stacking: 'refresh', expiresAt: 'TURN_STARTED',
  },
  {
    schemaVersion: 1, id: 'bloodlust', name: 'Жажда крови', description: 'Каждый прямой удар получает дополнительный бросок 1d6 к урону. Длится 3 собственных хода.',
    color: '#c46c80', actions: [], modifiers: { damageBonusDice: '1d6' }, tags: ['VAMPIRISM', 'PHYSICAL', 'BUFF'], polarity: 'positive', stacking: 'refresh',
  },
  {
    schemaVersion: 1, id: 'regrowth', name: 'Регенерация', description: 'В начале собственного хода получателя восстанавливает 1d8 + Силу Друида. После тика Друид бросает 1d4: на 4 этот заряд продлевается на 1 ход. Каждый заряд действует отдельно.',
    color: '#a7ca83', trigger: 'TURN_STARTED', actions: [{ type: 'heal', dice: '1d8', scaling: 'power', target: 'self' }],
    modifiers: {}, tags: ['HOT', 'NATURE', 'REGENERATION'], polarity: 'positive',
  },
  {
    schemaVersion: 1, id: 'sure_strike', name: 'Смертельная точность', description: 'Попавшие прямые удары всегда критические.',
    color: '#d6c2a3', actions: [], modifiers: { guaranteedCrit: true }, tags: ['CRITICAL', 'BUFF'], polarity: 'positive', stacking: 'refresh',
  },
  {
    schemaVersion: 1, id: 'rapid_fire', name: 'Шквал стрел', description: 'Вторая стрела использует 1d6 вместо 1d4: на 4–6 повторяет атаку по той же живой цели. Дополнительная атака не запускает новый повтор.',
    color: '#bfd88f', actions: [], modifiers: { repeatAttack: { dice: '1d6', atLeast: 4 } }, tags: ['REPEAT', 'PROJECTILE', 'BUFF'], polarity: 'positive', stacking: 'refresh',
  },
  {
    schemaVersion: 1, id: 'inspired', name: 'Благословение', description: 'Каждый заряд добавляет отдельный бросок 1d4 к урону каждого прямого удара на 2 собственных хода. Длительность зарядов считается отдельно.',
    color: '#f5da84', actions: [], modifiers: { damageBonusDice: '1d4' }, tags: ['HOLY', 'BUFF'], polarity: 'positive',
  },
  {
    schemaVersion: 1, id: 'burning', name: 'Горение', description: 'В конце собственного хода получает урон по числу зарядов Горения, игнорируя броню, затем теряет 1 заряд. Новое попадание огнём добавляет заряд к общему пламени.',
    color: '#f19258', trigger: 'TURN_ENDED',
    actions: [{ type: 'damage', damagePerStack: 1, bypassArmor: true, target: 'self' }],
    modifiers: {}, tags: ['FIRE', 'BURN', 'DOT'], polarity: 'negative', stacking: 'decay',
  },
  {
    schemaVersion: 1, id: 'poisoned', name: 'Яд', description: 'В конце собственного хода носителя каждый заряд наносит 1d4 урона ядом.',
    color: '#b4ce6b', trigger: 'TURN_ENDED', actions: [{ type: 'damage', dice: '1d4', target: 'self' }],
    modifiers: {}, tags: ['POISON', 'DOT', 'NATURE'], polarity: 'negative',
  },
  {
    schemaVersion: 1, id: 'fortified', name: 'Панцирь', description: 'Поглощает 4 единицы каждого полученного удара за заряд.',
    color: '#98bf7c', actions: [], modifiers: { damageReduction: 4 }, tags: ['ARMOR', 'BUFF'], polarity: 'positive',
  },
  {
    schemaVersion: 1, id: 'battle_fervor', name: 'Боевой дух', description: 'Каждый заряд добавляет +2 к броскам урона.',
    color: '#de946f', actions: [], modifiers: { damageBonus: 2 }, tags: ['BUFF'], polarity: 'positive',
  },
];

/** Legacy effects retain their exact rules and copy; only authored presentation metadata is added. */
const existingPresentation: Record<string, Pick<StatusDefinition, 'visual' | 'defaultDuration'>> = {
  taunted: { defaultDuration: 3, visual: auraVisual('war', 0, { form: 'waves', motion: 'orbit', motif: 'claw', radius: 21, height: 44 }) },
  bastion: { defaultDuration: 1, visual: auraVisual('holy', 0, { form: 'dome', motion: 'pulse', motif: 'shield', radius: 19, height: 41 }) },
  bloodlust: { defaultDuration: 3, visual: auraVisual('blood', 0, { form: 'vortex', motion: 'rise', motif: 'fang' }) },
  regrowth: { defaultDuration: 3, visual: auraVisual('nature', 0, { form: 'orbit', motion: 'spiral', motif: 'leaf' }) },
  sure_strike: { defaultDuration: 3, visual: auraVisual('shadow', 0, { form: 'arcs', motion: 'orbit', motif: 'claw' }) },
  rapid_fire: { defaultDuration: 3, visual: auraVisual('storm', 0, { form: 'feathers', motion: 'spiral', motif: 'bolt' }) },
  inspired: { defaultDuration: 2, visual: auraVisual('holy', 1, { form: 'waves', motion: 'pulse', motif: 'cross' }) },
  burning: { defaultDuration: null, visual: auraVisual('fire', 0, { form: 'flames', motion: 'rise', motif: 'flame' }) },
  poisoned: { defaultDuration: 3, visual: auraVisual('venom', 0, { form: 'mist', motion: 'breathe', motif: 'fang' }) },
  fortified: { defaultDuration: 3, visual: auraVisual('nature', 1, { form: 'roots', motion: 'orbit', motif: 'rock' }) },
  battle_fervor: { defaultDuration: 3, visual: auraVisual('war', 1, { form: 'runes', motion: 'rise', motif: 'shield' }) },
};

export const statuses: StatusDefinition[] = [
  ...existingStatuses.map(status => ({ ...status, ...existingPresentation[status.id] })),
  ...additionalStatuses,
];
