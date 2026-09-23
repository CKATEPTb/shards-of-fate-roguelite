import type { ReactNode } from 'react';
import type { AuraVisualDefinition } from '@shards/shared';
import { gameContent } from '../catalog';
import { CatalogAuraIcon } from './CatalogAuraIcon';
import { SkillIcon } from './SkillIcon';

const aliases: Record<string, string> = {
  tank_taunt: 'taunted', guardian_bastion: 'bastion', vampire_bloodlust: 'bloodlust',
  druid_regrowth: 'regrowth', rogue_precision: 'sure_strike', ranger_volley: 'rapid_fire',
  mage_ignite: 'burning', necromancer_ward: 'bone_shield', priest_prayer: 'prayer',
  paladin_radiance: 'radiance', healer_mend: 'mend', damage_burst: 'burst',
  'guardian:passive': 'guardian', 'vampire:passive': 'vampire', 'paladin:passive': 'paladin',
  'priest:passive': 'inspired', 'druid:passive': 'druid', 'necromancer:passive': 'necromancer',
  'rogue:passive': 'evasion', 'ranger:passive': 'ranger', 'mage:passive': 'mage',
  guardian_safeguard: 'guardian', vampire_siphon: 'vampire', paladin_mercy: 'paladin',
  priest_blessing: 'inspired', mage_burn: 'mage', shield: 'shield',
};

function Shield({ color = '#96b1c2', gold = false }: { color?: string; gold?: boolean }) {
  return <><path d="M12 9h24v19l-4 6-8 6-8-6-4-6Z" fill="#0b141c" /><path d="M14 11h20v16l-4 6-6 4-6-4-4-6Z" fill={gold ? '#967336' : '#405969'} /><path d="M16 13h8v21l-5-4-3-5Z" fill={color} /><path d="M24 13h8v12l-3 5-5 4Z" fill={gold ? '#d7ae61' : '#688999'} /><path d="M16 13h16v2H16Z" fill="#f7e5b0" /><path d="M22 15h4v18h-4Z" fill={gold ? '#ffe7a1' : '#c9e1df'} /></>;
}

function Flame({ small = false }: { small?: boolean }) {
  return <g transform={small ? 'translate(8 6) scale(.7)' : undefined}><path d="m25 7 5 8-2 7 5-4 4 9-1 7-5 6H17l-6-6V23l5 4 1-11 6-4Z" fill="#741f36" /><path d="m24 10 3 6-2 10 6-4 3 7-2 7-6 3h-8l-4-6v-7l5 5 1-12Z" fill="#dd5534" /><path d="m24 17 1 11 5 1-2 8h-9l-3-4 5-1Z" fill="#f7a53d" /><path d="m23 28 3 4-1 5h-5l1-5Z" fill="#fff1af" /><path d="M14 14h2v3h-2Zm19-4h2v4h-2ZM9 20h2v2H9Z" fill="#ffcf73" /></g>;
}

function Flower() {
  return <><path d="M23 22h3v18h-3ZM13 29h7v3h4v4h-6v-3h-5Zm13 1h4v-5h8v5h-4v4h-8Z" fill="#4a8a68" /><path d="M16 12h6V7h6v5h6v7h-6v6h-6v-6h-6Z" fill="#789557" /><path d="M18 13h6V9h3v6h5v3h-6v5h-3v-6h-5Z" fill="#c0db83" /><path d="M23 13h5v6h-5Z" fill="#ffeab5" /><path d="M15 29h4v2h-4Zm17-2h4v2h-4ZM13 39h23v2H13Z" fill="#a6bd77" /></>;
}

function Rays() {
  return <><path d="M22 7h4v7h-4Zm0 27h4v7h-4ZM7 22h7v4H7Zm27 0h7v4h-7ZM11 11h4v4h-4Zm22 0h4v4h-4ZM11 33h4v4h-4Zm22 0h4v4h-4Z" fill="#a9803a" /><path d="M20 15h8v4h5v10h-5v4h-8v-4h-5V19h5Z" fill="#e0b866" /><path d="M22 17h4v6h5v3h-5v6h-4v-6h-5v-3h5Z" fill="#fff2b5" /><path d="M21 20h2v2h-2Z" fill="#fffcee" /></>;
}

