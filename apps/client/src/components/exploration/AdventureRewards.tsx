import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BODY_PARTS, resolveEquipmentItem, type AdventureReward, type EquipmentItemDefinition, type HeroBody, type HeroProgress, type RewardResolution } from '@shards/shared';
import { EQUIPMENT_ITEMS } from '@shards/game-data';
import { playSound } from '../../audio/engine';
import { EQUIPMENT_RARITY_NAMES, EquipmentRarityBadge } from '../EquipmentRarity';
import { bodyPartNames } from './body-status-model';
import { rewardAttributes, RewardArt, rewardName, rewardSkill, signed } from './rewardPresentation';
import './adventureRewards.css';

export interface AdventureRewardsProps {
  heroId: string;
  progress: HeroProgress;
  body?: HeroBody;
  onCollect(rewardId: string): boolean;
  onCollectAll(rewardIds: string[]): boolean;
  onResolve(resolution: RewardResolution): boolean;
  onClose(): void;
}

function equipmentSummary(item: EquipmentItemDefinition): string {
  const details: string[] = [];
  if (item.weapon?.damage) details.push(`Урон ${item.weapon.damage}`);
  if (item.armor) details.push(`Защита ${signed(item.armor)}`);
  const resources = BODY_PARTS.filter(part => item.resources[part]).map(part => ({ part, name: bodyPartNames[part], value: item.resources[part]! }));
  for (const [first, second, name] of [['leftArm', 'rightArm', 'Каждая рука'], ['leftLeg', 'rightLeg', 'Каждая нога']] as const) {
    const left = resources.find(entry => entry.part === first), right = resources.find(entry => entry.part === second);
    if (left && right && left.value === right.value) {
      left.name = name;
      resources.splice(resources.indexOf(right), 1);
    }
  }
  for (const entry of resources) details.push(`${entry.name}: прочность ${signed(entry.value)}`);
  for (const [key, name] of rewardAttributes) {
    const value = item.bonuses?.[key];
    if (value) details.push(`${name} ${signed(value)}`);
  }
  return details.length ? details.join(' · ') : item.description;
}

function rewardDescription(reward: AdventureReward): { kind: string; description: string; details?: string } {
  if (reward.kind === 'skill') {
    const skill = rewardSkill(reward.definitionId);
    return { kind: 'Способность', description: skill?.description ?? 'Способность для вашего героя.',
      details: skill ? `Перезарядка: ${skill.cooldown} ходов` : undefined };
  }
  const item = resolveEquipmentItem(EQUIPMENT_ITEMS, reward.definitionId);
  const summary = item ? equipmentSummary(item) : undefined;
  return {
    kind: item?.weapon ? item.weapon.kind === 'shield' ? 'Щит' : item.weapon.hands === 2 ? 'Двуручное оружие' : 'Одноручное оружие' : 'Снаряжение',
    description: item?.description ?? 'Предмет для вашего героя.',
    details: summary !== item?.description ? summary : undefined,
  };
}

type CollectionLock = { rewardIds: string[]; batch: boolean; successMessage: string; timer: ReturnType<typeof setTimeout> };
const COLLECTION_CONFIRMATION_MS = 5_000;

