// Efeitos sonoros sintetizados (sem arquivos de áudio).
const SOUNDS = {
  in: [
    [523, 0],
    [784, 0.09],
  ],
  out: [
    [784, 0],
    [523, 0.09],
  ],
} as const;

let ctx: AudioContext | null = null;

export function beep(name: keyof typeof SOUNDS) {
  try {
    ctx = ctx ?? new AudioContext();
    void ctx.resume();
    const t0 = ctx.currentTime;
    for (const [freq, at] of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0 + at);
      gain.gain.linearRampToValueAtTime(0.15, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.18);
    }
  } catch {
    /* sem áudio disponível: ignora */
  }
}
