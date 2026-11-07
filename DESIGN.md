---
version: alpha
name: Markin
description: "App personale di Andrea per le etichette Vinted sul foglio Markin A465. Pelle Hemis v2.1 presa dal tracker (finance.hemis.studio): neutri greige ed espresso, un solo accento lilla, tema dal dispositivo. Valori letti da css/app.css (07/11/2026)."
colors:
  primary: "#5E36A6"
  ink: "#241A17"
  ink-2: "#4A3C35"
  ink-3: "#61514A"
  bg: "#E8E2DB"
  bg-elev: "#F1ECE6"
  bg-sunk: "#DAD2CA"
  hair: "#CFC6BD"
  hair-strong: "#B9AEA3"
  accent: "#B27CF0"
  accent-ink: "#5E36A6"
  carta: "#FBF9F6"
  liner: "#ECE7E1"
  ink-dark: "#EDE7E0"
  ink-2-dark: "#C9BFB5"
  ink-3-dark: "#9C8B82"
  bg-dark: "#17110F"
  bg-elev-dark: "#241A17"
  accent-ink-dark: "#C9A6F5"
  carta-dark: "#EDE8E2"
  liner-dark: "#D9D2CA"
typography:
  marchio:
    fontFamily: termina
    fontSize: 15px
    fontWeight: 600
    letterSpacing: 0.08em
  titolo-pannello:
    fontFamily: termina
    fontSize: 13px
    fontWeight: 600
    letterSpacing: 0.1em
  testo:
    fontFamily: system-ui
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  dida:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
  bottone:
    fontFamily: system-ui
    fontSize: 15px
    fontWeight: 500
rounded:
  sm: 4px
  md: 8px
  lg: 20px
spacing:
  margine-desktop: 28px
  margine-telefono: 16px
  bersaglio: 44px
  fra-fogli-desktop: 56px
  fra-fogli-telefono: 20px
components:
  tavolo:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.testo}"
  tavolo-dark:
    backgroundColor: "{colors.bg-dark}"
    textColor: "{colors.ink-dark}"
  testo-secondario:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-3}"
    typography: "{typography.dida}"
  testo-secondario-dark:
    backgroundColor: "{colors.bg-dark}"
    textColor: "{colors.ink-3-dark}"
  marchio:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.marchio}"
  bottone-primario:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    height: "{spacing.bersaglio}"
    typography: "{typography.bottone}"
  bottone-primario-dark:
    backgroundColor: "{colors.ink-dark}"
    textColor: "{colors.bg-dark}"
    rounded: "{rounded.md}"
  barra-vetro:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  barra-vetro-dark:
    backgroundColor: "{colors.bg-elev-dark}"
    textColor: "{colors.ink-dark}"
  annulla:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.bottone}"
  annulla-dark:
    backgroundColor: "{colors.bg-elev-dark}"
    textColor: "{colors.accent-ink-dark}"
  foglio:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  foglio-dark:
    backgroundColor: "{colors.carta-dark}"
    textColor: "{colors.ink}"
  spazio-usato:
    backgroundColor: "{colors.liner}"
    textColor: "{colors.ink}"
  spazio-usato-dark:
    backgroundColor: "{colors.liner-dark}"
    textColor: "{colors.ink}"
  pannello-ritaglio:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    typography: "{typography.titolo-pannello}"
  filetto:
    backgroundColor: "{colors.hair}"
  filetto-forte:
    backgroundColor: "{colors.hair-strong}"
  filo-taglio:
    backgroundColor: "{colors.accent}"
  fondo-incassato:
    backgroundColor: "{colors.bg-sunk}"
    textColor: "{colors.ink-2}"
  testo-dark-2:
    backgroundColor: "{colors.bg-dark}"
    textColor: "{colors.ink-2-dark}"
  margini:
    padding: "{spacing.margine-desktop}"
  margini-telefono:
    padding: "{spacing.margine-telefono}"
  fila-fogli:
    padding: "{spacing.fra-fogli-desktop}"
  fila-fogli-telefono:
    padding: "{spacing.fra-fogli-telefono}"
---

# Markin: DESIGN

> **Aggiornato:** 2026-11-07. Valori letti da `css/app.css`. La pelle è quella del tracker (`ARCHITETTURA.md` del tracker, §5-ter): qui solo ciò che serve a Markin.

## Overview

