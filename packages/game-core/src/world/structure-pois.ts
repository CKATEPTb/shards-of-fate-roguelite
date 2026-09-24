import type { WorldNode, WorldPoi, WorldStructure } from '@shards/shared';
import { createRng, hashString } from '../random';
import { basementChunkId } from './chunk-identity';
import { worldDie } from './generation-dice';

/** Independent streams keep contents stable when another structure gains a decoration. */
export function structurePois(seed: string, node: WorldNode, structures: readonly WorldStructure[]): WorldPoi[] {
  return structures.flatMap((structure, ordinal): WorldPoi[] => {
    if (structure.npcKind) return [];
    if (structure.kind === 'well') return [{ id: `${structure.id}:well`, kind: 'well', structureId: structure.id,
      position: { ...structure.approach } }];
    if (structure.kind !== 'house') return [];
    const rng = createRng(`house-contents-v3:${hashString(seed)}:${structure.id}`);
    const pois: WorldPoi[] = [];
    if (worldDie(rng, 4) <= 3) pois.push({ id: `${structure.id}:chest`, kind: 'chest', structureId: structure.id,
      position: { x: structure.origin.x + 1, y: structure.origin.y + 1 } });
    if (worldDie(rng, 4) === 4) {
      const basementId = basementChunkId(node.id, ordinal);
      pois.push({ id: `${structure.id}:stairs-down`, kind: 'stairs-down', structureId: structure.id,
        position: { x: structure.origin.x + 2, y: structure.origin.y + 1 },
        destination: { chunkId: basementId, poiId: `${basementId}:stairs-up` } });
    }
    return pois;
  });
}
