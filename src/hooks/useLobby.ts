import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Estado público de cada pessoa no canal "lobby". */
export type Member = {
  id: string;
  nick: string;
  /** Momento em que escolheu o apelido (desempate de apelidos duplicados) */
  at: number;
  room: string | null;
  muted: boolean;
  sharing: boolean;
};

export type ChatMessage = {
  id: string;
  from: string;
  nick: string;
  text: string;
  at: number;
  mine: boolean;
};

type Live = Pick<Member, "muted" | "sharing">;

export const NICK_TAKEN = "Esse apelido já está em uso. Escolha outro.";
const sameNick = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// O Supabase aceita ~5 atualizações de presença por cliente a cada 30 s; na 6ª fecha o canal
// ("Client presence rate limit exceeded"). Fica uma de folga.
const PRESENCE_MAX = 4;
const PRESENCE_WINDOW = 30_000;

/**
 * supabase.channel() reaproveita um canal com o mesmo tópico, inclusive um que ainda está
 * saindo (sair e voltar rápido); aí o subscribe falharia. Espera a saída antes de criar.
 */
export async function freshChannel(name: string, opts: Parameters<typeof supabase.channel>[1]) {
  const stale = supabase.getChannels().filter((c) => c.topic === `realtime:${name}`);
  await Promise.all(stale.map((c) => supabase.removeChannel(c)));
  return supabase.channel(name, opts);
}

function readMembers(channel: RealtimeChannel): Member[] {
  const byId = new Map<string, Member>();
  for (const entries of Object.values(channel.presenceState<Member>())) {
    for (const m of entries) if (m?.id && m?.nick) byId.set(m.id, m);
  }
  return [...byId.values()];
}

/**
 * Canal único "lobby" e chat. Presença (limitada pelo servidor) só carrega quem sou e em que
 * sala estou; mudo/compartilhando mudam toda hora e vão por broadcast.
 * Não há servidor nem banco: tudo vive nos canais em tempo real.
 */
