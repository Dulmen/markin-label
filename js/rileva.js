// rileva.js · trova l'etichetta dentro la pagina, il verso del testo e il corriere.
// Lavora su un canvas già renderizzato (pdf.js) e sul testo della pagina.

const SOGLIA_INCHIOSTRO = 225; // sotto questo valore un pixel conta come inchiostro
const SOGLIA_BIANCO = 250;     // rifilo fine dei margini, come la v1 («Normale»)
const RAGGIO_MM = 2;           // pezzi a meno di 4 mm l'uno dall'altro sono la stessa cosa
const VICINO_MM = 6;           // un pezzo staccato ma vicino si aggiunge se pesa abbastanza
const PESO_MINIMO = 0.04;      // ... almeno il 4% dell'inchiostro già preso
const FILO_MM = 1.2;           // linee di taglio: più sottili di così e lunghe, si lasciano fuori

// Riquadro dell'etichetta in pixel del canvas: {x, y, w, h}.
export function rilevaRiquadro(canvas, pxPerMm) {
  const scala = Math.min(1, 3 / pxPerMm);
  const w = Math.max(1, Math.round(canvas.width * scala));
  const h = Math.max(1, Math.round(canvas.height * scala));
  const piccolo = document.createElement('canvas');
  piccolo.width = w; piccolo.height = h;
  const ctx = piccolo.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  const pxmm = pxPerMm * scala;
  const cella = Math.max(1, Math.round(pxmm));
  const gw = Math.ceil(w / cella), gh = Math.ceil(h / cella);
  const inchiostro = new Float32Array(gw * gh);
  for (let y = 0; y < h; y++) {
    const riga = ((y / cella) | 0) * gw;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = Math.min(d[i], d[i + 1], d[i + 2]);
      if (v < SOGLIA_INCHIOSTRO) inchiostro[riga + ((x / cella) | 0)] += (255 - v) / 255;
    }
  }

  const pieno = new Uint8Array(gw * gh);
  for (let i = 0; i < pieno.length; i++) pieno[i] = inchiostro[i] > 0.15 ? 1 : 0;
  const r = Math.max(1, Math.round(RAGGIO_MM * pxmm / cella));
  const dil = dilata(dilata(pieno, gw, gh, r, true), gw, gh, r, false);

  // componenti connesse sulla maschera dilatata, misurate sulle celle piene
  const visto = new Uint8Array(gw * gh);
  const pezzi = [];
  const pila = [];
  for (let i = 0; i < dil.length; i++) {
    if (!dil[i] || visto[i]) continue;
    const c = { massa: 0, x0: gw, y0: gh, x1: -1, y1: -1 };
    visto[i] = 1; pila.push(i);
    while (pila.length) {
      const k = pila.pop();
      const x = k % gw, y = (k / gw) | 0;
      if (pieno[k]) {
        c.massa += inchiostro[k];
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
        if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      }
      if (x > 0 && dil[k - 1] && !visto[k - 1]) { visto[k - 1] = 1; pila.push(k - 1); }
      if (x < gw - 1 && dil[k + 1] && !visto[k + 1]) { visto[k + 1] = 1; pila.push(k + 1); }
      if (y > 0 && dil[k - gw] && !visto[k - gw]) { visto[k - gw] = 1; pila.push(k - gw); }
      if (y < gh - 1 && dil[k + gw] && !visto[k + gw]) { visto[k + gw] = 1; pila.push(k + gw); }
    }
    if (c.x1 >= 0) pezzi.push(c);
  }
  if (!pezzi.length) return { x: 0, y: 0, w: canvas.width, h: canvas.height, vuota: true };

  // il pezzo più carico è l'etichetta (codici a barre e QR pesano più delle istruzioni);
  // poi si aggiungono i pezzi vicini che pesano, mai le linee di taglio
  pezzi.sort((a, b) => b.massa - a.massa);
  const migliore = { ...pezzi[0] };
  const mmCella = cella / pxmm;
  const filo = (c) => {
    const w = (c.x1 - c.x0 + 1) * mmCella, h = (c.y1 - c.y0 + 1) * mmCella;
    return (h <= FILO_MM && w > 25) || (w <= FILO_MM && h > 25);
  };
  const resto = pezzi.slice(1).filter((c) => !filo(c));
  for (let cambiato = true; cambiato;) {
    cambiato = false;
    for (let j = resto.length - 1; j >= 0; j--) {
      const c = resto[j];
      const dx = Math.max(0, c.x0 - migliore.x1 - 1, migliore.x0 - c.x1 - 1) * mmCella;
      const dy = Math.max(0, c.y0 - migliore.y1 - 1, migliore.y0 - c.y1 - 1) * mmCella;
      if (Math.hypot(dx, dy) <= VICINO_MM && c.massa >= PESO_MINIMO * migliore.massa) {
        migliore.x0 = Math.min(migliore.x0, c.x0); migliore.y0 = Math.min(migliore.y0, c.y0);
        migliore.x1 = Math.max(migliore.x1, c.x1); migliore.y1 = Math.max(migliore.y1, c.y1);
        migliore.massa += c.massa;
        resto.splice(j, 1);
        cambiato = true;
      }
    }
  }

  // dalla griglia ai pixel del canvas, con 2 mm di margine per il rifilo fine
  const k = cella / scala, m = 2 * pxPerMm;
  const grezzo = {
    x: Math.max(0, migliore.x0 * k - m),
    y: Math.max(0, migliore.y0 * k - m),
    x2: Math.min(canvas.width, (migliore.x1 + 1) * k + m),
    y2: Math.min(canvas.height, (migliore.y1 + 1) * k + m),
  };
  return rifila(canvas, grezzo, pxPerMm);
}

