import type Phaser from 'phaser';
import type { GridPoint, NpcKind, Season, WorldChunk, WorldPoi, WorldStructure } from '@shards/shared';
import type { EnvironmentObject } from './environmentObject';
import type { Bounds } from './occlusion';
import { TILE_SIZE, tileCenter } from './projection';
import { ensureCampfireArt, FLAME_ANCHOR, FLAME_FRAME_MS, FLAME_FRAMES, FLAME_SIZE, flameTexture } from './campfireArt';
import { intersectsViewport } from './water';

export const npcNames: Record<NpcKind, string> = { merchant: 'Торговец', blacksmith: 'Кузнец', scribe: 'Начертатель' };

/** One geometry contract for the painted storefront, pointer target, label and flame light. */
export function npcWorldAnchors(chunk: WorldChunk, poi: WorldPoi) {
  if (poi.kind !== 'npc' || !poi.npcKind) return;
  const structure = chunk.structures.find(item => item.id === poi.structureId && item.kind === 'house' && item.npcKind === poi.npcKind);
  if (!structure) return;
  const left = structure.origin.x * TILE_SIZE, right = left + structure.width * TILE_SIZE;
  const front = (structure.origin.y + structure.height) * TILE_SIZE;
  const approach = tileCenter(structure.approach);
  const signRight = structure.approach.x - structure.origin.x < 2;
  return {
    structure,
    actor: { x: approach.x, y: front + 4 },
    facade: { x: left - 10, y: front - 92 },
    sign: { x: signRight ? right - 21 : left + 21, y: front - 52 },
    torch: { x: signRight ? left + 12 : right - 12, y: front - 24 },
    caption: { x: (left + right) / 2, y: front - 74 },
    hit: { x: left + 4, y: front - 66, width: right - left - 8, height: 87 } satisfies Bounds,
  };
}

export function npcTorchPositions(chunk: WorldChunk): GridPoint[] {
  return chunk.pois.flatMap(poi => {
    const anchors = npcWorldAnchors(chunk, poi);
    return anchors ? [anchors.torch] : [];
  });
}

const palettes: Record<NpcKind, { dark: number; cloth: number; light: number; trim: number }> = {
  merchant: { dark: 0x34242f, cloth: 0x783e4c, light: 0xa36766, trim: 0xd7b971 },
  blacksmith: { dark: 0x242d30, cloth: 0x655247, light: 0xa77c5b, trim: 0xd4a574 },
  scribe: { dark: 0x202c3b, cloth: 0x345c63, light: 0x749a98, trim: 0xd1bd82 },
};

