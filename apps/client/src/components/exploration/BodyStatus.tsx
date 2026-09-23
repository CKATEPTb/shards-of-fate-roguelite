import type { BodyResources, HeroBody } from '@shards/shared';
import { bodyPartAbbreviations, bodyPartNames, bodyParts, bodyPartView } from './body-status-model';
import './bodyStatus.css';

/** The same six resources are compact in the party HUD and readable by touch in the loadout. */
function armorDice(value: number): string {
  const full = Math.floor(value / 20), remainder = value % 20;
  return [full ? `${full}d20` : '', remainder ? `1d${remainder}` : ''].filter(Boolean).join(' + ');
}

export function BodyStatus({ body, armor, detailed = false }: { body?: HeroBody; armor?: BodyResources; detailed?: boolean }) {
  if (!body) return <span className="body-unavailable">Состояние недоступно</span>;
  return <div className={`body-status ${detailed ? 'body-status-detailed' : 'body-status-compact'}`} aria-label="Состояние частей тела">
    {bodyParts.map(part => {
      const view = bodyPartView(body, part);
      return <div key={part} className={`body-part body-${view.state}`} data-body-part={part} data-body-state={view.state}
        data-current={view.current} data-max={view.max} aria-label={`${bodyPartNames[part]}: ${view.current} из ${view.max}. ${view.label}`}>
        <span className="body-part-name" aria-hidden="true">{detailed ? bodyPartNames[part] : bodyPartAbbreviations[part]}</span>
        {detailed && <span className="body-part-resource" aria-hidden="true">{view.current}<i> / {view.max}</i></span>}
        <span className="body-part-track" aria-hidden="true"><span style={{ width: `${view.ratio * 100}%` }} /></span>
        {view.state === 'disabled' && <span className="body-part-reserve" title={`До утраты: ${view.current - view.threshold}. Порог: ${view.threshold}`}><span style={{ width: `${view.reserve * 100}%` }} /></span>}
        {view.state === 'lost' && <span className="body-part-cross" aria-hidden="true">×</span>}
        {detailed && <span className="body-part-condition" aria-hidden="true">{view.label}</span>}
        {detailed && view.state !== 'lost' && <span className="body-part-limit">Утрата при {view.threshold}</span>}
        {detailed && armor && armor[part] > 0 && <span className="body-part-armor" title="Броски защиты уменьшают урон только этой части тела">Защита {armor[part]} <b>{armorDice(armor[part])}</b></span>}
      </div>;
    })}
  </div>;
}
