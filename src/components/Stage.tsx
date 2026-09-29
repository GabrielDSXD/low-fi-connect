import { useEffect, useRef, useState } from "react";
import {
  Eye,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorOff,
  MonitorUp,
  PhoneOff,
} from "lucide-react";
import type { Participant } from "@/hooks/useCall";
import type { Volumes } from "@/components/VolumeMenu";

export type Tile = {
  id: string;
  nick: string;
  isMe: boolean;
  muted: boolean;
  sharing: boolean;
  speaking: boolean;
};

type Props = {
  roomName: string;
  tiles: Tile[];
  participants: Participant[];
  micOn: boolean;
  sharing: boolean;
  shareAudioOn: boolean;
  volumes: (nick: string) => Volumes;
  onToggleMic: () => void;
  onToggleShare: () => void;
  onLeave: () => void;
  onMenu: (id: string, x: number, y: number) => void;
};

export function Stage(p: Props) {
  const sharers = p.participants.filter((x) => x.hasVideo);
  const [picked, setPicked] = useState<string | null>(null);
  // Com várias telas, só a escolhida é exibida (e ouvida); por padrão, a primeira.
  const watching = sharers.find((s) => s.id === picked) ?? sharers[0] ?? null;

  return (
    <section
      aria-label={`Sala ${p.roomName}`}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{p.roomName}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={p.onToggleMic} className={btn(!p.micOn)}>
            {p.micOn ? (
              <Mic className="size-4" aria-hidden />
            ) : (
              <MicOff className="size-4" aria-hidden />
            )}
            {p.micOn ? "Silenciar" : "Ativar microfone"}
          </button>
          <button type="button" onClick={p.onToggleShare} className={btn(p.sharing)}>
            {p.sharing ? (
              <MonitorOff className="size-4" aria-hidden />
            ) : (
              <MonitorUp className="size-4" aria-hidden />
            )}
            {p.sharing ? "Parar de compartilhar" : "Compartilhar tela"}
          </button>
          <button
            type="button"
            onClick={p.onLeave}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-destructive transition hover:bg-secondary"
          >
            <PhoneOff className="size-4" aria-hidden /> Sair da sala
          </button>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Clique com o botão direito em alguém (ou Shift+F10) para ajustar o volume só para você.
      </p>

      {p.sharing && !p.shareAudioOn ? (
        <p className="mb-3 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Você está compartilhando sem som. Pare, compartilhe de novo, escolha uma
          <strong className="text-foreground"> aba do Chrome</strong> e marque
          <strong className="text-foreground"> “Compartilhar áudio da guia”</strong>.
        </p>
      ) : null}

      {sharers.length > 1 ? (
        <div
          role="group"
          aria-label="Escolher qual tela assistir"
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-muted-foreground">Assistir:</span>
          {sharers.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === watching?.id}
              onClick={() => setPicked(s.id)}
              className={btn(s.id === watching?.id)}
            >
              <Eye className="size-4" aria-hidden /> {s.nick}
            </button>
          ))}
        </div>
      ) : null}

      {watching ? <ScreenView key={watching.id} participant={watching} /> : null}

      <ul
        aria-label="Participantes"
        className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3"
      >
        {p.tiles.map((t) => (
          <li
            key={t.id}
            tabIndex={0}
            onContextMenu={(e) => {
              if (t.isMe) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              p.onMenu(t.id, e.clientX || r.left, e.clientY || r.bottom);
            }}
            className={`rounded-2xl border-2 bg-background px-2 py-4 text-center transition ${
              t.speaking ? "border-speaking ring-4 ring-speaking/25" : "border-border"
            } ${t.isMe ? "" : "cursor-context-menu"}`}
          >
            <div className="mx-auto mb-1.5 grid size-14 place-items-center rounded-full bg-secondary text-2xl font-extrabold text-primary">
              {[...t.nick][0]?.toUpperCase()}
            </div>
            <div className="break-words font-bold text-foreground">
              {t.nick}
              {t.isMe ? " (você)" : ""}
            </div>
            {t.speaking ? <span className="sr-only">falando</span> : null}
            <div className="mt-1 flex min-h-6 flex-wrap justify-center gap-1">
              {t.muted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 text-xs font-bold text-destructive">
                  <MicOff className="size-3" aria-hidden /> Mudo
                </span>
              ) : null}
              {t.sharing ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 text-xs font-bold text-destructive">
                  <MonitorUp className="size-3" aria-hidden /> Compartilhando
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Áudio remoto: voz e áudio da tela com volumes independentes; tela não escolhida fica muda */}
      {p.participants.map((x) => {
        const v = p.volumes(x.nick);
        return (
          <div key={x.id} className="hidden">
            <RemoteAudio stream={x.micStream} volume={v.voice} />
            <RemoteAudio stream={x.screenStream} volume={v.screen} muted={watching?.id !== x.id} />
          </div>
        );
      })}
    </section>
  );
}

