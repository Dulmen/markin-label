// app.js · Markin: il foglio sul tavolo. Le etichette arrivano dai PDF di Vinted,
// si ritagliano da sole e si posano negli spazi liberi; si spostano col dito.
import { SPAZI, posto, primoLibero, quantiFogli, compatta, usatiDopoStampa } from './foglio.js';
import { leggiPdf, disegnaPagina, boxDaRiq, ritaglia } from './sorgente.js';
import { creaPdf, nomeFile, precarica } from './esporta.js';
import * as archivio from './archivio.js';

const $ = (s) => document.querySelector(s);
const ui = {
  fogli: $('#fogli'), strato: $('#strato'), file: $('#file'), toast: $('#toast'), cala: $('#cala'),
  aggiungi: $('#aggiungi'), svuota: $('#svuota'), nuovo: $('#nuovo'), ristampa: $('#ristampa'),
  scarica: $('#scarica'), stampa: $('#stampa'), altro: $('#altro'), menu: $('#menu'),
  prec: $('#prec'), succ: $('#succ'), pager: $('#pagerTesto'),
};
const radice = document.documentElement;
// La molla del tracker. Scritta qui e non letta dal CSS: il foglio di stile può arrivare dopo,
// e una curva vuota fa fallire animate() in WebKit.
const MOLLA = (() => {
  const v = 'linear(0, 0.064, 0.206, 0.371, 0.53, 0.667, 0.776, 0.859, 0.918, 0.959, 0.984, 0.999, 1.007, 1.011, 1.011, 1.01, 1.008, 1.006, 1.005, 1.003, 1.002, 1.001, 1.001, 1, 1)';
  try { document.createElement('div').animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1, easing: v }).cancel(); return v; } catch { return 'cubic-bezier(.2,.8,.2,1)'; }
})();
const USCITA = 'cubic-bezier(.3,0,.8,.15)';
const telefono = () => matchMedia('(pointer: coarse)').matches;
const safari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
const nuovoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const attesa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const nome = (e) => [e.corriere, e.citta].filter(Boolean).join(' · ') || `Pagina ${e.pagina}`;

// ── stato ─────────────────────────────────────────────────────────
const S = {
  etichette: [], // { id, file, pagina, riqN, riqAuto, box, boxAuto, rotPagina, rot, rotAuto, corriere, citta, foglio, spazio, blob, url, w, h }
  usati: new Set(), // posti già staccati (foglio * 4 + spazio)
  files: new Map(), // id → { id, nome, bytes }
  scelta: null,
  ultimaStampa: null, // { nome, bytes }
};
const nodi = new Map(); // id etichetta → elemento
const trova = (id) => S.etichette.find((e) => e.id === id);
const inPosto = (f, s) => S.etichette.find((e) => e.foglio === f && e.spazio === s);

// ── disegno ───────────────────────────────────────────────────────
function nuovoFoglio(f) {
  const d = document.createElement('div');
  d.className = 'foglio';
  d.dataset.f = f;
  for (const sp of SPAZI) {
    const s = document.createElement('div');
    s.className = 'spazio';
    s.dataset.s = sp.i;
    s.tabIndex = 0;
    s.setAttribute('role', 'button');
    Object.assign(s.style, { left: (sp.x / 210) * 100 + '%', top: (sp.y / 297) * 100 + '%', width: (sp.w / 210) * 100 + '%', height: (sp.h / 297) * 100 + '%' });
    d.appendChild(s);
  }
  return d;
}
const spazioEl = (f, s) => ui.fogli.children[f]?.children[s];

function nodo(e) {
  let n = nodi.get(e.id);
  if (!n) {
    n = document.createElement('div');
    n.className = 'etichetta';
    n.dataset.id = e.id;
    const img = new Image();
    img.alt = '';
    img.draggable = false;
    n.appendChild(img);
    nodi.set(e.id, n);
  }
  const img = n.firstChild;
  if (img.getAttribute('src') !== e.url) img.src = e.url;
  return n;
}

function disegna() {
  const n = quantiFogli(S.etichette);
  for (const k of [...S.usati]) if (((k / 4) | 0) >= n) S.usati.delete(k);
  while (ui.fogli.children.length < n) {
    const f = nuovoFoglio(ui.fogli.children.length);
    if (aperto) f.classList.add('entra');
    ui.fogli.appendChild(f);
  }
  while (ui.fogli.children.length > n) ui.fogli.lastElementChild.remove();
  for (let f = 0; f < n; f++) {
    for (let s = 0; s < 4; s++) {
      const sp = spazioEl(f, s), e = inPosto(f, s);
      const usato = S.usati.has(f * 4 + s);
      sp.classList.toggle('usato', usato && !e);
      sp.classList.toggle('pieno', !!e);
      sp.setAttribute('aria-label', `Spazio ${SPAZI[s].nome}${n > 1 ? ` del foglio ${f + 1}` : ''}: ${e ? nome(e) : usato ? 'già usato' : 'libero'}`);
      if (e) { const nd = nodo(e); if (nd.parentNode !== sp) sp.appendChild(nd); }
    }
  }
  const vivi = new Set(S.etichette.map((e) => e.id));
  for (const [id, nd] of nodi) if (!vivi.has(id)) { nd.remove(); nodi.delete(id); }
  if (S.scelta && !vivi.has(S.scelta)) S.scelta = null;
  disegnaChip();
  disegnaBarra();
  aggiornaPager();
  salva();
  preparaPresto();
}

function disegnaBarra() {
  const ci = S.etichette.length > 0;
  ui.stampa.hidden = !ci;
  ui.stampa.querySelector('.conto').textContent = ci ? S.etichette.length : '';
  ui.aggiungi.classList.toggle('primario', !ci);
  ui.svuota.hidden = !ci;
  ui.scarica.hidden = !ci;
  ui.nuovo.hidden = S.usati.size === 0;
  ui.ristampa.hidden = ci || !S.ultimaStampa;
  $('#barra .sep').hidden = !ci;
  ui.menu.querySelector('[data-fa="svuota"]').hidden = ui.svuota.hidden;
  ui.menu.querySelector('[data-fa="nuovo"]').hidden = ui.nuovo.hidden;
  ui.menu.querySelector('[data-fa="ristampa"]').hidden = ui.ristampa.hidden;
  ui.altro.hidden = ui.svuota.hidden && ui.nuovo.hidden && ui.ristampa.hidden;
  if (ui.altro.hidden) ui.menu.hidden = true;
}

