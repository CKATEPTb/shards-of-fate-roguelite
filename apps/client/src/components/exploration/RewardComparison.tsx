import { isRingSlot, resolveEquipmentItem, type AdventureReward, type HeroProgress, type StarterEquipment, type UnitDefinition } from '@shards/shared';
import { equipItem, EQUIPMENT_ITEMS } from '@shards/game-data';
import { DiceText } from '../DiceText';
import { EquipmentRarityBadge } from '../EquipmentRarity';
import { EquipmentIcon } from '../EquipmentIcon';
import { bodyPartNames } from './body-status-model';
import { skillDiceRules } from './diceRules';
import { type RewardTarget } from './rewardFitting';
import { RewardArt, rewardName, rewardSkill, rewardSlotNames, signed } from './rewardPresentation';
import { RewardEquipmentDetails } from './RewardEquipmentDetails';
import type { RewardEquipmentComparison } from './rewardComparisonModel';
import './rewardComparison.css';

export interface RewardComparisonProps {
  hero: UnitDefinition;
  progress: HeroProgress;
  comparison: RewardEquipmentComparison;
  reward: AdventureReward;
  target: RewardTarget;
  onTargetChange(target: RewardTarget): void;
  fitted: boolean;
  fixedTarget?: boolean;
  hidePartChanges?: boolean;
  showSetBonuses?: boolean;
}

function itemReward(item: StarterEquipment): AdventureReward {
  return { id: `current:${item.slot}`, kind: 'equipment', definitionId: item.id ?? '', rarity: item.rarity ?? 'common', source: '', luckRolls: [] };
}

const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
function Difference({ before, after, lowerIsBetter = false, inactive = false }: { before: number; after: number; lowerIsBetter?: boolean; inactive?: boolean }) {
  const difference = after - before;
  const direction = !difference || inactive ? 'same' : (lowerIsBetter ? difference < 0 : difference > 0) ? 'gain' : 'loss';
  return <span className="reward-comparison-values"><span>{number(before)}</span><span aria-hidden="true">→</span><b>{number(after)}</b>
    {!!difference && <em data-change={direction}>{signed(difference)}</em>}</span>;
}

function ItemIdentity({ reward, item }: { reward: AdventureReward; item?: StarterEquipment }) {
  return <div className="reward-comparison-item" data-equipment-rarity={reward.rarity}>
    <span className={`reward-comparison-icon${reward.kind === 'equipment' ? ' reward-comparison-equipment-icon' : ''}`}>{item ? <EquipmentIcon item={item} size={32} /> : <RewardArt reward={reward} />}</span>
    <div className="reward-comparison-identity"><strong>{item?.name ?? rewardName(reward)}</strong><EquipmentRarityBadge rarity={reward.rarity} />
      {item && !item.weapon && <small>{rewardSlotNames[item.slot]}</small>}
    </div>
  </div>;
}

