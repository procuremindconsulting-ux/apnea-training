/* Mr. 9 Training – web app di allenamento.
   Nessuna dipendenza esterna: tutto vive nel browser (localStorage). */
'use strict';

const APP_VERSIONE = '0.1.0';
const KEY = 'mr9.stato.v1';
const FORMATO_SCHEDA = 'mr9-scheda-v1';
const FORMATO_ESITO = 'mr9-esito-v1';

const DOMANDE_DEFAULT = [
  { id: 'sensazioni', testo: 'Come ti sei sentito?', tipo: 'scala', min: 1, max: 5, etichette: ['Molto male', 'Benissimo'] },
  { id: 'impegno', testo: 'Quanto è stata dura? (impegno percepito)', tipo: 'scala', min: 1, max: 10, etichette: ['Facilissima', 'Massimale'] },
  { id: 'dolori', testo: 'Dolori o fastidi? Dove e quanto?', tipo: 'testo', facoltativa: true }
];

const HOME_BTN = '<a class="homebtn" href="#/" aria-label="Home"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></a>';

const INTENSITA = ['facile', 'recupero', 'medio', 'forte', 'massimale'];

/* ---------- stato ---------- */
let S = carica();
function carica() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return Object.assign({ coda: [], storico: [], corrente: null, noteCoach: '' }, s);
    }
  } catch (e) { /* storage non disponibile */ }
  return { coda: [], storico: [], corrente: null, noteCoach: '' };
}
function salva() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Impossibile salvare sul dispositivo'); }
}

/* ---------- utilità ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
}
function fmtBreve(sec) {
  if (sec == null) return '';
  if (sec < 60) return sec + '"';
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m}'${String(s).padStart(2, '0')}"` : `${m}'`;
}
function dataIt(iso) {
  try { return new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return iso; }
}
let toastT;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}
const sedutaCorrente = () => S.coda[0] || null;
function trovaSeduta(id) { return S.coda.find((s) => s.id === id) || null; }

/* ---------- audio, vibrazione, schermo acceso ---------- */
let actx;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(freq = 880, dur = 0.12, vol = 0.25) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(a.destination);
  const t = a.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}
function segnaleFine() { beep(660, 0.15); setTimeout(() => beep(990, 0.35), 180); vibra([200, 80, 200]); }
function segnaleConto() { beep(880, 0.08, 0.18); }
function vibra(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
let wakeLock = null;
async function schermoAcceso(on) {
  if (window.keepAwake) { try { if (on) window.keepAwake.on(); } catch (e) {} return; } // pwa.js tiene lo schermo acceso finché l'app è aperta
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.corrente) schermoAcceso(true); });

/* ---------- validazione scheda ---------- */
function estraiJSON(testo) {
  testo = (testo || '').trim();
  const a = testo.indexOf('{'), b = testo.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Non trovo nessun blocco JSON nel testo incollato.');
  return JSON.parse(testo.slice(a, b + 1));
}
function validaScheda(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Scheda vuota.');
  if (obj.formato && obj.formato !== FORMATO_SCHEDA) throw new Error(`Formato "${obj.formato}" non riconosciuto (atteso ${FORMATO_SCHEDA}).`);
  let sedute = obj.sedute;
  if (!sedute && obj.esercizi) sedute = [obj]; // una seduta singola
  if (!Array.isArray(sedute) || !sedute.length) throw new Error('La scheda non contiene sedute.');
  sedute.forEach((s, i) => {
    if (!s.titolo) throw new Error(`Seduta ${i + 1}: manca il titolo.`);
    if (!Array.isArray(s.esercizi) || !s.esercizi.length) throw new Error(`Seduta "${s.titolo}": nessun esercizio.`);
    if (!s.id) s.id = 'seduta-' + Date.now().toString(36) + '-' + i;
    s.esercizi.forEach((e, j) => {
      if (!e.nome) throw new Error(`"${s.titolo}", esercizio ${j + 1}: manca il nome.`);
      if (!e.id) e.id = 'es' + (j + 1);
      if (!e.tipo) e.tipo = e.fasi ? 'intervalli' : (e.voci ? 'circuito' : 'serie');
      if (!['serie', 'intervalli', 'circuito'].includes(e.tipo)) throw new Error(`"${e.nome}": tipo "${e.tipo}" non previsto (serie, intervalli, circuito).`);
      if (e.tipo === 'intervalli' && (!Array.isArray(e.fasi) || !e.fasi.length)) throw new Error(`"${e.nome}": mancano le fasi dell'interval timer.`);
      if (e.tipo === 'circuito' && !e.giri) e.giri = 1;
      if (e.tipo === 'serie' && !e.serie) e.serie = 1;
    });
  });
  return { sedute, note: obj.note_coach || '' };
}

/* ---------- intervalli: espansione delle fasi ---------- */
function espandiFasi(fasi, out = [], prefisso = '') {
  (fasi || []).forEach((f) => {
    if (Array.isArray(f.fasi)) {
      const n = Math.max(1, f.ripeti || 1);
      for (let i = 1; i <= n; i++) espandiFasi(f.fasi, out, n > 1 ? `${i}/${n}` : '');
    } else {
      const intens = INTENSITA.includes(f.intensita) ? f.intensita : 'medio';
      out.push({ nome: f.nome || 'Fase', durata_s: f.durata_s || null, intensita: intens, note: f.note || '', giro: prefisso, metri: f.metri || null });
    }
  });
  return out;
}

/* ---------- log della seduta corrente ---------- */
function logEs(id) {
  const c = S.corrente; if (!c) return null;
  if (!c.esercizi[id]) c.esercizi[id] = { stato: 'da_fare', serie: [], fasi_completate: 0, tempo_s: 0, note: '' };
  return c.esercizi[id];
}
function iniziaSeduta() {
  const s = sedutaCorrente(); if (!s) return;
  S.corrente = { sedutaId: s.id, inizio: new Date().toISOString(), esercizi: {}, risposte: {}, noteFinali: '' };
  salva(); audio(); schermoAcceso(true);
  location.hash = '#/seduta';
}

/* ---------- timer (uno solo attivo alla volta) ---------- */
const T = { tipo: null };
// tipo 'rec' | 'lavoro' : { exId, fine, durata }
// tipo 'int' : { exId, fasi, idx, inizioFase, accumulato, inPausa, elapsedPausa }
let ultimoSecondo = null;
function fermaTimer() { T.tipo = null; ultimoSecondo = null; }

function avviaRecupero(exId, sec) {
  if (!sec) { fermaTimer(); return; }
  Object.assign(T, { tipo: 'rec', exId, durata: sec, fine: Date.now() + sec * 1000 });
  ultimoSecondo = null;
}
function avviaLavoro(exId, sec) {
  Object.assign(T, { tipo: 'lavoro', exId, durata: sec, fine: Date.now() + sec * 1000 });
  ultimoSecondo = null;
}
function restante() { return Math.max(0, (T.fine - Date.now()) / 1000); }

