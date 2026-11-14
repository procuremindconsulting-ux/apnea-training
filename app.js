/* Mr. 9 Training – web app di allenamento.
   Nessuna dipendenza esterna: tutto vive nel browser (localStorage). */
'use strict';

const APP_VERSIONE = '0.1.0';
const KEY = 'mr9.stato.v1';
const KEY_GITHUB = 'mr9.collegamento.v1'; // copia separata del collegamento: sopravvive a reset e stati rovinati
const FORMATO_SCHEDA = 'mr9-scheda-v1';
const FORMATO_ESITO = 'mr9-esito-v1';

const DOMANDE_DEFAULT = [
  { id: 'sensazioni', testo: 'Come ti sei sentito?', tipo: 'scala', min: 1, max: 5, etichette: ['Molto male', 'Benissimo'] },
  { id: 'impegno', testo: 'Quanto è stata dura? (impegno percepito)', tipo: 'scala', min: 1, max: 10, etichette: ['Facilissima', 'Massimale'] },
  { id: 'dolori', testo: 'Dolori o fastidi? Dove e quanto?', tipo: 'testo', facoltativa: true }
];

const HOME_BTN = '<a class="homebtn" href="#/" aria-label="Home"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></a>';

const INTENSITA = ['facile', 'recupero', 'medio', 'forte', 'massimale', 'respiro', 'apnea'];

/* Apnea (Dave): domande di fine seduta e controlli di sicurezza predefiniti. */
const DOMANDE_APNEA = [
  { id: 'sforzo', testo: 'Sforzo massimo raggiunto (scala 0-10)', tipo: 'scala', min: 0, max: 10, etichette: ['Nessuno', 'Quasi scappando'] },
  { id: 'sensazioni', testo: 'Come ti sei sentito?', tipo: 'scala', min: 1, max: 5, etichette: ['Molto male', 'Benissimo'] },
  { id: 'regolare', testo: 'Tutto regolare? Niente samba, niente malesseri', tipo: 'scelta', opzioni: ['Sì', 'No'] },
  { id: 'note_apnea', testo: 'Contrazioni, sintomi, testa: cosa hai notato?', tipo: 'testo', facoltativa: true }
];
const SICUREZZA_APNEA = [
  'Il compagno è in acqua con te, pronto, e sa che seduta fai',
  'Stai bene: nessun malessere, nessun sintomo strano dopo le ultime apnee',
  'Niente iperventilazione prima delle apnee'
];
const DOMANDE_MENTALE = [
  { id: 'calma', testo: 'Quanto ti senti calmo adesso?', tipo: 'scala', min: 1, max: 10, etichette: ['Agitato', 'Calmissimo'] },
  { id: 'concentrazione', testo: 'Quanto sei rimasto concentrato?', tipo: 'scala', min: 1, max: 10, etichette: ['Per niente', 'Sempre'] },
  { id: 'traccia', testo: 'Ti è piaciuto il sottofondo?', tipo: 'scelta', opzioni: ['Sì', 'Così così', 'No'] },
  { id: 'note', testo: 'Note per Gus', tipo: 'testo', facoltativa: true }
];
// Tutte le sedute arrivano da fisico/coda.json: la pagina dove compaiono dipende dal tipo.
const SEZIONI = { fisico: 'Fisico', apnea: 'Apnea', mentale: 'Mentale' };
const sezTipo = (t) => (t === 'apnea' || t === 'mentale' ? t : 'fisico');
const sezDi = (s) => (s && (s._sez || sezTipo(s.tipo))) || 'fisico';
const sezEsito = (e) => (e && (e.sezione || sezTipo(e.tipo))) || 'fisico';
const domandeDi = (s) => (Array.isArray(s.domande) && s.domande.length ? s.domande : ({ apnea: DOMANDE_APNEA, mentale: DOMANDE_MENTALE }[sezDi(s)] || DOMANDE_DEFAULT));

/* ---------- stato ---------- */
let S = carica();
function carica() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return Object.assign({ coda: [], storico: [], corrente: null, noteCoach: '', voce: true }, s);
    }
  } catch (e) { /* storage non disponibile */ }
  return { coda: [], storico: [], corrente: null, noteCoach: '', voce: true };
}
function salva() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Impossibile salvare sul dispositivo'); }
  try { if (S.github && S.github.token) localStorage.setItem(KEY_GITHUB, JSON.stringify(S.github)); } catch (e) {}
}
// Se lo stato non ha il collegamento ma la copia sì, lo riprende.
try { if (!(S.github && S.github.token)) { const g = JSON.parse(localStorage.getItem(KEY_GITHUB) || 'null'); if (g && g.token) S.github = g; } } catch (e) {}
// Chiede al browser di non cancellare da solo i dati dell'app quando lo spazio scarseggia.
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

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
const sedutaCorrente = (sez = 'fisico') => S.coda.find((s) => sezDi(s) === sez) || null;
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
// Voce (italiano) per le tabelle di apnea: il telefono resta sul bordo vasca, non serve guardarlo.
function parla(testo) {
  if (!S.voce) return;
  try {
    const ss = window.speechSynthesis; if (!ss) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(testo); u.lang = 'it-IT'; u.rate = 1.05; u.volume = 1;
    ss.speak(u);
  } catch (e) {}
}
// Voce guida delle sedute mentali (Gus): legge il testo "guida" frase per frase, abbassando la musica mentre parla.
let vocItaliana = null;
function vocIt() {
  try { if (!vocItaliana) vocItaliana = (speechSynthesis.getVoices() || []).find((v) => /^it/i.test(v.lang)) || null; } catch (e) {}
  return vocItaliana;
}
try { speechSynthesis.addEventListener('voiceschanged', () => { vocItaliana = null; vocIt(); }); } catch (e) {}
function parlaGuida(testo) {
  if (!S.voce || !testo) return;
  try {
    const ss = window.speechSynthesis; if (!ss) return;
    ss.cancel();
    const frasi = String(testo).split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
    frasi.forEach((fr, k) => {
      const u = new SpeechSynthesisUtterance(fr.replace(/…/g, ', ')); u.lang = 'it-IT'; u.rate = 0.9; u.pitch = 0.95;
      const v = vocIt(); if (v) u.voice = v;
      if (k === 0) u.onstart = () => sottofondoVolume(35);
      if (k === frasi.length - 1) { u.onend = () => sottofondoVolume(80); u.onerror = () => sottofondoVolume(80); }
      ss.speak(u);
    });
  } catch (e) {}
}

