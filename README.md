# Lobby

Quatro salas de voz (**vava, aram, tft, live**) com compartilhamento de tela e chat de texto.
Sem conta: só um apelido. Voz e tela são P2P (WebRTC); presença, chat e sinalização usam os
canais em tempo real do Lovable Cloud, então não há servidor próprio para rodar.

## Rodando na sua máquina

```bash
npm install        # ou bun install
npm run dev
```

> Microfone e compartilhamento de tela só funcionam em `localhost` ou HTTPS. Para acessar por
> IP na rede local, use um túnel (Tailscale, ngrok, Cloudflare Tunnel).

## O que funciona

- Apelido único (2–20 caracteres, sem diferenciar maiúsculas); duplicado gera aviso claro.
- As 4 salas sempre visíveis, com quem está em cada uma, quem está falando, mudo ou compartilhando tela.
- Entrar, sair e trocar de sala; silenciar o microfone; compartilhar/parar a tela.
- Com várias telas na mesma sala, botões "Assistir" escolhem qual ver (só ela é exibida e ouvida);
  botão "Tela cheia" (ou duplo clique no vídeo).
- Botão direito (ou Shift+F10) em alguém abre um pop-up com o volume da voz e da tela, só para você.
- Sons ao entrar e sair da sala (sintetizados, sem arquivos de áudio).
- Chat global em tempo real, visível mesmo fora de uma sala.
- Mensagens amigáveis para permissão negada (microfone/tela), falha de conexão com uma pessoa e
  queda do canal em tempo real (reconecta sozinho).
- Responsivo, navegação por teclado, foco visível, tema claro/escuro automático.

## Como funciona

- `src/hooks/useLobby.ts`: canal `lobby` (presença de todos: apelido, sala, mudo, tela) e chat.
  Apelidos duplicados são resolvidos por ordem de chegada.
- `src/hooks/useCall.ts`: chamada P2P da sala atual (canal `room:<id>` para sinalização e "está falando").
- `src/components/`: `RoomList`, `Stage` (participantes, tela escolhida, tela cheia), `VolumeMenu`, `ChatPanel`.
- `src/lib/rooms.ts`: nomes das salas.

## Limites conhecidos

- Malha P2P: ideal até ~5–6 pessoas por sala.
- Sem servidor TURN: redes muito restritivas podem não conectar.
- Sem histórico: quem entra depois não vê mensagens anteriores do chat.
- Os indicadores de "falando" e as mensagens passam pelo canal em tempo real; muitas pessoas
  falando ao mesmo tempo podem se aproximar dos limites de mensagens por segundo do projeto.
