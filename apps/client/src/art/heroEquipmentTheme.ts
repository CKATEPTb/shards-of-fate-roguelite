import { EQUIPMENT_SETS } from '@shards/game-data';

const silhouettes = {
  guardian: 'iron-vanguard', paladin: 'dawn-forged', priest: 'ivory-pilgrim', mage: 'ash-weaver',
  vampire: 'crimson-oath', druid: 'wildwood', necromancer: 'grave-keeper', rogue: 'night-stalker', ranger: 'greenwood',
} as const;

export function equipmentTheme(appearanceId?: string) { return appearanceId ? EQUIPMENT_SETS[appearanceId]?.visual : undefined; }

/** Shape vocabulary is shared; the full item appearance still selects its own material. */
export function equipmentStyle(appearanceId?: string): string | undefined {
  const theme = equipmentTheme(appearanceId);
  return theme ? silhouettes[theme.silhouette] : appearanceId;
}

export function equipmentIsPlate(appearanceId?: string): boolean {
  const material = equipmentTheme(appearanceId)?.material;
  return material ? material === 'plate' || material === 'mail' || material === 'bone'
    : equipmentStyle(appearanceId) === 'iron-vanguard' || equipmentStyle(appearanceId) === 'dawn-forged';
}

export function blendEquipmentColor(color: string, other: string, fraction: number): string {
  const rgb = (value: string) => [1, 3, 5].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
  const a = rgb(color), b = rgb(other);
  return '#' + a.map((value, index) => Math.round(value + (b[index] - value) * fraction).toString(16).padStart(2, '0')).join('');
}

export function equipmentAccents(appearanceId?: string) {
  const theme = equipmentTheme(appearanceId), accents = theme?.accents;
  const leather = accents?.leather ?? (theme ? blendEquipmentColor(theme.palette.cloth, '#765941', .55) : '#897052');
  return {
    leather, leatherShadow: theme ? blendEquipmentColor(leather, theme.palette.dark, .5) : '#514232',
    leatherEdge: theme ? blendEquipmentColor(leather, theme.palette.edge, .42) : '#b1986e',
    wood: accents?.wood ?? (theme ? blendEquipmentColor(theme.palette.trim, '#69543c', .6) : '#9b8059'),
    bone: accents?.bone ?? '#c1bda0', gem: accents?.gem ?? theme?.palette.trim ?? '#d49b60',
  };
}

interface DetailPainter {
  rect(x: number, y: number, width: number, height: number, color: string): void;
  line(x1: number, y1: number, x2: number, y2: number, color: string, width?: number): void;
  shape(points: readonly [number, number][], color: string): void;
}

/** Small heraldic marks fit the same garment and weapon contact geometry in every pose. */
export function drawEquipmentMotif(d: DetailPainter, appearanceId: string | undefined, x: number, y: number, radius = 2) {
  const theme = equipmentTheme(appearanceId);
  if (!theme) return;
  const color = theme.palette.trim, light = equipmentAccents(appearanceId).gem, r = radius;
  switch (theme.motif) {
    case 'sun': case 'star':
      d.line(x - r, y, x + r, y, color); d.line(x, y - r, x, y + r, color);
      if (r > 1) { d.rect(x - 1, y - 1, 2, 2, light); d.rect(x, y, 1, 1, theme.palette.edge); }
      break;
    case 'moon':
      d.shape([[x, y - r], [x - r, y - 1], [x - r, y + 1], [x, y + r], [x + r, y + 1], [x, y + 1], [x - 1, y], [x, y - 1]], color); break;
    case 'leaf': case 'flame':
      d.shape([[x, y - r - 1], [x + r, y], [x, y + r], [x - r, y]], color);
      d.line(x, y - 1, x, y + r, light); break;
    case 'skull':
      d.rect(x - r, y - r, r * 2 + 1, r + 2, color); d.rect(x - 1, y + 1, 3, 2, color);
      d.rect(x - 1, y - 1, 1, 1, theme.palette.dark); d.rect(x + 1, y - 1, 1, 1, theme.palette.dark); break;
    case 'eye':
      d.shape([[x - r - 1, y], [x, y - r], [x + r + 1, y], [x, y + r]], color);
      d.rect(x, y - 1, 1, 2, theme.palette.dark); break;
    case 'claw':
      for (let i = -1; i <= 1; i++) d.line(x + i * 2, y - r, x + i * 2 - 1, y + r, color);
      break;
    case 'cross': d.line(x, y - r, x, y + r + 1, color); d.line(x - r, y - 1, x + r, y - 1, color); break;
    case 'crystal':
      d.shape([[x, y - r - 1], [x + r, y], [x, y + r + 1], [x - r, y]], color); d.line(x, y - r, x, y + r, light); break;
    case 'bolt':
      d.shape([[x, y - r - 1], [x - r, y], [x, y], [x - 1, y + r + 1], [x + r, y - 1], [x, y - 1]], color); break;
    default:
      d.line(x, y - r, x, y + r, color); d.line(x, y - r, x + r, y, color); d.line(x + r, y, x - r, y + 1, color);
  }
}
