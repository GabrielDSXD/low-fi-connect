---
name: Lobby
description: Painel de sala de voz ao vivo em grafite escuro, para um grupo de amigos que joga junto.
colors:
  rail: "oklch(0.195 0.012 272)"
  background: "oklch(0.235 0.013 272)"
  card: "oklch(0.265 0.014 272)"
  popover: "oklch(0.29 0.015 272)"
  secondary: "oklch(0.31 0.015 272)"
  border: "oklch(0.34 0.013 272)"
  input: "oklch(0.185 0.012 272)"
  foreground: "oklch(0.95 0.006 272)"
  muted-foreground: "oklch(0.74 0.014 272)"
  primary: "oklch(0.56 0.19 278)"
  primary-foreground: "oklch(0.99 0 0)"
  primary-ink: "oklch(0.8 0.11 278)"
  speaking: "oklch(0.77 0.17 152)"
  live: "oklch(0.58 0.21 25)"
  destructive: "oklch(0.7 0.18 22)"
typography:
  display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: "2.25rem"
    letterSpacing: "-0.025em"
  brand:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: "1.75rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: "1.5rem"
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.375
  body-sm:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: "1rem"
    letterSpacing: "0.025em"
  meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    fontFeature: "tnum"
  badge:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    lineHeight: "1.25rem"
    letterSpacing: "0.025em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  px: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "32px"
  bar: "48px"
  target: "44px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "{spacing.target}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "{spacing.target}"
  button-secondary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  dock-button:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    size: "{spacing.target}"
  dock-button-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    size: "{spacing.target}"
  dock-button-alert:
    textColor: "{colors.destructive}"
    rounded: "{rounded.full}"
    size: "{spacing.target}"
  button-leave:
    backgroundColor: "{colors.live}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "{spacing.target}"
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "{spacing.target}"
  chat-composer:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    height: "{spacing.target}"
  room-row:
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "{spacing.target}"
  room-row-current:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
  participant-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
  live-badge:
    backgroundColor: "{colors.live}"
    textColor: "#ffffff"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Lobby

## Overview

**Creative North Star: "O painel da sala ao vivo"**

O Lobby é um painel que se lê de relance por cima de um jogo em tela cheia: quem está em cada sala, quem está falando, quem está mudo, quem está transmitindo. Tudo acontece num único mundo escuro, porque a cena é noite, quarto com pouca luz e o app numa segunda tela ou no celular. O grafite é quase neutro (matiz 272, croma baixo) e se organiza em degraus de claridade; os painéis se separam por seams de 1px, não por sombra.

A cor é escassa e funcional. Um índigo-violeta marca seleção e ação primária; verde existe só para "falando"; vermelho existe só para AO VIVO, mudo, erros e sair. A cor pessoal de cada amigo vem do avatar, derivada do apelido e mantida longe dos matizes de estado, para que identidade nunca pareça status. A densidade é de ferramenta: barras de 48px, linhas compactas, alvos de toque de 44px.

**Key Characteristics:**
- Só escuro (`color-scheme: dark`), grafite em degraus: rail < background < card < popover.
- Seams de 1px no token `border` dividem trilho, palco, chat e barras.
- Sem sombra de elevação, exceto em popovers; anéis (fala, foco) são o único outro uso de box-shadow.
- Acento índigo só para seleção e ação; verde, vermelho e destrutivo só para estado.
- Figtree 400–800, números tabulares em hora, contagens e porcentagens.
- Avatares redondos com matiz do apelido; o anel verde de fala é o gesto assinatura.

## Colors

Grafite frio quase neutro em cinco degraus, um índigo de ação e três cores de estado que nunca decoram.