// Sposta lo stato e fa scivolare le etichette dal posto vecchio al nuovo.
function conFlip(cambia, { salta } = {}) {
  const prima = new Map();
  for (const [id, n] of nodi) if (id !== salta) prima.set(id, n.getBoundingClientRect());
  cambia();
  disegna();
  for (const [id, n] of nodi) {
    const a = prima.get(id);
    if (!a) continue;
    const b = n.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) + Math.abs(dy) < 1) continue;
    n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: MOLLA });
  }
}

// ── pager ─────────────────────────────────────────────────────────
function passoFogli() {
  const f = ui.fogli.firstElementChild;
  return f ? f.offsetWidth + parseFloat(getComputedStyle(ui.fogli).columnGap || 0) : 1;
}
const correnteFoglio = () => Math.max(0, Math.min(ui.fogli.children.length - 1, Math.round(ui.fogli.scrollLeft / passoFogli())));
function aggiornaPager() {
  const n = ui.fogli.children.length, c = correnteFoglio();
  ui.pager.textContent = `Foglio ${c + 1} di ${n}`;
  ui.prec.disabled = c <= 0;
  ui.succ.disabled = c >= n - 1;
}
function vaiA(i, liscio = true) {
  const n = ui.fogli.children.length;
  const k = Math.max(0, Math.min(n - 1, i));
  ui.fogli.scrollTo({ left: k * passoFogli(), behavior: liscio ? 'smooth' : 'auto' });
}
ui.fogli.addEventListener('scroll', () => requestAnimationFrame(aggiornaPager), { passive: true });
ui.prec.addEventListener('click', () => vaiA(correnteFoglio() - 1));
ui.succ.addEventListener('click', () => vaiA(correnteFoglio() + 1));
addEventListener('resize', () => { vaiA(correnteFoglio(), false); disegnaChip(); });

// ── luce: ombre e finestra seguono il puntatore ──────────────────
let luceRaf = 0;
function luce(x, y) {
  cancelAnimationFrame(luceRaf);
  luceRaf = requestAnimationFrame(() => {
    const nx = x / innerWidth - 0.5, ny = y / innerHeight - 0.5;
    const t = telefono() ? 0.55 : 1;
    radice.style.setProperty('--sx', ((16 - nx * 14) * t).toFixed(1) + 'px');
    radice.style.setProperty('--sy', ((22 - ny * 14) * t).toFixed(1) + 'px');
    radice.style.setProperty('--lx', (nx * 34).toFixed(1) + 'px');
    radice.style.setProperty('--ly', (ny * 22).toFixed(1) + 'px');
  });
}
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !presa) luce(e.clientX, e.clientY); }, { passive: true });

// ── avvisi con annulla ────────────────────────────────────────────
let toastTimer = 0, azioneToast = null;
function avviso(testo, annulla, durata = 6000) {
  clearTimeout(toastTimer);
  ui.toast.firstChild.textContent = testo;
  const b = ui.toast.querySelector('button');
  azioneToast = annulla || null;
  b.hidden = !annulla;
  ui.toast.classList.toggle('solo', !annulla);
  ui.toast.classList.add('su');
  toastTimer = setTimeout(chiudiToast, durata);
}
function chiudiToast() { ui.toast.classList.remove('su'); azioneToast = null; }
ui.toast.querySelector('button').addEventListener('click', () => { const a = azioneToast; chiudiToast(); a?.(); });

const storia = [];
function fatto(testo, annulla, durata) {
  const voce = () => { const i = storia.indexOf(voce); if (i >= 0) storia.splice(i, 1); annulla(); };
  storia.push(voce);
  if (storia.length > 30) storia.shift();
  avviso(testo, voce, durata);
}
function annullaUltimo() { const v = storia.pop(); if (v) { chiudiToast(); v(); } }

const istantanea = () => ({ etichette: S.etichette.map((e) => ({ ...e })), usati: new Set(S.usati) });
function ripristina(snap) {
  conFlip(() => { S.etichette = snap.etichette.map((e) => ({ ...e })); S.usati = new Set(snap.usati); });
}

// ── arrivo dei PDF ────────────────────────────────────────────────
let coda = Promise.resolve();
let inArrivo = 0;
async function aggiungiFile(lista) {
  const tutti = [...lista];
  const pdf = tutti.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (pdf.length < tutti.length) avviso(tutti.length - pdf.length === 1 ? 'Un file non è un PDF' : `${tutti.length - pdf.length} file non sono PDF`);
  if (!pdf.length) return;
  chiudiChip();
  inArrivo += pdf.length;
  for (const f of pdf) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const fid = nuovoId();
    const voce = { id: fid, nome: f.name, bytes };
    S.files.set(fid, voce);
    archivio.scrivi('file', fid, voce);
    let vuote = 0;
    try {
      await leggiPdf(bytes, {
        onPagina: async (p, n, tot) => {
          if (p.vuota) { vuote++; return; }
          await arriva(fid, p, tot);
        },
      });
      if (vuote) avviso(vuote === 1 ? `${f.name}: una pagina vuota, saltata` : `${f.name}: ${vuote} pagine vuote, saltate`);
    } catch (err) {
      console.warn('Markin:', err?.message, err?.stack);
      avviso(`Non riesco ad aprire ${f.name}`);
    }
    inArrivo--;
  }
  await coda;
}

async function arriva(fid, p) {
  const blob = await new Promise((ok) => p.anteprima.toBlob(ok, 'image/png'));
  const e = {
    id: nuovoId(), file: fid, pagina: p.numero,
    riqN: p.riqN, riqAuto: p.riqN, box: p.box, boxAuto: p.box,
    rotPagina: p.rotPagina, rot: p.rot, rotAuto: p.rot,
    corriere: p.corriere, citta: p.citta,
    blob, url: URL.createObjectURL(blob), w: p.anteprima.width, h: p.anteprima.height,
    ...primoLibero(S.etichette, S.usati),
  };
  S.etichette.push(e);
  disegna();
  const n = nodi.get(e.id);
  n.classList.add('via');
  const pagina = miniPagina(p.canvas);
  // un'etichetta alla volta, ma la successiva parte mentre questa è in volo;
  // se un volo fallisce l'etichetta compare al suo posto e la coda va avanti
  const turno = coda.then(() => volo(e, pagina)).catch((err) => {
    console.warn('Markin, volo:', err?.message);
    nodi.get(e.id)?.classList.remove('via');
    ui.strato.querySelectorAll('.pagina-volante, .in-volo:not(.presa)').forEach((x) => x.remove());
    return { prossima: Promise.resolve() };
  });
  coda = turno.then((v) => v.prossima);
  await coda;
}

