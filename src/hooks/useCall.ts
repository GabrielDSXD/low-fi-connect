import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Participant = {
  id: string;
  nick: string;
  micStream: MediaStream;
  screenStream: MediaStream;
  hasVideo: boolean;
  /** Faixa de vídeo existe, mas está sem dados chegando (rede instável) */
  videoStalled: boolean;
  connection: RTCPeerConnectionState;
};
export type ChatMessage = {
  id: string;
  from: string;
  nick: string;
  text: string;
  at: number;
  mine: boolean;
};



type Status = "idle" | "connecting" | "connected" | "error";



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
  /** O peer avisou via presence que está compartilhando tela */
  sharing: boolean;
  recoverTimer: ReturnType<typeof setTimeout> | null;
};

type SignalPayload = {
  to: string;
  from: string;
  nick: string;
  data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
};

export function useCall() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nick, setNick] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [shareAudioOn, setShareAudioOn] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const meRef = useRef<string>("");
  const nickRef = useRef("");
  const roomRef = useRef<string>("");
  const statusRef = useRef<Status>("idle");
  statusRef.current = status;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, PeerState>());
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const sync = useCallback(() => {
    setParticipants(
      [...peersRef.current.entries()].map(([id, p]) => {
        const video = p.screenStream.getVideoTracks().filter((t) => t.readyState === "live");
        return {
          id,
          nick: p.nick,
          micStream: p.micStream,
          screenStream: p.screenStream,
          // Só mostra transmissão quando o peer avisou que está compartilhando:
          // ao parar, a faixa remota continua "viva" (muda) e enganava esse flag.
          hasVideo: p.sharing && video.length > 0,
          videoStalled: video.some((t) => t.muted),
          connection: p.pc.connectionState,
        };
      }),
    );
  }, []);

  const sendSignal = useCallback((to: string, data: SignalPayload["data"]) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: { to, from: meRef.current, nick: nickRef.current, data } satisfies SignalPayload,
    });
  }, []);

  const createPeer = useCallback(
    (id: string, peerNick: string) => {
      const existing = peersRef.current.get(id);
      if (existing) {
        if (peerNick && peerNick !== "…") existing.nick = peerNick;
        return existing;
      }

      // Regra determinística: quem tem o id menor faz a oferta (impolite).
      const polite = meRef.current > id ? false : true;
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
        sharing: false,
        recoverTimer: null,
      };
      peersRef.current.set(id, state);

      // Transceivers fixos: mic, tela (vídeo) e áudio da tela.
      // Assim compartilhar/parar é só replaceTrack, sem renegociação frágil.
      const micTrack = micStreamRef.current?.getAudioTracks()[0] ?? null;
      pc.addTransceiver(micTrack ?? "audio", { direction: "sendrecv" });
      const screen = screenStreamRef.current;
      state.videoSender = pc.addTransceiver(screen?.getVideoTracks()[0] ?? "video", {
        direction: "sendrecv",
      }).sender;
      state.screenAudioSender = pc.addTransceiver(screen?.getAudioTracks()[0] ?? "audio", {
        direction: "sendrecv",
      }).sender;

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
        // Ordem fixa dos transceivers: 0 = microfone, 1 = vídeo da tela, 2 = áudio da tela.
        const index = pc.getTransceivers().indexOf(transceiver);
        const target = index === 0 ? state.micStream : state.screenStream;
        // Após um ICE restart chega uma faixa nova; descarta as antigas mortas
        // para não acumular faixas e travar o <video>.
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

      // Recuperação: quando o caminho P2P cai, o vídeo simplesmente congela.
      // Quem faz a oferta (impolite) reinicia o ICE; o outro lado só responde.
      const scheduleRecovery = (delay: number) => {
        if (state.recoverTimer) return;
        state.recoverTimer = setTimeout(() => {
          state.recoverTimer = null;
          const bad = pc.connectionState === "disconnected" || pc.connectionState === "failed";
          if (!bad || pc.signalingState === "closed") return;
          console.warn(`peer ${id}: conexão ${pc.connectionState}, reiniciando ICE`);
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
        else if (s === "failed") scheduleRecovery(0);
        else if (s === "connected" && state.recoverTimer) {
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

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (payload.to !== meRef.current || payload.from === meRef.current) return;
      const state = createPeer(payload.from, payload.nick || "…");
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
    [createPeer, sendSignal],
  );

  const cleanup = useCallback(() => {
    for (const [, p] of peersRef.current) {
      if (p.recoverTimer) clearTimeout(p.recoverTimer);
      p.pc.close();
    }
    peersRef.current.clear();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    screenStreamRef.current = null;
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setParticipants([]);
    setLocalScreen(null);
    setSharing(false);
    setShareAudioOn(false);
    setMessages([]);
  }, []);

  const join = useCallback(
    async (desiredNick: string, room: string) => {
      const clean = desiredNick.trim().slice(0, 24);
      if (!clean || !room) return;
      setStatus("connecting");
      setError(null);
      setNick(clean);
      nickRef.current = clean;
      roomRef.current = room;
      setRoomId(room);
      meRef.current = crypto.randomUUID();

      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        setMicOn(true);
      } catch {
        micStreamRef.current = null; // segue sem microfone
        setMicOn(false);
      }

      const channel = supabase.channel(`call:${roomRef.current}`, {
        config: { presence: { key: meRef.current }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        void handleSignal(payload as SignalPayload);
      });

      channel.on("broadcast", { event: "chat" }, ({ payload }) => {
        const msg = payload as Omit<ChatMessage, "mine">;
        if (!msg?.text) return;
        setMessages((prev) => [...prev, { ...msg, mine: msg.from === meRef.current }]);
      });

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ id: string; nick: string; sharing?: boolean }>();
        const present = new Map<string, { nick: string; sharing: boolean }>();
        for (const [, entries] of Object.entries(state)) {
          for (const entry of entries) {
            present.set(entry.id, { nick: entry.nick, sharing: !!entry.sharing });
          }
        }
        present.delete(meRef.current);

        for (const [id, info] of present) {
          const peer = createPeer(id, info.nick);
          if (peer.sharing !== info.sharing) peer.sharing = info.sharing;
        }
        // Presence vazio geralmente é uma oscilação do canal; derrubar todos os
        // peers nesse momento matava a transmissão em andamento sem motivo.
        if (present.size > 0) {
          for (const id of [...peersRef.current.keys()]) {
            if (!present.has(id)) {
              const peer = peersRef.current.get(id);
              if (peer?.recoverTimer) clearTimeout(peer.recoverTimer);
              peer?.pc.close();
              peersRef.current.delete(id);
            }
          }
        }
        sync();
      });

      channel.subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          setStatus("connected");
          setError(null);
          await channel.track({ id: meRef.current, nick: clean });
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          console.warn(`canal de sinalização: ${state}`);
          // Já estava na call: o cliente reconecta sozinho e as conexões P2P
          // continuam vivas — não derruba a chamada por isso.
          if (statusRef.current === "connected") {
            setError("Sinalização instável, reconectando… (a call continua)");
          } else {
            setError("Não foi possível conectar à sala. Tente recarregar a página.");
            setStatus("error");
          }
        }
      });
    },
    [createPeer, handleSignal, sync],
  );

  const leave = useCallback(() => {
    cleanup();
    setStatus("idle");
    setRoomId(null);
    roomRef.current = "";
  }, [cleanup]);

  const toggleMic = useCallback(() => {
    const tracks = micStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const next = !tracks[0]?.enabled;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, []);

  // Avisa aos outros se estou compartilhando, para o botão "Assistir
  // transmissão" aparecer/sumir mesmo antes de qualquer faixa chegar.
  const trackPresence = useCallback((sharing: boolean) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.track({ id: meRef.current, nick: nickRef.current, sharing });
  }, []);

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
    trackPresence(false);
  }, [trackPresence]);

  const startShare = useCallback(async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        // Sem processamento de voz: o áudio da tela é música/vídeo, não fala.
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        // O som vai junto apenas do que foi compartilhado (aba/janela),
        // nunca o áudio geral do computador.
        systemAudio: "exclude",
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
      screenStreamRef.current = screen;
      setLocalScreen(screen);
      setSharing(true);
      trackPresence(true);
      const video = screen.getVideoTracks()[0] ?? null;
      const audio = screen.getAudioTracks()[0] ?? null;
      if (video) video.contentHint = "detail";
      if (audio) audio.contentHint = "music";
      setShareAudioOn(!!audio);
      for (const [, p] of peersRef.current) {
        await p.videoSender?.replaceTrack(video ?? null);
        await p.screenAudioSender?.replaceTrack(audio ?? null);
      }
      video?.addEventListener("ended", () => stopShare());
      audio?.addEventListener("ended", () => setShareAudioOn(false));
    } catch {
      /* usuário cancelou */
    }
  }, [stopShare, trackPresence]);


  const toggleShare = useCallback(() => {
    if (sharing) stopShare();
    else void startShare();
  }, [sharing, startShare, stopShare]);

  const sendMessage = useCallback((text: string) => {
    const clean = text.trim().slice(0, 500);
    if (!clean || !channelRef.current) return;
    const msg: Omit<ChatMessage, "mine"> = {
      id: crypto.randomUUID(),
      from: meRef.current,
      nick: nickRef.current,
      text: clean,
      at: Date.now(),
    };
    setMessages((prev) => [...prev, { ...msg, mine: true }]);
    void channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
  }, []);

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    error,
    nick,
    roomId,
    participants,
    micOn,
    sharing,
    localScreen,
    shareAudioOn,
    messages,
    join,
    leave,
    toggleMic,
    toggleShare,
    sendMessage,
  };
}