function intAttivo(exId) { return T.tipo === 'int' && T.exId === exId; }
function intStato(ex) {
  if (intAttivo(ex.id)) return T;
  return null;
}
function intAvvia(ex) {
  const log = logEs(ex.id);
  if (intAttivo(ex.id)) {
    if (T.inPausa) { T.inPausa = false; T.inizioFase = Date.now() - T.elapsedPausa * 1000; }
    return;
  }
  const fasi = espandiFasi(ex.fasi);
  const idx = Math.min(log.fasi_completate || 0, fasi.length - 1);
  Object.assign(T, { tipo: 'int', exId: ex.id, fasi, idx, inizioFase: Date.now(), inPausa: false, elapsedPausa: 0, inizioTot: Date.now() - (log.tempo_s || 0) * 1000 });
  log.stato = log.stato === 'fatto' ? 'fatto' : 'in_corso';
  ultimoSecondo = null; segnaleConto(); salva();
}
function intPausa() { if (T.tipo !== 'int' || T.inPausa) return; T.elapsedPausa = (Date.now() - T.inizioFase) / 1000; T.inPausa = true; }
function intElapsed() { return T.inPausa ? T.elapsedPausa : (Date.now() - T.inizioFase) / 1000; }
function intAvanti(ex, auto) {
  if (T.tipo !== 'int') return;
  const log = logEs(ex.id);
  log.fasi_completate = Math.max(log.fasi_completate || 0, T.idx + 1);
  log.tempo_s = Math.round((Date.now() - T.inizioTot) / 1000);
  if (T.idx + 1 >= T.fasi.length) {
    log.stato = 'fatto'; fermaTimer(); salva(); segnaleFine(); render(); toast('Intervalli completati');
    return;
  }
  T.idx += 1; T.inizioFase = Date.now(); T.elapsedPausa = 0; T.inPausa = false; ultimoSecondo = null;
  if (auto) segnaleFine(); else segnaleConto();
  salva(); render();
}
function intIndietro() {
  if (T.tipo !== 'int') return;
  if (intElapsed() < 3 && T.idx > 0) T.idx -= 1;
  T.inizioFase = Date.now(); T.elapsedPausa = 0; ultimoSecondo = null; render();
}

setInterval(tick, 200);
function tick() {
  if (!T.tipo) return;
  if (T.tipo === 'rec' || T.tipo === 'lavoro') {
    const r = restante(), sec = Math.ceil(r);
    if (sec !== ultimoSecondo) { if (sec <= 3 && sec > 0) segnaleConto(); ultimoSecondo = sec; }
    if (r <= 0) {
      const exId = T.exId, era = T.tipo;
      fermaTimer();
      if (era === 'lavoro') fineLavoro(exId); else { segnaleFine(); render(); }
      return;
    }
    aggiornaCerchio(r, T.durata);
  } else if (T.tipo === 'int' && !T.inPausa) {
    const f = T.fasi[T.idx], el = intElapsed();
    if (f.durata_s) {
      const r = f.durata_s - el, sec = Math.ceil(r);
      if (sec !== ultimoSecondo) { if (sec <= 3 && sec > 0) segnaleConto(); ultimoSecondo = sec; }
      if (r <= 0) { const s = sedutaAttiva(); const ex = s && s.esercizi.find((e) => e.id === T.exId); if (ex) intAvanti(ex, true); return; }
    }
    aggiornaIntervalli();
  }
  const cl = $('#clock-seduta'); if (cl && S.corrente) cl.textContent = fmt((Date.now() - new Date(S.corrente.inizio)) / 1000);
}
setInterval(() => { const cl = $('#clock-seduta'); if (cl && S.corrente && !T.tipo) cl.textContent = fmt((Date.now() - new Date(S.corrente.inizio)) / 1000); }, 1000);

function prossimoDa(i) { const s = sedutaAttiva(); return s && i + 1 < s.esercizi.length ? `#/es/${i + 1}` : '#/fine'; }
function sedutaAttiva() { return S.corrente ? trovaSeduta(S.corrente.sedutaId) : null; }

/* ---------- serie: azioni ---------- */
function serieTotali(ex) { return ex.tipo === 'circuito' ? (ex.giri || 1) : (ex.serie || 1); }
function ripTarget(ex) { const n = parseInt(ex.ripetizioni, 10); return Number.isFinite(n) && String(ex.ripetizioni).trim() === String(n) ? n : ''; }
function tapSerie(ex) {
  audio();
  const log = logEs(ex.id);
  const tot = serieTotali(ex);
  if ((T.tipo === 'rec') && T.exId === ex.id) { fermaTimer(); render(); return; } // salta recupero
  if (T.tipo === 'lavoro' && T.exId === ex.id) return; // lavoro in corso
  if (log.serie.length >= tot) return;
  if (ex.lavoro_s && ex.tipo === 'serie') { avviaLavoro(ex.id, ex.lavoro_s); segnaleConto(); log.stato = 'in_corso'; salva(); render(); return; }
  registraSerie(ex);
}
function fineLavoro(exId) {
  const s = sedutaAttiva(); const ex = s && s.esercizi.find((e) => e.id === exId);
  if (!ex) return;
  registraSerie(ex, true);
}
function registraSerie(ex, daLavoro) {
  const log = logEs(ex.id);
  const prec = log.serie[log.serie.length - 1] || {};
  const voce = { n: log.serie.length + 1 };
  if (ex.tipo === 'serie') {
    if (ex.lavoro_s) voce.secondi = ex.lavoro_s; else voce.rip = prec.rip != null && prec.rip !== '' ? prec.rip : ripTarget(ex);
    voce.carico = prec.carico || '';
    if (ex.rir != null || ex.rpe != null) voce.rir = prec.rir != null ? prec.rir : '';
  }
  log.serie.push(voce);
  const tot = serieTotali(ex);
  if (log.serie.length >= tot) {
    log.stato = 'fatto';
    if (ex.recupero_dopo_s) avviaRecupero(ex.id, ex.recupero_dopo_s); else fermaTimer();
    segnaleFine();
  } else {
    log.stato = 'in_corso';
    const rec = ex.recupero_s || 0;
    if (rec) { avviaRecupero(ex.id, rec); if (daLavoro) segnaleFine(); else segnaleConto(); }
    else { fermaTimer(); if (daLavoro) segnaleFine(); }
  }
  salva(); render();
}

/* ---------- router ---------- */
window.addEventListener('hashchange', render);
let ultimaPagina = null;
let paginaModulo = null;
function render() {
  const h = location.hash || '#/';
  const parti = h.slice(2).split('/');
  const pag = parti[0] || '';
  const app = $('#app');
  let html = '';
  let focus = false;
  switch (pag) {
    case '': html = vHome(); break;
    case 'fisico': html = vFisico(); break;
    case 'seduta': html = vSeduta(); focus = !!S.corrente; break;
    case 'es': html = vEsercizio(parseInt(parti[1], 10) || 0); focus = !!S.corrente; break;
    case 'fine': html = vFine(); focus = true; break;
    case 'esito': html = vEsito(parti[1]); break;
    case 'carica': html = vCarica(); break;
    case 'collega': html = vCollega(); break;
    case 'storico': html = vStorico(); break;
    case 'apnea': html = vPresto('apnea', 'Apnea', 'Statica, dinamica, tabelle CO₂ e O₂ e diario delle sessioni in vasca.'); break;
    case 'mentale': html = vPresto('mentale', 'Mentale', 'Diario dell’allenamento mentale: respirazione, visualizzazione, routine pre-gara.'); break;
    case 'alimentazione': html = window.Mr9Alimentazione ? '<div id="ali-root"></div>' : vPresto('cibo', 'Alimentazione', 'Diario dei pasti, idratazione e note sul peso.'); break;
    default: html = vHome();
  }
  if (paginaModulo && paginaModulo !== pag && window.Mr9Alimentazione && window.Mr9Alimentazione.unmount) { try { window.Mr9Alimentazione.unmount(); } catch (e) {} }
  app.innerHTML = html;
  if (h !== ultimaPagina) { window.scrollTo(0, 0); ultimaPagina = h; }
  document.body.classList.toggle('focus', focus);
  const tab = pag === '' ? 'home' : (['seduta', 'es', 'fine', 'esito', 'carica', 'storico', 'collega'].includes(pag) ? 'fisico' : pag);
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  collega(pag, parti);
  paginaModulo = null;
  if (pag === 'alimentazione' && window.Mr9Alimentazione) { paginaModulo = pag; try { window.Mr9Alimentazione.mount($('#ali-root'), { percorso: parti.slice(1) }); } catch (e) { console.error(e); } }
  tick();
}

