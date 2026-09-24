import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BODY_PARTS, COMMON_NATIVE_SKILL_RARITIES, NPC_EQUIPMENT_UPGRADE_PRICES, NPC_SKILL_UPGRADE_PRICES, REWARD_RARITIES,
  applyNativeSkillRarities, baseSkillId, listHeroAbilityUpgrades, nextEquipmentUpgrade, resolveEquipmentItem,
  type EquipmentItemDefinition, type EquipmentSlot, type HeroAbilityPreview, type HeroProgress,
  type NpcKind, type NpcOffer, type NpcSkillSlot, type RewardRarity, type UnitDefinition,
} from '@shards/shared';
import { merchantOffers } from '@shards/game-core';
import { gameContent } from '../../catalog';
import { DiceText, type DiceRule } from '../DiceText';
import { EquipmentIcon } from '../EquipmentIcon';
import { EQUIPMENT_RARITY_NAMES, EquipmentRarityBadge } from '../EquipmentRarity';
import { SkillIcon } from '../SkillIcon';
import { GameDialog } from './GameDialog';
import { LoadoutIcon } from './LoadoutIcon';
import { activeLoadoutSlot, passiveLoadoutSlot } from './loadoutSkills';
import { passiveDiceRules, skillDiceRules } from './diceRules';
import { bodyPartNames } from './body-status-model';
import { rewardAttributes, rewardSlotNames, signed } from './rewardPresentation';
import './npcServiceDialog.css';

export interface NpcServiceDialogProps {
  kind: NpcKind;
  seed: string;
  poiId: string;
  heroId: string;
  progress: HeroProgress;
  onClose(): void;
  onBuy(offerId: string): boolean;
  onUpgradeEquipment(slot: EquipmentSlot, expectedItemId: string): boolean;
  onUpgradeSkill(slot: NpcSkillSlot, expectedId: string, expectedRarity: RewardRarity): boolean;
}

const equipmentSlots: EquipmentSlot[] = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand'];
const abilityNames: Record<NpcSkillSlot, string> = { class: 'Классовый', active: 'Активный', passive: 'Пассивный', skill0: 'Способность I', skill1: 'Способность II' };
const serviceNames: Record<NpcKind, string> = { merchant: 'Лавка странника', blacksmith: 'Кузница', scribe: 'Скрипторий' };
const serviceHints: Record<NpcKind, string> = {
  merchant: 'Комплекты и способности. Покупки отправятся в вашу сумку.',
  blacksmith: 'Выберите надетый предмет. Улучшение сохранит его облик и комплект.',
  scribe: 'Выберите способность. Мастер усилит её на одну ступень редкости.',
};
const number = (value: number) => value.toLocaleString('ru-RU');
type PendingPurchase = { type: 'buy'; id: string } | { type: 'equipment'; slot: EquipmentSlot; before: string; after: string }
  | { type: 'skill'; slot: NpcSkillSlot; before: HeroAbilityPreview; after: HeroAbilityPreview };

function Coins({ value }: { value: number }) {
  return <span className="npc-coins" aria-label={`${number(value)} монет`}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><circle cx="10" cy="10" r="5.5" /><path d="m10 5 3 5-3 5-3-5Z" /></svg><b>{number(value)}</b></span>;
}

function AbilityArt({ ability, slot, hero }: { ability: HeroAbilityPreview; slot?: NpcSkillSlot; hero?: UnitDefinition }) {
  if (ability.icon) return <SkillIcon icon={ability.icon} size={38} />;
  const skill = ability.skill && { ...ability.skill, id: baseSkillId(ability.skill.id) };
  const kind = slot === 'passive' ? passiveLoadoutSlot(hero, undefined, gameContent).icon
    : activeLoadoutSlot(slot === 'class' ? 'class' : slot === 'active' ? 'characterActive' : 'extra1', '', skill, undefined, gameContent).icon;
  return <LoadoutIcon kind={kind} />;
}

function offerSkill(offer: NpcOffer): HeroAbilityPreview | undefined {
  const skill = gameContent.skills.find(entry => entry.id === offer.definitionId);
  return skill ? { id: skill.id, name: skill.name, description: skill.description, rarity: offer.rarity, iconId: baseSkillId(skill.id), icon: skill.icon, skill } : undefined;
}

function offerInfo(offer: NpcOffer): { name: string; art: ReactNode } {
  if (offer.kind === 'skill') {
    const skill = offerSkill(offer);
    return { name: skill?.name ?? 'Способность', art: skill ? <AbilityArt ability={skill} /> : <LoadoutIcon kind="extra" /> };
  }
  const set = gameContent.equipmentCatalog?.sets[offer.definitionId];
  const item = set?.itemIds.map(id => resolveEquipmentItem(gameContent.equipmentCatalog?.items, id)).find(Boolean);
  return { name: set?.name ?? 'Комплект', art: item ? <EquipmentIcon item={item} size={38} /> : <LoadoutIcon kind="chest" /> };
}

