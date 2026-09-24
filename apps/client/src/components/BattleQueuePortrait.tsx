import { memo, useMemo } from 'react';
import type { Combatant, GameContent } from '@shards/shared';
import { findDefinition, gameContent } from '../catalog';
import { unitFramePixels, resolveUnitArt } from '../art/unitFrames';
import { resolveHeroVisualLoadout } from '../art/heroLoadout';
import { enemyArtId } from '../art/enemyAppearance';
import { unitPortraitViewBox } from '../art/unitPortrait';

/** Species-specific head/shoulder crops: the queue never scales down a full body. */
export const BattleQueuePortrait = memo(function BattleQueuePortrait({ unit, content = gameContent }: { unit: Combatant; content?: GameContent }) {
  const definition = findDefinition(unit.definitionId, content);
  const enemy = unit.team === 'enemies';
  const artId = enemy ? enemyArtId(definition) : resolveUnitArt(definition.sprite || definition.id, definition.role, false);
  const pixels = useMemo(() => unitFramePixels(artId, definition.role, enemy, 'south', 'idle', 0,
    undefined, enemy ? undefined : resolveHeroVisualLoadout(definition)), [artId, definition, enemy]);
  // Portraits keep a neutral upright pose even if the battlefield unit crawls.
  const crop = unitPortraitViewBox(artId, enemy);
  return <svg className="battle-queue-portrait" viewBox={crop} shapeRendering="crispEdges" aria-hidden="true">
    {pixels.map(pixel => <rect key={`${pixel.x}:${pixel.y}`} x={pixel.x} y={pixel.y} width="1" height="1" fill={pixel.color} />)}
  </svg>;
});