Il foglio Markin vero, appoggiato sul tavolo sotto la luce della finestra (direzione «Banco», scelta da Andrea il 07/11/2026). Le etichette sono adesivi: si posano da sole, si spostano col dito, gli spazi usati si staccano. Minimalismo caldo Hemis: greige ed espresso, un solo accento lilla usato come filo del taglio e come segno di precisione. Niente grana, vignette o scritte sopra la scena; tutto a schermo pieno, comandi di vetro che galleggiano.

## Colors

- **Neutri**: `bg` è il tavolo, `bg-elev` il vetro e il pannello, `ink` l'inchiostro. In scuro si scambiano (`bg-dark` #17110F, `ink-dark` #EDE7E0).
- **La carta resta carta**: `carta` #FBF9F6 anche col tema scuro diventa solo `carta-dark` #EDE8E2, perché è l'oggetto fisico. Le etichette ci stanno sopra in `multiply`, così il loro bianco prende il colore della carta. `liner` è la carta di supporto che si vede dove l'adesivo è stato staccato.
- **Lilla, due ruoli**: `accent` #B27CF0 per il filo del taglio, il bordo dello spazio d'arrivo, le maniglie del ritaglio (mai testo); `accent-ink` #5E36A6 per l'unico testo colorato, «Annulla» negli avvisi (in scuro #C9A6F5).
- **Contrasti**: inchiostro sul tavolo 13.2:1; `ink-3` sul tavolo 5.9:1; lilla scritto sul vetro sopra 6:1. Il bottone primario è inchiostro pieno con testo greige.

## Typography

Termina (kit Adobe `wle2ags`) solo su «MARKIN» e sul titolo del pannello «RITAGLIA», maiuscolo con spaziatura larga. Tutto il resto nel font di sistema, cifre tabellari. Corpo 15px, didascalie 13px, avvisi 14px. Una riga per cosa: corriere e città («InPost · Limoges»), mai frasi che spiegano come funziona.

## Layout

Il foglio è alto `min(76vh, 780px)` sul computer e quanto la larghezza meno 32px sul telefono (sotto i 700px). Più fogli stanno in fila orizzontale con lo scorrimento a scatto, il foglio corrente al centro e i vicini che si intravedono. Testata con il marchio a sinistra e il pager «Foglio X di N» con le frecce sempre presenti; barra di vetro in basso al centro, a tutta larghezza sul telefono.

## Elevation & Depth

La profondità viene dalla luce. Il foglio proietta un'ombra netta (sole) più una morbida (ambiente) che si spostano col puntatore, e la luce della finestra cade sul tavolo in quattro riquadri chiari. L'etichetta in volo o presa col dito si solleva con un'ombra lunga e torna posata quando atterra. Vetro solo su barra, chip e avvisi; il pannello del ritaglio è carta opaca che sale dal basso.

## Shapes

Tre raggi come il tracker: 4px (foglio, etichetta in volo), 8px (bottoni, chip), 20px (angoli alti del pannello). Gli adesivi hanno gli angoli a 1,2 mm della fustella e un filetto sottilissimo.

## Components

- **Adesivo**: spazio 99 × 139 mm in percentuale sul foglio; l'etichetta dentro con 1,5 mm d'aria, `object-fit: contain`.
- **Spazio usato**: carta di supporto, ombra interna sul bordo in alto a sinistra e un riflesso diagonale.
- **Chip**: vetro sopra l'etichetta scelta con corriere · città e tre bottoni da 32px (capovolgi, ritaglia, togli).
- **Barra**: Aggiungi PDF, Svuota, Foglio nuovo, Ristampa, Scarica, Stampa (primario con il numero di etichette). Sul telefono «Altro» raccoglie le azioni secondarie.
- **Avviso**: vetro sopra la barra, una riga, «Annulla» in lilla quando l'azione si può disfare.
- **Pannello Ritaglia**: pagina intera, riquadro col filo lilla e otto maniglie da 44px, fuori dal riquadro un velo scuro; anteprima dell'etichetta in alto a destra.

## Do's and Don'ts

- Do: un solo accento per schermata; il lilla è il filo, non una campitura.
- Do: annullare invece di chiedere conferma; ogni azione che toglie qualcosa ha «Annulla».
- Do: bersagli da 44px sul telefono, frecce del pager sempre presenti.
- Don't: grana, vignetta, numeri o scritte sopra la scena, il foglio chiuso in un riquadro.
- Don't: bianco puro o nero puro nell'interfaccia (le etichette restano come sono).
- Don't: frasi che spiegano l'app; il nome e il dato bastano.
