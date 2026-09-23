import Phaser from 'phaser';
import type { ExplorationState, GameContent, GridPoint, RoamingGroup } from '@shards/shared';
import { chunkRegions, isBodyAlive, MOVEMENT_TICK_MS, regionAt } from '@shards/game-core';
import { animateActor, createActorView, updateActorView, type ActorView } from './actors';
import { animateLandmarks, drawLandmarks } from './landmarks';
import { tileCenter, TILE_SIZE, type WorldFrame } from './projection';
import { createTerrainTexture } from './terrain';
import { followPoint } from './motion';
import { createEnvironment, type EnvironmentRenderer } from './props';
import { visibleWorldBounds, worldCameraZoom } from './camera';
import { createWorldLighting } from './lighting';
import { drawMovementCursor } from './movementCursor';
import { createRoamingViews } from './roaming-views';
import { fireRemaining, interactivePoiAt, poiLabel, type CampfireTimes } from './poiInteraction';
import { gameContent } from '../catalog';

const MOVEMENT_MARKER_DEPTH = 90_002;

export interface WorldPresentation {
  state: ExplorationState;
  controlledActorId: string;
  reducedMotion: boolean;
  disabled: boolean;
  paused?: boolean;
  inCombat: boolean;
  clearedPoiIds: string[];
  groups?: RoamingGroup[];
  previewGroupIds?: string[];
  inspectedGroupId?: string | null;
  campfires?: CampfireTimes;
  canInteract?: boolean;
  content?: GameContent;
}

export class WorldScene extends Phaser.Scene {
  private presentation?: WorldPresentation;
  private ready = false;
  private signature = '';
  private renderedChunk?: ExplorationState['chunk'];
  private regions?: ReturnType<typeof chunkRegions>;
  private textureKey = '';
  private background?: Phaser.GameObjects.Image;
  private landmarks?: Phaser.GameObjects.Container;
  private pathArt?: Phaser.GameObjects.Graphics;
  private destinationArt?: Phaser.GameObjects.Graphics;
  private hoverArt?: Phaser.GameObjects.Graphics;
  private poiLabel?: Phaser.GameObjects.Text;
  private fireGauge?: Phaser.GameObjects.Graphics;
  private views = new Map<string, ActorView>();
  private drag?: { x: number; y: number; moved: boolean };
  private lastCleared = '';
  private terrainSequence = 0;
  private lastProjection = '';
  private pausePending = false;
  private environment?: EnvironmentRenderer;
  private cursor?: GridPoint;
  private cameraFocus?: GridPoint;
  private resumePending = false;
  private lighting?: ReturnType<typeof createWorldLighting>;
  private campfires: GridPoint[] = [];
  private litCampfireIds = new Set<string>();
  private landmarkTime = 0;
  private landmarkFrame = -1;
  private mobs?: ReturnType<typeof createRoamingViews>;
  private inspectedIntent: string | null = null;
  private hoverPointer?: Phaser.Input.Pointer;

  constructor(
    private onMove: (point: GridPoint) => void,
    private onProjection: (view: WorldFrame) => void,
    private onInspectMob: (groupId: string | null) => void = () => {},
    private onInteract?: (poiId: string) => void,
  ) {
    super('world');
  }

