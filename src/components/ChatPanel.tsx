import { useEffect, useRef, useState } from "react";
import { MessageSquare, SendHorizontal } from "lucide-react";
import type { ChatMessage } from "@/hooks/useLobby";
import { Avatar, nickColor } from "@/components/Avatar";

type Props = {
  messages: ChatMessage[];
  /** Devolve false quando o limite de mensagens foi atingido */
  onSend: (text: string) => boolean;
  onLimit: () => void;
};

const time = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
    <aside aria-label="Chat de texto" className="flex min-h-96 flex-col bg-background lg:min-h-0">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <MessageSquare className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="font-bold text-foreground">Chat</h2>
        <span className="truncate text-sm text-muted-foreground">· todo mundo no lobby vê</span>
      </header>
      <ol
        ref={listRef}
        aria-live="polite"
        className="flex max-h-[60dvh] flex-1 flex-col overflow-y-auto py-3 lg:max-h-none"
      >
        {messages.length === 0 ? (
          <li className="m-auto grid justify-items-center gap-2 px-6 text-center text-sm text-muted-foreground">
            <MessageSquare className="size-8 opacity-60" aria-hidden />
            Nenhuma mensagem ainda. Diga oi!
          </li>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            // Mensagens seguidas da mesma pessoa (até 5 min) viram um bloco só.
            const grouped = prev?.from === m.from && m.at - prev.at < 5 * 60_000;
            const name = m.mine ? "você" : m.nick;
            return (
              <li
                key={m.id}
                className={`group flex gap-3 px-4 hover:bg-card/60 ${grouped ? "py-0.5" : "mt-2 py-1 first:mt-0"}`}
              >
                {grouped ? (
                  <time
                    aria-hidden
                    className="w-8 shrink-0 pt-0.5 text-right text-[0.625rem] leading-5 text-muted-foreground opacity-0 group-hover:opacity-100"
                  >
                    {time(m.at)}
                  </time>
                ) : (
                  <Avatar nick={m.nick} className="mt-0.5 size-8 text-sm" />
                )}
                <div className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
                  {grouped ? (
                    <span className="sr-only">{name}: </span>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <b className="font-semibold" style={{ color: nickColor(m.nick) }}>
                        {name}
                      </b>
                      <time className="text-xs text-muted-foreground">{time(m.at)}</time>
                    </div>
                  )}
                  <p className="break-words text-foreground/90">{m.text}</p>
                </div>
              </li>
            );
          })
        )}
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (onSend(text)) setText("");
          else onLimit();
        }}
        className="shrink-0 px-4 pb-4"
      >
        <div className="flex items-center gap-1 rounded-lg bg-card pl-3 transition-shadow focus-within:shadow-[0_0_0_2px_var(--color-primary-ink)]">
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
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Enviar"
            title="Enviar"
            className="grid size-11 place-items-center rounded-md text-primary-ink transition-colors hover:bg-secondary disabled:text-muted-foreground disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <SendHorizontal className="size-5" aria-hidden />
          </button>
        </div>
      </form>
    </aside>
  );
}