// Sottofondo da YouTube (sedute mentali): un piccolo player fisso fuori da #app, così non si
// ricarica a ogni cambio di fase. Parte con il timer, si ferma in pausa e a fine seduta.
const YT_S = { player: null, id: null, pronto: false, box: null };
function ytId(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
let ytApi = null;
function caricaYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!ytApi) ytApi = new Promise((ok) => {
    const prima = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prima) try { prima(); } catch (e) {} ok(); };
    const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true;
    sc.onerror = () => { ytApi = null; };
    document.head.appendChild(sc);
  });
  return ytApi;
}
function sottofondoPrepara(s, visibile) {
  const id = s && s.sottofondo && ytId(s.sottofondo.url);
  if (!id) { sottofondoChiudi(); return; }
  if (!YT_S.box) {
    YT_S.box = document.createElement('div'); YT_S.box.id = 'sottofondo'; YT_S.box.className = 'ytbox';
    YT_S.box.innerHTML = '<div class="ytt"></div><div id="yt-player"></div>';
    document.body.appendChild(YT_S.box);
  }
  YT_S.box.querySelector('.ytt').textContent = '🎧 ' + (s.sottofondo.titolo || 'Sottofondo');
  YT_S.box.hidden = !visibile;
  document.body.classList.toggle('has-yt', !!visibile);
  if (YT_S.id === id) return;
  YT_S.id = id; YT_S.pronto = false;
  caricaYT().then(() => {
    if (YT_S.id !== id) return;
    YT_S.player = new YT.Player('yt-player', {
      videoId: id, width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1 },
      events: { onReady: () => { YT_S.pronto = true; sottofondoVolume(80); if (T.tipo === 'int' && !T.inPausa) sottofondoPlay(); } }
    });
  }).catch(() => {});
}
function sottofondoPlay() { try { if (YT_S.pronto) YT_S.player.playVideo(); } catch (e) {} }
function sottofondoPausa() { try { if (YT_S.pronto) YT_S.player.pauseVideo(); } catch (e) {} }
function sottofondoVolume(v) { try { if (YT_S.pronto) YT_S.player.setVolume(v); } catch (e) {} }
function sottofondoChiudi() {
  try { if (YT_S.player) YT_S.player.destroy(); } catch (e) {}
  if (YT_S.box) YT_S.box.remove();
  Object.assign(YT_S, { player: null, id: null, pronto: false, box: null });
  document.body.classList.remove('has-yt');
}
function fraseTempo(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  const mm = m ? (m === 1 ? 'un minuto' : `${m} minuti`) : '';
  return mm && s ? `${mm} e ${s}` : (mm || `${s} secondi`);
}
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
      if (!['serie', 'intervalli', 'circuito', 'apnee'].includes(e.tipo)) throw new Error(`"${e.nome}": tipo "${e.tipo}" non previsto (serie, intervalli, circuito, apnee).`);
      if ((e.tipo === 'intervalli' || e.tipo === 'apnee') && (!Array.isArray(e.fasi) || !e.fasi.length)) throw new Error(`"${e.nome}": mancano le fasi.`);
      if (e.tipo === 'apnee' && !espandiFasi(e.fasi).some((f) => f.fase === 'apnea')) throw new Error(`"${e.nome}": nessuna fase di apnea.`);
      if (e.tipo === 'circuito' && !e.giri) e.giri = 1;
      if (e.tipo === 'serie' && !e.serie) e.serie = 1;
    });
  });
  sedute.forEach((x) => { x._sez = sezTipo(x.tipo); });
  return { sedute, note: obj.note_coach || '' };
}

/* ---------- intervalli: espansione delle fasi ---------- */
function espandiFasi(fasi, out = [], prefisso = '') {
  (fasi || []).forEach((f) => {
    if (Array.isArray(f.fasi)) {
      const n = Math.max(1, f.ripeti || 1);
      for (let i = 1; i <= n; i++) espandiFasi(f.fasi, out, n > 1 ? `${i}/${n}` : '');
    } else {
      const fase = f.fase === 'apnea' || f.intensita === 'apnea' ? 'apnea' : (f.fase === 'respiro' || f.intensita === 'respiro' ? 'respiro' : null);
      const intens = fase || (INTENSITA.includes(f.intensita) ? f.intensita : 'medio');
      out.push({ nome: f.nome || (fase === 'apnea' ? 'Apnea' : fase === 'respiro' ? 'Respiro' : 'Fase'), durata_s: f.durata_s || null, intensita: intens, fase, note: f.note || '', giro: prefisso, metri: f.metri || null, sforzo: f.sforzo ?? null, annunci_s: f.annunci_s || null, guida: f.guida || '' });
    }
  });
  return out;
}

/* ---------- log della seduta corrente ---------- */
function logEs(id) {
  const c = S.corrente; if (!c) return null;
  if (!c.esercizi[id]) c.esercizi[id] = { stato: 'da_fare', serie: [], fasi_completate: 0, tempo_s: 0, note: '', apnee: [] };
  if (!c.esercizi[id].apnee) c.esercizi[id].apnee = [];
  return c.esercizi[id];
}
function iniziaSeduta(sez = 'fisico', sicurezza) {
  const s = sedutaCorrente(sez); if (!s || S.corrente) return;
  if (sez === 'apnea' && !sicurezza) { location.hash = '#/sicurezza'; return; } // prima la conferma di sicurezza
  S.corrente = { sedutaId: s.id, inizio: new Date().toISOString(), esercizi: {}, risposte: {}, noteFinali: '' };
  if (sicurezza) S.corrente.sicurezza = sicurezza;
  salva(); audio(); schermoAcceso(true);
  if (sez === 'apnea') parla('Si parte. Mai da solo.');
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
    if (T.inPausa) { T.inPausa = false; T.inizioFase = Date.now() - T.elapsedPausa * 1000; sottofondoPlay(); try { speechSynthesis.resume(); } catch (e) {} }
    return;
  }
  sottofondoPlay();
  const fasi = espandiFasi(ex.fasi);
  const idx = Math.min(log.fasi_completate || 0, fasi.length - 1);
  Object.assign(T, { tipo: 'int', exId: ex.id, fasi, idx, inizioFase: Date.now(), inPausa: false, elapsedPausa: 0, inizioTot: Date.now() - (log.tempo_s || 0) * 1000, apnee: ex.tipo === 'apnee', detto: {} });
  log.stato = log.stato === 'fatto' ? 'fatto' : 'in_corso';
  ultimoSecondo = null; segnaleConto(); annunciaFase(); salva();
}
// Tabelle di apnea: all'inizio di ogni fase la voce dice "Apnea" o "Respira".
function annunciaFase() {
  if (T.tipo !== 'int') return;
  T.detto = {};
  const f = T.fasi[T.idx];
  if (f.guida) { parlaGuida(f.guida); return; }
  if (!T.apnee) return;
  if (f.fase === 'apnea') { parla(f.sforzo != null ? `Apnea. Sforzo ${f.sforzo}` : 'Apnea'); vibra([400]); }
  else if (f.fase === 'respiro') parla(f.durata_s ? `Respira. ${fraseTempo(f.durata_s)}` : 'Respira. Parti quando sei pronto');
}
// Registra il tempo (e i metri previsti) di una fase di apnea appena chiusa.
function registraApnea(log, k, f, sec, completa) {
  const n = T.fasi.slice(0, k + 1).filter((x) => x.fase === 'apnea').length;
  const prima = log.apnee.find((a) => a.k === k) || {};
  const voce = { k, n, nome: f.nome, prevista_s: f.durata_s || null, tempo_s: Math.round(sec), sforzo_previsto: f.sforzo, sforzo: prima.sforzo ?? '', metri: prima.metri ?? (f.metri || '') };
  if (f.durata_s && !completa) voce.uscita_anticipata = true;
  log.apnee = log.apnee.filter((a) => a.k !== k).concat(voce).sort((a, b) => a.k - b.k);
}
function intPausa() {
  if (T.tipo !== 'int' || T.inPausa) return;
  T.elapsedPausa = (Date.now() - T.inizioFase) / 1000; T.inPausa = true;
  sottofondoPausa(); try { speechSynthesis.pause(); } catch (e) {}
}
function intElapsed() { return T.inPausa ? T.elapsedPausa : (Date.now() - T.inizioFase) / 1000; }
function intAvanti(ex, auto) {
  if (T.tipo !== 'int') return;
  const log = logEs(ex.id);
  const f = T.fasi[T.idx];
  if (f.fase === 'apnea') registraApnea(log, T.idx, f, auto && f.durata_s ? f.durata_s : intElapsed(), !!auto);
  log.fasi_completate = Math.max(log.fasi_completate || 0, T.idx + 1);
  log.tempo_s = Math.round((Date.now() - T.inizioTot) / 1000);
  if (T.idx + 1 >= T.fasi.length) {
    const eraApnee = T.apnee;
    log.stato = 'fatto'; fermaTimer(); salva(); segnaleFine(); render();
    if (eraApnee) { parla('Fine. Ora segna lo sforzo di ogni apnea'); toast('Tabella completata'); } else toast('Intervalli completati');
    const sa = sedutaAttiva(); if (sa && sa.sottofondo && prossimoDa(sa.esercizi.indexOf(ex)) === '#/fine') setTimeout(sottofondoPausa, 4000);
    return;
  }
  T.idx += 1; T.inizioFase = Date.now(); T.elapsedPausa = 0; T.inPausa = false; ultimoSecondo = null;
  if (auto) segnaleFine(); else segnaleConto();
  annunciaFase();
  salva(); render();
}
function intIndietro() {
  if (T.tipo !== 'int') return;
  if (intElapsed() < 3 && T.idx > 0) T.idx -= 1;
  T.inizioFase = Date.now(); T.elapsedPausa = 0; ultimoSecondo = null; annunciaFase(); render();
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
    if (T.apnee) { // annunci a voce: 30" e 10" alla fine delle fasi a tempo; tempo trascorso nelle apnee libere, se richiesto
      const say = (key, txt) => { if (!T.detto[key]) { T.detto[key] = 1; parla(txt); } };
      if (f.durata_s) {
        const r = Math.ceil(f.durata_s - el);
        if (r === 30 && f.durata_s >= 50) say('30', '30 secondi');
        if (r === 10 && f.durata_s >= 20) say('10', '10 secondi');
      } else if (f.annunci_s && el >= f.annunci_s) {
        const k = Math.floor(el / f.annunci_s) * f.annunci_s; say('t' + k, fraseTempo(k));
      }
    }
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
    case 'fisico': html = vSezione('fisico'); break;
    case 'sicurezza': html = vSicurezza(); focus = true; break;
    case 'seduta': html = vSeduta(); focus = !!S.corrente; break;
    case 'es': html = vEsercizio(parseInt(parti[1], 10) || 0); focus = !!S.corrente; break;
    case 'fine': html = vFine(); focus = true; break;
    case 'esito': html = vEsito(parti[1]); break;
    case 'carica': html = vCarica(); break;
    case 'collega': html = vCollega(); break;
    case 'storico': html = vStorico(SEZIONI[parti[1]] ? parti[1] : 'fisico'); break;
    case 'regista': html = vRegista(parti[1] ? decodeURIComponent(parti[1]) : ''); break;
    case 'apnea': html = vSezione('apnea'); break;
    case 'mentale': html = vSezione('mentale'); break;
    case 'alimentazione': html = window.Mr9Alimentazione ? '<div id="ali-root"></div>' : vPresto('cibo', 'Alimentazione', 'Diario dei pasti, idratazione e note sul peso.'); break;
    default: html = vHome();
  }
  if (paginaModulo && paginaModulo !== pag && window.Mr9Alimentazione && window.Mr9Alimentazione.unmount) { try { window.Mr9Alimentazione.unmount(); } catch (e) {} }
  if (pag !== '' && !html.includes('class="topbar"')) html = `<div class="topbar"><span class="tb-left">${HOME_BTN}</span></div>` + html;
  app.innerHTML = html;
  if (h !== ultimaPagina) { window.scrollTo(0, 0); ultimaPagina = h; }
  document.body.classList.toggle('focus', focus);
  const sez = sezPagina(pag, parti);
  document.body.dataset.sez = sez || '';
  const tab = pag === '' ? 'home' : (sez || (['carica', 'collega'].includes(pag) ? 'fisico' : pag === 'regista' ? 'home' : pag));
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  collega(pag, parti);
  const att = sedutaAttiva();
  if (att && att.sottofondo) sottofondoPrepara(att, ['seduta', 'es', 'fine'].includes(pag)); else if (YT_S.box) sottofondoChiudi();
  paginaModulo = null;
  if (pag === 'alimentazione' && window.Mr9Alimentazione) { paginaModulo = pag; try { window.Mr9Alimentazione.mount($('#ali-root'), { percorso: parti.slice(1) }); } catch (e) { console.error(e); } }
  tick();
}