function Arrow({ x = 0, y = 0, color = '#cee1b6' }: { x?: number; y?: number; color?: string }) {
  return <g transform={`translate(${x} ${y})`}><path d="m15 29 14-17 2 2-14 17Z" fill="#967f59" /><path d="m25 12 10-5-3 12-3-4Z" fill={color} /><path d="m14 24 4 4-2 7-4-4-4-3Z" fill="#486750" /><path d="m29 11 4-2-2 5Z" fill="#fff1c3" /></g>;
}

function Bones() {
  return <><path d="M10 19v-6h6v-3h18v4H18v3h-4v4ZM34 18h5v14h-5v5H15v-4h17v-3h3V20ZM9 25h4v5H9Z" fill="#507774" /><g fill="#dfd8b9"><path d="M11 11h4v3h10v-3h4v7h-4v-2H15v2h-4Z" /><path d="M20 32h4v2h10v-2h4v7h-4v-3H24v3h-4Z" /><path d="m9 23 3-2 3 4 2 2-3 3-3-4Z" /></g><path d="M19 20h10v3h3v8h-5v3h-6v-3h-5v-8h3Z" fill="#a2aaa0" /><path d="M20 20h8v3h3v4H18v-4h2Z" fill="#eee5c8" /><path d="M20 25h3v3h-3Zm6 0h3v3h-3Zm-3 5h3v3h-3Z" fill="#243c3d" /><path d="M35 9h2v2h-2ZM8 36h2v2H8Z" fill="#a0ceba" /></>;
}

function Daggers() {
  return <><path d="m11 10 5 2 18 24-4 3-19-24Z" fill="#242533" /><path d="m12 10 5 3 12 16-3 3-13-17Z" fill="#8a9ca4" /><path d="m13 11 4 3 10 14-2 1Z" fill="#e4e9d9" /><path d="m35 9 1 7-18 24-4-3 17-24Z" fill="#273241" /><path d="m34 10-1 7-12 15-4-3 13-17Z" fill="#a9c6c0" /><path d="m34 10-3 8-12 13-2-2Z" fill="#f0ead4" /><path d="m12 31 3-4 8 6-2 3ZM25 29l3-3 8 6-2 3Z" fill="#c79759" /><path d="m14 35 3 2-4 5-3-2ZM30 36l3-2 4 5-3 2Z" fill="#694355" /><path d="M23 8h2v4h-2ZM20 10h8v2h-8Z" fill="#f6d792" /></>;
}

function Fang({ bat = false }: { bat?: boolean }) {
  return <>{bat && <path d="m8 15 10 5 6-7 6 7 10-5-3 15-7-2-6 9-6-9-7 2Z" fill="#7a3b56" />}<path d="M13 13h22v8l-5 15-5-10-4 10-6-15Z" fill="#37152a" /><path d="M15 14h18v7H15Z" fill="#ad5368" /><path d="M16 19h6l-2 14-3-7Zm11 0h6l-3 14-3-8Z" fill="#ddd4c7" /><path d="M17 19h3v8h-2Zm11 0h3v8h-2Z" fill="#fff0de" /><path d="m24 31 4 7-1 4h-5l-1-4Z" fill="#d34656" /><path d="M23 37h2v3h-2Z" fill="#ff8c78" /></>;
}

