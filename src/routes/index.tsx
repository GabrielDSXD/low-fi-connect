import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLobby } from "@/hooks/useLobby";
import { useCall } from "@/hooks/useCall";
import { RoomList } from "@/components/RoomList";
import { Stage } from "@/components/Stage";
import { ChatPanel } from "@/components/ChatPanel";
import { VolumeMenu, type Volumes } from "@/components/VolumeMenu";
import { ROOMS } from "@/lib/rooms";

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
      <main className="grid min-h-dvh place-items-center bg-background px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lobby.claim(input);
          }}
          noValidate
          className="grid w-full max-w-sm gap-2 rounded-2xl border border-border bg-card p-6"
        >
          <h1 className="text-3xl font-bold text-primary">Lobby</h1>
          <p className="text-sm text-muted-foreground">
            Salas de voz, tela e conversa. Sem conta, só um apelido.
          </p>
          <label htmlFor="nick" className="mt-2 text-sm font-medium text-foreground">
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
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
          <p id="nick-err" role="alert" className="min-h-6 text-sm text-destructive">
            {lobby.error}
          </p>
          <button
            type="submit"
            disabled={lobby.connecting}
            className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {lobby.connecting ? "Conectando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const me = lobby.me;
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

  return (
    <div className="min-h-dvh bg-background">
      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-40 bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground"
        >
          {banner}
        </div>
      ) : null}

      <header className="flex items-center justify-between px-4 py-3">
        <strong className="text-xl text-primary">Lobby</strong>
        <span className="text-sm text-muted-foreground">
          Você é <b className="text-foreground">{me.nick}</b>
        </span>
      </header>

      <main className="grid gap-4 px-4 pb-4 lg:h-[calc(100dvh-4rem)] lg:grid-cols-[17rem_1fr_20rem] lg:[&>*]:min-h-0 lg:[&>*]:overflow-auto">
        <RoomList
          members={lobby.members}
          currentRoom={call.roomId}
          meId={me.id}
          speaking={call.speaking}
          onJoin={(id) => void call.join(id)}
          onMenu={openMenu}
        />

        {call.roomId ? (
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
          <section className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="font-semibold text-foreground">
              Escolha uma sala para começar a conversar.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você pode ler e escrever no chat mesmo sem entrar em uma sala.
            </p>
          </section>
        )}

        <ChatPanel
          messages={lobby.messages}
          onSend={lobby.sendChat}
          onLimit={() => notify("Calma! Você está enviando mensagens rápido demais.")}
        />
      </main>

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