// A quale sezione appartiene la pagina (colori, tab attiva, link "indietro").
function sezPagina(pag, parti) {
  if (SEZIONI[pag]) return pag;
  if (pag === 'sicurezza') return 'apnea';
  if (['seduta', 'es', 'fine'].includes(pag)) { const s = sedutaAttiva(); return s ? sezDi(s) : 'fisico'; }
  if (pag === 'esito') { const h = S.storico[parseInt(parti[1], 10)]; return h ? sezEsito(h.esito) : 'fisico'; }
  if (pag === 'storico') return SEZIONI[parti[1]] ? parti[1] : 'fisico';
  return null;
}
const indietro = (sez) => `<a class="back" href="#/${sez}">‹ ${SEZIONI[sez] || 'Fisico'}</a>`;
const chiAllena = (sez) => ({ apnea: 'Dave', mentale: 'Gus' }[sez] || 'il coach');

/* ---------- viste ---------- */
function statoFisico(sez = 'fisico') {
  const att = sedutaAttiva();
  if (S.corrente && att && sezDi(att) === sez) return 'Seduta in corso';
  const s = sedutaCorrente(sez);
  if (s) return s.data ? `Pronta · ${dataIt(s.data)}` : 'Seduta pronta';
  return sez === 'fisico' ? 'In attesa del coach' : `In attesa di ${chiAllena(sez)}`;
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
    <a class="tile apnea" href="#/apnea"><span class="tbadge">${esc(statoFisico('apnea'))}</span><div><div class="tname">Apnea</div><div class="tsub">Statica e dinamica</div></div></a>
    <a class="tile mentale" href="#/mentale"><span class="tbadge">${esc(statoFisico('mentale'))}</span><div><div class="tname">Mentale</div><div class="tsub">Sedute guidate</div></div></a>
    <a class="tile cibo big ${window.Mr9Alimentazione ? '' : 'soon'}" href="#/alimentazione" style="min-height:120px"><span class="tbadge">${window.Mr9Alimentazione ? 'Oggi' : 'Presto'}</span><div><div class="tname">Alimentazione</div><div class="tsub">Diario</div></div></a>
    <a class="tile regista big" href="#/regista" style="min-height:96px"><span class="tbadge">${esc(statoMessaggi())}</span><div><div class="tname">Messaggio al regista</div><div class="tsub">Allenamento, cibo, dispensa, spesa: detta e lui smista</div></div></a>
  </div>`;
}

function etichettaTipo(t, s) {
  if (t === 'mentale') return 'Mentale';
  if (t === 'apnea') return 'Apnea' + (s && s.disciplina ? ' · ' + ({ statica: 'Statica', dinamica: 'Dinamica', secco: 'A secco' }[s.disciplina] || s.disciplina) : '');
  return ({ palestra: 'Palestra', corsa: 'Corsa', nuoto: 'Nuoto', bici: 'Bici', misto: 'Misto' })[t] || 'Allenamento';
}

function vFisico() { return vSezione('fisico'); }
function vSezione(sez) {
  const s = sedutaCorrente(sez);
  const att = sedutaAttiva();
  const apnea = sez === 'apnea';
  const nota = sez === 'fisico' ? S.noteCoach : '';
  let hero;
  if (S.corrente && att && sezDi(att) === sez) {
    const fatti = att.esercizi.filter((e) => ['fatto', 'saltato'].includes((S.corrente.esercizi[e.id] || {}).stato)).length;
    hero = `
    <div class="hero">
      <span class="tag">In corso</span>
      <h2>${esc(att.titolo)}</h2>
      <div class="stats">
        <div class="stat"><b>${fatti}/${att.esercizi.length}</b><span>Esercizi</span></div>
        <div class="stat"><b id="clock-seduta">0:00</b><span>Tempo</span></div>
      </div>
      <a class="btn primary" href="#/seduta">Riprendi la seduta</a>
    </div>`;
  } else if (S.corrente && att) {
    hero = `
    <div class="card">
      <h2>C’è una seduta di ${esc(SEZIONI[sezDi(att)].toLowerCase())} in corso</h2>
      <p class="muted">${esc(att.titolo)}: chiudila prima di iniziarne un’altra.</p>
      <a class="btn" href="#/seduta">Vai alla seduta in corso</a>
    </div>`;
  } else if (s) {
    const nApnee = apnea ? s.esercizi.reduce((n, e) => n + (e.tipo === 'apnee' ? espandiFasi(e.fasi).filter((f) => f.fase === 'apnea').length : 0), 0) : 0;
    hero = `
    <div class="hero">
      <span class="tag">${esc(etichettaTipo(s.tipo, s))}${s.data ? ' · ' + esc(dataIt(s.data)) : ''}</span>
      <h2>${esc(s.titolo)}</h2>
      <div class="stats">
        ${nApnee ? `<div class="stat"><b>${nApnee}</b><span>Apnee</span></div>` : `<div class="stat"><b>${s.esercizi.length}</b><span>Esercizi</span></div>`}
        ${s.durata_stimata_min ? `<div class="stat"><b>${esc(s.durata_stimata_min)}'</b><span>Durata</span></div>` : ''}
        ${s.sforzo_max != null ? `<div class="stat"><b>${esc(s.sforzo_max)}</b><span>Sforzo max</span></div>` : ''}
      </div>
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      ${apnea ? '<div class="note safe">Mai da solo in acqua: prima di partire confermi che il compagno c’è.</div>' : ''}
      ${s.sottofondo && s.sottofondo.titolo ? `<div class="note">🎧 ${esc(s.sottofondo.titolo)}${s.sottofondo.durata_s ? ' · ' + fmtBreve(s.sottofondo.durata_s) : ''}</div>` : ''}
      <button class="btn primary" id="b-inizia" data-sez="${sez}">Inizia la seduta</button>
    </div>`;
  } else {
    hero = `
    <div class="card empty">
      <div class="big">${apnea ? '🌊' : sez === 'mentale' ? '🧘' : '⏳'}</div>
      <h2>Nessuna seduta pronta</h2>
      ${collegato()
        ? `<p class="muted">${apnea ? 'Dave non ha ancora preparato la prossima seduta in acqua.' : sez === 'mentale' ? 'Gus non ha ancora preparato la prossima seduta guidata.' : 'Il coach non ha ancora preparato la prossima seduta.'} Controllo ogni volta che apri l’app.</p><button class="btn primary" id="b-sync">Controlla adesso</button>`
        : '<p class="muted">Collega l’app al database: le sedute arriveranno qui da sole.</p><a class="btn primary" href="#/collega">Collega il coach</a>'}
    </div>`;
  }
  const mie = S.storico.map((h, i) => [h, i]).filter(([h]) => sezEsito(h.esito) === sez);
  const ultimo = mie[mie.length - 1];
  return `
  <div class="eyebrow">${{ apnea: 'Apnea · con Dave', mentale: 'Mentale · con Gus' }[sez] || 'Allenamento fisico'}</div>
  <h1>Oggi</h1>
  ${hero}
  ${nota && !S.corrente ? `<div class="card"><div class="eyebrow" style="margin-bottom:6px">${apnea ? 'Da Dave' : 'Dal coach'}</div>${esc(nota)}</div>` : ''}
  <div class="row" style="margin-top:6px">
    ${collegato() ? '<button class="btn" id="b-sync2">Aggiorna</button>' : '<a class="btn" href="#/collega">Collega il coach</a>'}
    <a class="btn" href="#/storico/${sez}">Storico${mie.length ? ' (' + mie.length + ')' : ''}</a>
  </div>
  ${ultimo && !ultimo[0].inviato ? `<div class="card" style="margin-top:12px"><div class="hist"><div><b>Esito da inviare</b><div class="small muted">${esc(ultimo[0].esito.titolo)}</div></div><a class="btn sm" href="#/esito/${ultimo[1]}">Invia</a></div></div>` : ''}
  ${collegato() ? `<p class="small muted" style="text-align:center;margin-top:14px"><a href="#/collega">${statoSync()}</a></p>` : ''}`;
}

// Conferma di sicurezza prima di ogni seduta di apnea: un controllo per riga, il pulsante si accende solo con tutti spuntati.
function ultimoMalessere() {
  const h = S.storico.slice().reverse().find((x) => sezEsito(x.esito) === 'apnea');
  return !!(h && (h.esito.risposte || []).some((r) => r.id === 'regolare' && r.valore === 'No'));
}
function vSicurezza() {
  const s = sedutaCorrente('apnea');
  if (!s || S.corrente) return vSezione('apnea');
  const voci = (Array.isArray(s.sicurezza) && s.sicurezza.length ? s.sicurezza : SICUREZZA_APNEA).slice();
  if (s.compagno) voci[0] = `Il compagno (${s.compagno}) è in acqua con te, pronto, e sa che seduta fai`;
  if (ultimoMalessere()) voci.unshift('L’ultima volta hai segnato un malessere: hai sentito il medico e puoi riprendere');
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}${indietro('apnea')}</span></div>
  <div class="eyebrow">Prima di entrare in acqua</div>
  <h1>Sicurezza</h1>
  ${ultimoMalessere() ? '<div class="note" style="border-color:var(--bad)">Dopo un malessere in apnea niente apnee finché non hai sentito il medico.</div>' : ''}
  <div class="checks">${voci.map((v, k) => `<button type="button" class="check" data-k="${k}" aria-pressed="false"><span class="box"></span><span>${esc(v)}</span></button>`).join('')}</div>
  <button class="btn primary" id="b-sicuro" disabled>Confermo: iniziamo</button>
  <p class="small muted" style="text-align:center;margin-top:10px">Tetto di sforzo in allenamento: 7. L’8 solo in gara.</p>`;
}

