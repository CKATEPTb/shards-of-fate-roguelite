import type { ReactNode } from 'react';
import { BODY_PARTS, type ActionDefinition, type CombatEventType, type EffectDefinition, type EquipmentItemDefinition,
  type EquipmentSetDefinition, type Modifiers, type SkillDefinition, type StatusDefinition, type TargetSelector, type UnitDefinition } from '@shards/shared';
import { bodyPartArmor, startHeroBody } from '@shards/game-core';
import { EQUIPMENT_ITEMS, EQUIPMENT_SETS } from '@shards/game-data';
import { gameContent } from '../catalog';
import { unitFramePixels, resolveUnitArt } from '../art/unitFrames';
import { resolveHeroVisualLoadout } from '../art/heroLoadout';
import { EquipmentIcon } from '../components/EquipmentIcon';
import { SkillIcon } from '../components/SkillIcon';
import { AuraIcon } from '../components/AuraIcon';
import { DiceLegend, DiceText, type DiceRule } from '../components/DiceText';
import { modifierDiceRules, passiveDiceRules, skillDiceRules, statusDiceRules } from '../components/exploration/diceRules';
import { bodyPartNames } from '../components/exploration/body-status-model';
import { LoadoutIcon } from '../components/exploration/LoadoutIcon';
import { passiveLoadoutSlot } from '../components/exploration/loadoutSkills';
import { equipmentStats, rewardAttributes, rewardSlotNames, signed } from '../components/exploration/rewardPresentation';
import { skillActionText, skillTargetNames, skillTurns } from '../game/skillCatalogModel';
import type { KnowledgeEntry, KnowledgeTabId } from './knowledgeModel';
import './KnowledgeDetails.css';

type Navigate = (tab: KnowledgeTabId, sourceId: string) => void;
interface Reference { tab: KnowledgeTabId; sourceId: string; name: string; note?: string; icon?: ReactNode; rarity?: string }
const statusById = new Map(gameContent.statuses.map(status => [status.id, status]));
const skillById = new Map(gameContent.skills.map(skill => [skill.id, skill]));
const effectById = new Map(gameContent.effects.map(effect => [effect.id, effect]));
const allUnits = [...gameContent.characters, ...gameContent.enemies];
const heroIds = new Set(gameContent.characters.map(unit => unit.id));
const portraitCache = new WeakMap<UnitDefinition, string>();
const unitTab = (unit: UnitDefinition): KnowledgeTabId => heroIds.has(unit.id) ? 'heroes' : unit.tags.includes('BOSS') ? 'bosses' : 'enemies';

