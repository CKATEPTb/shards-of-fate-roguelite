import type { HeroBody } from '@shards/shared';
import { bodyPartAbbreviations, bodyPartNames, bodyParts, bodyPartView } from './body-status-model';
import './bodyStatus.css';

/** The same six resources are compact in the party HUD and readable by touch in the loadout. */
export function BodyStatus({ body, detailed = false }: { body?: HeroBody; detailed?: boolean }) {
  if (!body) return <span className="body-unavailable">Состояние недоступно</span>;
  return <div className={`body-status ${detailed ? 'body-status-detailed' : 'body-status-compact'}`} aria-label="Состояние частей тела">
    {bodyParts.map(part => {
      const view = bodyPartView(body, part);
      return <div key={part} className={`body-part body-${view.state}`} data-body-part={part} data-body-state={view.state}
        data-current={view.current} data-max={view.max} aria-label={`${bodyPartNames[part]}: ${view.current} из ${view.max}. ${view.label}`}>
        <span className="body-part-name" aria-hidden="true">{detailed ? bodyPartNames[part] : bodyPartAbbreviations[part]}</span>
        {detailed && <span className="body-part-resource" aria-hidden="true">{view.current}<i> / {view.max}</i></span>}
        <span className="body-part-track" aria-hidden="true"><span style={{ width: `${view.ratio * 100}%` }} /></span>
        {view.state === 'lost' && <span className="body-part-cross" aria-hidden="true">×</span>}
        {detailed && <span className="body-part-condition" aria-hidden="true">{view.label}</span>}
      </div>;
    })}
  </div>;
}