### Primary
- **Índigo de Ação** (`primary`): fundo de botão primário ("Entrar"), botão de doca ligado (compartilhando), chip de tela escolhida, hover do "Entrar" nas linhas de sala, trilho do slider. Texto sobre ele usa `primary-foreground`.
- **Tinta Índigo** (`primary-ink`): a versão clara do acento para texto e traço sobre o grafite: ponto da marca, ícone de enviar, borda de campo em foco, anel do compositor do chat, cursor (`caret-color`) e `ring` de foco. Seleção de texto usa o índigo a 45%.

### Secondary (estado)
- **Verde Falando** (`speaking`): exclusivamente o anel de fala em volta do avatar, na lista, no palco e no rodapé de identidade.
- **Vermelho Ao Vivo** (`live`): selo AO VIVO na transmissão e nos tiles, chip preenchido com ícone de tela no trilho, e o botão "Sair". Texto sobre ele é branco puro.
- **Vermelho Destrutivo** (`destructive`): ícone de microfone mudo, botão de microfone desligado (fundo a 15%), mensagens de erro e ícone do aviso de conexão.

### Neutral
- **Grafite Trilho** (`rail`): o degrau mais escuro: trilho de salas, doca de controles, fundo da tela de entrada, rótulos translúcidos sobre vídeo (85%).
- **Grafite Base** (`background`): palco, chat e cartão de entrada.
- **Grafite Cartão** (`card`): tiles de participante, lista de salas vazia, compositor do chat, hover de mensagem (60%), `kbd`.
- **Grafite Popover** (`popover`): menu de volume, seletor de dispositivos, faixa de aviso.
- **Grafite Elevado** (`secondary`, também `muted` e `accent`): sala atual no trilho, botões de doca em repouso, botão secundário, hover de tile.
- **Seam** (`border`): toda divisão de 1px.
- **Poço** (`input`): fundo de campo e select, um degrau abaixo do trilho.
- **Texto** (`foreground`) e **Texto Calado** (`muted-foreground`): conteúdo e metadados; mensagens do chat usam o texto a 90%.

### Named Rules
**The Degraus Rule.** Profundidade é claridade: cada superfície sobe um degrau de grafite (rail 0.195, background 0.235, card 0.265, popover 0.29, secondary 0.31). Não se cria superfície nova fora desses degraus.

**The Estado Não Decora Rule.** Verde, vermelho ao vivo e destrutivo aparecem só quando o estado é verdadeiro. Nenhum deles vira cor de marca, ilustração ou ênfase.

**The Matiz do Apelido Rule.** O avatar pinta `oklch(0.52 0.12 h)` com letra `oklch(0.96 0.03 h)`, e o nome no chat usa `oklch(0.82 0.1 h)`, onde `h` vem do hash do apelido sobre [95, 185, 215, 245, 310, 345]. Esses matizes ficam longe de 25, 152 e 278 (vermelho, verde, índigo); nunca acrescente um matiz que se aproxime deles.

## Typography

**Display Font:** Figtree (com ui-sans-serif, system-ui, sans-serif)
**Body Font:** Figtree

**Character:** Uma única família geométrica e amigável, carregada de 400 a 800; a hierarquia vem do peso (extrabold na marca, bold nos títulos de barra, semibold nos nomes) mais do que do tamanho.

### Hierarchy
- **Display** (800, 1.875rem, tracking -0.025em): só o "Lobby" da tela de entrada.
- **Brand** (800, 1.125rem, tracking -0.025em): a marca no topo do trilho.
- **Title** (700, 1rem): títulos das barras de 48px (nome da sala, "Chat"), nome da sala na lista, botão primário.
- **Body** (400, 0.9375rem, leading 1.375): mensagens do chat e compositor; nomes de sala no trilho em 600.
- **Body-sm** (400/600, 0.875rem): membros aninhados, nomes em tiles (600), contagem "· 2 pessoas", avisos.
- **Label** (700, 0.75rem, tracking 0.025em, maiúsculas): rótulo de grupo de controles e de campo ("Salas de voz", "Seu apelido", "Microfone", "Voz"). Sempre rotula um controle ou uma lista, nunca fica acima de um título.
- **Meta** (400, 0.75rem, tabular): hora das mensagens, subtítulo da identidade, contagens; hora agrupada cai para 0.625rem.
- **Badge** (800, 0.6875rem, tracking 0.025em, maiúsculas): o selo AO VIVO (0.625rem dentro do rótulo sobre o vídeo).

