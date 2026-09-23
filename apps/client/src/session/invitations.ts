export interface LobbyInvitation {
  code: string;
  error: string | null;
}

const ROOM_CODE = /^[A-Z2-9]{6}$/;
const INVALID_INVITATION = 'Некорректная ссылка-приглашение.';

export function readInvitation(url = window.location.href): LobbyInvitation | null {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return null; }
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  const codes = fragment.getAll('invite');
  if (codes.length === 0) return null;
  const code = codes[0].toUpperCase();
  if (codes.length !== 1 || !ROOM_CODE.test(code)) return { code: '', error: INVALID_INVITATION };
  return { code, error: null };
}

export function createInviteLink(code: string, url = window.location.href): string {
  const normalized = code.toUpperCase();
  if (!ROOM_CODE.test(normalized)) throw new Error('Некорректный код комнаты.');
  const parsed = new URL(url);
  parsed.hash = `invite=${normalized}`;
  return parsed.href;
}

export function clearInvitation(): void {
  const parsed = new URL(window.location.href);
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  if (!fragment.has('invite')) return;
  fragment.delete('invite');
  parsed.hash = fragment.toString();
  window.history.replaceState(window.history.state, '', parsed.href);
}
