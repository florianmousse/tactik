'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/game/room';
export function Chat({
  messages,
  onSend,
  disabled = false,
  visible = true,
}: {
  messages: ChatMessage[];
  onSend: (id: string, text: string) => Promise<boolean>;
  disabled?: boolean;
  visible?: boolean;
}) {
  const [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(false);
  const pending = useRef<{ id: string; text: string } | null>(null),
    list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = list.current;
    if (!node || !visible) return;
    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, messages.length, messages.at(-1)?.id]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy || disabled) return;
    const message =
      pending.current?.text === text.trim()
        ? pending.current
        : { id: crypto.randomUUID(), text: text.trim() };
    pending.current = message;
    setBusy(true);
    try {
      const ok = await onSend(message.id, message.text);
      setFailure(!ok);
      if (ok) {
        setText('');
        pending.current = null;
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="chat-panel" aria-label="Chat du salon">
      <div
        className="message-list"
        ref={list}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!messages.length && <p className="muted">Aucun message.</p>}
        {messages.map((m) => (
          <article key={m.id} className={m.me ? 'message mine' : 'message'}>
            <header>
              <b>{m.name}</b>
              <time dateTime={m.at}>
                {new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </header>
            <p>{m.text}</p>
          </article>
        ))}
      </div>
      <form onSubmit={send}>
        <label className="sr-only" htmlFor="chat-message">
          Message
        </label>
        <input
          id="chat-message"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFailure(false);
          }}
          maxLength={500}
          disabled={disabled || busy}
          placeholder="Message au salon"
          autoComplete="off"
        />
        <button className="primary" disabled={disabled || busy || !text.trim()}>
          {busy ? 'Envoi...' : failure ? 'Réessayer' : 'Envoyer'}
        </button>
      </form>
      {failure && (
        <p role="alert" className="error-text">
          Message non envoyé. Le texte est conservé.
        </p>
      )}
    </section>
  );
}
