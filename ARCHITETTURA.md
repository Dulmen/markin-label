# Markin: com'è fatta

> **Aggiornato:** 2026-11-07 · versione 2.0.0

Markin trasforma i PDF delle etichette scaricati da Vinted nel foglio da stampare sulle etichette adesive **Markin A465**: A4 con quattro adesivi da 99 × 139 mm. È un'app personale di Andrea.

- **Online**: https://dulmen.github.io/markin-label/ (GitHub Pages dal ramo `main`, cartella radice). Si installa sul telefono con «Aggiungi alla schermata Home».
- **Repo**: `Dulmen/markin-label` (pubblico), sul Mac in `~/dev/markin-label`.
- **Versione di prima**: `ARCHIVIO/v1/`, ancora apribile su `/ARCHIVIO/v1/`.

## Come si usa

| Gesto | Cosa succede |
|---|---|
| Aggiungi PDF, oppure trascinare i file sulla finestra | ogni pagina diventa un'etichetta: si ritaglia da sola, si raddrizza e vola nel primo spazio libero (A, B, C, D, poi un foglio nuovo) |
| Tocco su uno spazio vuoto | l'adesivo si stacca: lo spazio è già usato e viene saltato; un altro tocco lo rimette |
| Tocco su un'etichetta | chip con corriere e città, capovolgi (180°), ritaglia, togli |
| Trascinare un'etichetta (sul telefono dopo una pressione lunga) | su uno spazio libero si sposta, su uno occupato si scambiano, fuori dal foglio si toglie |
| Ritaglia | pagina intera con il riquadro e otto maniglie; Automatico, Pagina intera, Ruota di 90°, Fatto |
| Stampa | computer: dialogo di stampa (Chrome) o il PDF in una scheda (Safari); telefono: foglio di condivisione con Stampa e Salva su File |
| Scarica | il PDF, nominato `Markin AAAAMMGG città.pdf` |
| Foglio nuovo | rimette tutti gli adesivi (si è cambiato foglio nella stampante) |
| Svuota, Ristampa | tolgono tutte le etichette; ristampano l'ultimo PDF |
| Tastiera | ⌘O aggiungi, ⌘P stampa, ⌘S scarica, ⌘Z annulla, ← → fogli, Backspace toglie l'etichetta scelta, Esc |

Dopo Stampa o Scarica le etichette si staccano dal foglio e restano segnati come usati gli spazi dell'ultimo foglio stampato: alla volta dopo l'app sa già quali adesivi sono rimasti. Ogni azione che toglie qualcosa ha «Annulla» nell'avviso. Annulla e ⌘Z disfano sempre e solo l'ultima azione (anche spostamenti e spazi staccati); quando arrivano PDF nuovi gli annulla di prima si chiudono, così non si perde mai lavoro fatto dopo.

## File

| File | Cosa contiene |
|---|---|
| `index.html` | la pagina: testata col pager, fogli, barra, avviso, pannello Ritaglia |
| `css/app.css` | pelle Hemis v2.1 (token del tracker), luce, fogli, adesivi, animazioni CSS |
| `js/app.js` | interfaccia: stato, disegno, volo delle etichette, trascinamenti, ritaglio, stampa, annulla, memoria |
| `js/foglio.js` | geometria del foglio (`SPAZI`), primo spazio libero, compattazione, spazi usati dopo la stampa |
| `js/sorgente.js` | pdf.js 3.11.174: pagina a 180 dpi, rilevamento, testo, anteprima ritagliata |
| `js/rileva.js` | trovare l'etichetta nella pagina, il verso del testo, corriere e città |
| `js/esporta.js` | il PDF finale con pdf-lib 1.17.1 |
| `js/archivio.js` | IndexedDB (`markin`: `file`, `etichette`, `stato`) |
| `sw.js`, `manifest.json` | app installabile e senza rete |
| `icons/` | icona «Taglio» (scelta da Andrea il 07/11/2026 fra tre direzioni, nella famiglia di Cucitura e Vetro): il filo «taglia qui» attorno all'etichetta che si ferma nel punto lilla. Sorgente `icon.svg`; le PNG (180, 192, 512, 1024, mascherabile, favicon) si rifanno con `~/dev/_tools/markin-prove/icona/applica.mjs` |
| `DESIGN.md`, `.impeccable/config.json` | sistema visivo in formato Google (lint pulito) ed eccezione del rilevatore sul greige |

