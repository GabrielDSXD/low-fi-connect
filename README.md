# Call simples (nickname + compartilhamento de tela)

Sistema leve para você e seus amigos entrarem numa **única sala**, só informando um
nickname. Cada pessoa pode compartilhar a própria tela e assistir a tela dos outros.
O áudio/vídeo é P2P (WebRTC) — o servidor só faz sinalização.

## Estrutura

- `backend/` — servidor WebSocket de sinalização (Node, sem dependências além de `ws`).
- `frontend/` — o app web (React + TanStack Start) desta pasta: `src/`, `vite.config.ts`, etc.

## Rodando na sua máquina

```bash
# terminal 1 — sinalização
cd backend && npm install && npm start      # ws://localhost:3001

# terminal 2 — interface
npm install && npm run dev                  # http://localhost:8080
```

Para amigos na mesma rede, defina no `.env` do frontend:

```
VITE_SIGNALING_URL=ws://SEU_IP_LOCAL:3001
```

E acesse `http://SEU_IP_LOCAL:8080`.

> Importante: navegadores só permitem microfone e compartilhamento de tela em
> `localhost` ou em **HTTPS**. Para acesso fora do localhost, use um túnel
> (Tailscale, ngrok, Cloudflare Tunnel) ou um proxy HTTPS.
