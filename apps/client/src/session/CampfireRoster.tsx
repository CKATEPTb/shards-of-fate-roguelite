import { useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { UnitDefinition } from '@shards/shared';
import { gameContent, roleNames } from '../catalog';
import { unitFrameMetrics, unitFramePixels } from '../art/unitFrames';
import { resolveHeroVisualLoadout } from '../art/heroLoadout';
import './campfireRoster.css';

type Occupant = { name: string; isSelf?: boolean; ready?: boolean };
type CampfireRosterProps = {
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  occupants?: Record<string, Occupant>;
  allowedHeroIds?: readonly string[];
  action?: ReactNode;
};

const places = [
  [28, 26, 22, 22], [50, 22, 50, 20], [72, 26, 78, 22],
  [14, 53, 12, 52], [86, 53, 88, 52],
  [23, 77, 17, 83], [41, 85, 39, 83], [59, 85, 61, 83], [77, 77, 83, 83],
] as const;

/** Four code-native idle frames in one image: animation needs no React clock. */
function idleAtlas(hero: UnitDefinition): string {
  const { size } = unitFrameMetrics();
  const equipment = resolveHeroVisualLoadout(hero);
  const paths = new Map<string, string[]>();
  for (let frame = 0; frame < 4; frame++) {
    for (const pixel of unitFramePixels(hero.sprite || hero.id, hero.role, false, 'south', 'idle', frame, undefined, equipment)) {
      const path = paths.get(pixel.color) ?? [];
      path.push(`M${pixel.x + frame * size} ${pixel.y}h1v1h-1z`);
      paths.set(pixel.color, path);
    }
  }
  const body = [...paths].map(([color, path]) => `<path fill="${color}" d="${path.join('')}"/>`).join('');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * 4} ${size}" shape-rendering="crispEdges">${body}</svg>`)}`;
}

const heroes = ['tank', 'healer', 'damage'].flatMap(role => gameContent.characters.filter(hero => hero.role === role))
  .map(hero => ({ ...hero, atlas: idleAtlas(hero) }));

const trees = [
  [10, 112, 1.8], [80, 66, 1.5], [140, 42, 1.25], [215, 24, 1.3],
  [291, 22, 1.05], [375, 9, 1.25], [465, 15, 1.15], [545, 29, 1.3],
  [625, 55, 1.4], [702, 80, 1.75], [758, 139, 1.8],
] as const;
const stones = [[339, 246], [348, 255], [365, 259], [384, 261], [404, 257], [416, 247], [409, 237], [391, 231], [366, 230], [347, 234]];

