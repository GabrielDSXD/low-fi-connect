import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Avatar } from "@/components/Avatar";

export type Volumes = { voice: number; screen: number };

type Props = {
  nick: string;
  x: number;
  y: number;
  /** Só mostra o controle da tela se a pessoa estiver compartilhando */
  sharing: boolean;
  volumes: Volumes;
  onChange: (patch: Partial<Volumes>) => void;
  onClose: () => void;
};

/** Pop-up de volume individual (só para quem ouve). Abre com botão direito ou Shift+F10. */
export function VolumeMenu({ nick, x, y, sharing, volumes, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8)),
    });
    el.querySelector<HTMLElement>("[role=slider]")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const row = (label: string, key: keyof Volumes) => (
    <div className="grid gap-1.5 text-sm">
      <span
        id={`vol-${key}`}
        className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </span>
      <div className="flex items-center gap-3">
        <Slider
          aria-labelledby={`vol-${key}`}
          min={0}
          max={100}
          step={5}
          value={[Math.round(volumes[key] * 100)]}
          onValueChange={([v]) => onChange({ [key]: (v ?? 0) / 100 })}
        />
        <output className="w-10 text-right tabular-nums text-muted-foreground">
          {Math.round(volumes[key] * 100)}%
        </output>
      </div>
    </div>
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Volume de ${nick}`}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 grid w-72 gap-4 rounded-lg border border-border bg-popover p-4 shadow-[0_8px_24px_oklch(0_0_0/45%)]"
    >
      <div className="flex items-center gap-2.5">
        <Avatar nick={nick} className="size-8 text-sm" />
        <strong className="truncate text-foreground">{nick}</strong>
      </div>
      {row("Voz", "voice")}
      {sharing ? row("Compartilhamento de tela", "screen") : null}
      <small className="text-xs text-muted-foreground">Só você ouve essa mudança.</small>
    </div>
  );
}
