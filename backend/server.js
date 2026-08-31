import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 3001);

/** Uma única sala fixa: todos entram na mesma call. */
const peers = new Map(); // id -> { socket, nick }

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, peers: peers.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast(payload, exceptId) {
  for (const [id, peer] of peers) {
    if (id === exceptId) continue;
    send(peer.socket, payload);
  }
}

wss.on("connection", (socket) => {
  const id = randomUUID();
  let joined = false;

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      if (joined) return;
      const nick = String(msg.nick || "").trim().slice(0, 24) || "anônimo";
      joined = true;
      const others = [...peers.entries()].map(([pid, p]) => ({ id: pid, nick: p.nick }));
      peers.set(id, { socket, nick });
      send(socket, { type: "welcome", id, peers: others });
      broadcast({ type: "peer-joined", peer: { id, nick } }, id);
      console.log(`[join] ${nick} (${id}) — ${peers.size} na call`);
      return;
    }

    if (msg.type === "signal" && joined) {
      const target = peers.get(msg.to);
      if (target) send(target.socket, { type: "signal", from: id, data: msg.data });
      return;
    }

    if (msg.type === "ping") send(socket, { type: "pong" });
  });

  socket.on("close", () => {
    if (peers.delete(id)) {
      broadcast({ type: "peer-left", id });
      console.log(`[left] ${id} — ${peers.size} na call`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de sinalização ouvindo em ws://localhost:${PORT}`);
});