function Pine({ x, y, scale = 1, foreground = false }: { x: number; y: number; scale?: number; foreground?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path fill={foreground ? '#071615' : '#0a211f'} d="M-4-42h8v50h-8z" />
    <path fill={foreground ? '#091d1b' : '#112d29'} d="M-4-101h8v10h9v11h8v12h9v12h9v13h-8v8h13v13h-14v8h-59v-8h-14v-13h13v-8h-8v-13h9v-12h9v-12h8v-11h9z" />
    <path fill={foreground ? '#102722' : '#193b32'} d="M-4-91h4v15h-8v11h-9v12h-9v7h18v-6h8v17h-12v10h-18v7h30v-73z" />
    <path fill="#315046" opacity=".38" d="M-8-70h8v3h-8zM-24-44h15v3h-15zM-29-21h19v3h-19z" />
  </g>;
}

function Clearing({ id }: { id: string }) {
  return <svg className="campfire-landscape" viewBox="0 0 760 440" preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">
    <defs>
      <radialGradient id={`${id}-light`}><stop offset="0" stopColor="#bd783a" stopOpacity=".3" /><stop offset=".52" stopColor="#815b32" stopOpacity=".17" /><stop offset="1" stopColor="#815b32" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-edge`}><stop offset=".45" stopColor="#030a0c" stopOpacity="0" /><stop offset="1" stopColor="#030a0c" stopOpacity=".66" /></radialGradient>
    </defs>
    <path fill="#102622" d="M0 0h760v440H0z" />
    <path fill="#182c24" d="M146 86h449v24h57v43h49v134h-21v53h-57v45H132v-21H77v-66H47V180h49v-55h50z" />
    <path fill="#203027" d="M212 114h339v23h64v38h37v121h-38v38H149v-30h-38v-94h32v-59h69z" />
    <path fill="#283429" d="M285 135h192v18h57v25h49v118h-52v27H210v-26h-42v-68h36v-46h81z" />
    <path fill="#26332a" d="M315 307h132v35h18v36h28v62H278v-61h20v-37h17z" />
    {Array.from({ length: 90 }, (_, index) => {
      const x = 57 + (index * 83 % 658);
      const y = 85 + (index * 47 % 330);
      return <path key={index} fill={['#43513a', '#0d231e', '#3b4532', '#2c4934'][index % 4]} opacity=".55" d={`M${x} ${y}h${3 + index % 5}v2h-2v2h-${1 + index % 5}z`} />;
    })}
    <g opacity=".6">
      {Array.from({ length: 19 }, (_, index) => <path key={index} fill="#507049" d={`M${25 + index * 39} ${88 + index % 3 * 13}h3v-9h2v7h3v-4h2v11h-10z`} />)}
    </g>
    {trees.map(([x, y, scale], index) => <Pine key={index} x={x} y={y} scale={scale} />)}
    <g fill="#344c37"><path d="M62 250h5v-10h3v14h-8zM79 318h5v-12h3v8h5v8H79zM683 271h4v-13h3v6h4v11h-11zM632 354h4v-10h3v14h-7z" /></g>
    <g fill="#182522"><path d="M92 352h26v8h8v15H84v-15h8zM659 182h25v7h7v14h-40v-14h8zM555 377h16v5h8v11h-32v-10h8z" /></g>
    <g fill="#425041"><path d="M92 352h24v6H92zM659 182h23v6h-23zM555 377h15v5h-15z" /></g>
    <ellipse cx="380" cy="239" rx="300" ry="190" fill={`url(#${id}-light)`} className="campfire-groundlight" />
    <g opacity=".7"><path fill="#352e22" d="M247 209h55v7h-55zM480 213h48v8h-48z" /><path fill="#736045" d="M247 207h55v4h-55zM480 211h48v4h-48z" /><path fill="#242a20" d="M255 216h7v5h-7zM288 216h7v5h-7zM484 221h6v5h-6zM516 221h6v5h-6z" /></g>
    <g className="campfire-clearing-stones">
      <ellipse cx="380" cy="248" rx="51" ry="22" fill="#111b17" />
      {stones.map(([x, y], index) => <g key={index}><path d={`M${x} ${y}h12v4h4v7h-19v-7h3z`} fill="#414438" /><path d={`M${x} ${y}h12v4h-12z`} fill={index > 5 ? '#8b7150' : '#6d6450'} /></g>)}
    </g>
    <Pine x={-9} y={389} scale={1.95} foreground /><Pine x={777} y={383} scale={2.15} foreground />
    <Pine x={30} y={472} scale={1.85} foreground /><Pine x={730} y={466} scale={1.65} foreground />
    <path fill={`url(#${id}-edge)`} d="M0 0h760v440H0z" />
  </svg>;
}

function Hearth() {
  return <div className="campfire-hearth" aria-hidden="true">
    <div className="campfire-fireglow" />
    <svg viewBox="0 0 128 128" shapeRendering="crispEdges">
      <g className="campfire-hearth-stones">
        <ellipse cx="64" cy="111" rx="47" ry="15" fill="#111b17" />
        <path fill="#505044" d="M21 104h10v8H19v-5h2zM24 116h13v7H24zM42 121h13v7H42zM63 122h13v6H63zM84 118h13v8H84zM100 108h10v9h-13v-5h3zM91 99h11v7H91zM26 98h11v7H26z" />
        <path fill="#867354" d="M21 104h10v3H21zM24 116h13v3H24zM42 121h13v3H42zM63 122h13v3H63zM84 118h13v3H84zM100 108h10v3h-10zM91 99h11v3H91zM26 98h11v3H26z" />
      </g>
      <g className="campfire-smoke"><path fill="#b9bea4" d="M61 29h8v-7h9V9h-6v-9h-8v13h-9v9h6z" /><path fill="#b9bea4" d="M49 7h7V0h-7z" /></g>
      <path fill="#231b16" d="M29 102h9v-5h12v6h30v-6h11v6h10v11H87v4H43v-4H29z" />
      <path fill="#70452b" d="M34 97h10v5h13v5h14v5h16v9H72v-5H58v-5H44v-5H34z" />
      <path fill="#8c5530" d="M88 97h10v9H86v5H73v5H58v5H43v-9h15v-5h15v-5h15z" />
      <path fill="#c68a48" d="M36 99h7v4h-7zM88 99h7v4h-7zM46 114h9v4h-9zM75 114h9v4h-9z" />
      <g className="campfire-flames">
        <path fill="#b64522" d="M42 106v-9h-8V77h8V66h6v12h7V59h7V37h7v11h6v14h9v16h7v-8h6v28h-8v9H77v6H53v-7z" />
        <path fill="#e77429" d="M48 103V82h7V69h7V48h7v22h8v14h7v-6h6v19h-8v10H57v-4z" />
        <path fill="#ffb746" d="M53 103V88h8V73h7v-9h6v23h7v17h-7v5H60v-6z" />
        <path fill="#ffe29a" d="M61 103V88h6v-8h4v15h5v10H64v-2z" />
      </g>
      <g className="campfire-flame-tongue" fill="#f29437"><path d="M56 51h5v8h-5zM77 62h4v6h-4z" /></g>
    </svg>
    {Array.from({ length: 6 }, (_, index) => <i key={index} className="campfire-ember" style={{ '--ember-x': `${[-14, 9, -4, 17, -10, 3][index]}px`, '--ember-drift': `${[13, -16, 9, -7, 20, -13][index]}px`, '--ember-delay': `${index * -.85}s`, '--ember-duration': `${3.1 + index * .4}s` } as CSSProperties} />)}
  </div>;
}

export function CampfireRoster({ selectedId, onSelect, disabled = false, occupants = {}, allowedHeroIds, action }: CampfireRosterProps) {
  const id = useId().replace(/:/g, '');
  const heroButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const visibleHeroes = allowedHeroIds ? heroes.filter(hero => allowedHeroIds.includes(hero.id)) : heroes;
  function moveSelection(event: KeyboardEvent<HTMLButtonElement>, currentId: string) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (disabled) return;
    const available = visibleHeroes;
    if (!available.length) return;
    const current = available.findIndex(hero => hero.id === currentId);
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (current + step + available.length) % available.length;
    const nextId = available[next].id;
    heroButtons.current[nextId]?.focus();
    onSelect(nextId);
  }
  return <div className="campfire-roster" data-testid="campfire-roster" data-has-action={Boolean(action) || undefined} role="group" aria-label="Персонаж" aria-describedby={`${id}-hint`}>
    <Clearing id={id} />
    <div className="campfire-mist" aria-hidden="true" />
    <Hearth />
    <p className="campfire-instruction" id={`${id}-hint`}><span aria-hidden="true">✦</span> Выберите героя у костра</p>
    {visibleHeroes.map(hero => {
      const index = heroes.findIndex(character => character.id === hero.id);
      const [x, y, mobileX, mobileY] = places[index];
      const occupant = occupants[hero.id];
      const occupied = Boolean(occupant && !occupant.isSelf);
      const selected = hero.id === selectedId;
      const ownerLabel = occupant ? occupant.isSelf ? 'Вы' : occupant.name : selected ? 'Ваш герой' : '';
      const readinessLabel = occupant?.ready ? 'Готов' : 'Не готов';
      return <button key={hero.id} type="button" className="hero-choice campfire-hero" data-character={hero.id} data-camp-row={index < 3 ? 'back' : index < 5 ? 'side' : 'front'}
        ref={element => { heroButtons.current[hero.id] = element; }}
        aria-pressed={selected} disabled={disabled} data-occupied={occupied || undefined} data-has-occupant={Boolean(occupant) || undefined}
        data-ready={occupant ? Boolean(occupant.ready) : undefined}
        aria-label={`${hero.name} · ${roleNames[hero.role]}${occupant ? ` · ${occupant.isSelf ? 'Вы' : `Занят: ${occupant.name}`} · ${readinessLabel}` : ''}`}
        title={`${hero.name} — ${hero.title}${occupant ? ` · ${ownerLabel} · ${readinessLabel}` : ''}`}
        onClick={() => onSelect(hero.id)}
        onKeyDown={event => moveSelection(event, hero.id)}
        style={{ '--hero-color': hero.color, '--camp-x': `${x}%`, '--camp-y': `${y}%`, '--camp-mobile-x': `${mobileX}%`, '--camp-mobile-y': `${mobileY}%`, '--camp-compact-y': `${index < 3 ? 21 : index < 5 ? 51 : 83}%`, '--camp-shallow-y': `${index < 3 ? 17 : index < 5 ? 50 : 83}%`, '--idle-delay': `${index * -.17}s` } as CSSProperties}>
        <span className="campfire-hero-stage" aria-hidden="true"><span className="campfire-footring" /><span className="campfire-sprite"><img className="campfire-sprite-atlas" src={hero.atlas} alt="" draggable="false" /></span><span className="campfire-selection-mark">◆</span></span>
        <strong className="campfire-hero-name">{hero.name}</strong>
        <span className="campfire-owner" title={occupant ? `${occupant.name} · ${readinessLabel}` : undefined}>{occupant && <span className="campfire-ready-mark" aria-hidden="true">✓</span>}{ownerLabel || '\u00a0'}</span>
      </button>;
    })}
    {action ? <div className="campfire-action">{action}</div> : null}
    <div className="campfire-scene-corner campfire-scene-corner-left" aria-hidden="true" /><div className="campfire-scene-corner campfire-scene-corner-right" aria-hidden="true" />
  </div>;
}
