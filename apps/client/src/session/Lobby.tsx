import { useEffect, useState } from 'react';
import type { DifficultyId } from '@shards/shared';
import { gameContent } from '../catalog';
import { ExpeditionGame } from '../ExpeditionGame';
import { CampfireRoster } from './CampfireRoster';
import { CampHeroDetails } from './CampHeroDetails';
import { CampDifficulty } from './CampDifficulty';
import { CampIcon } from './CampIcon';
import { MenuFrame } from './MenuFrame';
import { InviteDialog } from './InviteDialog';
import { RoomUnavailableDialog } from './RoomUnavailableDialog';
import { createInviteLink, type LobbyInvitation } from './invitations';
import { useLobbyNetwork } from './useLobbyNetwork';
import type { SavedSession } from './storage';
import './campLobby.css';
import './multiplayer.css';

function randomSeed(): string { return [...crypto.getRandomValues(new Uint8Array(6))].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase(); }
const checkpoint = () => true;
const ended = () => {};

export function Lobby({ onBack, onStart, invitation = null, savedRun }: { onBack: () => void; onStart: (hero: string, difficulty: DifficultyId, seed: string) => void; invitation?: LobbyInvitation | null; savedRun?: SavedSession }) {
  const [selected, setSelected] = useState(savedRun?.cooperative ? savedRun.hostHeroId : 'guardian');
  const [difficultyId, setDifficulty] = useState<DifficultyId>(savedRun?.cooperative?.difficultyId ?? 'normal');
  const [seed, setSeed] = useState(() => savedRun?.cooperative?.seed ?? randomSeed());
  const [starting, setStarting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const lobby = useLobbyNetwork(invitation, savedRun);
  const { network, view, busy, networked, roomMissing } = lobby;
  const room = view.room;
  const guest = !!invitation;
  const member = room?.members.find(participant => participant.id === view.memberId);
  const ready = member?.ready ?? false;
  const connectedToRoom = view.status === 'connected' && !!room && !!member;
  const canStart = connectedToRoom && room.phase === 'lobby' && network.isHost && room.members.length > 0 && room.members.every(participant => participant.ready);
  const fixedRun = room?.run ?? savedRun?.cooperative;
  const allowedHeroIds = fixedRun?.characterIds ?? room?.heroIds;
  const frozenWorld = guest || !!fixedRun;
  const controlledHeroId = network.controlledHeroId;
  const currentSelection = controlledHeroId ?? selected;
  const heroId = allowedHeroIds && !allowedHeroIds.includes(currentSelection) ? allowedHeroIds[0] : currentSelection;
  const hero = gameContent.characters.find(character => character.id === heroId)!;
  const occupants = Object.fromEntries((room?.members ?? []).filter(participant => participant.ready).map(member => [member.heroId, { name: member.name, isSelf: member.id === view.memberId, ready: true }]));
  const inviteLink = room ? createInviteLink(room.code) : '';
  useEffect(() => { if (controlledHeroId) setSelected(controlledHeroId); }, [controlledHeroId]);

  const leave = () => { lobby.disconnect(); onBack(); };
  const invite = () => {
    if (busy || starting || guest && !room) return;
    setInviteOpen(true);
    if (!room) void lobby.createRoom(heroId);
  };
  const changeReadinessOrStart = () => {
    if (starting || busy || roomMissing || !connectedToRoom) return;
    if (canStart) {
      if (seed.trim()) void lobby.startRun(seed.trim(), difficultyId);
    } else {
      void lobby.setReady(!ready);
    }
  };

  if (view.status === 'connected' && room?.phase === 'playing' && ready && view.initialState) {
    return <ExpeditionGame key={room.code} initial={view.initialState} network={network} onCheckpoint={checkpoint} onEnded={ended} onLeave={leave} />;
  }

  return <MenuFrame><form className={`lobby camp-lobby${networked ? ' online-lobby' : ''}`} aria-label="Лобби" onSubmit={event => {
    event.preventDefault();
    if (starting || busy || roomMissing) return;
    if (networked) {
      changeReadinessOrStart();
      return;
    }
    if (!seed.trim()) return;
    setStarting(true);
    try { onStart(selected, difficultyId, seed.trim()); } finally { setStarting(false); }
  }}>
    <header className="lobby-heading">
      <button type="button" className="camp-tool lobby-back" aria-label="Назад" title="Назад" onClick={leave}><CampIcon name="back" /></button>
      <CampDifficulty value={fixedRun?.difficultyId ?? (guest ? undefined : difficultyId)} onChange={setDifficulty} disabled={busy || starting || frozenWorld} />
    </header>
    <div className="camp-lobby-body"><div className="camp-stage">
      <CampfireRoster selectedId={heroId} occupants={occupants} allowedHeroIds={allowedHeroIds} disabled={starting || busy || ready || networked && !connectedToRoom} onSelect={id => {
        if (ready) return;
        if (room) void lobby.selectHero(id); else setSelected(id);
      }} action={guest && !room
        ? <button type="button" className="camp-invite-button" disabled={busy || !!invitation.error} onClick={() => { void lobby.retryJoin(); }}>{busy ? 'Подключение…' : 'Повторить'}</button>
        : <button type="button" className="camp-invite-button" disabled={busy || starting} onClick={invite} aria-label="Пригласить" aria-haspopup="dialog"><CampIcon name="party" /><span>Пригласить</span>{room && <span className="camp-party-count" aria-label={`Отряд: ${room.members.length} из 4`}>{room.members.length}/4</span>}</button>
      } />
      <CampHeroDetails key={hero.id} hero={hero} />
    </div></div>
    <footer className="lobby-footer">
      <div className="camp-world-controls">
        {guest ? <p className="camp-host-note">{room?.phase === 'playing' ? 'Выберите героя и нажмите «Готов», чтобы войти в поход' : 'Мир и сложность выбирает хост'}</p> : <div className="camp-seed-field"><label htmlFor="session-seed">Сид мира</label><span className="seed-control"><input id="session-seed" maxLength={120} required pattern=".*\S.*" value={fixedRun?.seed ?? seed} disabled={starting || busy || frozenWorld} onChange={event => setSeed(event.target.value)} spellCheck={false} autoComplete="off" /><button type="button" disabled={starting || busy || frozenWorld} onClick={() => setSeed(randomSeed())} aria-label="Случайный сид" title="Случайный сид">⟳</button></span></div>}
        {networked
          ? <button className="primary-button" type="button" disabled={starting || busy || roomMissing || !connectedToRoom || canStart && !seed.trim()} aria-pressed={connectedToRoom && !canStart ? ready : undefined} onClick={changeReadinessOrStart}>
            {starting || busy ? room ? 'Подождите…' : 'Подключение…' : !connectedToRoom ? 'Нет подключения' : canStart ? 'Играть' : ready ? 'Не готов' : 'Готов'}
            {canStart && <span aria-hidden="true">→</span>}
          </button>
          : <button className="primary-button" type="submit" disabled={starting || !seed.trim()}>{starting ? 'Подождите…' : 'Играть'}<span aria-hidden="true">→</span></button>}
      </div>
      {lobby.error && !inviteOpen && !roomMissing && <p className="online-error" role="alert">{lobby.error}</p>}
    </footer>
    {inviteOpen && !roomMissing && <InviteDialog link={inviteLink} busy={busy} error={lobby.error} onClose={() => setInviteOpen(false)} />}
    {roomMissing && <RoomUnavailableDialog onExit={leave} />}
  </form></MenuFrame>;
}
