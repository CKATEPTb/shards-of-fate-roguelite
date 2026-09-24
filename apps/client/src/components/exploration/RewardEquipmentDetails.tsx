import { BODY_PARTS, weaponAttackBonusMultiplier, type HeroBody, type StarterEquipment } from '@shards/shared';
import { equipmentCondition } from '@shards/game-core';
import { EQUIPMENT_SETS } from '@shards/game-data';
import { DiceText, type DiceRule } from '../DiceText';
import { bodyPartNames } from './body-status-model';
import { rewardAttributes, signed } from './rewardPresentation';
import { RewardSetSummary, type EquipmentSetComparisonContext } from './RewardSetSummary';
import './rewardEquipmentDetails.css';

export interface RewardEquipmentDetailsProps {
  item: StarterEquipment;
  body?: HeroBody;
  /** The outfit displayed by this card, with its matching body state. */
  equipment?: readonly StarterEquipment[];
  compareWith?: EquipmentSetComparisonContext;
  showSetBonuses?: boolean;
}

/** Item descriptions and contributions are always expanded. */
export function RewardEquipmentDetails({ item, body, equipment = [], compareWith, showSetBonuses = true }: RewardEquipmentDetailsProps) {
  const condition = body ? equipmentCondition(item, body) : undefined;
  const fraction = condition?.bonusFraction ?? 1;
  const dice = item.weapon?.damage;
  const doubledAttack = weaponAttackBonusMultiplier(item.weapon) === 2;
  const rules: DiceRule[] = dice ? [{ dice, modifiable: true,
    reason: doubledAttack
      ? 'В обычной атаке базовые кубики оружия бросаются один раз. Вклад Силы и числовые бонусы урона удваиваются; каждый бонусный кубик урона бросается дважды.'
      : 'Базовый бросок оружия получает применимые бонусы атаки. При двух оружиях каждое наносит свой отдельный удар.' }] : [];
  const attributes = rewardAttributes.filter(([key]) => item.bonuses?.[key]);
  const set = item.setId ? EQUIPMENT_SETS[item.setId] : undefined;
  const parts = BODY_PARTS.filter(part => item.resources[part] || item.armor && item.bodyParts.includes(part)).map(part => ({
    part, name: bodyPartNames[part], resource: item.resources[part] ?? 0,
    armor: item.bodyParts.includes(part) ? item.armor : 0, lost: !!body?.[part].lost,
  }));
  for (const [first, second, label] of [['leftArm', 'rightArm', 'Каждая рука'], ['leftLeg', 'rightLeg', 'Каждая нога']] as const) {
    const left = parts.find(part => part.part === first), right = parts.find(part => part.part === second);
    if (left && right && left.resource === right.resource && left.armor === right.armor && left.lost === right.lost) {
      left.name = label;
      parts.splice(parts.indexOf(right), 1);
    }
  }
  return <div className="reward-equipment-details">
    {condition && (!condition.active || condition.fraction < 1) && <p className="reward-equipment-condition">
      {!condition.active ? 'Не действует из-за состояния конечностей.' : 'Действует частично: часть тела утрачена.'}
    </p>}
    {item.weapon && <div className="reward-equipment-weapon">
      <span>{item.weapon.hands === 2 ? 'Двуручное' : 'Одноручное'}</span>
      <p>{dice ? <>Базовый урон <strong><DiceText text={dice} rules={rules} /></strong></> : 'Щит · без урона'}</p>
    </div>}
    {doubledAttack && <p className="reward-equipment-description">Обычная атака: вклад Силы и числовые бонусы урона ×2; каждый бонусный кубик урона бросается дважды.</p>}
    {!!attributes.length && <section className="reward-equipment-attributes" aria-label="Бонусы предмета">
      <dl>{attributes.map(([key, name]) => {
        const base = item.bonuses![key]!, effective = base * fraction;
        return <div key={key}><dt>{name}</dt><dd data-change={effective > 0 ? 'gain' : effective < 0 ? 'loss' : 'same'}>
          {signed(effective)}{effective !== base && <small>из {signed(base)}</small>}
        </dd></div>;
      })}</dl>
    </section>}
    {!!parts.length && <section className="reward-equipment-parts" aria-label="Прочность и защита от предмета">
      {parts.map(part => <div key={part.part} data-lost={part.lost || undefined}>
        <strong>{part.name}</strong><div>
          {!!part.resource && <span>Прочность <b>{signed(part.resource)}</b></span>}
          {!!part.armor && <span>Защита <b>{signed(part.armor)}</b></span>}
        </div>{part.lost && <small>Не действует: утрачена</small>}
      </div>)}
    </section>}
    <p className="reward-equipment-description"><DiceText text={item.description} rules={rules} /></p>
    {set && showSetBonuses && <RewardSetSummary set={set} item={item} equipment={equipment} body={body} compareWith={compareWith} />}
  </div>;
}
