import { useId, useState } from 'react';
import type { EquipmentSetDefinition } from '@shards/shared';
import { CatalogAuraIcon } from '../CatalogAuraIcon';
import { DiceText } from '../DiceText';
import { modifierDiceRules } from './diceRules';
import './rewardSetSummary.css';

export interface RewardSetSummaryProps {
  set: EquipmentSetDefinition;
  pieces: number;
  activeBonuses: readonly number[];
  nextPieces?: number;
  nextActiveBonuses?: readonly number[];
}

/** Set milestones remain visible; only their long explanations need disclosure. */
export function RewardSetSummary({ set, pieces, activeBonuses, nextPieces, nextActiveBonuses }: RewardSetSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const comparing = nextPieces !== undefined;
  const milestones = (set.bonuses ?? []).map(bonus => {
    const before = activeBonuses.includes(bonus.pieces);
    const after = comparing ? (nextActiveBonuses ?? activeBonuses).includes(bonus.pieces) : before;
    const change = before === after ? after ? 'active' : 'inactive' : after ? 'gain' : 'loss';
    const status = change === 'gain' ? 'Активируется' : change === 'loss' ? 'Будет потерян' : after ? 'Активен' : 'Неактивен';
    return { bonus, before, after, change, status };
  });
  if (!milestones.length) return null;
  return <section className="reward-set-summary" aria-label={`Комплект: ${set.name}`}>
    <div className="reward-set-summary-row">
      <div className="reward-set-summary-name"><strong>{set.name}</strong><span aria-label={comparing ? `Действующих предметов: ${pieces}, после замены: ${nextPieces}` : `Действующих предметов: ${pieces}`}>
        {comparing ? <>{pieces} <span aria-hidden="true">→</span> <b>{nextPieces}</b></> : <b>{pieces}</b>} шт.
      </span></div>
      <div className="reward-set-milestones" aria-label="Бонусы за число предметов">{milestones.map(({ bonus, before, after, change, status }) => <span key={bonus.pieces}
        className="reward-set-milestone" data-state={change} title={`${bonus.pieces} шт.: ${bonus.aura?.name ?? bonus.name}. ${status}`}
        aria-label={`${bonus.pieces} шт.: ${status}`}><b>{bonus.pieces}</b><span aria-hidden="true">{comparing && before !== after ? after ? '+' : '−' : after ? '✓' : '·'}</span>
      </span>)}</div>
      <button type="button" className="reward-set-disclosure" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>
        Бонусы <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
    </div>
    {expanded && <div id={detailsId} className="reward-set-explanations">{milestones.map(({ bonus, change, status }) => <article key={bonus.pieces} data-state={change}>
      <div className="reward-set-bonus-title">{bonus.aura && <CatalogAuraIcon visual={bonus.aura.visual} size={26} />}<strong>{bonus.pieces} · {bonus.aura?.name ?? bonus.name}</strong><small>{status}</small></div>
      <p><DiceText text={bonus.description} rules={modifierDiceRules(bonus.aura?.modifiers ?? bonus.modifiers)} /></p>
      {bonus.aura && bonus.aura.description !== bonus.description && <p><DiceText text={bonus.aura.description} rules={modifierDiceRules(bonus.aura.modifiers)} /></p>}
    </article>)}</div>}
  </section>;
}
