import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BODY_PARTS, type AdventureReward, type EquipmentItemDefinition, type HeroBody, type HeroProgress, type RewardResolution } from '@shards/shared';
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

function rewardDescription(reward: AdventureReward): { kind: string; description: string } {
  if (reward.kind === 'skill') {
    const skill = rewardSkill(reward.definitionId);
    return { kind: 'Способность', description: skill?.description ?? 'Способность для вашего героя.' };
  }
  const item = EQUIPMENT_ITEMS[reward.definitionId];
  return {
    kind: item?.weapon ? item.weapon.kind === 'shield' ? 'Щит' : item.weapon.hands === 2 ? 'Двуручное оружие' : 'Одноручное оружие' : 'Снаряжение',
    description: item ? equipmentSummary(item) : 'Предмет для вашего героя.',
  };
}

type CollectionLock = { rewards: HeroProgress['rewards']; timer: ReturnType<typeof setTimeout> };

/** Pickups enter the bag immediately; leaving only discards rewards still on the ground. */
export function AdventureRewards({ progress, onCollect, onResolve, onClose }: AdventureRewardsProps) {
  const titleId = useId(), descriptionId = useId(), warningId = useId(), warningTextId = useId();
  const panel = useRef<HTMLDivElement>(null), warningPanel = useRef<HTMLDivElement>(null);
  const latest = useRef(progress), settled = useRef(false);
  const collecting = useRef(new Map<string, CollectionLock>());
  const focusAfterCollect = useRef<{ id: string; index: number } | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingClose, setPendingClose] = useState(false);
  const [message, setMessage] = useState('');
  latest.current = progress;

  const releaseCollection = (id: string) => {
    const lock = collecting.current.get(id);
    if (!lock) return;
    clearTimeout(lock.timer);
    collecting.current.delete(id);
    setPendingIds(new Set(collecting.current.keys()));
  };

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>('.reward-close')?.focus({ preventScroll: true });
    return () => {
      for (const lock of collecting.current.values()) clearTimeout(lock.timer);
      collecting.current.clear();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    for (const [id, lock] of collecting.current) {
      if (lock.rewards !== progress.rewards || !progress.rewards.some(reward => reward.id === id)) releaseCollection(id);
    }
    const wanted = focusAfterCollect.current;
    if (!wanted || progress.rewards.some(reward => reward.id === wanted.id)) return;
    focusAfterCollect.current = null;
    const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-reward-id]') ?? [])];
    const next = buttons[Math.min(wanted.index, buttons.length - 1)] ?? panel.current?.querySelector<HTMLButtonElement>('.reward-done');
    next?.focus();
  }, [progress.rewards]);

  useEffect(() => {
    const scope = pendingClose ? warningPanel.current : panel.current;
    scope?.querySelector<HTMLButtonElement>(pendingClose ? 'button' : '.reward-close')?.focus({ preventScroll: true });
  }, [pendingClose]);

  const collect = (reward: AdventureReward, index: number) => {
    if (settled.current || pendingClose || collecting.current.has(reward.id) || !latest.current.rewards.some(entry => entry.id === reward.id)) return;
    const focused = document.activeElement instanceof HTMLElement && document.activeElement.dataset.rewardId === reward.id;
    const timer = setTimeout(() => releaseCollection(reward.id), 1000);
    collecting.current.set(reward.id, { rewards: latest.current.rewards, timer });
    if (focused) focusAfterCollect.current = { id: reward.id, index };
    setPendingIds(new Set(collecting.current.keys()));
    let accepted = false;
    try { accepted = onCollect(reward.id); } catch { /* Keep the reward available for another attempt. */ }
    if (!accepted) {
      if (focusAfterCollect.current?.id === reward.id) focusAfterCollect.current = null;
      releaseCollection(reward.id);
      setMessage('Не удалось забрать находку. Попробуйте ещё раз.');
      playSound('cancel', { volume: .3 });
      return;
    }
    setMessage(`${rewardName(reward)} — в сумке.`);
    playSound('loot', { volume: .45 });
  };

  const finish = () => {
    if (settled.current) return;
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
    if (latest.current.rewards.some(reward => collecting.current.has(reward.id))) {
      setMessage('Переносим находку в сумку…');
      return;
    }
    if (latest.current.rewards.length) setPendingClose(true);
    else finish();
  };

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
        <p id={descriptionId}>Нажмите на находку, чтобы забрать её в сумку.</p>
      </header>
      <div className="reward-loot-scroll">
        {progress.rewards.length ? <div className="reward-loot-grid" aria-label="Доступная добыча">
          {progress.rewards.map((reward, index) => {
            const info = rewardDescription(reward), busy = pendingIds.has(reward.id);
            const detailsId = `${titleId}-reward-${index}`;
            return <button key={reward.id} type="button" className="reward-pickup" data-reward-id={reward.id} data-equipment-rarity={reward.rarity}
              data-sound="off" aria-disabled={busy} aria-label={`${rewardName(reward)}, ${EQUIPMENT_RARITY_NAMES[reward.rarity].toLocaleLowerCase('ru-RU')} — взять в сумку`} aria-describedby={detailsId}
              onClick={() => collect(reward, index)}>
              <span className="reward-pickup-art" aria-hidden="true"><RewardArt reward={reward} /></span>
              <span className="reward-pickup-identity"><EquipmentRarityBadge rarity={reward.rarity} /><strong>{rewardName(reward)}</strong></span>
              <span className="reward-pickup-description" id={detailsId}><span>{info.kind}</span>{info.description}</span>
              <span className="reward-pickup-action">{busy ? 'В сумке' : 'В сумку'}<span aria-hidden="true">{busy ? '✓' : '+'}</span></span>
            </button>;
          })}
        </div> : <div className="reward-empty"><span aria-hidden="true">✓</span><h3>Всё собрано</h3><p>Находки ждут вас в сумке.</p></div>}
      </div>
      <footer className="reward-loot-footer">
        <p className="reward-pickup-status" role="status" aria-live="polite" aria-atomic="true">{message || (progress.rewards.length ? 'Забранное останется в сумке.' : 'Можно продолжить путешествие.')}</p>
        <button type="button" className="reward-done" onClick={requestClose}>Готово <span aria-hidden="true">↗</span></button>
      </footer>
    </div>
    {pendingClose && <div className="reward-warning-backdrop"><div ref={warningPanel} className="reward-warning" role="alertdialog" aria-modal="true" aria-labelledby={warningId} aria-describedby={warningTextId}>
      <span className="reward-warning-symbol" aria-hidden="true">◇</span><h2 id={warningId}>Оставить добычу?</h2>
      <p id={warningTextId}>Несобранных находок: {progress.rewards.length}. Они пропадут, если уйти. Всё, что вы уже забрали в сумку, сохранится.</p>
      <div><button type="button" onClick={() => setPendingClose(false)}>Вернуться к добыче</button><button type="button" className="reward-done" onClick={finish}>Оставить и уйти</button></div>
    </div></div>}
  </div>;
}
