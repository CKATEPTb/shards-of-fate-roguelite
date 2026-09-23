import { equipmentMaterial, heroMaterial, partPainter, type HeroMaterial } from './heroPartEquipment';
import type { HeroRig } from './heroRigTypes';
import type { PixelCanvas } from './pixelCanvas';
import { equipmentAccents, equipmentIsPlate, equipmentStyle, equipmentTheme } from './heroEquipmentTheme';

type HeadPainter = ReturnType<typeof partPainter>;

function profileFace(d: HeadPainter, id: string, skin: HeroMaterial, covered: boolean, blink: boolean) {
  // A separate neck, level crown and jaw corner keep the skull off an oval.
  d.shape([[-3, 3], [1, 3], [1, 7], [-3, 7]], skin.skinShadow);
  d.rect(-1, 4, 2, 3, skin.skin);
  d.shape([[-5, -3], [-3, -5], [1, -5], [3, -4], [4, -2], [4, -1],
    [6, 0], [6, 1], [4, 1], [4, 4], [2, 5], [-1, 5], [-4, 3], [-5, 1]], skin.dark);
  d.shape([[-4, -3], [-2, -4], [1, -4], [3, -3], [3, -1], [5, 0],
    [3, 1], [3, 4], [1, 4], [-2, 3], [-4, 1]], skin.skinShadow);
  d.shape([[-1, -3], [2, -3], [3, -2], [3, -1], [5, 0], [3, 1],
    [3, 3], [1, 4], [0, 3], [-1, 1]], skin.skin);
  // Face polygons sample pixel centres. Use cells for facial details too:
  // a rounded point at x=3 touched the east outline but sat inside the west face.
  d.rect(1, -2, 3, 1, skin.hair);
  d.rect(2, -1, 1, 1, blink ? skin.skinShadow : id === 'vampire' ? '#773941' : id === 'necromancer' ? '#48685b' : '#29312b');
  d.point(5, 0, skin.skin);
  d.line(2, 2, 3, 2, skin.skinShadow);
  d.point(2, 3, skin.skin);
  if (['guardian', 'paladin', 'druid', 'mage'].includes(id)) {
    d.shape([[-2, 1], [-1, 2], [1, 3], [3, 2], [4, 3], [3, 5], [0, 5], [-2, 3]], skin.hair);
    d.line(2, 2, 3, 2, skin.skinShadow);
  }
  if (!covered) {
    // Solid hair mass, a squared nape and a small ear; no skin-coloured scalp patch.
    d.shape([[-5, -3], [-3, -5], [2, -5], [3, -4], [3, -3], [1, -3],
      [0, -2], [-2, -2], [-2, 0], [-3, 1], [-3, 3], [-5, 2]], skin.dark);
    d.shape([[-4, -3], [-2, -4], [2, -4], [1, -3], [-1, -2], [-3, -2],
      [-3, 0], [-4, 1]], skin.hair);
    d.line(-4, 0, -4, 2, skin.hair);
    d.shape([[-2, -1], [0, -1], [0, 2], [-1, 2], [-2, 1]], skin.skinShadow);
    d.line(-1, 0, -1, 1, skin.skin);
    if (id === 'priest' || id === 'vampire') {
      d.shape([[-5, 0], [-3, 1], [-3, 6], [-4, 7], [-6, 6], [-5, 4]], skin.dark);
      d.line(-4, 2, -4, 6, skin.hair);
    }
  }
}

/** One opening faces forward; the near cloth panel wraps the temple and nape. */
function profileHood(d: HeadPainter, id: string, p: HeroMaterial) {
  d.shape([[-6, -4], [-4, -6], [1, -6], [4, -4], [4, -3], [1, -3],
    [0, -1], [0, 3], [1, 5], [3, 5], [2, 7], [-3, 7], [-3, 5], [-6, 4]], p.dark);
  d.shape([[-5, -4], [-3, -5], [1, -5], [2, -4], [0, -4],
    [-1, -1], [-1, 3], [0, 5], [1, 6], [-2, 6], [-2, 4], [-5, 3]], p.cloth);
  // Crown, side plane and lower fold define a turned volume, not a face-shaped ring.
  d.shape([[-5, -4], [-3, -5], [0, -5], [-1, -4], [-3, -3],
    [-4, -1], [-4, 2], [-5, 2]], p.fold);
  d.shape([[-3, -3], [-1, -3], [-2, 0], [-1, 4], [1, 6], [-2, 6], [-4, 4], [-4, 0]], p.shadow);
  d.line(0, -4, -1, -1, p.fold);
  d.line(-1, -1, -1, 3, p.fold);
  d.line(-1, 3, 1, 5, p.fold);
  d.line(-5, 4, -3, 6, p.fold);
  if (id === 'night-stalker') {
    d.shape([[0, 2], [3, 2], [5, 1], [5, 4], [3, 6], [0, 6], [-1, 4]], p.shadow);
    d.shape([[0, 3], [3, 3], [4, 2], [4, 4], [2, 5], [0, 5]], p.cloth);
    d.line(0, 3, 3, 3, p.fold);
  } else if (id === 'ivory-pilgrim') {
    d.shape([[-5, 1], [-3, 2], [-2, 5], [0, 7], [-3, 8], [-5, 5]], '#969b7d');
    d.shape([[-5, 1], [-4, 2], [-3, 5], [-1, 7], [-3, 7], [-5, 4]], '#c7c5a6');
  }
}

