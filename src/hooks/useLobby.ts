import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROOMS } from "@/lib/rooms";

/**
 * Observa o presence de cada sala para mostrar quem já está dentro,
 * sem entrar na chamada nem abrir conexões P2P.
 */
export function useLobby(enabled: boolean) {
  const [occupants, setOccupants] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!enabled) return;
    const channels = ROOMS.map((room) => {
      const channel = supabase.channel(`call:${room.id}`, {
        config: { presence: { key: `lobby-${crypto.randomUUID()}` }, broadcast: { self: false } },
      });
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ id: string; nick: string }>();
        const nicks = new Map<string, string>();
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (entry?.id && entry?.nick) nicks.set(entry.id, entry.nick);
          }
        }
        setOccupants((prev) => ({ ...prev, [room.id]: [...nicks.values()] }));
      });
      channel.subscribe();
      return channel;
    });

    return () => {
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return occupants;
}
