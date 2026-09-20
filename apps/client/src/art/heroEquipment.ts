import type { HeroLimb } from './heroAppearance';
import { PixelCanvas } from './pixelCanvas';
import type { UnitPalette } from './unitPalette';
import { UNIT_FOOT_Y, type UnitPose } from './unitPose';

export interface HeroHand { x: number; y: number; limb: HeroLimb }

function staff(art: PixelCanvas, id: string, x: number, y: number, p: UnitPalette, crawling: boolean) {
  const topY = Math.max(4, crawling ? y - 4 : y - 12);
  const topX = crawling ? x - 6 : x;
  art.line(x, Math.min(UNIT_FOOT_Y - 1, y + 3), topX, topY + 2, '#8d734b');
  art.line(x + 1, Math.min(UNIT_FOOT_Y - 1, y + 2), topX + 1, topY + 3, '#483b2f');
  if (id === 'druid') {
    art.line(topX, topY + 3, topX - 2, topY, p.clothLight, 2);
    art.line(topX + 1, topY + 3, topX + 3, topY + 1, p.trim);
    art.rect(topX - 3, topY, 3, 2, '#a5c55f');
    art.rect(topX + 2, topY + 1, 3, 2, '#6f9f53');
  } else if (id === 'necromancer') {
    art.rect(topX - 2, topY, 5, 4, '#d7d4b4');
    art.rect(topX - 1, topY + 1, 1, 1, p.outline);
    art.rect(topX + 1, topY + 1, 1, 1, p.outline);
    art.point(topX, topY + 3, p.shade);
  } else {
    art.rect(topX - 1, topY, 3, 5, p.trim);
    art.rect(topX - 2, topY + 1, 5, 2, p.trim);
    art.point(topX, topY + 1, '#fff0bd');
  }
}

/** Every prop belongs to a surviving anatomical hand, including carried foci. */
export function drawHeroItem(art: PixelCanvas, id: string, hand: HeroHand, pose: UnitPose, p: UnitPalette, crawling = false) {
  const { x, limb } = hand;
  const y = Math.min(hand.y, crawling ? 25 : 24);
  const left = limb === 'leftArm';
  const casting = pose.motion === 'cast';
  if (id === 'guardian') {
    if (left) {
      art.rect(x - 2, y - 4, 5, 7, p.outline);
      art.rect(x - 1, y - 4, 3, 6, '#788d91');
      art.rect(x - 1, y - 3, 2, 4, p.cloth);
      art.point(x, y - 2, p.trim);
    } else {
      const tipX = x + (crawling ? -5 : pose.reach > 0 ? 3 : 0);
      const tipY = y - (crawling ? 2 : 8);
      art.line(x, y - 1, tipX, tipY, '#d0d4bf');
      art.point(tipX, tipY - 1, '#788d91');
      art.rect(x - 1, y - 2, 3, 1, p.trim);
    }
  } else if (id === 'paladin') {
    if (left) {
      art.rect(x - 2, y - 5, 5, 6, p.trim);
      art.rect(x - 1, y - 4, 3, 6, p.light);
      art.line(x - 2, y, x, y + 2, p.trim);
      art.line(x + 2, y, x, y + 2, p.trim);
      art.line(x, y - 4, x, y, p.main);
      art.rect(x - 1, y - 3, 3, 1, p.main);
    } else {
      const headY = y - (crawling ? 3 : 7);
      art.line(x, y, x + 1, headY, '#785a3b', 2);
      art.rect(x - 2, headY - 2, 7, 4, p.trim);
      art.rect(x - 1, headY - 2, 5, 2, p.light);
      art.point(x + 1, headY, '#ffffff');
    }
  } else if (id === 'vampire') {
    if (left) {
      art.line(x, y - 2, x, y + 2, '#b6a29b');
      art.rect(x - 1, y, 3, 3, '#632139');
      art.point(x, y + 1, '#f28a9b');
    } else {
      art.line(x, y, x - 1, y - 5, '#72435d', 2);
      art.line(x - 2, y - 5, x + 3, y - 6, '#dbd5d0');
      art.line(x + 3, y - 6, x + 4, y - 3, '#b9a6b2');
      art.point(x + 3, y - 2, '#dbd5d0');
    }
  } else if (['priest', 'druid', 'necromancer'].includes(id)) {
    if (!left) staff(art, id, x, y, p, crawling);
    else if (id === 'priest') {
      art.rect(x, y - 3, 1, 5, p.trim);
      art.rect(x - 1, y - 2, 3, 1, p.light);
    }
    else if (id === 'druid') {
      art.rect(x - 1, y - 1, 3, 3, '#9b7246');
      art.rect(x, y - 3, 3, 2, '#8ead57');
      art.point(x + 1, y - 2, '#d7cf7e');
    } else if (id === 'necromancer') {
      art.rect(x - 1, y - 2, 3, 4, '#d7d4b4');
      art.point(x, y - 1, '#6ba895');
      art.point(x, y + 1, p.outline);
    }
  } else if (id === 'rogue') {
    const extension = Math.max(0, pose.reach);
    art.line(x, y, x + (left ? -2 : 2) * (crawling ? 2 : 1), y - 4 - extension, '#b7d2d3');
    art.rect(x - 1, y - 1, 3, 1, '#95768b');
    art.point(x, y + 1, '#554755');
  } else if (id === 'ranger') {
    if (left) {
      art.rect(x - 1, y - 4, 3, 6, '#614833');
      art.rect(x, y - 4, 1, 5, '#9a774a');
      for (const dx of [-1, 1]) {
        art.line(x + dx, y - 2, x + dx, y - 8, '#cabb8a');
        art.point(x + dx - 1, y - 8, '#c6d4b0');
      }
    } else {
      const top = y - (crawling ? 7 : 9);
      const bottom = Math.min(26, y + 2);
      art.line(x, top, x + 3, top + 3, '#bf965c', 2);
      art.line(x + 3, top + 3, x + 3, bottom - 3, '#bf965c', 2);
      art.line(x + 3, bottom - 3, x, bottom, '#bf965c', 2);
      art.line(x, top, x, bottom, '#ddd3a6');
      if (pose.motion === 'attack' || casting) {
        art.line(x - 3, y - 3, x + 5, y - 3, '#cabb8a');
        art.point(x + 5, y - 4, '#e0e2c1');
      }
    }
  } else if (id === 'mage') {
    if (left) {
      art.rect(x - 2, y - 3, 5, 5, p.shade);
      art.rect(x - 1, y - 3, 3, 4, '#d8c59e');
      art.line(x, y - 2, x, y, '#997453');
      art.point(x + 2, y + 1, p.trim);
    } else {
      const flicker = pose.frame % 3;
      art.line(x, y + 1, x + 1, y - 3, '#986348');
      art.rect(x, y - 3, 3, 2, '#d87843');
      art.rect(x + 1, y - 5 - flicker, 2, 4 + flicker, '#ff9c51');
      art.rect(x + 1, y - 4, 1, 2, '#ffe1a0');
    }
  }
  if (casting && pose.frame > 0 && pose.frame < 4) {
    const radius = pose.frame === 2 ? 4 : 3;
    art.point(x - radius, y - radius, p.trim);
    art.point(x + radius, y - radius - 1, p.light);
    if (pose.frame === 2) art.point(x + 1, y - radius - 3, p.trim);
  }
}
