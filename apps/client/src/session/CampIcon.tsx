export type CampIconName = 'back' | 'party' | 'normal' | 'hard' | 'nightmare';

export function CampIcon({ name }: { name: CampIconName }) {
  const paths: Record<CampIconName, string> = {
    back: 'm14 6-6 6 6 6M8 12h13',
    party: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v1',
    normal: 'M5 19C-1 7 9 3 20 4c1 13-7 19-15 15Zm0 0L16 8',
    hard: 'm4 3 5 1 10 13-3 3L4 7ZM3 17l4 4m-3-1 5-5m8-11 3-1v4l-6 7M14 18l4-4m0 4 3 3',
    nightmare: 'M5 14V9a7 7 0 0 1 14 0v5l-3 2v5H8v-5ZM8 9v2m8-2v2m-5 4 1-2 1 2m-2 3v3m2-3v3M3 3l3 2m15-2-3 2',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