function npcTexture(scene: Phaser.Scene, kind: NpcKind, variant: number, blink: boolean): string {
  const key = `service-npc:v1:${kind}:${variant}:${Number(blink)}`;
  if (scene.textures.exists(key)) return key;
  const art = scene.make.graphics({ x: 0, y: 0 });
  const p = palettes[kind];
  const rect = (x: number, y: number, width: number, height: number, color: number) => art.fillStyle(color).fillRect(x, y, width, height);
  const outline = 0x101d20, leather = 0x47382e, skin = variant % 2 ? 0xc49775 : 0xd6b08b;
  // Both feet share their leather palette; long legs and broad shoulders keep adult proportions.
  rect(12, 39, 9, 21, outline); rect(23, 39, 9, 21, outline);
  rect(14, 42, 6, 16, 0x45474b); rect(24, 42, 6, 16, 0x45474b);
  rect(11, 56, 10, 7, outline); rect(23, 56, 11, 7, outline);
  rect(12, 56, 8, 5, leather); rect(24, 56, 8, 5, leather);
  rect(12, 57, 8, 1, 0x8d7858); rect(24, 57, 8, 1, 0x8d7858);
  rect(10, 23, 24, 21, outline); rect(12, 24, 20, 18, p.cloth);
  rect(12, 24, 5, 17, p.light); rect(28, 24, 4, 17, p.dark);
  rect(8, 25, 6, 16, outline); rect(31, 25, 6, 16, outline);
  rect(9, 26, 5, 12, p.cloth); rect(32, 26, 4, 12, p.cloth);
  rect(9, 37, 5, 8, skin); rect(32, 37, 5, 8, skin);
  rect(11, 39, 23, 4, leather); rect(21, 39, 5, 4, p.trim); rect(22, 40, 3, 2, outline);
  rect(20, 20, 7, 6, 0xaa8064); rect(21, 20, 5, 4, skin);
  rect(15, 7, 16, 15, outline); rect(17, 9, 12, 12, skin);
  rect(15, 13, 3, 6, 0xaa8064); rect(28, 13, 3, 6, 0xaa8064);
  rect(17, 9, 4, 9, 0xe4c4a1); rect(27, 10, 2, 10, 0xb58a6c);
  rect(19, 13, 3, 1, 0x564038); rect(25, 13, 3, 1, 0x564038);
  rect(19, 15, 2, blink ? 1 : 2, outline); rect(26, 15, 2, blink ? 1 : 2, outline);
  rect(23, 16, 2, 3, 0xf0cfaa); rect(21, 20, 5, 1, 0x81554b);
  if (kind === 'merchant') {
    rect(14, 7, 18, 4, p.dark); rect(17, 3, 13, 6, p.cloth); rect(18, 3, 8, 2, p.light);
    rect(14, 10, 19, 2, p.trim); rect(28, 5, 3, 4, p.trim);
    rect(16, 25, 3, 11, p.trim); rect(26, 25, 2, 11, p.trim);
    rect(30, 41, 10, 11, outline); rect(31, 43, 8, 8, 0x947249); rect(33, 41, 4, 3, p.trim);
    rect(34, 45, 3, 4, 0xe7c576); rect(16, 19, 3, 4, 0x735144);
  } else if (kind === 'blacksmith') {
    rect(15, 6, 16, 5, 0x49382f); rect(17, 5, 12, 3, 0x766253);
    rect(18, 20, 10, 4, 0x634632); rect(20, 23, 6, 2, 0x8c664a);
    rect(17, 26, 12, 19, 0x9a6543); rect(17, 27, 3, 14, 0xbb875b);
    rect(19, 28, 7, 1, p.trim); rect(20, 33, 6, 6, 0x654334);
    rect(33, 29, 3, 16, 0x967044); rect(28, 26, 12, 6, 0x9ba7a2); rect(28, 26, 12, 2, 0xd7d7be);
    rect(31, 37, 6, 5, skin); rect(9, 26, 5, 10, skin);
  } else {
    rect(14, 5, 18, 8, p.dark); rect(17, 3, 12, 5, p.cloth); rect(15, 10, 4, 14, p.cloth);
    rect(28, 10, 4, 14, p.cloth); rect(17, 7, 12, 3, p.trim);
    rect(13, 42, 8, 11, p.cloth); rect(23, 42, 8, 11, p.cloth); rect(13, 50, 8, 2, p.trim); rect(23, 50, 8, 2, p.trim);
    rect(6, 40, 14, 11, 0xe2d2a6); rect(5, 40, 3, 11, 0xae9973); rect(19, 40, 3, 11, 0xae9973);
    rect(9, 43, 8, 1, 0x5a7470); rect(9, 46, 6, 1, 0x5a7470);
    art.fillStyle(0xdbd9bb).fillTriangle(34, 36, 36, 25, 40, 25);
    rect(34, 34, 2, 8, p.trim); rect(32, 39, 5, 4, skin);
  }
  art.generateTexture(key, 44, 64); art.destroy();
  return key;
}

