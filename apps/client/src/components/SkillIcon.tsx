import type { ReactNode } from 'react';
import type { SkillIconDefinition } from '@shards/shared';
import './skillIcon.css';

/** The central figures are authored separately from the aura badge compositions. */
function SkillMotif({ motif, bright, pale }: { motif: SkillIconDefinition['motif']; bright: string; pale: string }): ReactNode {
  const contours: Record<SkillIconDefinition['motif'], string> = {
    drop: 'M16 1 27 18v8l-6 6H10l-6-6v-8Z',
    cross: 'M12 1h8v11h11v8H20v12h-8V20H1v-8h11Z',
    leaf: 'm29 2 2 12-6 13-9 5H7l-6-7 3-12 10-7Z',
    skull: 'M8 2h16l7 8v12l-7 5v5H8v-5l-7-5V10Z',
    star: 'm16 0 5 10 11 2-8 9 2 11-10-5-10 5 2-11-8-9 11-2Z',
    flame: 'm20 0 5 8-3 12 6-7 4 10-4 7-9 2H9l-8-9 3-13 6 9-1-9Z',
    crystal: 'm16 0 13 9-4 18-9 5-9-5L3 9Z',
    bolt: 'M19 0h12L20 11h10L7 32l5-14H1Z',
    rock: 'm8 3 15-2 9 11-3 15-18 5L0 21l3-12Z',
    blade: 'M22 0h10v10L13 29l-10-9 6-2Zm-19 18 13 13-4 1L0 21Zm1 7 5 4-5 3-4-4Z',
    fang: 'M2 3h28l-3 14-7 15-3-15-4-2-7 16-2-17Z',
    wisp: 'M16 0h8l-5 9 9 4 4 8-7 11H14l6-9-5-5-8 7-7-7 4-10 4 6 7-3Z',
    hourglass: 'M3 1h26v5l-5 8-4 2 5 4 4 7v5H3v-5l4-7 5-4-4-2-5-8Z',
    claw: 'm7 0 4 8-4 15-7 9 3-17Zm11 1 4 6-5 16-10 9 7-17Zm11-1 3 7-5 16-11 9 8-18Z',
    moon: 'M20 0h8l-8 9v10l8 7h4l-9 6H11l-9-8L0 14l5-9 8-4Z',
    bone: 'M4 0h6l4 4-2 6 10 10 6-2 4 4v6l-4 4h-6l-4-4 2-6L10 12l-6 2-4-4V4Z',
    eye: 'M10 4h12l10 12-10 12H10L0 16Z',
    feather: 'm23 1 9 4-4 14-7 8H11l-8 5-3-3 7-9L8 9l7-5Z',
    rune: 'M12 0h7v10l10-6v8l-10 6v5l10-6v8l-10 7h-7v-9L2 29v-8l10-7V9L2 15V7Z',
    shield: 'm16 0 16 6-3 17-7 6-6 3-6-3-7-6L0 6Z',
  };
  const highlights: Record<SkillIconDefinition['motif'], ReactNode> = {
    drop: <path d="M10 18H7v7l5 4h4v-3l-6-3Z" />,
    cross: <path d="M13 3h3v12H3v-2h10Zm0 17h3v10h-3Z" />,
    leaf: <path d="m25 6 2 2-17 19-4 5-2-2 4-5Zm-14 7h3v7h-3Zm7 10h8v2h-8Z" />,
    skull: <><path d="M8 5h15v3H8ZM5 8h3v5H5Z" /><path d="M7 15h7v7H7Zm11 0h7v7h-7Zm-4 10h4v3h-4Zm-3 4h3v3h-3Zm7 0h3v3h-3Z" fill="#15202e" /></>,
    star: <path d="m16 4 1 11 10-2-10 5-1 10-2-11-9-4 10 2Z" />,
    flame: <path d="m17 12 2 8 6 2-5 8h-8l-4-6 7-2Z" />,
    crystal: <><path d="m16 2-9 9 3 14 6 5Zm2 1 7 8-7 3Z" /><path d="m6 11 10 8 11-8-11 4Z" fill="#24364a" opacity=".5" /></>,
    bolt: <path d="M20 2h7L14 15h8L11 25l6-12H9Z" />,
    rock: <path d="m9 5 12-1 6 8-13 3-10-5Zm12 14 6-4-1 9-6 4Z" />,
    blade: <path d="m24 2 6 1-2 6-17 18-3-3Z" />,
    fang: <path d="M5 6h9l-2 6-4 11Zm16 0h6l-3 11-3 8 1-12Z" />,
    wisp: <path d="m18 8 3 7 6 6-6 7 2-7-9-6Zm-8 6h3v3h-3Z" />,
    hourglass: <path d="M6 3h20v3H6Zm2 5h16l-8 7Zm8 12 8 8H8ZM6 29h20v2H6Z" />,
    claw: <path d="m7 3 1 5-4 17 2-14Zm11 0 2 5-7 18 4-17Zm11 1 1 4-8 18 6-19Z" />,
    moon: <path d="M13 4h5l-7 7-2 8 4 7 5 4h-6l-7-7-2-9 5-7Zm13 6h3v3h3v3h-3v3h-3v-3h-3v-3h3Z" />,
    bone: <path d="M4 3h6v3H4Zm5 5 17 16-3 2L7 10Zm14 16h6v4h-6Z" />,
    eye: <><path d="M11 8h10l7 8-7 8H11l-7-8Z" /><path d="M12 10h8v12h-8Z" fill="#15202e" /><path d="M16 10h4v4h-4Z" fill={bright} /></>,
    feather: <path d="m25 5 2 2-18 21-3-2ZM12 10h3v6h-3Zm9 10h6v3h-6ZM9 15h3v6H9Z" />,
    rune: <path d="M13 2h3v27h-3Zm5 11 9-5v3l-9 5Zm0 12 9-5v3l-9 5Z" />,
    shield: <path d="m15 4-11 5 2 12 6 6 3 2Zm3 0v24l5-4 4-14Z" />,
  };
  return <><path d={contours[motif]} fill={bright} /><g fill={pale}>{highlights[motif]}</g></>;
}

