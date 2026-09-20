import { readFile } from 'node:fs/promises';
import { gameContent } from '@shards/game-data';
import { assertValidContent } from './index';

try {
  const file = process.argv[2];
  const content: unknown = file ? JSON.parse(await readFile(file, 'utf8')) : gameContent;
  assertValidContent(content);
  console.log(`Content valid: ${content.characters.length} characters, ${content.enemies.length} enemies, ${content.skills.length} skills, ${content.effects.length} effects, ${content.statuses.length} statuses, ${content.encounters.length} encounters.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