function MerchantDetails({ offer }: { offer: NpcOffer }) {
  const info = offerInfo(offer), skill = offer.kind === 'skill' ? offerSkill(offer) : undefined;
  const set = offer.kind === 'set' ? gameContent.equipmentCatalog?.sets[offer.definitionId] : undefined;
  const items = set?.itemIds.flatMap(id => resolveEquipmentItem(gameContent.equipmentCatalog?.items, id) ?? []) ?? [];
  return <section className="npc-offer-detail" aria-label="Описание предложения">
    <div className="npc-detail-identity" data-equipment-rarity={offer.rarity}><span className="npc-art">{info.art}</span><div><EquipmentRarityBadge rarity={offer.rarity} /><h3>{info.name}</h3></div></div>
    {skill && <><p className="npc-description"><DiceText text={skill.description} rules={skill.skill ? skillDiceRules(skill.skill, undefined, gameContent) : []} /></p>
      <p className="npc-detail-note">Перезарядка: <strong>{skill.skill?.cooldown ?? 0} ходов</strong> · Для одного из двух слотов способностей</p></>}
    {set && <><p className="npc-description">{set.description}</p><h4 className="npc-small-heading">Весь комплект · {items.length} предметов</h4>
      <div className="npc-set-items">{items.map(item => <div key={item.id} data-equipment-rarity={item.rarity}><EquipmentIcon item={item} size={30} /><span>{item.name}</span></div>)}</div>
      {!!set.bonuses?.length && <div className="npc-set-bonuses" aria-label="Бонусы комплекта">{set.bonuses.map(bonus => <p key={bonus.pieces}><b>{bonus.pieces} части</b><span><strong>{bonus.name}</strong><DiceText text={bonus.description} />{bonus.aura && bonus.aura.description !== bonus.description && <DiceText text={` ${bonus.aura.description}`} />}</span></p>)}</div>}
    </>}
    <p className="npc-detail-note">{offer.kind === 'set' ? 'Все части попадут в сумку. Надетые вещи останутся на герое.' : 'Покупка попадёт в сумку. Назначить её можно в окне персонажа.'}</p>
  </section>;
}

function EquipmentChanges({ before, after }: { before: EquipmentItemDefinition; after: EquipmentItemDefinition }) {
  const comparing = before.id !== after.id;
  const rows: Array<{ label: string; before: number | string; after: number | string }> = [];
  if (before.weapon?.damage || after.weapon?.damage) rows.push({ label: 'Кубик оружия', before: before.weapon?.damage ?? '—', after: after.weapon?.damage ?? '—' });
  if (before.armor || after.armor) rows.push({ label: 'Защита', before: before.armor, after: after.armor });
  const parts = new Set<string>();
  for (const part of BODY_PARTS) {
    if (parts.has(part) || !before.resources[part] && !after.resources[part]) continue;
    let label = `Прочность · ${bodyPartNames[part].toLocaleLowerCase('ru')}`;
    const partner = part === 'leftArm' ? 'rightArm' : part === 'leftLeg' ? 'rightLeg' : undefined;
    if (partner && before.resources[part] === before.resources[partner] && after.resources[part] === after.resources[partner]) {
      parts.add(partner); label = `Прочность · ${part === 'leftArm' ? 'каждая рука' : 'каждая нога'}`;
    }
    rows.push({ label, before: before.resources[part] ?? 0, after: after.resources[part] ?? 0 });
  }
  for (const [key, label] of rewardAttributes) if (before.bonuses?.[key] || after.bonuses?.[key]) rows.push({ label, before: before.bonuses?.[key] ?? 0, after: after.bonuses?.[key] ?? 0 });
  return <dl className="npc-stat-changes" aria-label={comparing ? 'Изменения характеристик предмета' : 'Характеристики предмета'}>{rows.map(row => {
    const diff = typeof row.before === 'number' && typeof row.after === 'number' ? row.after - row.before : undefined;
    return <div key={row.label} data-change={diff === undefined ? row.before === row.after ? 'same' : 'gain' : diff > 0 ? 'gain' : diff < 0 ? 'loss' : 'same'}>
      <dt>{row.label}</dt><dd>{comparing ? <><span>{row.before}</span><span aria-hidden="true">→</span><b>{row.after}</b>{!!diff && <em>{signed(diff)}</em>}</> : <b>{row.before}</b>}</dd>
    </div>;
  })}</dl>;
}