function Artwork({ id }: { id: string }): ReactNode {
  switch (id) {
    case 'taunted': return <><path d="M8 13h3v20H8ZM5 18h2v10H5ZM37 13h3v20h-3Zm4 5h2v10h-2Z" fill="#d69e58" /><path d="M17 11h14v4h4v21l-11 5-11-5V15h4Z" fill="#435364" /><path d="M17 13h7v8H15v-4h2Zm9 0h4v5h3v3h-7Z" fill="#b1bab4" /><path d="M15 23h8v4h-8Zm11 0h7v4h-7Z" fill="#eea968" /><path d="M23 13h3v25h-3ZM16 30h5v2h-5Zm11 0h5v2h-5Zm-9 5h4v2h-4Zm10 0h3v2h-3Z" fill="#d7d4bd" /><path d="M21 7h7v6h-7Z" fill="#9b5541" /></>;
    case 'bastion': return <><Shield color="#ffe1a0" gold /><path d="M18 17h3v4h6v-4h3v13H18Z" fill="#745639" /><path d="M21 22h6v3h-6Zm1 6h4v5h-4Z" fill="#fff0ba" /><path d="M8 12h2v23H8Zm30 0h2v23h-2ZM11 7h26v2H11Z" fill="#bb914c" /></>;
    case 'bloodlust': return <Fang />;
    case 'vampire': return <Fang bat />;
    case 'regrowth': return <Flower />;
    case 'druid': return <><Flower /><path d="M9 12h3v7H9Zm0 0h10v3H9Zm24 22h3v7H26v-3h7Z" fill="#e9d999" /><path d="m15 9 6 5-6 5Zm17 24-6 5 6 5Z" fill="#e9d999" /></>;
    case 'sure_strike': return <Daggers />;
    case 'rapid_fire': return <><Arrow x={-7} y={-4} color="#90b394" /><Arrow x={7} y={4} color="#e7c779" /><Arrow /></>;
    case 'ranger': return <><Arrow x={-4} y={-2} /><Arrow x={7} y={7} color="#dbbc75" /><path d="M8 34h7v3H8Zm3-5 5 6-5 5Z" fill="#d5b977" /></>;
    case 'inspired': return <Rays />;
    case 'radiance': case 'paladin': return <><Shield color="#c5b784" gold /><g transform="translate(7 7) scale(.7)"><Rays /></g>{id === 'paladin' && <path d="M6 29h4v-4h3v4h4v3h-4v4h-3v-4H6Zm25 0h4v-4h3v4h4v3h-4v4h-3v-4h-4Z" fill="#f6dc98" />}</>;
    case 'burning': return <Flame />;
    case 'mage': return <><Flame small /><path d="M10 32h13v2H10Zm3-7h4v4h-4Zm12 12h12v2H25Zm9-7h3v4h-3Z" fill="#bf96c0" /><path d="M10 35h3v3h-3Zm27-15h3v3h-3Z" fill="#eac9d0" /></>;
    case 'poisoned': return <><path d="M19 8h10v6H19Z" fill="#927348" /><path d="M17 14h14v6l5 5v14H12V25l5-5Z" fill="#537275" /><path d="M19 14h4v9l-7 5v8h17v-8l-6-5v-9h2v7l6 5v12H14V26l5-5Z" fill="#abcab6" /><path d="M17 27h14v10H17Z" fill="#6e984a" /><path d="M19 28h10v3H19Z" fill="#c0d879" /><path d="M21 32h3v3h-3Zm5 0h3v3h-3Z" fill="#314b3c" /><path d="M13 16h2v3h-2Zm19-7h3v3h-3Z" fill="#c8e797" /></>;
    case 'fortified': return <><Shield color="#829768" /><path d="m19 15 3 7-4 8 3 4h3l-2-5 3-7-3-7Zm9 0-2 5 3 6-3 7h3l3-7-3-6 1-5Z" fill="#3e5543" /><path d="M12 9h8v4h-8Zm18 24h8v4h-8Z" fill="#799a58" /><path d="M14 9h5v2h-5Zm18 24h5v2h-5Z" fill="#b5cc8d" /></>;
    case 'battle_fervor': return <><path d="M12 8h4v32h-4Z" fill="#806248" /><path d="M13 8h2v31h-2Z" fill="#d2b486" /><path d="M16 10h22l-5 7 5 8H16Z" fill="#8a4344" /><path d="M17 12h16l-4 5 4 6H17Z" fill="#d1784c" /><path d="M21 13h3v7h-3Zm-2 2h7v3h-7Z" fill="#f6cf82" /><path d="M8 40h16v2H8Z" fill="#655f4c" /></>;
    case 'bone_shield': case 'necromancer': return <Bones />;
    case 'guardian': return <><Shield color="#a8c4cc" /><path d="M7 31h7v4H7Zm-2 4h11v6H5Zm28-4h7v4h-7Zm-2 4h11v6H31Z" fill="#8c9d89" /><path d="M8 32h5v3H8Zm26 0h5v3h-5Z" fill="#e1d4ac" /></>;
    case 'evasion': return <><path d="m21 10 8-1 5 5-1 8-5 5-5-3-2-6Z" fill="#d3cfc1" /><path d="M20 10h6v10h-6Zm2 15h7l-5 7-8 9-4-3 9-13Z" fill="#77708e" /><path d="m17 9-5 2 2 10-4 7-5 7 3 3 8-9 3-9Z" fill="#3f4d63" /><path d="M31 30h10v3H31Zm5-4 6 5-6 6Z" fill="#ccb986" /><path d="M7 14h6v2H7ZM5 21h6v2H5Z" fill="#8095a1" /></>;
    case 'prayer': return <><Rays /><path d="M14 30h6l4-8 4 8h6v9H14Z" fill="#ab8b74" /><path d="M20 28h3v11h-5V33Zm5 0h3l2 5v6h-5Z" fill="#f0d4a7" /></>;
    case 'mend': return <><path d="M18 9h12v10h10v11H30v10H18V30H8V19h10Z" fill="#436f60" /><path d="M20 11h8v10h10v7H28v10h-8V28H10v-7h10Z" fill="#9ac7a2" /><path d="M21 12h3v13H11v-3h10Z" fill="#edf0c4" /><path d="M7 8h3v3H7Zm30 0h3v3h-3ZM7 37h3v3H7Zm30 0h3v3h-3Z" fill="#ddc67a" /></>;
    case 'burst': return <><path d="m24 5 4 12 12-5-7 11 9 5-13 2 2 12-9-10-11 7 4-13-10-4 12-4Z" fill="#85534d" /><path d="m24 11 2 11 10-5-7 9 7 3-11 1 1 8-6-8-8 4 5-10-6-2 11-1Z" fill="#dba059" /><path d="m23 20 6 7-7 5-3-7Z" fill="#fff0b0" /></>;
    default: return <Shield />;
  }
}

