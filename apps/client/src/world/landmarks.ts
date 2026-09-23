import Phaser from 'phaser';
import type { WorldChunk } from '@shards/shared';
import { tileCenter } from './projection';
import { drawChest, drawPortalFrame, drawPortalVeil, drawStairs } from './poiArt';

interface PortalArt { art: Phaser.GameObjects.Graphics; x: number; y: number }

export function animateLandmarks(group: Phaser.GameObjects.Container, time: number, reducedMotion: boolean): void {
  const portals = group.getData('portals') as PortalArt[] | undefined;
  for (const portal of portals ?? []) {
    portal.art.clear();
    drawPortalVeil(portal.art, portal.x, portal.y, reducedMotion ? 0 : time / 1000);
  }
}

export function drawLandmarks(scene: Phaser.Scene, chunk: WorldChunk, cleared: Set<string>, roaming = false, litCampfires?: ReadonlySet<string>): Phaser.GameObjects.Container {
  const group = scene.add.container(0, 0).setDepth(2);
  const portals: PortalArt[] = [];
  const art = scene.add.graphics();
  group.add(art);
  for (const poi of chunk.pois) {
    const { x, y } = tileCenter(poi.position);
    if (poi.kind === 'campfire') {
      const lit = !litCampfires || litCampfires.has(poi.id);
      if (lit) art.fillStyle(0xffb769, 0.09).fillCircle(x, y, 36);
      art.fillStyle(0x1c2a22, 0.7).fillEllipse(x, y + 5, 27, 12);
      art.fillStyle(0x6c6851).fillRect(x - 12, y + 3, 5, 5).fillRect(x + 8, y + 3, 5, 5).fillRect(x - 5, y + 8, 12, 4);
      art.fillStyle(0x775436).fillRect(x - 8, y + 2, 17, 4);
      // Flames and smoke are animated by the environment above this static hearth.
      art.fillStyle(lit ? 0xa14d2e : 0x424842).fillRect(x - 5, y + 2, 11, 3);
      art.fillStyle(lit ? 0xe99b4f : 0x777d73).fillRect(x - 3, y + 3, 3, 1).fillRect(x + 3, y + 2, 2, 1);
    } else if (poi.kind === 'encounter') {
      if (roaming) continue;
      const done = cleared.has(poi.id);
      art.fillStyle(done ? 0xb6c49a : 0xd7a36f, done ? 0.12 : 0.14).fillCircle(x, y, 21);
      if (done) {
        art.lineStyle(2, 0xb6c49a, 0.8).beginPath().moveTo(x - 5, y).lineTo(x - 1, y + 4).lineTo(x + 7, y - 5).strokePath();
      } else {
        art.fillStyle(0x201f1a).fillRect(x - 11, y - 7, 22, 14);
        art.fillStyle(0xc6b391).fillRect(x - 7, y - 10, 14, 13).fillRect(x - 4, y + 3, 8, 4);
        art.fillStyle(0x3f362a).fillRect(x - 5, y - 5, 3, 4).fillRect(x + 2, y - 5, 3, 4);
        art.fillStyle(0xd5905d).fillRect(x - 9, y + 10, 18, 2);
      }
    } else if (poi.kind === 'portal') {
      const veil = scene.add.graphics();
      group.add(veil);
      portals.push({ art: veil, x, y });
      const frame = scene.add.graphics();
      group.add(frame);
      drawPortalFrame(frame, x, y);
    } else if (poi.kind === 'chest') {
      drawChest(art, x, y, cleared.has(poi.id));
    } else if (poi.kind === 'stairs-down' || poi.kind === 'stairs-up') {
      drawStairs(art, x, y, poi.kind === 'stairs-up');
    } else if (poi.kind === 'well') {
      const used = cleared.has(poi.id);
      art.lineStyle(1, used ? 0x7f8d85 : 0xb2d2c3, used ? .35 : .75).strokeEllipse(x, y + 3, 23, 8);
      art.fillStyle(used ? 0x788c81 : 0xb1e0d7, used ? .4 : .85)
        .fillTriangle(x, y - 5, x - 3, y, x + 3, y).fillRect(x - 2, y, 4, 2);
    } else if (poi.kind === 'altar') {
      art.fillStyle(0xa6dad3, 0.12).fillCircle(x, y - 6, 33);
      art.fillStyle(0x465b57).fillRect(x - 17, y + 7, 34, 8).fillRect(x - 13, y + 1, 26, 9);
      art.fillStyle(0x8da69a).fillRect(x - 12, y - 2, 24, 5).fillRect(x - 9, y - 21, 5, 20).fillRect(x + 4, y - 21, 5, 20);
      art.fillStyle(0xbfceae).fillRect(x - 13, y - 24, 26, 5);
      art.fillStyle(0xc4e9cd).fillTriangle(x, y - 19, x - 4, y - 10, x + 4, y - 10);
      art.fillStyle(0x7caeac).fillTriangle(x, y - 4, x - 4, y - 10, x + 4, y - 10);
    }
  }
  group.setData('portals', portals);
  animateLandmarks(group, 0, true);
  return group;
}