  create() {
    this.ready = true;
    this.cameras.main.setRoundPixels(false);
    this.pathArt = this.add.graphics().setDepth(3);
    // Both movement rings stay whole above scenery and the darkness mask.
    this.destinationArt = this.add.graphics().setDepth(MOVEMENT_MARKER_DEPTH);
    this.hoverArt = this.add.graphics().setDepth(MOVEMENT_MARKER_DEPTH);
    this.fireGauge = this.add.graphics().setDepth(MOVEMENT_MARKER_DEPTH - 1);
    this.poiLabel = this.add.text(0, 0, '', { fontFamily: 'Georgia, serif', fontSize: '11px', color: '#e7e0c6',
      backgroundColor: '#17242a', padding: { x: 7, y: 4 }, stroke: '#102026', strokeThickness: 1,
    }).setOrigin(.5, 1).setDepth(MOVEMENT_MARKER_DEPTH + 1).setAlpha(.94).setVisible(false);
    this.mobs = createRoamingViews(this);
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('pointerupoutside', () => { this.drag = undefined; });
    this.input.on('gameout', () => {
      this.cursor = undefined; this.hoverArt?.clear(); this.hoverPointer = undefined;
      this.poiLabel?.setVisible(false);
      if (!this.input.activePointer.wasTouch) this.inspect(null);
    });
    this.lighting = createWorldLighting(this);
    this.scale.on('resize', this.resized, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.scale.off('resize', this.resized, this);
      this.game.events.off(Phaser.Core.Events.POST_RENDER, this.pauseWhenRequested, this);
      this.views.clear();
      this.environment?.destroy();
      this.mobs?.destroy();
      this.lighting?.destroy();
    });
    if (this.presentation) this.renderWorld(this.presentation, true);
  }

  showWorld(presentation: WorldPresentation) {
    const previous = this.presentation;
    this.presentation = presentation;
    if (previous?.reducedMotion !== presentation.reducedMotion) this.landmarkFrame = -1;
    this.inspectedIntent = presentation.inspectedGroupId ?? null;
    if (previous && (previous.paused ?? previous.disabled) && !(presentation.paused ?? presentation.disabled)) this.resumePending = true;
    if (!this.ready) return;
    const reset = !!previous && (
      presentation.state.graph !== previous.state.graph ||
      presentation.state.tick < previous.state.tick ||
      presentation.state.transitions < previous.state.transitions
    );
    const enteringCombat = presentation.inCombat && !previous?.inCombat;
    this.renderWorld(presentation, false, previous?.controlledActorId !== presentation.controlledActorId, reset, enteringCombat);
    if (presentation.disabled) {
      this.drag = undefined;
      this.hoverArt?.clear();
      this.cursor = undefined;
      this.hoverPointer = undefined;
      this.poiLabel?.setVisible(false);
    }
    // An overlay can leave the world visible, but it does not need a second
    // animation loop underneath a battle. Draw the changed state once, then park.
    if (!this.game.loop.running) this.game.loop.wake();
  }

  update(_time: number, elapsed: number) {
    if (!this.presentation) return;
    const delta = this.resumePending ? 0 : Math.min(elapsed, 150);
    this.resumePending = false;
    const { reducedMotion, disabled, paused = disabled, state, controlledActorId } = this.presentation;
    if (!paused && !reducedMotion) this.landmarkTime += delta;
    const landmarkFrame = Math.floor(this.landmarkTime / 80);
    if (this.landmarks && landmarkFrame !== this.landmarkFrame) {
      animateLandmarks(this.landmarks, this.landmarkTime, reducedMotion);
      this.landmarkFrame = landmarkFrame;
    }
    for (const view of this.views.values()) animateActor(view, delta, reducedMotion, paused);
    const actor = this.views.get(controlledActorId);
    if (actor && !paused) {
      const target = { x: actor.container.x, y: actor.container.y };
      this.cameraFocus = followPoint(this.cameraFocus ?? target, target, delta, reducedMotion);
      this.cameras.main.centerOn(this.cameraFocus.x, this.cameraFocus.y);
    }
    this.clampCamera();
    const heroSprites = state.actors.filter(hero => !hero.body || isBodyAlive(hero.body)).flatMap(hero => {
      const view = this.views.get(hero.id);
      return view ? [{ point: { x: view.container.x, y: view.container.y }, sprite: view.sprite, controlled: view.selected }] : [];
    });
    const heroes = heroSprites.map(hero => hero.point);
    this.mobs?.update(delta, reducedMotion, paused, heroes);
    const projection = this.cameraProjection();
    this.environment?.update({
      heroes, heroSprites,
      mobProbes: this.mobs?.occlusionProbes(),
      cursor: this.cursor,
      path: state.actors.find(item => item.id === controlledActorId)?.path ?? [],
      delta, reducedMotion,
      visibleBounds: visibleWorldBounds(projection),
      campfireLit: this.litCampfireIds.size > 0,
    });
    this.mobs?.updateVisibility({ heroes, viewport: visibleWorldBounds(projection),
      pointVisibility: (point, depth) => this.environment?.pointVisibility(point, depth) ?? 0 },
    disabled, this.presentation.previewGroupIds ?? []);
    if (this.presentation.inspectedGroupId && !this.mobs?.isGroupVisible(this.presentation.inspectedGroupId)) this.inspect(null);
    if (this.hoverPointer && !this.drag && !disabled && !this.hoverPointer.wasTouch) this.pointerMove(this.hoverPointer);
    this.lighting?.update({ heroes, campfires: this.campfires, projection, delta, reducedMotion });
    this.publishProjection();
    if (paused && !this.pausePending) {
      this.pausePending = true;
      this.game.events.once(Phaser.Core.Events.POST_RENDER, this.pauseWhenRequested, this);
    }
  }

  private resetCameraFocus() {
    if (!this.ready || !this.presentation) return;
    const actor = this.views.get(this.presentation.controlledActorId);
    if (!actor) return;
    this.cameraFocus = { x: actor.container.x, y: actor.container.y };
    this.cameras.main.centerOn(this.cameraFocus.x, this.cameraFocus.y);
    this.publishProjection();
  }

  private renderWorld(presentation: WorldPresentation, initial = false, controlledActorChanged = false, reset = false, enteringCombat = false) {
    const { state, controlledActorId } = presentation;
    const signature = `${state.graph.seed}:${state.graph.structureVersion ?? 1}:${state.currentChunkId}`;
    const changedChunk = initial || signature !== this.signature || state.chunk !== this.renderedChunk;
    const resetActors = changedChunk || reset;
    if (resetActors) {
      this.drag = undefined;
      this.hoverArt?.clear();
      this.poiLabel?.setVisible(false);
      this.cursor = undefined;
      this.tweens.killAll();
      this.views.forEach((view) => view.container.destroy());
      this.views.clear();
    }
    if (changedChunk) {
      this.regions = chunkRegions(state.chunk);
      this.environment?.destroy();
      this.background?.destroy();
      if (this.textureKey) this.textures.remove(this.textureKey);
      this.textureKey = `world-terrain:${++this.terrainSequence}`;
      createTerrainTexture(this, state.chunk, this.textureKey);
      this.background = this.add.image(0, 0, this.textureKey).setOrigin(0).setDepth(0);
      this.environment = createEnvironment(this, state.chunk);
      this.refreshCameraBounds();
      this.signature = signature;
      this.renderedChunk = state.chunk;
      this.hoverArt?.clear();
      this.cursor = undefined;
      this.poiLabel?.setVisible(false);
    }
    const firePois = state.chunk.pois.filter(poi => poi.kind === 'campfire');
    this.litCampfireIds = new Set(firePois.filter(poi => fireRemaining(poi.id, state.tick, presentation.campfires) > 0).map(poi => poi.id));
    this.campfires = firePois.filter(poi => this.litCampfireIds.has(poi.id)).map(poi => tileCenter(poi.position));
    const clearedSignature = `${presentation.groups !== undefined}:${presentation.clearedPoiIds.join('|')}:${[...this.litCampfireIds].join('|')}`;
    if (changedChunk || clearedSignature !== this.lastCleared) {
      this.landmarks?.destroy(true);
      this.landmarks = drawLandmarks(this, state.chunk, new Set(presentation.clearedPoiIds), presentation.groups !== undefined, this.litCampfireIds);
      this.landmarkFrame = -1;
      this.lastCleared = clearedSignature;
    }
    this.drawFireGauge();
    const presentActors = new Set(state.actors.map(actor => actor.id));
    for (const [id, view] of this.views) {
      if (presentActors.has(id)) continue;
      this.tweens.killTweensOf([view.container, view.sprite, view.marker]);
      view.container.destroy();
      this.views.delete(id);
    }
    for (const actor of state.actors) {
      const content = presentation.content ?? gameContent;
      const definition = content.characters.find(candidate => candidate.id === actor.id);
      let view = this.views.get(actor.id);
      if (!view) {
        view = createActorView(this, actor, undefined, definition);
        this.views.set(actor.id, view);
      }
      const terrain = state.chunk.tiles[actor.position.y * state.chunk.size + actor.position.x].terrain;
      const next = actor.path[0];
      const nextTerrain = next ? state.chunk.tiles[next.y * state.chunk.size + next.x].terrain : undefined;
      updateActorView(actor, view, actor.id === controlledActorId, resetActors || enteringCombat, terrain, nextTerrain, definition);
    }
    this.mobs?.sync(presentation.groups ?? [], state.chunk, resetActors || enteringCombat);
    if (resetActors) { this.hoverPointer = undefined; this.inspect(null); }
    if (resetActors || controlledActorChanged || enteringCombat) this.resetCameraFocus();
    this.drawPath();
  }

  private drawPath() {
    this.pathArt?.clear();
    this.destinationArt?.clear();
    const actor = this.presentation?.state.actors.find((item) => item.id === this.presentation?.controlledActorId);
    if (!actor?.path.length || !this.pathArt || !this.destinationArt) return;
    this.pathArt.fillStyle(0xf0d99b, 0.65);
    let previous = tileCenter(actor.position);
    for (const point of actor.path) {
      const centre = tileCenter(point);
      this.pathArt.fillCircle((previous.x + centre.x) / 2, (previous.y + centre.y) / 2, 1.5);
      this.pathArt.fillCircle(centre.x, centre.y, 2);
      previous = centre;
    }
    drawMovementCursor(this.destinationArt, actor.path.at(-1)!);
  }

  private drawFireGauge() {
    const art = this.fireGauge?.clear();
    const presentation = this.presentation;
    if (!art || !presentation?.campfires) return;
    for (const poi of presentation.state.chunk.pois) {
      if (poi.kind !== 'campfire') continue;
      const fire = presentation.campfires[poi.id];
      if (!fire) continue;
      const remaining = fireRemaining(poi.id, presentation.state.tick, presentation.campfires);
      const point = tileCenter(poi.position);
      art.fillStyle(0x111e22, .86).fillRoundedRect(point.x - 17, point.y + 17, 34, 5, 2);
      if (remaining > 0) art.fillStyle(remaining < .2 ? 0xca7954 : 0xdfb46b, .9)
        .fillRect(point.x - 15, point.y + 18, Math.max(1, Math.round(30 * remaining)), 2);
    }
  }

  private pointerTile(pointer: Phaser.Input.Pointer): GridPoint {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: Math.floor(point.x / TILE_SIZE), y: Math.floor(point.y / TILE_SIZE) };
  }

  private pointerDown(pointer: Phaser.Input.Pointer) {
    if (this.presentation?.disabled || !pointer.leftButtonDown()) return;
    this.drag = { x: pointer.x, y: pointer.y, moved: false };
    this.hoverArt?.clear();
    this.poiLabel?.setVisible(false);
    this.cursor = undefined;
  }

  private pointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.presentation || this.presentation.disabled) return;
    if (!pointer.wasTouch) this.hoverPointer = pointer;
    if (this.drag && pointer.isDown) {
      const dx = pointer.x - this.drag.x;
      const dy = pointer.y - this.drag.y;
      // A swipe cancels the tap; the camera continues following the hero.
      if (Math.hypot(dx, dy) > 8) this.drag.moved = true;
      this.hoverArt?.clear();
      this.poiLabel?.setVisible(false);
      this.cursor = undefined;
      return;
    }
    const point = this.pointerTile(pointer);
    this.cursor = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const mob = this.mobs?.inspect(this.cursor);
    if (!pointer.wasTouch) this.inspect(mob?.groupId ?? null);
    const { state, controlledActorId } = this.presentation;
    const chunk = state.chunk;
    this.hoverArt?.clear();
    this.poiLabel?.setVisible(false);
    if (mob) return;
    if (point.x < 0 || point.y < 0 || point.x >= chunk.size || point.y >= chunk.size || !this.hoverArt) return;
    const actor = state.actors.find(item => item.id === controlledActorId);
    const poi = interactivePoiAt(chunk, this.cursor, poi => this.environment?.isPoiVisible(poi) ?? false);
    if (poi) {
      const center = tileCenter(poi.position);
      drawMovementCursor(this.hoverArt, poi.position);
      this.poiLabel?.setText(poiLabel(poi, this.presentation.clearedPoiIds.includes(poi.id)))
        .setPosition(center.x, center.y - (poi.kind === 'portal' ? 61 : poi.kind === 'chest' ? 33 : 24)).setVisible(true);
      return;
    }
    const originRegion = actor && this.regions ? regionAt(chunk, this.regions, actor.position) : -1;
    const isFire = chunk.pois.some(poi => poi.kind === 'campfire' && poi.position.x === point.x && poi.position.y === point.y);
    if (isFire) {
      const firePoi = chunk.pois.find(candidate => candidate.kind === 'campfire')!;
      const fire = this.presentation.campfires?.[firePoi.id];
      const seconds = fire ? Math.max(0, Math.ceil((fire.expiresAtTick - state.tick) * MOVEMENT_TICK_MS / 1000)) : undefined;
      const title = seconds === undefined ? 'Костёр · подойти' : seconds <= 0 ? 'Костёр погас' : `Костёр · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      const center = tileCenter(firePoi.position);
      this.poiLabel?.setText(title).setPosition(center.x, center.y - 36).setVisible(true);
    }
    // A campfire is an interaction target, never a movement destination. The
    // client still sends a click on it to `approachCampfire`, which routes the
    // hero to a walkable neighbouring tile, but the cursor must communicate
    // that the fire footprint itself is blocked.
    const reachable = !isFire && originRegion >= 0 && this.regions && regionAt(chunk, this.regions, point) === originRegion;
    drawMovementCursor(this.hoverArt, point, !reachable);
  }

  private pointerUp(pointer: Phaser.Input.Pointer) {
    const drag = this.drag;
    this.drag = undefined;
    this.hoverArt?.clear();
    this.poiLabel?.setVisible(false);
    if (!drag || drag.moved || !this.presentation || this.presentation.disabled) return;
    if (Math.hypot(pointer.x - drag.x, pointer.y - drag.y) > 8) return;
    const point = this.pointerTile(pointer);
    const chunk = this.presentation.state.chunk;
    if (point.x < 0 || point.y < 0 || point.x >= chunk.size || point.y >= chunk.size) return;
    if (pointer.wasTouch) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const hit = this.mobs?.inspect(worldPoint);
      this.inspect(hit?.groupId ?? null);
      if (hit) { this.hoverArt?.clear(); return; }
    } else this.inspect(null);
    const poi = interactivePoiAt(chunk, this.cameras.main.getWorldPoint(pointer.x, pointer.y),
      poi => this.environment?.isPoiVisible(poi) ?? false);
    if (poi && this.presentation.canInteract && this.onInteract) {
      this.hoverArt?.clear();
      this.onInteract(poi.id);
      return;
    }
    this.onMove(point);
  }

  private inspect(groupId: string | null) {
    if (groupId === this.inspectedIntent) return;
    this.inspectedIntent = groupId;
    this.onInspectMob(groupId);
  }

  private resized() {
    this.refreshCameraBounds();
    if (this.cameraFocus) this.cameras.main.centerOn(this.cameraFocus.x, this.cameraFocus.y);
    this.publishProjection();
    if (this.ready && !this.game.loop.running) this.game.loop.wake();
  }

  private pauseWhenRequested() {
    this.pausePending = false;
    if (this.ready && this.presentation && (this.presentation.paused ?? this.presentation.disabled)) this.game.loop.sleep();
  }

  private refreshCameraBounds() {
    if (!this.presentation) return;
    const camera = this.cameras.main;
    const size = this.presentation.state.chunk.size * TILE_SIZE;
    // A short side is a reliable phone signal for portrait and landscape
    // layouts, without changing the desktop presentation on a resizable
    // window. Keep the zoom decision here so resize recalculates it too.
    const mobileViewport = Math.min(camera.width, camera.height) <= 600;
    camera.setZoom(worldCameraZoom(camera.width, camera.height, size, mobileViewport));
    camera.setBounds(0, 0, size, size);
    this.clampCamera();
  }

  private cameraProjection() {
    const camera = this.cameras.main;
    return { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom, width: camera.width, height: camera.height };
  }

  private clampCamera() {
    const camera = this.cameras.main;
    camera.scrollX = camera.clampX(camera.scrollX);
    camera.scrollY = camera.clampY(camera.scrollY);
  }

  private publishProjection() {
    this.clampCamera();
    const actor = this.views.get(this.presentation?.controlledActorId ?? '');
    const projection: WorldFrame = {
      ...this.cameraProjection(),
      actorX: actor?.container.x ?? 0, actorY: actor?.container.y ?? 0,
      actorFrames: JSON.stringify([...this.views].map(([id, view]) => ({
        id, x: view.container.x, y: view.container.y, depth: view.container.depth,
      }))),
      mobFrames: this.mobs?.frames() ?? '[]', inspectedGroupId: this.presentation?.inspectedGroupId ?? '',
      facing: actor?.facing ?? 'south', animationFrame: String(actor?.sprite.frame.name ?? ''),
      props: this.environment?.count ?? 0, occluded: this.environment?.occludedCount ?? 0,
      revealedRoofs: this.environment?.revealedRoofs ?? 0, exteriorReveals: this.environment?.exteriorReveals ?? 0,
    };
    const key = Object.values(projection).map(value => typeof value === 'number' ? value.toFixed(2) : value).join(':');
    if (key === this.lastProjection) return;
    this.lastProjection = key;
    this.onProjection(projection);
  }
}
