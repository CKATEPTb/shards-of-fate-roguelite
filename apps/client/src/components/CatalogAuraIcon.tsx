import type { AuraVisualDefinition } from '@shards/shared';
import type { ReactNode } from 'react';

/** Twenty authored silhouettes. Each stays legible at the combat badge's 25 px. */
function Motif({ kind, color, light }: { kind: AuraVisualDefinition['motif']; color: string; light: string }): ReactNode {
  const shapes: Record<AuraVisualDefinition['motif'], ReactNode> = {
    drop: <><path d="m16 1 4 8 7 10v7l-6 5H11l-6-5v-7l7-10Z" /><path d="M11 18H8v7l5 3h3v-3l-5-2Z" fill={light} /></>,
    cross: <><path d="M12 2h8v9h10v8H20v12h-8V19H2v-8h10Z" /><path d="M13 3h3v12H3v-3h10Z" fill={light} /><path d="M13 19h3v10h-3Z" fill={light} /></>,
    leaf: <><path d="m27 2 3 11-4 12-8 5H8l-6-7 3-10 9-7Z" /><path d="M23 8h3v3h-3v4h-4v4h-4v4h-4v7H8v-9h4v-4h4v-4h4V9h3Z" fill={light} /><path d="M9 13h3v5H9Zm9 8h6v3h-6Z" fill={light} /></>,
    skull: <><path d="M8 3h16l6 6v14l-6 3v5H8v-5l-6-3V9Z" /><path d="M7 6h17v3H7ZM5 9h3v5H5Z" fill={light} /><path d="M7 15h7v7H7Zm11 0h7v7h-7ZM14 24h4v3h-4ZM11 28h3v3h-3Zm7 0h3v3h-3Z" fill="#13242a" /></>,
    star: <><path d="m16 0 5 10 11 2-8 8 2 12-10-6-10 6 2-12-8-8 11-2Z" /><path d="m16 4 1 11 10-2-10 6-1 8-2-9-9-5 10 2Z" fill={light} /></>,
    flame: <><path d="m20 0 4 8-3 11 5-6 5 9-3 7-7 3H10l-8-8 2-13 5 6 2-9Z" /><path d="m17 11 2 9 5 2-4 7h-8l-3-6 6-2Z" fill={light} /></>,
    crystal: <><path d="m16 0 12 9-3 18-9 5-9-5L4 9Z" /><path d="M16 2v28L9 24 7 10Zm2 1 7 7-7 4Z" fill={light} /><path d="m6 10 10 6 11-6-11 9Z" fill="#172938" opacity=".45" /></>,
    bolt: <><path d="M18 0h12L19 12h9L7 32l5-15H2Z" /><path d="M19 2h7L14 15h7L11 25l5-12H9Z" fill={light} /></>,
    rock: <><path d="m9 3 13-2 10 11-3 15-17 5L0 21l3-12Z" /><path d="m9 5 11-1 7 8-14 2L5 10Z" fill={light} /><path d="m13 14 2 15-3 1L3 21l1-9Z" fill="#102532" opacity=".35" /><path d="m20 18 8-4-2 10-5 2Z" fill={light} opacity=".45" /></>,
    blade: <><path d="M20 0h10v10L13 27l-9-9Z" /><path d="m21 3 6-1-1 6-16 16-3-3Z" fill={light} /><path d="m4 17 13 13-4 2L1 20Zm1 7 4 4-4 4-5-4Z" fill={color} /></>,
    fang: <><path d="M3 3h27l-3 14-8 14-1-13-4-3-7 14L5 15Z" /><path d="M6 5h9l-2 6-4 3-1 9Zm15 0h6l-2 10-4 9 1-10Z" fill={light} /><path d="M4 3h26v5H4Z" fill={color} /></>,
    wisp: <><path d="M16 0h7l-4 8 8 4 5 8-6 11-9 1 4-7-5-5-9 5-7-7L4 8l4 5 7-2Z" /><path d="m19 7 2 7 6 6-5 7 1-7-9-6Z" fill={light} /><path d="M10 14h3v3h-3Z" fill={light} /></>,
    hourglass: <><path d="M4 1h24v5l-4 8-4 2 4 3 4 8v5H4v-5l4-8 4-3-4-2-4-8Z" /><path d="M8 6h16l-4 6-4 3-4-3ZM16 19l8 8H8Z" fill={light} /><path d="M6 2h20v3H6Zm0 26h20v3H6Z" fill={light} /></>,
    claw: <><path d="m7 0 3 8-3 14-7 10 3-16Zm10 1 4 6-4 14-9 11 6-17Zm11 0 4 5-5 15-10 10 7-17Z" /><path d="m7 3 1 5-3 15 1-12Zm10 0 2 5-6 17 3-16Zm12 0 1 4-8 19 5-19Z" fill={light} /></>,
    moon: <><path d="M19 0h8l-7 8v10l8 8h4l-9 6H12L3 25 0 15 4 6 12 1Z" /><path d="M13 4h5l-6 6-3 7 3 8 6 4h-6l-7-6-2-9 5-7Z" fill={light} /><path d="M25 9h3v3h3v3h-3v3h-3v-3h-3v-3h3Z" fill={light} /></>,
    bone: <><path d="M4 1h6l3 4-1 5 10 10 5-1 4 3v6l-3 3h-6l-3-4 1-5L10 12l-5 1-4-3V4Z" /><path d="M4 3h5v3H4Zm5 5 16 16-2 2L7 10Zm14 15h5v4h-5Z" fill={light} /></>,
    eye: <><path d="M11 5h10l11 11-11 11H11L0 16Z" /><path d="M11 8h10l7 8-7 8H11l-7-8Z" fill={light} /><path d="M12 10h8v12h-8Z" fill="#142329" /><path d="M16 10h4v4h-4Z" fill={color} /></>,
    feather: <><path d="m23 1 8 3-2 12-7 9-12 2-7 5-3-3 7-8 1-12 7-5Z" /><path d="m25 5 2 2-17 20-3-2Z" fill={light} /><path d="M12 9h3v7h-3Zm-3 5h2v7H9Zm8 8h7v2h-7Zm4-6h7v2h-7Z" fill={light} /></>,
    rune: <><path d="M12 0h7v10l9-5v7l-9 6v5l9-6v7l-9 7h-7v-9l-9 5v-7l9-6V9L3 14V7Z" /><path d="M13 2h3v27h-3Zm5 11 8-5v3l-8 5Zm0 12 8-5v3l-8 5Z" fill={light} /></>,
    shield: <><path d="m16 0 15 6-2 15-6 7-7 4-7-4-6-7L1 6Z" /><path d="m16 3 12 5-2 12-5 6-5 3-5-3-5-6L4 8Z" fill={color} /><path d="m16 5-9 5 1 10 4 5 4 2Z" fill={light} /><path d="M14 7h4v18h-4ZM8 12h16v4H8Z" fill={light} /></>,
  };
  return <g fill={color}>{shapes[kind]}</g>;
}