const btn = (on: boolean) =>
  `inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition hover:opacity-90 ${
    on
      ? "border-destructive bg-destructive/10 text-destructive"
      : "border-border bg-card text-foreground hover:bg-secondary"
  }`;

/** Vídeo da tela de outra pessoa, com botão (e duplo clique) de tela cheia. */
function ScreenView({ participant }: { participant: Participant }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== participant.screenStream) el.srcObject = participant.screenStream;
    // Depois de oscilações de rede o elemento pode ficar pausado: reforça o play.
    const resume = () => void el.play().catch(() => {});
    resume();
    el.addEventListener("pause", resume);
    el.addEventListener("stalled", resume);
    return () => {
      el.removeEventListener("pause", resume);
      el.removeEventListener("stalled", resume);
    };
  }, [participant.screenStream]);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = () => {
    const box = boxRef.current;
    const video = videoRef.current as
      (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (box?.requestFullscreen) void box.requestFullscreen();
    else video?.webkitEnterFullscreen?.(); // iOS: só o <video> vai a tela cheia
  };

  return (
    <div
      ref={boxRef}
      className="relative mb-3 grid place-items-center overflow-hidden rounded-2xl bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label={`Tela de ${participant.nick}`}
        onDoubleClick={toggleFull}
        className={`block w-full object-contain ${full ? "h-full" : "max-h-[60dvh]"}`}
      />
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-0.5 text-xs font-bold text-destructive">
        <MonitorUp className="size-3" aria-hidden /> Tela de {participant.nick}
      </span>
      <button
        type="button"
        onClick={toggleFull}
        className="absolute right-2 top-2 inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-card/90 px-3 text-sm font-semibold text-foreground backdrop-blur transition hover:opacity-80"
      >
        {full ? (
          <Minimize2 className="size-4" aria-hidden />
        ) : (
          <Maximize2 className="size-4" aria-hidden />
        )}
        {full ? "Sair da tela cheia" : "Tela cheia"}
      </button>
      {participant.videoStalled || participant.connection === "disconnected" ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 text-xs text-muted-foreground backdrop-blur-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> reconectando a transmissão…
        </div>
      ) : null}
    </div>
  );
}

function RemoteAudio({
  stream,
  volume,
  muted,
}: {
  stream: MediaStream;
  volume: number;
  muted?: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    // Faixas que chegam depois (áudio da tela) podem deixar o elemento pausado.
    const resume = () => {
      if (el.paused) void el.play().catch(() => {});
    };
    resume();
    el.addEventListener("pause", resume);
    document.addEventListener("click", resume);
    const id = setInterval(resume, 2_000);
    return () => {
      el.removeEventListener("pause", resume);
      document.removeEventListener("click", resume);
      clearInterval(id);
    };
  }, [stream]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, volume));
    el.muted = !!muted;
  }, [volume, muted]);
  return <audio ref={ref} autoPlay />;
}
