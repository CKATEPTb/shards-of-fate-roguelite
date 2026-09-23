import { PixelCanvas } from './pixelCanvas';
import type { HeroRig, HeroWeaponPose, RigPoint } from './heroRigTypes';
import { weaponPoint } from './heroWeaponPose';
import type { HeroWeaponKind } from './heroWeapons';
import { blendEquipmentColor, drawEquipmentMotif, equipmentAccents, equipmentStyle, equipmentTheme } from './heroEquipmentTheme';

export interface HeroMaterial {
  dark: string; shadow: string; metal: string; edge: string;
  cloth: string; fold: string; trim: string; skin: string; skinShadow: string; hair: string;
}

const equipmentMaterials: Record<string, HeroMaterial> = {
  'iron-vanguard': { dark: '#171e28', shadow: '#344957', metal: '#799ba5', edge: '#c5d2c7', cloth: '#2c4d64', fold: '#557d90', trim: '#c4a06d', skin: '#dcab7e', skinShadow: '#986a50', hair: '#6a4d36' },
  'dawn-forged': { dark: '#29231e', shadow: '#62513a', metal: '#b49558', edge: '#e8d18d', cloth: '#a49b77', fold: '#d8cc9c', trim: '#d1ac63', skin: '#d9ab80', skinShadow: '#966a4e', hair: '#a98b50' },
  'ivory-pilgrim': { dark: '#232a27', shadow: '#435b4d', metal: '#859a86', edge: '#d2d2ad', cloth: '#c0b698', fold: '#e8dbba', trim: '#caa569', skin: '#ddb590', skinShadow: '#a07b5f', hair: '#63493b' },
  'ash-weaver': { dark: '#271d2b', shadow: '#493146', metal: '#897983', edge: '#cebaa8', cloth: '#703c55', fold: '#a8667b', trim: '#d1ac66', skin: '#d1a78b', skinShadow: '#946a54', hair: '#846650' },
  'crimson-oath': { dark: '#241b26', shadow: '#512b43', metal: '#936f8b', edge: '#cda7b8', cloth: '#712c47', fold: '#a44b65', trim: '#bc9093', skin: '#dfc9c5', skinShadow: '#9c808c', hair: '#3c2e41' },
  'wildwood': { dark: '#20291f', shadow: '#3b5034', metal: '#82945b', edge: '#c6cc95', cloth: '#507647', fold: '#86a667', trim: '#c3a463', skin: '#d0a275', skinShadow: '#946b4d', hair: '#947547' },
  'grave-keeper': { dark: '#1c1f28', shadow: '#393748', metal: '#6e7b82', edge: '#b2c0af', cloth: '#423c56', fold: '#796b89', trim: '#b2b493', skin: '#bdc4ae', skinShadow: '#7c8b7c', hair: '#929783' },
  'night-stalker': { dark: '#1b232d', shadow: '#304356', metal: '#7590a0', edge: '#bccdc9', cloth: '#36536b', fold: '#688b9f', trim: '#bca078', skin: '#d1a079', skinShadow: '#92684e', hair: '#654d3d' },
  'greenwood': { dark: '#232722', shadow: '#374c3b', metal: '#9b7c4d', edge: '#e1c584', cloth: '#45654a', fold: '#73916a', trim: '#cba161', skin: '#deb083', skinShadow: '#976e4f', hair: '#b28a49' },
};

const characterPalettes: Record<string, string> = {
  guardian: 'iron-vanguard',
  paladin: 'dawn-forged',
  priest: 'ivory-pilgrim',
  mage: 'ash-weaver',
  vampire: 'crimson-oath',
  druid: 'wildwood',
  necromancer: 'grave-keeper',
  rogue: 'night-stalker',
  ranger: 'greenwood',
};

export function equipmentMaterial(appearanceId?: string): HeroMaterial {
  const base = equipmentMaterials[equipmentStyle(appearanceId) ?? ''] ?? equipmentMaterials['iron-vanguard'];
  const theme = equipmentTheme(appearanceId);
  return theme ? { ...base, ...theme.palette } : base;
}