// Toglie il bianco ai bordi dentro il riquadro e lascia 1 mm d'aria.
export function rifila(canvas, z, pxPerMm, soglia = SOGLIA_BIANCO) {
  const x0 = Math.floor(z.x), y0 = Math.floor(z.y);
  const w = Math.max(1, Math.ceil(z.x2 - z.x)), h = Math.max(1, Math.ceil(z.y2 - z.y));
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, h).data;
  const scuro = (x, y) => {
    const i = (y * w + x) * 4;
    return d[i] < soglia || d[i + 1] < soglia || d[i + 2] < soglia;
  };
  const rigaPiena = (y) => { for (let x = 0; x < w; x++) if (scuro(x, y)) return true; return false; };
  const colPiena = (x) => { for (let y = 0; y < h; y++) if (scuro(x, y)) return true; return false; };
  let t = 0, b = h - 1, l = 0, r = w - 1;
  while (t < h && !rigaPiena(t)) t++;
  if (t >= h) return { x: x0, y: y0, w, h, vuota: true };
  while (b > t && !rigaPiena(b)) b--;
  while (l < w && !colPiena(l)) l++;
  while (r > l && !colPiena(r)) r--;

  // Se l'etichetta ha una cornice, si taglia sulla cornice: fuori restano solo
  // forbici e tratteggi («taglia qui»), che pesano poco.
  const conta = (x1, y1, x2, y2) => { let n = 0; for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (scuro(x, y)) n++; return n; };
  const riga = (y) => conta(l, y, r, y), col = (x) => conta(x, t, x, b);
  const totale = Math.max(1, conta(l, t, r, b));
  const W = r - l + 1, H = b - t + 1;
  for (let y = t; y <= t + H * 0.3; y++) {
    if (riga(y) >= 0.85 * W) { if (y > t && conta(l, t, r, y - 1) <= 0.05 * totale) t = y; break; }
  }
  for (let y = b; y >= b - H * 0.3; y--) {
    if (riga(y) >= 0.85 * W) { if (y < b && conta(l, y + 1, r, b) <= 0.05 * totale) b = y; break; }
  }
  while (l < r && !conta(l, t, l, b)) l++;
  while (r > l && !conta(r, t, r, b)) r--;
  const W2 = r - l + 1, H2 = b - t + 1;
  for (let x = l; x <= l + W2 * 0.3; x++) {
    if (col(x) >= 0.85 * H2) { if (x > l && conta(l, t, x - 1, b) <= 0.05 * totale) l = x; break; }
  }
  for (let x = r; x >= r - W2 * 0.3; x--) {
    if (col(x) >= 0.85 * H2) { if (x < r && conta(x + 1, t, r, b) <= 0.05 * totale) r = x; break; }
  }
  while (t < b && !conta(l, t, r, t)) t++;
  while (b > t && !conta(l, b, r, b)) b--;

  const pad = Math.round(pxPerMm);
  const X = Math.max(0, x0 + l - pad), Y = Math.max(0, y0 + t - pad);
  const X2 = Math.min(canvas.width, x0 + r + 1 + pad), Y2 = Math.min(canvas.height, y0 + b + 1 + pad);
  return { x: X, y: Y, w: X2 - X, h: Y2 - Y };
}

function dilata(src, gw, gh, r, orizzontale) {
  const out = new Uint8Array(src.length);
  if (orizzontale) {
    for (let y = 0; y < gh; y++) {
      let ultimo = -1e9;
      for (let x = 0; x < gw; x++) { if (src[y * gw + x]) ultimo = x; if (x - ultimo <= r) out[y * gw + x] = 1; }
      ultimo = 1e9;
      for (let x = gw - 1; x >= 0; x--) { if (src[y * gw + x]) ultimo = x; if (ultimo - x <= r) out[y * gw + x] = 1; }
    }
  } else {
    for (let x = 0; x < gw; x++) {
      let ultimo = -1e9;
      for (let y = 0; y < gh; y++) { if (src[y * gw + x]) ultimo = y; if (y - ultimo <= r) out[y * gw + x] = 1; }
      ultimo = 1e9;
      for (let y = gh - 1; y >= 0; y--) { if (src[y * gw + x]) ultimo = y; if (ultimo - y <= r) out[y * gw + x] = 1; }
    }
  }
  return out;
}