function serviceEmblem(art: Phaser.GameObjects.Graphics, kind: NpcKind, x: number, y: number) {
  art.fillStyle(palettes[kind].trim);
  if (kind === 'merchant') {
    art.fillRect(x - 6, y - 4, 12, 3).fillRect(x - 6, y + 1, 12, 3).fillRect(x - 4, y + 6, 8, 2);
    art.fillStyle(0xf5e4a3).fillRect(x - 4, y - 4, 7, 1).fillRect(x - 4, y + 1, 7, 1);
  } else if (kind === 'blacksmith') {
    art.fillRect(x - 7, y - 4, 14, 4).fillTriangle(x - 7, y - 4, x - 12, y - 4, x - 7, y);
    art.fillRect(x - 3, y, 6, 5).fillRect(x - 7, y + 5, 14, 3);
  } else {
    art.fillTriangle(x - 6, y + 7, x + 3, y - 9, x + 8, y - 7);
    art.fillRect(x - 7, y + 6, 2, 4).fillRect(x - 5, y + 9, 12, 1);
  }
}

function facadeTexture(scene: Phaser.Scene, structure: WorldStructure, season: Season): string {
  const kind = structure.npcKind!;
  const key = `service-facade:v1:${kind}:${season}:${structure.variant}:${structure.width}`;
  if (scene.textures.exists(key)) return key;
  const art = scene.make.graphics({ x: 0, y: 0 }), p = palettes[kind];
  const width = structure.width * TILE_SIZE + 20;
  const door = 1 + structure.variant % 2, actorX = 10 + (door + .5) * TILE_SIZE;
  const signRight = door < 2, signX = signRight ? width - 31 : 31, torchX = signRight ? 22 : width - 22;
  art.fillStyle(0x091711, .55).fillEllipse(actorX, 99, 29, 10);
  // Cloth awning, stitched valance and brass corner caps distinguish these from abandoned houses.
  art.fillStyle(0x1b2825).fillRect(6, 45, width - 12, 20);
  for (let x = 8, index = 0; x < width - 8; x += 16, index++) {
    art.fillStyle(index % 2 ? p.cloth : p.dark).fillRect(x, 47, Math.min(16, width - 8 - x), 15);
    art.fillStyle(p.light, .5).fillRect(x + 1, 48, Math.min(13, width - 10 - x), 2);
  }
  art.fillStyle(p.trim).fillRect(8, 62, width - 16, 2).fillRect(6, 45, 3, 18).fillRect(width - 9, 45, 3, 18);
  if (season === 'winter') art.fillStyle(0xc2d8d4, .82).fillRect(9, 44, width - 18, 3);
  // Hanging sign and a freestanding torch share the world-anchor geometry above.
  art.fillStyle(0x302925).fillRect(signX - 2, 15, 4, 12).fillRect(signX - 14, 26, 28, 30);
  art.fillStyle(p.trim).fillRect(signX - 13, 27, 26, 1).fillRect(signX - 13, 54, 26, 1);
  art.fillStyle(p.dark).fillRect(signX - 11, 29, 22, 23);
  serviceEmblem(art, kind, signX, 39);
  art.fillStyle(0x473b2c).fillRect(torchX - 2, 69, 4, 26).fillRect(torchX - 6, 93, 12, 4);
  art.fillStyle(0x9b8155).fillRect(torchX - 1, 70, 1, 22).fillRect(torchX - 5, 65, 10, 5);
  art.fillStyle(0xe0a063).fillRect(torchX - 4, 66, 8, 1);
  const workX = signRight ? width - 49 : 18;
  if (kind === 'merchant') {
    art.fillStyle(0x664b34).fillRect(workX, 79, 31, 21);
    art.fillStyle(0xad8454).fillRect(workX, 79, 31, 4).fillRect(workX + 3, 84, 2, 15).fillRect(workX + 25, 84, 2, 15);
    art.fillStyle(0xc09b63).fillRect(workX + 9, 85, 10, 7);
    art.fillStyle(0x644956).fillRect(workX + 5, 73, 13, 6);
    art.fillStyle(0xd6ba76).fillRect(workX + 19, 74, 7, 4);
  } else if (kind === 'blacksmith') {
    art.fillStyle(0x493f35).fillRect(workX + 3, 90, 27, 10);
    art.fillStyle(0x58686b).fillRect(workX + 9, 84, 12, 10).fillRect(workX + 1, 78, 28, 7).fillTriangle(workX + 1, 78, workX - 7, 78, workX + 1, 84);
    art.fillStyle(0xa9b3a6).fillRect(workX + 2, 78, 26, 2);
    art.fillStyle(0xbd733a).fillRect(workX + 13, 76, 10, 2);
  } else {
    art.fillStyle(0x4c3c30).fillRect(workX, 85, 32, 5).fillRect(workX + 3, 89, 4, 13).fillRect(workX + 26, 89, 4, 13);
    art.fillStyle(0xc6b991).fillRect(workX + 3, 79, 12, 6).fillRect(workX + 16, 79, 11, 6);
    art.fillStyle(0x849486).fillRect(workX + 5, 81, 8, 1).fillRect(workX + 18, 81, 7, 1);
    art.fillStyle(0x678087).fillRect(workX + 28, 76, 5, 9);
  }
  art.generateTexture(key, width, 112); art.destroy();
  return key;
}