/** Skin and hair belong to the hero; equipment never selects its wearer. */
export function heroMaterial(id: string): HeroMaterial { return equipmentMaterial(characterPalettes[id]); }

/** A tapered bone is shaded in world space so highlights stay on its upper-left edge. */
export function boneSegment(art: PixelCanvas, a: RigPoint, b: RigPoint, upper: number, lower: number, fill: string, outline: string, highlight?: string) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.5) {
    const radius = Math.max(1, Math.min(upper, lower));
    art.ellipse(a.x, a.y, radius, radius, outline);
    art.ellipse(a.x, a.y, Math.max(0.5, radius - 0.8), Math.max(0.5, radius - 0.8), fill);
    return;
  }
  const tx = (b.x - a.x) / length, ty = (b.y - a.y) / length;
  const nx = -ty, ny = tx;
  art.polygon([
    { x: a.x + nx * upper, y: a.y + ny * upper }, { x: b.x + nx * lower, y: b.y + ny * lower },
    { x: b.x - nx * lower, y: b.y - ny * lower }, { x: a.x - nx * upper, y: a.y - ny * upper },
  ], outline);
  // Widths are radii, so a central line only fills half the limb. A second
  // tapered skin piece preserves its full volume with one narrow outline.
  const cap = Math.min(0.65, length / 4);
  const start = { x: a.x + tx * cap, y: a.y + ty * cap };
  const end = { x: b.x - tx * cap, y: b.y - ty * cap };
  const startWidth = Math.max(0.55, upper + (lower - upper) * cap / length - 0.8);
  const endWidth = Math.max(0.55, lower + (upper - lower) * cap / length - 0.8);
  art.polygon([
    { x: start.x + nx * startWidth, y: start.y + ny * startWidth },
    { x: end.x + nx * endWidth, y: end.y + ny * endWidth },
    { x: end.x - nx * endWidth, y: end.y - ny * endWidth },
    { x: start.x - nx * startWidth, y: start.y - ny * startWidth },
  ], fill);
  if (highlight && Math.min(startWidth, endWidth) >= 1) {
    const litSide = nx * -0.8 + ny * -0.6 >= 0 ? 1 : -1;
    const offset = (point: RigPoint, width: number, fraction: number) =>
      ({ x: point.x + nx * width * fraction * litSide, y: point.y + ny * width * fraction * litSide });
    art.polygon([offset(start, startWidth, 0.82), offset(end, endWidth, 0.82),
      offset(end, endWidth, 0.12), offset(start, startWidth, 0.12)], highlight);
  }
}

export function partPainter(art: PixelCanvas, origin: RigPoint, angle: number, mirror = 1, lengthScale = 1) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const at = (x: number, y: number): RigPoint => ({ x: origin.x + x * mirror * cos - y * lengthScale * sin, y: origin.y + x * mirror * sin + y * lengthScale * cos });
  return {
    point(x: number, y: number, color: string) { const p = at(x, y); art.point(p.x, p.y, color); },
    line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
      const a = at(x1, y1), b = at(x2, y2); art.line(a.x, a.y, b.x, b.y, color, width);
    },
    shape(points: readonly [number, number][], color: string) { art.polygon(points.map(([x, y]) => at(x, y)), color); },
    rect(x: number, y: number, width: number, height: number, color: string) {
      art.polygon([at(x, y), at(x + width, y), at(x + width, y + height), at(x, y + height)], color);
    },
  };
}

/** Shared contacts drive both weapons; the nearer hand's prop overlaps the farther one. */
export function drawHeroTwoHandedWeapon(art: PixelCanvas, rig: HeroRig) {
  const weapons = [rig.rightHandWeapon, rig.leftHandWeapon].filter((weapon): weapon is HeroWeaponPose => !!weapon);
  for (const weapon of weapons.filter(weapon => weapon.gripSide !== rig.nearSide)) drawHeroWeapon(art, rig, weapon);
  for (const weapon of weapons.filter(weapon => weapon.gripSide === rig.nearSide)) drawHeroWeapon(art, rig, weapon);
}