/* ---------- viste ---------- */
function statoFisico() {
  if (S.corrente) return 'Seduta in corso';
  if (sedutaCorrente()) return 'Seduta pronta';
  return 'In attesa del coach';
}
function vHome() {
  const ora = new Date().getHours();
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  return `
  <div class="eyebrow">${esc(saluto)}</div>
  <h1>Verso i <span class="grad-fisico">9 minuti</span></h1>
  <div class="tiles">
    <a class="tile big fisico" href="#/fisico">
      <span class="tbadge">${esc(statoFisico())}</span>
      <div><div class="tname">Allenamento fisico</div><div class="tsub">Palestra e aerobico</div></div>
    </a>
    <a class="tile apnea soon" href="#/apnea"><span class="tbadge">Presto</span><div><div class="tname">Apnea</div><div class="tsub">Statica e dinamica</div></div></a>
    <a class="tile mentale soon" href="#/mentale"><span class="tbadge">Presto</span><div><div class="tname">Mentale</div><div class="tsub">Diario</div></div></a>
    <a class="tile cibo big ${window.Mr9Alimentazione ? '' : 'soon'}" href="#/alimentazione" style="min-height:120px"><span class="tbadge">${window.Mr9Alimentazione ? 'Oggi' : 'Presto'}</span><div><div class="tname">Alimentazione</div><div class="tsub">Diario</div></div></a>
  </div>`;
}

function etichettaTipo(t) { return ({ palestra: 'Palestra', corsa: 'Corsa', nuoto: 'Nuoto', bici: 'Bici', misto: 'Misto' })[t] || 'Allenamento'; }

