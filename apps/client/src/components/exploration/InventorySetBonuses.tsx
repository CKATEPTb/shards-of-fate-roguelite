import { memo, useId } from 'react';
import { baseEquipmentItemId, REWARD_RARITIES, type EquipmentSetDefinition, type HeroBody, type StarterEquipment } from '@shards/shared';
import { equipmentCondition } from '@shards/game-core';
import { EQUIPMENT_SETS } from '@shards/game-data';
import { AuraIcon } from '../AuraIcon';
import { DiceText } from '../DiceText';
import { EquipmentIcon } from '../EquipmentIcon';
import { modifierDiceRules } from './diceRules';
import { rewardSlotNames } from './rewardPresentation';
import './inventorySetBonuses.css';

export interface InventorySetBonusesProps {
  equipment: readonly StarterEquipment[];
  body?: HeroBody;
  selectedSetId?: string | null;
  preview?: { equipment: readonly StarterEquipment[]; body?: HeroBody };
  onSelectSet?: (setId: string) => void;
}

type PieceState = 'active' | 'inactive' | 'duplicate';
interface SetPiece { item: StarterEquipment; state: PieceState }

function setPieces(setId: string, equipment: readonly StarterEquipment[], body?: HeroBody): SetPiece[] {
  const counted = new Set<string>();
  return equipment.filter(item => item.setId === setId).map(item => {
    // Match combat: usable, distinct catalogue identities count once, including
    // when the same item has a different rarity or occupies more than one slot.
    if (!item.id || body && !equipmentCondition(item, body).active) return { item, state: 'inactive' };
    const id = baseEquipmentItemId(item.id);
    if (counted.has(id)) return { item, state: 'duplicate' };
    counted.add(id);
    return { item, state: 'active' };
  });
}

const pieceKey = (item: StarterEquipment): string => `${item.slot}:${item.id ?? item.name}`;
const activeCount = (pieces: SetPiece[]): number => pieces.filter(piece => piece.state === 'active').length;
const pieceStatus = (piece: SetPiece): string => piece.state === 'active' ? 'Участвует в бонусах'
  : piece.state === 'duplicate' ? 'Копия: такая часть уже учтена' : 'Не участвует: предмет не действует';

function SetMembers({ before, after, comparing }: { before: SetPiece[]; after: SetPiece[]; comparing: boolean }) {
  const members = new Map<string, { before?: SetPiece; after?: SetPiece }>(before.map(piece => [pieceKey(piece.item), { before: piece }]));
  for (const piece of after) {
    const existing = members.get(pieceKey(piece.item));
    if (existing) existing.after = piece;
    else members.set(pieceKey(piece.item), { after: piece });
  }
  if (!members.size) return <p className="inventory-set-no-pieces">Части этого комплекта ещё не надеты.</p>;
  return <div className="inventory-set-members">
    <span className="inventory-set-members-label">{comparing ? 'Части до и после замены' : 'Надетые части'}</span>
    <ul>{[...members].map(([id, entry]) => {
      const piece = entry.after ?? entry.before!;
      const change = !comparing ? undefined : !entry.before ? 'gain' : !entry.after ? 'loss'
        : entry.before.state === entry.after.state ? undefined : entry.after.state === 'active' ? 'gain'
          : entry.before.state === 'active' ? 'loss' : undefined;
      const status = comparing && !entry.after ? 'Будет снят' : comparing && !entry.before ? `Будет надет. ${pieceStatus(piece)}`
        : comparing && change ? `После замены: ${pieceStatus(piece)}` : pieceStatus(piece);
      return <li key={id} className="inventory-set-member" data-state={piece.state} data-change={change}
        title={`${piece.item.name} · ${rewardSlotNames[piece.item.slot]}. ${status}`}>
        <EquipmentIcon item={piece.item} size={32} />
        <span className="inventory-set-member-label">{piece.item.name}. {rewardSlotNames[piece.item.slot]}. {status}</span>
        <span className="inventory-set-member-mark" aria-hidden="true">{change === 'gain' ? '+' : change === 'loss' ? '−' : piece.state === 'active' ? '✓' : piece.state === 'duplicate' ? '=' : '×'}</span>
      </li>;
    })}</ul>
  </div>;
}

