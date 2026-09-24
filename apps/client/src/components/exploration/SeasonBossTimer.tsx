import type { CSSProperties } from 'react';
import { SEASON_BOSS_INTERVAL_MS, SEASON_BOSS_ORDER, type Season, type SeasonBossProgress } from '@shards/shared';
import { MOVEMENT_TICK_MS } from '@shards/game-core';
import './seasonBossTimer.css';

export const bossSeasonNames: Record<Season, string> = { spring: 'весны', summer: 'лета', autumn: 'осени', winter: 'зимы' };
const seasonColors: Record<Season, string> = { spring: '#afd48b', summer: '#e7c778', autumn: '#dba180', winter: '#acd8e9' };

export function SeasonBossMark({ season }: { season: Season }) {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="M16 2 28 9v14l-12 7-12-7V9Z" stroke="currentColor" strokeWidth=".8" opacity=".45" />
    {season === 'spring' ? <><path d="M10 23c1-10 4-13 13-14-1 10-4 13-13 14Z" fill="currentColor" opacity=".25" /><path d="m9 25 12-14m-8 9-1-6m4 3h5M10 23c1-10 4-13 13-14-1 10-4 13-13 14Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>
      : season === 'summer' ? <><circle cx="16" cy="16" r="5" fill="currentColor" opacity=".25" /><circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="M16 6v2m0 16v2M6 16h2m16 0h2M9 9l2 2m10 10 2 2M23 9l-2 2M11 21l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>
      : season === 'autumn' ? <><path d="m16 7 3 6 6-1-3 5 3 5-8-1-8 1 2-5-3-5 6 1Z" fill="currentColor" opacity=".25" /><path d="m16 7 3 6 6-1-3 5 3 5-8-1-8 1 2-5-3-5 6 1Zm0 8v11m0-7 4-3m-4 3-4-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></>
      : <path d="M16 6v20M7 11l18 10M7 21l18-10M13 8l3 3 3-3m-6 16 3-3 3 3M8 15l4-2-1-4m10 14-1-4 4-2M8 17l4 2-1 4m10-14-1 4 4 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}

/** Simulation time is shared by the host and guests and pauses with the saved game. */
export function SeasonBossTimer({ progress, tick, completed }: { progress: SeasonBossProgress; tick: number; completed: boolean }) {
  const nextSeason = SEASON_BOSS_ORDER.find(season => !progress.spawned.some(spawn => spawn.season === season));
  const currentBoss = progress.spawned.at(-1);
  const awaitingVictory = !completed && progress.nextAtTick === null && !!currentBoss;
  const countingDown = !completed && !!nextSeason && progress.nextAtTick !== null;
  const season = awaitingVictory ? currentBoss!.season : nextSeason ?? 'winter';
  const milliseconds = progress.nextAtTick === null ? 0 : Math.max(0, (progress.nextAtTick - tick) * MOVEMENT_TICK_MS);
  const seconds = Math.ceil(milliseconds / 1000);
  const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const label = completed ? 'Четыре сезона пройдены' : awaitingVictory ? `Победите босса ${bossSeasonNames[season]}`
    : nextSeason ? `Босс ${bossSeasonNames[season]}` : 'Боссы призваны';
  return <section className="season-boss-timer" role={countingDown ? 'timer' : 'status'} aria-live={countingDown ? 'off' : 'polite'} aria-label={`${label}${countingDown ? ` через ${time}` : ''}`}
    data-completed={completed} data-awaiting-victory={awaitingVictory} data-urgent={countingDown && seconds <= 60}
    style={{ '--season-boss-color': seasonColors[season], '--season-boss-remaining': completed ? 1 : Math.min(1, milliseconds / SEASON_BOSS_INTERVAL_MS) } as CSSProperties}>
    <div className="season-boss-countdown"><SeasonBossMark season={season} /><span>{label}</span>{countingDown && <time>{time}</time>}
      <span className="season-boss-stages" aria-label={`Призвано ${progress.spawned.length} из 4`}>{SEASON_BOSS_ORDER.map(stage => <i key={stage} data-spawned={progress.spawned.some(spawn => spawn.season === stage)} />)}</span>
    </div>
    {(countingDown || completed) && <div className="season-boss-track" aria-hidden="true"><span /></div>}
  </section>;
}