function vFisico() {
  const s = sedutaCorrente();
  let hero;
  if (S.corrente && s) {
    const fatti = s.esercizi.filter((e) => ['fatto', 'saltato'].includes((S.corrente.esercizi[e.id] || {}).stato)).length;
    hero = `
    <div class="hero">
      <span class="tag">In corso</span>
      <h2>${esc(s.titolo)}</h2>
      <div class="stats">
        <div class="stat"><b>${fatti}/${s.esercizi.length}</b><span>Esercizi</span></div>
        <div class="stat"><b id="clock-seduta">0:00</b><span>Tempo</span></div>
      </div>
      <a class="btn primary" href="#/seduta">Riprendi la seduta</a>
    </div>`;
  } else if (s) {
    hero = `
    <div class="hero">
      <span class="tag">${esc(etichettaTipo(s.tipo))}${s.data ? ' · ' + esc(dataIt(s.data)) : ''}</span>
      <h2>${esc(s.titolo)}</h2>
      <div class="stats">
        <div class="stat"><b>${s.esercizi.length}</b><span>Esercizi</span></div>
        ${s.durata_stimata_min ? `<div class="stat"><b>${esc(s.durata_stimata_min)}'</b><span>Durata</span></div>` : ''}
      </div>
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      <button class="btn primary" id="b-inizia">Inizia la seduta</button>
    </div>`;
  } else {
    hero = `
    <div class="card empty">
      <div class="big">⏳</div>
      <h2>Nessuna seduta pronta</h2>
      ${collegato()
        ? '<p class="muted">Il coach non ha ancora preparato la prossima seduta. Controllo ogni volta che apri l\u2019app.</p><button class="btn primary" id="b-sync">Controlla adesso</button>'
        : '<p class="muted">Collega l\u2019app al coach: le sedute arriveranno qui da sole.</p><a class="btn primary" href="#/collega">Collega il coach</a>'}
    </div>`;
  }
  const ultimo = S.storico[S.storico.length - 1];
  return `
  <div class="eyebrow">Allenamento fisico</div>
  <h1>Oggi</h1>
  ${hero}
  ${S.noteCoach && !S.corrente ? `<div class="card"><div class="eyebrow" style="margin-bottom:6px">Dal coach</div>${esc(S.noteCoach)}</div>` : ''}
  <div class="row" style="margin-top:6px">
    ${collegato() ? '<button class="btn" id="b-sync2">Aggiorna</button>' : '<a class="btn" href="#/collega">Collega il coach</a>'}
    <a class="btn" href="#/storico">Storico${S.storico.length ? ' (' + S.storico.length + ')' : ''}</a>
  </div>
  ${ultimo && !ultimo.inviato ? `<div class="card" style="margin-top:12px"><div class="hist"><div><b>Esito da inviare</b><div class="small muted">${esc(ultimo.titolo)}</div></div><a class="btn sm" href="#/esito/${S.storico.length - 1}">Invia</a></div></div>` : ''}
  ${collegato() ? `<p class="small muted" style="text-align:center;margin-top:14px"><a href="#/collega">${statoSync()}</a></p>` : ''}`;
}

function riassuntoEs(ex) {
  if (ex.tipo === 'intervalli') {
    const f = espandiFasi(ex.fasi);
    const tot = f.reduce((a, x) => a + (x.durata_s || 0), 0);
    return `${f.length} fasi${tot ? ' · ' + fmtBreve(tot) : ''}`;
  }
  if (ex.tipo === 'circuito') return `${ex.giri} giri · ${(ex.voci || []).length} esercizi`;
  const parti = [`${ex.serie} × ${ex.lavoro_s ? fmtBreve(ex.lavoro_s) : esc(ex.ripetizioni || '?')}`];
  if (ex.carico) parti.push(esc(ex.carico));
  if (ex.rir != null) parti.push(`riserva ${esc(ex.rir)}`);
  if (ex.recupero_s) parti.push(`rec ${fmtBreve(ex.recupero_s)}`);
  return parti.join(' · ');
}

function vSeduta() {
  const s = sedutaAttiva();
  if (!s) { return vFisico(); }
  const c = S.corrente;
  const items = s.esercizi.map((ex, i) => {
    const st = (c.esercizi[ex.id] || {}).stato || 'da_fare';
    const cls = st === 'fatto' ? 'done' : st === 'saltato' ? 'skip' : '';
    const num = st === 'fatto' ? '✓' : st === 'saltato' ? '–' : i + 1;
    return `<li><a class="exitem ${cls}" href="#/es/${i}">
      <span class="exnum">${num}</span>
      <span><h3>${esc(ex.nome)}</h3><span class="exmeta">${riassuntoEs(ex)}</span></span>
      <span class="chev">›</span></a></li>`;
  }).join('');
  const tutti = s.esercizi.every((e) => ['fatto', 'saltato'].includes((c.esercizi[e.id] || {}).stato));
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}<a class="back" href="#/fisico">‹ Fisico</a></span><span class="pill" id="clock-seduta">0:00</span></div>
  <div class="eyebrow">${esc(etichettaTipo(s.tipo))}</div>
  <h1>${esc(s.titolo)}</h1>
  ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
  <ul class="exlist">${items}</ul>
  <div class="stack" style="margin-top:16px">
    <a class="btn ${tutti ? 'ok' : ''}" href="#/fine">${tutti ? 'Chiudi la seduta' : 'Chiudi la seduta in anticipo'}</a>
  </div>`;
}

function vMedia(ex) {
  const src = ex.immagine || `img/esercizi/${encodeURIComponent(ex.id)}.webp`;
  return `<div class="media" data-media>
    <img src="${esc(src)}" alt="${esc(ex.nome)}" onerror="this.remove(); this.parentNode && (this.parentNode.dataset.vuoto='1');" hidden onload="this.hidden=false; this.parentNode.querySelector('.ph').remove();">
    <span class="ph">🏋️<br>Immagine dell'esercizio<br><span class="small">in arrivo</span></span>
  </div>`;
}

function vEsercizio(i) {
  const s = sedutaAttiva();
  if (!s) return vFisico();
  const ex = s.esercizi[i];
  if (!ex) { location.hash = '#/seduta'; return ''; }
  const nav = `
  <div class="topbar">
    <span class="tb-left">${HOME_BTN}<a class="back" href="#/seduta">‹ Seduta</a></span>
    <span class="pill">${i + 1} / ${s.esercizi.length}</span>
    <span class="pill" id="clock-seduta">0:00</span>
  </div>`;
  const testa = `
  ${ex.tipo === 'serie' || ex.tipo === 'circuito' ? vMedia(ex) : ''}
  <h1 style="margin-bottom:6px">${esc(ex.nome)}</h1>
  ${ex.condizione ? `<div class="note" style="border-color:var(--warn)">⚠ ${esc(ex.condizione)}</div>` : ''}
  ${ex.note ? `<div class="note">${esc(ex.note)}</div>` : ''}`;
  const ultimo = i + 1 >= s.esercizi.length;
  let corpo = '';
  if (ex.tipo === 'intervalli') corpo = vIntervalli(ex, ultimo);
  else corpo = vSerie(ex, ultimo);
  const log = logEs(ex.id);
  const altri = ex.tipo === 'intervalli'
    ? `<button class="btn sm" id="b-int-prev" style="width:100%">‹ Torna alla fase prima</button>
       <button class="btn sm ghost" id="b-int-reset" style="width:100%">Ricomincia da capo</button>`
    : (log.serie.length ? `<button class="btn sm ghost" id="b-annulla-serie" style="width:100%">Annulla ultim${ex.tipo === 'circuito' ? 'o giro' : 'a serie'}</button>` : '');
  const piede = `
  <div class="sotto">
    <div class="card">
      <label class="small muted" for="nota-es" style="font-weight:800">Nota per il coach (facoltativa)</label>
      <textarea id="nota-es" placeholder="Es. carico facile, nessun dolore, FC media 138…" style="min-height:64px;margin-top:6px">${esc(log.note)}</textarea>
    </div>
    <div class="stack">
      ${log.stato !== 'fatto' ? `<button class="btn" id="b-salta">${log.stato === 'saltato' ? 'Annulla salto' : 'Salta questo esercizio'}</button>` : ''}
      ${altri}
    </div>
  </div>`;
  return nav + testa + corpo + piede;
}

function cerchioSVG() {
  const r = 46, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 100 100"><defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset="1" stop-color="#ffb23d"/></linearGradient></defs>
    <circle cx="50" cy="50" r="${r}" fill="#1b1f2a" stroke="#2c3243" stroke-width="5"/>
    <circle id="ring" cx="50" cy="50" r="${r}" fill="none" stroke="url(#gr)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="0"/></svg>`;
}
function aggiornaCerchio(rest, durata) {
  const ring = $('#ring'); const tt = $('#ttime');
  if (tt) tt.textContent = fmt(Math.ceil(rest));
  if (ring) { const c = 2 * Math.PI * 46; ring.style.strokeDashoffset = String(c * (1 - rest / durata)); }
}

function vSerie(ex, ultimo) {
  const log = logEs(ex.id);
  const tot = serieTotali(ex);
  const fatte = log.serie.length;
  const chips = [];
  if (ex.tipo === 'circuito') chips.push(`<span class="chip"><b>${ex.giri}</b> giri</span>`);
  else chips.push(`<span class="chip"><b>${ex.serie}</b> × ${ex.lavoro_s ? fmtBreve(ex.lavoro_s) : esc(ex.ripetizioni || '?')}</span>`);
  if (ex.carico) chips.push(`<span class="chip">${esc(ex.carico)}</span>`);
  if (ex.rir != null) chips.push(`<span class="chip"><b>${esc(ex.rir)}</b> rip. in riserva</span>`);
  if (ex.rpe != null) chips.push(`<span class="chip">Fatica <b>${esc(ex.rpe)}</b>/10</span>`);
  if (ex.tempo) chips.push(`<span class="chip">Tempo ${esc(ex.tempo)}</span>`);
  if (ex.recupero_s) chips.push(`<span class="chip">Recupero <b>${fmtBreve(ex.recupero_s)}</b></span>`);
  const voci = ex.tipo === 'circuito' && ex.voci ? `<ul class="phases" style="margin:0 0 14px">${ex.voci.map((v) => `<li><span class="pc i-medio"></span>${esc(v.nome)}<span class="pd">${v.lavoro_s ? fmtBreve(v.lavoro_s) : esc(v.ripetizioni || '')}</span></li>`).join('')}</ul>` : '';
  const dots = Array.from({ length: tot }, (_, k) => `<div class="setdot ${k < fatte ? 'done' : k === fatte ? 'on' : ''}"></div>`).join('');
  const parola = ex.tipo === 'circuito' ? 'Giro' : 'Serie';

  let stato, tempo, hint, cls = 'tap';
  if (T.tipo === 'rec' && T.exId === ex.id) {
    stato = fatte >= tot ? 'Recupero' : `Recupero · poi ${parola.toLowerCase()} ${fatte + 1}`; tempo = fmt(Math.ceil(restante())); hint = 'Tocca per saltare';
  } else if (T.tipo === 'lavoro' && T.exId === ex.id) {
    stato = `${parola} ${fatte + 1} · lavoro`; tempo = fmt(Math.ceil(restante())); hint = 'Tieni duro';
  } else if (fatte >= tot) {
    stato = 'Completato ✓'; tempo = ultimo ? 'Fine' : 'Avanti'; hint = ultimo ? 'Tocca per chiudere la seduta' : 'Tocca per l\u2019esercizio successivo'; cls = 'tap ready next';
  } else {
    stato = `${parola} ${fatte + 1} di ${tot}`;
    tempo = ex.lavoro_s ? fmt(ex.lavoro_s) : 'Fatto';
    hint = ex.lavoro_s ? 'Tocca per partire' : (ex.recupero_s ? `Tocca a fine ${parola.toLowerCase()}: parte il recupero` : `Tocca a fine ${parola.toLowerCase()}`);
    cls += ' ready';
  }
  const tabella = ex.tipo === 'serie' && log.serie.length ? `
  <table class="setlog">
    <tr><th>#</th>${ex.lavoro_s ? '<th>Secondi</th>' : '<th>Rip.</th>'}<th>Carico</th>${ex.rir != null || ex.rpe != null ? `<th>${ex.rpe != null ? 'Fatica' : 'Riserva'}</th>` : ''}</tr>
    ${log.serie.map((v, k) => `<tr>
      <td class="sn">${k + 1}</td>
      ${ex.lavoro_s ? `<td><input inputmode="numeric" data-k="${k}" data-f="secondi" value="${esc(v.secondi)}"></td>` : `<td><input inputmode="numeric" data-k="${k}" data-f="rip" value="${esc(v.rip)}"></td>`}
      <td><input inputmode="decimal" data-k="${k}" data-f="carico" value="${esc(v.carico)}" placeholder="kg"></td>
      ${ex.rir != null || ex.rpe != null ? `<td><input inputmode="numeric" data-k="${k}" data-f="rir" value="${esc(v.rir)}"></td>` : ''}
    </tr>`).join('')}
  </table>
  ${ex.rir != null ? '<p class="small muted" style="margin:8px 0 0"><b>Riserva (RIR)</b>: quante ripetizioni avresti ancora potuto fare prima di non farcela più. RIR 3 = ti fermi quando ne avresti ancora 3.</p>' : ''}` : '';


  return `
  <div class="presc">${chips.join('')}</div>
  ${voci}
  <div class="sets">${dots}</div>
  <div class="bigtimer ${cls}" id="bigtimer" role="button" aria-label="Timer">
    ${cerchioSVG()}
    <div class="tlabel"><div class="tstate">${stato}</div><div class="ttime" id="ttime">${tempo}</div><div class="thint">${hint}</div></div>
  </div>
  ${tabella}`;
}

function vIntervalli(ex, ultimo) {
  const log = logEs(ex.id);
  const fasi = espandiFasi(ex.fasi);
  const st = intStato(ex);
  const idx = st ? st.idx : Math.min(log.fasi_completate || 0, fasi.length - 1);
  const finito = log.stato === 'fatto' && !st;
  const totale = fasi.reduce((a, f) => a + (f.durata_s || 0), 0);
  const f = fasi[idx];
  const prossima = fasi[idx + 1];
  const lista = fasi.map((x, k) => `<li class="${k < idx || finito ? 'past' : k === idx ? 'cur' : ''}"><span class="pc i-${x.intensita}"></span>${esc(x.nome)}${x.giro ? ` <span class="muted small">${esc(x.giro)}</span>` : ''}<span class="pd">${x.durata_s ? fmtBreve(x.durata_s) : (x.metri ? x.metri + ' m' : 'libera')}</span></li>`).join('');
  const running = st && !st.inPausa;
  let azione;
  if (finito) azione = ultimo ? 'Tocca per chiudere la seduta' : 'Tocca per l\u2019esercizio successivo';
  else if (!st) azione = log.fasi_completate ? 'Tocca per riprendere' : 'Tocca per partire';
  else if (st.inPausa) azione = 'In pausa · tocca per riprendere';
  else if (!f.durata_s) azione = 'Tocca quando hai finito questa fase';
  else azione = 'Tocca per mettere in pausa';
  return `
  <div class="presc"><span class="chip"><b>${fasi.length}</b> fasi</span>${totale ? `<span class="chip">Totale <b>${fmtBreve(totale)}</b></span>` : ''}</div>
  <div class="phasebox tap i-${finito ? 'facile' : f.intensita}" id="phasebox" role="button">
    <div class="pinfo" id="pinfo">${finito ? 'Completato' : `Fase ${idx + 1} di ${fasi.length}${f.giro ? ' · ' + esc(f.giro) : ''}`}</div>
    <div class="pname" id="pname">${finito ? 'Fatto!' : esc(f.nome)}</div>
    <div class="ptime" id="ptime">${finito ? fmt(log.tempo_s || 0) : f.durata_s ? fmt(f.durata_s) : (f.metri ? f.metri + ' m' : '0:00')}</div>
    <div class="paz">${azione}</div>
    <div class="pinfo" id="pnext">${finito ? '' : (f.note ? esc(f.note) + ' · ' : '') + (!f.durata_s ? 'Fase libera' : (prossima ? `Poi: ${esc(prossima.nome)} ${prossima.durata_s ? fmtBreve(prossima.durata_s) : ''}` : 'Ultima fase'))}</div>
  </div>
  <div class="progress"><div id="pbar" style="width:${finito ? 100 : Math.round((idx / fasi.length) * 100)}%"></div></div>
  ${finito ? '' : `<div class="row" style="margin-bottom:12px">
    <button class="btn" id="b-int-next">Salta fase ›</button>
    <button class="btn" id="b-termina" style="color:var(--bad)">Termina allenamento</button>
  </div>`}
  <ul class="phases">${lista}</ul>`;
}
function aggiornaIntervalli() {
  if (T.tipo !== 'int') return;
  const f = T.fasi[T.idx], el = intElapsed();
  const pt = $('#ptime'); if (!pt) return;
  pt.textContent = f.durata_s ? fmt(Math.ceil(f.durata_s - el)) : fmt(el);
  const bar = $('#pbar');
  if (bar) { const frac = f.durata_s ? Math.min(1, el / f.durata_s) : 0; bar.style.width = Math.round(((T.idx + frac) / T.fasi.length) * 100) + '%'; }
}

function vFine() {
  const s = sedutaAttiva();
  if (!s) return vFisico();
  const domande = Array.isArray(s.domande) && s.domande.length ? s.domande : DOMANDE_DEFAULT;
  const r = S.corrente.risposte;
  const qs = domande.map((d) => {
    const v = r[d.id];
    if (d.tipo === 'scala') {
      const min = d.min ?? 1, max = d.max ?? 10;
      const n = max - min + 1;
      const btn = Array.from({ length: n }, (_, k) => min + k).map((x) => `<button type="button" data-q="${esc(d.id)}" data-v="${x}" class="${v === x ? 'sel' : ''}">${x}</button>`).join('');
      return `<div class="q"><label class="ql">${esc(d.testo)}</label><div class="scale" style="grid-template-columns:repeat(${n <= 6 ? n : Math.ceil(n / 2)},1fr)">${btn}</div>
      ${d.etichette ? `<div class="scale-ends"><span>${esc(d.etichette[0] || '')}</span><span>${esc(d.etichette[1] || '')}</span></div>` : ''}</div>`;
    }
    if (d.tipo === 'scelta') {
      return `<div class="q"><label class="ql">${esc(d.testo)}</label><div class="scale" style="grid-template-columns:repeat(${Math.min((d.opzioni || []).length, 3)},1fr)">${(d.opzioni || []).map((o) => `<button type="button" data-q="${esc(d.id)}" data-v="${esc(o)}" class="${v === o ? 'sel' : ''}">${esc(o)}</button>`).join('')}</div></div>`;
    }
    if (d.tipo === 'numero') {
      return `<div class="q"><label class="ql" for="q-${esc(d.id)}">${esc(d.testo)}</label><input class="input" id="q-${esc(d.id)}" data-qi="${esc(d.id)}" inputmode="decimal" value="${esc(v ?? '')}" placeholder="${esc(d.unita || '')}"></div>`;
    }
    return `<div class="q"><label class="ql" for="q-${esc(d.id)}">${esc(d.testo)}</label><textarea id="q-${esc(d.id)}" data-qi="${esc(d.id)}" style="min-height:70px">${esc(v ?? '')}</textarea></div>`;
  }).join('');
  const nonFatti = s.esercizi.filter((e) => ((S.corrente.esercizi[e.id] || {}).stato || 'da_fare') !== 'fatto').length;
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}<a class="back" href="#/seduta">‹ Seduta</a></span><span class="pill" id="clock-seduta">0:00</span></div>
  <div class="eyebrow">Fine seduta</div>
  <h1>Com'è andata?</h1>
  ${nonFatti ? `<div class="note">${nonFatti} esercizi${nonFatti === 1 ? 'o' : ''} non completat${nonFatti === 1 ? 'o' : 'i'}: verranno segnalati al coach.</div>` : ''}
  <div class="card">${qs}
    <div class="q" style="margin-bottom:0"><label class="ql" for="q-note">Altro da dire al coach?</label><textarea id="q-note" placeholder="Facoltativo">${esc(S.corrente.noteFinali)}</textarea></div>
  </div>
  <button class="btn ok" id="b-conferma">Conferma seduta eseguita</button>`;
}

function costruisciEsito() {
  const s = sedutaAttiva(); const c = S.corrente;
  const domande = Array.isArray(s.domande) && s.domande.length ? s.domande : DOMANDE_DEFAULT;
  const fine = new Date();
  return {
    formato: FORMATO_ESITO,
    app_versione: APP_VERSIONE,
    seduta_id: s.id,
    titolo: s.titolo,
    tipo: s.tipo || null,
    data_prevista: s.data || null,
    inizio: c.inizio,
    fine: fine.toISOString(),
    durata_min: Math.round((fine - new Date(c.inizio)) / 60000),
    esercizi: s.esercizi.map((ex) => {
      const l = c.esercizi[ex.id] || { stato: 'da_fare', serie: [] };
      const o = { id: ex.id, nome: ex.nome, tipo: ex.tipo, stato: l.stato === 'in_corso' ? 'parziale' : l.stato === 'da_fare' ? 'non_fatto' : l.stato };
      if (ex.tipo === 'intervalli') {
        o.fasi_totali = espandiFasi(ex.fasi).length; o.fasi_completate = l.fasi_completate || 0; o.tempo_s = l.tempo_s || 0;
      } else if (ex.tipo === 'circuito') {
        o.prescritto = { giri: ex.giri }; o.giri_fatti = (l.serie || []).length;
      } else {
        o.prescritto = { serie: ex.serie, ripetizioni: ex.ripetizioni ?? null, lavoro_s: ex.lavoro_s ?? null, carico: ex.carico ?? null, rir: ex.rir ?? null, rpe: ex.rpe ?? null, recupero_s: ex.recupero_s ?? null };
        o.serie_eseguite = (l.serie || []).map((v) => { const x = { n: v.n }; ['rip', 'secondi', 'carico', 'rir'].forEach((k) => { if (v[k] !== undefined && v[k] !== '') x[k] = isNaN(Number(v[k])) ? v[k] : Number(v[k]); }); return x; });
      }
      if (l.note) o.note = l.note;
      return o;
    }),
    risposte: domande.map((d) => ({ id: d.id, domanda: d.testo, valore: c.risposte[d.id] ?? null })),
    note_finali: c.noteFinali || ''
  };
}

function testoPerCoach(esito) {
  return `ESITO SEDUTA dall'app Mr. 9 Training\n` +
    `Seduta: ${esito.titolo} (${dataIt(esito.inizio)}, ${esito.durata_min} min)\n` +
    `Analizza l'esito, adatta le prossime sedute e rispondimi con la prossima seduta in formato JSON ${FORMATO_SCHEDA}.\n\n` +
    '```json\n' + JSON.stringify(esito, null, 2) + '\n```';
}