function riassuntoEs(ex) {
  if (ex.tipo === 'apnee') {
    const f = espandiFasi(ex.fasi); const n = f.filter((x) => x.fase === 'apnea').length;
    const tot = f.every((x) => x.durata_s) ? f.reduce((a, x) => a + x.durata_s, 0) : 0;
    return `${n} apne${n === 1 ? 'a' : 'e'}${tot ? ' · ' + fmtBreve(tot) : ''}`;
  }
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
  const c = S.corrente; const sez = sezDi(s);
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
  <div class="topbar"><span class="tb-left">${HOME_BTN}${indietro(sez)}</span><span class="pill" id="clock-seduta">0:00</span></div>
  <div class="eyebrow">${esc(etichettaTipo(s.tipo, s))}</div>
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
  else if (ex.tipo === 'apnee') corpo = vApnee(ex, ultimo);
  else corpo = vSerie(ex, ultimo);
  const log = logEs(ex.id);
  const altri = ex.tipo === 'intervalli' || ex.tipo === 'apnee'
    ? `<button class="btn sm" id="b-int-prev" style="width:100%">‹ Torna alla fase prima</button>
       <button class="btn sm ghost" id="b-int-reset" style="width:100%">Ricomincia da capo</button>`
    : (log.serie.length ? `<button class="btn sm ghost" id="b-annulla-serie" style="width:100%">Annulla ultim${ex.tipo === 'circuito' ? 'o giro' : 'a serie'}</button>` : '');
  const piede = `
  <div class="sotto">
    <div class="card">
      <label class="small muted" for="nota-es" style="font-weight:800">Nota per ${chiAllena(sezDi(s))} (facoltativa)</label>
      <textarea id="nota-es" placeholder="${sezDi(s) === 'apnea' ? 'Es. contrazioni presto, testa tranquilla, fase A lunga…' : 'Es. carico facile, nessun dolore, FC media 138…'}" style="min-height:64px;margin-top:6px">${esc(log.note)}</textarea>
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
  const conGuida = fasi.some((x) => x.guida);
  return `
  <div class="presc"><span class="chip"><b>${fasi.length}</b> fasi</span>${totale ? `<span class="chip">Totale <b>${fmtBreve(totale)}</b></span>` : ''}
    ${conGuida ? `<button type="button" class="chip" id="b-voce">${S.voce ? '🔊 Voce guida' : '🔇 Voce spenta'}</button>` : ''}</div>
  <div class="phasebox tap i-${finito ? 'facile' : f.intensita}" id="phasebox" role="button">
    <div class="pinfo" id="pinfo">${finito ? 'Completato' : `Fase ${idx + 1} di ${fasi.length}${f.giro ? ' · ' + esc(f.giro) : ''}`}</div>
    <div class="pname" id="pname">${finito ? 'Fatto!' : esc(f.nome)}</div>
    <div class="ptime" id="ptime">${finito ? fmt(log.tempo_s || 0) : f.durata_s ? fmt(f.durata_s) : (f.metri ? f.metri + ' m' : '0:00')}</div>
    <div class="paz">${azione}</div>
    <div class="pinfo" id="pnext">${finito ? '' : (f.note ? esc(f.note) + ' · ' : '') + (!f.durata_s ? 'Fase libera' : (prossima ? `Poi: ${esc(prossima.nome)} ${prossima.durata_s ? fmtBreve(prossima.durata_s) : ''}` : 'Ultima fase'))}</div>
  </div>
  <div class="progress"><div id="pbar" style="width:${finito ? 100 : Math.round((idx / fasi.length) * 100)}%"></div></div>
  ${!finito && f.guida ? `<div class="guida">${esc(f.guida)}</div>` : ''}
  ${finito ? '' : `<div class="row" style="margin-bottom:12px">
    <button class="btn" id="b-int-next">Salta fase ›</button>
    <button class="btn" id="b-termina" style="color:var(--bad)">Termina allenamento</button>
  </div>`}
  <ul class="phases">${lista}</ul>`;
}
// Tabella di apnea: fasi "respiro" e "apnea". Il riquadro grande è l'unico pulsante:
// parte la tabella, chiude un'apnea ("esco"), fa partire l'apnea dopo un respiro libero.
// I respiri a tempo finiscono da soli. Alla fine si segna lo sforzo 0-10 di ogni apnea.
function parseTempo(v) {
  v = String(v || '').trim().replace(/[’'"]/g, ':').replace(/:+$/, '');
  if (!v) return '';
  if (v.includes(':')) { const [m, sec] = v.split(':'); return (parseInt(m, 10) || 0) * 60 + (parseInt(sec, 10) || 0); }
  const n = parseInt(v, 10); return Number.isFinite(n) ? n : '';
}
function vApnee(ex, ultimo) {
  const log = logEs(ex.id);
  const fasi = espandiFasi(ex.fasi);
  const st = intStato(ex);
  const idx = st ? st.idx : Math.min(log.fasi_completate || 0, fasi.length - 1);
  const finito = log.stato === 'fatto' && !st;
  const f = fasi[idx];
  const nTot = fasi.filter((x) => x.fase === 'apnea').length;
  const nQui = fasi.slice(0, idx + 1).filter((x) => x.fase === 'apnea').length;
  const conMetri = fasi.some((x) => x.fase === 'apnea' && x.metri);
  const totale = fasi.every((x) => x.durata_s) ? fasi.reduce((a, x) => a + x.durata_s, 0) : 0;
  const prossima = fasi[idx + 1];
  let azione;
  if (finito) azione = ultimo ? 'Tocca per chiudere la seduta' : 'Tocca per l’esercizio successivo';
  else if (!st) azione = log.fasi_completate ? 'Tocca per riprendere' : 'Tocca per partire';
  else if (f.fase === 'apnea') azione = f.durata_s ? 'Tocca solo se esci prima' : 'Tocca quando esci';
  else if (!f.durata_s) azione = 'Tocca per partire con l’apnea';
  else azione = 'L’apnea parte da sola';
  const dettagli = [];
  if (!finito && f.fase === 'apnea') { dettagli.push(`Apnea ${nQui} di ${nTot}`); if (f.metri) dettagli.push(`${f.metri} m`); if (f.sforzo != null) dettagli.push(`sforzo ${f.sforzo}`); }
  else if (!finito) dettagli.push(`Fase ${idx + 1} di ${fasi.length}${f.giro ? ' · ' + f.giro : ''}`);
  const lista = fasi.map((x, k) => `<li class="${k < idx || finito ? 'past' : k === idx ? 'cur' : ''}"><span class="pc i-${x.intensita}"></span>${esc(x.nome)}${x.sforzo != null ? ` <span class="muted small">sforzo ${esc(x.sforzo)}</span>` : ''}<span class="pd">${x.durata_s ? fmtBreve(x.durata_s) : (x.metri ? x.metri + ' m' : 'libera')}</span></li>`).join('');
  const running = st && !st.inPausa;
  const tabella = !running && log.apnee.length ? `
  <div class="card" style="margin-top:4px">
    <div class="eyebrow" style="margin-bottom:6px">Le tue apnee</div>
    <table class="setlog apnlog">
      <tr><th>#</th><th>Tempo</th>${conMetri ? '<th>Metri</th>' : ''}<th>Sforzo 0-10</th></tr>
      ${log.apnee.map((a, j) => `<tr>
        <td class="sn">${a.n}</td>
        <td><input inputmode="numeric" data-j="${j}" data-f="tempo_s" value="${esc(a.tempo_s === '' ? '' : fmt(a.tempo_s))}">${a.uscita_anticipata ? '<div class="small" style="color:var(--warn);text-align:center">uscito prima</div>' : ''}</td>
        ${conMetri ? `<td><input inputmode="numeric" data-j="${j}" data-f="metri" value="${esc(a.metri)}"></td>` : ''}
        <td><input inputmode="numeric" data-j="${j}" data-f="sforzo" value="${esc(a.sforzo)}" placeholder="${a.sforzo_previsto != null ? 'prev. ' + esc(a.sforzo_previsto) : ''}"></td>
      </tr>`).join('')}
    </table>
    <p class="small muted" style="margin:8px 0 0">Sforzo: 4 fase A stabile · 5 contrazioni sostenibili · 6 contrazioni intense, primi sintomi · 7 sintomi gestiti, margine chiaro · 8 solo in gara.</p>
  </div>` : '';
  return `
  <div class="presc"><span class="chip"><b>${nTot}</b> apne${nTot === 1 ? 'a' : 'e'}</span>${totale ? `<span class="chip">Totale <b>${fmtBreve(totale)}</b></span>` : ''}
    <button type="button" class="chip" id="b-voce">${S.voce ? '🔊 Voce attiva' : '🔇 Voce spenta'}</button></div>
  <div class="phasebox tap i-${finito ? 'facile' : f.intensita}" id="phasebox" role="button">
    <div class="pinfo" id="pinfo">${finito ? 'Completata' : esc(dettagli.join(' · '))}</div>
    <div class="pname" id="pname">${finito ? 'Fatto!' : esc(f.nome)}</div>
    <div class="ptime" id="ptime">${finito ? fmt(log.tempo_s || 0) : f.durata_s ? fmt(f.durata_s) : '0:00'}</div>
    <div class="paz">${azione}</div>
    <div class="pinfo" id="pnext">${finito ? '' : (f.note ? esc(f.note) + ' · ' : '') + (prossima ? `Poi: ${esc(prossima.nome)} ${prossima.durata_s ? fmtBreve(prossima.durata_s) : ''}` : 'Ultima fase')}</div>
  </div>
  <div class="progress"><div id="pbar" style="width:${finito ? 100 : Math.round((idx / fasi.length) * 100)}%"></div></div>
  ${finito ? '' : `<div class="row" style="margin-bottom:12px">
    <button class="btn" id="b-int-next">Salta fase ›</button>
    <button class="btn" id="b-termina" style="color:var(--bad)">Termina</button>
  </div>`}
  ${tabella}
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
  const domande = domandeDi(s);
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
  ${nonFatti ? `<div class="note">${nonFatti} esercizi${nonFatti === 1 ? 'o' : ''} non completat${nonFatti === 1 ? 'o' : 'i'}: verranno segnalati a ${chiAllena(sezDi(s))}.</div>` : ''}
  <div class="card">${qs}
    <div class="q" style="margin-bottom:0"><label class="ql" for="q-note">Altro da dire a ${chiAllena(sezDi(s))}?</label><textarea id="q-note" placeholder="Facoltativo">${esc(S.corrente.noteFinali)}</textarea></div>
  </div>
  <button class="btn ok" id="b-conferma">Conferma seduta eseguita</button>`;
}

function costruisciEsito() {
  const s = sedutaAttiva(); const c = S.corrente;
  const domande = domandeDi(s);
  const fine = new Date();
  const extra = sezDi(s) === 'apnea' ? { disciplina: s.disciplina || null, sicurezza: c.sicurezza || null } : {};
  if (s.sottofondo) extra.sottofondo = { titolo: s.sottofondo.titolo || null, url: s.sottofondo.url || null, durata_s: s.sottofondo.durata_s || null };
  return {
    formato: FORMATO_ESITO,
    app_versione: APP_VERSIONE,
    seduta_id: s.id,
    titolo: s.titolo,
    sezione: sezDi(s),
    tipo: s.tipo || null,
    ...extra,
    data_prevista: s.data || null,
    inizio: c.inizio,
    fine: fine.toISOString(),
    durata_min: Math.round((fine - new Date(c.inizio)) / 60000),
    esercizi: s.esercizi.map((ex) => {
      const l = c.esercizi[ex.id] || { stato: 'da_fare', serie: [] };
      const o = { id: ex.id, nome: ex.nome, tipo: ex.tipo, stato: l.stato === 'in_corso' ? 'parziale' : l.stato === 'da_fare' ? 'non_fatto' : l.stato };
      if (ex.tipo === 'intervalli') {
        o.fasi_totali = espandiFasi(ex.fasi).length; o.fasi_completate = l.fasi_completate || 0; o.tempo_s = l.tempo_s || 0;
      } else if (ex.tipo === 'apnee') {
        const fasi = espandiFasi(ex.fasi);
        o.apnee_previste = fasi.filter((f) => f.fase === 'apnea').length;
        o.fasi_totali = fasi.length; o.fasi_completate = l.fasi_completate || 0; o.tempo_s = l.tempo_s || 0;
        o.apnee = (l.apnee || []).map((a) => {
          const x = { n: a.n, nome: a.nome, tempo_s: a.tempo_s === '' ? null : a.tempo_s, sforzo: a.sforzo === '' ? null : a.sforzo };
          if (a.prevista_s) x.prevista_s = a.prevista_s;
          if (a.sforzo_previsto != null) x.sforzo_previsto = a.sforzo_previsto;
          if (a.metri !== '' && a.metri != null) x.metri = a.metri;
          if (a.uscita_anticipata) x.uscita_anticipata = true;
          return x;
        });
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
  const sez = sezEsito(e.esito); const chi = chiAllena(sez);
  const allarme = (e.esito.risposte || []).some((r) => r.id === 'regolare' && r.valore === 'No')
    ? '<div class="note" style="border-color:var(--bad)"><b>Hai segnato un malessere.</b> Niente apnee finché non hai sentito il medico. Raccontalo a Dave o al regista.</div>' : '';
  if (collegato()) {
    return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}${indietro(sez)}</span></div>
  <div class="eyebrow">Seduta confermata ✓</div>
  <h1>${e.inviato ? `Esito inviato a ${chi}` : `Invio a ${chi}…`}</h1>
  ${allarme}
  <div class="card">
    ${e.inviato
      ? `<p style="margin:0">${sez === 'fisico' ? 'Il coach' : chiAllena(sez)} lo legge al prossimo controllo e prepara la seduta successiva, che comparirà da sola nella pagina ${SEZIONI[sez]}.</p>`
      : `<p style="margin:0">Non sono ancora riuscito a inviarlo${S.sync && S.sync.errore ? ' (' + esc(S.sync.errore) + ')' : ''}. Riprovo da solo appena c\u2019è connessione.</p><button class="btn" id="b-reinvia" style="margin-top:12px">Riprova adesso</button>`}
  </div>
  <a class="btn" href="#/regista/${encodeURIComponent(e.esito.seduta_id)}" style="margin-top:14px">Racconta di più al regista</a>
  <details style="margin-top:14px"><summary>Vedi l'esito</summary><textarea class="code" readonly id="t-esito">${esc(testo)}</textarea></details>
  <a class="btn primary" href="#/${sez}" style="margin-top:14px">Fatto</a>`;
  }
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}${indietro(sez)}</span></div>
  ${allarme}
  <div class="eyebrow">Seduta confermata ✓</div>
  <h1>Invia l'esito a ${chi}</h1>
  <p class="muted">Mandalo nella chat di ${chi}: ti risponderà con la prossima seduta, che poi carichi qui.</p>
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
      <button class="btn" id="b-esempio-apnea">Carica un esempio di apnea</button>
      <button class="btn ghost" id="b-reset" style="color:var(--bad)">Cancella sedute e storico (il collegamento resta)</button>
    </div>
  </details>`;
}

function vStorico(sez = 'fisico') {
  const righe = S.storico.slice().reverse().map((h, k) => {
    const i = S.storico.length - 1 - k;
    const e = h.esito;
    if (sezEsito(e) !== sez) return '';
    const fatti = e.esercizi.filter((x) => x.stato === 'fatto').length;
    return `<a class="card hist" href="#/esito/${i}" style="display:flex">
      <div><b>${esc(e.titolo)}</b><div class="small muted">${esc(dataIt(e.inizio))} · ${e.durata_min} min · ${fatti}/${e.esercizi.length} esercizi</div></div>
      <span class="pill ${h.inviato ? 'ok' : 'warn'}">${h.inviato ? 'Inviato' : 'Da inviare'}</span></a>`;
  }).join('');
  return `
  <div class="topbar"><span class="tb-left">${HOME_BTN}${indietro(sez)}</span></div>
  <div class="eyebrow">${sez === 'fisico' ? 'Allenamento fisico' : SEZIONI[sez]}</div>
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
  on('b-inizia', (ev) => iniziaSeduta(ev.currentTarget.dataset.sez || 'fisico'));
  if (pag === 'sicurezza') {
    const btn = $('#b-sicuro');
    document.querySelectorAll('.check').forEach((c) => c.addEventListener('click', () => {
      c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      btn.disabled = !Array.from(document.querySelectorAll('.check')).every((x) => x.getAttribute('aria-pressed') === 'true');
    }));
    on('b-sicuro', () => {
      const voci = Array.from(document.querySelectorAll('.check')).map((x) => x.textContent.trim());
      iniziaSeduta('apnea', { confermata: true, ora: new Date().toISOString(), voci });
    });
  }

  if (pag === 'es') {
    const s = sedutaAttiva(); if (!s) return;
    const i = parseInt(parti[1], 10) || 0; const ex = s.esercizi[i]; if (!ex) return;
    const log = logEs(ex.id);
    if (ex.tipo === 'intervalli' || ex.tipo === 'apnee') {
      on('phasebox', () => {
        audio();
        if (log.stato === 'fatto' && !intAttivo(ex.id)) { location.hash = prossimoDa(i); return; }
        if (!intAttivo(ex.id) || T.inPausa) { intAvvia(ex); render(); return; }
        const fase = T.fasi[T.idx];
        if (ex.tipo === 'apnee') {
          if (fase.fase === 'apnea' || !fase.durata_s) { intAvanti(ex, false); return; }
          toast('Recupero: l’apnea parte da sola (Salta fase › per anticipare)'); return;
        }
        if (!fase.durata_s) { intAvanti(ex, false); return; }
        intPausa(); render();
      });
      on('b-voce', () => { S.voce = !S.voce; salva(); if (S.voce) parla('Voce attiva'); else { try { speechSynthesis.cancel(); } catch (e) {} } render(); });
      document.querySelectorAll('.apnlog input').forEach((inp) => inp.addEventListener('change', () => {
        const a = log.apnee[+inp.dataset.j]; if (!a) return;
        const f = inp.dataset.f; const v = inp.value.trim();
        if (f === 'tempo_s') { a.tempo_s = parseTempo(v); inp.value = a.tempo_s === '' ? '' : fmt(a.tempo_s); }
        else if (f === 'sforzo') { const n = parseInt(v, 10); a.sforzo = Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : ''; inp.value = a.sforzo; }
        else a[f] = v === '' ? '' : (isNaN(Number(v)) ? v : Number(v));
        salva();
      }));
      on('b-int-next', () => { if (!intAttivo(ex.id)) intAvvia(ex); intAvanti(ex, false); });
      on('b-int-prev', intIndietro);
      on('b-termina', (ev) => {
        const b = ev.currentTarget;
        if (!b.dataset.armato) { b.dataset.armato = '1'; b.textContent = 'Tocca di nuovo per terminare'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armato; b.textContent = 'Termina allenamento'; } }, 4000); return; }
        if (intAttivo(ex.id)) {
          log.tempo_s = Math.round((Date.now() - T.inizioTot) / 1000);
          const fa = T.fasi[T.idx]; if (fa.fase === 'apnea') registraApnea(log, T.idx, fa, intElapsed(), false);
        }
        if (log.stato !== 'fatto') log.stato = (log.fasi_completate || 0) > 0 || intAttivo(ex.id) ? 'in_corso' : 'da_fare';
        fermaTimer(); sottofondoPausa(); try { speechSynthesis.cancel(); } catch (e) {} salva(); location.hash = '#/fine';
      });
      on('b-int-reset', () => { log.fasi_completate = 0; log.tempo_s = 0; log.apnee = []; log.stato = 'in_corso'; fermaTimer(); salva(); render(); });
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
      const domande = domandeDi(s);
      const manca = domande.find((d) => !d.facoltativa && d.tipo !== 'testo' && (S.corrente.risposte[d.id] == null || S.corrente.risposte[d.id] === ''));
      if (manca) { toast('Rispondi a: ' + manca.testo); return; }
      const esito = costruisciEsito();
      S.storico.push({ esito, inviato: false });
      S.coda = S.coda.filter((x) => x.id !== s.id); S.corrente = null; sottofondoChiudi(); try { speechSynthesis.cancel(); } catch (e) {}
      if (sezDi(s) === 'fisico') S.noteCoach = '';
      fermaTimer(); schermoAcceso(false); salva();
      location.hash = '#/esito/' + (S.storico.length - 1);
      sincronizza(true);
    });
  }

  on('b-sync', () => { toast('Controllo…'); sincronizza(true); });
  on('b-sync2', () => { toast('Controllo…'); sincronizza(true); });
  on('b-reinvia', () => sincronizza(true));
  if (['', 'fisico', 'apnea', 'mentale'].includes(pag)) sincronizza();

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
    on('b-g-scollega', () => { S.github = null; S.sync = null; try { localStorage.removeItem(KEY_GITHUB); } catch (e) {} salva(); toast('Scollegato'); location.hash = '#/fisico'; });
  }

  if (pag === 'regista') collegaRegista(parti[1] ? decodeURIComponent(parti[1]) : '');

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
    on('b-esempio-apnea', async () => {
      try { const r = await fetch('esempi/scheda-apnea-esempio.json', { cache: 'no-store' }); ta.value = await r.text(); toast('Esempio pronto: tocca Carica'); }
      catch (e) { toast('Esempio non disponibile offline'); }
    });
    on('b-reset', (ev) => {
      const b = ev.currentTarget;
      if (!b.dataset.armato) { b.dataset.armato = '1'; b.textContent = 'Tocca di nuovo per cancellare tutto'; return; }
      S = { coda: [], storico: [], corrente: null, noteCoach: '', voce: true, github: S.github || null }; fermaTimer(); salva(); toast('Dati cancellati'); location.hash = '#/fisico';
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
    location.hash = '#/' + sezDi(sedute[0]);
  } catch (e) {
    const msg = 'Non riesco a leggere la scheda. ' + (e.message || e);
    if (err) { err.textContent = msg; err.hidden = false; } else toast(msg);
  }
}

