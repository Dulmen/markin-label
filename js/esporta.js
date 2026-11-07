// esporta.js · compone il PDF da stampare: un A4 per foglio, etichette vettoriali.
// Ogni etichetta è la pagina originale ritagliata (pdf-lib, embedPages): codici nitidi
// e file leggero. Se un PDF non si lascia incorporare si ripiega sull'immagine a 288 dpi.
import { A4, SPAZI, adatta, quantiFogli } from './foglio.js';
import { PT_PER_MM, disegnaPagina, ritaglia } from './sorgente.js';

const PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
let caricamento = null;
function pdfLib() {
  if (globalThis.PDFLib) return Promise.resolve(globalThis.PDFLib);
  caricamento ??= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = PDFLIB;
    s.onload = () => ok(globalThis.PDFLib);
    s.onerror = () => { caricamento = null; s.remove(); ko(new Error('pdf-lib non raggiungibile')); };
    document.head.appendChild(s);
  });
  return caricamento;
}
export const precarica = () => pdfLib().catch(() => {});

const pt = (v) => v * PT_PER_MM;

// etichette: [{ foglio, spazio, file, pagina, box, rotPagina, rot, riqN }]; files: Map id → { bytes }
export async function creaPdf(etichette, files) {
  const { PDFDocument, degrees, PrintScaling } = await pdfLib();
  const out = await PDFDocument.create();
  out.setTitle('Etichette Markin');
  out.setCreator('Markin');
  out.setProducer('Markin');
  // stampa al 100%: chi rispetta l'indicazione (Chrome, Acrobat) non rimpicciolisce il foglio
  try { out.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None); } catch { /* facoltativo */ }
  const pagine = [];
  for (let f = 0; f < quantiFogli(etichette); f++) {
    if (etichette.some((e) => e.foglio === f)) pagine[f] = out.addPage([pt(A4.w), pt(A4.h)]);
  }
  const sorgenti = new Map();
  const ordinate = [...etichette].sort((a, b) => a.foglio * 4 + a.spazio - (b.foglio * 4 + b.spazio));
  for (const e of ordinate) {
    const page = pagine[e.foglio];
    const spazio = SPAZI[e.spazio];
    let fatta = false;
    try {
      if (!sorgenti.has(e.file)) {
        const doc = await PDFDocument.load(files.get(e.file).bytes, { ignoreEncryption: true, updateMetadata: false }).catch(() => null);
        sorgenti.set(e.file, doc && !doc.isEncrypted ? doc : null);
      }
      const src = sorgenti.get(e.file);
      if (src) {
        const [l, b, r, t] = e.box;
        const [emb] = await out.embedPages([src.getPage(e.pagina - 1)], [{ left: l, bottom: b, right: r, top: t }]);
        const R = ((((e.rotPagina || 0) + e.rot) % 360) + 360) % 360;
        piazza(page, emb, r - l, t - b, R, spazio, degrees);
        fatta = true;
      }
    } catch (err) {
      console.warn('Markin: etichetta vettoriale non riuscita, uso l\'immagine', err);
    }
    if (!fatta) await piazzaImmagine(out, page, e, files.get(e.file).bytes, spazio);
  }
  return out.save();
}

// Mette l'oggetto (bw × bh punti, da ruotare di R gradi in senso orario) dentro lo spazio.
function piazza(page, oggetto, bw, bh, R, spazio, degrees) {
  const girata = R % 180 !== 0;
  const a = adatta((girata ? bh : bw) / PT_PER_MM, (girata ? bw : bh) / PT_PER_MM, spazio);
  const X = pt(a.x), W = pt(a.w), H = pt(a.h), Y = pt(A4.h - a.y - a.h);
  // pdf-lib ruota in senso antiorario attorno a (x, y): l'angolo del riquadro cambia col giro
  const [x, y] = { 0: [X, Y], 90: [X, Y + H], 180: [X + W, Y + H], 270: [X + W, Y] }[R];
  page.drawPage(oggetto, { x, y, xScale: a.s, yScale: a.s, rotate: degrees(-R) });
}

async function piazzaImmagine(out, page, e, bytes, spazio) {
  const { canvas } = await disegnaPagina(bytes, e.pagina, 2480);
  const riq = { x: e.riqN.x * canvas.width, y: e.riqN.y * canvas.height, w: e.riqN.w * canvas.width, h: e.riqN.h * canvas.height };
  const c = ritaglia(canvas, riq, e.rot);
  const png = await new Promise((ok) => c.toBlob((b) => ok(b), 'image/png'));
  const img = await out.embedPng(new Uint8Array(await png.arrayBuffer()));
  const a = adatta(c.width, c.height, spazio);
  page.drawImage(img, { x: pt(a.x), y: pt(A4.h - a.y - a.h), width: pt(a.w), height: pt(a.h) });
}

// «Markin 20261107 Limoges Jena.pdf»: la data come nei file di Andrea, poi le città.
export function nomeFile(etichette, quando = new Date()) {
  const d = `${quando.getFullYear()}${String(quando.getMonth() + 1).padStart(2, '0')}${String(quando.getDate()).padStart(2, '0')}`;
  const citta = [...new Set(etichette.map((e) => e.citta).filter(Boolean))];
  const coda = citta.slice(0, 3).join(' ') + (citta.length > 3 ? ` +${citta.length - 3}` : '');
  return `Markin ${d}${coda ? ' ' + coda : ''}`.replace(/[\\/:*?"<>|]/g, '').trim() + '.pdf';
}