function vEsito(i) {
  const e = S.storico[parseInt(i, 10)];
  if (!e) return vFisico();
  const testo = testoPerCoach(e.esito);
  const share = !!navigator.share;
  if (collegato()) {
    return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}<a class="back" href="#/fisico">‹ Fisico</a></span></div>
  <div class="eyebrow">Seduta confermata ✓</div>
  <h1>${e.inviato ? 'Esito inviato al coach' : 'Invio al coach…'}</h1>
  <div class="card">
    ${e.inviato
      ? '<p style="margin:0">Il coach lo legge al prossimo controllo e prepara la seduta successiva, che comparirà da sola nella pagina Fisico.</p>'
      : `<p style="margin:0">Non sono ancora riuscito a inviarlo${S.sync && S.sync.errore ? ' (' + esc(S.sync.errore) + ')' : ''}. Riprovo da solo appena c\u2019è connessione.</p><button class="btn" id="b-reinvia" style="margin-top:12px">Riprova adesso</button>`}
  </div>
  <details style="margin-top:14px"><summary>Vedi l'esito</summary><textarea class="code" readonly id="t-esito">${esc(testo)}</textarea></details>
  <a class="btn primary" href="#/fisico" style="margin-top:14px">Fatto</a>`;
  }
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}<a class="back" href="#/fisico">‹ Fisico</a></span></div>
  <div class="eyebrow">Seduta confermata ✓</div>
  <h1>Invia l'esito al coach</h1>
  <p class="muted">Mandalo nella chat del coach: ti risponderà con la prossima seduta, che poi carichi qui.</p>
  <div class="stack">
    ${share ? '<button class="btn primary" id="b-share">Condividi con Claude</button>' : ''}
    <button class="btn ${share ? '' : 'primary'}" id="b-copia">Copia il testo</button>
    <button class="btn ghost" id="b-file">Scarica come file</button>
  </div>
  <details style="margin-top:14px"><summary>Vedi il testo</summary><textarea class="code" readonly id="t-esito">${esc(testo)}</textarea></details>
  <a class="btn" href="#/carica" style="margin-top:14px">Ho la nuova seduta: caricala</a>`;
}