/** Inspect a find first; pressing it again collects it. Bulk pickup bypasses inspection. */
export function AdventureRewards({ progress, onCollect, onCollectAll, onResolve, onClose }: AdventureRewardsProps) {
  const titleId = useId(), descriptionId = useId(), warningId = useId(), warningTextId = useId();
  const panel = useRef<HTMLDivElement>(null), warningPanel = useRef<HTMLDivElement>(null);
  const latest = useRef(progress), settled = useRef(false);
  const collecting = useRef(new Map<string, CollectionLock>());
  const confirmations = useRef(new Set<CollectionLock>());
  const focusAfterCollect = useRef<{ ids: string[]; index: number } | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState(false);
  const [message, setMessage] = useState('');
  latest.current = progress;

  const releaseCollection = (lock: CollectionLock) => {
    clearTimeout(lock.timer);
    for (const id of lock.rewardIds) if (collecting.current.get(id) === lock) collecting.current.delete(id);
    setPendingIds(new Set(collecting.current.keys()));
  };

  const clearCollectionFocus = (lock: CollectionLock) => {
    if (focusAfterCollect.current?.ids.some(id => lock.rewardIds.includes(id))) focusAfterCollect.current = null;
  };

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>('.reward-close')?.focus({ preventScroll: true });
    return () => {
      for (const lock of new Set(collecting.current.values())) clearTimeout(lock.timer);
      collecting.current.clear();
      confirmations.current.clear();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const available = new Set(progress.rewards.map(reward => reward.id));
    setInspectedId(id => id && available.has(id) ? id : null);
    // Keep acknowledgement tracking after unlocking a slow request for retry.
    // An unrelated new props array is not an acknowledgement of this pickup.
    const confirmed = [...confirmations.current].filter(lock => !lock.rewardIds.some(id => available.has(id)));
    if (!confirmed.length) return;
    for (const lock of confirmed) {
      confirmations.current.delete(lock);
      releaseCollection(lock);
    }
    const count = new Set(confirmed.flatMap(lock => lock.rewardIds)).size;
    setMessage(confirmed.length === 1 ? confirmed[0].successMessage : `Находки в сумке: ${count}.`);
    playSound('loot', { volume: .45 });
    if (!available.size && !collecting.current.size && !settled.current) {
      settled.current = true;
      focusAfterCollect.current = null;
      onClose();
    }
  }, [progress.rewards]);

  useEffect(() => {
    if (pendingClose || settled.current) return;
    if (!progress.rewards.length && !pendingIds.size) {
      focusAfterCollect.current = null;
      panel.current?.querySelector<HTMLButtonElement>('.reward-done')?.focus({ preventScroll: true });
      return;
    }
    const wanted = focusAfterCollect.current;
    if (!wanted || progress.rewards.some(reward => wanted.ids.includes(reward.id))) return;
    const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-reward-id]:not([aria-disabled="true"])') ?? [])];
    if (!buttons.length) return;
    focusAfterCollect.current = null;
    buttons[Math.min(wanted.index, buttons.length - 1)]?.focus({ preventScroll: true });
  }, [progress.rewards, pendingIds, pendingClose]);

  useEffect(() => {
    const scope = pendingClose ? warningPanel.current : panel.current;
    scope?.querySelector<HTMLButtonElement>(pendingClose ? 'button' : latest.current.rewards.length ? '.reward-close' : '.reward-done')?.focus({ preventScroll: true });
  }, [pendingClose]);

  const collectRewards = (rewards: AdventureReward[], batch: boolean, focusIndex?: number) => {
    const rewardIds = rewards.map(reward => reward.id);
    if (!rewardIds.length || settled.current || pendingClose) return;
    const lock: CollectionLock = { rewardIds, batch,
      successMessage: batch ? `Находки в сумке: ${rewardIds.length}.` : `${rewardName(rewards[0])} — в сумке.`,
      timer: setTimeout(() => {
        if (!rewardIds.some(id => collecting.current.get(id) === lock)) return;
        clearCollectionFocus(lock);
        releaseCollection(lock);
        setMessage('Перенос пока не подтверждён. Можно попробовать ещё раз.');
      }, COLLECTION_CONFIRMATION_MS),
    };
    for (const id of rewardIds) collecting.current.set(id, lock);
    confirmations.current.add(lock);
    if (focusIndex !== undefined) focusAfterCollect.current = { ids: rewardIds, index: focusIndex };
    setPendingIds(new Set(collecting.current.keys()));
    setMessage(batch ? 'Переносим находки в сумку…' : 'Переносим находку в сумку…');
    let accepted = false;
    try { accepted = batch ? onCollectAll(rewardIds) : onCollect(rewardIds[0]); } catch { /* Leave every unconfirmed pickup available for another attempt. */ }
    if (!accepted) {
      confirmations.current.delete(lock);
      clearCollectionFocus(lock);
      releaseCollection(lock);
      setMessage(batch ? 'Не удалось забрать находки. Попробуйте ещё раз.' : 'Не удалось забрать находку. Попробуйте ещё раз.');
      playSound('cancel', { volume: .3 });
    }
  };

  const inspectOrCollect = (reward: AdventureReward, index: number) => {
    if (settled.current || pendingClose || collecting.current.has(reward.id) || !latest.current.rewards.some(entry => entry.id === reward.id)) return;
    if (inspectedId !== reward.id) {
      setInspectedId(reward.id);
      setMessage('Повторное нажатие на эту находку — забрать в сумку.');
      playSound('select', { volume: .25 });
      return;
    }
    const focused = document.activeElement instanceof HTMLElement && document.activeElement.dataset.rewardId === reward.id;
    collectRewards([reward], false, focused ? index : undefined);
  };

  const collectAll = () => {
    // The ref closes the reentry gap before React renders the disabled button.
    if ([...collecting.current.values()].some(lock => lock.batch)) return;
    collectRewards(latest.current.rewards.filter(reward => !collecting.current.has(reward.id)), true, 0);
  };

  const finish = () => {
    if (settled.current || collecting.current.size) return;
    const rewardIds = latest.current.rewards.map(reward => reward.id);
    settled.current = true;
    let accepted = !rewardIds.length;
    try { if (rewardIds.length) accepted = onResolve({ equipment: [], skills: [], rewardIds }); }
    catch { /* Leave this batch open when the action cannot be accepted. */ }
    if (accepted) onClose();
    else {
      settled.current = false;
      setPendingClose(false);
      setMessage('Не удалось закрыть добычу. Попробуйте ещё раз.');
    }
  };

  const requestClose = () => {
    if (settled.current) return;
    if (collecting.current.size) {
      setMessage('Дождитесь переноса находок в сумку…');
      return;
    }
    if (latest.current.rewards.length) setPendingClose(true);
    else finish();
  };

  const batchPending = [...collecting.current.values()].some(lock => lock.batch);
  const availableCount = progress.rewards.filter(reward => !pendingIds.has(reward.id)).length;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (pendingClose) setPendingClose(false);
      else requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const scope = pendingClose ? warningPanel.current : panel.current;
    const controls = [...(scope?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !scope?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !scope?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  };

  return <div className="adventure-rewards-overlay" data-hud-interactive
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
    <div ref={panel} className="reward-workspace" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} inert={pendingClose}>
      <header className="reward-loot-heading">
        <div><span className="reward-eyebrow">Находки в пути</span><h2 id={titleId}>Добыча <small>{progress.rewards.length}</small></h2></div>
        <button type="button" className="reward-close" aria-label="Закрыть добычу" onClick={requestClose}>×</button>
        <p id={descriptionId}>Первое нажатие — описание, повторное на ту же находку — в сумку.</p>
      </header>
      <div className="reward-loot-scroll">
        {progress.rewards.length ? <div className="reward-loot-grid" aria-label="Доступная добыча">
          {progress.rewards.map((reward, index) => {
            const info = rewardDescription(reward), busy = pendingIds.has(reward.id), inspected = inspectedId === reward.id;
            const detailsId = `${titleId}-reward-${index}`;
            return <button key={reward.id} type="button" className="reward-pickup" data-reward-id={reward.id} data-equipment-rarity={reward.rarity}
              data-sound="off" aria-disabled={busy} aria-expanded={inspected} aria-label={`${rewardName(reward)}, ${EQUIPMENT_RARITY_NAMES[reward.rarity].toLocaleLowerCase('ru-RU')} — ${busy ? 'переносим в сумку' : inspected ? 'забрать в сумку' : 'показать описание'}`} aria-describedby={detailsId}
              onClick={() => inspectOrCollect(reward, index)}>
              <span className="reward-pickup-art" aria-hidden="true"><RewardArt reward={reward} /></span>
              <span className="reward-pickup-identity"><EquipmentRarityBadge rarity={reward.rarity} /><strong>{rewardName(reward)}</strong></span>
              <span className="reward-pickup-description" id={detailsId}><span className="reward-pickup-kind">{info.kind}</span>
                {inspected && <><span className="reward-pickup-copy">{info.description}</span>
                  {info.details && <span className="reward-pickup-details">{info.details}</span>}</>}
              </span>
              <span className="reward-pickup-action">{busy ? 'Переносим…' : inspected ? 'Забрать в сумку' : 'Описание'}<span aria-hidden="true">{busy ? '…' : inspected ? '+' : 'i'}</span></span>
            </button>;
          })}
        </div> : <div className="reward-empty"><span aria-hidden="true">✓</span><h3>Всё собрано</h3><p>Находки ждут вас в сумке.</p></div>}
      </div>
      <footer className="reward-loot-footer">
        <p className="reward-pickup-status" role="status" aria-live="polite" aria-atomic="true">{pendingIds.size ? pendingIds.size === 1 ? 'Переносим находку в сумку…' : 'Переносим находки в сумку…'
          : message || (progress.rewards.length ? 'Забранное останется в сумке.' : 'Можно продолжить путешествие.')}</p>
        <div className="reward-loot-actions">
          <button type="button" className="reward-collect-all" data-sound="off" disabled={batchPending || !availableCount || pendingClose}
            aria-busy={batchPending} onClick={collectAll}>Забрать всё <span aria-hidden="true">＋</span></button>
          <button type="button" className="reward-done" disabled={pendingIds.size > 0} onClick={requestClose}>Готово <span aria-hidden="true">↗</span></button>
        </div>
      </footer>
    </div>
    {pendingClose && <div className="reward-warning-backdrop"><div ref={warningPanel} className="reward-warning" role="alertdialog" aria-modal="true" aria-labelledby={warningId} aria-describedby={warningTextId}>
      <span className="reward-warning-symbol" aria-hidden="true">◇</span><h2 id={warningId}>Оставить добычу?</h2>
      <p id={warningTextId}>Несобранных находок: {progress.rewards.length}. Они пропадут, если уйти. Всё, что вы уже забрали в сумку, сохранится.</p>
      <div><button type="button" onClick={() => setPendingClose(false)}>Вернуться к добыче</button><button type="button" className="reward-done" onClick={finish}>Оставить и уйти</button></div>
    </div></div>}
  </div>;
}