function SetCard({ set, before, after, selected, comparing, onSelect }: {
  set: EquipmentSetDefinition; before: SetPiece[]; after: SetPiece[]; selected: boolean; comparing: boolean; onSelect?: () => void;
}) {
  const beforeCount = activeCount(before), afterCount = activeCount(after);
  const bonuses = [...(set.bonuses ?? [])].sort((left, right) => left.pieces - right.pieces);
  return <article className="inventory-set-card" data-selected={selected} aria-label={`Комплект: ${set.name}`}>
    <header className="inventory-set-card-heading">
      {onSelect ? <button type="button" className="inventory-set-select" aria-pressed={selected} onClick={onSelect}>{set.name}</button>
        : <h4>{set.name}</h4>}
      <span className="inventory-set-count" aria-label={comparing ? `Действующих частей: ${beforeCount}, после замены: ${afterCount}` : `Действующих частей: ${beforeCount}`}>
        <span>Частей:</span>
        {comparing && beforeCount !== afterCount ? <><span>{beforeCount}</span><span aria-hidden="true">→</span><b data-change={afterCount > beforeCount ? 'gain' : 'loss'}>{afterCount}</b></> : <b>{beforeCount}</b>}
      </span>
    </header>
    <ol className="inventory-set-bonuses">{bonuses.map(bonus => {
      const beforeActive = beforeCount >= bonus.pieces, afterActive = afterCount >= bonus.pieces;
      const state = beforeActive !== afterActive ? afterActive ? 'gain' : 'loss' : afterActive ? 'active' : 'inactive';
      const status = state === 'gain' ? 'Активируется' : state === 'loss' ? 'Будет потерян' : state === 'active' ? 'Действует' : 'Неактивен';
      const aura = bonus.aura;
      return <li className="inventory-set-bonus" key={bonus.pieces} data-state={state}>
        <div className="inventory-set-bonus-heading">
          <span className="inventory-set-threshold" aria-label={`Нужно частей: ${bonus.pieces}`}><b>{bonus.pieces}</b><span>{bonus.pieces === 6 ? 'частей' : 'части'}</span></span>
          <div className="inventory-set-bonus-title"><strong>{bonus.name}</strong><span>{status}</span></div>
          {aura && <span className="inventory-set-aura-icon" aria-hidden="true"><AuraIcon id={aura.id} visual={aura.visual} size={32} /></span>}
        </div>
        <p className="inventory-set-bonus-description"><DiceText text={bonus.description} rules={[...modifierDiceRules(bonus.modifiers), ...(aura ? modifierDiceRules(aura.modifiers) : [])]} /></p>
        {aura && aura.description !== bonus.description && <p className="inventory-set-aura-description"><DiceText text={aura.description} rules={modifierDiceRules(aura.modifiers)} /></p>}
      </li>;
    })}</ol>
    <SetMembers before={before} after={after} comparing={comparing} />
  </article>;
}

/** Every set threshold stays expanded, including inactive and previewed bonuses. */
export const InventorySetBonuses = memo(function InventorySetBonuses({ equipment, body, selectedSetId, preview, onSelectSet }: InventorySetBonusesProps) {
  const heading = useId();
  const setIds = new Set([...equipment.flatMap(item => item.setId ? [item.setId] : []),
    ...(preview?.equipment ?? []).flatMap(item => item.setId ? [item.setId] : []), ...(selectedSetId ? [selectedSetId] : [])]);
  const sets = [...setIds].flatMap(id => {
    const set = EQUIPMENT_SETS[id];
    if (!set?.bonuses?.length) return [];
    const before = setPieces(id, equipment, body);
    const after = preview ? setPieces(id, preview.equipment, preview.body ?? body) : before;
    // Selection and hypothetical swaps do not reorder the currently worn sets.
    // Upgraded pieces can be rarer than their catalogue set's base definition.
    const rarity = before.length
      ? Math.max(...before.map(piece => REWARD_RARITIES.indexOf(piece.item.rarity ?? set.rarity ?? 'common')))
      : REWARD_RARITIES.indexOf(set.rarity ?? 'common');
    return [{ set, before, after, count: activeCount(before), rarity }];
  }).sort((left, right) => right.count - left.count || right.rarity - left.rarity
    || left.set.name.localeCompare(right.set.name, 'ru') || left.set.id.localeCompare(right.set.id));
  const activeBefore = sets.reduce((sum, entry) => sum + entry.set.bonuses!.filter(bonus => bonus.pieces <= activeCount(entry.before)).length, 0);
  const activeAfter = sets.reduce((sum, entry) => sum + entry.set.bonuses!.filter(bonus => bonus.pieces <= activeCount(entry.after)).length, 0);
  return <section className="inventory-set-panel" aria-labelledby={heading}>
    <header className="inventory-set-panel-heading"><div><h3 id={heading}>Бонусы комплектов</h3>
      <p>Активно: <b>{activeBefore}</b>{preview && activeAfter !== activeBefore && <> <span aria-hidden="true">→</span> <b>{activeAfter}</b> после замены</>}</p></div>
      {preview && <span className="inventory-set-preview-label">Примерка</span>}
    </header>
    <div className="inventory-set-scroll" tabIndex={0} role="region" aria-label="Все бонусы комплектов">
      {sets.length ? <><div className="inventory-set-cards">{sets.map(({ set, before, after }) => <SetCard key={set.id} set={set} before={before} after={after}
        selected={selectedSetId === set.id} comparing={!!preview} onSelect={onSelectSet ? () => onSelectSet(set.id) : undefined} />)}</div>
        <p className="inventory-set-counting-note">Копии одного предмета считаются одной частью. Недействующие предметы не дают бонусов комплекта.</p></>
        : <div className="inventory-set-empty"><span aria-hidden="true">2 · 4 · 6</span><strong>Соберите свой комплект</strong><p>Наденьте части одного комплекта, чтобы открыть его бонусы. Здесь будут видны все пороги и действующие эффекты.</p></div>}
    </div>
  </section>;
});
