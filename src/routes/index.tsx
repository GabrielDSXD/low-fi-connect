import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff, Users, Radio } from "lucide-react";
import { useCall } from "@/hooks/useCall";
import { StreamTile } from "@/components/StreamTile";
import { ChatPanel } from "@/components/ChatPanel";
import { useLobby } from "@/hooks/useLobby";
import { ROOMS } from "@/lib/rooms";

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
  const inLobby = call.status === "idle" || call.status === "error";
  const occupants = useLobby(inLobby);

  if (inLobby) {
    const nickReady = !!input.trim();
    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <Radio className="size-3.5 text-primary" /> 5 salas
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
              Escolha uma sala
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Digite seu nickname e entre na sala em que seus amigos estão.
            </p>
          </div>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="seu nickname"
            maxLength={24}
            autoFocus
            className="mx-auto mb-6 block w-full max-w-sm rounded-xl border border-input bg-card px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROOMS.map((room) => {
              const people = occupants[room.id] ?? [];
              return (
                <div
                  key={room.id}
                  className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-medium text-foreground">{room.name}</h2>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {people.length}
                    </span>
                  </div>
                  <p className="mt-2 min-h-10 text-sm text-muted-foreground">
                    {people.length ? people.join(", ") : "vazia"}
                  </p>
                  <button
                    onClick={() => void call.join(input, room.id)}
                    disabled={!nickReady}
                    className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                  >
                    Entrar
                  </button>
                </div>
              );
            })}
          </div>

          {call.error ? (
            <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {call.error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const total = call.participants.length + 1;
  const roomName = ROOMS.find((r) => r.id === call.roomId)?.name ?? "Sala";

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
        <div className="flex items-center gap-3">
          {call.error ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">{call.error}</span>
          ) : null}
          <span className="text-sm font-medium text-foreground">{call.nick}</span>
        </div>
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

      {call.sharing && !call.shareAudioOn ? (
        <p className="mx-5 mb-3 rounded-xl border border-border bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
          Você está compartilhando sem som. Pare, clique em compartilhar de novo, escolha uma
          <strong className="text-foreground"> aba do Chrome</strong> e marque a opção
          <strong className="text-foreground"> “Compartilhar áudio da guia”</strong>.
        </p>
      ) : null}

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