/** Render one attachment at the layer chosen for its anatomical hand. */
export function drawHeroWeapon(art: PixelCanvas, rig: HeroRig, weapon: HeroWeaponPose) {
  const { origin, mirror, appearanceId } = weapon;
  const pose = rig.pose;
  const widthScale = weapon.widthScale ?? 1, lengthScale = weapon.lengthScale ?? 1;
  const d = partPainter(art, origin, origin.rotation, mirror * widthScale, lengthScale);
  const p = equipmentMaterial(appearanceId), theme = equipmentTheme(appearanceId), style = equipmentStyle(appearanceId);
  const accents = equipmentAccents(appearanceId), leather = theme ? accents.leather : '#6d543d', bone = accents.bone;
  if (weapon.kind === 'bow') {
    const top = weaponPoint(weapon, -6, -16), bottom = weaponPoint(weapon, -6, 16);
    const nock = weapon.twoHanded && weapon.stringPoint ? weapon.stringPoint : weaponPoint(weapon, -6, 0);
    art.line(top.x, top.y, nock.x, nock.y, '#c7b98b');
    art.line(nock.x, nock.y, bottom.x, bottom.y, '#a99b75');
    // The wood passes through (0, 0), directly beneath the holding hand.
    d.shape([[-7, -17], [-4, -16], [-1, -11], [2, -5], [2, 5], [-1, 11], [-4, 16], [-7, 17], [-7, 14], [-4, 10], [-2, 4], [-2, -4], [-4, -10], [-7, -14]], p.dark);
    d.shape([[-6, -16], [-4, -14], [-2, -9], [1, -4], [1, 4], [-2, 10], [-4, 14], [-6, 16], [-5, 12], [-3, 8], [-1, 3], [-1, -3], [-3, -8], [-5, -12]], theme ? accents.wood : '#a17b45');
    d.line(-5, -14, -2, -8, p.edge); d.line(-2, -8, 1, -3, '#cca363');
    d.line(0, 5, -2, 10, '#bd9253'); d.line(-2, 10, -5, 15, '#bb985a');
    d.rect(-2, -3, 4, 6, '#423c2b'); d.rect(-1, -2, 2, 4, '#8e6940');
    d.line(-1, -2, 1, -2, '#c5a268'); d.line(-1, 2, 1, 2, '#b29159');
    d.point(-6, -16, p.trim); d.point(-6, 16, p.trim);
    if (theme) {
      d.line(-5, -13, -2, -6, p.trim); d.line(-2, 6, -5, 13, p.trim);
      d.rect(-2, -3, 4, 6, p.dark); d.rect(-1, -2, 2, 4, leather);
      if (theme.variant % 2) { d.shape([[-5, -14], [-2, -12], [-3, -9]], p.metal); d.shape([[-3, 9], [-2, 12], [-5, 14]], p.metal); }
    }
    if (weapon.arrowVisible && weapon.twoHanded) {
      // Invert the shared transform so the arrow starts at the actual drawing
      // hand, including its small inverse-kinematics contact correction.
      const dx = nock.x - origin.x, dy = nock.y - origin.y;
      const cos = Math.cos(origin.rotation), sin = Math.sin(origin.rotation);
      const x = (dx * cos + dy * sin) / (mirror * widthScale) + weapon.arrowOffset;
      const y = (-dx * sin + dy * cos) / lengthScale;
      d.line(x, y, x + 14, y, '#c5aa72');
      d.shape([[x + 13, y - 1], [x + 16, y], [x + 13, y + 1]], '#343c37');
      d.line(x + 14, y, x + 16, y, '#d6d8c5');
      d.line(x + 1, y - 1, x + 3, y - 1, '#d9ceb0');
      d.line(x + 1, y + 1, x + 3, y + 1, '#8b9172');
    }
    return;
  }

  if (weapon.kind !== 'staff') {
    const rear = rig.back || (rig.side && weapon.gripSide !== rig.nearSide);
    drawHandWeapon(d, weapon.kind, p, rear, rig.side, appearanceId);
    if (weapon.kind === 'wand') drawWeaponMagic(art, weapon, pose);
    return;
  }

  // The lower grip and the supporting hand at (0, -8) share one straight shaft.
  d.shape([[-1, 15], [-2, -22], [1, -24], [2, -21], [2, 15]], p.dark);
  d.shape([[0, 14], [-1, -21], [0, -22], [1, -20], [1, 14]], theme ? accents.wood : style === 'grave-keeper' ? '#888d7a' : '#9b8059');
  d.rect(-1, -3, 3, 3, leather); d.rect(-1, 2, 3, 2, p.trim);
  if (style === 'ivory-pilgrim') {
    d.shape([[0, -30], [4, -25], [3, -20], [-3, -20], [-4, -25]], p.dark);
    d.line(0, -29, 0, -20, '#c6b68a', 2); d.line(-4, -25, 4, -25, '#c6b68a');
    d.rect(-1, -26, 3, 3, '#dad5b4'); d.point(0, -25, '#eee4bf');
  } else if (style === 'wildwood') {
    d.line(0, -20, -3, -27, '#8f7c52', 2); d.line(0, -22, 4, -28, '#8f7c52');
    d.line(-3, -27, -5, -25, '#655d3c'); d.line(3, -26, 6, -26, '#958760');
    d.shape([[-5, -26], [-5, -30], [-2, -28], [-2, -25]], '#667e4d');
    d.shape([[3, -27], [6, -30], [7, -26], [5, -24]], '#8e9b61');
    d.point(-3, -28, '#b2b885'); d.rect(-1, -24, 3, 4, '#475938');
  } else {
    d.shape([[-4, -27], [-2, -30], [2, -30], [4, -27], [3, -23], [1, -21], [-2, -22], [-4, -24]], p.dark);
    d.rect(-3, -28, 6, 5, bone); d.rect(-2, -24, 4, 3, '#939a83');
    d.rect(-2, -26, 2, 2, '#354841'); d.rect(1, -26, 2, 2, '#354841');
    d.point(-1, -25, '#7caa93'); d.point(2, -25, '#7caa93');
    d.point(0, -23, '#454e43'); d.line(-1, -21, 2, -21, '#c4c5a4');
  }
  if (theme) {
    const gemShape = theme.variant % 3;
    if (gemShape === 0) d.shape([[-3, -27], [0, -30], [3, -27], [0, -23]], accents.gem);
    else if (gemShape === 1) { d.line(-4, -27, 4, -27, p.metal, 2); d.line(0, -29, 0, -23, p.edge, 2); }
    else { d.rect(-3, -28, 6, 5, p.shadow); drawEquipmentMotif(d, appearanceId, 0, -26, 2); }
    d.line(-1, -17, 1, -17, p.trim); d.line(-1, 10, 1, 10, p.trim);
  }
  drawWeaponMagic(art, weapon, pose);
}

