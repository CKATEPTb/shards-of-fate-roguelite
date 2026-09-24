// @refresh reset
// Phaser owns cached textures and effects; hot updates must rebuild the scene, not the expedition.
import { useEffect, useMemo, useRef } from 'react';
import type { CoopActor, ExplorationState, GameContent, GridPoint, RoamingGroup } from '@shards/shared';
import { findPath, isBodyAlive } from '@shards/game-core';
import { mountWorld } from './mountWorld';
import type { WorldScene } from './WorldScene';
import { TILE_SIZE, type WorldProjection } from './projection';
import { ExitIndicators, updateExitIndicators } from './ExitMarkerOverlay';
import { AllyIndicators, updateAllyIndicators } from './AllyMarkerOverlay';
import { allyIndicatorTargets } from './allyIndicators';
import { isInteractivePoi, type CampfireTimes } from './poiInteraction';
import { gameContent } from '../catalog';
import './world.css';

export interface WorldCanvasProps {
  state: ExplorationState;
  controlledActorId: string;
  reducedMotion: boolean;
  onMove: (point: GridPoint) => void;
  disabled?: boolean;
  /** Pause world animation separately from input; by default disabled input also pauses it. */
  paused?: boolean;
  inCombat?: boolean;
  clearedPoiIds?: string[];
  groups?: RoamingGroup[];
  previewGroupIds?: string[];
  inspectedGroupId?: string | null;
  onInspectMob?: (groupId: string | null) => void;
  onInteract?: (poiId: string) => void;
  onRevive?: (targetActorId: string) => void;
  allies?: readonly CoopActor[];
  followingActorId?: string | null;
  onFollow?: (actorId: string) => void;
  campfires?: CampfireTimes;
  content?: GameContent;
}

const noAllies: readonly CoopActor[] = [];

export function WorldCanvas({ state, controlledActorId, reducedMotion, onMove, disabled = false, paused = disabled, inCombat = false, clearedPoiIds = [], groups, previewGroupIds, inspectedGroupId, onInspectMob, onInteract, onRevive, allies = noAllies, followingActorId, onFollow, campfires, content = gameContent }: WorldCanvasProps) {
  const actor = state.actors.find(item => item.id === controlledActorId);
  const canMove = !disabled && !inCombat && !!actor && (!actor.body || isBodyAlive(actor.body));
  // Reuse the actual movement rules, including the ban on passing through other gates.
  // Only tile arrivals or terrain changes recompute routes; animation frames do not.
  const reachableExits = useMemo(() => actor ? state.chunk.exits.filter(exit =>
    exit.position.x === actor.position.x && exit.position.y === actor.position.y
    || findPath(state.chunk, actor.position, exit.position).length > 0) : [], [state.chunk, actor?.position]);
  const currentExits = useRef(reachableExits);
  currentExits.current = reachableExits;
  const otherAllies = useMemo(() => allies.filter(ally => ally.id !== controlledActorId), [allies, controlledActorId]);
  const allyTargets = useMemo(() => allyIndicatorTargets(otherAllies, state, controlledActorId, followingActorId),
    [otherAllies, state.graph, state.chunk, state.currentChunkId, controlledActorId, followingActorId]);
  const currentAllyTargets = useRef(allyTargets);
  currentAllyTargets.current = allyTargets;
  const host = useRef<HTMLDivElement>(null);
  const exitMarkers = useRef<SVGSVGElement>(null);
  const allyMarkers = useRef<HTMLDivElement>(null);
  const projection = useRef<WorldProjection | null>(null);
  const scene = useRef<WorldScene | null>(null);
  const move = useRef(onMove);
  const inspect = useRef(onInspectMob);
  const interact = useRef(onInteract);
  const revive = useRef(onRevive);
  const canInteract = Boolean(onInteract);
  const canRevive = Boolean(onRevive);
  const presentation = useRef({ state, controlledActorId, reducedMotion, disabled, paused, inCombat, clearedPoiIds, groups, previewGroupIds, inspectedGroupId, campfires, canInteract, canRevive, content });
  move.current = onMove;
  inspect.current = onInspectMob;
  interact.current = onInteract;
  revive.current = onRevive;
  presentation.current = { state, controlledActorId, reducedMotion, disabled, paused, inCombat, clearedPoiIds, groups, previewGroupIds, inspectedGroupId, campfires, canInteract, canRevive, content };

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
        updateAllyIndicators(allyMarkers.current, currentAllyTargets.current, currentExits.current, view);
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
      poiId => interact.current?.(poiId),
      actorId => revive.current?.(actorId),
    );
    return () => { scene.current = null; dispose(); };
  }, []);

  useEffect(() => {
    scene.current?.showWorld(presentation.current);
    // Loading another seed may change the gates while leaving the camera still.
    if (projection.current) updateExitIndicators(exitMarkers.current, reachableExits, projection.current);
  }, [state, controlledActorId, reducedMotion, disabled, paused, inCombat, clearedPoiIds, reachableExits, groups, previewGroupIds, inspectedGroupId, campfires, canInteract, canRevive, content]);

  useEffect(() => {
    if (projection.current) updateAllyIndicators(allyMarkers.current, allyTargets, reachableExits, projection.current);
  }, [allyTargets, reachableExits, canMove, onFollow]);

  return (
    <div className="world-canvas-frame">
      <div
        ref={host}
        className="world-canvas"
        data-testid="world-canvas"
        data-tile-size={TILE_SIZE}
        data-chunk-id={state.currentChunkId}
        data-layer={state.chunk.layer ?? 'surface'}
        data-actor-id={actor?.id}
        data-actor-x={actor?.position.x}
        data-actor-y={actor?.position.y}
        role="region"
        aria-label="Карта мира. Нажмите на землю для движения, на сундук, колодец, портал, лестницу или мастера для взаимодействия. Нажмите на павшего союзника с таймером, чтобы подойти и поднять его. Стрелки перемещают героя, E использует ближайший объект или поднимает союзника. Камера следует за героем."
        tabIndex={canMove ? 0 : -1}
        onPointerDown={() => { if (canMove) host.current?.focus({ preventScroll: true }); }}
        onKeyDown={(event) => {
          if (!canMove || !actor) return;
          if (event.code === 'KeyE' || event.key === 'Enter') {
            if (event.repeat) { event.preventDefault(); return; }
            if (scene.current?.reviveNearby()) { event.preventDefault(); return; }
            const nearby = state.chunk.pois.filter(isInteractivePoi).map(poi => ({ poi,
              distance: Math.abs(poi.position.x - actor.position.x) + Math.abs(poi.position.y - actor.position.y),
            })).filter(candidate => candidate.distance <= 1).sort((a, b) => a.distance - b.distance)[0];
            if (nearby && onInteract) { event.preventDefault(); onInteract(nearby.poi.id); }
            return;
          }
          const directions: Record<string, GridPoint> = { ArrowUp: { x: 0, y: -1 }, ArrowRight: { x: 1, y: 0 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 } };
          const direction = directions[event.key];
          if (direction) {
            event.preventDefault();
            onMove({ x: actor.position.x + direction.x, y: actor.position.y + direction.y });
          }
        }}
      />
      <ExitIndicators surfaceRef={exitMarkers} exits={reachableExits} hidden={!canMove} onMove={onMove} />
      <AllyIndicators surfaceRef={allyMarkers} allies={otherAllies} followingActorId={followingActorId} hidden={!canMove} onFollow={onFollow} content={content} />
    </div>
  );
}