/** One cached image per definition, rather than a live canvas or thousands of DOM pixels per result. */
function unitPortrait(unit: UnitDefinition): string {
  const cached = portraitCache.get(unit);
  if (cached) return cached;
  const enemy = !heroIds.has(unit.id), art = resolveUnitArt(unit.sprite, unit.role, enemy);
  const crop = !enemy ? '18 3 28 28' : art === 'elite_warden' ? '5 1 23 23' : art === 'thornling' ? '5 7 23 23'
    : art === 'spider' ? '9 15 15 15' : ['rat', 'wolf', 'boar', 'slime'].includes(art) ? '7 13 18 18' : '7 4 18 18';
  const pixels = unitFramePixels(art, unit.role, enemy, 'south', 'idle', 0, undefined, enemy ? undefined : resolveHeroVisualLoadout(unit));
  const paths = new Map<string, string[]>();
  for (const pixel of pixels) {
    const shapes = paths.get(pixel.color) ?? [];
    shapes.push(`M${pixel.x} ${pixel.y}h1v1h-1Z`);
    paths.set(pixel.color, shapes);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop}" shape-rendering="crispEdges">${[...paths]
    .map(([color, shapes]) => `<path fill="${color}" d="${shapes.join('')}"/>`).join('')}</svg>`;
  const source = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  portraitCache.set(unit, source);
  return source;
}

function UnitIcon({ unit, size = 36 }: { unit: UnitDefinition; size?: number }) {
  return <img className="kdetail-unit-icon" src={unitPortrait(unit)} alt="" width={size} height={size} loading="lazy" decoding="async" />;
}
function SkillArtwork({ skill, size = 36 }: { skill: SkillDefinition; size?: number }) {
  return skill.icon ? <SkillIcon icon={skill.icon} size={size} /> : <AuraIcon id={skill.id} size={size} />;
}

export function KnowledgeEntryIcon({ entry, size = 40 }: { entry: KnowledgeEntry; size?: number }) {
  switch (entry.kind) {
    case 'unit': return <UnitIcon unit={entry.unit} size={size} />;
    case 'equipment': return <EquipmentIcon item={entry.item} size={size} />;
    case 'skill': return <SkillArtwork skill={entry.skill} size={size} />;
    case 'aura': return <AuraIcon id={entry.status.id} visual={entry.status.visual} size={size} />;
    case 'setAura': return <AuraIcon id={entry.aura.id} visual={entry.aura.visual} size={size} />;
    case 'effect': {
      const status = entry.effect.actions.flatMap(action => statusById.get(action.statusId ?? action.onHitStatusId ?? '') ?? [])[0];
      return <AuraIcon id={status?.id ?? entry.effect.id} visual={status?.visual} size={size} />;
    }
    case 'set': {
      const items = entry.set.itemIds.flatMap(id => EQUIPMENT_ITEMS[id] ?? []);
      const item = items.find(item => item.slot === 'chest') ?? items[0];
      return item ? <EquipmentIcon item={item} size={size} /> : <AuraIcon id="fortified" size={size} />;
    }
  }
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section className="kdetail-section"><h3>{title}</h3>{note && <p className="kdetail-note">{note}</p>}{children}</section>;
}
function References({ entries, onNavigate }: { entries: Reference[]; onNavigate: Navigate }) {
  return <div className="kdetail-links">{entries.map(entry => <button key={`${entry.tab}:${entry.sourceId}`} type="button"
    className="kdetail-link" data-rarity={entry.rarity} onClick={() => onNavigate(entry.tab, entry.sourceId)}>
    {entry.icon && <span className="kdetail-link-icon" aria-hidden="true">{entry.icon}</span>}
    <span><strong>{entry.name}</strong>{entry.note && <small>{entry.note}</small>}</span><span className="kdetail-link-arrow" aria-hidden="true">↗</span>
  </button>)}</div>;
}
function Facts({ values }: { values: Array<[string, ReactNode]> }) {
  return <dl className="kdetail-facts">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

const modifierNames: Partial<Record<keyof Modifiers, string>> = {
  damageBonus: 'К результату урона', damageReduction: 'Поглощение урона', partyDamageReduction: 'Поглощение урона отрядом',
  taunt: 'Привлекает атаки врагов', vampirismDice: 'Вампиризм', healingShareDice: 'Передача исцеления', preserveHot: 'Продление регенерации',
  preserveShield: 'Сохранение ёмкости щита', guaranteedCrit: 'Гарантированный крит: итог прямого урона и исцеления ×2',
  evasionBonus: 'Уклонение', repeatAttack: 'Повтор атаки', initiativeBonus: 'Инициатива', agilityBonus: 'Проворность',
  damageBonusDice: 'Дополнительный урон каждого удара', partyGuardDice: 'Защитный бросок за союзника', invulnerable: 'Полностью блокирует входящий урон',
  accuracyBonus: 'Точность', critBonus: 'Критический удар', armorBonus: 'Защита', powerBonus: 'Сила', resilienceBonus: 'Стойкость', luckBonus: 'Удача',
};
function ModifierList({ modifiers }: { modifiers: Modifiers }) {
  const rules = modifierDiceRules(modifiers);
  const values = Object.entries(modifiers).flatMap(([key, value]) => {
    const name = modifierNames[key as keyof Modifiers];
    if (!name || value === undefined || value === false || value === 0) return [];
    const text = typeof value === 'boolean' ? name : typeof value === 'number' ? `${name}: ${signed(value)}`
      : typeof value === 'string' ? `${name}: ${value}` : `${name}: ${value.dice}, успех при ${value.atLeast} и выше`;
    return [{ key, text }];
  });
  return values.length ? <ul className="kdetail-rules">{values.map(value => <li key={value.key}><DiceText text={value.text} rules={rules} /></li>)}</ul> : null;
}
const duration = (value: number | null | undefined) => value === null ? 'Бессрочно' : value === undefined ? 'Срок задаёт источник' : `${skillTurns(value)} носителя`;
const targetName = (target?: TargetSelector) => target ? skillTargetNames[target] ?? 'Выбранная цель' : 'Цель умения';

function actionRules(actions: readonly ActionDefinition[]): DiceRule[] {
  return actions.flatMap(action => action.dice ? [{ dice: action.dice, modifiable: action.type === 'damage' || !!action.scaling,
    reason: action.scaling ? 'К результату применяется указанная доля Силы источника.'
      : action.type === 'damage' ? 'Учитывает действующие бонусы урона. Сила не добавляется, если не указана в формуле.' : 'Чистый бросок; Сила не добавляется.' }] : []);
}
function ActionList({ actions, target, rules = actionRules(actions), onNavigate, selfLabel }: {
  actions: readonly ActionDefinition[]; target?: TargetSelector; rules?: readonly DiceRule[]; onNavigate: Navigate; selfLabel?: string;
}) {
  return <ol className="kdetail-actions">{actions.map((action, index) => {
    const aura = statusById.get(action.statusId ?? ''), onHit = statusById.get(action.onHitStatusId ?? '');
    return <li key={index}><div className="kdetail-action-copy">
      <strong><DiceText text={action.type === 'status' ? `Накладывает ${aura ? `«${aura.name}»` : 'ауру'}` : skillActionText(action)} rules={rules} /></strong>
      <span>{(action.target ?? target) === 'self' && selfLabel ? selfLabel : targetName(action.target ?? target)}{action.targetRelation ? ` · только ${action.targetRelation === 'ally' ? 'союзники' : 'противники'}` : ''}</span>
      {action.type === 'shield' && <span>Поглощение урона · {duration(action.duration)}</span>}
      {action.scaleWithRemainingDuration && <span>Результат умножается на оставшуюся длительность ауры.</span>}
    </div>{(aura || onHit) && <div className="kdetail-action-auras">{[{ status: aura, value: action.duration, hit: false }, { status: onHit, value: action.onHitDuration, hit: true }]
      .flatMap(link => link.status ? [<button type="button" key={`${link.status.id}:${link.hit}`} className="kdetail-aura-link"
        onClick={() => onNavigate('auras', link.status!.id)}><AuraIcon id={link.status.id} visual={link.status.visual} size={30} />
        <span><strong>{link.status.name}</strong><small>{link.hit ? 'При попадании · ' : ''}{link.status.stacking === 'decay' ? 'Добавляет заряд' : duration(link.value)}</small></span>
      </button>] : [])}</div>}</li>;
  })}</ol>;
}
function DiceGuide({ rules }: { rules: readonly DiceRule[] }) {
  if (!rules.length) return null;
  return <Section title="Броски кубиков"><DiceLegend rules={rules} /><div className="kdetail-dice-rules">{rules.map((rule, index) =>
    <p key={`${rule.dice}:${index}`}><strong><DiceText text={rule.dice} rules={[rule]} /></strong><span>{rule.reason}</span></p>)}</div></Section>;
}
const skillReference = (skill: SkillDefinition): Reference => ({ tab: 'skills', sourceId: skill.id, name: skill.name,
  note: `${skill.tags.includes('ROLE') ? 'Классовая способность' : skill.tags.includes('CHARACTER') ? 'Способность героя' : 'Активная способность'} · ${skill.cooldown ? skillTurns(skill.cooldown) : 'без перезарядки'}`,
  icon: <SkillArtwork skill={skill} />, rarity: skill.rarity });
const itemReference = (item: EquipmentItemDefinition): Reference => ({ tab: 'equipment', sourceId: item.id, name: item.name,
  note: item.slot === 'hand' ? item.weapon?.hands === 2 ? 'Занимает обе руки' : 'Любая рука' : item.slot === 'ring1' || item.slot === 'ring2' ? 'Любое из двух колец' : rewardSlotNames[item.slot],
  icon: <EquipmentIcon item={item} size={36} />, rarity: item.rarity });

function UnitDetails({ unit, onNavigate }: { unit: UnitDefinition; onNavigate: Navigate }) {
  const hero = heroIds.has(unit.id), body = hero ? startHeroBody(unit) : undefined;
  const values = hero && unit.anatomy ? equipmentStats(unit, unit.anatomy.equipment).values : Object.fromEntries(rewardAttributes.map(([key, , bonus]) =>
    [key, (unit.stats[key] ?? 0) + (typeof unit.modifiers[bonus] === 'number' ? unit.modifiers[bonus]! : 0)]));
  const skills = unit.skillIds.flatMap(id => skillById.get(id) ?? []);
  const passives = unit.effectIds.flatMap(id => effectById.get(id) ?? []);
  const weaponAttacks = unit.anatomy?.equipment.filter(item => item.weapon?.damage).map(item => ({ ...unit.basicAttack, dice: item.weapon!.damage }));
  const attacks = weaponAttacks?.length ? weaponAttacks : [unit.basicAttack];
  return <>
    <p className="kdetail-description"><DiceText text={unit.description} rules={passiveDiceRules(unit)} /></p>
    <Section title={hero ? 'Начальные характеристики' : 'Базовые характеристики'} note={hero ? 'Со стартовой экипировкой и пассивными бонусами.' : 'Без множителей сложности и размера отряда.'}>
      <Facts values={[...(!hero ? [['Здоровье', unit.stats.maxHp], ['Защита', unit.stats.armor]] as Array<[string, ReactNode]> : []),
        ...rewardAttributes.filter(([key]) => values[key] !== 0).map(([key, label]): [string, ReactNode] => [label, values[key]]),
        ['Скорость передвижения', `${unit.movementSpeed ?? 100}%`]]} />
    </Section>
    {body && <Section title="Прочность частей тела"><div className="kdetail-body-grid">{BODY_PARTS.map(part => <div key={part}>
      <strong>{bodyPartNames[part]}</strong><span>Прочность <b>{body[part].max}</b></span><span>Защита <b>{bodyPartArmor(unit, body, part)}</b></span>
    </div>)}</div><p className="kdetail-note">При нуле рука или нога перестаёт работать. Утрата части — при −50% её максимальной прочности; утрата головы или торса означает гибель.</p></Section>}
    <Section title={attacks.length > 1 ? 'Атака двумя оружиями' : 'Обычная атака'}>
      {attacks.length > 1 && <p className="kdetail-note">Один ход: сначала удар одной рукой, затем другой. Для каждого — свои броски.</p>}
      <ActionList actions={attacks} target="enemy" onNavigate={onNavigate} />
    </Section>
    {!!skills.length && <Section title="Активные способности"><References entries={skills.map(skillReference)} onNavigate={onNavigate} /></Section>}
    {(unit.passive || passives.length || Object.keys(unit.modifiers).length > 0) && <Section title="Пассивные способности">
      {unit.passive && <article className="kdetail-passive"><span className="kdetail-passive-icon"><LoadoutIcon kind={passiveLoadoutSlot(unit).icon} /></span><div><h4>{unit.passive.name}</h4>
        <p><DiceText text={unit.passive.description} rules={passiveDiceRules(unit)} /></p></div></article>}
      <ModifierList modifiers={unit.modifiers} />
      <References entries={passives.map(effect => ({ tab: 'auras', sourceId: effect.id, name: effect.name, note: effect.description }))} onNavigate={onNavigate} />
    </Section>}
    {!!unit.anatomy?.equipment.length && <Section title="Стартовая экипировка"><References entries={[...new Set(unit.anatomy.equipment.map(item => item.id))].flatMap(id =>
      id && EQUIPMENT_ITEMS[id] ? [itemReference(EQUIPMENT_ITEMS[id])] : [])} onNavigate={onNavigate} /></Section>}
  </>;
}

function SetBonuses({ set, onNavigate }: { set: EquipmentSetDefinition; onNavigate: Navigate }) {
  return <div className="kdetail-set-bonuses">{set.bonuses?.map(bonus => <article key={bonus.pieces}>
    <div className="kdetail-set-threshold"><b>{bonus.pieces}</b><span>{bonus.pieces === 6 ? 'предметов' : 'предмета'}</span></div><div><h4>{bonus.name}</h4>
      <p><DiceText text={bonus.description} rules={modifierDiceRules(bonus.modifiers)} /></p><ModifierList modifiers={bonus.modifiers} />
      {bonus.aura && <button type="button" className="kdetail-aura-link" onClick={() => onNavigate('auras', bonus.aura!.id)}>
        <AuraIcon id={bonus.aura.id} visual={bonus.aura.visual} size={36} /><span><strong>{bonus.aura.name}</strong><small>{bonus.aura.description}</small></span>
      </button>}
    </div></article>)}</div>;
}
function ItemDetails({ item, onNavigate }: { item: EquipmentItemDefinition; onNavigate: Navigate }) {
  const set = item.setId ? EQUIPMENT_SETS[item.setId] : undefined;
  const rules: DiceRule[] = item.weapon?.damage ? [{ dice: item.weapon.damage, modifiable: true, reason: 'К броску оружия применяются бонусы обычной атаки владельца.' }] : [];
  return <><p className="kdetail-description"><DiceText text={item.description} rules={rules} /></p>
    <Facts values={[
      ['Место', itemReference(item).note],
      ...(item.weapon ? [['Хват', item.weapon.hands === 2 ? 'Двуручное · резервирует обе руки' : 'Одноручное'],
        ['Урон оружия', item.weapon.damage ? <DiceText text={item.weapon.damage} rules={rules} /> : 'Щит: без собственного удара']] as Array<[string, ReactNode]> : []),
    ]} />
    <Section title="Что даёт предмет"><Facts values={rewardAttributes.filter(([key]) => item.bonuses?.[key]).map(([key, name]) => [name, signed(item.bonuses![key]!)])} />
      <div className="kdetail-body-grid">{BODY_PARTS.filter(part => item.resources[part] || item.armor && item.bodyParts.includes(part)).map(part => <div key={part}>
        <strong>{bodyPartNames[part]}</strong>{!!item.resources[part] && <span>Прочность <b>{signed(item.resources[part]!)}</b></span>}
        {!!item.armor && item.bodyParts.includes(part) && <span>Защита <b>{signed(item.armor)}</b></span>}
      </div>)}</div>
      {(item.slot === 'hand' && item.weapon?.hands === 1 || item.slot === 'ring1' || item.slot === 'ring2') && <p className="kdetail-note">Защита привязана к руке выбранного слота.</p>}
    </Section>
    {set && <Section title="Синергия комплекта"><References entries={[{ tab: 'sets', sourceId: set.id, name: set.name, note: `${set.itemIds.length} предметов`, rarity: set.rarity }]} onNavigate={onNavigate} />
      {!!set.bonuses?.length && <SetBonuses set={set} onNavigate={onNavigate} />}</Section>}
    <DiceGuide rules={rules} />
  </>;
}
function SetDetails({ set, onNavigate }: { set: EquipmentSetDefinition; onNavigate: Navigate }) {
  return <>{set.description && <p className="kdetail-description">{set.description}</p>}
    <Section title="Части комплекта"><References entries={set.itemIds.flatMap(id => EQUIPMENT_ITEMS[id] ? [itemReference(EQUIPMENT_ITEMS[id])] : [])} onNavigate={onNavigate} /></Section>
    {!!set.bonuses?.length && <Section title="Бонусы комплекта" note="Считаются разные пригодные к использованию предметы. Двуручное оружие — одна часть. Все достигнутые пороги действуют одновременно.">
      <SetBonuses set={set} onNavigate={onNavigate} />
    </Section>}
  </>;
}
function SkillDetails({ skill, onNavigate }: { skill: SkillDefinition; onNavigate: Navigate }) {
  const rules = skillDiceRules(skill), owners = allUnits.filter(unit => unit.skillIds.includes(skill.id));
  return <><p className="kdetail-description"><DiceText text={skill.description} rules={rules} /></p>
    <Facts values={[
      ['Цель', targetName(skill.target)], ['Перезарядка', skill.cooldown ? skillTurns(skill.cooldown) : 'Нет'],
      ['Стоимость', 'Одно действие своего хода'], ['Получение', skill.rarity ? 'Можно найти в наградах и экипировать в дополнительный слот' : skill.tags.includes('ROLE') ? 'Классовая способность' : 'Врождённая способность'],
    ]} />
    <Section title="Действие навыка"><ActionList actions={skill.actions} target={skill.target} rules={rules} onNavigate={onNavigate} /></Section>
    <DiceGuide rules={rules} />
    {!!owners.length && <details className="kdetail-sources"><summary>Используют: {owners.length}</summary>
      <References entries={owners.map(unit => ({ tab: unitTab(unit), sourceId: unit.id, name: unit.name, note: unit.title, icon: <UnitIcon unit={unit} /> }))} onNavigate={onNavigate} />
    </details>}
  </>;
}

const eventNames: Record<CombatEventType, string> = {
  COMBAT_STARTED: 'В начале боя', ROUND_STARTED: 'В начале раунда', TURN_STARTED: 'В начале хода', TURN_ENDED: 'В конце хода',
  SKILL_USED: 'При применении способности', ATTACK_STARTED: 'При начале атаки', DICE_ROLLED: 'После броска кубиков',
  HIT: 'При попадании', MISS: 'При промахе', CRIT: 'При критическом попадании', BLOCKED: 'При блокировании', DAMAGE: 'При нанесении урона',
  HEALED: 'При исцелении', OVERHEALED: 'При избыточном исцелении', SHIELD_CREATED: 'При создании щита', SHIELD_UPDATED: 'При изменении щита',
  SHIELD_BROKEN: 'При разрушении щита', STATUS_APPLIED: 'При наложении ауры', STATUS_UPDATED: 'При изменении ауры', STATUS_EXPIRED: 'При завершении ауры',
  FLEE_SUCCEEDED: 'При успешном побеге', FLEE_FAILED: 'При неудачном побеге', ENTITY_DIED: 'При гибели участника', COMBAT_ENDED: 'В конце боя',
};
function effectRules(effect: EffectDefinition): DiceRule[] {
  return statusDiceRules({ schemaVersion: 1, id: effect.id, name: effect.name, description: effect.description, color: '#d0bc86', modifiers: {}, tags: [], actions: effect.actions });
}
function AuraSources({ status, onNavigate }: { status: StatusDefinition; onNavigate: Navigate }) {
  const applies = (actions: readonly ActionDefinition[]) => actions.some(action => action.statusId === status.id || action.onHitStatusId === status.id);
  const sources: Reference[] = [
    ...gameContent.skills.filter(skill => applies(skill.actions)).map(skillReference),
    ...gameContent.effects.filter(effect => applies(effect.actions)).map(effect => ({ tab: 'auras' as const, sourceId: effect.id, name: effect.name, note: 'Пассивный эффект' })),
    ...gameContent.statuses.filter(aura => aura.id !== status.id && applies(aura.actions)).map(aura => ({ tab: 'auras' as const, sourceId: aura.id, name: aura.name,
      note: 'Накладывается другой аурой', icon: <AuraIcon id={aura.id} visual={aura.visual} size={36} /> })),
  ];
  return sources.length ? <Section title="Источники"><References entries={sources} onNavigate={onNavigate} /></Section> : null;
}
function AuraDetails({ status, onNavigate }: { status: StatusDefinition; onNavigate: Navigate }) {
  const rules = statusDiceRules(status);
  return <><p className="kdetail-description"><DiceText text={status.description} rules={rules} /></p>
    <Facts values={[
      ['Срабатывание', status.trigger === 'TURN_STARTED' ? 'В начале хода носителя' : status.trigger === 'TURN_ENDED' ? 'В конце хода носителя' : 'Постоянно, пока действует аура'],
      ['Длительность', status.stacking === 'decay' ? 'До исчерпания зарядов' : duration(status.defaultDuration)],
      ['Повторное наложение', status.stacking === 'decay' ? 'Общий запас зарядов; −1 после срабатывания' : status.stacking === 'refresh' ? 'Обновляет срок от того же источника' : 'Отдельные слои со своими сроками'],
      ['Отсчёт срока', status.expiresAt === 'TURN_STARTED' ? 'В начале хода носителя' : 'В конце хода носителя'],
    ]} />
    <Section title="Эффекты"><ModifierList modifiers={status.modifiers} />{!!status.actions.length && <ActionList actions={status.actions} target="self" selfLabel="Носитель ауры" rules={rules} onNavigate={onNavigate} />}</Section>
    <p className="kdetail-note">Точный срок и число наложений определяет применившее ауру умение. Ауры действуют в пределах текущего боя.</p>
    <DiceGuide rules={rules} /><AuraSources status={status} onNavigate={onNavigate} />
  </>;
}
function EffectDetails({ effect, onNavigate }: { effect: EffectDefinition; onNavigate: Navigate }) {
  const rules = effectRules(effect);
  const conditions = { sourceIsOwner: 'Источник события — владелец эффекта', targetIsOwner: 'Цель события — владелец эффекта',
    targetIsAlly: 'Цель события — союзник', ownerAlive: 'Владелец жив и участвует в бою' };
  const owners = allUnits.filter(unit => unit.effectIds.includes(effect.id));
  return <><p className="kdetail-description"><DiceText text={effect.description} rules={rules} /></p>
    <Facts values={[
      ['Срабатывание', eventNames[effect.trigger]], ['Цель', targetName(effect.target)],
      ['Внутренняя перезарядка', effect.internalCooldown ? skillTurns(effect.internalCooldown) : 'Нет'],
    ]} />
    {!!effect.conditions.length && <Section title="Условия"><ul className="kdetail-rules">{effect.conditions.map(condition => <li key={condition}>{conditions[condition]}</li>)}</ul></Section>}
    <Section title="Эффекты"><ActionList actions={effect.actions} target={effect.target} rules={rules} onNavigate={onNavigate} /></Section>
    <DiceGuide rules={rules} />{!!owners.length && <Section title="Владельцы"><References entries={owners.map(unit => ({ tab: unitTab(unit), sourceId: unit.id,
      name: unit.name, note: unit.title, icon: <UnitIcon unit={unit} /> }))} onNavigate={onNavigate} /></Section>}
  </>;
}

export function KnowledgeDetails({ entry, onNavigate }: { entry: KnowledgeEntry; onNavigate: Navigate }) {
  return <div className="kdetail-content">{entry.kind === 'unit' ? <UnitDetails unit={entry.unit} onNavigate={onNavigate} />
    : entry.kind === 'equipment' ? <ItemDetails item={entry.item} onNavigate={onNavigate} />
    : entry.kind === 'set' ? <SetDetails set={entry.set} onNavigate={onNavigate} />
    : entry.kind === 'skill' ? <SkillDetails skill={entry.skill} onNavigate={onNavigate} />
    : entry.kind === 'aura' ? <AuraDetails status={entry.status} onNavigate={onNavigate} />
    : entry.kind === 'effect' ? <EffectDetails effect={entry.effect} onNavigate={onNavigate} />
    : <><p className="kdetail-description"><DiceText text={entry.aura.description} rules={modifierDiceRules(entry.aura.modifiers)} /></p>
      <Facts values={[
        ['Длительность', 'Пока собран необходимый бонус комплекта'], ['Активация', 'Автоматически в бою при достаточном числе действующих частей'],
      ]} />
      <Section title="Эффекты"><ModifierList modifiers={entry.aura.modifiers} /></Section><DiceGuide rules={modifierDiceRules(entry.aura.modifiers)} />
      <Section title="Источники"><References entries={entry.sets.map(set => ({ tab: 'sets', sourceId: set.id, name: set.name, rarity: set.rarity,
        note: set.bonuses?.filter(bonus => bonus.aura?.id === entry.aura.id).map(bonus => `За ${bonus.pieces} ${bonus.pieces === 6 ? 'предметов' : 'предмета'}`).join(' · ') }))} onNavigate={onNavigate} /></Section>
    </>}
  </div>;
}
