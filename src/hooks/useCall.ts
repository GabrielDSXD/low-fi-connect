import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { beep } from "@/lib/sfx";
import { freshChannel, type Member } from "@/hooks/useLobby";

export type Participant = {
  id: string;
  nick: string;
  micStream: MediaStream;
  screenStream: MediaStream;
  muted: boolean;
  sharing: boolean;
  /** Está compartilhando e já chegou vídeo */
  hasVideo: boolean;
  /** Faixa de vídeo existe, mas sem dados chegando (rede instável) */
  videoStalled: boolean;
  camStream: MediaStream;
  /** Câmera ligada e com vídeo chegando */
  hasCam: boolean;
  connection: RTCPeerConnectionState;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

// Tela: teto por espectador (a malha multiplica o upload de quem transmite).
export type ScreenQuality = { height: 1080 | 720 | 540; fps: 30 | 45 | 60 };
const DEFAULT_QUALITY: ScreenQuality = { height: 1080, fps: 30 };
const BASE_BITRATE = { 1080: 4_000_000, 720: 2_500_000, 540: 1_500_000 } as const;
const FPS_FACTOR = { 30: 1, 45: 1.25, 60: 1.5 } as const;

/** Teto de envio por espectador para a qualidade escolhida (1080p60 ≈ 6 Mbps). */
const screenLimits = (q: ScreenQuality): RTCRtpEncodingParameters => ({
  maxBitrate: Math.round(BASE_BITRATE[q.height] * FPS_FACTOR[q.fps]),
  maxFramerate: q.fps,
});
const captureConstraints = (q: ScreenQuality) => ({
  frameRate: { ideal: q.fps, max: q.fps },
  height: { max: q.height },
});

export type NoiseMode = "standard" | "ai";

// Microfones processados pelo modelo de IA: o que precisa ser desligado junto com o stream.
const micCleanups = new WeakMap<MediaStream, () => void>();

/** Para o microfone e o que estiver processando ele (modelo de IA). */
function stopMic(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  micCleanups.get(stream)?.();
  micCleanups.delete(stream);
}

let gtcrnWasm: Promise<ArrayBuffer> | null = null;

/**
 * Supressão "IA": GTCRN (rede neural de realce de voz) num AudioWorklet entre o microfone e a
 * chamada. Medido aqui: tira ~40 dB de ruído de fundo e de teclado sem mexer na voz (o
 * RNNoise, testado antes, tirava só 4 a 6 dB). Carregado só quando usado: a lib estende
 * AudioWorkletNode e quebraria a renderização no servidor.
 */
async function withNoiseAi(raw: MediaStream) {
  const [lib, worklet, wasm] = await Promise.all([
    import("@sapphi-red/web-noise-suppressor"),
    import("@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?url"),
    import("@sapphi-red/web-noise-suppressor/gtcrn.wasm?url"),
  ]);
  gtcrnWasm ??= lib.loadGtcrn({ url: wasm.default });
  const ctx = new AudioContext({ sampleRate: 48_000 }); // o GTCRN roda nativo em 48 kHz (ou 16)
  try {
    const wasmBinary = await gtcrnWasm;
    await ctx.audioWorklet.addModule(worklet.default);
    const node = new lib.GtcrnWorkletNode(ctx, { wasmBinary, maxChannels: 1 });
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(raw).connect(node).connect(dest);
    void ctx.resume();
    micCleanups.set(dest.stream, () => {
      node.destroy();
      void ctx.close();
      raw.getTracks().forEach((t) => t.stop());
    });
    return dest.stream;
  } catch (err) {
    gtcrnWasm = null;
    void ctx.close();
    throw err;
  }
}

function readQuality(): ScreenQuality {
  try {
    const q = JSON.parse(localStorage.getItem("screenQuality") ?? "null") as ScreenQuality | null;
    if (q && q.height in BASE_BITRATE && q.fps in FPS_FACTOR) return q;
  } catch {
    /* sem storage ou valor inválido */
  }
  return DEFAULT_QUALITY;
}
const SCREEN_AUDIO_BITRATE = 128_000;
// Câmera: 360p24 basta para rosto; é enviada a todos, então fica leve.
const CAM_VIDEO: RTCRtpEncodingParameters = { maxBitrate: 700_000, maxFramerate: 24 };

/**
 * Opus do áudio da tela (3ª m-line, ordem fixa dos transceivers) em estéreo e com bitrate
 * de música. Cada lado pede isso no próprio SDP, porque quem envia segue o que o outro aceita.
 */
function musicOpus(sdp: string) {
  const parts = sdp.split(/(?=^m=)/m); // [cabeçalho, mic, vídeo, áudio da tela]
  const sec = parts[3];
  const pt = sec?.startsWith("m=audio") ? sec.match(/a=rtpmap:(\d+) opus\/48000\/2/i)?.[1] : null;
  if (!sec || !pt) return sdp;
  parts[3] = sec.replace(new RegExp(`a=fmtp:${pt} [^\\r\\n]*`), (line) =>
    line.includes("stereo=1")
      ? line
      : `${line};stereo=1;sprop-stereo=1;maxaveragebitrate=${SCREEN_AUDIO_BITRATE}`,
  );
  return parts.join("");
}

async function setLocal(pc: RTCPeerConnection) {
  const desc =
    pc.signalingState === "have-remote-offer" ? await pc.createAnswer() : await pc.createOffer();
  await pc.setLocalDescription({ type: desc.type, sdp: musicOpus(desc.sdp ?? "") });
}

// setParameters não aceita chamadas sobrepostas no mesmo sender: enfileira.
const tuneQueue = new WeakMap<RTCRtpSender, Promise<void>>();

/** Liga/desliga o envio de um sender da tela e aplica os limites. */
function tuneSender(
  sender: RTCRtpSender | null,
  active: boolean,
  limits: RTCRtpEncodingParameters,
  framerateFirst: boolean,
) {
  if (!sender) return;
  const run = async () => {
    const params = sender.getParameters() as RTCRtpSendParameters & {
      degradationPreference?: string;
    };
    const enc = params.encodings?.[0];
    if (!enc) return; // ainda não negociado: reaplica ao conectar
    Object.assign(enc, limits, { active });
    if (framerateFirst) params.degradationPreference = "maintain-framerate";
    try {
      await sender.setParameters(params);
    } catch {
      // Navegador sem degradationPreference: aplica o resto (o contentHint já prioriza fps).
      delete params.degradationPreference;
      await sender.setParameters(params);
    }
  };
  const next = (tuneQueue.get(sender) ?? Promise.resolve())
    .then(run)
    .catch((err) => console.warn("setParameters error", err));
  tuneQueue.set(sender, next);
}

type PeerState = {
  pc: RTCPeerConnection;
  nick: string;
  micStream: MediaStream;
  screenStream: MediaStream;
  camStream: MediaStream;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  videoSender: RTCRtpSender | null;
  screenAudioSender: RTCRtpSender | null;
  camSender: RTCRtpSender | null;
  recoverTimer: ReturnType<typeof setTimeout> | null;
  absentTimer: ReturnType<typeof setTimeout> | null;
};

type SignalPayload = {
  to: string;
  from: string;
  nick: string;
  data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
};

type Args = {
  me: { id: string; nick: string } | null;
  members: Member[];
  reconnecting: boolean;
  update: (patch: Partial<Pick<Member, "room" | "muted" | "sharing" | "camera">>) => void;
  notify: (msg: string) => void;
};

/**
 * Chamada P2P (WebRTC em malha) da sala atual. Quem está na sala vem da presença do
 * lobby; a sinalização e o "está falando" trafegam no canal `room:<id>`.
 */
export function useCall({ me, members, reconnecting, update, notify }: Args) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [shareAudioOn, setShareAudioOn] = useState(false);
  const [localCam, setLocalCam] = useState<MediaStream | null>(null);
  const [screenQuality, setScreenQuality] = useState<ScreenQuality>(DEFAULT_QUALITY);
  const qualityRef = useRef<ScreenQuality>(DEFAULT_QUALITY);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  // Dispositivos escolhidos ("" = padrão do sistema), lembrados neste navegador.
  const [micId, setMicId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const micIdRef = useRef("");
  const [noiseMode, setNoiseMode] = useState<NoiseMode>("standard");
  const noiseRef = useRef<NoiseMode>("standard");

  const meRef = useRef("");
  meRef.current = me?.id ?? "";
  const membersRef = useRef<Member[]>([]);
  membersRef.current = members;
  const roomRef = useRef<string | null>(null);
  const joiningRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, PeerState>());
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micOnRef = useRef(true);
  const speakingRef = useRef(false);
  const meterRef = useRef<{ timer: ReturnType<typeof setInterval>; ctx: AudioContext } | null>(
    null,
  );
  const prevIdsRef = useRef<Set<string> | null>(null);
  const prevSharingRef = useRef<Set<string>>(new Set());
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const sync = useCallback(() => setVersion((v) => v + 1), []);

  // Quem cada pessoa está assistindo (avisos "watch"), e quem eu estou assistindo.
  const watchRef = useRef(new Map<string, string | null>());
  const watchingRef = useRef<string | null>(null);

  /**
   * Limites dos senders de vídeo. A tela só vai para quem está assistindo a minha (ou ainda
   * não disse o que assiste); a câmera vai para todos.
   */
  const tunePeer = useCallback((id: string) => {
    const p = peersRef.current.get(id);
    if (!p) return;
    if (camStreamRef.current) tuneSender(p.camSender, true, CAM_VIDEO, true);
    if (!screenStreamRef.current) return;
    const w = watchRef.current.get(id);
    const active = w == null || w === meRef.current;
    tuneSender(p.videoSender, active, screenLimits(qualityRef.current), true);
    tuneSender(p.screenAudioSender, active, { maxBitrate: SCREEN_AUDIO_BITRATE }, false);
  }, []);

  const markSpeaking = useCallback((id: string, on: boolean) => {
    setSpeaking((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const sendSignal = useCallback((to: string, data: SignalPayload["data"]) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: { to, from: meRef.current, nick: "", data } satisfies SignalPayload,
    });
  }, []);

  const closePeer = useCallback(
    (id: string) => {
      const p = peersRef.current.get(id);
      if (!p) return;
      if (p.recoverTimer) clearTimeout(p.recoverTimer);
      if (p.absentTimer) clearTimeout(p.absentTimer);
      p.pc.close();
      peersRef.current.delete(id);
      markSpeaking(id, false);
    },
    [markSpeaking],
  );

  const createPeer = useCallback(
    (id: string, peerNick: string) => {
      const existing = peersRef.current.get(id);
      if (existing) {
        if (peerNick) existing.nick = peerNick;
        return existing;
      }

      // Regra determinística para o desempate de ofertas simultâneas.
      const polite = meRef.current <= id;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const state: PeerState = {
        pc,
        nick: peerNick,
        micStream: new MediaStream(),
        screenStream: new MediaStream(),
        camStream: new MediaStream(),
        polite,
        makingOffer: false,
        ignoreOffer: false,
        videoSender: null,
        screenAudioSender: null,
        camSender: null,
        recoverTimer: null,
        absentTimer: null,
      };
      peersRef.current.set(id, state);

      // Transceivers fixos: mic, tela (vídeo), áudio da tela e câmera (índices 0 a 3 dos dois lados).
      // Compartilhar/parar é só replaceTrack, sem renegociação frágil.
      // Só quem oferta (impolite) cria os transceivers; quem responde reaproveita os que
      // chegam na oferta (ver attachTransceivers), senão sobrariam transceivers duplicados.
      if (!polite) {
        const micTrack = micStreamRef.current?.getAudioTracks()[0] ?? null;
        pc.addTransceiver(micTrack ?? "audio", { direction: "sendrecv" });
        const screen = screenStreamRef.current;
        state.videoSender = pc.addTransceiver(screen?.getVideoTracks()[0] ?? "video", {
          direction: "sendrecv",
        }).sender;
        state.screenAudioSender = pc.addTransceiver(screen?.getAudioTracks()[0] ?? "audio", {
          direction: "sendrecv",
        }).sender;
        state.camSender = pc.addTransceiver(camStreamRef.current?.getVideoTracks()[0] ?? "video", {
          direction: "sendrecv",
        }).sender;
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) sendSignal(id, { candidate: candidate.toJSON() });
      };

      pc.onnegotiationneeded = async () => {
        try {
          state.makingOffer = true;
          await setLocal(pc);
          sendSignal(id, { description: pc.localDescription! });
        } catch (err) {
          console.error("negotiation error", err);
        } finally {
          state.makingOffer = false;
        }
      };

      pc.ontrack = ({ track, transceiver }) => {
        // Ordem fixa: 0 = microfone, 1 = vídeo da tela, 2 = áudio da tela, 3 = câmera.
        const index = pc.getTransceivers().indexOf(transceiver);
        const target =
          index === 0 ? state.micStream : index === 3 ? state.camStream : state.screenStream;
        for (const old of target.getTracks()) {
          if (old.kind === track.kind && old.readyState !== "live") target.removeTrack(old);
        }
        target.addTrack(track);
        sync();
        track.onended = () => {
          try {
            target.removeTrack(track);
          } catch {
            /* noop */
          }
          sync();
        };
        track.onmute = sync;
        track.onunmute = sync;
      };

      // Quando o caminho P2P cai, quem faz a oferta reinicia o ICE.
      const scheduleRecovery = (delay: number) => {
        if (state.recoverTimer) return;
        state.recoverTimer = setTimeout(() => {
          state.recoverTimer = null;
          const bad = pc.connectionState === "disconnected" || pc.connectionState === "failed";
          if (!bad || pc.signalingState === "closed") return;
          if (!state.polite) {
            try {
              pc.restartIce();
            } catch (err) {
              console.error("restartIce error", err);
            }
          }
          scheduleRecovery(6_000);
        }, delay);
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "disconnected") scheduleRecovery(3_000);
        else if (s === "failed") {
          scheduleRecovery(0);
          notifyRef.current(
            `Não foi possível conectar com ${state.nick}. A rede pode estar bloqueando a chamada.`,
          );
        } else if (s === "connected") {
          if (state.recoverTimer) clearTimeout(state.recoverTimer);
          state.recoverTimer = null;
          tunePeer(id); // parâmetros só existem depois de negociar
        }
        sync();
      };

      sync();
      return state;
    },
    [sendSignal, sync, tunePeer],
  );

  /** Quem responde: usa os transceivers criados pela oferta e passa a enviar por eles. */
  const attachTransceivers = useCallback(async (state: PeerState) => {
    if (state.videoSender) return;
    // `cam` falta quando o outro lado ainda usa a versão sem câmera.
    const [mic, video, screenAudio, cam] = state.pc.getTransceivers();
    if (!mic || !video || !screenAudio) return;
    for (const t of [mic, video, screenAudio, cam]) if (t) t.direction = "sendrecv";
    const screen = screenStreamRef.current;
    await mic.sender.replaceTrack(micStreamRef.current?.getAudioTracks()[0] ?? null);
    await video.sender.replaceTrack(screen?.getVideoTracks()[0] ?? null);
    await screenAudio.sender.replaceTrack(screen?.getAudioTracks()[0] ?? null);
    await cam?.sender.replaceTrack(camStreamRef.current?.getVideoTracks()[0] ?? null);
    state.videoSender = video.sender;
    state.screenAudioSender = screenAudio.sender;
    state.camSender = cam?.sender ?? null;
  }, []);

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (payload.to !== meRef.current || payload.from === meRef.current) return;
      // Só uma oferta abre conexão nova; candidatos/respostas atrasados de quem já saiu
      // recriariam um peer fantasma.
      if (!peersRef.current.has(payload.from) && payload.data.description?.type !== "offer") return;
      const known = membersRef.current.find((m) => m.id === payload.from);
      const state = createPeer(payload.from, known?.nick ?? "…");
      const { pc } = state;
      const { description, candidate } = payload.data;

      try {
        if (description) {
          const collision =
            description.type === "offer" && (state.makingOffer || pc.signalingState !== "stable");
          state.ignoreOffer = !state.polite && collision;
          if (state.ignoreOffer) return;

          if (collision && state.polite) {
            await Promise.all([
              pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit),
              pc.setRemoteDescription(description),
            ]);
          } else {
            await pc.setRemoteDescription(description);
          }

          if (description.type === "offer") {
            await attachTransceivers(state);
            await setLocal(pc);
            sendSignal(payload.from, { description: pc.localDescription! });
          }
        } else if (candidate) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            if (!state.ignoreOffer) console.warn("ice error", err);
          }
        }
      } catch (err) {
        console.error("signal error", err);
      }
    },
    [attachTransceivers, createPeer, sendSignal],
  );

  // ---- detector de fala (microfone local) ----
  const stopMeter = useCallback(() => {
    if (!meterRef.current) return;
    clearInterval(meterRef.current.timer);
    void meterRef.current.ctx.close();
    meterRef.current = null;
    // Parar no meio de uma fala (troca de microfone/supressão) deixava o anel preso aceso.
    if (speakingRef.current) {
      markSpeaking(meRef.current, false);
      void channelRef.current?.send({
        type: "broadcast",
        event: "speaking",
        payload: { id: meRef.current, on: false },
      });
    }
    speakingRef.current = false;
  }, [markSpeaking]);

  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      const ctx = new AudioContext();
      void ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let lastLoud = 0;
      const timer = setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) {
          const d = (v - 128) / 128;
          sum += d * d;
        }
        const now = Date.now();
        // Limiar fixo; ajustar se o microfone for muito baixo/alto.
        if (micOnRef.current && Math.sqrt(sum / buf.length) > 0.03) lastLoud = now;
        const on = micOnRef.current && now - lastLoud < 400;
        if (on !== speakingRef.current) {
          speakingRef.current = on;
          markSpeaking(meRef.current, on);
          void channelRef.current?.send({
            type: "broadcast",
            event: "speaking",
            payload: { id: meRef.current, on },
          });
        }
      }, 100);
      meterRef.current = { timer, ctx };
    },
    [markSpeaking, stopMeter],
  );

  // ---- compartilhar tela ----
  const stopShare = useCallback(() => {
    const screen = screenStreamRef.current;
    if (!screen) return;
    for (const [, p] of peersRef.current) {
      void p.videoSender?.replaceTrack(null);
      void p.screenAudioSender?.replaceTrack(null);
    }
    screen.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalScreen(null);
    setSharing(false);
    setShareAudioOn(false);
    if (roomRef.current) update({ sharing: false });
  }, [update]);

  const startShare = useCallback(async () => {
    if (!roomRef.current) return;
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        // Resolução e fps escolhidos pela pessoa (padrão 1080p30).
        video: captureConstraints(qualityRef.current),
        // Sem processamento de voz: o áudio da tela é música/vídeo, não fala.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        // Só o som do que foi compartilhado (aba/janela), nunca o áudio geral do computador.
        systemAudio: "exclude",
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
      // Saiu da sala (ou já compartilhou) enquanto o seletor estava aberto.
      if (!roomRef.current || screenStreamRef.current) {
        screen.getTracks().forEach((t) => t.stop());
        return;
      }
      screenStreamRef.current = screen;
      setLocalScreen(screen);
      setSharing(true);
      update({ sharing: true });
      const video = screen.getVideoTracks()[0] ?? null;
      const audio = screen.getAudioTracks()[0] ?? null;
      // "motion": sob rede apertada, perde resolução antes de perder fluidez (jogo, vídeo).
      if (video) video.contentHint = "motion";
      if (audio) audio.contentHint = "music";
      setShareAudioOn(!!audio);
      for (const [id, p] of peersRef.current) {
        await p.videoSender?.replaceTrack(video);
        await p.screenAudioSender?.replaceTrack(audio);
        tunePeer(id);
      }
      video?.addEventListener("ended", () => stopShare()); // botão "parar" do navegador
      audio?.addEventListener("ended", () => setShareAudioOn(false));
    } catch (err) {
      notify(
        (err as DOMException)?.name === "NotAllowedError"
          ? "A tela não foi compartilhada (você cancelou ou o navegador negou a permissão)."
          : "Não foi possível compartilhar a tela neste dispositivo.",
      );
    }
  }, [notify, stopShare, tunePeer, update]);

  const toggleShare = useCallback(() => {
    if (screenStreamRef.current) stopShare();
    else void startShare();
  }, [startShare, stopShare]);

  // ---- câmera ----
  const camBusyRef = useRef(false);

  const stopCam = useCallback(() => {
    const cam = camStreamRef.current;
    if (!cam) return;
    for (const [, p] of peersRef.current) void p.camSender?.replaceTrack(null);
    cam.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setLocalCam(null);
    if (roomRef.current) update({ camera: false });
  }, [update]);

  const startCam = useCallback(async () => {
    if (!roomRef.current || camBusyRef.current) return;
    camBusyRef.current = true;
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 24, max: 24 },
          facingMode: "user",
        },
      });
      // Saiu da sala (ou já ligou) enquanto o navegador pedia permissão.
      if (!roomRef.current || camStreamRef.current) {
        cam.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = cam.getVideoTracks()[0] ?? null;
      if (track) track.contentHint = "motion";
      camStreamRef.current = cam;
      setLocalCam(cam);
      update({ camera: true });
      for (const [id, p] of peersRef.current) {
        await p.camSender?.replaceTrack(track);
        tunePeer(id);
      }
      track?.addEventListener("ended", () => stopCam()); // câmera desconectada
    } catch (err) {
      const name = (err as DOMException)?.name;
      notify(
        name === "NotAllowedError"
          ? "Sem acesso à câmera. Permita o uso nas configurações do navegador e tente de novo."
          : name === "NotFoundError"
            ? "Nenhuma câmera encontrada."
            : name === "NotReadableError"
              ? "A câmera está em uso por outro programa."
              : "Não foi possível ligar a câmera.",
      );
    } finally {
      camBusyRef.current = false;
    }
  }, [notify, stopCam, tunePeer, update]);

  const toggleCam = useCallback(() => {
    if (camStreamRef.current) stopCam();
    else void startCam();
  }, [startCam, stopCam]);

  /** Muda a qualidade da tela; se já estiver transmitindo, vale na hora. */
  const changeScreenQuality = useCallback(
    (q: ScreenQuality) => {
      qualityRef.current = q;
      setScreenQuality(q);
      try {
        localStorage.setItem("screenQuality", JSON.stringify(q));
      } catch {
        /* noop */
      }
      const video = screenStreamRef.current?.getVideoTracks()[0];
      if (!video) return;
      video.applyConstraints(captureConstraints(q)).catch(() => {
        notify("Não foi possível mudar a qualidade da transmissão neste dispositivo.");
      });
      for (const id of peersRef.current.keys()) tunePeer(id);
    },
    [notify, tunePeer],
  );

  // ---- microfone ----
  useEffect(() => {
    qualityRef.current = readQuality();
    setScreenQuality(qualityRef.current);
    try {
      micIdRef.current = localStorage.getItem("micId") ?? "";
      noiseRef.current = localStorage.getItem("noiseMode") === "ai" ? "ai" : "standard";
      setNoiseMode(noiseRef.current);
      setMicId(micIdRef.current);
      setSpeakerId(localStorage.getItem("speakerId") ?? "");
    } catch {
      /* sem storage: fica no padrão */
    }
  }, []);

  // `ideal`: se o microfone salvo sumiu, usa outro em vez de falhar.
  const getMic = useCallback(async () => {
    const ai = noiseRef.current === "ai";
    const raw = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        // No modo IA o modelo limpa; somar o filtro do navegador só piora a voz.
        noiseSuppression: !ai,
        ...(micIdRef.current ? { deviceId: { ideal: micIdRef.current } } : {}),
      },
    });
    if (!ai) return raw;
    try {
      return await withNoiseAi(raw);
    } catch (err) {
      console.warn("noise ai error", err);
      noiseRef.current = "standard";
      setNoiseMode("standard");
      notifyRef.current(
        "A supressão de ruído avançada não funcionou neste dispositivo; voltei para a padrão.",
      );
      await raw
        .getAudioTracks()[0]
        ?.applyConstraints({ echoCancellation: true, noiseSuppression: true })
        .catch(() => {});
      return raw;
    }
  }, []);

  /** Reabre o microfone com as escolhas atuais e troca na chamada, sem renegociar. */
  const swapMic = useCallback(async () => {
    const old = micStreamRef.current;
    if (!old) return; // fora da sala: vale na próxima entrada
    try {
      const stream = await getMic();
      // Saiu da sala (ou trocou de novo) enquanto abria o microfone.
      if (micStreamRef.current !== old) {
        stopMic(stream);
        return;
      }
      const track = stream.getAudioTracks()[0] ?? null;
      if (track) track.enabled = micOnRef.current;
      // Transceiver 0 é o do microfone nos dois lados (ver createPeer).
      for (const [, p] of peersRef.current) {
        await p.pc.getTransceivers()[0]?.sender.replaceTrack(track);
      }
      micStreamRef.current = stream;
      stopMic(old);
      startMeter(stream);
    } catch {
      notify("Não foi possível usar esse microfone.");
    }
  }, [getMic, notify, startMeter]);

  const changeMic = useCallback(
    async (id: string) => {
      micIdRef.current = id;
      setMicId(id);
      try {
        localStorage.setItem("micId", id);
      } catch {
        /* noop */
      }
      await swapMic();
    },
    [swapMic],
  );

  const changeNoise = useCallback(
    async (mode: NoiseMode) => {
      noiseRef.current = mode;
      setNoiseMode(mode);
      try {
        localStorage.setItem("noiseMode", mode);
      } catch {
        /* noop */
      }
      await swapMic();
    },
    [swapMic],
  );

  const changeSpeaker = useCallback((id: string) => {
    setSpeakerId(id);
    try {
      localStorage.setItem("speakerId", id);
    } catch {
      /* noop */
    }
  }, []);

  const toggleMic = useCallback(() => {
    const tracks = micStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const next = !tracks[0]!.enabled;
    tracks.forEach((t) => (t.enabled = next));
    micOnRef.current = next;
    setMicOn(next);
    beep(next ? "unmute" : "mute"); // só para mim
    if (roomRef.current) update({ muted: !next });
  }, [update]);

  // ---- entrar / sair ----
  const teardown = useCallback(
    (keepMic: boolean) => {
      stopShare();
      stopCam();
      for (const id of [...peersRef.current.keys()]) closePeer(id);
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      if (!keepMic) {
        stopMic(micStreamRef.current);
        micStreamRef.current = null;
        stopMeter();
      }
      roomRef.current = null;
      prevIdsRef.current = null;
      prevSharingRef.current = new Set();
      watchRef.current.clear();
      watchingRef.current = null;
      setSpeaking(new Set());
      setRoomId(null);
    },
    [closePeer, stopCam, stopMeter, stopShare],
  );

  const join = useCallback(
    async (room: string) => {
      if (!me || roomRef.current === room || joiningRef.current) return;
      joiningRef.current = true;
      try {
        if (!micStreamRef.current) {
          try {
            micStreamRef.current = await getMic();
          } catch (err) {
            notify(
              (err as DOMException)?.name === "NotFoundError"
                ? "Nenhum microfone encontrado. Conecte um e tente de novo."
                : "Sem acesso ao microfone. Permita o uso nas configurações do navegador e tente de novo.",
            );
            return;
          }
          startMeter(micStreamRef.current);
        }
        if (roomRef.current) teardown(true);

        micStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
        micOnRef.current = true;
        setMicOn(true);

        const channel = await freshChannel(`room:${room}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;
        channel.on("broadcast", { event: "signal" }, ({ payload }) => {
          void handleSignal(payload as SignalPayload);
        });
        channel.on("broadcast", { event: "speaking" }, ({ payload }) => {
          const p = payload as { id?: string; on?: boolean };
          if (p?.id) markSpeaking(p.id, !!p.on);
        });
        channel.on("broadcast", { event: "watch" }, ({ payload }) => {
          const p = payload as { id?: string; watching?: string | null };
          if (typeof p?.id !== "string") return;
          watchRef.current.set(p.id, typeof p.watching === "string" ? p.watching : null);
          tunePeer(p.id);
        });
        await new Promise<void>((resolve, reject) => {
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
              reject(new Error(status));
          });
        });

        roomRef.current = room;
        setRoomId(room);
        update({ room, muted: false, sharing: false, camera: false });
        beep("in");
      } catch {
        // Fora de qualquer sala: solta o microfone e corrige a presença (troca de sala
        // que falhou ainda mostraria a sala antiga).
        teardown(false);
        update({ room: null, muted: false, sharing: false, camera: false });
        notify("Não foi possível entrar na sala. Tente de novo.");
      } finally {
        joiningRef.current = false;
      }
    },
    [getMic, handleSignal, markSpeaking, me, notify, startMeter, teardown, tunePeer, update],
  );

  /** Avisa a sala qual tela estou assistindo; quem transmite para de mandar para mim a outra. */
  const watch = useCallback((id: string | null) => {
    watchingRef.current = id;
    void channelRef.current?.send({
      type: "broadcast",
      event: "watch",
      payload: { id: meRef.current, watching: id },
    });
  }, []);

  const leave = useCallback(() => {
    teardown(false);
    update({ room: null, muted: false, sharing: false, camera: false });
    beep("out");
  }, [teardown, update]);

  // ---- pessoas da sala (vêm da presença) + sons de entrada/saída dos outros ----
  useEffect(() => {
    if (!roomId || !me) return;
    const inRoom = members.filter((m) => m.room === roomId);
    const ids = new Set(inRoom.map((m) => m.id));

    for (const m of inRoom) {
      if (m.id === me.id) continue;
      const peer = createPeer(m.id, m.nick);
      if (peer.absentTimer) {
        clearTimeout(peer.absentTimer);
        peer.absentTimer = null;
      }
    }
    // Quem sumiu da presença só é removido após uma carência: o sinal de uma pessoa
    // nova pode chegar antes da presença dela, e reconexões oscilam.
    if (!reconnecting) {
      for (const [id, peer] of peersRef.current) {
        if (ids.has(id) || peer.absentTimer) continue;
        peer.absentTimer = setTimeout(() => {
          peer.absentTimer = null;
          const back = membersRef.current.some((m) => m.id === id && m.room === roomRef.current);
          if (!back) closePeer(id);
        }, 4000);
      }
    }

    // Sons só depois que a minha própria presença na sala chegou (evita apitar na entrada).
    if (ids.has(me.id)) {
      const prev = prevIdsRef.current;
      const sharingNow = new Set(inRoom.filter((m) => m.sharing).map((m) => m.id));
      if (prev) {
        // Tela: só quem já estava na sala (entrar compartilhando toca o som de entrada).
        const stayed = [...ids].filter((id) => prev.has(id));
        const was = prevSharingRef.current;
        if (stayed.some((id) => sharingNow.has(id) && !was.has(id))) beep("shareOn");
        else if (stayed.some((id) => !sharingNow.has(id) && was.has(id))) beep("shareOff");
        else if ([...ids].some((id) => !prev.has(id))) beep("in");
        else if ([...prev].some((id) => !ids.has(id))) beep("out");
      }
      prevIdsRef.current = ids;
      prevSharingRef.current = sharingNow;
    }
    sync();
  }, [members, roomId, me, reconnecting, createPeer, closePeer, sync]);

  // Perdeu o lobby (ex.: apelido tomado): a tela volta ao login, então sai da chamada.
  useEffect(() => {
    if (!me && roomRef.current) teardown(false);
  }, [me, teardown]);

  // Liberar tudo ao desmontar.
  useEffect(
    () => () => {
      for (const [, p] of peersRef.current) {
        if (p.recoverTimer) clearTimeout(p.recoverTimer);
        if (p.absentTimer) clearTimeout(p.absentTimer);
        p.pc.close();
      }
      peersRef.current.clear();
      stopMic(micStreamRef.current);
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      stopMeter();
    },
    [stopMeter],
  );

  const participants = useMemo<Participant[]>(() => {
    void version;
    return [...peersRef.current.entries()].map(([id, p]) => {
      const member = members.find((m) => m.id === id);
      const video = p.screenStream.getVideoTracks().filter((t) => t.readyState === "live");
      const isSharing = !!member?.sharing;
      const cam = p.camStream.getVideoTracks().filter((t) => t.readyState === "live");
      return {
        id,
        nick: member?.nick ?? p.nick,
        micStream: p.micStream,
        screenStream: p.screenStream,
        muted: !!member?.muted,
        sharing: isSharing,
        // Ao parar, a faixa remota continua "viva" (muda): só vale se a pessoa avisou que compartilha.
        hasVideo: isSharing && video.length > 0,
        videoStalled: video.some((t) => t.muted),
        camStream: p.camStream,
        // Como na tela: a faixa fica "viva" depois de desligar; vale o aviso da pessoa.
        hasCam: !!member?.camera && cam.length > 0,
        connection: p.pc.connectionState,
      };
    });
  }, [version, members]);

  return {
    roomId,
    participants,
    micOn,
    sharing,
    localScreen,
    shareAudioOn,
    localCam,
    speaking,
    micId,
    speakerId,
    changeMic,
    changeSpeaker,
    noiseMode,
    changeNoise,
    screenQuality,
    changeScreenQuality,
    join,
    leave,
    toggleMic,
    toggleShare,
    toggleCam,
    watch,
  };
}