/** Sparse sparks gather, form a tiny rune, then separate with the cast beat. */
function drawWeaponMagic(art: PixelCanvas, weapon: HeroWeaponPose, pose: HeroRig['pose']) {
  if (!weapon.active || (pose.motion !== 'cast' && !(weapon.kind === 'wand' && (pose.motion === 'attack' || pose.motion === 'attackLeft')))) return;
  const progress = pose.progress;
  if (progress <= 0.06 || progress >= 0.94) return;
  const theme = equipmentTheme(weapon.appearanceId), style = equipmentStyle(weapon.appearanceId);
  const colors = theme ? [theme.palette.edge, equipmentAccents(weapon.appearanceId).gem, theme.palette.trim]
    : style === 'wildwood' ? ['#d2d6a0', '#95b979', '#657d56']
    : style === 'grave-keeper' ? ['#d3e0bf', '#90baa3', '#5b817b']
    : style === 'ivory-pilgrim' ? ['#f0e4b8', '#d0b97e', '#98875e']
    : ['#f0d5a4', '#d99a72', '#926477'];
  const charge = Math.min(1, progress / 0.5), release = Math.max(0, (progress - 0.5) / 0.44);
  const radius = release > 0 ? 2 + release * 4 : 4.5 - charge * 2.5;
  // The staff's ornament already reaches y=-30. Its spark ellipse stays below
  // that cap; points also keep a clear pixel of margin at every canvas edge.
  const centerY = weapon.kind === 'staff' ? -27 : -15;
  const dot = (x: number, y: number, color: string) => {
    const point = weaponPoint(weapon, x, y);
    if (point.x >= 1 && point.x <= 62 && point.y >= 1 && point.y <= 62) art.point(point.x, point.y, color);
  };
  const count = progress > 0.32 && progress < 0.78 ? 3 : 2;
  for (let index = 0; index < count; index++) {
    const angle = progress * Math.PI * 1.4 + index * Math.PI * 2 / 3;
    dot(Math.cos(angle) * radius, centerY + Math.sin(angle) * radius * 0.45,
      colors[progress > 0.8 ? 2 : index === 0 ? 0 : 1]);
  }
  if (progress >= 0.4 && progress <= 0.7) {
    dot(-1, centerY, colors[1]); dot(1, centerY, colors[1]);
    dot(0, centerY - 1, colors[0]); dot(0, centerY + 1, colors[1]);
  }
}

