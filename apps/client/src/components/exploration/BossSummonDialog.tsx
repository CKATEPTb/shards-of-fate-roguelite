import { SEASON_BOSS_ORDER, type Season } from '@shards/shared';
import { GameDialog } from './GameDialog';
import { bossSeasonNames, SeasonBossMark } from './SeasonBossTimer';
import './bossSummonDialog.css';

export function BossSummonDialog({ season, onCancel, onConfirm }: { season: Season; onCancel: () => void; onConfirm: () => void }) {
  const nextSeason = SEASON_BOSS_ORDER[SEASON_BOSS_ORDER.indexOf(season) + 1];
  return <GameDialog title="Призыв босса" onClose={onCancel} className="boss-summon-dialog">
    <div className="boss-summon-emblem" data-season={season}><SeasonBossMark season={season} /></div>
    <p className="boss-summon-question">Хотите действительно призвать босса {bossSeasonNames[season]}?</p>
    <p className="boss-summon-description">Он появится рядом с вами и нападёт на героев поблизости.</p>
    <p className="boss-summon-next">{nextSeason ? `Только после победы над этим боссом начнётся отсчёт 20 минут до появления босса ${bossSeasonNames[nextSeason]}.` : 'Последний сезон. Победите всех четырёх боссов, чтобы завершить поход.'}</p>
    <div className="boss-summon-actions"><button className="secondary-button" onClick={onCancel}>Отмена</button><button className="primary-button" onClick={onConfirm}>Призвать</button></div>
  </GameDialog>;
}
