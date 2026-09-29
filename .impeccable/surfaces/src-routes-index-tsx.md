---
version: 1
slug: "src-routes-index-tsx"
primary_target: "src/routes/index.tsx"
related_targets: ["src/components/RoomList.tsx","src/components/Stage.tsx","src/components/ChatPanel.tsx","src/components/VolumeMenu.tsx"]
---

# Lobby (rota /)

Scope: toda a rota `/` (entrada por apelido, lista de salas, palco da chamada, chat, menu de volume). Modo: Operate.

Cena: amigos à noite, jogo em tela cheia no monitor principal, o Lobby numa segunda tela ou no celular, quarto com pouca luz. Isso força o escuro.

Tarefas: ver quem está em cada sala e quem está falando de relance; entrar/sair; silenciar; compartilhar e assistir tela; conversar por texto; ajustar volume e dispositivos.

Não mexer: comportamento, textos de produto, atalhos (botão direito / Shift+F10), acessibilidade existente.

## Direction contract

THESIS: O Lobby é um painel de sala ao vivo: quem está onde e quem está falando, legível num olhar por cima do jogo. Recusa a grade arejada de cards creme com selos vermelhos gritando.

OWN-WORLD: Grafite em três degraus (trilho de salas mais escuro, palco e chat um passo acima), painéis divididos por seams de 1px, sem sombras exceto em popovers. Um acento índigo-violeta só para seleção/ação primária; verde só para "falando"; vermelho só para AO VIVO, mudo e sair. Figtree com números tabulares. Avatares redondos com matiz derivado do apelido.

STORY: A pessoa vê os amigos e as salas, clica numa sala e já está falando; quando alguém transmite, a tela domina o palco; o chat acompanha ao lado.

FIRST VIEWPORT: Desktop em três colunas: trilho de 15rem (marca, salas de voz com linhas de membros aninhadas, identidade no rodapé), palco (barra com nome da sala e contagem; tela ou grade de avatares; doca de controles centralizada embaixo, "Sair" isolado), chat de 20rem com mensagens agrupadas por autor. Celular: palco primeiro, doca fixa embaixo.

FORM: Direção fixada pelo usuário (B, "Discord refinado"), fundida com o challenger dark-first developer console. Raises: seams de 1px no lugar de sombra (console); acento só para estado (console); ação destrutiva isolada (console). Seed 93463c41.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