/** Static art uses cached pixel textures; only a small shared flame bank changes per frame. */
export function createNpcServices(scene: Phaser.Scene, chunk: WorldChunk) {
  const objects: EnvironmentObject[] = [];
  const services = chunk.pois.flatMap(poi => {
    const anchors = npcWorldAnchors(chunk, poi);
    if (!anchors || !poi.npcKind) return [];
    const kind = poi.npcKind, variant = anchors.structure.variant;
    ensureCampfireArt(scene);
    const facade = scene.add.image(anchors.facade.x, anchors.facade.y, facadeTexture(scene, anchors.structure, chunk.season))
      .setOrigin(0).setDepth(10 + anchors.actor.y + .1);
    const actor = scene.add.image(anchors.actor.x, anchors.actor.y, npcTexture(scene, kind, variant, false))
      .setOrigin(.5, 1).setDepth(10 + anchors.actor.y + .2);
    const blinking = npcTexture(scene, kind, variant, true), resting = actor.texture.key;
    const flame = scene.add.image(anchors.torch.x, anchors.torch.y, flameTexture(variant * 3 % FLAME_FRAMES))
      .setOrigin(FLAME_ANCHOR.x / FLAME_SIZE.width, FLAME_ANCHOR.y / FLAME_SIZE.height).setScale(.56)
      .setDepth(10 + anchors.actor.y + .3);
    const facadeBounds = { ...anchors.facade, width: facade.width, height: facade.height };
    const actorBounds = { x: anchors.actor.x - 22, y: anchors.actor.y - 64, width: 44, height: 64 };
    for (const [image, bounds] of [[facade, facadeBounds], [actor, actorBounds]] as const) objects.push({ images: [image],
      occluder: { base: anchors.actor, bounds, silhouettes: [bounds], revealable: false } });
    return [{ anchors, actor, flame, blinking, resting, frame: -1, blink: false, offset: variant * 3, bounds: facadeBounds }];
  });
  let elapsed = 0;
  return {
    objects,
    count: services.length,
    update(delta: number, reduced: boolean, viewport?: Bounds) {
      if (!reduced && Number.isFinite(delta)) elapsed += Math.max(0, Math.min(delta, 150));
      for (const service of services) {
        const visible = intersectsViewport(service.bounds, viewport);
        service.flame.setVisible(visible);
        if (!visible) continue;
        const frame = reduced ? service.offset % FLAME_FRAMES : (Math.floor(elapsed / FLAME_FRAME_MS) + service.offset) % FLAME_FRAMES;
        if (frame !== service.frame) { service.flame.setTexture(flameTexture(frame)); service.frame = frame; }
        const blink = !reduced && (elapsed + service.offset * 271) % 4100 < 130;
        if (blink !== service.blink) { service.actor.setTexture(blink ? service.blinking : service.resting); service.blink = blink; }
      }
    },
    // Environment owns facade/actor images through objects; only flames are private.
    destroy() { for (const service of services) service.flame.destroy(); services.length = 0; },
  };
}