function profileHelmet(d: HeadPainter, id: string, p: HeroMaterial) {
  d.shape([[-6, -3], [-4, -6], [1, -6], [3, -5], [4, -3], [5, -1],
    [1, -1], [0, 1], [0, 4], [-2, 5], [-5, 4], [-6, 2]], p.shadow);
  d.shape([[-5, -3], [-3, -5], [1, -5], [2, -4], [3, -2], [-1, -2],
    [-2, 1], [-2, 3], [-4, 3], [-5, 1]], p.metal);
  d.shape([[-5, -2], [-4, -4], [-2, -5], [0, -5], [-1, -3], [-3, -2], [-4, 1]], p.edge);
  // The brow ends above the visible eye; only the near cheek guard covers the ear.
  d.line(-1, -2, 4, -2, p.edge);
  d.shape([[-3, -1], [-1, -1], [0, 1], [1, 4], [-1, 6], [-4, 4]], p.shadow);
  d.shape([[-3, 0], [-1, 0], [-1, 2], [0, 4], [-1, 5], [-3, 3]], p.metal);
  d.line(-3, 0, -2, 3, p.edge);
  d.line(-5, 4, -3, 5, p.edge);
  if (id === 'dawn-forged') {
    d.line(1, -5, 3, -3, p.trim);
    d.line(0, -2, 4, -2, p.trim);
    d.point(2, -4, '#e2d5a0');
  }
}

function profileAntlers(d: HeadPainter, far: boolean) {
  if (far) {
    d.line(1, -3, 1, -7, '#766f50');
    d.line(1, -7, 0, -9, '#958963');
    d.line(1, -6, 3, -7, '#766f50');
    return;
  }
  d.line(-3, -3, -4, -7, '#a69a70', 2);
  d.line(-4, -7, -3, -10, '#c7b78c');
  d.line(-4, -7, -6, -8, '#958963');
  d.line(-4, -5, -7, -5, '#a69a70');
  d.line(-4, -3, 2, -3, '#788057');
  d.shape([[-5, -4], [-3, -5], [-1, -3], [-3, -2]], '#9aaf69');
  d.point(2, -3, '#c0b77d');
}

/** Face and gear share one east-facing projection and one local west reflection. */
export function drawHeroHeadProfile(art: PixelCanvas, rig: HeroRig, headId?: string): void {
  if (!rig.body.present.head) return;
  const d = partPainter(art, rig.points.head, rig.bones.head.world.rotation, rig.facing === 'west' ? -1 : 1);
  const skin = heroMaterial(rig.id), gear = equipmentMaterial(headId);
  const style = equipmentStyle(headId), theme = equipmentTheme(headId);
  const helmet = equipmentIsPlate(headId);
  const hood = !!headId && !helmet && style !== 'wildwood';
  if (style === 'wildwood') profileAntlers(d, true);
  profileFace(d, rig.id, skin, helmet || hood, rig.pose.blink);
  if (helmet) profileHelmet(d, style!, gear);
  else if (hood) profileHood(d, style!, gear);
  else if (style === 'wildwood') profileAntlers(d, false);
  if (theme) {
    if (helmet && theme.variant % 3 === 0) d.shape([[-4, -5], [-3, -8], [-1, -5]], gear.metal);
    if (theme.variant % 3 === 1) d.line(-3, -5, 1, -5, gear.trim);
    d.rect(1, -5, 1, 2, equipmentAccents(headId).gem);
  }
}
