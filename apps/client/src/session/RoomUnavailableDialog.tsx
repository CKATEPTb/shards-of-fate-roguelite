import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './roomUnavailableDialog.css';

export function RoomUnavailableDialog({ onExit }: { onExit: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    dialog?.showModal();
    exitRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<dialog ref={dialogRef} className="room-unavailable-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onExit(); }}
    onSubmit={event => { event.preventDefault(); event.stopPropagation(); }}
    onKeyDown={event => event.stopPropagation()}
    onPointerDown={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()}>
    <h2 id={titleId}>Комната не существует</h2>
    <button ref={exitRef} type="button" className="primary-button" onClick={onExit}>Выйти</button>
  </dialog>, document.body);
}