### Named Rules
**The Número Tabular Rule.** `time` e `output` recebem `tabular-nums` na base; contagens de pessoas também. Números que mudam ao vivo não podem dançar.

## Layout

Desktop (a partir de `lg`, 1024px): grade de três colunas em altura total da viewport, `15rem | minmax(0,1fr) | 20rem`: trilho de salas, palco, chat. Uma faixa de aviso opcional ocupa as três colunas no topo. Cada coluna abre com uma barra de 48px (`h-12`) com seam inferior, e o trilho fecha com a identidade (avatar, apelido, sala atual) sobre seam superior.

Celular: uma coluna. Fora de sala, a lista de salas vem primeiro; dentro de uma sala, o palco vem primeiro (mínimo de 75dvh), depois o trilho, depois o chat. A doca de controles fica fixa embaixo, com `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))`, e a página reserva 80px embaixo para ela; no desktop a doca é sticky no fim do palco.

Ritmo: 4px de base. Trilho com 8px de respiro e linhas separadas por 2px; membros recuados 24px; palco e chat com 16px; grade de tiles com 12px de vão (`auto-fit` de 9rem a 16rem sem tela, `auto-fill` de 8.5rem com tela). A tela compartilhada domina o palco (até 62dvh) e os tiles encolhem abaixo dela. Todo alvo interativo tem pelo menos 44px, exceto chips de tela (36px) e o botão de tela cheia sobre o vídeo (36px).

## Elevation & Depth

Plano por padrão. A profundidade vem dos degraus de grafite e dos seams de 1px; superfícies em repouso não têm sombra. A única sombra de elevação é a de camadas flutuantes (menu de volume, seletor de dispositivos). O box-shadow também desenha anéis, que não são elevação: o anel de fala e o anel de foco do compositor.

### Shadow Vocabulary
- **Flutuante** (`box-shadow: 0 8px 24px oklch(0 0 0 / 45%)`): popovers e o menu de volume, sempre junto com borda de 1px e fundo `popover`.
- **Anel de fala** (`box-shadow: 0 0 0 2px var(--speaking-gap), 0 0 0 4px var(--color-speaking)`): utilitário `speaking-ring`; o vão de 2px usa a cor da superfície sob o avatar (rail, card ou background).
- **Anel de foco do compositor** (`box-shadow: 0 0 0 2px var(--color-primary-ink)`): no `focus-within` do compositor do chat.

### Named Rules
**The Seam Não Sombra Rule.** Painéis, barras e cartões se separam por 1px de `border`, nunca por sombra. Se precisa de sombra, é porque flutua.

## Shapes

Cantos suaves e pequenos: 4px em selos e `kbd`, 6px em botões retangulares, campos e linhas do trilho, 8px em cartões, tiles, vídeo, compositor e popovers. Círculo completo para avatares, botões da doca, "Sair" e chips de tela. O ponto da marca é um círculo `primary-ink` de 10–12px. O vídeo é recortado em 8px sobre preto puro (letterbox).

## Components

### Buttons
Botões diretos e sólidos, sem borda; a cor diz a função.
- **Shape:** 6px nos retangulares, círculo nos da doca e em "Sair".
- **Primary:** fundo `primary`, texto `primary-foreground`, bold, 44px de altura, 16px laterais. Hover a 90%; desabilitado a 50%.
- **Secondary ("Entrar" nas linhas):** fundo `secondary`, texto `foreground`, 0.875rem bold; no hover assume o índigo de ação.
- **Sair:** pílula `live` com texto branco, ícone e rótulo, 20px laterais; hover `brightness(1.1)`. Fica isolado à direita por um divisor vertical de 1px × 32px com 8px de margem.
- **Foco:** contorno global de 2px `ring` com 2px de offset.

