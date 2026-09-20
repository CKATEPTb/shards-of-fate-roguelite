import type { GameContent } from '@shards/shared';
import { balance } from './balance';
import { characters } from './characters';
import { effects } from './effects';
import { encounters } from './encounters';
import { enemies } from './enemies';
import { skills } from './skills';
import { statuses } from './statuses';
import { DIFFICULTY_PROFILES } from './difficulty';

export { balance, characters, effects, encounters, enemies, skills, statuses, DIFFICULTY_PROFILES };
export { MOVEMENT_SPEED_PROFILES } from './movement';
export { STARTER_ANATOMY } from './anatomy';
export const gameContent: GameContent = { schemaVersion: 1, characters, enemies, skills, effects, statuses, encounters, balance, difficulties: DIFFICULTY_PROFILES };
