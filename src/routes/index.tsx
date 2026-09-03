import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff, Users, Radio } from "lucide-react";
import { useCall } from "@/hooks/useCall";
import { StreamTile } from "@/components/StreamTile";
import { ChatPanel } from "@/components/ChatPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sala — call com compartilhamento de tela" },
      {
        name: "description",
        content:
          "Escolha um nickname e entre na mesma call com seus amigos. Compartilhe sua tela e assista as telas dos outros, direto no navegador.",
      },
      { property: "og:title", content: "Sala — call com compartilhamento de tela" },
      {
        property: "og:description",
        content: "Uma sala única, só com nickname. Voz e compartilhamento de tela P2P.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const call = useCall();
  const [input, setInput] = useState("");

  if (call.status === "idle" || call.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <Radio className="size-3.5 text-primary" /> sala única
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
              Entrar na call
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha um nickname. Todos caem na mesma sala.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void call.join(input);
            }}
            className="space-y-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="seu nickname"
              maxLength={24}
              autoFocus
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              Entrar
            </button>
          </form>

          {call.error ? (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {call.error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const total = call.participants.length + 1;

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          <span>
            {total} {total === 1 ? "pessoa" : "pessoas"} na call
          </span>
          {call.status === "connecting" ? <span>· conectando…</span> : null}
        </div>
        <span className="text-sm font-medium text-foreground">{call.nick}</span>
      </header>

      <section className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <StreamTile
          screenStream={call.localScreen}
          nick={call.nick}
          hasVideo={!!call.localScreen}
          isLocal
          muted={!call.micOn}
          label="você"
        />
        {call.participants.map((p) => (
          <StreamTile
            key={p.id}
            screenStream={p.screenStream}
            micStream={p.micStream}
            nick={p.nick}
            hasVideo={p.hasVideo}
            videoStalled={p.videoStalled || p.connection === "disconnected"}
          />
        ))}


      </section>

      <ChatPanel messages={call.messages} onSend={call.sendMessage} />

      <footer className="sticky bottom-0 flex items-center justify-center gap-3 border-t border-border bg-card/80 px-5 py-4 backdrop-blur">
        <button
          onClick={call.toggleMic}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition hover:opacity-90"
        >
          {call.micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          {call.micOn ? "Microfone" : "Mudo"}
        </button>
        <button
          onClick={call.toggleShare}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition hover:opacity-90 ${
            call.sharing
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-secondary text-secondary-foreground"
          }`}
        >
          {call.sharing ? <MonitorOff className="size-4" /> : <MonitorUp className="size-4" />}
          {call.sharing ? "Parar de compartilhar" : "Compartilhar tela"}
        </button>
        <button
          onClick={call.leave}
          className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
        >
          <PhoneOff className="size-4" /> Sair
        </button>
      </footer>
    </main>
  );
}
