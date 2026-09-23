import type { LoadoutSlot } from './loadoutModel';
import { bodyPartNames } from './body-status-model';
import { DiceLegend, DiceText, type DiceRule } from '../DiceText';
import { EquipmentRarityBadge } from '../EquipmentRarity';

/** Shared description content for hover, keyboard focus, and pinned touch inspection. */
export function LoadoutDescription({ slot }: { slot: LoadoutSlot }) {
  const rules: DiceRule[] = [...(slot.diceRules ?? []), ...(slot.weapon?.damage ? [{
    dice: slot.weapon.damage, modifiable: true,
    reason: 'К базовому броску оружия применяются бонусы силы и урона, предусмотренные текущей атакой. При двух оружиях каждое наносит свой удар.',
  }] : [])];
  return <>
    <span className="loadout-tooltip-category">{slot.category}</span><strong>{slot.occupiedBy ?? slot.name}</strong>
    {slot.rarity && <EquipmentRarityBadge rarity={slot.rarity} />}
    <p><DiceText text={slot.description} rules={rules} /></p>
    {slot.occupiedBy && <span className="loadout-passive-label">Занята двуручным оружием</span>}
    {slot.weapon && <span className="loadout-passive-label">{slot.weapon.hands === 2 ? 'Двуручное · занимает обе руки' : 'Одноручное · любая свободная рука'}</span>}
    {slot.condition && <>
      <span className={`loadout-equipment-state loadout-equipment-${slot.condition}`}>
        {slot.condition === 'unavailable' ? 'Недоступно: конечность отключена или утрачена' : slot.condition === 'partial' ? 'Действует частично: сохранилась половина комплекта' : 'Экипировано'}
      </span>
      {!!slot.armor && <div className="loadout-equipment-armor">Защита каждой покрытой части <b>+{slot.armor}</b></div>}
      {slot.weapon?.damage && <div className="loadout-equipment-armor">Кубик урона оружия <b><DiceText text={slot.weapon.damage} rules={rules} /></b></div>}
      {Object.entries(slot.bonuses ?? {}).filter(([key, value]) => key !== 'healing' && value).map(([key, value]) => <div key={key} className="loadout-equipment-armor">{({ power: 'Сила', initiative: 'Инициатива', evasion: 'Уклонение', crit: 'Критический удар', accuracy: 'Точность', resilience: 'Стойкость', agility: 'Проворность', luck: 'Удача' } as Record<string, string>)[key]} <b>{value! > 0 ? '+' : ''}{value}</b></div>)}
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
    <DiceLegend rules={rules} />
  </>;
}
