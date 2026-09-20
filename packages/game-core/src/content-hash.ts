import type { GameContent, UnitDefinition } from '@shards/shared';
import { hashValue } from './canonical';
import { same } from './snapshot-values';

function withoutMovementSpeed<T extends UnitDefinition>(definition: T): Omit<T, 'movementSpeed'> {
  const { movementSpeed: _movementSpeed, ...legacyDefinition } = definition;
  return legacyDefinition;
}

function withoutAnatomy<T extends UnitDefinition>(definition: T): Omit<T, 'anatomy'> {
  const { anatomy: _anatomy, ...legacyDefinition } = definition;
  return legacyDefinition;
}

export function isLegacyAnatomyContentHash(value: unknown, content: GameContent): boolean {
  const legacy = { ...content, characters: content.characters.map(withoutAnatomy), enemies: content.enemies.map(withoutAnatomy) };
  return value === hashValue(legacy) || value === hashValue({ ...legacy, characters: legacy.characters.map(withoutMovementSpeed), enemies: legacy.enemies.map(withoutMovementSpeed) });
}

/** Accept only the exact content shapes before movement speed and starting anatomy were added. */
export function restoreContentHash(value: unknown, content: GameContent, path: string): string {
  const currentHash = hashValue(content);
  if (value !== currentHash && !isLegacyAnatomyContentHash(value, content)) {
    const legacyHash = hashValue({
      ...content,
      characters: content.characters.map(withoutMovementSpeed),
      enemies: content.enemies.map(withoutMovementSpeed),
    });
    same(value, legacyHash, path);
  }
  return currentHash;
}