## Come trova l'etichetta

1. **Inchiostro**: la pagina, ridotta a 3 pixel per mm, diventa una griglia di celle da 1 mm con la quantità d'inchiostro.
2. **Pezzi**: le celle piene si dilatano di 2 mm, così i pezzi a meno di 4 mm diventano uno. Vince il pezzo con più inchiostro: codici a barre e QR pesano più delle istruzioni.
3. **Pezzi vicini**: si aggiungono quelli entro 6 mm che pesano almeno il 4%; le linee di taglio sottili e lunghe no.
4. **Rifilo e cornice**: si toglie il bianco ai bordi. Se l'etichetta ha una cornice si taglia sulla cornice, così forbici e tratteggio («taglia qui») restano fuori. Poi 1 mm d'aria.
5. **Verso**: si contano i caratteri del testo per direzione (pdf.js). Un'etichetta orizzontale gira di 90° nel verso che rende dritto il testo più lungo; una capovolta gira di 180°. Senza testo si gira in senso orario come la v1.
6. **Corriere e città**: dal testo della pagina (InPost, Mondial Relay, DPD, BRT, GLS, UPS, DHL, Poste, Packeta e altri). La città è quella del CAP dopo «Destinatario», «Receiver» o «Delivery Address». Si scarta il mittente, che nelle etichette internazionali ha il CAP col prefisso del paese («IT-…»); i CAP olandesi e portoghesi sono gestiti, per BRT si prende la riga prima di «MC.».

Collaudo sui 19 PDF veri di Andrea (InPost internazionale con le istruzioni sopra, InPost Italia A6, BRT, DPD): 19 riquadri giusti, 19 versi giusti, città riconosciuta su 18 (l'altro è un PDF fatto solo d'immagine).

## Il PDF da stampare

- Un A4 per foglio, nessuna pagina vuota. Spazi come nella v1: margine 6 mm a sinistra, 7 mm in alto, 5 mm fra le file (`SPAZI` in `js/foglio.js`).
- Ogni etichetta è la **pagina originale ritagliata e incorporata come vettore** (`embedPages` di pdf-lib): codici nitidi a qualunque risoluzione, file leggeri (5 etichette su due fogli: 79 KB). La rotazione tiene conto della rotazione della pagina d'origine.
- L'etichetta sta dentro l'adesivo con 1,5 mm d'aria e **le proporzioni giuste** (la v1 la stirava fino a riempire lo spazio).
- Il PDF dice di stampare al 100% (`PrintScaling None`): Chrome lo rispetta. Da Anteprima o Safari conviene scegliere «Dimensioni reali».
- Se un PDF non si lascia incorporare (cifrato o rotto) quell'etichetta si stampa come immagine a 288 dpi.
- Il PDF si prepara da solo 0,7 secondi dopo ogni modifica: sul telefono la condivisione parte subito al tocco, come Safari richiede.

## Fogli, spazi usati, memoria

- Un posto è `foglio × 4 + spazio`; gli spazi già usati sono un insieme di posti. Le etichette nuove vanno nel primo posto né usato né occupato.
- Un foglio vuoto prima dell'ultimo non resta: le etichette scorrono avanti (`compatta`).
- Dopo la stampa la stampante contiene l'ultimo foglio stampato: i suoi spazi usati più quelli appena stampati diventano il foglio da cui si riparte. Se è pieno, si riparte da un foglio nuovo.
- In IndexedDB stanno i PDF, le etichette (con l'anteprima), gli spazi usati e l'ultimo PDF stampato: riaprendo l'app (anche dopo che iOS l'ha chiusa) si ritrova tutto. I PDF che nessuna etichetta usa più si buttano all'avvio.

## Movimento

Curve e durate del tracker (molla `linear()` con sovraccarico massimo 1,1%). Mosse: la pagina entra (340 ms), il filo lilla taglia (440 ms), l'etichetta vola nel suo spazio girando dal verso della pagina a quello dell'adesivo (640 ms, le successive partono a metà volo), l'adesivo si stacca o torna giù (460 e 420 ms), le etichette scivolano quando si scambiano (520 ms), dopo la stampa si staccano una a una. Le ombre e la luce della finestra seguono il puntatore. Come nel tracker la preferenza «riduci movimento» del sistema non spegne niente, di proposito.

## Senza rete e aggiornamenti