function SkillComposition({ icon }: { icon: SkillIconDefinition }): ReactNode {
  const [base, bright, pale] = icon.colors;
  switch (icon.frame) {
    case 'slash': return <><path d="M8 48 40 10h16L20 53Z" fill={base} /><path d="m10 50 37-38h5L16 52Z" fill={bright} opacity=".65" /><path d="M9 39 33 11m-8 43 28-28" stroke={pale} strokeWidth="2" /><path d="M11 19h6v3h-6Zm35 28h5v3h-5Z" fill={bright} /></>;
    case 'burst': return <><path d="m32 6 5 14 15-11-7 19 14 3-16 9 8 15-17-8-11 12-1-17-15-3 13-9-9-17 17 7Z" fill={base} /><path d="m32 11 2 14 13-10-9 15 14 2-14 5 7 13-12-9-7 12V38l-13-2 14-6-11-13 14 9Z" fill={bright} opacity=".67" /><path d="M9 11h3v4H9Zm44 39h3v3h-3Z" fill={pale} /></>;
    case 'seal': return <><path d="m22 8 24 4 10 20-12 22-25 1L7 34Z" fill="#0b1822" stroke={bright} strokeWidth="2" /><path d="m23 13 19 4 8 15-10 18-18 1-10-17Z" stroke={base} strokeWidth="3" /><path d="M19 11h6v3h-6Zm29 13h5v3h-5ZM19 50h6v3h-6Z" fill={pale} /><path d="m32 14 16 30H16Z" stroke={base} strokeWidth="2" /></>;
    case 'rays': return <>{Array.from({ length: 8 }, (_, index) => <path key={index} transform={`rotate(${45 * index + icon.variant % 14} 32 32)`} d="m30 6 4 0-1 18h-2Z" fill={index % 2 ? base : bright} />)}<circle cx="32" cy="32" r="20" stroke={pale} strokeWidth="1" opacity=".8" /><circle cx="32" cy="32" r="16" stroke={base} strokeWidth="3" /></>;
    case 'orbit': return <><ellipse cx="32" cy="32" rx="26" ry="13" transform="rotate(-34 32 32)" stroke={bright} strokeWidth="2" /><ellipse cx="32" cy="32" rx="24" ry="16" transform="rotate(48 32 32)" stroke={base} strokeWidth="3" /><path d="M48 12h7v7h-7ZM9 43h5v5H9Z" fill={pale} /><path d="M27 7h3v4h-3Zm11 47h3v4h-3Z" fill={bright} /></>;
    case 'ward': return <><path d="m32 6 24 10-4 24-10 12-10 7-11-7-9-12-4-24Z" fill={base} /><path d="m32 10 19 9-3 19-9 11-7 5-8-5-8-11-3-19Z" fill="#102329" stroke={bright} strokeWidth="2" /><path d="m32 13-15 8 3 15 6 10 6 5Z" fill={base} opacity=".65" /><path d="M9 13h3v7H9Zm44 0h3v7h-3Z" fill={pale} /></>;
    case 'weave': return <><path d="M9 12c30 0 18 44 44 40M9 52c29 0 17-40 44-40" stroke={base} strokeWidth="6" /><path d="M10 12c28 0 16 40 43 40M10 52c27 0 17-40 43-40" stroke={bright} strokeWidth="2" /><path d="M16 9h6v6h-6Zm25 38h6v6h-6Zm-3-37h3v3h-3ZM19 47h3v3h-3Z" fill={pale} /></>;
    case 'arrows': return <>{[0, 1, 2].map(index => <g key={index} transform={`translate(${index * 9 - 9} ${index * 4 - 4})`}><path d="m16 47 26-31" stroke={base} strokeWidth="4" /><path d="m17 46 24-29" stroke={pale} strokeWidth="1" /><path d="m37 14 13-6-4 15-5-6Z" fill={index % 2 ? pale : bright} /><path d="m12 37 8 6-3 8-8-6Z" fill={base} /></g>)}</>;
  }
}

