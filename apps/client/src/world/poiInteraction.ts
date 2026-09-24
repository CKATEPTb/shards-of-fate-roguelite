import type { GridPoint, WorldChunk, WorldPoi } from '@shards/shared';
import { tileCenter, TILE_SIZE } from './projection';
import { npcNames, npcWorldAnchors } from './npcArt';

export type CampfireTimes = Record<string, { litAtTick: number; expiresAtTick: number }>;

export function fireRemaining(poiId: string, tick: number, fires?: CampfireTimes): number {
  if (!fires) return 1;
  const fire = fires[poiId];
  if (!fire || tick < fire.litAtTick || fire.expiresAtTick <= fire.litAtTick) return 0;
  return Math.max(0, Math.min(1, (fire.expiresAtTick - tick) / (fire.expiresAtTick - fire.litAtTick)));
}

export function isInteractivePoi(poi: WorldPoi): boolean {
  return ['portal', 'chest', 'well', 'stairs-down', 'stairs-up'].includes(poi.kind)
    || poi.kind === 'altar' && !!poi.bossSeason || poi.kind === 'npc' && !!poi.npcKind;
}

/** Hit the visible object, including its upper edge, rather than only its ground tile. */
export function interactivePoiAt(chunk: WorldChunk, point: GridPoint, isVisible: (poi: WorldPoi) => boolean): WorldPoi | undefined {
  return chunk.pois.filter(poi => isInteractivePoi(poi) && isVisible(poi)).find(poi => {
    if (poi.kind === 'npc') {
      const bounds = npcWorldAnchors(chunk, poi)?.hit;
      return !!bounds && point.x >= bounds.x && point.x <= bounds.x + bounds.width
        && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
    }
    const center = tileCenter(poi.position);
    if (poi.kind === 'well') {
      const structure = chunk.structures.find(item => item.id === poi.structureId);
      if (structure) {
        const x = (structure.origin.x + structure.width / 2) * TILE_SIZE;
        const y = (structure.origin.y + structure.height) * TILE_SIZE - 2;
        if (point.x >= x - 34 && point.x <= x + 34 && point.y >= y - 79 && point.y <= y + 5) return true;
      }
    }
    const width = poi.kind === 'portal' ? 22 : 17;
    const height = poi.kind === 'portal' ? 55 : poi.kind === 'altar' ? 45 : 26;
    return point.x >= center.x - width && point.x <= center.x + width
      && point.y >= center.y - height && point.y <= center.y + 15;
  });
}

export function poiLabel(poi: WorldPoi, cleared: boolean): string {
  if (poi.kind === 'npc' && poi.npcKind) return `${npcNames[poi.npcKind]} · ${poi.npcKind === 'merchant' ? 'торговать' : poi.npcKind === 'blacksmith' ? 'улучшить снаряжение' : 'улучшить навыки'}`;
  if (poi.kind === 'portal') return 'Портал · перейти';
  if (poi.kind === 'chest') return cleared ? 'Пустой сундук' : 'Сундук · открыть';
  if (poi.kind === 'well') return cleared ? 'Вода уже выпита' : 'Колодец · испить';
  if (poi.kind === 'stairs-down') return 'Подвал · спуститься';
  if (poi.kind === 'stairs-up') return 'Поверхность · подняться';
  if (poi.kind === 'altar' && poi.bossSeason) {
    const season = { spring: 'весны', summer: 'лета', autumn: 'осени', winter: 'зимы' }[poi.bossSeason];
    return `Алтарь ${season} · ${cleared ? 'босс призван' : 'призвать босса'}`;
  }
  return '';
}