function Composition({ visual }: { visual: AuraVisualDefinition }): ReactNode {
  const [base, bright, pale] = visual.colors;
  const spokeCount = 5 + visual.variant % 4;
  const spokes = Array.from({ length: spokeCount }, (_, index) => {
    const angle = index * 360 / spokeCount + visual.variant % 24;
    return <path key={index} transform={`rotate(${angle} 32 32)`} d="M31 8h2v6h-2Z" fill={index % 2 ? pale : bright} />;
  });
  switch (visual.form) {
    case 'dome': return <><path d="M9 46V27l5-11 10-7h16l10 7 5 11v19Z" stroke={bright} strokeWidth="2" /><path d="M14 46V27l6-9 9-4" stroke={pale} /><path d="M12 46h40v3H12Z" fill={base} /></>;
    case 'halo': return <><ellipse cx="32" cy="17" rx="22" ry="8" stroke={bright} strokeWidth="3" /><ellipse cx="32" cy="17" rx="16" ry="5" stroke={pale} /><path d="M12 26v14m40-14v14" stroke={base} strokeWidth="3" /></>;
    case 'vortex': return <><path d="m12 15 29-5 13 9-5 18-21 15-17-9 4-16 21-9 11 6-6 16-16 2-4-7 13-6" stroke={bright} strokeWidth="3" /><path d="m18 12 25 1 8 8M12 40l7 8 11 2" stroke={pale} strokeWidth="2" /></>;
    case 'orbit': return <><ellipse cx="32" cy="32" rx="27" ry="13" transform="rotate(-35 32 32)" stroke={bright} strokeWidth="2" /><ellipse cx="32" cy="32" rx="27" ry="13" transform="rotate(35 32 32)" stroke={base} strokeWidth="2" /><path d="M49 15h5v5h-5ZM10 43h4v4h-4Z" fill={pale} /></>;
    case 'runes': return <><path d="M11 20v-9h10m22 0h10v9m0 24v9H43M21 53H11v-9" stroke={bright} strokeWidth="3" />{spokes}<path d="m9 30 3-3 3 3-3 3Zm40 4 3-3 3 3-3 3Z" fill={pale} /></>;
    case 'wings': return <><path d="m26 28-14-17-4 1v18l6 16 12 5-3-12Zm12 0 14-17 4 1v18l-6 16-12 5 3-12Z" fill={base} /><path d="m12 18 8 14m-8-5 7 12m-5 0 8 7m30-28-8 14m8-5-7 12m5 0-8 7" stroke={bright} strokeWidth="2" /></>;
    case 'chains': return <>{[0, 1, 2].flatMap(row => [<rect key={`l${row}`} x={10} y={11 + row * 14} width="9" height="17" rx="3" stroke={row % 2 ? pale : bright} strokeWidth="2" />, <rect key={`r${row}`} x={45} y={8 + row * 14} width="9" height="17" rx="3" stroke={row % 2 ? bright : pale} strokeWidth="2" />])}</>;
    case 'spikes': return <><path d="m9 47 2-29 10 17 1-25 10 17 11-17 1 25 10-17 2 29-12 7H21Z" fill={base} /><path d="m12 44 1-18 7 15m4-5V18l8 15m8 3 2-18m5 23 6-15v18" stroke={bright} strokeWidth="2" /></>;
    case 'rain': return <>{[0, 1, 2, 3, 4, 5].map(index => <path key={index} d={`m${10 + index * 8} ${10 + index % 3 * 4} -3 10 m0 21 -2 7`} stroke={index % 2 ? bright : pale} strokeWidth="2" />)}</>;
    case 'flames': return <><path d="m9 49-1-15 7 7-3-19 11 13-3-23 12 15 11-17-2 23 10-12-1 19 6-7-1 16-13 5H22Z" fill={base} /><path d="m12 47 4-5 9 8m17-1 7-9 4 7" stroke={bright} strokeWidth="3" /></>;
    case 'mist': return <><path d="M9 20h23m4 0h19M7 29h15m23 0h13M5 39h17m20 0h15M11 49h43" stroke={base} strokeWidth="5" /><path d="M8 21h12m25 8h11M6 40h9m26 9h12" stroke={bright} strokeWidth="2" /></>;
    case 'shards': return <>{[0, 1, 2, 3, 4, 5].map(index => <path key={index} transform={`rotate(${index * 60 + visual.variant % 18} 32 32)`} d="m30 6 6 8-4 7-5-9Z" fill={index % 2 ? base : bright} />)}</>;
    case 'roots': return <><path d="M7 49h10l8-12-7-12 1-14m38 38H47L37 36l9-10-2-15M13 14l5 10-9 5m44-14-7 9 10 6M13 52l8-3 6 6m26-3-10-3-6 6" stroke={base} strokeWidth="4" /><path d="m15 50 10-13-7-12m29 25L37 36l9-10" stroke={bright} strokeWidth="2" /></>;
    case 'waves': return <><path d="M7 18q8-9 17 0t17 0 17 0M7 47q8-9 17 0t17 0 17 0" stroke={bright} strokeWidth="3" /><path d="M7 23q8-9 17 0t17 0 17 0M7 52q8-9 17 0t17 0 17 0" stroke={base} strokeWidth="2" /></>;
    case 'crown': return <><path d="m10 18-2-9 13 5L32 5l11 9 13-5-2 9-3 9H13Z" fill={base} /><path d="m12 12 3 8h34l3-8-10 6-10-9-10 9Z" fill={bright} /><path d="M15 24h34v3H15Z" fill={pale} /></>;
    case 'eyes': return <>{[0, 1, 2, 3].map(index => <g key={index} transform={`rotate(${index * 90} 32 32)`}><path d="m22 12 10-5 10 5-10 5Z" fill={base} /><path d="M30 9h4v6h-4Z" fill={pale} /></g>)}</>;
    case 'feathers': return <><path d="m10 12 6 1 5 18-6-4-6-10Zm39 0 6 4-6 14-5 4 1-17ZM10 38l9 8-1 8-6-5Z" fill={bright} /><path d="m12 15 7 17m34-16-6 18m-34 7 4 11" stroke={pale} /></>;
    case 'embers': return <>{[0, 1, 2, 3, 4, 5, 6, 7].map(index => <path key={index} transform={`rotate(${index * 45 + visual.variant % 30} 32 32)`} d={`M${30 + index % 3} ${7 + index % 2 * 3}h3v${4 + index % 3 * 2}h-3Z`} fill={index % 2 ? pale : bright} />)}</>;
    case 'arcs': return <><path d="m10 13 13-3-6 9 4 4m32-10-12-3 6 10-4 4M9 44l12 10-4-10 4-4m32 4-12 10 4-10-4-4" stroke={bright} strokeWidth="3" /><path d="m11 13 12-3m30 34-12 10" stroke={pale} strokeWidth="2" /></>;
    case 'sigil': return <><path d="m32 6 23 39H9Zm0 52L9 19h46Z" stroke={base} strokeWidth="2" /><path d="M16 16h32v32H16Z" stroke={bright} strokeWidth="2" />{spokes}</>;
  }
}