/** Preview a replacement against the displayed outfit without changing the fitting. */
export function RewardComparison({ hero, progress, comparison, reward, target, onTargetChange, fitted, fixedTarget = false, hidePartChanges = false, showSetBonuses = true }: RewardComparisonProps) {
  const item = reward.kind === 'equipment' ? resolveEquipmentItem(EQUIPMENT_ITEMS, reward.definitionId) : undefined;
  const addedItem = comparison?.added ?? (item ? equipItem(item.id, item.slot === 'hand' ? 'rightHand' : item.slot) : undefined);
  const skill = reward.kind === 'skill' ? rewardSkill(reward.definitionId) : undefined;
  const skillIndex = target === 'skill1' ? 1 : 0;
  const previousSkill = skill ? rewardSkill(progress.skills[skillIndex]) : undefined;
  // Restore the displayed outfit from the preview, including a moved fitted item's source slot.
  const beforeEquipment = comparison ? [
    ...comparison.preview.equipment.filter(entry => entry !== comparison.added && !comparison.restored.includes(entry)),
    ...comparison.preview.removed,
  ] : [];
  const choices: Array<{ target: RewardTarget; name: string }> = skill
    ? [{ target: 'skill0', name: 'Способность 1' }, { target: 'skill1', name: 'Способность 2' }]
    : item?.slot === 'hand' ? [{ target: 'rightHand', name: 'Правая рука' }, { target: 'leftHand', name: 'Левая рука' }]
      : item && isRingSlot(item.slot) ? [{ target: 'ring1', name: 'Кольцо 1' }, { target: 'ring2', name: 'Кольцо 2' }] : [];

  return <section className="reward-comparison" aria-label="Сравнение награды с текущим снаряжением">
    {!fixedTarget && choices.length > 0 && <div className="reward-comparison-target" role="group" aria-label="Сравнить со слотом">
      <span>Сравнить со слотом</span><div>{choices.map(choice => <button key={choice.target} type="button" aria-pressed={target === choice.target} onClick={() => onTargetChange(choice.target)}>{choice.name}</button>)}</div>
    </div>}
    <div className="reward-comparison-pair">
      <div className="reward-comparison-side"><h4>{skill ? 'Текущая способность' : 'Надето сейчас'}</h4>
        {comparison ? comparison.preview.removed.length ? comparison.preview.removed.map(current => <article className="reward-comparison-equipped" key={current.slot}>
          <ItemIdentity reward={itemReward(current)} item={current} /><RewardEquipmentDetails item={current} body={comparison.beforeBody} showSetBonuses={showSetBonuses}
            equipment={beforeEquipment} compareWith={{ equipment: comparison.preview.equipment, body: comparison.afterBody, direction: 'after' }} />
        </article>)
          : <p className="reward-comparison-empty">Слот свободен</p>
          : previousSkill ? <><ItemIdentity reward={{ ...reward, id: `current:skill${skillIndex}`, definitionId: previousSkill.id, rarity: previousSkill.rarity ?? 'common' }} />
            <p className="reward-comparison-description"><DiceText text={previousSkill.description} rules={skillDiceRules(previousSkill, hero)} /></p>
            <p className="reward-comparison-cooldown">Перезарядка <b>{previousSkill.cooldown} ходов</b></p></>
            : <p className="reward-comparison-empty">{skill ? 'Слот свободен' : 'Выберите подходящий слот'}</p>}
      </div>
      <div className="reward-comparison-side"><h4>{skill ? 'Новая способность' : 'Новый предмет'}{fitted && <span>Примерено</span>}</h4><ItemIdentity reward={reward} item={addedItem} />
        {addedItem && <RewardEquipmentDetails item={addedItem} body={comparison?.afterBody} equipment={comparison?.preview.equipment} showSetBonuses={showSetBonuses}
          compareWith={comparison ? { equipment: beforeEquipment, body: comparison.beforeBody, direction: 'before' } : undefined} />}
        {skill && <><p className="reward-comparison-description"><DiceText text={skill.description} rules={skillDiceRules(skill, hero)} /></p>
          <p className="reward-comparison-cooldown">Перезарядка <b>{skill.cooldown} ходов</b></p></>}
      </div>
    </div>
    {!!comparison?.restored.length && <p className="reward-comparison-restored">{comparison.restored.map(current =>
      `${current.name} вернётся в слот «${rewardSlotNames[current.slot]}»`).join('. ')}.</p>}
    {!hidePartChanges && !!comparison?.parts.length && <section className="reward-comparison-parts" aria-label="Изменения защиты и прочности"><h4>После замены</h4>
      {comparison.parts.map(part => <div className="reward-comparison-part" key={part.part} data-lost={part.lost}>
        <strong>{bodyPartNames[part.part]}{part.lost && <small>Утрачена</small>}</strong><dl>
          {part.beforeArmor !== part.afterArmor && <div><dt>Защита</dt><dd><Difference before={part.beforeArmor} after={part.afterArmor} inactive={part.lost} /></dd></div>}
          {part.beforeMax !== part.afterMax && <div><dt>Макс. прочность</dt><dd><Difference before={part.beforeMax} after={part.afterMax} inactive={part.lost} /></dd></div>}
        </dl>
      </div>)}
    </section>}
    {skill && previousSkill && previousSkill.cooldown !== skill.cooldown && <div className="reward-comparison-skill-change">
      <span>Перезарядка, ходов</span><Difference before={previousSkill.cooldown} after={skill.cooldown} lowerIsBetter />
    </div>}
  </section>;
}
