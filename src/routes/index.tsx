import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLobby } from "@/hooks/useLobby";
import { useCall } from "@/hooks/useCall";
import { RoomList } from "@/components/RoomList";
import { Stage } from "@/components/Stage";
import { ChatPanel } from "@/components/ChatPanel";
import { VolumeMenu, type Volumes } from "@/components/VolumeMenu";
import { ROOMS } from "@/lib/rooms";
import { Avatar } from "@/components/Avatar";
import { CircleAlert, Volume2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lobby" },
      {
        name: "description",
        content:
          "Salas de voz, compartilhamento de tela e chat. Sem conta: escolha um apelido e entre.",
      },
      { property: "og:title", content: "Lobby" },
      {
        property: "og:description",
        content: "Salas de voz, compartilhamento de tela e chat. Sem conta, só um apelido.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

const DEFAULT_VOLUMES: Volumes = { voice: 1, screen: 1 };

function Index() {
  const lobby = useLobby();
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Volumes por apelido, só neste navegador.
  const [vols, setVols] = useState<Record<string, Volumes>>({});
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const notify = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }, []);

  const call = useCall({
    me: lobby.me,
    members: lobby.members,
    reconnecting: lobby.reconnecting,
    update: lobby.update,
    notify,
  });

  const volumesOf = useCallback((nick: string) => vols[nick] ?? DEFAULT_VOLUMES, [vols]);
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = useCallback((id: string, x: number, y: number) => setMenu({ id, x, y }), []);

  // Fecha o menu se a pessoa sair da sala.
  useEffect(() => {
    if (menu && !call.participants.some((p) => p.id === menu.id)) setMenu(null);
  }, [menu, call.participants]);

  // ---- Entrada: só um apelido ----
  if (!lobby.me) {
    return (
      <main className="grid min-h-dvh place-items-center bg-rail px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lobby.claim(input);
          }}
          noValidate
          className="grid w-full max-w-sm gap-2 rounded-lg border border-border bg-background p-6 sm:p-8"
        >
          <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-foreground">
            <span aria-hidden className="size-3 rounded-full bg-primary-ink" />
            Lobby
          </h1>
          <p className="text-sm text-muted-foreground">
            Salas de voz, tela e conversa. Sem conta, só um apelido.
          </p>
          <label
            htmlFor="nick"
            className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            Seu apelido
          </label>
          <input
            id="nick"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={20}
            autoFocus
            autoComplete="off"
            aria-describedby="nick-err"
            className="min-h-11 rounded-md border border-border bg-input px-3 text-foreground outline-none transition-colors focus:border-primary-ink"
          />
          <p id="nick-err" role="alert" className="min-h-6 text-sm text-destructive">
            {lobby.error}
          </p>
          <button
            type="submit"
            disabled={lobby.connecting}
            className="min-h-11 rounded-md bg-primary px-4 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {lobby.connecting ? "Conectando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const me = lobby.me;
  const inRoom = !!call.roomId;
  const roomName = ROOMS.find((r) => r.id === call.roomId)?.name ?? "";
  const tiles = lobby.members
    .filter((m) => m.room === call.roomId)
    .map((m) => ({
      id: m.id,
      nick: m.nick,
      isMe: m.id === me.id,
      muted: m.id === me.id ? !call.micOn : m.muted,
      sharing: m.id === me.id ? call.sharing : m.sharing,
      speaking: call.speaking.has(m.id),
    }));
  const menuPerson = menu ? call.participants.find((p) => p.id === menu.id) : null;
  const banner = lobby.reconnecting ? "Conexão perdida. Reconectando…" : notice;

  // Celular: na sala, o palco vem primeiro; fora dela, a lista de salas.
  return (
    <div
      className={`flex min-h-dvh flex-col bg-background lg:grid ${inRoom ? "pb-20 lg:pb-0" : ""} lg:h-dvh lg:grid-cols-[15rem_minmax(0,1fr)_20rem] lg:grid-rows-[auto_minmax(0,1fr)]`}
    >
      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-border bg-popover px-4 py-2 text-center text-sm font-semibold text-foreground lg:col-span-3 lg:row-start-1"
        >
          <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
          {banner}
        </div>
      ) : null}

      <aside
        aria-label="Lobby"
        className={`flex min-h-0 flex-col border-b border-border bg-rail lg:order-none lg:row-start-2 lg:border-b-0 lg:border-r ${
          inRoom ? "order-2" : "order-1"
        }`}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <span aria-hidden className="size-2.5 rounded-full bg-primary-ink" />
          <strong className="text-lg font-extrabold tracking-tight text-foreground">Lobby</strong>
        </div>
        <div className="flex-1 overflow-y-auto p-2 pt-4">
          <RoomList
            members={lobby.members}
            currentRoom={call.roomId}
            meId={me.id}
            speaking={call.speaking}
            onJoin={(id) => void call.join(id)}
            onMenu={openMenu}
          />
        </div>
        <div className="flex items-center gap-2.5 border-t border-border px-3 py-2.5">
          <Avatar
            nick={me.nick}
            speaking={call.speaking.has(me.id)}
            gap="var(--color-rail)"
            className="size-8 text-sm"
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold text-foreground">{me.nick}</div>
            <div className="truncate text-xs text-muted-foreground">
              {inRoom ? `Na sala ${roomName}` : "Online, fora das salas"}
            </div>
          </div>
        </div>
      </aside>

      <main
        className={`flex min-h-[75dvh] flex-col lg:order-none lg:row-start-2 lg:min-h-0 ${
          inRoom ? "order-1" : "order-2"
        }`}
      >
        {inRoom ? (
          <Stage
            roomName={roomName}
            tiles={tiles}
            participants={call.participants}
            micOn={call.micOn}
            sharing={call.sharing}
            shareAudioOn={call.shareAudioOn}
            volumes={volumesOf}
            micId={call.micId}
            speakerId={call.speakerId}
            onMic={(id) => void call.changeMic(id)}
            onSpeaker={call.changeSpeaker}
            onToggleMic={call.toggleMic}
            onToggleShare={call.toggleShare}
            onLeave={call.leave}
            onMenu={openMenu}
          />
        ) : (
          <section aria-labelledby="pick-room" className="flex flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
              <h2 id="pick-room" className="truncate font-bold text-foreground">
                Escolha uma sala para começar a conversar.
              </h2>
            </header>
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              <p className="mb-4 text-sm text-muted-foreground">
                Você pode ler e escrever no chat mesmo sem entrar em uma sala.
              </p>
              <ul className="max-w-2xl divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {ROOMS.map((room) => {
                  const people = lobby.members.filter((m) => m.room === room.id);
                  return (
                    <li key={room.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                      <Volume2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <div className="font-bold text-foreground">{room.name}</div>
                        <div className="truncate text-sm text-muted-foreground">
                          {people.length
                            ? people.map((m) => m.nick).join(", ")
                            : "Ninguém por aqui"}
                        </div>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-3">
                        {people.length ? (
                          <span aria-hidden className="hidden -space-x-2 sm:flex">
                            {people.slice(0, 5).map((m) => (
                              <Avatar
                                key={m.id}
                                nick={m.nick}
                                className="size-7 text-xs ring-2 ring-card"
                              />
                            ))}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void call.join(room.id)}
                          aria-label={`Entrar na sala ${room.name}`}
                          className="min-h-11 rounded-md bg-secondary px-4 text-sm font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          Entrar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}
      </main>

      <div className="order-3 grid min-h-0 border-t border-border lg:order-none lg:row-start-2 lg:border-l lg:border-t-0">
        <ChatPanel
          messages={lobby.messages}
          onSend={lobby.sendChat}
          onLimit={() => notify("Calma! Você está enviando mensagens rápido demais.")}
        />
      </div>

      {menu && menuPerson ? (
        <VolumeMenu
          nick={menuPerson.nick}
          x={menu.x}
          y={menu.y}
          sharing={menuPerson.sharing}
          volumes={volumesOf(menuPerson.nick)}
          onChange={(patch) =>
            setVols((prev) => ({
              ...prev,
              [menuPerson.nick]: { ...(prev[menuPerson.nick] ?? DEFAULT_VOLUMES), ...patch },
            }))
          }
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}
