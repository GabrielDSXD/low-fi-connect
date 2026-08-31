# Backend — servidor de sinalização

Servidor WebSocket minúsculo que só troca mensagens de sinalização WebRTC entre os
participantes. O áudio e o vídeo (tela) vão direto de um navegador para o outro (P2P).

## Rodar

```bash
cd backend
npm install
npm start          # porta 3001 (ou PORT=xxxx npm start)
```

Health check: http://localhost:3001/health

## Frontend

O frontend fica na pasta `frontend/` (o app web). Aponte-o para este servidor com a
variável `VITE_SIGNALING_URL`, ex.: `ws://192.168.0.10:3001`. Se não definir nada, ele
tenta o host atual na porta 3001.

> Navegadores só liberam microfone/compartilhamento de tela em `localhost` ou HTTPS.
> Para usar na rede local via IP, coloque um proxy HTTPS na frente (ex. Caddy) ou acesse
> pelo túnel do seu preferido (Tailscale/ngrok).
