# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Um grupo fechado de amigos que se conhece e combina de jogar junto. O link não é divulgado publicamente. Entram tanto pelo PC quanto pelo celular.

## Product Purpose

Lugar único para o grupo conversar por voz enquanto joga, assistir à tela de quem está transmitindo e trocar mensagens de texto. Sucesso é abrir o link, digitar um apelido e estar falando com os amigos em segundos, sem conta, instalação ou configuração.

## Positioning

Sem conta e sem servidor de mídia: só um apelido, e a voz/tela vão direto entre os navegadores (WebRTC P2P). Feito para um grupo pequeno de amigos, não para comunidades grandes.

## Operating Context

- Voz enquanto joga: o app fica aberto em segundo plano, numa aba ou num segundo monitor, enquanto o jogo roda em tela cheia. A pessoa olha rápido para ver quem está falando, quem está mudo e em que sala cada um está.
- Assistir tela/live: alguém compartilha a tela (aba com áudio) e os outros assistem, às vezes em tela cheia.
- Chat de texto global: todos no lobby veem, estando ou não em uma sala.
- Uso em desktop e celular com o mesmo cuidado.

## Capabilities and Constraints

- Salas fixas: `vava`, `aram`, `tft`, `live` (definidas em `src/lib/rooms.ts`).
- Entrada só com apelido (2–20 caracteres, único no lobby). Sem contas, sem histórico: o chat vive só enquanto a página está aberta (últimas 200 mensagens).
- Por sala: silenciar, compartilhar tela (com áudio da aba), sair; volume individual de voz e de tela por pessoa (botão direito / Shift+F10), só para quem ouve.
- Escolha de microfone e de saída de áudio (a saída não existe no Safari).
- Indicador de quem está falando, mudo e compartilhando, tanto na lista de salas quanto no palco.
- Com várias telas compartilhadas, a pessoa escolhe qual assistir.
- Stack: TanStack Start + React 19 + Tailwind v4, Supabase Realtime (presença, broadcast), hospedado via Lovable.
- Chamada em malha P2P: pensado para grupos pequenos.

## Brand Commitments

- Nome exibido: "Lobby". Interface e textos em português (pt-BR), tom informal de amigos ("Diga oi!", "Ninguém por aqui").

## Evidence on Hand

Nenhum logo, ilustração ou imagem de marca no repositório além de `public/favicon.ico`. Não inventar depoimentos, números de usuários ou recursos inexistentes.

## Product Principles

1. Entrar e falar em segundos: nada entre o apelido e a voz.
2. Estado de relance: quem está onde, quem fala, quem está mudo, legível num olhar rápido por cima do jogo.
3. A tela compartilhada é o conteúdo principal quando existe; o resto recua.
4. Controle pessoal sem afetar os outros (volumes, dispositivos).
5. Igualmente bom no PC e no celular.

## Accessibility & Inclusion

Manter o que já existe: rótulos ARIA, regiões `aria-live` para avisos e chat, alvos de toque de 44px, operação por teclado (inclusive Shift+F10 para o menu de volume).
