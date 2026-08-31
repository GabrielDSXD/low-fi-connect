# Call simples (nickname + compartilhamento de tela)

Sistema leve para você e seus amigos entrarem numa **única sala**, só informando um
nickname. Cada pessoa pode compartilhar a própria tela e assistir a tela dos outros.
O áudio/vídeo é P2P (WebRTC); o servidor só troca mensagens de sinalização.

## Estrutura

- `frontend/` — o app web (React + TanStack Start) desta pasta: `src/`, `vite.config.ts`, etc.
  A sinalização usa os canais em tempo real do Lovable Cloud, então funciona no preview,
  no app publicado e na sua máquina, sem precisar rodar nada extra.
- `backend/` — servidor WebSocket de sinalização opcional, para uso 100% offline/local
  (rede fechada, sem internet). Veja `backend/README.md`.

## Rodando na sua máquina

```bash
npm install
npm run dev        # http://localhost:8080
```

Todos que abrirem a mesma URL (preview, app publicado ou seu localhost) caem na mesma sala.

> Navegadores só liberam microfone e compartilhamento de tela em `localhost` ou HTTPS.
> Para acessar por IP na rede local, use um túnel (Tailscale, ngrok, Cloudflare Tunnel).
