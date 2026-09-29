import { MicOff, MonitorUp } from "lucide-react";
import { ROOMS } from "@/lib/rooms";
import type { Member } from "@/hooks/useLobby";

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
      <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Salas</h2>
      <ul className="grid gap-3">
        {ROOMS.map((room) => {
          const people = members.filter((m) => m.room === room.id);
          const current = room.id === currentRoom;
          return (
            <li
              key={room.id}
              className={`rounded-2xl border bg-card p-2 ${
                current ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => onJoin(room.id)}
                aria-current={current || undefined}
                aria-label={
                  current
                    ? `${room.name}, você está aqui`
                    : `Entrar na sala ${room.name}, ${people.length} ${people.length === 1 ? "pessoa" : "pessoas"}`
                }
                className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left font-semibold text-foreground transition hover:bg-secondary"
              >
                <span>{room.name}</span>
                <small className="font-medium text-muted-foreground">
                  {current ? "Você está aqui" : `${people.length} na sala`}
                </small>
              </button>
              <ul className="grid gap-0.5 px-2 py-1 text-sm">
                {people.length === 0 ? (
                  <li className="text-muted-foreground">Ninguém por aqui</li>
                ) : (
                  people.map((m) => {
                    const talking = speaking.has(m.id);
                    return (
                      <li
                        key={m.id}
                        onContextMenu={(e) => {
                          if (!current || m.id === meId) return;
                          e.preventDefault();
                          onMenu(m.id, e.clientX, e.clientY);
                        }}
                        className="flex items-center gap-2 text-foreground"
                      >
                        <span
                          aria-hidden
                          className={`size-2.5 shrink-0 rounded-full ${
                            talking ? "bg-speaking ring-4 ring-speaking/25" : "bg-border"
                          }`}
                        />
                        {m.nick}
                        {talking ? <span className="sr-only"> (falando)</span> : null}
                        {m.muted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 text-xs font-bold text-destructive">
                            <MicOff className="size-3" aria-hidden /> Mudo
                          </span>
                        ) : null}
                        {m.sharing ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 text-xs font-bold text-destructive">
                            <MonitorUp className="size-3" aria-hidden /> Tela
                          </span>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