function miniPagina(canvas) {
  const k = Math.min(1, 640 / canvas.width);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * k);
  c.height = Math.round(canvas.height * k);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

// La pagina compare sul tavolo, il filo lilla taglia l'etichetta, l'etichetta vola nel suo spazio.
async function volo(e, paginaCanvas) {
  const n = nodi.get(e.id);
  if (!n) return { prossima: Promise.resolve() };
  const veloce = inArrivo > 4 ? 0.65 : 1;
  if (correnteFoglio() !== e.foglio) { vaiA(e.foglio); await scrollFermo(); }
  const fin = rettangoloImg(e, n);
  const fo = ui.fogli.children[e.foglio].getBoundingClientRect();
  const stretto = innerWidth <= 700;
  const ph = stretto ? Math.min(fo.height * 0.42, 230) : Math.min(fo.height * 0.66, 520);
  const pw = ph / 1.4143;
  const pl = stretto ? innerWidth - pw - 22 : Math.min(innerWidth - pw - 24, fo.right + 56);
  const pt = stretto ? Math.min(innerHeight - ph - 120, fo.bottom - ph * 0.55) : fo.top + (fo.height - ph) / 2 - 10;
  const inclina = stretto ? 4 : 5;

  const pv = document.createElement('div');
  pv.className = 'pagina-volante';
  Object.assign(pv.style, { left: pl + 'px', top: pt + 'px', width: pw + 'px', height: ph + 'px', transform: `rotate(${inclina}deg)` });
  paginaCanvas.style.cssText = 'width:100%;height:100%;display:block;mix-blend-mode:multiply';
  const buco = document.createElement('div');
  buco.className = 'buco';
  const r = e.riqN;
  Object.assign(buco.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
  pv.append(paginaCanvas, buco);
  pv.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 100 141.43" preserveAspectRatio="none"><rect x="${r.x * 100}" y="${r.y * 141.43}" width="${r.w * 100}" height="${r.h * 141.43}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
  ui.strato.appendChild(pv);

  await pv.animate([
    { opacity: 0, transform: `translate(${stretto ? 30 : 80}px, ${stretto ? 60 : 30}px) rotate(${inclina + 7}deg)` },
    { opacity: 1, transform: `rotate(${inclina}deg)` },
  ], { duration: 340 * veloce, easing: MOLLA, fill: 'both' }).finished;

  const filo = pv.querySelector('rect');
  await filo.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 440 * veloce, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both' }).finished;

  // il pezzo tagliato: parte dalla pagina con il verso della pagina, arriva dritto nello spazio
  const cx0 = pl + pw * (r.x + r.w / 2), cy0 = pt + ph * (r.y + r.h / 2);
  const girata = e.rot % 180 !== 0;
  const k0 = (r.w * pw) / (girata ? fin.h : fin.w);
  const iv = document.createElement('div');
  iv.className = 'in-volo';
  Object.assign(iv.style, { width: fin.w + 'px', height: fin.h + 'px', transform: `translate(${fin.x}px, ${fin.y}px)` });
  const img = new Image();
  img.src = e.url;
  iv.appendChild(img);
  ui.strato.appendChild(iv);
  buco.style.opacity = 1;
  filo.style.opacity = 0;
  const dx0 = cx0 - (fin.x + fin.w / 2), dy0 = cy0 - (fin.y + fin.h / 2);
  const base = `translate(${fin.x}px, ${fin.y}px)`;
  const durata = 640 * veloce;
  const [posata, sollevata] = ombre();
  const volando = iv.animate([
    { transform: `${base} translate(${dx0}px, ${dy0}px) rotate(${inclina - e.rot}deg) scale(${k0})`, boxShadow: posata },
    { offset: 0.32, transform: `${base} translate(${dx0 * 0.62}px, ${dy0 * 0.62 - 46}px) rotate(${(inclina - e.rot) * 0.5 - 4}deg) scale(${((k0 + 1) / 2) * 1.05})`, boxShadow: sollevata },
    { transform: base, boxShadow: posata },
  ], { duration: durata, easing: MOLLA, fill: 'both' });

  (async () => {
    try {
      await volando.finished;
      n.classList.remove('via');
      iv.remove();
      await pv.animate([
        { opacity: 1, transform: `rotate(${inclina}deg)` },
        { opacity: 0, transform: `translate(${stretto ? 20 : 60}px, ${stretto ? 50 : 24}px) rotate(${inclina + 5}deg)` },
      ], { duration: 260, easing: USCITA, fill: 'both' }).finished;
    } catch { /* animazione interrotta: si pulisce comunque */ } finally {
      n.classList.remove('via');
      iv.remove();
      pv.remove();
    }
  })();
  return { prossima: attesa(durata * 0.42) };
}

// Dove sta davvero l'immagine dell'etichetta nel suo spazio (object-fit: contain, 1,5 mm d'aria).
function rettangoloImg(e, n) {
  const box = n.parentNode.getBoundingClientRect();
  const m = box.height * 0.0108;
  const W = box.width - 2 * m, H = box.height - 2 * m;
  const s = Math.min(W / e.w, H / e.h);
  const ww = e.w * s, hh = e.h * s;
  return { x: box.left + (box.width - ww) / 2, y: box.top + (box.height - hh) / 2, w: ww, h: hh };
}
// Ombra posata e sollevata, coi colori del tema (le variabili non si animano da sole).
function ombre() {
  const cs = getComputedStyle(radice);
  const sole = cs.getPropertyValue('--sole').trim(), forte = cs.getPropertyValue('--shadow-forte').trim();
  return [
    '0 1px 1px rgba(36,26,23,.12), 0 0 0 0 rgba(0,0,0,0), 0 0 0 0 rgba(0,0,0,0)',
    `0 1px 1px rgba(36,26,23,.12), 26px 38px 3px -8px ${sole}, 40px 60px 60px -14px ${forte}`,
  ];
}
// Aspetta che i fogli abbiano smesso di scorrere.
function scrollFermo() {
  return new Promise((ok) => {
    let ultimo = -1, fermi = 0, giri = 0;
    const guarda = () => {
      const x = ui.fogli.scrollLeft;
      fermi = x === ultimo ? fermi + 1 : 0;
      ultimo = x;
      if (fermi >= 3 || ++giri > 90) ok(); else requestAnimationFrame(guarda);
    };
    requestAnimationFrame(guarda);
  });
}

// ── staccare e riattaccare uno spazio vuoto ──────────────────────
function staccaRiattacca(f, s) {
  const k = f * 4 + s, sp = spazioEl(f, s);
  if (inPosto(f, s)) return;
  const stacca = !S.usati.has(k);
  const buccia = document.createElement('div');
  buccia.className = 'buccia';
  sp.appendChild(buccia);
  const via = { transform: 'translate3d(14%, -10%, 40px) rotate3d(-1, 1, 0, 64deg)', opacity: 0 };
  const posata = { transform: 'none', opacity: 1 };
  if (stacca) S.usati.add(k); else S.usati.delete(k);
  disegna();
  if (stacca) {
    buccia.animate([posata, { offset: 0.35, transform: 'translate3d(2%, -2%, 20px) rotate3d(-1, 1, 0, 26deg)', opacity: 1 }, via], { duration: 460, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' }).finished.then(() => buccia.remove());
  } else {
    riattacca(sp, buccia);
  }
}
// L'adesivo torna giù sopra la carta di supporto, che si vede finché non si posa.
function riattacca(sp, buccia) {
  sp.classList.add('usato');
  buccia.animate([
    { transform: 'translate3d(14%, -10%, 40px) rotate3d(-1, 1, 0, 64deg)', opacity: 0 },
    { transform: 'none', opacity: 1 },
  ], { duration: 420, easing: MOLLA, fill: 'both' }).finished.then(() => {
    buccia.remove();
    const f = +sp.parentNode?.dataset.f, s = +sp.dataset.s;
    if (!S.usati.has(f * 4 + s)) sp.classList.remove('usato');
  });
}

// ── scelta: il chip sopra l'etichetta ────────────────────────────
const ICONE = {
  ruota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>',
  ritaglia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
  togli: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const chip = document.createElement('div');
chip.className = 'chip vetro';
chip.innerHTML = `<span class="nome"></span><button data-a="ruota" aria-label="Capovolgi">${ICONE.ruota}</button><button data-a="ritaglia" aria-label="Ritaglia">${ICONE.ritaglia}</button><button data-a="togli" aria-label="Togli">${ICONE.togli}</button>`;
chip.addEventListener('pointerdown', (ev) => ev.stopPropagation());
chip.addEventListener('click', (ev) => {
  ev.stopPropagation();
  const a = ev.target.closest('button')?.dataset.a, e = trova(S.scelta);
  if (!a || !e) return;
  if (a === 'ruota') capovolgi(e);
  if (a === 'ritaglia') apriEditor(e);
  if (a === 'togli') togliEtichetta(e);
});
function scegli(id) { S.scelta = S.scelta === id ? null : id; disegnaChip(); }
function chiudiChip() { if (S.scelta) { S.scelta = null; disegnaChip(); } }
function disegnaChip() {
  for (const [id, n] of nodi) n.classList.toggle('scelta', id === S.scelta);
  const e = trova(S.scelta);
  if (!e) { chip.remove(); return; }
  chip.querySelector('.nome').textContent = nome(e);
  const n = nodi.get(e.id);
  if (chip.parentNode !== n) {
    n.appendChild(chip);
    chip.style.animation = 'none';
    void chip.offsetWidth;
    chip.style.animation = '';
    // il secondo click di un doppio click non deve cadere sui bottoni appena comparsi
    chip.classList.add('armando');
    setTimeout(() => chip.classList.remove('armando'), 260);
  }
}

async function capovolgi(e) {
  const img = await caricaImg(e.url);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.translate(c.width, c.height); ctx.rotate(Math.PI); ctx.drawImage(img, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  const prima = { rot: e.rot, blob: e.blob, url: e.url };
  Object.assign(e, { rot: (e.rot + 180) % 360, blob, url: URL.createObjectURL(blob) });
  disegna();
  nodi.get(e.id)?.firstChild.animate([{ transform: 'rotate(-180deg) scale(.96)' }, { transform: 'none' }], { duration: 560, easing: MOLLA });
  fatto(`Capovolta ${nome(e)}`, () => { Object.assign(e, prima); disegna(); });
}
const caricaImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });

function togliEtichetta(e, { daGhost } = {}) {
  const snap = istantanea();
  const n = nodi.get(e.id);
  const via = () => conFlip(() => { S.etichette = S.etichette.filter((x) => x.id !== e.id); compatta(S.etichette, S.usati); });
  if (n && !daGhost) {
    n.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate3d(8%, -6%, 0) rotate(-6deg) scale(1.03)', opacity: 0 }], { duration: 300, easing: USCITA, fill: 'both' }).finished.then(via);
  } else via();
  fatto(`Tolta ${nome(e)}`, () => ripristina(snap));
}

// ── tocchi e trascinamenti ────────────────────────────────────────
let presa = null, appenaTrascinato = false;
ui.fogli.addEventListener('pointerdown', (ev) => {
  if (ev.button > 0) return;
  const n = ev.target.closest('.etichetta');
  if (!n || ev.target.closest('.chip')) return;
  presa = { id: n.dataset.id, n, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, pid: ev.pointerId, tocco: ev.pointerType !== 'mouse', attiva: false, timer: 0, vx: 0, t: performance.now() };
  if (presa.tocco) presa.timer = setTimeout(() => presa && !presa.attiva && iniziaPresa(), 300);
  addEventListener('pointermove', muoviPresa, { passive: false });
  addEventListener('pointerup', lasciaPresa);
  addEventListener('pointercancel', annullaPresa);
});
document.addEventListener('touchmove', (ev) => { if (presa?.attiva) ev.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (ev) => { if (ev.target.closest?.('.etichetta')) ev.preventDefault(); });

function iniziaPresa() {
  const e = trova(presa.id);
  if (!e) return annullaPresa();
  presa.attiva = true;
  chiudiChip();
  const img = rettangoloImg(e, presa.n);
  const g = document.createElement('div');
  g.className = 'in-volo presa';
  Object.assign(g.style, { width: img.w + 'px', height: img.h + 'px' });
  const i = new Image();
  i.src = e.url;
  g.appendChild(i);
  ui.strato.appendChild(g);
  presa.g = g;
  presa.off = { x: presa.x0 - img.x, y: presa.y0 - img.y };
  presa.n.classList.add('via');
  presa.inclina = 0;
  posaGhost();
  g.animate([{ scale: 1 }, { scale: 1.04 }], { duration: 160, easing: MOLLA, fill: 'forwards' });
}

function posaGhost() {
  if (!presa?.g) return;
  presa.g.style.transform = `translate(${presa.x - presa.off.x}px, ${presa.y - presa.off.y}px) rotate(${presa.inclina.toFixed(2)}deg)`;
}

function muoviPresa(ev) {
  if (!presa || ev.pointerId !== presa.pid) return;
  const dx = ev.clientX - presa.x0, dy = ev.clientY - presa.y0;
  if (!presa.attiva) {
    if (presa.tocco) { if (Math.hypot(dx, dy) > 10) annullaPresa(); return; }
    if (Math.hypot(dx, dy) < 5) return;
    iniziaPresa();
  }
  ev.preventDefault();
  const ora = performance.now(), dt = Math.max(8, ora - presa.t);
  presa.vx = presa.vx * 0.7 + ((ev.clientX - presa.x) / dt) * 0.3;
  presa.t = ora;
  presa.x = ev.clientX;
  presa.y = ev.clientY;
  presa.inclina = Math.max(-7, Math.min(7, presa.vx * 9));
  posaGhost();
  luce(ev.clientX, ev.clientY);
  segnaBersaglio(spazioSotto(ev.clientX, ev.clientY));
  bordoScorre(ev.clientX);
}

function spazioSotto(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.classList?.contains('spazio')) return el;
    if (el.classList?.contains('foglio')) return el;
  }
  return null;
}
let bersaglio = null;
function segnaBersaglio(el) {
  const sp = el?.classList.contains('spazio') ? el : null;
  if (bersaglio === sp) return;
  bersaglio?.classList.remove('bersaglio');
  bersaglio = sp;
  bersaglio?.classList.add('bersaglio');
}
let bordoTimer = 0;
function bordoScorre(x) {
  const verso = x < 36 ? -1 : x > innerWidth - 36 ? 1 : 0;
  if (!verso) { clearTimeout(bordoTimer); bordoTimer = 0; return; }
  if (bordoTimer) return;
  bordoTimer = setTimeout(() => { bordoTimer = 0; vaiA(correnteFoglio() + verso); }, 450);
}

function lasciaPresa(ev) {
  if (!presa || ev.pointerId !== presa.pid) return;
  const p = presa;
  pulisciPresa();
  if (!p.attiva) {
    clearTimeout(p.timer);
    scegli(p.id);
    return;
  }
  appenaTrascinato = true;
  setTimeout(() => (appenaTrascinato = false), 0);
  const e = trova(p.id);
  const sotto = spazioSotto(p.x, p.y);
  segnaBersaglio(null);
  if (!e) return p.g.remove();
  if (!sotto) {
    // fuori dai fogli: l'etichetta si toglie
    p.g.animate([{ opacity: 1 }, { opacity: 0, transform: `${p.g.style.transform} translateY(40px) rotate(8deg) scale(.96)` }], { duration: 280, easing: USCITA, fill: 'both' }).finished.then(() => p.g.remove());
    togliEtichetta(e, { daGhost: true });
    return;
  }
  const f = +sotto.closest('.foglio').dataset.f, s = sotto.classList.contains('spazio') ? +sotto.dataset.s : null;
  const valido = s !== null && !(S.usati.has(f * 4 + s) && !inPosto(f, s)) && !(f === e.foglio && s === e.spazio);
  if (valido) {
    const altra = inPosto(f, s);
    const da = { foglio: e.foglio, spazio: e.spazio };
    const snap = istantanea();
    conFlip(() => {
      Object.assign(e, { foglio: f, spazio: s });
      if (altra) Object.assign(altra, da);
    }, { salta: e.id });
    if (altra) fatto(`Scambiate ${SPAZI[da.spazio].nome} e ${SPAZI[s].nome}`, () => ripristina(snap), 3500);
  }
  atterra(e, p.g);
}

// Il fantasma scende nello spazio dell'etichetta (nuovo o di partenza).
function atterra(e, g) {
  const n = nodi.get(e.id);
  if (!n) return g.remove();
  const fin = rettangoloImg(e, n);
  g.animate([
    { transform: g.style.transform, scale: 1.04 },
    { transform: `translate(${fin.x}px, ${fin.y}px)`, scale: 1, width: fin.w + 'px', height: fin.h + 'px' },
  ], { duration: 420, easing: MOLLA, fill: 'both' }).finished.then(() => { n.classList.remove('via'); g.remove(); });
}

function annullaPresa() {
  if (!presa) return;
  const p = presa;
  pulisciPresa();
  clearTimeout(p.timer);
  segnaBersaglio(null);
  if (p.attiva) { const e = trova(p.id); if (e) atterra(e, p.g); else p.g.remove(); }
}
function pulisciPresa() {
  removeEventListener('pointermove', muoviPresa);
  removeEventListener('pointerup', lasciaPresa);
  removeEventListener('pointercancel', annullaPresa);
  clearTimeout(bordoTimer);
  bordoTimer = 0;
  presa = null;
}

// tocco su uno spazio vuoto: si stacca o si riattacca; tocco sul tavolo: via il chip
ui.fogli.addEventListener('click', (ev) => {
  if (appenaTrascinato || ev.target.closest('.etichetta') || ev.target.closest('.chip')) return;
  const sp = ev.target.closest('.spazio');
  if (sp && !sp.classList.contains('pieno')) return staccaRiattacca(+sp.parentNode.dataset.f, +sp.dataset.s);
  chiudiChip();
});
ui.fogli.addEventListener('keydown', (ev) => {
  const sp = ev.target.closest?.('.spazio');
  if (!sp || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault();
  const f = +sp.parentNode.dataset.f, s = +sp.dataset.s, e = inPosto(f, s);
  if (e) scegli(e.id); else staccaRiattacca(f, s);
});

// ── ritaglio a mano ───────────────────────────────────────────────
const ed = { el: $('#editor'), velo: $('#velo'), tela: $('#tela'), nome: $('#editorNome'), mini: $('#editorMini') };
let lavoro = null; // { e, canvas, vp, r: {x,y,w,h} normalizzato, rot, box }
async function apriEditor(e) {
  chiudiChip();
  ed.nome.textContent = nome(e);
  ed.velo.hidden = false;
  ed.el.hidden = false;
  ed.el.classList.remove('esce');
  ed.tela.innerHTML = '';
  const larga = Math.max(1500, ed.tela.clientWidth * devicePixelRatio);
  const { canvas, vp } = await disegnaPagina(S.files.get(e.file).bytes, e.pagina, larga);
  lavoro = { e, canvas, vp, r: { ...e.riqN }, rot: e.rot };
  const pag = document.createElement('div');
  pag.className = 'pagina';
  pag.appendChild(canvas);
  pag.insertAdjacentHTML('beforeend', '<div class="velatura"><div class="foro"></div></div>');
  const riq = document.createElement('div');
  riq.className = 'riquadro';
  for (const m of ['no', 'n', 'ne', 'e', 'se', 's', 'so', 'o']) {
    const h = document.createElement('div');
    h.className = 'maniglia';
    h.dataset.m = m;
    riq.appendChild(h);
  }
  pag.appendChild(riq);
  ed.tela.appendChild(pag);
  misuraEditor();
  anteprimaEditor();
  ed.el.querySelector('#editorFatto').focus({ preventScroll: true });
}
// La piccola etichetta in testata: com'è venuto il taglio, già girata.
function anteprimaEditor() {
  if (!lavoro) return;
  const { canvas, r, rot } = lavoro;
  const c = ritaglia(canvas, { x: r.x * canvas.width, y: r.y * canvas.height, w: r.w * canvas.width, h: r.h * canvas.height }, rot);
  const H = 64 * devicePixelRatio, k = H / c.height;
  ed.mini.width = Math.max(1, Math.round(c.width * k));
  ed.mini.height = Math.round(H);
  ed.mini.getContext('2d').drawImage(c, 0, 0, ed.mini.width, ed.mini.height);
}
function misuraEditor() {
  if (!lavoro) return;
  const pag = ed.tela.querySelector('.pagina');
  const W = ed.tela.clientWidth, H = ed.tela.clientHeight;
  const k = Math.min(W / lavoro.canvas.width, H / lavoro.canvas.height);
  pag.style.width = lavoro.canvas.width * k + 'px';
  pag.style.height = lavoro.canvas.height * k + 'px';
  disegnaRiquadro();
}
addEventListener('resize', misuraEditor);
function disegnaRiquadro() {
  const riq = ed.tela.querySelector('.riquadro');
  if (!riq) return;
  const { r } = lavoro;
  const box = { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' };
  Object.assign(riq.style, box);
  Object.assign(ed.tela.querySelector('.foro').style, box);
  const pos = { no: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], so: [0, 100], o: [0, 50] };
  for (const h of riq.children) { const [x, y] = pos[h.dataset.m]; h.style.left = x + '%'; h.style.top = y + '%'; }
}
ed.tela.addEventListener('pointerdown', (ev) => {
  const pag = ed.tela.querySelector('.pagina');
  if (!lavoro || !pag) return;
  ev.preventDefault();
  const b = pag.getBoundingClientRect();
  const p0 = { x: (ev.clientX - b.left) / b.width, y: (ev.clientY - b.top) / b.height };
  const m = ev.target.closest('.maniglia')?.dataset.m || (ev.target.closest('.riquadro') ? 'sposta' : 'nuovo');
  const r0 = { ...lavoro.r };
  const minW = 10 / 210, minH = 10 / 297;
  const lim = (v) => Math.max(0, Math.min(1, v));
  ed.tela.setPointerCapture(ev.pointerId);
  const muovi = (e2) => {
    const p = { x: lim((e2.clientX - b.left) / b.width), y: lim((e2.clientY - b.top) / b.height) };
    let { x, y, w, h } = r0;
    let x2 = x + w, y2 = y + h;
    if (m === 'sposta') {
      const dx = p.x - p0.x, dy = p.y - p0.y;
      x = Math.max(0, Math.min(1 - w, r0.x + dx));
      y = Math.max(0, Math.min(1 - h, r0.y + dy));
      lavoro.r = { x, y, w, h };
    } else if (m === 'nuovo') {
      lavoro.r = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.max(minW, Math.abs(p.x - p0.x)), h: Math.max(minH, Math.abs(p.y - p0.y)) };
      lavoro.r.w = Math.min(lavoro.r.w, 1 - lavoro.r.x);
      lavoro.r.h = Math.min(lavoro.r.h, 1 - lavoro.r.y);
    } else {
      if (m.includes('o')) x = Math.min(p.x, x2 - minW);
      if (m.includes('e')) x2 = Math.max(p.x, x + minW);
      if (m.includes('n')) y = Math.min(p.y, y2 - minH);
      if (m.includes('s')) y2 = Math.max(p.y, y + minH);
      lavoro.r = { x, y, w: x2 - x, h: y2 - y };
    }
    disegnaRiquadro();
  };
  const su = () => { ed.tela.removeEventListener('pointermove', muovi); ed.tela.removeEventListener('pointerup', su); ed.tela.removeEventListener('pointercancel', su); anteprimaEditor(); };
  ed.tela.addEventListener('pointermove', muovi);
  ed.tela.addEventListener('pointerup', su);
  ed.tela.addEventListener('pointercancel', su);
  if (m === 'nuovo') muovi(ev);
});
$('#editorAuto').addEventListener('click', () => { if (!lavoro) return; lavoro.r = { ...lavoro.e.riqAuto }; lavoro.rot = lavoro.e.rotAuto; disegnaRiquadro(); anteprimaEditor(); });
$('#editorPagina').addEventListener('click', () => { if (!lavoro) return; lavoro.r = { x: 0, y: 0, w: 1, h: 1 }; disegnaRiquadro(); anteprimaEditor(); });
$('#editorRuota').addEventListener('click', () => {
  if (!lavoro) return;
  lavoro.rot = (lavoro.rot + 90) % 360;
  anteprimaEditor();
  ed.mini.animate([{ transform: 'rotate(-90deg) scale(.9)' }, { transform: 'none' }], { duration: 420, easing: MOLLA });
});
$('#editorFatto').addEventListener('click', async () => {
  if (!lavoro) return;
  const { e, canvas, vp, r, rot } = lavoro;
  const px = { x: r.x * canvas.width, y: r.y * canvas.height, w: r.w * canvas.width, h: r.h * canvas.height };
  const c = ritaglia(canvas, px, rot);
  const k = Math.min(1, 1600 / Math.max(c.width, c.height));
  const piccolo = document.createElement('canvas');
  piccolo.width = Math.round(c.width * k);
  piccolo.height = Math.round(c.height * k);
  piccolo.getContext('2d').drawImage(c, 0, 0, piccolo.width, piccolo.height);
  const blob = await new Promise((ok) => piccolo.toBlob(ok, 'image/png'));
  const prima = { riqN: e.riqN, box: e.box, rot: e.rot, blob: e.blob, url: e.url, w: e.w, h: e.h };
  Object.assign(e, { riqN: { ...r }, box: boxDaRiq(vp, px), rot, blob, url: URL.createObjectURL(blob), w: piccolo.width, h: piccolo.height });
  chiudiEditor();
  disegna();
  nodi.get(e.id)?.firstChild.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: MOLLA });
  fatto(`Ritagliata ${nome(e)}`, () => { Object.assign(e, prima); disegna(); });
});
function chiudiEditor() {
  if (ed.el.hidden) return;
  lavoro = null;
  ed.el.classList.add('esce');
  ed.velo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'both' }).finished.then(() => {
    ed.velo.hidden = true;
    ed.el.hidden = true;
    ed.el.classList.remove('esce');
    ed.tela.innerHTML = '';
  });
}
$('#editorChiudi').addEventListener('click', chiudiEditor);
ed.velo.addEventListener('click', chiudiEditor);

