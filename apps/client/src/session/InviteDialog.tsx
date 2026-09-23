import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './inviteDialog.css';

interface InviteDialogProps {
  link: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}

export function InviteDialog({ link, busy, error, onClose }: InviteDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const statusId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const backdropPress = useRef(false);
  const copyInProgress = useRef(false);
  const [copying, setCopying] = useState(false);
  const [feedback, setFeedback] = useState<{ link: string; message: string } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    mounted.current = true;
    if (closeRef.current) closeRef.current.autofocus = true;
    dialog?.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
      dialog?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const copyLink = async () => {
    if (!link || busy || copyInProgress.current) return;
    copyInProgress.current = true;
    setCopying(true);
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable');
      await navigator.clipboard.writeText(link);
      if (mounted.current) setFeedback({ link, message: 'Ссылка скопирована' });
    } catch {
      if (!mounted.current) return;
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
      // LAN pages served over HTTP may only support copying a selected field.
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Leave the selected link available for manual copying. */ }
      setFeedback({ link, message: copied ? 'Ссылка скопирована' : 'Ссылка выделена. Скопируйте её вручную.' });
    } finally {
      copyInProgress.current = false;
      if (mounted.current) setCopying(false);
    }
  };

  const outside = (dialog: HTMLDialogElement, x: number, y: number) => {
    const bounds = dialog.getBoundingClientRect();
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  };
  const status = error ?? (busy ? 'Создаём приглашение…' : feedback?.link === link ? feedback.message : '');

  return createPortal(<dialog ref={dialogRef} className="invite-dialog" aria-labelledby={titleId} aria-modal="true"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onSubmit={event => { event.preventDefault(); event.stopPropagation(); }}
    onKeyDown={event => event.stopPropagation()}
    onPointerDown={event => {
      event.stopPropagation();
      backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY);
    }}
    onClick={event => {
      event.stopPropagation();
      if (backdropPress.current && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY)) onClose();
      backdropPress.current = false;
    }}>
    <header className="invite-dialog-heading">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(0 -1)" /></svg>
      <h2 id={titleId}>Пригласить друзей</h2>
    </header>
    <div className="invite-dialog-content">
      <label className="invite-dialog-label" htmlFor={inputId}>Ссылка приглашения</label>
      <input ref={inputRef} id={inputId} className="invite-dialog-link" type="url" readOnly value={link} placeholder={busy ? 'Создаём приглашение…' : 'Ссылка пока недоступна'} spellCheck={false} aria-describedby={statusId} aria-busy={busy} />
      <p id={statusId} className={`invite-dialog-status${error ? ' invite-dialog-error' : ''}`} role={error ? 'alert' : 'status'}>{status}</p>
      <div className="invite-dialog-actions">
        <button type="button" className="secondary-button" disabled={busy || !link || copying} onClick={() => { void copyLink(); }}>Скопировать</button>
        <button ref={closeRef} type="button" className="primary-button" onClick={onClose}>ОК</button>
      </div>
    </div>
  </dialog>, document.body);
}