/** Broad faces and a single lit edge keep each family legible at game scale. */
function drawHandWeapon(d: ReturnType<typeof partPainter>, kind: Exclude<HeroWeaponKind, 'bow' | 'staff'>, p: HeroMaterial, rear = false, side = false, appearanceId?: string) {
  const theme = equipmentTheme(appearanceId), accents = equipmentAccents(appearanceId);
  const steel = theme ? rear ? p.metal : p.edge : rear ? '#86999d' : '#bdc8c6';
  const steelShade = theme ? rear ? p.shadow : p.metal : rear ? '#526570' : '#657d88', leather = theme ? accents.leather : '#74543c';
  if (kind === 'sword' || kind === 'greatsword') {
    const large = kind === 'greatsword', tip = (large ? -28 : -20) + (theme ? theme.variant % 3 : 0), shoulder = large ? -23 : -15;
    const breadth = (large ? 4 : 3) - (theme && theme.variant % 3 === 1 ? 1 : 0);
    d.shape([[-2, -4], [-breadth, shoulder], [0, tip], [breadth, shoulder], [2, -4]], p.dark);
    d.shape([[-1, -5], [1 - breadth, shoulder], [0, tip + 2], [breadth - 1, shoulder], [1, -5]], steelShade);
    d.shape([[-1, -5], [1 - breadth, shoulder], [0, tip + 2], [0, -5]], steel);
    if (large) d.line(1, shoulder + 2, 1, -7, '#97a7aa');
    const guard = large ? 6 : 4, pommel = large ? 10 : 4;
    d.shape([[-guard, -5], [-2, -4], [2, -4], [guard, -5], [guard, -2], [1, -2], [-1, -2], [-guard, -2]], p.dark);
    d.line(-guard + 1, -4, guard - 1, -4, p.trim, 2);
    d.rect(-2, -2, 4, pommel + 2, p.dark); d.rect(-1, -1, 2, pommel, leather);
    d.line(-1, 2, 1, 2, '#ae8e61');
    if (large) { d.line(-1, 6, 1, 6, '#ae8e61'); d.line(-1, 10, 1, 10, '#ae8e61'); }
    d.shape([[-2, pommel], [2, pommel], [2, pommel + 2], [0, pommel + 3], [-2, pommel + 2]], p.dark);
    d.line(-1, pommel + 1, 1, pommel + 1, p.metal);
    if (theme) {
      d.line(0, shoulder + 3, 0, -7, accents.gem);
      if (theme.variant % 2) { d.shape([[-guard, -5], [-guard + 2, -5], [-guard + 1, -2]], p.edge); d.shape([[guard, -5], [guard - 2, -5], [guard - 1, -2]], p.edge); }
      d.rect(0, pommel + 1, 1, 1, accents.gem);
    }
  } else if (kind === 'dagger') {
    d.shape([[-2, -3], [-3, -9], [0, -15], [3, -9], [2, -3]], p.dark);
    d.shape([[-1, -4], [-2, -9], [0, -13], [2, -9], [1, -4]], steelShade);
    if (rear) d.shape([[0, -4], [0, -11], [0, -13], [1, -9], [1, -4]], steel);
    else d.shape([[-1, -4], [-2, -9], [0, -13], [0, -4]], steel);
    d.rect(-3, -3, 6, 2, p.dark); d.line(-2, -3, 2, -3, p.trim);
    d.rect(-1, -1, 3, 5, leather); d.rect(-1, 3, 3, 2, '#a49e86');
    if (theme) { d.line(0, -11, 0, -6, accents.gem); d.rect(-1, 3, 3, 2, p.trim); }
  } else if (kind === 'mace' || kind === 'greatmace' || kind === 'hammer' || kind === 'greathammer') {
    const large = kind === 'greatmace' || kind === 'greathammer';
    const headY = large ? -21 : -14, end = large ? 13 : 5;
    d.shape([[-2, end], [-2, headY + 2], [2, headY + 2], [2, end]], p.dark);
    d.rect(-1, headY + 3, 2, end - headY - 4, leather);
    d.line(-1, -4, 1, -4, p.trim); d.line(-1, 3, 1, 3, '#ad8c58');
    if (large) d.line(-1, 9, 1, 9, '#ad8c58');
    d.rect(-2, end - 1, 4, 2, p.metal);
    if (kind === 'mace' || kind === 'greatmace') {
      const r = large ? 7 : 5, h = large ? 6 : 5;
      d.shape([[0, headY - h], [2, headY - h + 1], [r - 1, headY - h + 1], [r - 1, headY - 2], [r, headY], [r - 1, headY + 2], [r - 2, headY + h - 1], [2, headY + h - 1], [0, headY + h], [-2, headY + h - 1], [2 - r, headY + h - 1], [1 - r, headY + 2], [-r, headY], [1 - r, headY - 2], [1 - r, headY - h + 1], [-2, headY - h + 1]], p.dark);
      d.shape([[0, headY - h + 1], [r - 2, headY - h + 2], [r - 1, headY], [r - 2, headY + h - 2], [0, headY + h - 1], [2 - r, headY + h - 2], [1 - r, headY], [2 - r, headY - h + 2]], p.metal);
      d.shape([[-1, headY - h + 1], [1, headY - h + 1], [2, headY], [1, headY + h - 1], [-1, headY + h - 1], [-2, headY]], p.edge);
      d.line(2 - r, headY - 2, 2 - r, headY + 2, p.trim);
      d.line(r - 2, headY - 2, r - 2, headY + 2, p.shadow);
    } else {
      const r = large ? 8 : 6, top = large ? -26 : -18, base = large ? -17 : -11;
      d.shape([[-r, top + 2], [-r + 2, top], [r - 2, top], [r, top + 2], [r, base - 1], [r - 2, base], [-r + 1, base], [-r, base - 2]], p.dark);
      d.rect(1 - r, top + 2, r * 2 - 2, base - top - 3, p.metal);
      d.shape([[2 - r, top + 1], [r - 2, top + 1], [r - 1, top + 3], [1 - r, top + 3]], p.edge);
      d.rect(r - 3, top + 3, 2, base - top - 4, p.shadow);
      d.line(0, top + 2, 0, base - 1, p.trim, 2);
      d.point(-r + 2, base - 2, '#d4bf87');
    }
    if (theme) { drawEquipmentMotif(d, appearanceId, 0, headY, 2); if (theme.variant % 2) d.line(-2, headY - 2, 2, headY + 2, p.trim); }
  } else if (kind === 'shield') {
    d.shape([[-6, -9], [4, -10], [7, -7], [6, 2], [0, 8], [-6, 3]], p.dark);
    if (side) {
      // The pose supplies the foreshortened width. Paint its rim, not a second
      // front-facing crest; the far hand exposes a sliver of wood and strap.
      d.shape([[-5, -8], [3, -9], [6, -7], [5, 2], [0, 6], [-5, 2]], rear ? '#655d52' : p.shadow);
      d.shape([[-2, -8], [2, -8], [4, -6], [3, 2], [0, 5], [-2, 1]], rear ? '#856449' : p.metal);
      d.line(3, -8, 5, -6, rear ? '#958971' : p.edge);
      d.line(5, -6, 4, 2, rear ? '#777c73' : p.edge);
      if (rear) { d.line(-3, -1, 2, 0, '#382f28', 2); d.point(2, 1, '#b2a080'); }
      else d.line(-1, -6, 0, 3, p.cloth);
    } else if (rear) {
      d.shape([[-5, -8], [3, -9], [6, -7], [5, 2], [0, 6], [-5, 2]], p.shadow);
      d.shape([[-4, -7], [2, -8], [4, -6], [4, 1], [0, 5], [-4, 1]], '#795d42');
      d.shape([[-3, -6], [0, -7], [0, 4], [-3, 1]], '#94714d');
      d.line(1, -7, 1, 3, '#514431'); d.line(-4, -3, 3, -2, '#433429', 2);
      d.rect(-1, -2, 3, 5, '#302b26'); d.line(0, -1, 0, 2, '#ab8960');
      d.point(-3, -3, '#b4a282'); d.point(3, -2, '#b4a282');
      d.line(-4, -8, 2, -9, '#8e958d');
    } else {
      d.shape([[-5, -8], [3, -9], [6, -7], [5, 2], [0, 6], [-5, 2]], p.metal);
      d.shape([[-4, -7], [2, -8], [4, -6], [4, 1], [0, 4], [-4, 1]], p.cloth);
      d.shape([[-4, -7], [0, -7], [0, 4], [-4, 1]], p.fold);
      d.line(0, -7, 0, 3, p.trim); d.line(-3, -3, 3, -3, p.trim);
      d.rect(-1, -4, 3, 3, p.edge); d.line(-5, -8, 2, -9, p.edge);
    }
    if (theme && !rear && !side) {
      d.shape([[-4, -6], [3, -7], [4, 0], [0, 5], [-4, 1]], p.cloth);
      drawEquipmentMotif(d, appearanceId, 0, -2, 2);
      if (theme.variant % 2) { d.line(-5, -6, -5, 1, p.trim); d.line(5, -6, 4, 1, p.trim); }
    }
  } else if (kind === 'scythe') {
    // The long uninterrupted haft leaves both authored grips on its centreline.
    d.shape([[-2, -22], [2, -22], [2, 15], [1, 16], [-1, 16], [-2, 15]], p.dark);
    d.shape([[-1, -21], [1, -21], [1, 14], [0, 15], [-1, 14]], '#755555');
    d.line(-1, -19, -1, 13, '#a58278');
    d.rect(-2, -3, 4, 6, '#392531'); d.rect(-1, -2, 2, 4, '#803b4c');
    d.line(-1, -2, 1, -2, '#bc7a80'); d.line(-1, 2, 1, 2, '#a06572');
    d.rect(-2, 6, 4, 5, '#392531'); d.rect(-1, 7, 2, 3, '#803b4c');
    d.line(-1, 7, 1, 7, '#bc7a80'); d.line(-1, 10, 1, 10, '#a06572');
    d.rect(-2, 14, 4, 2, '#727481'); d.line(-1, 14, 1, 14, '#bec1bb');

    // A broad swept blade thins continuously into the distant cutting tip.
    d.shape([[-3, -24], [0, -28], [6, -29], [11, -27], [15, -23], [17, -16], [14, -19], [10, -22], [6, -23], [2, -22], [1, -19], [-2, -20]], p.dark);
    d.shape([[-2, -24], [1, -27], [6, -28], [10, -26], [14, -22], [16, -18], [13, -20], [10, -23], [6, -24], [1, -23], [0, -21], [-1, -21]], '#74818c');
    d.shape([[1, -26], [6, -27], [10, -25], [14, -21], [16, -18], [12, -21], [9, -23], [6, -24], [1, -23]], '#bac4c4');
    d.line(2, -23, 6, -24, '#e0e1d6'); d.line(6, -24, 10, -23, '#d9ddd5');
    d.line(10, -23, 14, -20, '#d2d8d2'); d.line(14, -20, 17, -16, '#bdc9c7');
    d.shape([[0, -26], [3, -27], [4, -25], [1, -23], [-1, -23]], '#723746');
    d.point(1, -25, '#c88386'); d.rect(-2, -22, 4, 2, '#696472'); d.line(-1, -22, 1, -22, '#c2b9b9');
    if (theme) {
      d.line(0, -20, 0, 14, accents.wood, 2);
      d.rect(-1, -2, 2, 4, leather); d.rect(-1, 7, 2, 3, leather);
      d.shape([[-2, -24], [1, -27], [6, -28], [10, -26], [14, -22], [16, -18], [13, -20], [10, -23], [6, -24], [1, -23], [0, -21], [-1, -21]], steelShade);
      d.line(2, -23, 6, -24, steel); d.line(6, -24, 10, -23, steel); d.line(10, -23, 17, -16, steel);
      d.rect(-2, -22, 4, 2, p.trim); d.rect(0, -26, 2, 2, accents.gem);
    }
  } else if (kind === 'sickle') {
    // The palm closes around one straight handle, with its collar below the hook.
    d.rect(-1, -12, 2, 16, p.dark); d.line(0, 3, 0, -11, rear ? '#624653' : '#825461');
    d.rect(-2, -2, 4, 5, p.dark); d.rect(-1, -2, 2, 4, rear ? '#583d49' : '#784652');
    d.line(-1, -2, 1, -2, rear ? '#8a6b71' : '#ba8b8d');
    d.line(-1, 2, 1, 2, rear ? '#795d64' : '#a7787e');
    d.rect(-2, -10, 4, 2, p.dark); d.line(-1, -9, 1, -9, p.trim);
    d.line(-1, 3, 1, 3, rear ? '#777079' : '#aaa0a4');
    d.shape([[-3, -11], [-1, -16], [4, -17], [7, -14], [7, -10], [5, -7], [5, -12], [3, -14], [0, -13]], p.dark);
    d.shape([[-2, -11], [0, -15], [4, -16], [6, -13], [6, -10], [5, -9], [5, -13], [3, -14], [0, -12]], rear ? '#77727f' : '#a8979f');
    // Only the concave edge is honed; the convex spine stays muted.
    d.line(0, -15, 4, -16, rear ? '#575663' : '#796975');
    const edge = rear ? '#afa8b2' : '#e0d4d4';
    d.line(0, -13, 3, -14, edge); d.line(3, -14, 5, -12, edge); d.line(5, -12, 5, -8, edge);
    if (theme) {
      d.line(0, 3, 0, -10, accents.wood); d.rect(-1, -2, 2, 4, leather);
      d.shape([[-2, -11], [0, -15], [4, -16], [6, -13], [6, -10], [5, -9], [5, -13], [3, -14], [0, -12]], steelShade);
      d.line(0, -13, 3, -14, steel); d.line(3, -14, 5, -12, steel); d.line(5, -12, 5, -8, steel);
      d.line(-1, -9, 1, -9, p.trim);
    }
  } else if (kind === 'wand') {
    d.line(0, 4, 1, -10, p.dark, 3); d.line(0, 3, 1, -10, '#a08360');
    d.rect(0, -11, 3, 3, '#827464');
    d.shape([[1, -17], [4, -13], [2, -9], [-1, -11], [-2, -13]], p.dark);
    d.shape([[1, -16], [3, -13], [2, -10], [-1, -12]], '#a25c42');
    d.line(1, -15, 1, -12, '#d49b60'); d.point(1, -13, '#ead2a0');
    if (theme) {
      d.line(0, 3, 1, -10, accents.wood); d.rect(0, -11, 3, 3, p.metal);
      d.shape([[1, -16], [3, -13], [2, -10], [-1, -12]], accents.gem);
      d.line(1, -15, 1, -12, blendEquipmentColor(accents.gem, p.edge, .65));
      if (theme.variant % 2) { d.line(-1, -13, 1, -16, p.trim); d.line(3, -13, 1, -16, p.trim); }
    }
  }
}