/** Skill art uses an action composition plus primary and secondary symbols. */
export function SkillIcon({ icon, size = 32 }: { icon: SkillIconDefinition; size?: number }) {
  const [base, bright, pale] = icon.colors;
  const accentLeft = icon.variant % 2 === 1;
  const tilted = icon.frame === 'slash' ? -12 : icon.frame === 'arrows' ? 9 : 0;
  const glyphScale = icon.accent ? .85 : 1;
  return <svg className="aura-art skill-art" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" fill="none" shapeRendering="crispEdges">
    <path d="M6 0h52l6 6v52l-6 6H6l-6-6V6Z" fill="#071119" />
    <path d="M6 2h52l4 4v52l-4 4H6l-4-4V6Z" fill={base} /><path d="M8 5h48l3 3v48l-3 3H8l-3-3V8Z" fill="#14212a" />
    <path d="M9 9h46v46H9Z" fill={base} opacity=".18" /><SkillComposition icon={icon} />
    <g transform={`rotate(${tilted} 32 32)`}><path d="M23 16h18l8 9v17l-9 7H24l-9-9V25Z" fill="#101922" opacity=".82" />
      <g transform={`translate(${32 - 16 * glyphScale} ${30 - 16 * glyphScale}) scale(${glyphScale})`}><SkillMotif motif={icon.motif} bright={bright} pale={pale} /></g>
    </g>
    {icon.accent && <g transform={`translate(${accentLeft ? 6 : 39} 36)`}><path d="M3 0h14l4 4v14l-4 4H3l-3-4V4Z" fill="#0b171e" stroke={bright} strokeWidth="1" /><g transform="translate(3 3) scale(.5)"><SkillMotif motif={icon.accent} bright={bright} pale={pale} /></g></g>}
    <path d="M6 3h13v2H6ZM3 6h2v13H3Zm42-3h13v2H45Z" fill={pale} /><path d="M59 45h2v13h-2ZM45 59h13v2H45Z" fill="#071119" />
    {Array.from({ length: 1 + icon.variant % 4 }, (_, index) => <path key={index} d={`m${25 + index * 5 - icon.variant % 4 * 2} 57 2-2 2 2-2 2Z`} fill={pale} />)}
  </svg>;
}
