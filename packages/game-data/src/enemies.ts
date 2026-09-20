import type { EnemyDefinition } from '@shards/shared';

export const enemies: EnemyDefinition[] = [
  {
    schemaVersion: 1, id: 'rat', name: 'Лесная крыса', title: 'Стая', description: 'Мелкий проворный зверёк. Опасен числом.',
    role: 'damage', rank: 'SWARM', encounterCost: 1, color: '#ad9280', sprite: 'rat',
    stats: { maxHp: 12, power: 4, armor: 1, initiative: 15, crit: 0.05, evasion: 0.08, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d4', scaling: 'power', factor: 0.5 },
    skillIds: ['rat_gnaw'], effectIds: [], modifiers: {}, tags: ['BEAST', 'PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'wolf', name: 'Голодный волк', title: 'Хищник', description: 'Быстрый хищник с опасным первым прыжком.',
    role: 'damage', rank: 'NORMAL', encounterCost: 2, color: '#c0c8c6', sprite: 'wolf',
    stats: { maxHp: 22, power: 7, armor: 3, initiative: 14, crit: 0.1, evasion: 0.09, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d6', scaling: 'power', factor: 0.6 },
    skillIds: ['wolf_pounce'], effectIds: [], modifiers: {}, tags: ['BEAST', 'PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'slime', name: 'Лесная слизь', title: 'Защитник', description: 'Медленная слизь прячется под вязкой оболочкой.',
    role: 'tank', rank: 'NORMAL', encounterCost: 2, color: '#86c58a', sprite: 'slime',
    stats: { maxHp: 25, power: 5, armor: 8, initiative: 3, crit: 0.02, evasion: 0.02, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d4', scaling: 'power', factor: 0.7 },
    skillIds: ['slime_shell'], effectIds: [], modifiers: {}, tags: ['NATURE', 'SHIELD'],
  },
  {
    schemaVersion: 1, id: 'spider', name: 'Дикий паук', title: 'Отравитель', description: 'Яд продолжает действовать после укуса.',
    role: 'damage', rank: 'NORMAL', encounterCost: 2, color: '#b58dba', sprite: 'spider',
    stats: { maxHp: 17, power: 6, armor: 3, initiative: 13, crit: 0.06, evasion: 0.1, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d6', scaling: 'power', factor: 0.5 },
    skillIds: ['spider_venom'], effectIds: [], modifiers: {}, tags: ['BEAST', 'POISON'],
  },
  {
    schemaVersion: 1, id: 'goblin_scout', name: 'Гоблин-разведчик', title: 'Налётчик', description: 'Ищет слабое место в строю противника.',
    role: 'damage', rank: 'NORMAL', encounterCost: 2, color: '#a6bd70', sprite: 'goblin_scout',
    stats: { maxHp: 22, power: 7, armor: 5, initiative: 12, crit: 0.12, evasion: 0.1, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d6', scaling: 'power', factor: 0.7 },
    skillIds: ['scout_stab'], effectIds: [], modifiers: {}, tags: ['GOBLIN', 'PHYSICAL'],
  },
  {
    schemaVersion: 1, id: 'goblin_archer', name: 'Гоблин-лучник', title: 'Стрелок', description: 'Обстреливает отряд залпами коротких стрел.',
    role: 'damage', rank: 'VETERAN', encounterCost: 3, color: '#d3a66a', sprite: 'goblin_archer',
    stats: { maxHp: 20, power: 8, armor: 4, initiative: 11, crit: 0.1, evasion: 0.08, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d8', scaling: 'power', factor: 0.6 },
    skillIds: ['archer_volley'], effectIds: [], modifiers: {}, tags: ['GOBLIN', 'PROJECTILE'],
  },
  {
    schemaVersion: 1, id: 'goblin_shaman', name: 'Гоблин-шаман', title: 'Лекарь', description: 'Поддерживает союзников лечением и боевым духом.',
    role: 'healer', rank: 'VETERAN', encounterCost: 3, color: '#bc9bdf', sprite: 'goblin_shaman',
    stats: { maxHp: 25, power: 5, armor: 4, initiative: 8, crit: 0.05, evasion: 0.04, healing: 8 },
    basicAttack: { type: 'damage', dice: '1d4', scaling: 'power', factor: 0.6 },
    skillIds: ['shaman_mend', 'shaman_fervor'], effectIds: [], modifiers: {}, tags: ['GOBLIN', 'HEAL', 'BUFF'],
  },
  {
    schemaVersion: 1, id: 'boar', name: 'Дикий кабан', title: 'Громила', description: 'Крепкий зверь, полагающийся на мощный разбег.',
    role: 'tank', rank: 'VETERAN', encounterCost: 3, color: '#b58369', sprite: 'boar',
    stats: { maxHp: 43, power: 11, armor: 12, initiative: 6, crit: 0.06, evasion: 0.02, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d8', scaling: 'power', factor: 0.6 },
    skillIds: ['boar_charge'], effectIds: [], modifiers: {}, tags: ['BEAST', 'PHYSICAL', 'ARMOR'],
  },
  {
    schemaVersion: 1, id: 'thornling', name: 'Шиповик', title: 'Дух рощи', description: 'Оживший куст укрепляет себя колючей корой.',
    role: 'tank', rank: 'NORMAL', encounterCost: 2, color: '#77ab72', sprite: 'thornling',
    stats: { maxHp: 30, power: 7, armor: 13, initiative: 5, crit: 0.04, evasion: 0.03, healing: 0 },
    basicAttack: { type: 'damage', dice: '1d6', scaling: 'power', factor: 0.6 },
    skillIds: ['thornling_guard'], effectIds: [], modifiers: {}, tags: ['NATURE', 'ARMOR'],
  },
  {
    schemaVersion: 1, id: 'elite_warden', name: 'Дозорный чащи', title: 'Элита', description: 'Древний хранитель рощи. Испытание для отряда, но ещё не босс акта.',
    role: 'tank', rank: 'ELITE', encounterCost: 7, color: '#d2c88b', sprite: 'elite_warden',
    stats: { maxHp: 100, power: 14, armor: 17, initiative: 7, crit: 0.09, evasion: 0.04, healing: 10 },
    basicAttack: { type: 'damage', dice: '1d10', scaling: 'power', factor: 0.7 },
    skillIds: ['warden_sweep', 'warden_renewal'], effectIds: [], modifiers: {}, tags: ['NATURE', 'ELITE', 'ARMOR'],
  },
];
