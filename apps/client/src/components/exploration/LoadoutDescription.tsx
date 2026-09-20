import type { LoadoutSlot } from './loadoutModel';
import { bodyPartNames } from './body-status-model';

/** Shared description content for hover, keyboard focus, and pinned touch inspection. */
export function LoadoutDescription({ slot }: { slot: LoadoutSlot }) {
  return <>
    <span className="loadout-tooltip-category">{slot.category}</span><strong>{slot.name}</strong>
    <p>{slot.description}</p>
    {slot.condition && <>
      <span className={`loadout-equipment-state loadout-equipment-${slot.condition}`}>
        {slot.condition === 'unavailable' ? 'Недоступно: часть тела утрачена' : slot.condition === 'partial' ? 'Действует частично: сохранилась половина комплекта' : 'Экипировано'}
      </span>
      {!!slot.armor && <div className="loadout-equipment-armor">Общая защита <b>+{slot.armor}</b></div>}
      {!!slot.bonuses?.power && <div className="loadout-equipment-armor">Сила <b>+{slot.bonuses.power}</b></div>}
      {!!slot.bonuses?.healing && <div className="loadout-equipment-armor">Лечение <b>+{slot.bonuses.healing}</b></div>}
      <dl className="loadout-equipment-parts">{slot.bodyParts?.map(part => <div key={part}>
        <dt>{bodyPartNames[part]}</dt>
        <dd>{slot.body?.[part].current ?? 0} / {slot.body?.[part].max ?? 0}
          {!!slot.resources?.[part] && <span>Вклад предмета: +{slot.resources[part]}</span>}</dd>
      </div>)}</dl>
    </>}
    {slot.cooldown && <div className="loadout-cooldown"><span>Перезарядка: {slot.cooldown.base} ходов</span>
      <b>{slot.cooldown.remaining > 0 ? `Осталось: ${slot.cooldown.remaining}` : 'Готово'}</b></div>}
    {!slot.empty && slot.id === 'passive' && !slot.cooldown && <span className="loadout-passive-label">
      {slot.contentId === 'partyDamageReduction' ? 'Постоянный эффект' : 'Пассивный эффект'}
    </span>}
    {slot.empty && <span className="loadout-empty-label">Пусто</span>}
  </>;
}
