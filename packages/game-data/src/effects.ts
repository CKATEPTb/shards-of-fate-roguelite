import type { EffectDefinition } from '@shards/shared';

export const effects: EffectDefinition[] = [
  {
    schemaVersion: 1, id: 'priest_benediction', name: 'Благословение света',
    description: 'Получивший исцеление Жрицы получает отдельный заряд Благословения: +1d4 к урону каждого удара на 2 его хода.',
    trigger: 'HEALED', conditions: ['sourceIsOwner', 'targetIsAlly', 'ownerAlive'], target: 'eventTarget',
    actions: [{ type: 'status', statusId: 'inspired', duration: 2 }],
    priority: 10, internalCooldown: 0, tags: ['HEAL', 'BUFF', 'HOLY'],
  },
  {
    schemaVersion: 1, id: 'mage_ember_spark', name: 'Тлеющая искра',
    description: 'Каждое критическое попадание Мага добавляет 1 заряд Горения. В конце хода цель получает урон по числу зарядов, затем теряет 1 заряд.',
    trigger: 'CRIT', conditions: ['sourceIsOwner', 'ownerAlive'], target: 'eventTarget',
    actions: [{ type: 'status', statusId: 'burning', duration: null }],
    priority: 10, internalCooldown: 0, tags: ['FIRE', 'BURN', 'CRITICAL'],
  },
];
