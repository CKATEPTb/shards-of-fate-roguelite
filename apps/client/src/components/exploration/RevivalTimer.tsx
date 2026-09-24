import type { CSSProperties } from 'react';
import { COOP_REVIVE_WINDOW_MS, MOVEMENT_TICK_MS } from '@shards/game-core';
import './seasonBossTimer.css';
import './revival.css';

/** Uses the room's active clock, shared by every player and paused in a saved run. */
export function RevivalTimer({ deadline, tick }: { deadline: number; tick: number }) {
  const milliseconds = Math.max(0, (deadline - tick) * MOVEMENT_TICK_MS);
  const seconds = Math.ceil(milliseconds / 1000);
  const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return <section className="season-boss-timer revival-timer" role={seconds ? 'timer' : 'status'}
    aria-live={seconds ? 'off' : 'polite'} aria-label={seconds ? `Ожидание воскрешения: ${time}` : 'Время на воскрешение истекло'}
    data-urgent={seconds > 0 && seconds <= 30} data-expired={!seconds}
    style={{ '--season-boss-color': '#e6c7a1', '--season-boss-remaining': Math.min(1, milliseconds / COOP_REVIVE_WINDOW_MS) } as CSSProperties}>
    <div className="season-boss-countdown"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 2 12 7v14l-12 7-12-7V9Z" stroke="currentColor" opacity=".45" /><path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5Z" fill="currentColor" opacity=".7" /></svg>
      <span>{seconds ? 'Ожидаем помощи союзника' : 'Время воскрешения истекло'}</span>{seconds > 0 && <time>{time}</time>}
    </div><div className="season-boss-track" aria-hidden="true"><span /></div>
  </section>;
}
