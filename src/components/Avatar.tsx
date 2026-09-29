import type { CSSProperties } from "react";

// Matizes espaçados; o apelido escolhe um, então cada amigo tem sempre a mesma cor.
// Longe dos matizes de estado (vermelho 25, verde 152, índigo 278) para nunca parecer status.
const HUES = [95, 185, 215, 245, 310, 345];

export function hueOf(nick: string) {
  let h = 0;
  for (const c of nick.toLowerCase()) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return HUES[h % HUES.length]!;
}

/** Cor legível do apelido sobre o grafite (texto do chat, rótulos). */
export const nickColor = (nick: string) => `oklch(0.82 0.1 ${hueOf(nick)})`;

type Props = {
  nick: string;
  /** Classe de tamanho (ex.: "size-8 text-sm") */
  className?: string;
  speaking?: boolean;
  /** Cor do fundo ao redor, para o vão do anel de fala */
  gap?: string;
};

export function Avatar({ nick, className = "size-8 text-sm", speaking, gap }: Props) {
  const hue = hueOf(nick);
  return (
    <span
      aria-hidden
      style={
        {
          backgroundColor: `oklch(0.52 0.12 ${hue})`,
          color: `oklch(0.96 0.03 ${hue})`,
          "--speaking-gap": gap,
        } as CSSProperties
      }
      className={`grid shrink-0 select-none place-items-center rounded-full font-bold transition-shadow duration-150 ease-out ${
        speaking ? "speaking-ring" : ""
      } ${className}`}
    >
      {[...nick][0]?.toUpperCase()}
    </span>
  );
}
