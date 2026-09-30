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
  // Mudo/desmudo: mais grave e curto que entrar/sair, para não confundir.
  mute: [
    [392, 0],
    [262, 0.07],
  ],
  unmute: [
    [262, 0],
    [392, 0.07],
  ],
  // Tela: três notas, para se destacar dos bipes de entrada/saída.
  shareOn: [
    [523, 0],
    [659, 0.08],
    [784, 0.16],
  ],
  shareOff: [
    [784, 0],
    [659, 0.08],
    [523, 0.16],
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