function EquipmentDetails({ before, after }: { before: EquipmentItemDefinition; after?: EquipmentItemDefinition }) {
  const set = before.setId ? gameContent.equipmentCatalog?.sets[before.setId] : undefined;
  return <><div className="npc-comparison">
    {[{ item: before, title: 'Сейчас' }, { item: after, title: 'После улучшения' }].map(({ item, title }) => <article key={title} className="npc-comparison-card" data-equipment-rarity={item?.rarity}>
      <h4>{title}</h4>{item ? <div className="npc-detail-identity"><span className="npc-art"><EquipmentIcon item={item} size={38} /></span><div><EquipmentRarityBadge rarity={item.rarity} /><h3>{item.name}</h3></div></div>
        : <div className="npc-max-rarity"><span aria-hidden="true">✧</span><strong>Высшая редкость</strong><p>Этот предмет уже легендарный.</p></div>}
    </article>)}
  </div><EquipmentChanges before={before} after={after ?? before} /><p className="npc-description">{before.description}</p>
    {set && <p className="npc-detail-note">Комплект «{set.name}». Улучшение сохраняет все его связи и бонусы.</p>}
  </>;
}

function descriptionParts(text: string, other?: string): [string, string, string] {
  if (!other || text === other) return [text, '', ''];
  const words = text.split(/(\s+)/), compared = other.split(/(\s+)/);
  let first = 0, last = 0;
  while (first < words.length && first < compared.length && words[first] === compared[first]) first++;
  while (last < words.length - first && last < compared.length - first && words[words.length - last - 1] === compared[compared.length - last - 1]) last++;
  return [words.slice(0, first).join(''), words.slice(first, words.length - last).join(''), last ? words.slice(-last).join('') : ''];
}

function AbilityDetails({ current, next, slot, hero, progress }: { current: HeroAbilityPreview; next: HeroAbilityPreview | null; slot: NpcSkillSlot; hero: UnitDefinition; progress: HeroProgress }) {
  const rulesFor = (ability: HeroAbilityPreview): DiceRule[] => ability.skill ? skillDiceRules(ability.skill, undefined, gameContent)
    : passiveDiceRules(applyNativeSkillRarities(hero, { nativeSkillRarities: { ...(progress.nativeSkillRarities ?? COMMON_NATIVE_SKILL_RARITIES), passive: ability.rarity } }, gameContent), gameContent);
  return <><div className="npc-comparison">{[{ ability: current, other: next, title: 'Сейчас', change: 'loss' }, { ability: next, other: current, title: 'После обучения', change: 'gain' }].map(({ ability, other, title, change }) => {
    const parts = ability ? descriptionParts(ability.description, other?.description) : undefined;
    const rules = ability ? rulesFor(ability) : [];
    return <article key={title} className="npc-comparison-card" data-equipment-rarity={ability?.rarity}><h4>{title}</h4>
      {ability ? <><div className="npc-detail-identity"><span className="npc-art"><AbilityArt ability={ability} slot={slot} hero={hero} /></span><div><EquipmentRarityBadge rarity={ability.rarity} /><h3>{ability.name}</h3></div></div>
        <p className="npc-description"><DiceText text={parts![0]} rules={rules} /><mark data-change={change}><DiceText text={parts![1]} rules={rules} /></mark><DiceText text={parts![2]} rules={rules} /></p>
        {ability.skill && <p className="npc-detail-note">Перезарядка: <b>{ability.skill.cooldown} ходов</b></p>}</>
        : <div className="npc-max-rarity"><span aria-hidden="true">✧</span><strong>Высшая редкость</strong><p>Это умение уже освоено в совершенстве.</p></div>}
    </article>;
  })}</div>{next && <p className="npc-detail-note">Изменения выделены цветом. Навык останется в том же слоте.</p>}</>;
}

