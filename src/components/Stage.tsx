import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Settings,
  Volume2,
} from "lucide-react";
import type { Participant } from "@/hooks/useCall";
import type { Volumes } from "@/components/VolumeMenu";
import { Avatar } from "@/components/Avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  micId: string;
  speakerId: string;
  onMic: (deviceId: string) => void;
  onSpeaker: (deviceId: string) => void;
  onToggleMic: () => void;
  onToggleShare: () => void;
  onLeave: () => void;
  onMenu: (id: string, x: number, y: number) => void;
  /** Tela que estou assistindo (null = nenhuma) */
  onWatch: (id: string | null) => void;
};

export function Stage(p: Props) {
  const sharers = p.participants.filter((x) => x.hasVideo);
  const [picked, setPicked] = useState<string | null>(null);
  // Com várias telas, só a escolhida é exibida (e ouvida); por padrão, a primeira.
  const watching = sharers.find((s) => s.id === picked) ?? sharers[0] ?? null;
  const others = p.tiles.some((t) => !t.isMe);

  // Reenvia também quando surge uma tela nova: quem começou agora precisa saber que não é a vista.
  const sharerKey = sharers.map((s) => s.id).join();
  const { onWatch } = p;
  useEffect(() => {
    onWatch(watching?.id ?? null);
  }, [onWatch, watching?.id, sharerKey]);

  return (
    <section aria-label={`Sala ${p.roomName}`} className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <Volume2 className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="font-bold text-foreground">{p.roomName}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          · {p.tiles.length} {p.tiles.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {p.sharing && !p.shareAudioOn ? (
          <p className="mb-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            Você está compartilhando sem som. Pare, compartilhe de novo, escolha uma
            <strong className="text-foreground"> aba do Chrome</strong> e marque
            <strong className="text-foreground"> “Compartilhar áudio da guia”</strong>.
          </p>
        ) : null}

        {sharers.length > 1 ? (
          <div
            role="group"
            aria-label="Escolher qual tela assistir"
            className="mb-3 flex flex-wrap items-center gap-1.5"
          >
            <span className="mr-1 text-sm text-muted-foreground">Assistir:</span>
            {sharers.map((s) => {
              const on = s.id === watching?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(s.id)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Avatar nick={s.nick} className="size-7 text-xs" /> {s.nick}
                </button>
              );
            })}
          </div>
        ) : null}

        {watching ? <ScreenView key={watching.id} participant={watching} /> : null}

        <div className={watching ? "" : "flex flex-1 flex-col sm:justify-center"}>
          <ul
            aria-label="Participantes"
            className={`grid gap-3 ${
              watching
                ? "grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]"
                : "grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] justify-center sm:grid-cols-[repeat(auto-fit,minmax(11rem,16rem))]"
            }`}
          >
            {p.tiles.map((t) => (
              <li
                key={t.id}
                tabIndex={0}
                title={t.isMe ? undefined : "Botão direito: volume só para você"}
                onContextMenu={(e) => {
                  if (t.isMe) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  p.onMenu(t.id, e.clientX || r.left, e.clientY || r.bottom);
                }}
                className={`relative flex flex-col items-center gap-2 rounded-lg bg-card px-2 transition-colors ${
                  watching ? "pb-2 pt-7" : "pb-3 pt-10"
                } ${t.isMe ? "" : "cursor-context-menu hover:bg-secondary"}`}
              >
                {/* Quem está sendo assistido já tem o rótulo na própria transmissão */}
                {t.sharing && t.id !== watching?.id ? (
                  <span className="absolute left-2 top-2 rounded bg-live px-1.5 text-[0.6875rem] font-extrabold leading-5 tracking-wide text-white">
                    AO VIVO
                  </span>
                ) : null}
                <Avatar
                  nick={t.nick}
                  speaking={t.speaking}
                  gap="var(--color-card)"
                  className={watching ? "size-12 text-lg" : "size-20 text-3xl"}
                />
                {t.speaking ? <span className="sr-only">falando</span> : null}
                <span
                  className={`flex max-w-full items-center gap-1.5 text-sm font-semibold text-foreground ${
                    watching ? "" : "mt-2"
                  }`}
                >
                  {t.muted ? (
                    <>
                      <MicOff className="size-3.5 shrink-0 text-destructive" aria-hidden />
                      <span className="sr-only">mudo,</span>
                    </>
                  ) : null}
                  <span className="truncate">
                    {t.nick}
                    {t.isMe ? " (você)" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {others ? (
            <p className={`mt-3 text-xs text-muted-foreground ${watching ? "" : "sm:text-center"}`}>
              Clique com o botão direito em alguém (ou{" "}
              <kbd className="rounded border border-border bg-card px-1 font-sans text-[0.6875rem] font-semibold text-foreground">
                Shift+F10
              </kbd>
              ) para ajustar o volume só para você.
            </p>
          ) : null}
        </div>
      </div>

      {/* Doca de controles: fixa embaixo; "Sair" isolado dos outros para não ser clicado sem querer */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex shrink-0 items-center justify-center gap-2 border-t border-border bg-rail px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:sticky lg:z-auto lg:pb-3">
        <DockButton
          label={p.micOn ? "Silenciar" : "Ativar microfone"}
          onClick={p.onToggleMic}
          tone={p.micOn ? "idle" : "alert"}
        >
          {p.micOn ? (
            <Mic className="size-5" aria-hidden />
          ) : (
            <MicOff className="size-5" aria-hidden />
          )}
        </DockButton>
        <DockButton
          label={p.sharing ? "Parar de compartilhar" : "Compartilhar tela"}
          onClick={p.onToggleShare}
          tone={p.sharing ? "on" : "idle"}
        >
          {p.sharing ? (
            <MonitorOff className="size-5" aria-hidden />
          ) : (
            <MonitorUp className="size-5" aria-hidden />
          )}
        </DockButton>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Microfone e saída de áudio"
              title="Microfone e saída de áudio"
              className={dock("idle")}
            >
              <Settings className="size-5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            sideOffset={10}
            className="w-80 rounded-lg p-4 shadow-[0_8px_24px_oklch(0_0_0/45%)]"
          >
            <DevicePicker
              micId={p.micId}
              speakerId={p.speakerId}
              onMic={p.onMic}
              onSpeaker={p.onSpeaker}
            />
          </PopoverContent>
        </Popover>
        <span aria-hidden className="mx-2 h-8 w-px bg-border" />
        <button
          type="button"
          onClick={p.onLeave}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-live px-5 text-sm font-bold text-white transition-[filter] hover:brightness-110"
        >
          <PhoneOff className="size-5" aria-hidden /> Sair
        </button>
      </div>

      {/* Áudio remoto: voz e áudio da tela com volumes independentes; tela não escolhida fica muda */}
      {p.participants.map((x) => {
        const v = p.volumes(x.nick);
        return (
          <div key={x.id} className="hidden">
            <RemoteAudio stream={x.micStream} volume={v.voice} sinkId={p.speakerId} />
            <RemoteAudio
              stream={x.screenStream}
              volume={v.screen}
              sinkId={p.speakerId}
              muted={watching?.id !== x.id}
            />
          </div>
        );
      })}
    </section>
  );
}

type Tone = "idle" | "on" | "alert";
const dock = (tone: Tone) =>
  `grid size-11 place-items-center rounded-full transition-colors ${
    tone === "on"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : tone === "alert"
        ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
        : "bg-secondary text-foreground hover:bg-secondary/70"
  }`;

function DockButton({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: Tone;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={dock(tone)}>
      {children}
    </button>
  );
}

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
      className="group relative mb-3 grid place-items-center overflow-hidden rounded-lg bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label={`Tela de ${participant.nick}`}
        onDoubleClick={toggleFull}
        className={`block w-full object-contain ${full ? "h-full" : "max-h-[62dvh]"}`}
      />
      <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded bg-rail/85 px-2 py-0.5 text-sm font-semibold text-foreground">
        <span className="rounded bg-live px-1 text-[0.625rem] font-extrabold leading-4 tracking-wide text-white">
          AO VIVO
        </span>
        {participant.nick}
      </span>
      <button
        type="button"
        onClick={toggleFull}
        aria-label={full ? "Sair da tela cheia" : "Tela cheia"}
        title={full ? "Sair da tela cheia" : "Tela cheia"}
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-md bg-rail/85 text-foreground transition-colors hover:bg-rail"
      >
        {full ? (
          <Minimize2 className="size-4" aria-hidden />
        ) : (
          <Maximize2 className="size-4" aria-hidden />
        )}
      </button>
      {participant.videoStalled || participant.connection === "disconnected" ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-rail/70 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> reconectando a transmissão…
        </div>
      ) : null}
    </div>
  );
}

// Escolher a saída de áudio: Chrome/Edge/Firefox sim, Safari não (aí o seletor some).
const canPickOutput = () =>
  typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
// Entradas-apelido do Chrome; o "Padrão do sistema" já cobre.
const isAlias = (d: MediaDeviceInfo) => d.deviceId === "default" || d.deviceId === "communications";

function DevicePicker(p: {
  micId: string;
  speakerId: string;
  onMic: (id: string) => void;
  onSpeaker: (id: string) => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    const md = navigator.mediaDevices;
    const load = () => void md.enumerateDevices().then(setDevices, () => {});
    load();
    md.addEventListener("devicechange", load);
    return () => md.removeEventListener("devicechange", load);
  }, []);

  const pick = (
    kind: MediaDeviceKind,
    id: string,
    label: string,
    name: string,
    onPick: (id: string) => void,
  ) => {
    const list = devices.filter((d) => d.kind === kind && !isAlias(d));
    return (
      <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
        <select
          value={list.some((d) => d.deviceId === id) ? id : ""}
          onChange={(e) => onPick(e.target.value)}
          className="min-h-10 min-w-0 rounded-md border border-border bg-input px-2.5 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition-colors focus:border-primary-ink"
        >
          <option value="">Padrão do sistema</option>
          {list.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${name} ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <div className="grid gap-3">
      {pick("audioinput", p.micId, "Microfone", "Microfone", p.onMic)}
      {canPickOutput()
        ? pick("audiooutput", p.speakerId, "Saída de áudio", "Saída", p.onSpeaker)
        : null}
    </div>
  );
}

function RemoteAudio({
  stream,
  volume,
  sinkId,
  muted,
}: {
  stream: MediaStream;
  volume: number;
  sinkId: string;
  muted?: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current as
      (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    // Dispositivo que sumiu: o navegador rejeita e o áudio segue na saída atual.
    void el?.setSinkId?.(sinkId).catch(() => {});
  }, [sinkId]);
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
