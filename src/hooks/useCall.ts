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
  connection: RTCPeerConnectionState;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

type PeerState = {
  pc: RTCPeerConnection;
  nick: string;
  micStream: MediaStream;
  screenStream: MediaStream;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  videoSender: RTCRtpSender | null;
  screenAudioSender: RTCRtpSender | null;
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
  update: (patch: Partial<Pick<Member, "room" | "muted" | "sharing">>) => void;
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
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);

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
  const micOnRef = useRef(true);
  const speakingRef = useRef(false);
  const meterRef = useRef<{ timer: ReturnType<typeof setInterval>; ctx: AudioContext } | null>(
    null,
  );
  const prevIdsRef = useRef<Set<string> | null>(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const sync = useCallback(() => setVersion((v) => v + 1), []);

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
        polite,
        makingOffer: false,
        ignoreOffer: false,
        videoSender: null,
        screenAudioSender: null,
        recoverTimer: null,
        absentTimer: null,
      };
      peersRef.current.set(id, state);

      // Transceivers fixos: mic, tela (vídeo) e áudio da tela (índices 0, 1 e 2 dos dois lados).
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
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) sendSignal(id, { candidate: candidate.toJSON() });
      };

      pc.onnegotiationneeded = async () => {
        try {
          state.makingOffer = true;
          await pc.setLocalDescription();
          sendSignal(id, { description: pc.localDescription! });
        } catch (err) {
          console.error("negotiation error", err);
        } finally {
          state.makingOffer = false;
        }
      };

      pc.ontrack = ({ track, transceiver }) => {
        // Ordem fixa: 0 = microfone, 1 = vídeo da tela, 2 = áudio da tela.
        const index = pc.getTransceivers().indexOf(transceiver);
        const target = index === 0 ? state.micStream : state.screenStream;
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
        } else if (s === "connected" && state.recoverTimer) {
          clearTimeout(state.recoverTimer);
          state.recoverTimer = null;
        }
        sync();
      };

      sync();
      return state;
    },
    [sendSignal, sync],
  );

  /** Quem responde: usa os 3 transceivers criados pela oferta e passa a enviar por eles. */
  const attachTransceivers = useCallback(async (state: PeerState) => {
    if (state.videoSender) return;
    const [mic, video, screenAudio] = state.pc.getTransceivers();
    if (!mic || !video || !screenAudio) return;
    for (const t of [mic, video, screenAudio]) t.direction = "sendrecv";
    const screen = screenStreamRef.current;
    await mic.sender.replaceTrack(micStreamRef.current?.getAudioTracks()[0] ?? null);
    await video.sender.replaceTrack(screen?.getVideoTracks()[0] ?? null);
    await screenAudio.sender.replaceTrack(screen?.getAudioTracks()[0] ?? null);
    state.videoSender = video.sender;
    state.screenAudioSender = screenAudio.sender;
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
            await pc.setLocalDescription();
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
    speakingRef.current = false;
  }, []);

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
        video: { frameRate: 30 },
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
      if (video) video.contentHint = "detail";
      if (audio) audio.contentHint = "music";
      setShareAudioOn(!!audio);
      for (const [, p] of peersRef.current) {
        await p.videoSender?.replaceTrack(video);
        await p.screenAudioSender?.replaceTrack(audio);
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
  }, [notify, stopShare, update]);

  const toggleShare = useCallback(() => {
    if (screenStreamRef.current) stopShare();
    else void startShare();
  }, [startShare, stopShare]);

  // ---- microfone ----
  const toggleMic = useCallback(() => {
    const tracks = micStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const next = !tracks[0]!.enabled;
    tracks.forEach((t) => (t.enabled = next));
    micOnRef.current = next;
    setMicOn(next);
    if (roomRef.current) update({ muted: !next });
  }, [update]);

  // ---- entrar / sair ----
  const teardown = useCallback(
    (keepMic: boolean) => {
      stopShare();
      for (const id of [...peersRef.current.keys()]) closePeer(id);
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      if (!keepMic) {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        stopMeter();
      }
      roomRef.current = null;
      prevIdsRef.current = null;
      setSpeaking(new Set());
      setRoomId(null);
    },
    [closePeer, stopMeter, stopShare],
  );

  const join = useCallback(
    async (room: string) => {
      if (!me || roomRef.current === room || joiningRef.current) return;
      joiningRef.current = true;
      try {
        if (!micStreamRef.current) {
          try {
            micStreamRef.current = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
            });
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
        await new Promise<void>((resolve, reject) => {
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
              reject(new Error(status));
          });
        });

        roomRef.current = room;
        setRoomId(room);
        update({ room, muted: false, sharing: false });
        beep("in");
      } catch {
        // Fora de qualquer sala: solta o microfone e corrige a presença (troca de sala
        // que falhou ainda mostraria a sala antiga).
        teardown(false);
        update({ room: null, muted: false, sharing: false });
        notify("Não foi possível entrar na sala. Tente de novo.");
      } finally {
        joiningRef.current = false;
      }
    },
    [handleSignal, markSpeaking, me, notify, startMeter, teardown, update],
  );

  const leave = useCallback(() => {
    teardown(false);
    update({ room: null, muted: false, sharing: false });
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
      if (prev) {
        if ([...ids].some((id) => !prev.has(id))) beep("in");
        else if ([...prev].some((id) => !ids.has(id))) beep("out");
      }
      prevIdsRef.current = ids;
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
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
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
    speaking,
    join,
    leave,
    toggleMic,
    toggleShare,
  };
}
