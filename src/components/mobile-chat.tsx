import { useEffect, useRef } from 'react';
import { Chat } from './chat';
import type { ChatMessage } from '@/game/room';

export function MobileChat({
  messages,
  unread,
  open,
  setOpen,
  onSend,
}: {
  messages: ChatMessage[];
  unread: number;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSend: (id: string, text: string) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    if (open) panel?.showModal();
    else panel?.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="chat-launcher"
        aria-label={`Chat du salon${unread ? `, ${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          width="25"
          height="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M21 11.5a9 9 0 0 1-13 8L3 21l1.5-5A9 9 0 1 1 21 11.5Z" />
          <path d="M8 10h8m-8 4h5" />
        </svg>
        {unread > 0 && <span aria-hidden="true">{unread}</span>}
      </button>
      <dialog
        className="mobile-chat"
        ref={dialog}
        aria-labelledby="mobile-chat-title"
        onCancel={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setOpen(false);
        }}
      >
        <div className="mobile-chat-body">
          <header>
            <h2 id="mobile-chat-title">Chat du salon</h2>
            <button
              type="button"
              autoFocus
              aria-label="Fermer le chat"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <Chat messages={messages} onSend={onSend} visible={open} />
        </div>
      </dialog>
    </>
  );
}