function vCarica() {
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}<a class="back" href="#/fisico">‹ Fisico</a></span></div>
  <div class="eyebrow">Dal coach</div>
  <h1>Carica la seduta</h1>
  <p class="muted">Incolla qui la risposta del coach (anche tutto il messaggio: l'app trova da sola il blocco JSON), oppure scegli un file .json.</p>
  <textarea class="code" id="t-scheda" placeholder='{ "formato": "mr9-scheda-v1", "sedute": [ … ] }'></textarea>
  <div class="row" style="margin-top:10px">
    <button class="btn" id="b-incolla">Incolla</button>
    <label class="btn" style="cursor:pointer">File…<input type="file" id="f-scheda" accept="application/json,.json,.txt" hidden></label>
  </div>
  <div class="note" id="err-carica" hidden style="border-color:var(--bad);margin-top:10px"></div>
  <button class="btn primary" id="b-carica" style="margin-top:10px">Carica</button>
  <p class="small muted" style="margin-top:10px">Le sedute caricate sostituiscono quelle in attesa. Vedrai solo la prossima: le altre compaiono una alla volta, dopo ogni conferma.</p>
  <details style="margin-top:22px"><summary>Opzioni</summary>
    <div class="stack" style="margin-top:8px">
      <button class="btn" id="b-esempio">Carica una scheda di esempio</button>
      <button class="btn ghost" id="b-reset" style="color:var(--bad)">Cancella tutti i dati dell'app</button>
    </div>
  </details>`;
}

function vStorico() {
  const righe = S.storico.slice().reverse().map((h, k) => {
    const i = S.storico.length - 1 - k;
    const e = h.esito;
    const fatti = e.esercizi.filter((x) => x.stato === 'fatto').length;
    return `<a class="card hist" href="#/esito/${i}" style="display:flex">
      <div><b>${esc(e.titolo)}</b><div class="small muted">${esc(dataIt(e.inizio))} · ${e.durata_min} min · ${fatti}/${e.esercizi.length} esercizi</div></div>
      <span class="pill ${h.inviato ? 'ok' : 'warn'}">${h.inviato ? 'Inviato' : 'Da inviare'}</span></a>`;
  }).join('');
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}<a class="back" href="#/fisico">‹ Fisico</a></span></div>
  <div class="eyebrow">Allenamento fisico</div>
  <h1>Storico</h1>
  ${righe || '<div class="card empty"><p class="muted">Ancora nessuna seduta confermata.</p></div>'}`;
}

function vPresto(cls, titolo, testo) {
  return `
  <div class="soonhero ${cls}"><div class="eyebrow" style="color:rgba(13,15,20,.7)">In arrivo</div><h1>${esc(titolo)}</h1><div style="font-weight:700">${esc(testo)}</div></div>
  <div class="card"><p class="muted" style="margin:0">Questa sezione è pronta ma ancora vuota. La attiviamo quando la sezione Allenamento fisico sarà rodata.</p></div>`;
}