### Doca de controles
Botões redondos de 44px com ícone de 20px e `aria-label`: repouso em `secondary`; ligado (compartilhando) em `primary`; alerta (microfone desligado) em `destructive` a 15% com ícone `destructive`. Fundo da doca `rail` com seam superior.

### Chips
- **Chip de tela:** pílula de 36px com avatar de 28px à esquerda; escolhido em `primary`, os demais em `secondary` com texto calado.
- **Selo AO VIVO:** retângulo de 4px em `live`, texto branco no estilo Badge. No trilho, o mesmo vermelho vira um quadrado de 20px com ícone de tela.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** `card` sobre `background`; lista de salas vazia com linhas divididas por seams.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** 1px `border` em cartões de lista e avisos; tiles não têm borda, só degrau.
- **Internal Padding:** 16px nas linhas de sala (mínimo 64px de altura); tiles com 40px acima do avatar de 80px (28px e avatar de 48px quando há tela).

### Inputs / Fields
- **Style:** fundo `input`, borda 1px `border`, 6px, 44px de altura (40px nos selects de dispositivo).
- **Focus:** a borda vira `primary-ink`; o compositor do chat, sem borda, ganha anel de 2px `primary-ink`.
- **Error:** texto `destructive` em 0.875rem numa região `role="alert"` com altura reservada.

### Navigation
Trilho de salas: cabeçalho "Salas de voz" no estilo Label, linhas de 44px com ícone de alto-falante, nome em 600 e contagem tabular à direita. Sala atual em `secondary` com texto `foreground`; as outras em texto calado com hover `secondary` a 60%. Membros aninhados em linhas de 32px com avatar de 24px, anel de fala, selo de tela e ícone de mudo à direita.

### Avatar (assinatura)
Círculo com a inicial em bold, cor do matiz do apelido, tamanhos 24/28/32/48/80px. Quando a pessoa fala, ganha o anel verde com transição de 150ms ease-out. Em pilhas sobrepostas, o avatar leva um anel de 2px da cor do cartão.

### Chat
Mensagens agrupadas por autor dentro de 5 minutos: a primeira traz avatar de 32px, nome na cor do apelido (600) e hora; as seguintes mostram só a hora no hover. Hover da linha em `card` a 60%.

### Menu de volume
Popover fixo de 288px: avatar e apelido, sliders por Label com porcentagem tabular, e a nota "Só você ouve essa mudança.". Fundo `popover`, borda 1px, sombra Flutuante.

## Do's and Don'ts

### Do:
- **Do** subir exatamente um degrau de grafite para cada camada nova (rail, background, card, popover, secondary).
- **Do** separar regiões com seams de 1px no token `border`.
- **Do** usar `primary` para preencher ação/seleção e `primary-ink` para texto, traço e foco sobre o grafite.
- **Do** reservar `speaking` para o anel de fala, `live` para AO VIVO e Sair, `destructive` para mudo e erro.
- **Do** derivar a cor pessoal do apelido pelos matizes [95, 185, 215, 245, 310, 345] em `oklch(0.52 0.12 h)`.
- **Do** manter alvos de 44px e a doca fixa embaixo no celular com padding de safe-area.
- **Do** usar números tabulares em hora, contagens e porcentagens.

### Don't:
- **Don't** criar tema claro nem superfícies creme; o mundo é só escuro.
- **Don't** usar sombra em cartões, tiles, barras ou botões; só popovers flutuam.
- **Don't** usar verde, vermelho ou índigo como cor de avatar, decoração ou ênfase.
- **Don't** acumular selos vermelhos; um estado, um sinal.
- **Don't** colocar "Sair" junto dos outros controles da doca sem o divisor.
- **Don't** usar rótulos em maiúsculas acima de títulos; o estilo Label só rotula controles e listas.
