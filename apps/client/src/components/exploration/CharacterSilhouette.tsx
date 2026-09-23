import { useId } from 'react';
import { BODY_PARTS, type BodyPart, type HeroBody } from '@shards/shared';
import { bodyPartNames, bodyPartView } from './body-status-model';

/** Neutral human outline; anatomical right is on the viewer's left. */
export function CharacterSilhouetteIcon() {
  return <svg viewBox="0 0 32 36" fill="none" aria-hidden="true">
    <path d="M19.8 6.4c0 2.4-1.7 4.6-3.8 4.6s-3.8-2.2-3.8-4.6S13.7 2 16 2s3.8 2 3.8 4.4ZM12.5 12.5 8.8 14 6 24.2l2.6.8 3.6-8-.9 9.1L10.4 34h3.5L16 25l2.1 9h3.5l-.9-7.9-.9-9.1 3.6 8 2.6-.8L23.2 14l-3.7-1.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.5 12.5c2 1.8 5 1.8 7 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".6" />
  </svg>;
}

const shapes: Record<BodyPart, { path: string; top: number; bottom: number }> = {
  head: { path: 'M62 10 78 10 86 17 87 34 81 46 76 50 64 50 59 46 53 34 54 17Z', top: 10, bottom: 50 },
  torso: { path: 'M61 55 79 55 86 62 97 67 91 93 85 109 86 134 80 149 60 149 54 134 55 109 49 93 43 67 54 62Z', top: 55, bottom: 149 },
  rightArm: { path: 'M38 70 46 71 50 92 42 119 38 128 35 153 28 170 20 169 18 161 24 144 25 121 28 99 30 79Z', top: 70, bottom: 170 },
  leftArm: { path: 'M102 70 94 71 90 92 98 119 102 128 105 153 112 170 120 169 122 161 116 144 115 121 112 99 110 79Z', top: 70, bottom: 170 },
  rightLeg: { path: 'M56 153 68 153 68 178 63 206 62 217 59 253 61 269 57 280 40 280 37 275 42 266 46 252 46 219 44 207 48 176Z', top: 153, bottom: 280 },
  leftLeg: { path: 'M84 153 72 153 72 178 77 206 78 217 81 253 79 269 83 280 100 280 103 275 98 266 94 252 94 219 96 207 92 176Z', top: 153, bottom: 280 },
};

export function CharacterSilhouette({ body }: { body?: HeroBody }) {
  const id = useId().replace(/:/g, '');
  return <svg className="character-body-diagram" viewBox="0 0 140 300" role="img" aria-label="Схема состояния тела. Правая сторона героя слева на схеме.">
    <defs>{BODY_PARTS.map(part => <clipPath key={part} id={`${id}-${part}`}><path d={shapes[part].path} /></clipPath>)}</defs>
    <g className="character-body-guide" fill="none" stroke="currentColor" strokeWidth=".5"><ellipse cx="70" cy="145" rx="64" ry="130" /><ellipse cx="70" cy="145" rx="52" ry="111" strokeDasharray="2 7" /><path d="M70 3v290M6 145h128M25 54h90M15 216h110" /><path d="m70 2 3 4-3 4-3-4Zm0 288 3 4-3 4-3-4Z" /></g>
    {BODY_PARTS.map(part => {
      const shape = shapes[part];
      const view = body ? bodyPartView(body, part) : undefined;
      const filled = (shape.bottom - shape.top) * (view?.state === 'disabled' ? view.reserve : view?.ratio ?? 1);
      return <g key={part} className={`character-body-segment character-body-${view?.state ?? 'intact'}`}>
        <title>{bodyPartNames[part]}{view ? `: ${view.current} / ${view.max} · ${view.label}` : ''}</title>
        <path d={shape.path} className="character-body-empty" />
        <rect x="0" y={shape.bottom - filled} width="140" height={filled} clipPath={`url(#${id}-${part})`} className="character-body-fill" />
        <path d={shape.path} className="character-body-outline" />
        {view?.state === 'lost' && <path d={`M${part.startsWith('right') ? 23 : part.startsWith('left') ? 91 : 60} ${(shape.top + shape.bottom) / 2 - 7}l14 14m0-14-14 14`} className="character-body-lost-mark" />}
      </g>;
    })}
    <g className="character-body-detail" fill="none" stroke="currentColor" strokeWidth=".8"><path d="M61 69h18M70 69v38M55 112l15 7 15-7M56 137h28M60 42h20M60 159l-6 39M80 159l6 39" /></g>
    <text x="16" y="289">П</text><text x="116" y="289">Л</text>
  </svg>;
}
