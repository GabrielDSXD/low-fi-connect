import { useCallback, useEffect, useRef, useState } from "react";

export type Participant = {
  id: string;
  nick: string;
  stream: MediaStream;
  hasVideo: boolean;
  speaking?: boolean;
};

type Status = "idle" | "connecting" | "connected" | "error";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

function signalingUrl() {
  const fromEnv = import.meta.env['VITE_SIGNALING_URL'] as string | undefined;
  if (fromEnv) return fromEnv;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:3001`;
}

type PeerState = {
  pc: RTCPeerConnection;
  nick: string;
  stream: MediaStream;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
};

export function useCall() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nick, setNick] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef(new Map<string, PeerState>());
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const sync = useCallback(() => {
    setParticipants(
      [...peersRef.current.entries()].map(([id, p]) => ({
        id,
        nick: p.nick,
        stream: p.stream,
        hasVideo: p.stream.getVideoTracks().some((t) => t.readyState === "live" && !t.muted),
      })),
    );
  }, []);

  const sendSignal = useCallback((to: string, data: unknown) => {
    wsRef.current?.send(JSON.stringify({ type: "signal", to, data }));
  }, []);

  const createPeer = useCallback(
    (id: string, peerNick: string, polite: boolean) => {
      const existing = peersRef.current.get(id);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const state: PeerState = {
        pc,
        nick: peerNick,
        stream: new MediaStream(),
        polite,
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswer: false,
      };
      peersRef.current.set(id, state);

      for (const track of micStreamRef.current?.getTracks() ?? []) pc.addTrack(track);
      for (const track of screenStreamRef.current?.getTracks() ?? []) pc.addTrack(track);

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) sendSignal(id, { candidate });
      };

      pc.onnegotiationneeded = async () => {
        try {
          state.makingOffer = true;
          await pc.setLocalDescription();
          sendSignal(id, { description: pc.localDescription });
        } catch (err) {
          console.error("negotiation error", err);
        } finally {
          state.makingOffer = false;
        }
      };

      pc.ontrack = ({ track }) => {
        state.stream.addTrack(track);
        sync();
        const drop = () => {
          try {
            state.stream.removeTrack(track);
          } catch {
            /* noop */
          }
          sync();
        };
        track.onended = drop;
        track.onmute = sync;
        track.onunmute = sync;
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") sync();
      };

      sync();
      return state;
    },
    [sendSignal, sync],
  );

  const handleSignal = useCallback(
    async (from: string, data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      const state = peersRef.current.get(from) ?? createPeer(from, "…", true);
      const { pc } = state;

      try {
        if (data.description) {
          const offerCollision =
            data.description.type === "offer" &&
            (state.makingOffer || pc.signalingState !== "stable");
          state.ignoreOffer = !state.polite && offerCollision;
          if (state.ignoreOffer) return;

          await pc.setRemoteDescription(data.description);
          if (data.description.type === "offer") {
            await pc.setLocalDescription();
            sendSignal(from, { description: pc.localDescription });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!state.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error("signal error", err);
      }
    },
    [createPeer, sendSignal],
  );

  const cleanup = useCallback(() => {
    for (const [, p] of peersRef.current) p.pc.close();
    peersRef.current.clear();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    screenStreamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setParticipants([]);
    setLocalScreen(null);
    setSharing(false);
  }, []);

  const join = useCallback(
    async (desiredNick: string) => {
      const clean = desiredNick.trim().slice(0, 24);
      if (!clean) return;
      setStatus("connecting");
      setError(null);
      setNick(clean);

      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        setMicOn(true);
      } catch {
        micStreamRef.current = null; // segue sem microfone
        setMicOn(false);
      }

      const ws = new WebSocket(signalingUrl());
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ type: "join", nick: clean }));

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "welcome") {
          setStatus("connected");
          // Quem chega inicia a negociação com quem já estava (impolite).
          for (const peer of msg.peers as { id: string; nick: string }[]) {
            createPeer(peer.id, peer.nick, false);
          }
        } else if (msg.type === "peer-joined") {
          createPeer(msg.peer.id, msg.peer.nick, true);
        } else if (msg.type === "peer-left") {
          const state = peersRef.current.get(msg.id);
          state?.pc.close();
          peersRef.current.delete(msg.id);
          sync();
        } else if (msg.type === "signal") {
          await handleSignal(msg.from, msg.data);
        }
      };

      ws.onerror = () => {
        setError("Não foi possível falar com o servidor de sinalização.");
        setStatus("error");
      };

      ws.onclose = () => {
        setStatus((s) => (s === "error" ? s : "idle"));
      };
    },
    [createPeer, handleSignal, sync],
  );

  const leave = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const toggleMic = useCallback(() => {
    const tracks = micStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const next = !tracks[0]?.enabled;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, []);

  const stopShare = useCallback(() => {
    const screen = screenStreamRef.current;
    if (!screen) return;
    for (const [, p] of peersRef.current) {
      for (const sender of p.pc.getSenders()) {
        if (sender.track && screen.getTracks().includes(sender.track)) {
          p.pc.removeTrack(sender);
        }
      }
    }
    screen.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalScreen(null);
    setSharing(false);
  }, []);

  const startShare = useCallback(async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      screenStreamRef.current = screen;
      setLocalScreen(screen);
      setSharing(true);
      for (const [, p] of peersRef.current) {
        for (const track of screen.getTracks()) p.pc.addTrack(track);
      }
      screen.getVideoTracks()[0]?.addEventListener("ended", () => stopShare());
    } catch {
      /* usuário cancelou */
    }
  }, [stopShare]);

  const toggleShare = useCallback(() => {
    if (sharing) stopShare();
    else void startShare();
  }, [sharing, startShare, stopShare]);

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    error,
    nick,
    participants,
    micOn,
    sharing,
    localScreen,
    join,
    leave,
    toggleMic,
    toggleShare,
  };
}