/** Authored pixel illustrations share a carved frame, not a generic status glyph. */
export function AuraIcon({ id, size = 32, visual }: { id: string; size?: number; visual?: AuraVisualDefinition }) {
  const skillIcon = gameContent.skills.find(skill => skill.id === id)?.icon;
  if (skillIcon) return <SkillIcon icon={skillIcon} size={size} />;
  const kind = aliases[id] ?? id;
  const catalogueVisual = visual ?? gameContent.statuses.find(status => status.id === kind)?.visual;
  if (catalogueVisual) return <CatalogAuraIcon visual={catalogueVisual} size={size} />;
  const warm = ['taunted', 'bastion', 'inspired', 'prayer', 'radiance', 'paladin', 'burst'].includes(kind);
  const red = ['bloodlust', 'vampire', 'burning', 'mage', 'battle_fervor'].includes(kind);
  const rim = warm ? '#a48c57' : red ? '#855965' : '#627d74';
  return <svg className="aura-art" width={size} height={size} viewBox="0 0 48 48" fill="none" shapeRendering="crispEdges" aria-hidden="true">
    <path d="M4 0h40v4h4v40h-4v4H4v-4H0V4h4Z" fill="#091519" />
    <path d="M4 2h40v4h2v36h-4v4H6v-2H2V6h2Z" fill={rim} />
    <path d="M6 5h36v37H6Z" fill={red ? '#291b28' : warm ? '#26271f' : '#172b2b'} />
    <path d="M8 7h31v2H8Zm0 2h2v30H8Z" fill={red ? '#49303f' : warm ? '#484330' : '#30443c'} />
    <path d="M10 39h30v2H10ZM40 9h2v32h-2Z" fill="#0c181d" />
    <Artwork id={kind} />
    <path d="M4 3h6v2H4ZM3 5h2v5H3Zm35 0h5v2h-5ZM5 38h2v5H5Z" fill={warm ? '#e4ce8e' : '#a4b4a1'} />
    <path d="M38 43h5v2h-5ZM43 38h2v5h-2Z" fill="#35423f" />
  </svg>;
}
