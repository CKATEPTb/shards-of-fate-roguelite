import type { LoadoutIconKind } from './loadoutModel';

/** Small distinct silhouettes remain recognizable without pretending an empty slot holds an item. */
export function LoadoutIcon({ kind }: { kind: LoadoutIconKind }) {
  const shapes = {
    helmet: <><path d="M7 22V12a7 7 0 0 1 14 0v10l-5-3h-4Z" /><path d="M7 13h14M14 5v13M9 16h2m6 0h2" /></>,
    chest: <><path d="m9 5 5 3 5-3 5 5-4 4v9H8v-9l-4-4Z" /><path d="M11 7v7l3 3 3-3V7M8 20h12" /></>,
    gloves: <><path d="M9 24 6 15c-1-3 2-4 3-1l1 2V6c0-2 3-2 3 0v7-9c0-2 3-2 3 0v9-7c0-2 3-2 3 0v8-4c0-2 3-2 3 0v8l-3 6Z" /><path d="M9 21h11" /></>,
    pants: <><path d="M8 4h12l2 20h-7l-1-12-1 12H6Z" /><path d="M8 8h12M14 4v5M7 21h6m2 0h6" /></>,
    boots: <><path d="M5 4h7v12l3 4v4H3v-6l2-2ZM17 4h7v12l2 4v4h-9v-6" /><path d="M5 8h7m5 0h7M3 21h12m3 0h8" /></>,
    amulet: <><path d="M6 4c0 8 3 11 8 13 5-2 8-5 8-13" /><path d="m14 13 6 6-6 7-6-7Z" /><path d="m14 17 2 2-2 3-2-3Z" /></>,
    ring1: <><circle cx="14" cy="17" r="8" /><path d="m14 2 5 5-5 5-5-5ZM10 16a5 5 0 0 0 4 6" /></>,
    ring2: <><circle cx="14" cy="17" r="8" /><path d="m9 5 5-3 5 3-2 6h-6ZM12 5h4m1 11a5 5 0 0 1-3 6" /></>,
    mainHand: <><path d="m7 19 14-16 4 1-1 4-15 14M5 16l8 8M7 21l-4 4m0-3 3 3M11 17l10-11" /></>,
    offHand: <><path d="m14 3 10 4-2 11-8 7-8-7L4 7Z" /><path d="M14 6v15M7 9l7-3 7 3M7 12h14" /></>,
    class: <><path d="m14 7 6 3-1 9-5 4-5-4-1-9Z" /><path d="M14 11v5m0 3h.1M4 9l-2 5 2 5m20-10 2 5-2 5M8 4l6-3 6 3" /></>,
    characterActive: <><path d="M4 24V10h4V5h4v5h4V5h4v5h4v14ZM3 24h22M11 24v-6a3 3 0 0 1 6 0v6" /><path d="M7 13v3m14-3v3M14 1v2" /></>,
    passive: <><path d="m14 3 7 3-1 7-6 5-6-5-1-7Z" /><path d="m11 10 2 2 4-5M4 24v-3a4 4 0 0 1 7 0v3m6 0v-3a4 4 0 0 1 7 0v3" /><circle cx="7.5" cy="17" r="2" /><circle cx="20.5" cy="17" r="2" /></>,
    mend: <><path d="M11 4h6v7h7v6h-7v7h-6v-7H4v-6h7Z" /><path d="m4 4 2 2m16-2-2 2M4 24l2-2m16 2-2-2" /></>,
    burst: <><path d="m14 2 2 8 7-5-4 8 7 2-8 2 4 8-8-5-7 5 3-8-8-2 8-2-4-8 7 5Z" /><circle cx="14" cy="15" r="3" /></>,
    blood: <><path d="M14 3C11 9 6 12 6 18a8 8 0 0 0 16 0c0-6-5-9-8-15Z" /><path d="M10 17c-2 4 2 6 4 6M3 8l3 4m19-4-3 4" /></>,
    radiance: <><circle cx="14" cy="14" r="6" /><path d="M14 2v4m0 16v4M2 14h4m16 0h4M5 5l3 3m12 12 3 3M23 5l-3 3M8 20l-3 3M11 14h6m-3-3v6" /></>,
    prayer: <><path d="m8 23 6-9 6 9M14 14V5M10 9l4-4 4 4M4 17l4-5m16 5-4-5M3 24h22" /><path d="M11 2h6M6 5l1 2m15-2-1 2" /></>,
    regrowth: <><path d="M14 25V10M14 18C4 19 4 10 4 10s10-1 10 8ZM14 13C24 14 24 4 24 4S14 3 14 13Z" /><path d="m7 13 7 5m6-10-6 5M8 25h12" /></>,
    ward: <><path d="m14 2 11 5-2 12-9 7-9-7L3 7Z" /><path d="M8 13a6 6 0 0 1 12 0v4l-3 1v3h-6v-3l-3-1Z" /><circle cx="11" cy="13" r="1" /><circle cx="17" cy="13" r="1" /></>,
    precision: <><circle cx="14" cy="14" r="8" /><circle cx="14" cy="14" r="3" /><path d="M14 2v7m0 10v7M2 14h7m10 0h7M22 3l3 3m-1-3-8 8" /></>,
    volley: <><path d="M5 24 19 4m-7 20L25 5M3 13l7-10M15 5l4-1 1 4m1-2 4-1v5M6 4l4-1v5M3 19l4 3m3-3 4 3M2 10l3 2" /></>,
    fire: <><path d="M16 2c3 9-4 8-1 13 2-1 4-3 5-6 8 12 1 17-6 17S2 20 5 13c1 3 3 4 4 4-2-7 5-9 7-15Z" /><path d="M14 16c-5 5-3 8 1 8 3 0 4-3-1-8Z" /></>,
    evasion: <><path d="M5 4c8 1 11 6 8 12l-6 8M8 3l-3 1 1 4M18 6l6 6-6 6M14 12h10M3 19l4 5 6-1" /><path d="M17 22h7m-4-3 4 3-4 3" /></>,
    extra: <><path d="m14 4 10 10-10 10L4 14Z" strokeDasharray="2 3" /><path d="M10 14h8m-4-4v8" /></>,
  };
  return <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[kind]}</svg>;
}
