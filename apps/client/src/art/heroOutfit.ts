import { drawHead } from './humanoidSprites';
import { PixelCanvas } from './pixelCanvas';
import type { UnitPalette } from './unitPalette';
import type { UnitFacing, UnitPose } from './unitPose';

export const HERO_ART_IDS = ['guardian', 'vampire', 'paladin', 'priest', 'druid', 'necromancer', 'rogue', 'ranger', 'mage'] as const;
export const armoredHero = (id: string) => id === 'guardian' || id === 'paladin';

export function heroHalfWidth(id: string, side: boolean): number {
  if (id === 'paladin') return side ? 4 : 5;
  if (id === 'rogue' || id === 'ranger') return side ? 2 : 3;
  return side ? 3 : 4;
}

/** Head details remain attached to the head and disappear together with it. */
export function drawHeroHead(art: PixelCanvas, id: string, cx: number, y: number, facing: UnitFacing, pose: UnitPose, p: UnitPalette) {
  const side = facing === 'east';
  const back = facing === 'north';
  drawHead(art, id === 'paladin' ? 'guardian' : id, cx, y, facing, pose, p);
  const crown = Math.max(4, y - 2);
  if (id === 'vampire') {
    art.line(cx - 3, y + 1, cx, y + 2, '#24232e');
    art.line(cx, y + 2, cx + 2, y, '#24232e');
    art.line(cx - 5, y + 4, cx - 3, y + 7, p.clothLight, 2);
    if (!side) art.line(cx + 4, y + 4, cx + 3, y + 7, p.clothLight, 2);
    if (!back) {
      if (!pose.blink) art.point(side ? cx + 2 : cx - 1, y + 3, '#e16b7b');
      art.point(cx + (side ? 3 : 0), y + 5, '#fbebdf');
    }
  } else if (id === 'paladin') {
    art.rect(cx - 1, crown, 3, 3, p.trim);
    art.line(cx - 4, y + 1, cx - 5, crown, p.light);
    if (!side) art.line(cx + 4, y + 1, cx + 5, crown, p.light);
    if (!back) {
      art.rect(cx - 2, y + 2, side ? 5 : 6, 1, p.shade);
      art.rect(cx, y + 1, 1, 5, p.trim);
    }
  } else if (id === 'druid') {
    art.line(cx - 2, y + 1, cx - 5, crown, '#ad9867', 2);
    art.line(cx - 5, crown + 1, cx - 6, crown - 1, '#d7c18e');
    if (!side) art.line(cx + 2, y + 1, cx + 5, crown, '#ad9867', 2);
    art.rect(cx - 3, y, side ? 4 : 7, 2, p.clothLight);
    art.point(cx - 2, y - 1, '#c6d47d');
    if (!back) art.rect(cx + (side ? 1 : -1), y + 5, side ? 3 : 4, 2, '#966846');
  } else if (id === 'necromancer' || id === 'rogue' || id === 'ranger') {
    const hood = id === 'necromancer' ? p.main : p.cloth;
    art.rect(cx - 4, y, 2, 7, hood);
    if (!side) art.rect(cx + 3, y, 2, 7, hood);
    art.rect(cx - 3, y - 1, side ? 5 : 7, 2, p.clothLight);
    if (back) art.rect(cx - 2, y + 1, 5, 5, hood);
    else if (id === 'rogue') {
      art.rect(cx + (side ? 0 : -2), y + 4, side ? 4 : 5, 2, '#4b5269');
      art.point(cx + (side ? 2 : -1), y + 3, '#ccd6d2');
    } else if (id === 'necromancer') {
      art.rect(cx + (side ? 0 : -2), y + 2, side ? 4 : 5, 4, '#d7d4b4');
      art.point(cx + (side ? 2 : -1), y + 3, '#62bc97');
      if (!side) art.point(cx + 2, y + 3, '#62bc97');
      art.point(cx + 1, y + 5, p.outline);
    }
    if (id === 'ranger') {
      art.line(cx - 2, y, cx - 4, crown, '#c1c9a2', 2);
      art.point(cx - 5, crown, '#8b9972');
    }
  }
}

export function drawHeroTorso(art: PixelCanvas, id: string, cx: number, y: number, half: number, back: boolean, p: UnitPalette, height = 8) {
  const armored = armoredHero(id);
  art.rect(cx - half, y, half * 2 + 1, height, p.outline);
  art.rect(cx - half + 1, y, half * 2 - 1, height - 1, armored ? p.main : p.cloth);
  art.rect(cx - half + 1, y + 1, 2, height - 3, armored ? p.light : p.clothLight);
  if (back) art.rect(cx - half + 1, y + 1, half * 2 - 1, height - 2, p.cloth);
  else art.rect(cx, y + height - 2, 2, 1, p.trim);
  if (id === 'priest' || id === 'mage' || id === 'necromancer') art.rect(cx - 1, y + 1, 2, height - 1, back ? p.clothLight : p.trim);
  if (id === 'paladin') {
    art.rect(cx - half - 1, y, 3, 3, p.trim);
    art.rect(cx + half - 1, y, 3, 3, p.trim);
    art.rect(cx, y + 2, 1, 4, p.light);
    art.rect(cx - 1, y + 3, 3, 1, p.light);
  } else if (id === 'vampire') {
    art.line(cx - half, y, cx, y + 4, p.clothLight);
    art.line(cx + half, y, cx, y + 4, p.clothLight);
    art.point(cx, y + 2, '#d8718a');
  } else if (id === 'druid') {
    for (const sign of [-1, 1]) {
      art.line(cx + sign * half, y, cx + sign * (half + 1), y + 3, p.clothLight, 2);
      art.point(cx + sign * (half - 1), y + 4, p.trim);
    }
  } else if (id === 'rogue' || id === 'ranger') {
    art.line(cx - half + 1, y + 1, cx + half - 1, y + height - 3, id === 'rogue' ? '#99758b' : '#a88a54');
    art.rect(cx - half + 1, y + height - 2, half * 2 - 1, 1, '#574734');
    if (id === 'rogue') art.rect(cx - 1, y, 4, 2, '#7b445b');
  }
}
