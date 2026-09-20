import type { EffectDefinition } from '@shards/shared';

export const effects: EffectDefinition[] = [
  {
    schemaVersion: 1, id: 'priest_benediction', name: 'Благословение света',
    description: 'Исцеление Жрицы усиливает урон получателя на 20% на 2 его хода.',
    trigger: 'HEALED', conditions: ['sourceIsOwner', 'targetIsAlly', 'ownerAlive'], target: 'eventTarget',
    actions: [{ type: 'status', statusId: 'inspired', duration: 2 }],
    priority: 10, internalCooldown: 0, tags: ['HEAL', 'BUFF', 'HOLY'],
  },
  {
    schemaVersion: 1, id: 'mage_ember_spark', name: 'Тлеющая искра',
    description: 'Критический удар Мага накладывает горение на 2 хода.',
    trigger: 'CRIT', conditions: ['sourceIsOwner', 'ownerAlive'], target: 'eventTarget',
    actions: [{ type: 'status', statusId: 'burning', duration: 2 }],
    priority: 10, internalCooldown: 1, tags: ['FIRE', 'BURN', 'CRITICAL'],
  },
];
