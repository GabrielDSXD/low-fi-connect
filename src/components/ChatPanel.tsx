import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { ChatMessage } from "@/hooks/useLobby";

type Props = {
  messages: ChatMessage[];
  /** Devolve false quando o limite de mensagens foi atingido */
  onSend: (text: string) => boolean;
  onLimit: () => void;
};

/** Chat de texto global: todo mundo no lobby vê, esteja em sala ou não. */
export function ChatPanel({ messages, onSend, onLimit }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Desconta a mensagem recém-chegada, senão uma mensagem longa impede o auto-scroll.
    const last = el.lastElementChild?.clientHeight ?? 0;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight - last < 80;
    if (near || messages[messages.length - 1]?.mine) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <aside
      aria-label="Chat de texto"
      className="flex min-h-80 flex-col rounded-2xl border border-border bg-card p-4"
    >
      <h2 className="mb-2 text-sm font-semibold text-foreground">Chat</h2>
      <ol
        ref={listRef}
        aria-live="polite"
        className="mb-3 grid max-h-[50dvh] flex-1 content-start gap-2 overflow-y-auto lg:max-h-none"
      >
        {messages.length === 0 ? (
          <li className="text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga oi!</li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className="break-words text-sm">
              <b className={m.mine ? "text-primary" : "text-foreground"}>
                {m.mine ? "você" : m.nick}
              </b>
              <time className="ml-1.5 text-xs text-muted-foreground">
                {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </time>
              <div className="text-foreground">{m.text}</div>
            </li>
          ))
        )}
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (onSend(text)) setText("");
          else onLimit();
        }}
        className="flex gap-2"
      >
        <label htmlFor="chat-text" className="sr-only">
          Mensagem
        </label>
        <input
          id="chat-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem"
          maxLength={500}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden /> Enviar
        </button>
      </form>
    </aside>
  );
}