// Caratteri per verso dentro il riquadro: 0 dritto, 90 dall'alto in basso, 180 capovolto, 270 dal basso in alto.
export function versiTesto(items, viewport, riq) {
  const conta = { 0: 0, 90: 0, 180: 0, 270: 0 };
  const util = globalThis.pdfjsLib.Util;
  for (const it of items) {
    const s = (it.str || '').trim();
    if (!s) continue;
    const m = util.transform(viewport.transform, it.transform);
    const x = m[4], y = m[5];
    if (riq && (x < riq.x || x > riq.x + riq.w || y < riq.y || y > riq.y + riq.h)) continue;
    const ang = Math.atan2(m[1], m[0]) * 180 / Math.PI;
    const b = ((Math.round(ang / 90) * 90) % 360 + 360) % 360;
    conta[b] += s.length;
  }
  return conta;
}

// Quanto ruotare (gradi in senso orario) per avere l'etichetta in verticale e il testo dritto.
export function rotazioneConsigliata(riq, conta) {
  const tot = conta[0] + conta[90] + conta[180] + conta[270];
  if (riq.w > riq.h) {
    if (tot && (conta[90] + conta[270]) > (conta[0] + conta[180])) return conta[270] >= conta[90] ? 90 : 270;
    return conta[90] > conta[270] ? 270 : 90;
  }
  if (tot && conta[180] > conta[0] && conta[180] >= Math.max(conta[90], conta[270])) return 180;
  return 0;
}

// L'ordine conta: un'etichetta DPD cita BRT come deposito, quindi DPD viene prima.
const CORRIERI = [
  ['InPost', /inpost|numero riferimento cliente|\b24R\b/i],
  ['Mondial Relay', /mondial\s*relay/i],
  ['DPD', /\bdpd\b/i],
  ['BRT', /\bbrt\b|bartolini|\bMC\.\s*\d+,\d{3}\b/i],
  ['GLS', /\bgls\b/i],
  ['UPS', /\bups\b/i],
  ['DHL', /\bdhl\b/i],
  ['Poste', /poste\s*italiane|\bsda\b|poste\s*delivery/i],
  ['Vinted Go', /vinted\s*go/i],
  ['Packeta', /packeta|z[aá]silkovna/i],
  ['Correos', /correos/i],
  ['Colissimo', /colissimo|la\s*poste/i],
  ['Chronopost', /chronopost/i],
  ['Evri', /\bevri\b|hermes/i],
];

export function riconosciCorriere(testo) {
  for (const [nome, re] of CORRIERI) if (re.test(testo)) return nome;
  return null;
}

// La città di chi riceve: il CAP seguito dalla città, dopo «Destinatario» o simili.
// Si scartano il mittente (nelle etichette internazionali ha il CAP col prefisso del paese,
// «IT-…») e i depositi che vengono dopo il destinatario.
const MITTENTE_CAP = /^[A-Z]{2}-\d/;
const CHIAVE_DEST = /^(receiver|destinatario:?|delivery address:?|destinataire:?|empf[aä]nger:?)$/i;
export function riconosciCitta(items) {
  const pezzi = items.map((i) => (i.str || '').trim()).filter(Boolean);
  const candidati = [];
  let dopoChiave = -1;
  const parola = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*$/;
  pezzi.forEach((p, i) => {
    if (dopoChiave < 0 && CHIAVE_DEST.test(p)) dopoChiave = i;
    const m = p.match(/^(?:[A-Z]{2}-)?(\d{4,5}|\d{4}-\d{3})(?:\s+(.+))?$/);
    if (!m || MITTENTE_CAP.test(p.split(/\s/)[0])) return;
    const olandese = /^\d{4}$/.test(m[1]); // «7550 VD»: le due lettere fanno parte del CAP
    let citta = m[2] && !(olandese && /^[A-Z]{2}$/.test(m[2])) ? m[2] : '';
    if (!citta) {
      let j = i + 1;
      if (olandese && !m[2] && /^[A-Z]{2}$/.test(pezzi[j] || '') && parola.test(pezzi[j + 1] || '')) j++;
      const parole = [];
      while (j < pezzi.length && parole.length < 5 && parola.test(pezzi[j])) parole.push(pezzi[j++]);
      if (parole.length > 1 && /^[A-Z]{2}$/.test(parole[parole.length - 1])) parole.pop(); // sigla del paese
      citta = parole.join(' ');
    }
    citta = citta.trim();
    if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .-]{2,30}$/.test(citta)) candidati.push({ i, citta });
  });
  let scelta = candidati.find((c) => dopoChiave >= 0 && c.i > dopoChiave) || candidati[0];
  if (!scelta) {
    // BRT: niente CAP, la città sta subito prima di «MC. 0,000»
    const k = pezzi.findIndex((p) => /^MC\.\s*\d/.test(p));
    if (k > 0 && /^[A-Za-zÀ-ÿ' .-]{2,30}$/.test(pezzi[k - 1])) scelta = { citta: pezzi[k - 1] };
  }
  if (!scelta) return null;
  return scelta.citta.replace(/'{2,}/g, "'").toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (s) => s.toUpperCase());
}
