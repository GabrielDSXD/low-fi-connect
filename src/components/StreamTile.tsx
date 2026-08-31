import { useEffect, useRef } from "react";
import { MicOff, MonitorOff } from "lucide-react";

type Props = {
  stream: MediaStream | null;
  nick: string;
  hasVideo: boolean;
  muted?: boolean;
  label?: string;
};

export function StreamTile({ stream, nick, hasVideo, muted, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream, hasVideo]);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)]">
      <div className="aspect-video w-full bg-muted/40">
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
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
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/90 to-transparent px-3 py-2">
        <span className="truncate text-sm font-medium text-foreground">{nick}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {label}
          {muted ? <MicOff className="size-3.5" /> : null}
        </span>
      </div>
      {/* Áudio remoto sempre reproduzido, mesmo sem vídeo */}
      {!hasVideo && stream ? <HiddenAudio stream={stream} muted={muted === true} /> : null}
    </div>
  );
}

function HiddenAudio({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay muted={muted} className="hidden" />;
}