// ── stampa ────────────────────────────────────────────────────────
let pronto = null, preparaTimer = 0;
const firma = () => JSON.stringify(S.etichette.map((e) => [e.id, e.foglio, e.spazio, e.rot, e.box]));
async function prepara() {
  const f = firma();
  if (pronto?.firma === f) return pronto;
  const etichette = S.etichette.map((e) => ({ ...e }));
  const bytes = await creaPdf(etichette, S.files);
  const p = { firma: f, bytes, nome: nomeFile(etichette), quante: etichette.length };
  if (firma() === f) pronto = p;
  return p;
}
function preparaPresto() {
  clearTimeout(preparaTimer);
  if (!S.etichette.length) return;
  preparaTimer = setTimeout(() => prepara().catch(() => {}), 700);
}

function lavora(btn, si) {
  btn.classList.toggle('lavora', si);
  let a = btn.querySelector('.anello');
  if (si && !a) { a = document.createElement('span'); a.className = 'anello'; btn.prepend(a); }
  if (!si) a?.remove();
}

async function stampa(modo) {
  if (!S.etichette.length || ui.stampa.classList.contains('lavora')) return;
  chiudiChip();
  const condividi = telefono() && navigator.canShare;
  let p = pronto?.firma === firma() ? pronto : null;
  let finestra = null;
  if (!p && modo === 'stampa' && !condividi && safari) finestra = window.open('', '_blank');
  if (!p) {
    lavora(ui.stampa, true);
    try { p = await prepara(); } catch (err) { console.warn(err); avviso('Non riesco a creare il PDF'); finestra?.close(); return; } finally { lavora(ui.stampa, false); }
  }
  const file = new File([p.bytes], p.nome, { type: 'application/pdf' });
  if (await consegna(file, modo, finestra) === false) return;
  registraStampa(p);
}

