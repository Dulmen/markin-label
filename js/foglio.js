// foglio.js · il foglio Markin A465 e dove va ogni etichetta. Niente DOM qui.
// Un posto è foglio * 4 + spazio; gli spazi già staccati sono un Set di posti.

// A4 con quattro etichette da 99 × 139 mm: margine 6 mm a sinistra, 7 mm in alto,
// 5 mm fra le due file. Sono le misure della v1, provate sulla stampante di Andrea.
export const A4 = { w: 210, h: 297 };
export const SPAZI = [0, 1, 2, 3].map((i) => {
  const col = i % 2, riga = (i / 2) | 0;
  return { i, nome: 'ABCD'[i], x: 6 + col * 99, y: 7 + riga * 144, w: 99, h: 139 };
});
export const MARGINE_INTERNO = 1.5; // mm d'aria dentro l'adesivo, per la fustella

export const posto = (e) => e.foglio * 4 + e.spazio;

export function primoLibero(etichette, usati) {
  const occupati = new Set(etichette.map(posto));
  for (let k = 0; ; k++) if (!usati.has(k) && !occupati.has(k)) return { foglio: (k / 4) | 0, spazio: k % 4 };
}

export function quantiFogli(etichette) {
  return Math.max(1, ...etichette.map((e) => e.foglio + 1));
}

// Un foglio senza etichette prima dell'ultimo non si stampa e confonderebbe l'ordine in stampante:
// se ha ancora adesivi liberi, le etichette scorrono avanti nell'ordine in cui stanno.
// Un foglio tutto staccato invece è finito e si salta.
export function compatta(etichette, usati) {
  const n = quantiFogli(etichette);
  const pieni = new Set(etichette.map((e) => e.foglio));
  let buco = false;
  for (let f = 0; f < n - 1; f++) {
    if (pieni.has(f)) continue;
    for (let s = 0; s < 4; s++) if (!usati.has(f * 4 + s)) buco = true;
  }
  if (!buco) return false;
  const messe = [];
  for (const e of [...etichette].sort((a, b) => posto(a) - posto(b))) {
    Object.assign(e, primoLibero(messe, usati));
    messe.push(e);
  }
  return true;
}

// Dopo la stampa nella stampante resta l'ultimo foglio stampato: i suoi spazi usati
// (di prima o appena stampati) diventano quelli del foglio da cui si riparte.
export function usatiDopoStampa(etichette, usati) {
  const ultimo = quantiFogli(etichette) - 1;
  const dopo = new Set();
  for (let s = 0; s < 4; s++) if (usati.has(ultimo * 4 + s)) dopo.add(s);
  etichette.filter((e) => e.foglio === ultimo).forEach((e) => dopo.add(e.spazio));
  return dopo.size === 4 ? new Set() : dopo;
}

// Contiene un rettangolo (vw × vh) nello spazio, centrato, con il margine interno.
export function adatta(vw, vh, spazio, margine = MARGINE_INTERNO) {
  const W = spazio.w - 2 * margine, H = spazio.h - 2 * margine;
  const s = Math.min(W / vw, H / vh);
  const w = vw * s, h = vh * s;
  return { s, w, h, x: spazio.x + (spazio.w - w) / 2, y: spazio.y + (spazio.h - h) / 2 };
}