`sw.js` mette in cache pagina, codice, icone, pdf.js e pdf-lib. La pagina arriva dalla rete quando c'è, il resto dalla cache. **A ogni modifica si cambia `VERSIONE` in `sw.js` e il `?v=` di css e app.js in `index.html` e in `sw.js`**: il service worker nuovo si installa, cancella le cache vecchie (anche `markin-v1` della prima versione) e ricarica una volta le finestre aperte, così si vede subito la versione nuova. Sul server locale il service worker non si registra (solo su https o con `?sw` nell'indirizzo).

## Collaudo

Il banco di prova sta **fuori dal repo**, perché usa i PDF veri con indirizzi di terzi: `~/dev/_tools/markin-prove/` sul Mac (`pdf/` con 19 PDF, Playwright installato lì).

| Script | Cosa prova |
|---|---|
| `rileva.html` | rilevamento, verso, corriere e città sui 19 PDF |
| `fumo.mjs` | carica tre PDF e aspetta che si posino |
| `stampa.mjs` | cinque etichette su due fogli, click vero su Scarica, PDF ridisegnato con le fustelle (`vedi.html`) |
| `interazioni.mjs` | mouse vero: scambio, togli e annulla, stacca e riattacca, chip, capovolgi, ⌘Z, ritaglio con la maniglia |
| `tocco.mjs` | telefono: tocchi, pressione lunga e trascina, strisciata fra i fogli (Chrome con eventi touch veri), WebKit formato iPhone, Stampa con la condivisione |
| `cala.mjs` | PDF trascinati sulla finestra (evento drop vero), Esc durante una presa |
| `stampa-desk.mjs --vero` | Stampa dal computer in un Chrome con finestra (in headless il dialogo di stampa manda in crash la pagina) e memoria dopo un ricaricamento |
| `sw-prova.mjs` | aggiornamento da chi ha la v1 installata, poi apertura senza rete |
| `review/` | la revisione indipendente del 07/11 (t1-t14): doppi click, annulla, ritaglio, fogli, WebKit, finestra stretta |
| `video.mjs` | i video dimostrativi in `video/` |

Server locali: configurazioni `markin-label` (porta 8693) e `markin-prove` (8694) in `.claude/launch.json` del vault.

Non provato: la stampa vera sulla stampante di Andrea e il foglio di condivisione su un iPhone vero.

La revisione indipendente del 07/11, fatta con click e tocchi veri, aveva trovato nove difetti, tutti chiusi e riverificati coi suoi script. Il più grave: ⌘Z subito dopo Stampa cancellava le etichette. Gli altri: annulla che buttava lavoro fatto dopo, doppi click su Capovolgi, Stampa e Ritaglia, ritaglio rotto da un click accanto alla pagina, foglio vuoto in mezzo dopo un trascinamento, Invio dopo Ruota.

## Limiti noti

- Un PDF fatto solo d'immagine non ha testo: niente corriere né città (l'etichetta si chiama «Pagina 1») e il verso segue la forma.
- La stampa dal telefono passa da AirPrint, che può adattare la pagina ai margini della stampante come faceva già con la v1.
- Le misure del foglio sono quelle della v1: se un giorno le etichette uscissero spostate, si correggono in `SPAZI`.
- Stampa manda sempre tutti i fogli. Per rimandare un'etichetta la si toglie e quando serve si ricarica il suo PDF.
- Sull'iPhone l'icona resta quella del giorno in cui l'app è stata aggiunta alla schermata Home: per vedere quella nuova si toglie e si aggiunge di nuovo.

## Pubblicare una modifica

1. Cambiare `VERSIONE` in `sw.js` e i `?v=` (vedi sopra).
2. Provare con gli script del banco di prova.
3. Commit e push su `main`: GitHub Pages pubblica in un minuto circa.

## Storia

- **v1** (marzo 2026): carica PDF, ritaglio a mano pagina per pagina, rifilo del bianco, rotazione in verticale, spazi A-D con scelta da un menu, doppio tocco per lo spazio già usato, un foglio solo, PDF raster a 300 dpi con l'etichetta stirata. In `ARCHIVIO/v1/`.
- **v2** (7 novembre 2026): rifatta nella direzione «Banco» scelta da Andrea fra tre proposte. Rilevamento automatico, verso del testo, corriere e città, trascinamenti, più fogli, spazi usati ricordati fra una stampa e l'altra, PDF vettoriale con le proporzioni giuste, annulla, memoria, stampa e condivisione dal telefono, icona «Taglio».