// Telefono: il foglio di condivisione (Stampa, Salva su File). Computer: stampa o scarica.
async function consegna(file, modo, finestra) {
  if (telefono() && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); return true; } catch (err) {
      if (err.name === 'AbortError') return false;
      if (err.name === 'NotAllowedError') { avviso('Tocca di nuovo Stampa'); return false; }
      scaricaFile(file);
      return true;
    }
  }
  if (modo === 'scarica') { scaricaFile(file); return true; }
  const url = URL.createObjectURL(file);
  if (finestra) finestra.location = url;
  else if (safari) window.open(url, '_blank');
  else {
    const fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
    fr.src = url;
    fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { window.open(url, '_blank'); } };
    document.body.appendChild(fr);
    setTimeout(() => fr.remove(), 120000);
  }
  return true;
}
function scaricaFile(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// Dopo la stampa le etichette si staccano dal foglio: restano gli spazi usati per la prossima volta.
function registraStampa(p) {
  const snap = istantanea(), ultimaPrima = S.ultimaStampa;
  const quante = S.etichette.length;
  const dopo = usatiDopoStampa(S.etichette, S.usati);
  S.ultimaStampa = { nome: p.nome, bytes: p.bytes };
  archivio.scrivi('stato', 'ultimaStampa', S.ultimaStampa);
  const lista = [...nodi.values()];
  lista.forEach((n, i) => n.animate([
    { transform: 'none', opacity: 1 },
    { transform: 'translate3d(10%, -8%, 0) rotate(-5deg) scale(1.02)', opacity: 0 },
  ], { duration: 340, delay: i * 70, easing: USCITA, fill: 'both' }));
  setTimeout(() => {
    S.etichette = [];
    S.usati = dopo;
    disegna();
    vaiA(0, false);
    lista.forEach((n) => n.getAnimations().forEach((a) => a.cancel()));
  }, 340 + lista.length * 70);
  const liberi = 4 - dopo.size;
  const testo = dopo.size === 0 ? `Stampate ${quante} · si riparte da un foglio nuovo` : `Stampate ${quante} · ${liberi === 1 ? 'resta 1 spazio' : `restano ${liberi} spazi`}`;
  fatto(testo, () => {
    S.ultimaStampa = ultimaPrima;
    if (ultimaPrima) archivio.scrivi('stato', 'ultimaStampa', ultimaPrima); else archivio.togli('stato', 'ultimaStampa');
    ripristina(snap);
  }, 9000);
}

async function ristampa() {
  if (!S.ultimaStampa) return;
  const file = new File([S.ultimaStampa.bytes], S.ultimaStampa.nome, { type: 'application/pdf' });
  await consegna(file, telefono() ? 'stampa' : 'scarica', null);
}

// ── azioni della barra ────────────────────────────────────────────
ui.aggiungi.addEventListener('click', () => ui.file.click());
ui.file.addEventListener('change', () => { const l = [...ui.file.files]; ui.file.value = ''; aggiungiFile(l); });
ui.stampa.addEventListener('click', () => stampa('stampa'));
ui.scarica.addEventListener('click', () => stampa('scarica'));
ui.ristampa.addEventListener('click', ristampa);
function svuota() {
  if (!S.etichette.length) return;
  const snap = istantanea();
  const n = S.etichette.length;
  conFlip(() => { S.etichette = []; });
  fatto(n === 1 ? 'Tolta 1 etichetta' : `Tolte ${n} etichette`, () => ripristina(snap));
}
function foglioNuovo() {
  if (!S.usati.size) return;
  const snap = istantanea();
  const prima = [...S.usati];
  S.usati = new Set();
  disegna();
  prima.forEach((k, i) => {
    const sp = spazioEl((k / 4) | 0, k % 4);
    if (!sp || sp.classList.contains('pieno')) return;
    const b = document.createElement('div');
    b.className = 'buccia';
    sp.appendChild(b);
    sp.classList.add('usato');
    setTimeout(() => riattacca(sp, b), i * 80);
  });
  fatto('Foglio nuovo', () => ripristina(snap));
}
ui.svuota.addEventListener('click', svuota);
ui.nuovo.addEventListener('click', foglioNuovo);
ui.altro.addEventListener('click', (ev) => { ev.stopPropagation(); ui.menu.hidden = !ui.menu.hidden; });
ui.menu.addEventListener('click', (ev) => {
  const a = ev.target.closest('button')?.dataset.fa;
  ui.menu.hidden = true;
  if (a === 'svuota') svuota();
  if (a === 'nuovo') foglioNuovo();
  if (a === 'ristampa') ristampa();
});
addEventListener('pointerdown', (ev) => { if (!ui.menu.hidden && !ev.target.closest('#menu, #altro')) ui.menu.hidden = true; });

// ── trascinare i PDF sulla finestra ──────────────────────────────
let sopra = 0;
const conFile = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', (ev) => { if (!conFile(ev)) return; ev.preventDefault(); sopra++; ui.cala.hidden = false; });
addEventListener('dragover', (ev) => { if (!conFile(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; luce(ev.clientX, ev.clientY); });
addEventListener('dragleave', (ev) => { if (!conFile(ev)) return; sopra = Math.max(0, sopra - 1); if (!sopra) ui.cala.hidden = true; });
addEventListener('drop', (ev) => {
  if (!conFile(ev)) return;
  ev.preventDefault();
  sopra = 0;
  ui.cala.hidden = true;
  aggiungiFile(ev.dataTransfer.files);
});

// ── tastiera ──────────────────────────────────────────────────────
addEventListener('keydown', (ev) => {
  const cmd = ev.metaKey || ev.ctrlKey;
  if (!ed.el.hidden) {
    if (ev.key === 'Escape') chiudiEditor();
    if (ev.key === 'Enter' && !ev.target.closest?.('button')) $('#editorFatto').click();
    return;
  }
  if (cmd && ev.key.toLowerCase() === 'p') { ev.preventDefault(); stampa('stampa'); }
  else if (cmd && ev.key.toLowerCase() === 's') { ev.preventDefault(); stampa('scarica'); }
  else if (cmd && ev.key.toLowerCase() === 'o') { ev.preventDefault(); ui.file.click(); }
  else if (cmd && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); annullaUltimo(); }
  else if (ev.key === 'ArrowLeft' && !cmd) vaiA(correnteFoglio() - 1);
  else if (ev.key === 'ArrowRight' && !cmd) vaiA(correnteFoglio() + 1);
  else if ((ev.key === 'Backspace' || ev.key === 'Delete') && S.scelta) { const e = trova(S.scelta); if (e) togliEtichetta(e); }
  else if (ev.key === 'Escape') { chiudiChip(); ui.menu.hidden = true; }
});

// ── memoria fra un'apertura e l'altra ────────────────────────────
let salvaTimer = 0, aperto = false;
// quando l'app va in secondo piano (su iPhone dopo la condivisione) si salva subito
document.addEventListener('visibilitychange', () => { if (document.hidden && salvaTimer) salva(true); });
function salva(subito = false) {
  if (!aperto) return;
  clearTimeout(salvaTimer);
  salvaTimer = setTimeout(async () => {
    salvaTimer = 0;
    await archivio.scrivi('stato', 'usati', [...S.usati]);
    const vivi = new Set();
    for (const e of S.etichette) {
      vivi.add(e.id);
      const { url, ...resto } = e;
      void url;
      archivio.scrivi('etichette', e.id, resto);
    }
    for (const k of (await archivio.chiavi('etichette')) || []) if (!vivi.has(k)) archivio.togli('etichette', k);
  }, subito ? 0 : 250);
}

async function riapri() {
  const [et, fi, us, ul] = await Promise.all([
    archivio.tutti('etichette'), archivio.tutti('file'), archivio.leggi('stato', 'usati'), archivio.leggi('stato', 'ultimaStampa'),
  ]);
  for (const f of fi || []) if (f?.id) S.files.set(f.id, f);
  S.etichette = (et || []).filter((e) => e?.blob && S.files.has(e.file)).map((e) => ({ ...e, url: URL.createObjectURL(e.blob) }));
  S.usati = new Set(us || []);
  S.ultimaStampa = ul || null;
  // i PDF che nessuna etichetta usa più si buttano
  const servono = new Set(S.etichette.map((e) => e.file));
  for (const id of [...S.files.keys()]) if (!servono.has(id)) { S.files.delete(id); archivio.togli('file', id); }
}

// ── avvio ─────────────────────────────────────────────────────────
(async () => {
  await riapri();
  disegna(); // il primo foglio è già nella pagina ed è entrato da solo
  aperto = true;
  vaiA(0, false);
  precarica();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || new URLSearchParams(location.search).has('sw'))) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  radice.dataset.pronto = '1';
})();