export function useLobby() {
  const [me, setMe] = useState<{ id: string; nick: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [presence, setPresence] = useState<Member[]>([]);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [self, setSelf] = useState<Member | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfRef = useRef<Member | null>(null);
  const readyRef = useRef(false);
  const sentRef = useRef<number[]>([]);
  const trackTimesRef = useRef<number[]>([]);
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownRef = useRef(new Set<string>());
  const connectRef = useRef<() => Promise<void>>(async () => {});

  const drop = useCallback((msg: string | null) => {
    const channel = channelRef.current;
    channelRef.current = null; // antes de remover: o CLOSED que vem depois não é queda
    if (channel) void supabase.removeChannel(channel);
    if (trackTimerRef.current) clearTimeout(trackTimerRef.current);
    trackTimerRef.current = null;
    trackTimesRef.current = [];
    knownRef.current = new Set();
    selfRef.current = null;
    readyRef.current = false;
    setMe(null);
    setSelf(null);
    setPresence([]);
    setLive({});
    setMessages([]);
    setConnecting(false);
    setReconnecting(false);
    setError(msg);
  }, []);

  /**
   * Publica a presença respeitando o limite, sempre com o estado mais recente. `settle` espera
   * uma calmaria: trocar de sala várias vezes seguidas vira um envio só, no fim.
   */
  const flushPresence = useCallback(function flush(settle = false) {
    if (trackTimerRef.current) {
      if (!settle) return; // já agendado: vai sair com o estado mais novo
      clearTimeout(trackTimerRef.current);
    }
    const now = Date.now();
    const times = (trackTimesRef.current = trackTimesRef.current.filter(
      (t) => now - t < PRESENCE_WINDOW,
    ));
    const budget = times.length < PRESENCE_MAX ? 0 : times[0]! + PRESENCE_WINDOW - now;
    const wait = Math.max(budget, settle ? 400 : 0);
    trackTimerRef.current = setTimeout(() => {
      trackTimerRef.current = null;
      const channel = channelRef.current;
      const mine = selfRef.current;
      if (!channel || !mine || !readyRef.current) return;
      trackTimesRef.current.push(Date.now());
      void channel.track(mine).then((r) => {
        if (r !== "ok" && channelRef.current === channel) flush();
      });
    }, wait);
  }, []);

  const broadcastLive = useCallback(() => {
    const channel = channelRef.current;
    const mine = selfRef.current;
    if (!channel || !mine || !readyRef.current) return;
    const payload = { id: mine.id, muted: mine.muted, sharing: mine.sharing };
    void channel.send({ type: "broadcast", event: "state", payload });
  }, []);

  const connect = useCallback(async () => {
    const mine = selfRef.current;
    if (!mine) return;
    channelRef.current = null;
    const channel = await freshChannel("lobby", {
      config: { presence: { key: mine.id }, broadcast: { self: false } },
    });
    if (selfRef.current?.id !== mine.id) {
      void supabase.removeChannel(channel); // saiu enquanto conectava
      return;
    }
    channelRef.current = channel;

    let firstSync: () => void = () => {};
    const synced = new Promise<void>((resolve) => {
      firstSync = resolve;
      setTimeout(resolve, 2000);
    });

    channel.on("presence", { event: "sync" }, () => {
      const list = readMembers(channel);
      setPresence(list);
      firstSync();
      if (!readyRef.current) return;
      const current = selfRef.current!;
      // Duas pessoas escolheram o mesmo apelido ao mesmo tempo: quem chegou primeiro fica.
      const lost = list.some(
        (m) =>
          m.id !== current.id &&
          sameNick(m.nick, current.nick) &&
          (m.at < current.at || (m.at === current.at && m.id < current.id)),
      );
      if (lost) return drop(NICK_TAKEN);
      // Quem acabou de chegar não recebeu os broadcasts de mudo/tela: reenvia o meu.
      const ids = new Set(list.map((m) => m.id));
      if ([...ids].some((id) => id !== current.id && !knownRef.current.has(id))) broadcastLive();
      knownRef.current = ids;
    });

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      const p = payload as Partial<Live & { id: string }>;
      if (typeof p?.id !== "string") return;
      setLive((prev) => ({ ...prev, [p.id!]: { muted: !!p.muted, sharing: !!p.sharing } }));
    });

    channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      // Vem de outros clientes: valida e limita como no envio.
      const msg = payload as Omit<ChatMessage, "mine">;
      if (typeof msg?.text !== "string" || typeof msg?.id !== "string" || !msg.text) return;
      const clean = {
        id: msg.id,
        from: String(msg.from),
        nick: String(msg.nick).slice(0, 20),
        text: msg.text.slice(0, 500),
        at: Number(msg.at) || Date.now(),
        mine: false,
      };
      setMessages((prev) => [...prev, clean].slice(-200));
    });

    channel.subscribe(async (status) => {
      if (channelRef.current !== channel) return; // canal antigo
      if (status === "SUBSCRIBED") {
        if (readyRef.current) {
          // Reconectou: o servidor zera a contagem por conexão; republica tudo.
          setReconnecting(false);
          trackTimesRef.current = [];
          flushPresence();
          broadcastLive();
          return;
        }
        await synced;
        if (readMembers(channel).some((m) => sameNick(m.nick, mine.nick))) return drop(NICK_TAKEN);
        readyRef.current = true;
        setMe({ id: mine.id, nick: mine.nick });
        setSelf(mine);
        setConnecting(false);
        flushPresence();
      } else if (status === "CLOSED") {
        // O servidor fechou o canal (ex.: limite de presença). Sem isso o lobby morria calado.
        if (!readyRef.current) return drop("Não foi possível conectar. Tente de novo.");
        setReconnecting(true);
        setTimeout(() => {
          if (channelRef.current === channel) void connectRef.current();
        }, 1000);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (readyRef.current) setReconnecting(true);
        else drop("Não foi possível conectar. Verifique a internet e tente de novo.");
      }
    });
  }, [broadcastLive, drop, flushPresence]);
  connectRef.current = connect;

  const claim = useCallback(
    async (raw: string) => {
      const nick = raw.trim().replace(/\s+/g, " ");
      if (nick.length < 2 || nick.length > 20) {
        setError("Use de 2 a 20 caracteres.");
        return;
      }
      setError(null);
      setConnecting(true);
      selfRef.current = {
        id: crypto.randomUUID(),
        nick,
        at: Date.now(),
        room: null,
        muted: false,
        sharing: false,
      };
      await connect();
    },
    [connect],
  );

  /** Atualiza o que os outros veem sobre mim (sala, mudo, compartilhando). */
  const update = useCallback(
    (patch: Partial<Pick<Member, "room" | "muted" | "sharing">>) => {
      const prev = selfRef.current;
      if (!prev) return;
      const next = { ...prev, ...patch };
      selfRef.current = next;
      if (readyRef.current) setSelf(next);
      if (next.room !== prev.room) flushPresence(true);
      if (next.muted !== prev.muted || next.sharing !== prev.sharing) broadcastLive();
    },
    [broadcastLive, flushPresence],
  );

  /** Devolve false quando o limite de mensagens foi atingido. */
  const sendChat = useCallback((raw: string) => {
    const text = raw.trim().slice(0, 500);
    const mine = selfRef.current;
    const channel = channelRef.current;
    if (!text || !mine || !channel) return true;
    const now = Date.now();
    sentRef.current = sentRef.current.filter((t) => now - t < 5000);
    if (sentRef.current.length >= 5) return false;
    sentRef.current.push(now);
    const msg = { id: crypto.randomUUID(), from: mine.id, nick: mine.nick, text, at: now };
    setMessages((prev) => [...prev, { ...msg, mine: true }].slice(-200));
    void channel.send({ type: "broadcast", event: "chat", payload: msg });
    return true;
  }, []);

  useEffect(
    () => () => {
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
      if (trackTimerRef.current) clearTimeout(trackTimerRef.current);
    },
    [],
  );

  // Presença + broadcasts de mudo/tela; eu mesmo sempre com o estado local (sem esperar o servidor).
  const members = useMemo(() => {
    const list = presence.map((m) => (live[m.id] ? { ...m, ...live[m.id] } : m));
    if (!self) return list;
    const i = list.findIndex((m) => m.id === self.id);
    if (i < 0) return [...list, self];
    const copy = list.slice();
    copy[i] = self;
    return copy;
  }, [presence, live, self]);

  return { me, connecting, error, reconnecting, members, messages, claim, update, sendChat };
}
