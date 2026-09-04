import { useEffect, useRef, useState } from "react";
import { Maximize2, MicOff, MonitorOff, Volume2, VolumeX, Monitor, Loader2 } from "lucide-react";

type Props = {
  /** Stream com o vídeo (e áudio) do compartilhamento de tela */
  screenStream: MediaStream | null;
  /** Stream com o microfone do participante (nulo para você mesmo) */
  micStream?: MediaStream | null;
  nick: string;
  hasVideo: boolean;
  /** Vídeo existe mas está sem receber dados (rede instável) */
  videoStalled?: boolean;
  /** Tile local: nunca reproduz o próprio áudio */
  isLocal?: boolean;
  muted?: boolean;
  label?: string;
};

export function StreamTile({
  screenStream,
  micStream,
  nick,
  hasVideo,
  videoStalled,
  isLocal,
  muted,
  label,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [micVol, setMicVol] = useState(1);
  const [screenVol, setScreenVol] = useState(1);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== screenStream) el.srcObject = screenStream;
    // Depois de uma oscilação de rede o elemento pode ficar pausado e nunca
    // voltar sozinho — reforça o play.
    const resume = () => void el.play().catch(() => {});
    resume();
    el.addEventListener("pause", resume);
    el.addEventListener("stalled", resume);
    return () => {
      el.removeEventListener("pause", resume);
      el.removeEventListener("stalled", resume);
    };
  }, [screenStream, hasVideo]);

  const goFullscreen = () => {
    const el = hasVideo ? videoRef.current : containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };


  return (
    <div
      ref={containerRef}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)]"
    >
      <div className="relative aspect-video w-full bg-muted/40">
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-xl font-semibold text-secondary-foreground">
              {nick.slice(0, 2).toUpperCase()}
            </div>
            <span className="flex items-center gap-1.5 text-xs">
              <MonitorOff className="size-3.5" /> sem tela compartilhada
            </span>
          </div>
        )}
        {hasVideo && videoStalled ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 text-xs text-muted-foreground backdrop-blur-sm">
            <Loader2 className="size-4 animate-spin" /> reconectando a transmissão…
          </div>
        ) : null}
      </div>


      {/* Ações */}
      <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {!isLocal ? (
          <button
            type="button"
            onClick={() => setShowControls((v) => !v)}
            title="Volume"
            aria-label="Ajustar volume deste participante"
            className="rounded-lg border border-border bg-card/90 p-2 text-foreground backdrop-blur transition hover:opacity-80"
          >
            {micVol === 0 && screenVol === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>
        ) : null}
        {hasVideo ? (
          <button
            type="button"
            onClick={goFullscreen}
            title="Tela cheia"
            aria-label="Assistir em tela cheia"
            className="rounded-lg border border-border bg-card/90 p-2 text-foreground backdrop-blur transition hover:opacity-80"
          >
            <Maximize2 className="size-4" />
          </button>
        ) : null}
      </div>

      {!isLocal && showControls ? (
        <div className="absolute right-2 top-14 w-56 space-y-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Volume2 className="size-3.5" /> voz
              </span>
              <span>{Math.round(micVol * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={micVol}
              onChange={(e) => setMicVol(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Monitor className="size-3.5" /> áudio da tela
              </span>
              <span>{Math.round(screenVol * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={screenVol}
              onChange={(e) => setScreenVol(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/90 to-transparent px-3 py-2">
        <span className="truncate text-sm font-medium text-foreground">{nick}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {label}
          {muted ? <MicOff className="size-3.5" /> : null}
        </span>
      </div>

      {/* Áudio remoto: voz e áudio da tela com volumes independentes */}
      {!isLocal ? (
        <>
          <RemoteAudio stream={micStream ?? null} volume={micVol} />
          <RemoteAudio stream={screenStream} volume={screenVol} />
        </>
      ) : null}
    </div>
  );
}

function RemoteAudio({ stream, volume }: { stream: MediaStream | null; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    // Faixas de áudio que chegam depois (áudio da tela) podem deixar o
    // elemento pausado: reforça o play e destrava autoplay no 1º clique.
    const resume = () => void el.play().catch(() => {});
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
    if (el) el.volume = Math.min(1, volume);
  }, [stream, volume]);
  return <audio ref={ref} autoPlay className="hidden" />;
}

