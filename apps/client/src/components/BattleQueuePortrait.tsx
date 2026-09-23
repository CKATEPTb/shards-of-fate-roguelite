import { memo, useMemo } from 'react';
import type { Combatant, GameContent } from '@shards/shared';
import { findDefinition, gameContent } from '../catalog';
import { unitFramePixels, resolveUnitArt } from '../art/unitFrames';
import { resolveHeroVisualLoadout } from '../art/heroLoadout';

/** Species-specific head/shoulder crops: the queue never scales down a full body. */
export const BattleQueuePortrait = memo(function BattleQueuePortrait({ unit, content = gameContent }: { unit: Combatant; content?: GameContent }) {
  const definition = findDefinition(unit.definitionId, content);
  const enemy = unit.team === 'enemies';
  const artId = resolveUnitArt(definition.sprite || definition.id, definition.role, enemy);
  const pixels = useMemo(() => unitFramePixels(artId, definition.role, enemy, 'south', 'idle', 0,
    undefined, enemy ? undefined : resolveHeroVisualLoadout(definition)), [artId, definition, enemy]);
  // Portraits keep a neutral upright pose even if the battlefield unit crawls.
  const crop = !enemy ? '18 3 28 28'
    : artId === 'elite_warden' ? '5 1 23 23'
    : artId === 'thornling' ? '5 7 23 23'
    : artId === 'slime' ? '7 13 18 18'
    : artId === 'spider' ? '9 15 15 15'
    : ['rat', 'wolf', 'boar'].includes(artId) ? '7 13 18 18'
    : '7 4 18 18';
  return <svg className="battle-queue-portrait" viewBox={crop} shapeRendering="crispEdges" aria-hidden="true">
    {pixels.map(pixel => <rect key={`${pixel.x}:${pixel.y}`} x={pixel.x} y={pixel.y} width="1" height="1" fill={pixel.color} />)}
  </svg>;
});
