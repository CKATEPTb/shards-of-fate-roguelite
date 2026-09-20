import type { EncounterDefinition } from '@shards/shared';

export const encounters: EncounterDefinition[] = [
  {
    schemaVersion: 1, id: 'mossy_path', name: 'Мшистая тропа', description: 'Первые шорохи за поросшими мхом камнями.',
    biome: 'Весенний лес', difficulty: 'Лёгкая', enemyIds: ['rat', 'rat', 'slime'],
  },
  {
    schemaVersion: 1, id: 'wolf_den', name: 'Волчья лощина', description: 'Паутина пересекает следы голодной стаи.',
    biome: 'Весенний лес', difficulty: 'Обычная', enemyIds: ['wolf', 'wolf', 'spider'],
  },
  {
    schemaVersion: 1, id: 'goblin_ambush', name: 'Засада у ручья', description: 'Разведчики гоблинов вывели лучника к переправе.',
    biome: 'Летняя роща', difficulty: 'Опасная', enemyIds: ['goblin_scout', 'goblin_scout', 'goblin_archer', 'goblin_shaman'],
  },
  {
    schemaVersion: 1, id: 'thorn_thicket', name: 'Колючие заросли', description: 'Кабаны проложили тропу через живой колючий лес.',
    biome: 'Летняя роща', difficulty: 'Сложная', enemyIds: ['boar', 'boar', 'thornling', 'spider'],
  },
  {
    schemaVersion: 1, id: 'warden_grove', name: 'Роща дозорного', description: 'Хранитель чащи собирает защитников у древнего корня.',
    biome: 'Древняя роща · Акт I', difficulty: 'Элитная', enemyIds: ['elite_warden', 'thornling', 'goblin_shaman', 'goblin_archer'],
  },
];