/* ---------- collegamento con il coach (repo dati su GitHub) ---------- */
// Struttura del repository privato apnea-training-database (branch main):
//   fisico/coda.json            scritto dal coach: scheda mr9-scheda-v1 con le prossime sedute
//   fisico/esiti/<data>_<id>.json  scritto dall'app: un esito mr9-esito-v1 per seduta confermata
// Nella stessa coda: palestra, corsa e nuoto (Papa Swolio, Kilian), apnea (Dave, "tipo": "apnea"), mentale (Gus, "tipo": "mentale").
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
      await inviaMessaggi();
      // Il database è la fonte: una seduta è fatta se il suo esito è nel repository dati,
      // oppure se è sul telefono e non è ancora stata inviata.
      const remoti = new Set(await elencoRemoto(DATI.esiti));
      const fatti = new Set(S.storico.filter((h) => !h.inviato).map((h) => h.esito.seduta_id));
      remoti.forEach((n) => { const k = n.indexOf('_'); if (k > 0) fatti.add(n.slice(k + 1).replace(/\.json$/, '')); });
      // Esiti inviati e poi cancellati dal database (es. prove azzerate): spariscono anche dal telefono.
      const primaStorico = S.storico.length;
      S.storico = S.storico.filter((h) => !(h.inviato && h.inviatoVia === 'github') || remoti.has(nomeEsito(h.esito)));
      if (S.storico.length !== primaStorico) toast('Storico allineato al database');
      const testo = await leggiRemoto(DATI.coda);
      if (testo) {
        const { sedute, note } = validaScheda(JSON.parse(testo));
        const prima = {}; Object.keys(SEZIONI).forEach((k) => { prima[k] = (sedutaCorrente(k) || {}).id; });
        let nuove = sedute.filter((x) => !fatti.has(x.id));
        if (S.corrente) { // la seduta in corso non si tocca
          const att = S.coda.find((x) => x.id === S.corrente.sedutaId);
          nuove = nuove.filter((x) => x.id !== S.corrente.sedutaId);
          if (att) nuove.unshift(att);
        }
        S.coda = nuove; S.noteCoach = note;
        if (!S.corrente) {
          const nuova = Object.keys(SEZIONI).find((k) => sedutaCorrente(k) && sedutaCorrente(k).id !== prima[k]);
          if (nuova) toast({ apnea: 'Nuova seduta di apnea da Dave', mentale: 'Nuova seduta mentale da Gus' }[nuova] || 'Nuova seduta dal coach');
        }
      }
      S.sync = { ultimo: new Date().toISOString(), errore: '' };
    } catch (e) {
      S.sync = { ultimo: (S.sync || {}).ultimo || null, errore: String(e.message || e) };
    } finally {
      ultimoSync = Date.now(); syncInCorso = null; salva();
      const pag = (location.hash || '#/').slice(2).split('/')[0];
      if (['', 'fisico', 'apnea', 'mentale', 'esito', 'storico', 'collega'].includes(pag)) render();
      else if (pag === 'regista') aggiornaListaMessaggi();
    }
  })();
  return syncInCorso;
}
/* ---------- messaggi al regista ---------- */
// Il regista è l'agente unico che smista le richieste a coach, chef e spesa.
// L'app salva ogni messaggio in regia/messaggi/<AAAA-MM-GG-HHMMSS>.json (formato mr9-messaggio-v1);
// il controllo novità (8:07, 12:07, 16:07) e il coach della sera (21:23) li leggono e li smistano.
const FORMATO_MESSAGGIO = 'mr9-messaggio-v1';
const CARTELLA_MESSAGGI = 'regia/messaggi';
const GIRI_REGISTA = [[8, 7], [12, 7], [16, 7], [21, 23]]; // ora di Roma
function prossimoGiro() {
  // ora e minuti correnti a Roma, anche se il telefono è in un altro fuso
  const p = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const h = +p.find((x) => x.type === 'hour').value, m = +p.find((x) => x.type === 'minute').value;
  const g = GIRI_REGISTA.find(([gh, gm]) => gh * 60 + gm > h * 60 + m) || GIRI_REGISTA[0];
  return `${g[0]}:${String(g[1]).padStart(2, '0')}`;
}
function nomeMessaggio(m) {
  const d = new Date(m.creato); const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.json`;
}
async function inviaMessaggi() {
  if (!collegato()) return;
  for (const m of (S.messaggi || [])) {
    if (m.inviato) continue;
    const corpo = { formato: FORMATO_MESSAGGIO, creato: m.creato, testo: m.testo };
    if (m.seduta) corpo.seduta = m.seduta;
    await scriviRemoto(`${CARTELLA_MESSAGGI}/${nomeMessaggio(m)}`, JSON.stringify(corpo, null, 2) + '\n', 'Messaggio per il regista');
    m.inviato = true; salva();
  }
}
function statoMessaggi() {
  const da = (S.messaggi || []).filter((m) => !m.inviato).length;
  if (da) return `${da} da inviare`;
  return collegato() ? `Prossima lettura ${prossimoGiro()}` : 'Collega il coach';
}
function righeMessaggi() {
  const ult = (S.messaggi || []).slice(-5).reverse();
  if (!ult.length) return '';
  return `<div class="eyebrow" style="margin-top:22px">Ultimi messaggi</div>` + ult.map((m) => `
    <div class="card" style="margin-bottom:8px"><div class="small muted">${esc(new Date(m.creato).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · ${m.inviato ? 'inviato ✓' : 'in attesa di connessione'}</div>
    <div style="margin-top:4px;white-space:pre-wrap">${esc(m.testo)}</div></div>`).join('');
}
function aggiornaListaMessaggi() { const el = $('#msg-lista'); if (el) el.innerHTML = righeMessaggi(); }
const Riconoscimento = window.SpeechRecognition || window.webkitSpeechRecognition;
function vRegista(seduta) {
  const s = seduta ? (S.storico.slice().reverse().find((h) => h.esito.seduta_id === seduta) || {}).esito : null;
  return `
  <div class="eyebrow">Un solo interlocutore</div>
  <h1>Messaggio al regista</h1>
  <p class="muted">Racconta come vuoi: lui capisce di cosa si tratta e lo passa al coach, al nutrizionista, allo chef o alla spesa. Per scrivere a uno di loro inizia con il nome (es. “Per lo chef: …”). Lo legge alle ${esc(prossimoGiro())} (giri alle 8:07, 12:07, 16:07 e 21:23). Per parlarci subito usa il progetto Claude del regista.</p>
  ${s ? `<div class="note">Riguarda la seduta <b>${esc(s.titolo)}</b> del ${esc(dataIt(s.inizio))}.</div>` : ''}
  ${collegato() ? '' : '<div class="note">L’app non è collegata al database: il messaggio resta sul telefono finché non colleghi il coach (Fisico → Collega).</div>'}
  <div class="card">
    <textarea id="msg-testo" style="min-height:160px" placeholder="Es. “Inventario dispensa: 2 kg di riso, 6 uova, 500 g di petto di pollo…” oppure “Oggi la spalla mi tirava davanti quando alzavo il braccio”. Puoi dettare con il microfono della tastiera."></textarea>
    ${Riconoscimento ? '<button class="btn" id="b-msg-mic" type="button" style="margin-top:10px">🎙 Detta</button>' : ''}
  </div>
  <button class="btn primary" id="b-msg-invia">Invia al regista</button>
  <div id="msg-lista">${righeMessaggi()}</div>`;
}
let dettato = null;
function collegaRegista(seduta) {
  const ta = $('#msg-testo'); if (!ta) return;
  const mic = $('#b-msg-mic');
  if (mic) mic.addEventListener('click', () => {
    if (dettato) { dettato.stop(); return; }
    try {
      const r = new Riconoscimento(); r.lang = 'it-IT'; r.continuous = true; r.interimResults = false;
      const base = ta.value;
      let parti = [];
      r.onresult = (ev) => {
        parti = Array.from(ev.results).filter((x) => x.isFinal).map((x) => x[0].transcript.trim());
        ta.value = (base ? base.trim() + ' ' : '') + parti.join(' ');
      };
      r.onend = () => { dettato = null; if (mic.isConnected) mic.textContent = '🎙 Detta'; };
      r.onerror = (ev) => { if (ev.error === 'not-allowed') toast('Permetti il microfono, oppure usa quello della tastiera'); };
      r.start(); dettato = r; mic.textContent = '■ Ferma dettatura';
    } catch (e) { toast('Dettatura non disponibile: usa il microfono della tastiera'); }
  });
  $('#b-msg-invia').addEventListener('click', async (ev) => {
    if (dettato) dettato.stop();
    const testo = ta.value.trim();
    if (!testo) { toast('Scrivi o detta il messaggio'); ta.focus(); return; }
    const b = ev.currentTarget; b.disabled = true;
    S.messaggi = S.messaggi || [];
    const m = { creato: new Date().toISOString(), testo, inviato: false };
    if (seduta) m.seduta = seduta;
    S.messaggi.push(m); if (S.messaggi.length > 50) S.messaggi = S.messaggi.slice(-50);
    salva(); ta.value = '';
    try { await inviaMessaggi(); toast(m.inviato ? `Inviato: lo legge alle ${prossimoGiro()}` : 'Salvato: lo invio quando colleghi il coach'); }
    catch (e) { toast('Nessuna connessione: lo invio appena possibile'); }
    b.disabled = false; aggiornaListaMessaggi();
  });
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
    <label class="small muted" for="g-token" style="font-weight:800">Token GitHub (la chiave che apre il database)</label>
    <input class="input" id="g-token" type="password" value="${esc(g.token || '')}" placeholder="github_pat_…" autocapitalize="off" autocorrect="off">
    <p class="small muted" style="margin:0">Lo crei una volta su github.com: vedi “Come si crea il token” qui sotto.</p>
    <label class="small muted" for="g-branch" style="font-weight:800">Branch (lascia main)</label>
    <input class="input" id="g-branch" value="${esc(g.branch || 'main')}" autocapitalize="off" autocorrect="off">
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
// Quando arriva una nuova versione dell'app (nuovo service worker), ricarica la pagina una volta,
// ma non mentre un timer sta correndo: in quel caso la nuova versione arriva alla prossima apertura.
if ('serviceWorker' in navigator) {
  const cerano = !!navigator.serviceWorker.controller;
  let ricaricato = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!cerano || ricaricato || T.tipo) return;
    ricaricato = true; location.reload();
  });
}
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
