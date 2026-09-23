import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './newGameDialog.css';

interface NewGameDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function NewGameDialog({ onCancel, onConfirm }: NewGameDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const backdropPress = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    dialog?.showModal();
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const outside = (dialog: HTMLDialogElement, x: number, y: number) => {
    const bounds = dialog.getBoundingClientRect();
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  };

  return createPortal(<dialog ref={dialogRef} className="new-game-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onCancel(); }}
    onSubmit={event => { event.preventDefault(); event.stopPropagation(); }}
    onKeyDown={event => event.stopPropagation()}
    onPointerDown={event => {
      event.stopPropagation();
      backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY);
    }}
    onClick={event => {
      event.stopPropagation();
      if (backdropPress.current && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY)) onCancel();
      backdropPress.current = false;
    }}>
    <header className="new-game-dialog-heading"><h2 id={titleId}>Начать новую игру?</h2></header>
    <div className="new-game-dialog-content">
      <p id={descriptionId}>Начав новую игру, вы бросите текущий поход. Продолжить его больше не получится.</p>
      <div className="new-game-dialog-actions">
        <button ref={cancelRef} type="button" className="secondary-button" onClick={onCancel}>Отмена</button>
        <button type="button" className="primary-button" onClick={onConfirm}>Начать новую игру</button>
      </div>
    </div>
  </dialog>, document.body);
}
