import type { ReactNode } from 'react';

/** Decorative menu scene has no simulation and never loads or advances a run. */
export function MenuFrame({ children }: { children: ReactNode }) {
  return <main className="session-shell" aria-label="Осколки судьбы">
    <div className="menu-forest" aria-hidden="true">
      <svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice">
        <defs><radialGradient id="camp-glow"><stop stopColor="#bd8644" stopOpacity=".38" /><stop offset="1" stopColor="#102019" stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="1020" cy="735" rx="480" ry="400" fill="url(#camp-glow)" />
        {[35, 200, 350, 510, 740, 920, 1140, 1330, 1440].map((x, i) => <g key={x} transform={`translate(${x} ${130 + i % 3 * 120}) scale(${.7 + i % 4 * .2})`} fill={i % 2 ? '#091812' : '#10251b'}>
          <path d="M-12 0H12L24 700H-24Z" /><path d="M0-180-75-20-52-20-115 112-77 100-150 250-106 234-170 385H170L106 234 150 250 77 100 115 112 52-20 75-20Z" />
        </g>)}
        <path d="M0 860Q460 690 790 805T1440 760V1000H0Z" fill="#08140f" />
        <g transform="translate(1050 775)"><ellipse cy="35" rx="150" ry="32" fill="#db9446" opacity=".06" /><path d="M-39 22 37 39 43 27-33 10ZM-38 32 30 7 35 20-33 44Z" fill="#513a29" /><path className="menu-flame" d="M-24 26-28 9-10-17-5 0 8-44 18-8 34 7 20 27Z" fill="#d78643" /><path className="menu-flame flame-inner" d="M-11 25-13 10 3-16 9 7 19 19 10 30Z" fill="#efd18b" /></g>
      </svg>
      <div className="menu-embers"><i /><i /><i /><i /></div>
    </div>
    <div className="session-content">{children}</div>
  </main>;
}
