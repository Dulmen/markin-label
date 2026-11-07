// sorgente.js · apre i PDF con pdf.js: ogni pagina diventa un'etichetta candidata.
import { rilevaRiquadro, versiTesto, rotazioneConsigliata, riconosciCorriere, riconosciCitta } from './rileva.js';

const PDFJS = '3.11.174';
export const PT_PER_MM = 72 / 25.4;
const SCALA = 2.5; // 180 dpi: rilevamento e anteprima

let pronto = false;
export function pdfjs() {
  const lib = globalThis.pdfjsLib;
  if (!lib) throw new Error('pdf.js non caricato');
  if (!pronto) {
    lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS}/pdf.worker.min.js`;
    pronto = true;
  }
  return lib;
}

const apriDoc = (bytes) => pdfjs().getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;

// bytes: Uint8Array del file. Torna una voce per pagina.
export async function leggiPdf(bytes, { onPagina } = {}) {
  const doc = await apriDoc(bytes);
  const pagine = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await analizzaPagina(doc, n);
      pagine.push(pagina);
      await onPagina?.(pagina, n, doc.numPages);
    }
  } finally {
    doc.destroy();
  }
  return pagine;
}

async function disegna(page, scala) {
  const vp = page.getViewport({ scale: scala });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { canvas, vp };
}

async function analizzaPagina(doc, n) {
  const page = await doc.getPage(n);
  const { canvas, vp } = await disegna(page, SCALA);
  const pxPerMm = SCALA * PT_PER_MM;
  let items = [];
  try { items = (await page.getTextContent()).items; } catch { /* pagina solo immagine */ }
  const riq = rilevaRiquadro(canvas, pxPerMm);
  const rot = rotazioneConsigliata(riq, versiTesto(items, vp, riq));
  const testo = items.map((i) => i.str).join(' ');
  const out = {
    numero: n,
    canvas,
    riqN: { x: riq.x / canvas.width, y: riq.y / canvas.height, w: riq.w / canvas.width, h: riq.h / canvas.height },
    box: boxDaRiq(vp, riq),
    rotPagina: page.rotate || 0,
    rot,
    corriere: riconosciCorriere(testo),
    citta: riconosciCitta(items),
    vuota: !!riq.vuota,
    anteprima: ritaglia(canvas, riq, rot),
  };
  page.cleanup();
  return out;
}

// La pagina intera per il ritaglio a mano, larga circa `larghezza` pixel.
export async function disegnaPagina(bytes, numero, larghezza) {
  const doc = await apriDoc(bytes);
  try {
    const page = await doc.getPage(numero);
    const base = page.getViewport({ scale: 1 });
    const { canvas, vp } = await disegna(page, Math.min(4, larghezza / base.width));
    page.cleanup();
    return { canvas, vp };
  } finally {
    doc.destroy();
  }
}

// Dal riquadro in pixel del canvas al riquadro nello spazio della pagina PDF: [sinistra, basso, destra, alto].
export function boxDaRiq(vp, r) {
  const a = vp.convertToPdfPoint(r.x, r.y), b = vp.convertToPdfPoint(r.x + r.w, r.y + r.h);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

// Ritaglia il riquadro e lo ruota (gradi in senso orario). Torna un canvas nuovo.
export function ritaglia(canvas, riq, rot = 0) {
  const w = Math.max(1, Math.round(riq.w)), h = Math.max(1, Math.round(riq.h));
  const giro = ((rot % 360) + 360) % 360;
  const scambia = giro === 90 || giro === 270;
  const out = document.createElement('canvas');
  out.width = scambia ? h : w;
  out.height = scambia ? w : h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((giro * Math.PI) / 180);
  ctx.drawImage(canvas, Math.round(riq.x), Math.round(riq.y), w, h, -w / 2, -h / 2, w, h);
  return out;
}
