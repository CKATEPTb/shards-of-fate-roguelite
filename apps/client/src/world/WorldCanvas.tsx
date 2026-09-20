// @refresh reset
// Phaser owns cached textures and effects; hot updates must rebuild the scene, not the expedition.
import { useEffect, useMemo, useRef } from 'react';
import type { ExplorationState, GridPoint, RoamingGroup } from '@shards/shared';
import { findPath } from '@shards/game-core';
import { mountWorld } from './mountWorld';
import type { WorldScene } from './WorldScene';
import { TILE_SIZE, type WorldProjection } from './projection';
import { ExitIndicators, updateExitIndicators } from './ExitMarkerOverlay';
import './world.css';

export interface WorldCanvasProps {
  state: ExplorationState;
  controlledActorId: string;
  reducedMotion: boolean;
  onMove: (point: GridPoint) => void;
  disabled?: boolean;
  inCombat?: boolean;
  clearedPoiIds?: string[];
  groups?: RoamingGroup[];
  previewGroupIds?: string[];
  inspectedGroupId?: string | null;
  groupChances?: Readonly<Record<string, number | undefined>>;
  onInspectMob?: (groupId: string | null) => void;
}

export function WorldCanvas({ state, controlledActorId, reducedMotion, onMove, disabled = false, inCombat = false, clearedPoiIds = [], groups, previewGroupIds, inspectedGroupId, groupChances, onInspectMob }: WorldCanvasProps) {
  const actor = state.actors.find(item => item.id === controlledActorId);
  // Reuse the actual movement rules, including the ban on passing through other gates.
  // Only tile arrivals or terrain changes recompute routes; animation frames do not.
  const reachableExits = useMemo(() => actor ? state.chunk.exits.filter(exit =>
    exit.position.x === actor.position.x && exit.position.y === actor.position.y
    || findPath(state.chunk, actor.position, exit.position).length > 0) : [], [state.chunk, actor?.position]);
  const currentExits = useRef(reachableExits);
  currentExits.current = reachableExits;
  const host = useRef<HTMLDivElement>(null);
  const exitMarkers = useRef<SVGSVGElement>(null);
  const projection = useRef<WorldProjection | null>(null);
  const scene = useRef<WorldScene | null>(null);
  const move = useRef(onMove);
  const inspect = useRef(onInspectMob);
  const presentation = useRef({ state, controlledActorId, reducedMotion, disabled, inCombat, clearedPoiIds, groups, previewGroupIds, inspectedGroupId, groupChances });
  move.current = onMove;
  inspect.current = onInspectMob;
  presentation.current = { state, controlledActorId, reducedMotion, disabled, inCombat, clearedPoiIds, groups, previewGroupIds, inspectedGroupId, groupChances };

  // Recreate scene effects together with their owning canvas surface.
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const dispose = mountWorld(element,
      (point) => move.current(point),
      (world) => { scene.current = world; world.showWorld(presentation.current); },
      (view) => {
        projection.current = view;
        updateExitIndicators(exitMarkers.current, currentExits.current, view);
        element.dataset.cameraScrollX = String(view.scrollX);
        element.dataset.cameraScrollY = String(view.scrollY);
        element.dataset.cameraZoom = String(view.zoom);
        element.dataset.viewportWidth = String(view.width);
        element.dataset.viewportHeight = String(view.height);
        element.dataset.visualActorX = String(view.actorX);
        element.dataset.visualActorY = String(view.actorY);
        element.dataset.actorFrames = view.actorFrames;
        element.dataset.mobFrames = view.mobFrames;
        element.dataset.inspectedGroup = view.inspectedGroupId;
        element.dataset.facing = view.facing;
        element.dataset.animationFrame = view.animationFrame;
        element.dataset.propCount = String(view.props);
        element.dataset.occludedProps = String(view.occluded);
        element.dataset.revealedHouseRoofs = String(view.revealedRoofs);
        element.dataset.exteriorHeroReveals = String(view.exteriorReveals);
      },
      groupId => inspect.current?.(groupId),
    );
    return () => { scene.current = null; dispose(); };
  }, []);

  useEffect(() => {
    scene.current?.showWorld(presentation.current);
    // Loading another seed may change the gates while leaving the camera still.
    if (projection.current) updateExitIndicators(exitMarkers.current, reachableExits, projection.current);
  }, [state, controlledActorId, reducedMotion, disabled, inCombat, clearedPoiIds, reachableExits, groups, previewGroupIds, inspectedGroupId, groupChances]);

  return (
    <div className="world-canvas-frame">
      <div
        ref={host}
        className="world-canvas"
        data-testid="world-canvas"
        data-tile-size={TILE_SIZE}
        data-chunk-id={state.currentChunkId}
        data-actor-id={actor?.id}
        data-actor-x={actor?.position.x}
        data-actor-y={actor?.position.y}
        role="region"
        aria-label="Карта мира. Нажмите на карту, чтобы ваш герой пошёл в указанную клетку. Стрелки на клавиатуре перемещают вашего героя. Камера автоматически следует за ним."
        tabIndex={disabled ? -1 : 0}
        onPointerDown={() => { if (!disabled) host.current?.focus({ preventScroll: true }); }}
        onKeyDown={(event) => {
          if (disabled || !actor) return;
          const directions: Record<string, GridPoint> = { ArrowUp: { x: 0, y: -1 }, ArrowRight: { x: 1, y: 0 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 } };
          const direction = directions[event.key];
          if (direction) {
            event.preventDefault();
            onMove({ x: actor.position.x + direction.x, y: actor.position.y + direction.y });
          }
        }}
      />
      <ExitIndicators surfaceRef={exitMarkers} exits={reachableExits} hidden={disabled} onMove={onMove} />
    </div>
  );
}
