import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, ChevronDown } from "lucide-react";
import type { ChatMessage } from "@/hooks/useCall";

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, onSend }: Props) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const seenRef = useRef(messages.length);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      seenRef.current = messages.length;
      setUnread(0);
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } else {
      setUnread(messages.filter((m, i) => i >= seenRef.current && !m.mine).length);
    }
  }, [messages, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir chat"
        className="fixed bottom-24 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg backdrop-blur transition hover:opacity-90"
      >
        <MessageSquare className="size-4" /> Chat
        {unread > 0 ? (
          <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {unread}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <aside className="fixed bottom-24 right-5 z-40 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare className="size-4 text-primary" /> Chat
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Minimizar chat"
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ChevronDown className="size-4" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Nenhuma mensagem ainda. Diga oi!
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.mine ? "text-right" : "text-left"}>
              <span className="text-[11px] text-muted-foreground">
                {m.mine ? "você" : m.nick} ·{" "}
                {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <p
                className={`mt-1 inline-block max-w-[85%] break-words rounded-xl px-3 py-2 text-sm ${
                  m.mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {m.text}
              </p>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onSend(text);
          setText("");
        }}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="mensagem"
          maxLength={500}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Enviar mensagem"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </aside>
  );
}