/** Catalogue art follows the aura's authored motif, form, palette and variation. */
export function CatalogAuraIcon({ visual, size = 32 }: { visual: AuraVisualDefinition; size?: number }) {
  const [color, bright, pale] = visual.colors;
  const marks = 1 + visual.variant % 4;
  const centerScale = ['crown', 'halo'].includes(visual.form) ? .77 : .85;
  const centerY = ['crown', 'halo'].includes(visual.form) ? 25 : 19;
  return <svg className="aura-art aura-catalog-art" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" shapeRendering="crispEdges">
    <path d="M5 0h54v5h5v54h-5v5H5v-5H0V5h5Z" fill="#071115" />
    <path d="M6 2h52v4h4v52h-4v4H6v-4H2V6h4Z" fill={color} />
    <path d="M7 5h50v3h3v48h-4v4H8v-3H5V8h2Z" fill="#142329" />
    <path d="M9 9h46v46H9Z" fill={color} opacity=".17" />
    <Composition visual={visual} />
    <path d="M24 16h16l9 10v14l-9 8H24l-9-8V26Z" fill="#0c1a21" opacity=".87" />
    <g transform={`translate(${32 - centerScale * 16} ${centerY}) scale(${centerScale})`}><Motif kind={visual.motif} color={bright} light={pale} /></g>
    <path d="M6 3h12v2H6ZM3 6h2v12H3ZM46 3h12v2H46Z" fill={pale} opacity=".9" />
    <path d="M59 46h2v12h-2ZM46 59h12v2H46Z" fill="#071115" />
    {Array.from({ length: marks }, (_, index) => <path key={index} d={`M${28 - marks * 3 + index * 6} 57h4v3h-4Z`} fill={pale} />)}
    <path d="M5 52h3v3H5ZM56 8h3v3h-3Z" fill={bright} />
  </svg>;
}
