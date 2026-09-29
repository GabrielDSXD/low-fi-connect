import { MicOff, MonitorUp, Volume2 } from "lucide-react";
import { ROOMS } from "@/lib/rooms";
import type { Member } from "@/hooks/useLobby";
import { Avatar } from "@/components/Avatar";

type Props = {
  members: Member[];
  currentRoom: string | null;
  meId: string;
  speaking: Set<string>;
  onJoin: (roomId: string) => void;
  /** Botão direito (ou Shift+F10) em alguém da sala atual */
  onMenu: (id: string, x: number, y: number) => void;
};

export function RoomList({ members, currentRoom, meId, speaking, onJoin, onMenu }: Props) {
  return (
    <nav aria-label="Salas de voz">
      <h2 className="px-2 pb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Salas de voz
      </h2>
      <ul className="grid gap-0.5">
        {ROOMS.map((room) => {
          const people = members.filter((m) => m.room === room.id);
          const current = room.id === currentRoom;
          return (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => onJoin(room.id)}
                aria-current={current || undefined}
                aria-label={
                  current
                    ? `${room.name}, você está aqui`
                    : `Entrar na sala ${room.name}, ${people.length} ${people.length === 1 ? "pessoa" : "pessoas"}`
                }
                className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-[0.9375rem] font-semibold transition-colors ${
                  current
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Volume2 className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{room.name}</span>
                {people.length ? (
                  <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                    {people.length}
                  </span>
                ) : null}
              </button>
              {people.length ? (
                <ul className="grid gap-px py-1 pl-6">
                  {people.map((m) => {
                    const talking = speaking.has(m.id);
                    return (
                      <li
                        key={m.id}
                        onContextMenu={(e) => {
                          if (!current || m.id === meId) return;
                          e.preventDefault();
                          onMenu(m.id, e.clientX, e.clientY);
                        }}
                        className={`flex min-h-8 items-center gap-2 rounded-md px-1.5 text-sm ${
                          talking ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        <Avatar
                          nick={m.nick}
                          speaking={talking}
                          gap="var(--color-rail)"
                          className="size-6 text-[0.6875rem]"
                        />
                        <span className="min-w-0 truncate">
                          {m.nick}
                          {m.id === meId ? " (você)" : ""}
                        </span>
                        {talking ? <span className="sr-only"> (falando)</span> : null}
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          {m.sharing ? (
                            <>
                              <span
                                aria-hidden
                                className="grid size-5 place-items-center rounded bg-live text-white"
                              >
                                <MonitorUp className="size-3" />
                              </span>
                              <span className="sr-only">ao vivo</span>
                            </>
                          ) : null}
                          {m.muted ? (
                            <>
                              <MicOff className="size-3.5 text-destructive" aria-hidden />
                              <span className="sr-only">mudo</span>
                            </>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
