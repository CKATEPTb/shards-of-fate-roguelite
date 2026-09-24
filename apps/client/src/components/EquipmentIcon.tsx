import type { ReactNode } from 'react';
import { baseEquipmentItemId, type EquipmentItemDefinition, type EquipmentSetVisualDefinition, type StarterEquipment, type WeaponKind } from '@shards/shared';
import { equipmentAccents, equipmentIsPlate, equipmentStyle, equipmentTheme } from '../art/heroEquipmentTheme';
import { equipmentMaterial, type HeroMaterial } from '../art/heroPartEquipment';
import './equipmentRarity.css';
import './equipmentIcon.css';

type EquipmentIconItem = EquipmentItemDefinition | StarterEquipment;
type IconColors = HeroMaterial & ReturnType<typeof equipmentAccents>;

/** Cosmetic identity stays stable when an item moves between inventory and either hand/ring slot. */
function itemSignature(item: EquipmentIconItem): number {
  let value = 2166136261;
  for (const character of item.id ? baseEquipmentItemId(item.id) : item.name) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

function Gem({ colors: c, variant, x = 32, y = 20, size = 5 }: { colors: IconColors; variant: number; x?: number; y?: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size / 5})`}>
    <path d={variant % 2 ? 'M-5-3 0-6 5-3 5 3 0 6-5 3Z' : 'M0-6 6 0 0 6-6 0Z'} fill={c.gem} stroke={c.trim} strokeWidth="1.5" />
    <path d="M0-4 0 3-3 0Z" fill={c.edge} stroke="none" />
  </g>;
}

function Crest({ motif, color, x = 32, y = 32, scale = 1 }: { motif?: EquipmentSetVisualDefinition['motif']; color: string; x?: number; y?: number; scale?: number }) {
  const marks: Record<NonNullable<EquipmentSetVisualDefinition['motif']>, ReactNode> = {
    rune: <path d="M-3 5V-5l7 4-7 2 6 4" />,
    sun: <><circle r="3" /><path d="M0-7v2M0 5v2M-7 0h2M5 0h2M-5-5l1 1M4 4l1 1M5-5 4-4M-4 4l-1 1" /></>,
    moon: <path d="M3-6C-6-8-9 5 1 6l4-2C-3 5-4-2 3-6Z" />,
    leaf: <><path d="M-5 5C-8-2 0-6 6-6 6 1 2 8-5 5ZM-5 5 3-3" /></>,
    skull: <><path d="M-5 2V-4l3-2h4l3 2v6L3 3v3h-6V3Z" /><path d="M-3-1h1m4 0h1M0 2v1" /></>,
    flame: <path d="M0-7C5-3 1-1 4 1l2-2C9 9-9 9-6-1l3 3C-4-3 0-3 0-7Z" />,
    star: <path d="m0-7 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />,
    eye: <><path d="M-7 0Q0-8 7 0 0 8-7 0Z" /><path d="M0-3v6" /></>,
    claw: <path d="M-3-6-5 5M1-6-1 5M5-6 3 5" />,
    cross: <path d="M0-6v13M-5-2H5" />,
    crystal: <path d="M0-7 5-2 3 5 0 7-3 5-5-2ZM0-7V7M-5-2H5" />,
    bolt: <path d="M1-7-5 1h5l-1 6 6-9H0Z" />,
  };
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{marks[motif ?? 'rune']}</g>;
}

function WeaponArt({ kind, colors: c, variant, motif }: { kind: WeaponKind; colors: IconColors; variant: number; motif?: EquipmentSetVisualDefinition['motif'] }): ReactNode {
  const gem = <Gem colors={c} variant={variant} />;
  const shaft = <><path d="M29 25h6v32h-6Z" fill={c.wood} /><path d="M30 30h4v24h-4Z" fill={c.leather} /><path d="M29 37h6m-6 5h6m-6 5h6" stroke={c.dark} /><path d="M28 54h8v4h-8Z" fill={c.trim} /></>;
  if (kind === 'shield') return <>
    <path d={variant % 2 ? 'M32 7 53 15 49 40 42 49 32 57 22 49 15 40 11 15Z' : 'M14 9h36l3 24-6 14-15 10-15-10-6-14Z'} fill={c.metal} stroke={c.edge} />
    <path d="M32 13 46 18 43 38 32 49 21 38 18 18Z" fill={c.cloth} stroke={c.trim} strokeWidth="2" />
    <path d="M32 15v32L22 36l-3-17Z" fill={c.fold} />
    <Crest motif={motif} color={c.trim} y={30} scale={1.1} />
    <path d="M16 15h2m28 0h2M18 38h2m24 0h2" stroke={c.edge} strokeWidth="2" />
  </>;
  if (kind === 'bow') return <>
    <path d="M19 7C52 13 55 46 19 57l7-12 10-13-10-13Z" fill={c.wood} stroke={c.edge} />
    <path d="M20 8 28 32 20 56" fill="none" stroke={c.trim} />
    <path d="M36 24q5 8 0 16" fill="none" stroke={c.leatherShadow} strokeWidth="5" />
    <path d="M10 32h43" stroke={c.edge} strokeWidth="2" /><path d="m50 28 8 4-8 4ZM11 29l7 3-7 3Z" fill={c.metal} />
    <path d="M25 13h5m-5 38h5" stroke={c.trim} strokeWidth="3" />
  </>;
  if (kind === 'staff' || kind === 'wand') return <g transform="rotate(27 32 32)">
    <path d={kind === 'staff' ? 'M30 19h4v40h-4Z' : 'M30 26h4l2 29h-8Z'} fill={c.wood} stroke={c.leatherEdge} />
    <path d={kind === 'staff' ? 'M23 8 20 17l6 11h12l6-11-3-9-4 5 2 5-7 6-7-6 2-5Z' : 'M26 22 23 15l9-9 9 9-3 7-6 7Z'} fill={c.metal} stroke={c.trim} />
    <Gem colors={c} variant={variant} y={kind === 'staff' ? 15 : 16} size={6} />
    <path d="M28 35h8m-8 4h8M29 54h6" stroke={c.trim} strokeWidth="2" />
    {kind === 'staff' && <path d="m24 24-5 10 6-3m15-7 5 10-6-3" fill={c.cloth} stroke={c.trim} />}
  </g>;
  if (kind === 'sickle' || kind === 'scythe') return <g transform={`rotate(${kind === 'sickle' ? 24 : 12} 32 32)`}>
    <path d={kind === 'scythe' ? 'M25 10h5v48h-5Z' : 'M25 29h6v26h-6Z'} fill={c.wood} stroke={c.leatherEdge} />
    <path d={kind === 'scythe' ? 'M16 13C27 0 51 5 56 31 45 15 35 17 27 18L16 19Z' : 'M25 10C51-1 57 35 31 38 45 26 42 14 25 17Z'} fill={c.metal} stroke={c.edge} />
    <path d="M23 43h10v10H23Z" fill={c.leatherShadow} /><path d="M24 44h8m-8 5h8M25 15h7" stroke={c.trim} strokeWidth="2" />
    <Gem colors={c} variant={variant} x={28} y={kind === 'scythe' ? 15 : 34} size={3} />
  </g>;
  if (kind === 'hammer' || kind === 'greathammer') return <g transform="rotate(36 32 32)">
    {shaft}
    <path d={kind === 'greathammer' ? 'M12 10h39v19H12Z' : 'M17 13h30v14H17Z'} fill={c.metal} stroke={c.edge} />
    <path d={kind === 'greathammer' ? 'M12 10h8v19h-8Zm31 0h8v19h-8Z' : 'M17 13h5v14h-5Zm20 0h10v14H37Z'} fill={c.shadow} stroke={c.trim} />
    <path d="M24 12h12v4H24Z" fill={c.edge} stroke="none" />{gem}
  </g>;
  if (kind === 'mace' || kind === 'greatmace') return <g transform="rotate(34 32 32)">
    {shaft}
    <path d={kind === 'greatmace' ? 'M32 5 41 9l7 11-7 12H23L16 20l7-11Z' : 'M32 9 41 14l3 10-7 8H27l-7-8 3-10Z'} fill={c.metal} stroke={c.edge} />
    <path d="M32 8 26 20l6 11 6-11Z" fill={c.edge} /><path d="M23 14 26 20 23 26M41 14 38 20l3 6" fill="none" stroke={c.shadow} strokeWidth="2" />
    <Gem colors={c} variant={variant} y={20} size={3} />
  </g>;
  const long = kind === 'greatsword', dagger = kind === 'dagger';
  return <g transform="rotate(37 32 32)">
    <path d={`M29 ${dagger ? 39 : 43}h6v13h-6Z`} fill={c.leather} stroke={c.trim} />
    <path d={dagger ? 'M32 11 39 25 36 40H28l-3-15Z' : long ? 'M32 4 40 15 38 43H26L24 15Z' : 'M32 6 38 17 36 43H28L26 17Z'} fill={c.metal} stroke={c.edge} />
    <path d={dagger ? 'M32 12v27h-4l-2-14Z' : 'M32 7v34h-4l-1-24Z'} fill={c.edge} stroke="none" />
    <path d={dagger ? 'M22 37h20v5l-10-2-10 2Z' : long ? 'M19 39l13 3 13-3v7l-13-2-13 2Z' : 'M22 40l10 2 10-2v6l-10-2-10 2Z'} fill={c.trim} stroke={c.dark} />
    <path d="M29 49h6m-6 4h6" stroke={c.dark} /><Gem colors={c} variant={variant} y={56} size={3} />
    <path d={`M32 ${dagger ? 28 : 24}v7m-2-5h4`} stroke={c.trim} strokeWidth="1.5" />
  </g>;
}

function GarmentArt({ item, colors: c, variant, appearanceId }: { item: EquipmentIconItem; colors: IconColors; variant: number; appearanceId?: string }): ReactNode {
  const theme = equipmentTheme(appearanceId), plate = equipmentIsPlate(appearanceId);
  const bone = theme?.material === 'bone', style = equipmentStyle(appearanceId);
  const shell = bone ? c.bone : plate ? c.metal : c.cloth;
  const crest = (x: number, y: number, scale = .8) => <Crest motif={theme?.motif} color={c.trim} x={x} y={y} scale={scale} />;
  switch (item.slot) {
    case 'head':
      if (bone || style === 'wildwood') return <>
        <path d="m13 38-3-18 12 10 10-20 10 20 12-10-3 18-19 10Z" fill={bone ? c.bone : c.wood} stroke={c.edge} />
        <path d="M14 37q18 8 36 0v9q-18 9-36 0Z" fill={c.metal} stroke={c.trim} /><Gem colors={c} variant={variant} y={39} />
      </>;
      return plate ? <>
        <path d="M15 48V26L20 14l12-6 12 6 5 12v22l-12-7H27Z" fill={shell} stroke={c.edge} />
        <path d="M32 10v34l-5-4-11 6V27l5-12Z" fill={c.shadow} /><path d="M18 27h28v9l-10 2-4 9-4-9-10-2Z" fill={c.dark} />
        <path d="M30 11h4v32h-4ZM19 27h9v3h-9Zm17 0h9v3h-9Z" fill={c.edge} stroke="none" />
        {variant % 2 === 1 && <path d="m28 11 4-7 4 7-4 6Z" fill={c.trim} />}
      </> : <>
        <path d="M32 8 44 17l8 20-5 15-15-7-15 7-5-15 8-20Z" fill={shell} stroke={c.edge} />
        <path d="M32 16 41 25l4 14-13 8-13-8 4-14Z" fill={c.dark} stroke={c.trim} />
        <path d="m32 8-8 14-6 24-6-9 8-20Z" fill={c.fold} /><path d="m32 18 7 9 3 12" fill="none" stroke={c.edge} />{crest(32, 12, .45)}
      </>;
    case 'chest': return <>
      <path d={plate ? 'M23 10 32 16 41 10 55 18 51 33 43 29 45 52 32 57 19 52 21 29 13 33 9 18Z' : 'M23 9 32 15 41 9 55 21 48 34 41 30 46 55H18l5-25-7 4-7-13Z'} fill={shell} stroke={c.edge} />
      <path d="M23 12 32 18v35l-11-3 3-22-10 3-3-12Z" fill={plate ? c.shadow : c.fold} />
      <path d="M23 12 32 18 41 12M21 44h22M24 25l8 6 8-6" fill="none" stroke={c.trim} strokeWidth="2" />
      <path d="M29 42h6v5h-6Z" fill={c.trim} />{crest(32, 31)}
      {plate && <path d="m10 19 11-2 1 10-10 3m42-11-11-2-1 10 10 3" fill={c.metal} stroke={c.edge} />}
    </>;
    case 'gloves': return <>{[false, true].map((right) => <g key={String(right)} transform={right ? 'translate(64 2) scale(-1 1)' : 'translate(0 -2)'}>
      <path d="m13 13 15 2-2 16 6 9-3 7-6-5-2 11-11-4-3-11 3-12Z" fill={shell} stroke={c.edge} />
      <path d="m12 13 16 2-1 9-17-2Z" fill={c.metal} stroke={c.trim} /><path d="m12 32 10 2m-11 5 9 2m-7-11-2 15m7-13-2 16" stroke={plate ? c.edge : c.fold} fill="none" />
      <Gem colors={c} variant={variant} x={19} y={19} size={2.5} />
    </g>)}</>;
    case 'pants': return <>
      <path d="M19 10h26l3 42-13 3-3-24-3 24-13-3Z" fill={shell} stroke={c.edge} />
      <path d="M19 13h12v15l-5 24-10-1Z" fill={plate ? c.shadow : c.fold} /><path d="M18 11h28v7H18Z" fill={c.leatherShadow} stroke={c.trim} />
      <path d="M29 11h6v7h-6Z" fill={c.trim} /><path d="M22 21v12m20-12v12" fill="none" stroke={c.edge} />
      {plate ? <><path d="m18 35 11 1-2 10-10-1Zm17 1 11-1 1 10-10 1Z" fill={c.metal} stroke={c.trim} />{crest(23, 39, .4)}</> : <path d="m18 42 10 2m8 0 10-2" stroke={c.trim} />}
    </>;
    case 'boots': return <>{[false, true].map((right) => <g key={String(right)} transform={right ? 'translate(31 -3)' : 'translate(0 3)'}>
      <path d="M13 10h14l-2 28 3 10-3 5H7l-2-5 9-8Z" fill={plate ? shell : c.leather} stroke={c.edge} />
      <path d="M12 10h16v8H12Z" fill={shell} stroke={c.trim} /><path d="M15 20h8l-2 18-7 3Z" fill={plate ? c.shadow : c.leatherShadow} />
      <path d="M7 48h20M14 26h10m-10 6h9" fill="none" stroke={c.trim} strokeWidth="2" />
    </g>)}</>;
    case 'amulet': return <>
      <path d="M16 9C12 24 21 31 32 36 43 31 52 24 48 9" fill="none" stroke={c.shadow} strokeWidth="5" />
      <path d="M16 9C12 24 21 31 32 36 43 31 52 24 48 9" fill="none" stroke={c.trim} strokeWidth="2" />
      <path d="m32 30 14 10-5 12-9 6-9-6-5-12Z" fill={c.metal} stroke={c.edge} />
      <Gem colors={c} variant={variant} y={43} size={8} /><path d="M29 29h6v6h-6Z" fill={c.trim} />
    </>;
    case 'ring1': case 'ring2': return <>
      <ellipse cx="32" cy="37" rx="16" ry="18" fill="none" stroke={c.shadow} strokeWidth="8" />
      <ellipse cx="32" cy="36" rx="16" ry="18" fill="none" stroke={c.trim} strokeWidth="5" />
      <path d="M20 42q2 8 9 10m11-22q7 10 0 17" fill="none" stroke={c.edge} strokeWidth="2" />
      <path d={variant % 2 ? 'm32 10 12 7-3 13H23l-3-13Z' : 'm32 8 14 13-14 13-14-13Z'} fill={c.metal} stroke={c.edge} />
      <Gem colors={c} variant={variant} y={21} size={7} />
    </>;
    default: return <><path d="M18 14h28v36H18Z" fill={shell} stroke={c.edge} />{crest(32, 32, 1.4)}</>;
  }
}

/** Filled item art shares the exact material palette used by the equipped hero. */
export function EquipmentIcon({ item, size = 40 }: { item: EquipmentIconItem; size?: number }) {
  const appearanceId = item.appearanceId ?? item.setId;
  const colors: IconColors = { ...equipmentMaterial(appearanceId), ...equipmentAccents(appearanceId) };
  const variant = itemSignature(item), motif = equipmentTheme(appearanceId)?.motif;
  return <span className="equipment-icon" data-equipment-rarity={item.rarity ?? 'common'} style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 64 64" fill="none" strokeWidth="1.2" strokeLinejoin="round" focusable="false">
      <path d="M0 0h64v64H0Z" fill={colors.dark} /><path d="m5 5 54 0-54 54Z" fill={colors.cloth} opacity=".2" />
      <g className="equipment-icon-object">
        {item.weapon ? <WeaponArt kind={item.weapon.kind} colors={colors} variant={variant} motif={motif} /> : <GarmentArt item={item} colors={colors} variant={variant} appearanceId={appearanceId} />}
      </g>
      <path className="equipment-icon-corners" d="M2 12V2h10m40 0h10v10M2 52v10h10m40 0h10V52" />
      <g fill={colors.trim}>{Array.from({ length: 1 + variant % 3 }, (_, index) => <path key={index} d={`m${29 - variant % 3 * 3 + index * 6} 59 2-2 2 2-2 2Z`} />)}</g>
    </svg>
  </span>;
}