/** Selection never spends coins. A deliberate transaction waits for the resulting hero progress. */
export function NpcServiceDialog({ kind, seed, poiId, heroId, progress, onClose, onBuy, onUpgradeEquipment, onUpgradeSkill }: NpcServiceDialogProps) {
  const hero = gameContent.characters.find(entry => entry.id === heroId);
  const offers = useMemo(() => kind === 'merchant' ? merchantOffers(seed, poiId, gameContent) : [], [kind, seed, poiId]);
  const equipment = useMemo(() => equipmentSlots.map(slot => {
    const entry = progress.equipment.find(item => item.slot === slot);
    const current = entry && resolveEquipmentItem(gameContent.equipmentCatalog?.items, entry.itemId);
    return { slot, current, next: current && nextEquipmentUpgrade(gameContent.equipmentCatalog?.items, current.id) };
  }), [progress.equipment]);
  const abilities = useMemo(() => hero ? listHeroAbilityUpgrades(hero, progress, gameContent) : [], [hero, progress]);
  const [rarity, setRarity] = useState<RewardRarity>('common'), [selection, setSelection] = useState('');
  const [message, setMessage] = useState(''), [pending, setPending] = useState<PendingPurchase | null>(null);
  const lock = useRef<PendingPurchase | null>(null);
  const visibleOffers = offers.filter(offer => offer.rarity === rarity);
  const offer = visibleOffers.find(entry => entry.id === selection) ?? visibleOffers[0];
  const gear = equipment.find(entry => entry.slot === selection) ?? equipment.find(entry => entry.current) ?? equipment[0];
  const ability = abilities.find(entry => entry.slot === selection) ?? abilities[0];
  const purchased = !!offer && (progress.npcPurchases ?? []).includes(`${poiId}:${offer.id}`);
  const price = kind === 'merchant' ? offer?.price : kind === 'blacksmith' ? gear?.next && NPC_EQUIPMENT_UPGRADE_PRICES[gear.next.rarity]
    : ability?.next && NPC_SKILL_UPGRADE_PRICES[ability.next.rarity];
  const unavailable = kind === 'merchant' ? !offer || purchased : kind === 'blacksmith' ? !gear?.current || !gear.next : !ability?.current || !ability.next;
  const missing = price === undefined || price === null ? 0 : Math.max(0, price - progress.coins);
  const buttonLabel = kind === 'merchant' ? purchased ? 'Уже куплено' : 'Купить' : unavailable ? (kind === 'blacksmith' ? gear?.current : ability?.current) ? 'Высшая редкость' : 'Пустой слот' : 'Улучшить';

  useEffect(() => { setSelection(''); setRarity('common'); setMessage(''); lock.current = null; setPending(null); }, [kind, poiId, heroId]);
  useEffect(() => {
    if (!pending) return;
    const currentAbility = pending.type === 'skill' ? abilities.find(entry => entry.slot === pending.slot)?.current : undefined;
    const currentItem = pending.type === 'equipment' ? progress.equipment.find(entry => entry.slot === pending.slot)?.itemId : undefined;
    const confirmed = pending.type === 'buy' ? (progress.npcPurchases ?? []).includes(`${poiId}:${pending.id}`)
      : pending.type === 'equipment' ? currentItem === pending.after : currentAbility?.id === pending.after.id && currentAbility.rarity === pending.after.rarity;
    const changed = pending.type === 'equipment' ? currentItem !== pending.before : pending.type === 'skill'
      ? currentAbility?.id !== pending.before.id || currentAbility?.rarity !== pending.before.rarity : false;
    if (!confirmed && !changed) return;
    lock.current = null; setPending(null);
    setMessage(confirmed ? pending.type === 'buy' ? 'Покупка в сумке.' : 'Улучшение готово.' : 'Снаряжение изменилось. Выберите улучшение ещё раз.');
  }, [pending, progress, abilities, poiId]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => { if (lock.current !== pending) return; lock.current = null; setPending(null); setMessage('Подтверждение пока не получено. Можно попробовать ещё раз.'); }, 5_000);
    return () => clearTimeout(timer);
  }, [pending]);

  const select = (id: string) => { setSelection(id); setMessage(''); };
  const transact = () => {
    if (lock.current || unavailable || missing) return;
    let action: PendingPurchase;
    if (kind === 'merchant' && offer) action = { type: 'buy', id: offer.id };
    else if (kind === 'blacksmith' && gear?.current && gear.next) action = { type: 'equipment', slot: gear.slot, before: gear.current.id, after: gear.next.id };
    else if (kind === 'scribe' && ability?.current && ability.next) action = { type: 'skill', slot: ability.slot, before: ability.current, after: ability.next };
    else return;
    lock.current = action; setPending(action); setMessage('Ожидаем подтверждение…');
    let accepted = false;
    try { accepted = action.type === 'buy' ? onBuy(action.id) : action.type === 'equipment' ? onUpgradeEquipment(action.slot, action.before)
      : onUpgradeSkill(action.slot, action.before.id, action.before.rarity); } catch { /* Keep the selection available if the request fails. */ }
    if (!accepted) { lock.current = null; setPending(null); setMessage('Не удалось выполнить действие. Попробуйте ещё раз.'); }
  };

  return <GameDialog title={serviceNames[kind]} onClose={onClose} className="npc-service-dialog">
    <div className="npc-service-intro"><p>{serviceHints[kind]}</p><div className="npc-wallet"><small>Ваши монеты</small><Coins value={progress.coins} /></div></div>
    <div className="npc-selection-area">
      {kind === 'merchant' ? <><div className="npc-rarities" role="group" aria-label="Редкость предложений">{REWARD_RARITIES.map(value => <button key={value} type="button" data-equipment-rarity={value} aria-pressed={rarity === value} onClick={() => { setRarity(value); select(''); }}>{EQUIPMENT_RARITY_NAMES[value]}</button>)}</div>
        <div className="npc-offer-row" aria-label="Предложения торговца">{visibleOffers.map(entry => { const info = offerInfo(entry), owned = (progress.npcPurchases ?? []).includes(`${poiId}:${entry.id}`); return <button key={entry.id} type="button" className="npc-choice npc-offer-choice" data-equipment-rarity={entry.rarity} aria-pressed={entry.id === offer?.id} onClick={() => select(entry.id)}>
          <span className="npc-art">{info.art}</span><span className="npc-choice-copy"><small>{entry.kind === 'set' ? 'Полный комплект' : 'Способность'}</small><strong>{info.name}</strong></span><span className="npc-choice-price">{owned ? '✓ Куплено' : <Coins value={entry.price} />}</span>
        </button>; })}</div></>
        : kind === 'blacksmith' ? <div className="npc-equipment-grid" aria-label="Надетые предметы">{equipment.map(entry => <button key={entry.slot} type="button" className="npc-choice npc-slot-choice" data-equipment-rarity={entry.current?.rarity} aria-pressed={entry.slot === gear.slot} onClick={() => select(entry.slot)} aria-label={`${rewardSlotNames[entry.slot]}: ${entry.current?.name ?? 'пусто'}`}>
          <span className="npc-art">{entry.current ? <EquipmentIcon item={entry.current} size={34} /> : <LoadoutIcon kind={entry.slot === 'head' ? 'helmet' : entry.slot} />}</span><span>{rewardSlotNames[entry.slot]}</span>{entry.current?.rarity === 'legendary' && <i aria-label="Легендарный">✧</i>}
        </button>)}</div>
          : <div className="npc-ability-row" aria-label="Способности героя">{abilities.map(entry => <button key={entry.slot} type="button" className="npc-choice npc-slot-choice" data-equipment-rarity={entry.current?.rarity} aria-pressed={entry.slot === ability?.slot} onClick={() => select(entry.slot)} aria-label={`${abilityNames[entry.slot]}: ${entry.current?.name ?? 'пусто'}`}>
            <span className="npc-art">{entry.current ? <AbilityArt ability={entry.current} slot={entry.slot} hero={hero} /> : <LoadoutIcon kind="extra" />}</span><span>{abilityNames[entry.slot]}</span>{entry.current?.rarity === 'legendary' && <i aria-label="Легендарный">✧</i>}
          </button>)}</div>}
    </div>
    <div className="npc-detail-scroll" tabIndex={0} aria-label="Описание выбранного предложения">
      {kind === 'merchant' ? offer ? <MerchantDetails offer={offer} /> : <p className="npc-empty">В этой редкости нет предложений.</p>
        : kind === 'blacksmith' ? gear.current ? <EquipmentDetails before={gear.current} after={gear.next} /> : <div className="npc-empty"><LoadoutIcon kind={gear.slot === 'head' ? 'helmet' : gear.slot} /><h3>Слот свободен</h3><p>Кузнец улучшает надетые предметы. Сначала выберите вещь в окне персонажа.</p></div>
          : ability?.current && hero ? <AbilityDetails current={ability.current} next={ability.next} slot={ability.slot} hero={hero} progress={progress} /> : <div className="npc-empty"><LoadoutIcon kind="extra" /><h3>Способность не назначена</h3><p>Назначьте способность из сумки, чтобы мастер мог её усилить.</p></div>}
    </div>
    <footer className="npc-service-footer"><div className="npc-transaction-status" role="status" aria-live="polite">{pending ? 'Ожидаем подтверждение…' : message || (missing ? `Не хватает ${number(missing)} монет.` : unavailable ? '' : kind === 'merchant' ? 'Покупка доступна этому герою один раз.' : 'Улучшение применяется сразу.')}</div>
      <button type="button" className="npc-purchase" onClick={transact} disabled={!!pending || unavailable || missing > 0} aria-busy={!!pending}><span>{pending ? 'Подождите…' : buttonLabel}</span>{!unavailable && price !== undefined && price !== null && <Coins value={price} />}</button>
    </footer>
  </GameDialog>;
}
