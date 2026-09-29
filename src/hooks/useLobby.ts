import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Estado público de cada pessoa, publicado via presence no canal "lobby". */
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

export const NICK_TAKEN = "Esse apelido já está em uso. Escolha outro.";
const sameNick = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function readMembers(channel: RealtimeChannel): Member[] {
  const byId = new Map<string, Member>();
  for (const entries of Object.values(channel.presenceState<Member>())) {
    for (const m of entries) if (m?.id && m?.nick) byId.set(m.id, m);
  }
  return [...byId.values()];
}

/**
 * Canal único "lobby": presença de todo mundo (apelido, sala, mudo, tela) e chat.
 * Não há servidor nem banco: tudo vive nos canais em tempo real.
 */
export function useLobby() {
  const [me, setMe] = useState<{ id: string; nick: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfRef = useRef<Member | null>(null);
  const readyRef = useRef(false);
  const sentRef = useRef<number[]>([]);

  const drop = useCallback((msg: string | null) => {
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    selfRef.current = null;
    readyRef.current = false;
    setMe(null);
    setMembers([]);
    setMessages([]);
    setConnecting(false);
    setReconnecting(false);
    setError(msg);
  }, []);

  const claim = useCallback(
    async (raw: string) => {
      const nick = raw.trim().replace(/\s+/g, " ");
      if (nick.length < 2 || nick.length > 20) {
        setError("Use de 2 a 20 caracteres.");
        return;
      }
      setError(null);
      setConnecting(true);

      const self: Member = {
        id: crypto.randomUUID(),
        nick,
        at: Date.now(),
        room: null,
        muted: false,
        sharing: false,
      };
      selfRef.current = self;
      const channel = supabase.channel("lobby", {
        config: { presence: { key: self.id }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      let firstSync: () => void = () => {};
      const synced = new Promise<void>((resolve) => {
        firstSync = resolve;
        setTimeout(resolve, 2000);
      });

      channel.on("presence", { event: "sync" }, () => {
        const list = readMembers(channel);
        setMembers(list);
        firstSync();
        if (!readyRef.current) return;
        // Duas pessoas escolheram o mesmo apelido ao mesmo tempo: quem chegou primeiro fica.
        const mine = selfRef.current!;
        const lost = list.some(
          (m) =>
            m.id !== mine.id &&
            sameNick(m.nick, mine.nick) &&
            (m.at < mine.at || (m.at === mine.at && m.id < mine.id)),
        );
        if (lost) drop(NICK_TAKEN);
      });

      channel.on("broadcast", { event: "chat" }, ({ payload }) => {
        const msg = payload as Omit<ChatMessage, "mine">;
        if (!msg?.text || !msg?.id) return;
        setMessages((prev) => [...prev, { ...msg, mine: false }].slice(-200));
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          if (readyRef.current) {
            // Reconectou: republica a presença.
            setReconnecting(false);
            await channel.track(selfRef.current!);
            return;
          }
          await synced;
          if (readMembers(channel).some((m) => sameNick(m.nick, nick))) return drop(NICK_TAKEN);
          readyRef.current = true;
          setMe({ id: self.id, nick });
          setConnecting(false);
          await channel.track(selfRef.current!);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (readyRef.current) setReconnecting(true);
          else drop("Não foi possível conectar. Verifique a internet e tente de novo.");
        }
      });
    },
    [drop],
  );

  /** Atualiza o que os outros veem sobre mim (sala, mudo, compartilhando). */
  const update = useCallback((patch: Partial<Pick<Member, "room" | "muted" | "sharing">>) => {
    const self = selfRef.current;
    if (!self) return;
    selfRef.current = { ...self, ...patch };
    void channelRef.current?.track(selfRef.current);
  }, []);

  /** Devolve false quando o limite de mensagens foi atingido. */
  const sendChat = useCallback((raw: string) => {
    const text = raw.trim().slice(0, 500);
    const self = selfRef.current;
    const channel = channelRef.current;
    if (!text || !self || !channel) return true;
    const now = Date.now();
    sentRef.current = sentRef.current.filter((t) => now - t < 5000);
    if (sentRef.current.length >= 5) return false;
    sentRef.current.push(now);
    const msg = { id: crypto.randomUUID(), from: self.id, nick: self.nick, text, at: now };
    setMessages((prev) => [...prev, { ...msg, mine: true }].slice(-200));
    void channel.send({ type: "broadcast", event: "chat", payload: msg });
    return true;
  }, []);

  useEffect(
    () => () => {
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
    },
    [],
  );

  return { me, connecting, error, reconnecting, members, messages, claim, update, sendChat };
}
