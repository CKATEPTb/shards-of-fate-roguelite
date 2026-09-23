import { readFile } from 'node:fs/promises';
import { EQUIPMENT_ITEMS, EQUIPMENT_SETS, gameContent } from '@shards/game-data';
import { assertValidContent, assertValidEquipmentCatalog } from './index';

try {
  const file = process.argv[2];
  const content: unknown = file ? JSON.parse(await readFile(file, 'utf8')) : gameContent;
  assertValidContent(content);
  if (!file) assertValidEquipmentCatalog(EQUIPMENT_ITEMS, EQUIPMENT_SETS);
  console.log(`Content valid: ${content.characters.length} characters, ${content.enemies.length} enemies, ${content.skills.length} skills, ${content.effects.length} effects, ${content.statuses.length} statuses, ${content.encounters.length} encounters.`);
  if (!file) console.log(`Equipment valid: ${Object.keys(EQUIPMENT_ITEMS).length} items, ${Object.keys(EQUIPMENT_SETS).length} sets.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