/* ---------- collegamento eventi ---------- */
function collega(pag, parti) {
  const on = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('click', fn); };
  on('b-inizia', iniziaSeduta);

  if (pag === 'es') {
    const s = sedutaAttiva(); if (!s) return;
    const i = parseInt(parti[1], 10) || 0; const ex = s.esercizi[i]; if (!ex) return;
    const log = logEs(ex.id);
    if (ex.tipo === 'intervalli') {
      on('phasebox', () => {
        audio();
        if (log.stato === 'fatto' && !intAttivo(ex.id)) { location.hash = prossimoDa(i); return; }
        if (!intAttivo(ex.id) || T.inPausa) { intAvvia(ex); render(); return; }
        if (!T.fasi[T.idx].durata_s) { intAvanti(ex, false); return; }
        intPausa(); render();
      });
      on('b-int-next', () => { if (!intAttivo(ex.id)) intAvvia(ex); intAvanti(ex, false); });
      on('b-int-prev', intIndietro);
      on('b-termina', (ev) => {
        const b = ev.currentTarget;
        if (!b.dataset.armato) { b.dataset.armato = '1'; b.textContent = 'Tocca di nuovo per terminare'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armato; b.textContent = 'Termina allenamento'; } }, 4000); return; }
        if (intAttivo(ex.id)) { log.tempo_s = Math.round((Date.now() - T.inizioTot) / 1000); }
        if (log.stato !== 'fatto') log.stato = (log.fasi_completate || 0) > 0 || intAttivo(ex.id) ? 'in_corso' : 'da_fare';
        fermaTimer(); salva(); location.hash = '#/fine';
      });
      on('b-int-reset', () => { log.fasi_completate = 0; log.tempo_s = 0; log.stato = 'in_corso'; fermaTimer(); salva(); render(); });
    } else {
      on('bigtimer', () => {
        if (log.serie.length >= serieTotali(ex) && !(T.tipo && T.exId === ex.id)) { location.hash = prossimoDa(i); return; }
        tapSerie(ex);
      });
      on('b-annulla-serie', () => { log.serie.pop(); log.stato = log.serie.length ? 'in_corso' : 'da_fare'; if (T.exId === ex.id) fermaTimer(); salva(); render(); });
      document.querySelectorAll('.setlog input').forEach((inp) => inp.addEventListener('change', () => {
        const k = +inp.dataset.k; const f = inp.dataset.f; log.serie[k][f] = inp.value.trim();
        // propaga il carico alle serie successive ancora uguali al vecchio valore
        salva();
      }));
    }
    on('b-salta', () => { log.stato = log.stato === 'saltato' ? (log.serie.length ? 'in_corso' : 'da_fare') : 'saltato'; if (T.exId === ex.id) fermaTimer(); salva(); render(); });
    const nota = $('#nota-es'); if (nota) nota.addEventListener('input', () => { log.note = nota.value; salva(); });
  }

  if (pag === 'fine') {
    document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.q; const raw = b.dataset.v; const num = Number(raw);
      S.corrente.risposte[id] = isNaN(num) ? raw : num; salva();
      b.parentNode.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
    }));
    document.querySelectorAll('[data-qi]').forEach((inp) => inp.addEventListener('input', () => { S.corrente.risposte[inp.dataset.qi] = inp.value; salva(); }));
    const n = $('#q-note'); if (n) n.addEventListener('input', () => { S.corrente.noteFinali = n.value; salva(); });
    on('b-conferma', () => {
      const s = sedutaAttiva();
      const domande = Array.isArray(s.domande) && s.domande.length ? s.domande : DOMANDE_DEFAULT;
      const manca = domande.find((d) => !d.facoltativa && d.tipo !== 'testo' && (S.corrente.risposte[d.id] == null || S.corrente.risposte[d.id] === ''));
      if (manca) { toast('Rispondi a: ' + manca.testo); return; }
      const esito = costruisciEsito();
      S.storico.push({ esito, inviato: false });
      S.coda.shift(); S.corrente = null; S.noteCoach = '';
      fermaTimer(); schermoAcceso(false); salva();
      location.hash = '#/esito/' + (S.storico.length - 1);
      sincronizza(true);
    });
  }

  on('b-sync', () => { toast('Controllo…'); sincronizza(true); });
  on('b-sync2', () => { toast('Controllo…'); sincronizza(true); });
  on('b-reinvia', () => sincronizza(true));
  if (pag === 'fisico' || pag === '') sincronizza();

  if (pag === 'collega') {
    on('b-g-salva', async () => {
      const box = $('#g-esito');
      const g = { owner: $('#g-owner').value.trim(), repo: $('#g-repo').value.trim(), token: $('#g-token').value.trim(), branch: $('#g-branch').value.trim() || 'main' };
      const mostra = (t, ok) => { box.hidden = false; box.textContent = t; box.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)'; };
      if (!g.owner || !g.repo || !g.token) { mostra('Compila tutti e tre i campi.', false); return; }
      const vecchio = S.github; S.github = g;
      try {
        const r = await gh('');
        if (r.status === 401) throw new Error('Token non valido o scaduto.');
        if (r.status === 404) throw new Error('Repository non trovato, oppure il token non ha accesso a questo repository.');
        if (!r.ok) throw new Error('GitHub ha risposto ' + r.status + '.');
        const info = await r.json();
        if (info.permissions && !info.permissions.push) throw new Error('Il token può leggere ma non scrivere: serve Contents “Read and write”.');
        salva(); mostra('Collegato ✓ Cerco le sedute del coach…', true);
        await sincronizza(true);
        toast('Collegato al coach'); location.hash = '#/fisico';
      } catch (e) { S.github = vecchio; salva(); mostra(String(e.message || e), false); }
    });
    on('b-g-scollega', () => { S.github = null; S.sync = null; salva(); toast('Scollegato'); location.hash = '#/fisico'; });
  }

  if (pag === 'esito') {
    const i = parseInt(parti[1], 10); const h = S.storico[i]; if (!h) return;
    const testo = testoPerCoach(h.esito);
    const segna = () => { h.inviato = true; salva(); };
    on('b-share', async () => { try { await navigator.share({ title: 'Esito seduta', text: testo }); segna(); toast('Condiviso'); } catch (e) { /* annullato */ } });
    on('b-copia', async () => {
      try { await navigator.clipboard.writeText(testo); segna(); toast('Copiato: incollalo nella chat del coach'); }
      catch (e) { const t = $('#t-esito'); t.closest('details').open = true; t.select(); toast('Seleziona e copia il testo'); }
    });
    on('b-file', () => {
      const blob = new Blob([JSON.stringify(h.esito, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `esito-${h.esito.seduta_id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); segna();
    });
  }

  if (pag === 'carica') {
    const ta = $('#t-scheda');
    on('b-incolla', async () => { try { ta.value = await navigator.clipboard.readText(); } catch (e) { toast('Tieni premuto nel riquadro e scegli Incolla'); ta.focus(); } });
    const f = $('#f-scheda'); if (f) f.addEventListener('change', async () => { if (f.files[0]) ta.value = await f.files[0].text(); });
    on('b-carica', (ev) => caricaTesto(ta.value, ev.currentTarget));
    on('b-esempio', async () => {
      try { const r = await fetch('esempi/scheda-esempio.json', { cache: 'no-store' }); ta.value = await r.text(); toast('Esempio pronto: tocca Carica'); }
      catch (e) { toast('Esempio non disponibile offline'); }
    });
    on('b-reset', (ev) => {
      const b = ev.currentTarget;
      if (!b.dataset.armato) { b.dataset.armato = '1'; b.textContent = 'Tocca di nuovo per cancellare tutto'; return; }
      S = { coda: [], storico: [], corrente: null, noteCoach: '' }; fermaTimer(); salva(); toast('Dati cancellati'); location.hash = '#/fisico';
    });
  }
}

function caricaTesto(testo, bottone) {
  const err = $('#err-carica');
  try {
    const { sedute, note } = validaScheda(estraiJSON(testo));
    if (S.corrente && bottone && !bottone.dataset.armato) {
      bottone.dataset.armato = '1';
      bottone.textContent = 'C\u2019è una seduta in corso: tocca di nuovo per sostituirla';
      return;
    }
    S.coda = sedute; S.corrente = null; S.noteCoach = note; fermaTimer(); salva();
    toast(sedute.length === 1 ? 'Seduta caricata' : `${sedute.length} sedute caricate`);
    location.hash = '#/fisico';
  } catch (e) {
    const msg = 'Non riesco a leggere la scheda. ' + (e.message || e);
    if (err) { err.textContent = msg; err.hidden = false; } else toast(msg);
  }
}

/* ---------- collegamento con il coach (repo dati su GitHub) ---------- */
// Struttura del repository privato apnea-training-database (branch main):
//   fisico/coda.json            scritto dal coach: scheda mr9-scheda-v1 con le prossime sedute
//   fisico/esiti/<data>_<id>.json  scritto dall'app: un esito mr9-esito-v1 per seduta confermata
const DATI = { coda: 'fisico/coda.json', esiti: 'fisico/esiti' };
const collegato = () => !!(S.github && S.github.token && S.github.owner && S.github.repo);
function nomeEsito(e) { return `${(e.inizio || new Date().toISOString()).slice(0, 10)}_${e.seduta_id}.json`; }
function b64utf8(str) { const by = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < by.length; i++) bin += String.fromCharCode(by[i]); return btoa(bin); }
async function gh(percorso, opt = {}) {
  const g = S.github;
  const url = `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}${percorso}`;
  const r = await fetch(url, Object.assign({ cache: 'no-store' }, opt, {
    headers: Object.assign({ Authorization: `Bearer ${g.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.headers || {})
  }));
  return r;
}
async function leggiRemoto(path) {
  const r = await gh(`/contents/${path}?ref=${encodeURIComponent(S.github.branch || 'main')}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.text();
}
async function elencoRemoto(path) {
  const r = await gh(`/contents/${path}?ref=${encodeURIComponent(S.github.branch || 'main')}`);
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const j = await r.json(); return Array.isArray(j) ? j.map((x) => x.name) : [];
}
async function scriviRemoto(path, testo, messaggio) {
  const body = { message: messaggio, content: b64utf8(testo), branch: S.github.branch || 'main' };
  let r = await gh(`/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
  if (r.status === 422 || r.status === 409) { // esiste già: serve lo sha
    const g = await gh(`/contents/${path}?ref=${encodeURIComponent(body.branch)}`);
    if (g.ok) { body.sha = (await g.json()).sha; r = await gh(`/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) }); }
  }
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
}
async function inviaEsito(h) {
  if (!collegato() || h.inviato) return false;
  await scriviRemoto(`${DATI.esiti}/${nomeEsito(h.esito)}`, JSON.stringify(h.esito, null, 2) + '\n', `Esito: ${h.esito.titolo}`);
  h.inviato = true; h.inviatoVia = 'github'; salva(); return true;
}
let syncInCorso = null, ultimoSync = 0;
function sincronizza(forza) {
  if (!collegato()) return Promise.resolve();
  if (syncInCorso) return syncInCorso;
  if (!forza && Date.now() - ultimoSync < 30000) return Promise.resolve();
  syncInCorso = (async () => {
    try {
      for (const h of S.storico) { if (!h.inviato) await inviaEsito(h); }
      const fatti = new Set(S.storico.map((h) => h.esito.seduta_id));
      (await elencoRemoto(DATI.esiti)).forEach((n) => { const k = n.indexOf('_'); if (k > 0) fatti.add(n.slice(k + 1).replace(/\.json$/, '')); });
      const testo = await leggiRemoto(DATI.coda);
      if (testo) {
        const { sedute, note } = validaScheda(JSON.parse(testo));
        let nuove = sedute.filter((x) => !fatti.has(x.id));
        if (S.corrente) { // la seduta in corso non si tocca
          const att = S.coda.find((x) => x.id === S.corrente.sedutaId);
          nuove = nuove.filter((x) => x.id !== S.corrente.sedutaId);
          if (att) nuove.unshift(att);
        }
        const prima = (S.coda[0] || {}).id;
        S.coda = nuove; S.noteCoach = note;
        if (!S.corrente && S.coda[0] && S.coda[0].id !== prima) toast('Nuova seduta dal coach');
      }
      S.sync = { ultimo: new Date().toISOString(), errore: '' };
    } catch (e) {
      S.sync = { ultimo: (S.sync || {}).ultimo || null, errore: String(e.message || e) };
    } finally {
      ultimoSync = Date.now(); syncInCorso = null; salva();
      const pag = (location.hash || '#/').slice(2).split('/')[0];
      if (['', 'fisico', 'esito', 'storico', 'collega'].includes(pag)) render();
    }
  })();
  return syncInCorso;
}
// Accesso al repository dati per le altre sezioni (es. Alimentazione): stesso token, stesso repo privato.
window.Mr9Dati = {
  collegato,
  leggi: async (path) => (collegato() ? leggiRemoto(path) : null), // null se manca il file o il collegamento
  elenco: (path) => elencoRemoto(path),
  scrivi: (path, testo, messaggio) => scriviRemoto(path, testo, messaggio || `Aggiorna ${path}`)
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizza(); });
window.addEventListener('online', () => sincronizza(true));
function statoSync() {
  if (!collegato()) return '';
  const u = S.sync && S.sync.ultimo ? new Date(S.sync.ultimo).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null;
  if (S.sync && S.sync.errore) return `Coach non raggiungibile (${esc(S.sync.errore)})`;
  return u ? `Collegato al coach · aggiornato alle ${u}` : 'Collegato al coach';
}

function vCollega() {
  const g = S.github || {};
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}<a class="back" href="#/fisico">‹ Fisico</a></span></div>
  <div class="eyebrow">Una volta sola</div>
  <h1>Collega il coach</h1>
  <p class="muted">L'app legge le sedute che il coach scrive nel repository privato dei dati su GitHub e ci salva gli esiti. Il token resta solo su questo telefono.</p>
  <div class="card stack">
    <label class="small muted" for="g-owner" style="font-weight:800">Proprietario</label>
    <input class="input" id="g-owner" value="${esc(g.owner || 'procuremindconsulting-ux')}" autocapitalize="off" autocorrect="off">
    <label class="small muted" for="g-repo" style="font-weight:800">Repository dati (privato)</label>
    <input class="input" id="g-repo" value="${esc(g.repo || 'apnea-training-database')}" autocapitalize="off" autocorrect="off">
    <label class="small muted" for="g-token" style="font-weight:800">Token GitHub</label>
    <label class="small muted" for="g-branch" style="font-weight:800">Branch</label>
    <input class="input" id="g-branch" value="${esc(g.branch || 'main')}" autocapitalize="off" autocorrect="off">
    <input class="input" id="g-token" type="password" value="${esc(g.token || '')}" placeholder="github_pat_…" autocapitalize="off" autocorrect="off">
  </div>
  <div class="note" id="g-esito" hidden></div>
  <button class="btn primary" id="b-g-salva">Salva e prova</button>
  ${collegato() ? '<button class="btn ghost" id="b-g-scollega" style="margin-top:10px;color:var(--bad)">Scollega</button>' : ''}
  <details style="margin-top:18px"><summary>Come si crea il token</summary>
    <ol class="small" style="padding-left:18px;line-height:1.6">
      <li>Su github.com: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li>
      <li>Repository access: <b>Only select repositories</b> → scegli <b>apnea-training-database</b> (solo quello).</li>
      <li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Nient'altro.</li>
      <li>Scadenza: 1 anno. Copia il token e incollalo qui sopra.</li>
    </ol>
  </details>
  <details style="margin-top:6px"><summary>Caricare una scheda a mano</summary>
    <a class="btn" href="#/carica" style="margin-top:8px">Carica scheda a mano</a>
  </details>`;
}

/* ---------- avvio ---------- */
// Service worker, manifest e icone sono gestiti da pwa/pwa.js (installazione a schermo intero).
// Apertura da link con scheda allegata: …/#carica=<base64url del JSON>
(function () {
  const m = location.hash.match(/^#carica=(.+)$/);
  if (m) {
    try {
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const txt = decodeURIComponent(escape(atob(b64)));
      history.replaceState(null, '', location.pathname + '#/fisico');
      caricaTesto(txt);
    } catch (e) { history.replaceState(null, '', location.pathname + '#/carica'); }
  }
})();
if (S.corrente) schermoAcceso(true);
render();
sincronizza(true);
