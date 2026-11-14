/* Mr. 9 Training · sezione Alimentazione
 * Ingresso: window.Mr9Alimentazione.mount(el, { percorso: [...] }) e unmount().
 * Rotte: #/alimentazione            giorno (colazione, pranzo, cena...)
 *        #/alimentazione/pasto/<id> ingredienti e quantità + Ricetta (agente chef)
 *        #/alimentazione/spesa      lista della spesa
 *        #/alimentazione/dispensa   dispensa
 *        #/alimentazione/diario     registro dei pasti
 * Tutto si comanda a voce (pulsante microfono). Dati in localStorage, chiavi "mr9.ali.*".
 * Piano: privato nel repository dati (alimentazione/piano.json, letto con window.Mr9Dati.leggi),
 * in cache in localStorage; senza repository usa il piano d'esempio di ali-dati.js.
 */
(function () {
  'use strict';

  var BASE = '#/alimentazione';
  var K = { spesa: 'mr9.ali.spesa', dispensa: 'mr9.ali.dispensa', diario: 'mr9.ali.diario', tipi: 'mr9.ali.tipoGiorno', menu: 'mr9.ali.menu', piano: 'mr9.ali.pianoCache', menuVisto: 'mr9.ali.menuVisto' };
  var PERCORSO_PIANO = 'alimentazione/piano.json';
  var GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var PRINCIPALI = { colazione: 1, pranzo: 1, cena: 1 };

  var stato = { root: null, percorso: [], data: oggiKey(), ricog: null, annulla: null, toastTimer: null };

  /* ---------- archivio ---------- */
  function leggi(k, def) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function scrivi(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memoria piena o privata */ }
    if (k === K.dispensa) salvaDispensaRemota();
    if (k === K.diario) salvaDiarioRemoto();
  }
  /* ---------- repository dati (window.Mr9Dati, definito da app.js) ---------- */
  var timerDisp = null;
  function dati() { return window.Mr9Dati && window.Mr9Dati.scrivi ? window.Mr9Dati : null; }
  function salvaDispensaRemota() {
    if (!dati()) return;
    clearTimeout(timerDisp);
    timerDisp = setTimeout(function () {
      var corpo = { formato: 'mr9-dispensa-v1', aggiornato: new Date().toISOString(), prodotti: leggi(K.dispensa, []) };
      Promise.resolve(dati().scrivi('alimentazione/dispensa.json', JSON.stringify(corpo, null, 1), 'Dispensa aggiornata dall\'app')).catch(function () {});
    }, 2500);
  }
  // Diario dei pasti nel repository dati (alimentazione/diario.json): lo legge il nutrizionista.
  var timerDia = null;
  function salvaDiarioRemoto() {
    if (!dati()) return;
    clearTimeout(timerDia);
    timerDia = setTimeout(function () {
      var dia = leggi(K.diario, {}), limite = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), giorni = {};
      Object.keys(dia).sort().forEach(function (k) { if (k >= limite && dia[k] && dia[k].length) giorni[k] = dia[k]; });
      var corpo = { formato: 'mr9-diario-pasti-v1', aggiornato: new Date().toISOString(), giorni: giorni };
      Promise.resolve(dati().scrivi('alimentazione/diario.json', JSON.stringify(corpo, null, 1), 'Diario pasti aggiornato dall\'app')).catch(function () {});
    }, 2500);
  }
  var menuChiesto = false;
  function caricaMenuChef() {
    var D = window.Mr9Dati;
    if (menuChiesto || !D || !D.leggi) return;
    menuChiesto = true;
    Promise.resolve(D.leggi('alimentazione/menu.json')).then(function (testo) {
      if (!testo) return;
      var m = JSON.parse(testo);
      if (!m || m.formato !== 'mr9-menu-v1' || !m.giorni) return;
      if (leggi(K.menuVisto, '') === m.aggiornato) return;
      var menu = leggi(K.menu, {}), oggi = oggiKey();
      m.giorni.forEach(function (g) {
        if (!g.data || g.data < oggi) return;
        menu[g.data] = {};
        (g.pasti || []).forEach(function (p) { if (p.id && p.piatto) menu[g.data][p.id] = { piatto: p.piatto, ricetta: p.ricetta || '' }; });
      });
      scrivi(K.menu, menu);
      var s = leggi(K.spesa, []);
      (m.spesa || []).forEach(function (a) { if (a && a.nome) aggiungiA(s, { nome: chiave(a.nome), q: a.q == null ? null : +a.q, u: a.u || (a.q == null ? null : 'pz') }, { origine: 'chef', preso: false }); });
      scrivi(K.spesa, s);
      scrivi(K.menuVisto, m.aggiornato || '');
      ridisegna();
      toast('Nuovo menu dello chef' + (m.spesa && m.spesa.length ? ', ' + m.spesa.length + ' prodotti in spesa' : ''), false);
    }).catch(function () { menuChiesto = false; });
  }
  function istantanea() { var s = {}; Object.keys(K).forEach(function (n) { s[K[n]] = leggi(K[n], null); }); return s; }
  function ripristina(s) { Object.keys(s).forEach(function (k) { if (s[k] === null) { try { localStorage.removeItem(k); } catch (e) {} } else scrivi(k, s[k]); }); }

  /* ---------- date ---------- */
  function oggiKey() { return dataKey(new Date()); }
  function dataKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function sposta(k, giorni) { var d = daKey(k); d.setDate(d.getDate() + giorni); return dataKey(d); }
  function etichettaData(k) {
    var d = daKey(k), o = oggiKey();
    var pre = k === o ? 'Oggi · ' : k === sposta(o, 1) ? 'Domani · ' : k === sposta(o, -1) ? 'Ieri · ' : '';
    return pre + GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
  }
  function oraAdesso() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ---------- piano ---------- */
  var pianoAttivo = null;
  function valido(p) { return p && p.tipi && p.settimana && p.settimana.length === 7 && p.settimana.every(function (t) { return p.tipi[t]; }); }
  function piano() {
    if (!pianoAttivo) { var c = leggi(K.piano, null); pianoAttivo = valido(c) ? c : window.Mr9AliPianoEsempio; }
    if (!pianoAttivo.pezzo) pianoAttivo.pezzo = {};
    return pianoAttivo;
  }
  var pianoChiesto = false;
  function caricaPiano() {
    if (pianoChiesto || !window.Mr9Dati || !window.Mr9Dati.leggi) return;
    pianoChiesto = true;
    Promise.resolve(window.Mr9Dati.leggi(PERCORSO_PIANO)).then(function (testo) {
      if (!testo) return;
      var p = JSON.parse(testo);
      if (!valido(p)) return;
      if (JSON.stringify(p) !== JSON.stringify(leggi(K.piano, null))) { scrivi(K.piano, p); pianoAttivo = p; ridisegna(); }
    }).catch(function () { pianoChiesto = false; });
  }
  function tipoDi(k) {
    var over = leggi(K.tipi, {});
    return over[k] || piano().settimana[daKey(k).getDay()];
  }
  function giornata(k) { var t = tipoDi(k); return { id: t, tipo: piano().tipi[t] }; }
  function trovaPasto(k, id) {
    var p = giornata(k).tipo.pasti;
    for (var i = 0; i < p.length; i++) if (p[i].id === id) return p[i];
    return null;
  }

  /* ---------- quantità e nomi ---------- */
  function chiave(nome) {
    return String(nome).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim()
      .replace(/^(il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle)\s+/, '').replace(/^l'|^un'/, '');
  }
  function stessa(a, b) {
    a = chiave(a); b = chiave(b);
    if (a === b) return true;
    var sa = a.replace(/[aeio]$/, ''), sb = b.replace(/[aeio]$/, '');
    if (sa.length > 2 && sa === sb) return true; // banana/banane, uovo/uova
    return (a.length > 3 && b.indexOf(a) === 0) || (b.length > 3 && a.indexOf(b) === 0);
  }
  function pesoPezzo(nome) {
    var pp = piano().pezzo;
    for (var nm in pp) if (stessa(nm, nome)) return pp[nm];
    return 0;
  }
  function fmtQ(q, u, nome) {
    if (q == null) return '';
    var pz = nome && pesoPezzo(nome);
    if (u === 'g' && pz) { var n = Math.round(q / pz * 2) / 2; return n.toString().replace('.', ',') + ' pz'; }
    if (u === 'g' && q >= 1000) return (Math.round(q / 100) / 10).toString().replace('.', ',') + ' kg';
    if (u === 'ml' && q >= 1000) return (Math.round(q / 100) / 10).toString().replace('.', ',') + ' l';
    return (Math.round(q * 10) / 10).toString().replace('.', ',') + ' ' + (u || 'pz');
  }

  /* ---------- interprete della voce (italiano) ---------- */
  var NUMERI = { 'un': 1, 'uno': 1, 'una': 1, "un'": 1, 'mezzo': 0.5, 'mezza': 0.5, 'due': 2, 'tre': 3, 'quattro': 4, 'cinque': 5,
    'sei': 6, 'sette': 7, 'otto': 8, 'nove': 9, 'dieci': 10, 'dodici': 12, 'quindici': 15, 'venti': 20, 'trenta': 30,
    'cinquanta': 50, 'cento': 100, 'centocinquanta': 150, 'duecento': 200, 'trecento': 300, 'quattrocento': 400,
    'cinquecento': 500, 'mille': 1000, 'paio': 2, 'un paio': 2 };
  var UNITA = [
    [/^(kg|chili|chilo|kili|kilo|chilogrammi|chilogrammo)$/, 'g', 1000],
    [/^(g|gr|grammi|grammo)$/, 'g', 1],
    [/^(etti|etto|hg)$/, 'g', 100],
    [/^(l|lt|litri|litro)$/, 'ml', 1000],
    [/^(ml|millilitri)$/, 'ml', 1],
    [/^(confezioni|confezione|pacchi|pacco|pacchetti|pacchetto|vasetti|vasetto|bottiglie|bottiglia|barattoli|barattolo|scatolette|scatoletta|buste|busta|vaschette|vaschetta)$/, 'conf', 1],
    [/^(pezzi|pezzo)$/, 'pz', 1]
  ];

  function leggiArticolo(t) {
    t = t.replace(/^(e|ed|poi|anche|pure|ancora)\s+/, '').replace(/[.!?;:]+$/, '').trim();
    if (!t) return null;
    var parole = t.split(/\s+/), q = null, u = null, i = 0;
    if (parole[0] === 'un' && parole[1] === 'paio') { q = 2; i = 2; if (parole[i] === 'di') i++; }
    else if (/^\d+([.,]\d+)?$/.test(parole[0])) { q = parseFloat(parole[0].replace(',', '.')); i = 1; }
    else if (/^\d+(kg|g|gr|l|ml)$/.test(parole[0])) { var m = parole[0].match(/^(\d+)(\D+)$/); q = +m[1]; parole.splice(1, 0, m[2]); i = 1; }
    else if (NUMERI[parole[0]] != null && parole.length > 1) { q = NUMERI[parole[0]]; i = 1; if (parole[i] === 'e' && parole[i + 1] === 'mezzo') { q += 0.5; i += 2; } }
    if (q != null && parole[i]) {
      for (var j = 0; j < UNITA.length; j++) {
        if (UNITA[j][0].test(parole[i])) { q = q * UNITA[j][2]; u = UNITA[j][1]; i++; break; }
      }
    }
    if (u === 'g' && q === 0.5 * 1000 && /mezz/.test(parole[0])) q = 500;
    if (q != null && !u) u = 'pz';
    var resto = parole.slice(i).join(' ').replace(/^(di|d'|del|della|dello|dei|delle|degli)\s*/, '');
    resto = chiave(resto);
    if (!resto) return null;
    if (u === 'pz') { // 6 uova -> 360 g, così si scalano col piano
      var pp = piano().pezzo;
      for (var nm in pp) if (stessa(nm, resto)) { q = q * pp[nm]; u = 'g'; break; }
    }
    return { nome: resto, q: q, u: u };
  }
  function leggiArticoli(t) {
    return t.split(/\s*,\s*|\s+e\s+(?!mezzo)|\s+ed\s+|\s+poi\s+|\s+più\s+/).map(leggiArticolo).filter(Boolean);
  }

  var RE_PASTI = [
    [/\bcolazione\b/, 'colazione'], [/\bpranzo\b|\ba pranzo\b/, 'pranzo'], [/\bdopo ?cena\b/, 'dopocena'], [/\bcena\b/, 'cena'],
    [/\bmerenda\b/, 'merenda'], [/\bspuntino\b/, 'spuntino'], [/\b(pasto[- ]?ponte|ponte)\b/, 'ponte'], [/\brientro\b/, 'rientro']
  ];

  function leggiPasto(t, contesto) {
    var pastoId = null;
    for (var i = 0; i < RE_PASTI.length; i++) if (RE_PASTI[i][0].test(t)) { pastoId = RE_PASTI[i][1]; break; }
    if (contesto && contesto.pasto && !pastoId) pastoId = contesto.pasto;
    var comePiano = /\b(come (da|nel|dal|previsto|in) ?(piano|programma|previsto)?|come previsto|tutto (ok|regolare|come previsto)|regolare)\b/.test(t) && !/\b(ma|però|tranne|invece|più|meno)\b/.test(t);
    var saltato = /\b(saltato|saltata|non ho mangiato|niente|nulla)\b/.test(t) && !/\bniente di\b/.test(t);
    var desc = t.replace(/^(a |per )?(colazione|pranzo|cena|merenda|spuntino|dopo ?cena|pasto[- ]?ponte|rientro)\s*,?\s*/, '')
      .replace(/^(ho mangiato|ho bevuto|mangiato|ho fatto)\s*/, '')
      .replace(/\s*(a|per|come) (colazione|pranzo|cena|merenda|spuntino)\s*$/, '').trim();
    return { tipo: 'pasto', pasto: pastoId, comeDaPiano: comePiano, saltato: saltato && !comePiano, testo: desc || t };
  }
  function sembraPasto(t) {
    return /\b(ho mangiato|mangiato|ho bevuto|ho saltato|saltato|saltata|come da piano|come previsto)\b/.test(t) ||
      RE_PASTI.some(function (r) { return r[0].test(t); });
  }

  function interpreta(testo, contesto) {
    var t = String(testo || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
    var m;
    if (!t) return { tipo: 'vuoto' };

    if (contesto && contesto.pasto) return leggiPasto(t, contesto);
    if (/\b(chef|menu|menù)\b/.test(t) && !/\b(ho mangiato|mangiato)\b/.test(t)) return { tipo: 'chef-menu' };

    // finito
    if ((m = t.match(/^(?:ho finito|ho terminato|è finit[oaie]|e' finit[oaie]|sono finit[ie]|finit[oaie]|non c'è più|non ce più|non c'è|non ho più|manca|mancano|esaurit[oaie])\s+(.+)$/))) {
      return { tipo: 'finito', articoli: leggiArticoli(m[1]) };
    }
    if ((m = t.match(/^(.+?)\s+(?:è|e'|sono)\s+(?:finit[oaie]|terminat[oaie]|esaurit[oaie])$/))) {
      return { tipo: 'finito', articoli: leggiArticoli(m[1]) };
    }
    // comprato
    if ((m = t.match(/^(?:ho comprato|ho preso|comprato|preso|ho fatto la spesa,?|presi|comprati)\s+(.+)$/))) {
      if (/^tutto$|^tutta la (lista|spesa)$/.test(m[1])) return { tipo: 'comprato-tutto' };
      return { tipo: 'comprato', articoli: leggiArticoli(m[1]) };
    }
    if (/^ho fatto la spesa$|^spesa fatta$/.test(t)) return { tipo: 'comprato-tutto' };
    // togli
    if ((m = t.match(/^(?:togli|rimuovi|cancella|elimina|leva)\s+(.+?)(?:\s+(?:dalla|dalle|dal|da)\s+(lista della spesa|lista|spesa|dispensa))?$/))) {
      return { tipo: 'togli', dove: m[2] === 'dispensa' ? 'dispensa' : (m[2] ? 'spesa' : (contesto && contesto.vista === 'dispensa' ? 'dispensa' : 'spesa')), articoli: leggiArticoli(m[1]) };
    }
    // dispensa
    if ((m = t.match(/^(?:in dispensa (?:ho|c'è|ci sono)|ho in (?:casa|dispensa)|in casa (?:ho|c'è|ci sono)|ho ancora)\s+(.+)$/)) ||
        (m = t.match(/^(?:aggiungi|metti|segna)\s+(.+?)\s+(?:in|alla|nella)\s+dispensa$/)) ||
        (m = t.match(/^(?:aggiungi|metti|segna)\s+(?:in|alla|nella)\s+dispensa\s+(.+)$/))) {
      return { tipo: 'dispensa', articoli: leggiArticoli(m[1]) };
    }
    // spesa
    if (/^(genera|prepara|fai|crea|calcola)( la)? (lista|spesa)/.test(t) || /spesa (della|per la) settimana/.test(t)) return { tipo: 'genera-spesa' };
    if ((m = t.match(/^(?:aggiungi|metti|segna|scrivi|compra|comprare|devo comprare|serve|servono|mi serve|mi servono|prendi|prendere|ricordami)\s+(.+?)(?:\s+(?:alla|nella|in)\s+(?:lista della spesa|lista|spesa))?$/))) {
      return { tipo: 'spesa', articoli: leggiArticoli(m[1].replace(/^(di comprare|di prendere)\s+/, '')) };
    }
    // nessun verbo riconosciuto: decide la schermata
    if (sembraPasto(t)) return leggiPasto(t, contesto);
    var v = contesto && contesto.vista;
    if (v === 'spesa') return { tipo: 'spesa', articoli: leggiArticoli(t) };
    if (v === 'dispensa') return { tipo: 'dispensa', articoli: leggiArticoli(t) };
    return leggiPasto(t, contesto);
  }

  /* ---------- azioni ---------- */
  function aggiungiA(lista, art, extra) {
    for (var i = 0; i < lista.length; i++) {
      if (stessa(lista[i].nome, art.nome)) {
        if (art.q != null) {
          if (lista[i].q != null && lista[i].u === art.u) lista[i].q += art.q;
          else { lista[i].q = art.q; lista[i].u = art.u; }
        }
        if (extra) for (var k in extra) lista[i][k] = extra[k];
        return lista[i];
      }
    }
    var n = { nome: art.nome, q: art.q, u: art.u };
    if (extra) for (var e in extra) n[e] = extra[e];
    lista.push(n);
    return n;
  }
  function togliDa(lista, art) {
    return lista.filter(function (x) { return !stessa(x.nome, art.nome); });
  }
  function scalaDispensa(ingredienti) {
    var d = leggi(K.dispensa, []);
    ingredienti.forEach(function (ing) {
      for (var i = 0; i < d.length; i++) {
        if (stessa(d[i].nome, ing[0]) && d[i].u === 'g' && d[i].q != null) { d[i].q = Math.max(0, d[i].q - ing[1]); }
      }
    });
    scrivi(K.dispensa, d.filter(function (x) { return x.q == null || x.q > 0; }));
  }
  function pastoAuto(k) {
    // il pasto del piano più vicino all'ora attuale tra quelli non ancora registrati
    var pasti = giornata(k).tipo.pasti, ora = new Date(), min = ora.getHours() * 60 + ora.getMinutes();
    var reg = (leggi(K.diario, {})[k] || []).map(function (e) { return e.pasto; });
    var best = null, dist = 1e9;
    pasti.forEach(function (p) {
      var hm = p.ora.split(':'), pm = +hm[0] * 60 + +hm[1], d2 = Math.abs(pm - min);
      if (reg.indexOf(p.id) < 0 && d2 < dist) { dist = d2; best = p; }
    });
    return best ? best.id : 'extra';
  }
  function registraPasto(k, ris) {
    var id = ris.pasto || pastoAuto(k);
    var p = trovaPasto(k, id);
    var dia = leggi(K.diario, {});
    var lista = (dia[k] || []).filter(function (e) { return id === 'extra' || e.pasto !== id; });
    var voce = { pasto: id, nome: p ? p.nome : nomeExtra(id), ora: oraAdesso(), comeDaPiano: !!ris.comeDaPiano && !!p, saltato: !!ris.saltato, testo: ris.comeDaPiano ? '' : ris.testo };
    lista.push(voce);
    dia[k] = lista;
    scrivi(K.diario, dia);
    if (voce.comeDaPiano && p) scalaDispensa(p.ingredienti);
    return voce;
  }
  function nomeExtra(id) { return { merenda: 'Merenda', spuntino: 'Spuntino', colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', dopocena: 'Dopo cena' }[id] || 'Fuori pasto'; }

  function generaSpesa(giorni) {
    var tot = {}, ordine = [];
    for (var g = 0; g < giorni; g++) {
      var k = sposta(oggiKey(), g);
      giornata(k).tipo.pasti.forEach(function (p) {
        p.ingredienti.forEach(function (ing) {
          var c = chiave(ing[0]);
          if (!tot[c]) { tot[c] = { nome: ing[0], q: 0 }; ordine.push(c); }
          tot[c].q += ing[1];
        });
      });
    }
    var disp = leggi(K.dispensa, []);
    var spesa = leggi(K.spesa, []).filter(function (x) { return x.origine !== 'piano' || x.preso; });
    var n = 0;
    ordine.forEach(function (c) {
      var r = tot[c], q = r.q;
      disp.forEach(function (d) { if (stessa(d.nome, r.nome) && d.u === 'g' && d.q != null) q -= d.q; });
      var haSenzaQ = disp.some(function (d) { return stessa(d.nome, r.nome) && d.q == null; });
      if (q <= 0 || haSenzaQ) return;
      q = q > 200 ? Math.ceil(q / 50) * 50 : Math.ceil(q / 10) * 10;
      var gia = spesa.filter(function (x) { return stessa(x.nome, r.nome) && !x.preso; })[0];
      if (gia) { if (gia.origine === 'voce' && gia.q == null) { gia.q = q; gia.u = 'g'; } return; }
      spesa.push({ nome: r.nome, q: q, u: 'g', origine: 'piano' });
      n++;
    });
    scrivi(K.spesa, spesa);
    return n;
  }

  function esegui(ris) {
    var snap = istantanea(), msg = '', k = stato.data;
    var nomi = function (a) { return a.map(function (x) { return x.nome + (x.q != null ? ' ' + fmtQ(x.q, x.u, x.nome) : ''); }).join(', '); };
    switch (ris.tipo) {
      case 'spesa': {
        var s = leggi(K.spesa, []);
        ris.articoli.forEach(function (a) { aggiungiA(s, a, { origine: 'voce', preso: false }); });
        scrivi(K.spesa, s); msg = 'Alla spesa: ' + nomi(ris.articoli); break;
      }
      case 'comprato': {
        var d = leggi(K.dispensa, []), s2 = leggi(K.spesa, []);
        ris.articoli.forEach(function (a) {
          var dallaLista = s2.filter(function (x) { return stessa(x.nome, a.nome); })[0];
          aggiungiA(d, a.q == null && dallaLista ? { nome: a.nome, q: dallaLista.q, u: dallaLista.u } : a);
          s2 = togliDa(s2, a);
        });
        scrivi(K.dispensa, d); scrivi(K.spesa, s2); msg = 'In dispensa: ' + nomi(ris.articoli); break;
      }
      case 'comprato-tutto': {
        var d3 = leggi(K.dispensa, []), s3 = leggi(K.spesa, []);
        s3.forEach(function (x) { aggiungiA(d3, x); });
        scrivi(K.dispensa, d3); scrivi(K.spesa, []); msg = 'Spesa fatta: ' + s3.length + ' prodotti in dispensa'; break;
      }
      case 'finito': {
        var d4 = leggi(K.dispensa, []), s4 = leggi(K.spesa, []);
        ris.articoli.forEach(function (a) { d4 = togliDa(d4, a); aggiungiA(s4, { nome: a.nome, q: null, u: null }, { origine: 'voce', preso: false }); });
        scrivi(K.dispensa, d4); scrivi(K.spesa, s4); msg = 'Finito, messo in lista: ' + nomi(ris.articoli); break;
      }
      case 'dispensa': {
        var d5 = leggi(K.dispensa, []);
        ris.articoli.forEach(function (a) { aggiungiA(d5, a); });
        scrivi(K.dispensa, d5); msg = 'In dispensa: ' + nomi(ris.articoli); break;
      }
      case 'togli': {
        var key = ris.dove === 'dispensa' ? K.dispensa : K.spesa, l = leggi(key, []);
        ris.articoli.forEach(function (a) { l = togliDa(l, a); });
        scrivi(key, l); msg = 'Tolto da ' + ris.dove + ': ' + nomi(ris.articoli); break;
      }
      case 'genera-spesa': {
        var n = generaSpesa(7); msg = n ? n + ' prodotti aggiunti dai prossimi 7 giorni' : 'Hai già tutto per i prossimi 7 giorni'; break;
      }
      case 'chef-menu': apriUrlClaude(promptMenu(3)); return;
      case 'pasto': {
        var v = registraPasto(k, ris);
        msg = v.nome + ': ' + (v.comeDaPiano ? 'come da piano' : v.saltato ? 'saltato' : v.testo); break;
      }
      default: msg = 'Non ho capito, riprova'; snap = null;
    }
    if (ris.articoli && !ris.articoli.length) { msg = 'Non ho capito i prodotti, riprova'; ripristina(snap); snap = null; }
    stato.annulla = snap;
    ridisegna();
    toast(msg, !!snap);
  }

  /* ---------- agente chef (Claude) ---------- */
  function promptChef(k, p) {
    var g = giornata(k), pi = piano();
    var righe = p.ingredienti.map(function (i) { return '- ' + i[0] + ': ' + fmtQ(i[1], 'g', i[0]) + (pesoPezzo(i[0]) ? ' (' + i[1] + ' g)' : ''); }).join('\n');
    var disp = leggi(K.dispensa, []).map(function (d) { return d.nome; }).slice(0, 40).join(', ');
    var piatto = piattoDi(k, p.id);
    return 'Sei il mio agente chef. Preparami la ricetta' + (piatto ? ' di «' + piatto + '»' : '') + ' per ' + p.nome.toLowerCase() + ' di ' + GIORNI[daKey(k).getDay()] +
      ' (' + g.tipo.nome.toLowerCase() + ', ore ' + p.ora + '), per 1 persona, con questi ingredienti e quantità a crudo:\n' + righe + '\n\n' +
      'Regole:\n- Rispetta le quantità; non aggiungere grassi oltre all\'olio indicato.\n' +
      (pi.nonPiacciono.length ? '- Non mi piacciono: ' + pi.nonPiacciono.join(', ') + '.\n' : '') +
      '- "Verdura cotta" a scelta tra: ' + pi.verduraCotta.join(', ') + '.\n' +
      (pi.regoleChef || []).map(function (r) { return '- ' + r + '\n'; }).join('') +
      (p.preApnea ? '- È il pasto prima di un\'apnea: digeribile, poco grasso, niente legumi, crucifere, crudo abbondante o bevande gassate.\n' : '') +
      '- Preparazione veloce (max 20-25 minuti), passi brevi e numerati, tempi e cottura.\n' +
      (disp ? '- In dispensa ho: ' + disp + '. Usa prima quello, sostituzioni solo equivalenti e segnalate.\n' : '') +
      '\nRispondi in italiano: titolo, tempo totale, passi numerati, un consiglio per variare.';
  }
  function voceMenu(k, id) { var m = leggi(K.menu, {}); return (m[k] && m[k][id]) || ''; }
  function piattoDi(k, id) { var v = voceMenu(k, id); return typeof v === 'string' ? v : (v.piatto || ''); }
  function ricettaDi(k, id) { var v = voceMenu(k, id); return typeof v === 'string' ? '' : (v.ricetta || ''); }
  function regoleChef() {
    var pi = piano();
    return '- Rispetta le grammature (a crudo); non aggiungere grassi oltre all\'olio indicato.\n' +
      '- Usa PRIMA quello che ho in dispensa, soprattutto i freschi che scadono prima; sostituzioni solo equivalenti (stessa categoria, grammi simili) e segnalale.\n' +
      (pi.nonPiacciono.length ? '- Non mi piacciono: ' + pi.nonPiacciono.join(', ') + '.\n' : '') +
      '- "Verdura cotta" a scelta tra: ' + pi.verduraCotta.join(', ') + '.\n' +
      '- Pasti segnati «prima dell\'apnea» e cena della sera prima di un\'apnea: digeribili, poco grassi, niente legumi, crucifere, molto crudo, gassate.\n' +
      (pi.regoleChef || []).map(function (r) { return '- ' + r + '\n'; }).join('') +
      '- Cucino io, piatti veloci (max 20-25 minuti); se conviene, una preparazione che vale per due pasti.\n';
  }
  function promptMenu(giorni) {
    var disp = leggi(K.dispensa, []);
    var righeDisp = disp.length ? disp.map(function (d) { return '- ' + d.nome + (d.q != null ? ': ' + fmtQ(d.q, d.u, d.nome) : ''); }).join('\n') : '- (vuota)';
    var piano3 = [];
    for (var g = 0; g < giorni; g++) {
      var k = sposta(stato.data, g), gi = giornata(k), d = daKey(k);
      piano3.push('\n' + GIORNI[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' (' + gi.tipo.nome + ')');
      gi.tipo.pasti.forEach(function (p) {
        piano3.push('- ' + p.nome + ' ' + p.ora + ': ' + p.ingredienti.map(function (i) { return i[0] + ' ' + i[1] + ' g'; }).join(', '));
      });
    }
    return 'Sei il mio agente chef. Organizza i pasti dei prossimi ' + giorni + ' giorni usando prima quello che ho in dispensa.\n\n' +
      'DISPENSA\n' + righeDisp + '\n\nPIANO (bozza, porzioni a crudo)' + piano3.join('\n') + '\n\nRegole:\n' + regoleChef() +
      '\nRispondi in italiano: per ogni giorno, un piatto concreto per ogni pasto con una riga su come si prepara. ' +
      'Alla fine metti ESATTAMENTE questi due blocchi, senza altro testo dopo, così la mia app li legge:\n' +
      'MENU\ngg/mm | nome del pasto come sopra | nome del piatto\n(una riga per pasto)\nSPESA\n- prodotto quantità\n(solo quello che manca in dispensa)';
  }
  function apriUrlClaude(q) {
    var url = 'https://claude.ai/new?q=' + encodeURIComponent(q);
    var w = null;
    try { w = window.open(url, '_blank'); } catch (e) { w = null; }
    if (!w) location.href = url;
  }
  function importaChef(testo) {
    var righe = String(testo || '').split(/\r?\n/), sez = '', menu = leggi(K.menu, {}), nMenu = 0, arts = [];
    var oggi = daKey(oggiKey());
    righe.forEach(function (r) {
      var t = r.replace(/[*_`]/g, '').trim();
      if (/^#*\s*menu\s*:?$/i.test(t)) { sez = 'menu'; return; }
      if (/^#*\s*spesa\s*:?$/i.test(t)) { sez = 'spesa'; return; }
      var m;
      if (sez === 'menu' && (m = t.match(/^(?:[^\d|]+\s+)?(\d{1,2})\/(\d{1,2})\s*\|\s*([^|]+?)\s*\|\s*(.+)$/))) {
        var d = new Date(oggi.getFullYear(), +m[2] - 1, +m[1]);
        if (d - oggi < -60 * 864e5) d.setFullYear(d.getFullYear() + 1);
        var k = dataKey(d), nomeP = m[3].toLowerCase(), pasti = giornata(k).tipo.pasti, id = null;
        pasti.forEach(function (p) { if (!id && (p.nome.toLowerCase() === nomeP || p.nome.toLowerCase().indexOf(nomeP) === 0 || nomeP.indexOf(p.id) >= 0)) id = p.id; });
        if (!id) RE_PASTI.forEach(function (rp) { if (!id && rp[0].test(nomeP)) id = rp[1]; });
        if (!id) return;
        menu[k] = menu[k] || {}; menu[k][id] = m[4].trim(); nMenu++;
      } else if (sez === 'spesa' && /^[-•*·]\s*/.test(r.trim())) {
        var a = leggiArticolo(chiave(t.replace(/^[-•*·]\s*/, '')).replace(/^(.+?)\s+(\d+[.,]?\d*\s*(?:kg|g|gr|grammi|l|ml|pz|pezzi|confezion[ei]))$/, '$2 di $1'));
        if (a) arts.push(a);
      }
    });
    if (!nMenu && !arts.length) { toast('Non trovo i blocchi MENU e SPESA nella risposta dello chef', false); return; }
    var snap = istantanea();
    scrivi(K.menu, menu);
    var s = leggi(K.spesa, []);
    arts.forEach(function (a) { aggiungiA(s, a, { origine: 'chef', preso: false }); });
    scrivi(K.spesa, s);
    stato.annulla = snap; ridisegna();
    toast('Chef: ' + nMenu + ' piatti nel menu, ' + arts.length + ' prodotti in spesa', true);
  }
  function apriIncolla() {
    var dopo = function (t) { if (t && /\bMENU\b|\bSPESA\b/i.test(t)) importaChef(t); else foglioIncolla(); };
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(dopo, foglioIncolla);
    else foglioIncolla();
  }
  function foglioIncolla() {
    chiudiVoce();
    var f = document.createElement('div');
    f.className = 'ali-foglio';
    f.innerHTML = '<div class="ali-foglio-fondo" data-act="chiudi-voce"></div><div class="ali-foglio-box" role="dialog" aria-label="Risposta dello chef">' +
      '<div class="ali-foglio-tit">Risposta dello chef</div><form class="ali-dettato" id="ali-incolla">' +
      '<textarea id="ali-testo-chef" rows="6" placeholder="Tieni premuto qui e scegli Incolla"></textarea>' +
      '<button class="ali-btn ali-btn-pri" type="submit">Importa menu e spesa</button></form>' +
      '<button class="ali-btn ali-btn-sec" data-act="chiudi-voce" type="button">Chiudi</button></div>';
    document.body.appendChild(f);
    stato.foglio = f;
    f.addEventListener('click', clic);
    f.querySelector('#ali-incolla').addEventListener('submit', function (ev) {
      ev.preventDefault(); var t = f.querySelector('#ali-testo-chef').value; chiudiVoce(); importaChef(t);
    });
    f.querySelector('#ali-testo-chef').focus();
  }
  function apriChef(k, id) {
    var p = trovaPasto(k, id); if (!p) return;
    var q = promptChef(k, p);
    var url = 'https://claude.ai/new?q=' + encodeURIComponent(q);
    var w = null;
    try { w = window.open(url, '_blank'); } catch (e) { w = null; }
    if (!w) location.href = url;
  }
  function copiaChef(k, id) {
    var p = trovaPasto(k, id); if (!p) return;
    copia(promptChef(k, p), 'Richiesta copiata: incollala nella chat con Claude');
  }
  function copia(testo, ok) {
    var fatto = function () { stato.annulla = null; toast(ok, false); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(testo).then(fatto, function () { vecchiaCopia(testo); fatto(); });
    else { vecchiaCopia(testo); fatto(); }
  }
  function vecchiaCopia(t) {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
  }

  /* ---------- voce ---------- */
  function SR() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
  function vista() { return stato.percorso[0] || 'oggi'; }

  function apriVoce(preset) {
    chiudiVoce();
    var tt = document.getElementById('ali-toast'); if (tt) tt.classList.remove('ali-on');
    var ctx = { vista: vista(), pasto: preset || null };
    var esempi = {
      oggi: ['«A pranzo come da piano»', '«A cena ho mangiato pizza margherita e una birra»', '«Ho saltato lo spuntino»'],
      pasto: ['«Come da piano»', '«Ho mangiato riso con pollo invece del pesce»'],
      spesa: ['«Aggiungi latte, 2 kg di riso e caffè»', '«Ho comprato il riso e le banane»', '«Genera la spesa della settimana»'],
      dispensa: ['«Ho finito il miele»', '«In dispensa ho 3 scatolette di tonno»', '«Togli le noci»'],
      diario: ['«A colazione come da piano»', '«Merenda: un gelato»']
    }[ctx.vista === 'pasto' ? 'pasto' : ctx.vista] || [];
    var titolo = preset ? 'Cosa hai mangiato a ' + (trovaPasto(stato.data, preset) || { nome: 'questo pasto' }).nome.toLowerCase() + '?' : 'Dimmi';
    var foglio = document.createElement('div');
    foglio.className = 'ali-foglio';
    foglio.innerHTML =
      '<div class="ali-foglio-fondo" data-act="chiudi-voce"></div>' +
      '<div class="ali-foglio-box" role="dialog" aria-label="Comando vocale">' +
      '<div class="ali-foglio-tit">' + esc(titolo) + '</div>' +
      '<div class="ali-onda" id="ali-onda"><span></span><span></span><span></span><span></span><span></span></div>' +
      '<div class="ali-trascritto" id="ali-trascritto" aria-live="polite"></div>' +
      '<form class="ali-dettato" id="ali-dettato" hidden>' +
      '<textarea id="ali-testo" rows="2" placeholder="Tocca il microfono della tastiera e parla" enterkeyhint="send"></textarea>' +
      '<button class="ali-btn ali-btn-pri" type="submit">Fatto</button>' +
      '<p class="ali-pic">Su iPhone usa il tasto 🎤 della tastiera: il testo arriva qui da solo.</p></form>' +
      '<ul class="ali-esempi">' + esempi.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' +
      '<button class="ali-btn ali-btn-sec" data-act="chiudi-voce" type="button">Chiudi</button>' +
      '</div>';
    document.body.appendChild(foglio);
    stato.foglio = foglio;
    stato.ctx = ctx;
    foglio.addEventListener('click', clic);
    var form = foglio.querySelector('#ali-dettato');
    var ta = foglio.querySelector('#ali-testo');
    form.addEventListener('submit', function (ev) { ev.preventDefault(); concludi(ta.value); });
    ta.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); concludi(ta.value); } });

    var C = SR();
    var mostraDettato = function () {
      foglio.querySelector('#ali-onda').hidden = true;
      form.hidden = false;
      ta.focus();
    };
    if (!C) { mostraDettato(); return; }
    try {
      var r = new C();
      r.lang = 'it-IT'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      var finale = '', partito = false;
      r.onstart = function () { partito = true; foglio.classList.add('ali-ascolto'); };
      r.onresult = function (ev) {
        var tmp = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) finale += ev.results[i][0].transcript; else tmp += ev.results[i][0].transcript;
        }
        var el = foglio.querySelector('#ali-trascritto'); if (el) el.textContent = finale + tmp;
      };
      r.onerror = function (ev) {
        stato.ricog = null;
        if (ev.error === 'no-speech' || ev.error === 'aborted') return;
        mostraDettato();
      };
      r.onend = function () {
        foglio.classList.remove('ali-ascolto');
        stato.ricog = null;
        if (finale.trim()) concludi(finale);
        else if (partito && stato.foglio === foglio) mostraDettato();
      };
      stato.ricog = r;
      r.start();
    } catch (e) { mostraDettato(); }
  }
  function concludi(testo) {
    testo = String(testo || '').trim();
    if (!testo) return;
    var ctx = stato.ctx || {};
    chiudiVoce();
    esegui(interpreta(testo, ctx));
  }
  function chiudiVoce() {
    if (stato.ricog) { try { stato.ricog.abort(); } catch (e) {} stato.ricog = null; }
    if (stato.foglio && stato.foglio.parentNode) stato.foglio.parentNode.removeChild(stato.foglio);
    stato.foglio = null;
  }

  /* ---------- interfaccia ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function toast(msg, conAnnulla) {
    var t = document.getElementById('ali-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ali-toast'; t.className = 'ali-toast'; document.body.appendChild(t); t.addEventListener('click', clic); }
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (conAnnulla ? '<button data-act="annulla" type="button">Annulla</button>' : '');
    t.classList.add('ali-on');
    clearTimeout(stato.toastTimer);
    stato.toastTimer = setTimeout(function () { t.classList.remove('ali-on'); stato.annulla = null; }, 5000);
  }

  function schede() {
    var v = vista() === 'pasto' ? 'oggi' : vista();
    var tabs = [['oggi', 'Giorno'], ['spesa', 'Spesa'], ['dispensa', 'Dispensa'], ['diario', 'Diario']];
    var nSpesa = leggi(K.spesa, []).filter(function (x) { return !x.preso; }).length;
    return '<nav class="ali-schede">' + tabs.map(function (t) {
      var href = t[0] === 'oggi' ? BASE : BASE + '/' + t[0];
      return '<a href="' + href + '" class="' + (v === t[0] ? 'ali-on' : '') + '">' + t[1] +
        (t[0] === 'spesa' && nSpesa ? ' <b>' + nSpesa + '</b>' : '') + '</a>';
    }).join('') + '</nav>';
  }

  function vistaOggi() {
    var k = stato.data, g = giornata(k), pi = piano();
    var reg = {}; (leggi(K.diario, {})[k] || []).forEach(function (e) { reg[e.pasto] = e; });
    var h = '<div class="ali-giorno">' +
      '<button class="ali-freccia" data-act="giorno" data-d="-1" aria-label="Giorno prima">‹</button>' +
      '<div class="ali-giorno-c"><div class="ali-data">' + esc(etichettaData(k)) + '</div>' +
      '<button class="ali-tipo" data-act="tipo" style="--c:' + g.tipo.colore + '">' + esc(g.tipo.nome) + ' ▾</button></div>' +
      '<button class="ali-freccia" data-act="giorno" data-d="1" aria-label="Giorno dopo">›</button></div>';
    if (pi.stato !== 'approvato' && pi.avviso) h += '<div class="ali-bozza">' + esc(pi.avviso) + '</div>';
    h += '<div class="ali-pasti">';
    g.tipo.pasti.forEach(function (p) {
      var r = reg[p.id], princ = PRINCIPALI[p.id];
      h += '<a class="ali-pasto' + (princ ? ' ali-princ' : '') + (r ? ' ali-fatto' : '') + '" href="' + BASE + '/pasto/' + p.id + '">' +
        '<div class="ali-pasto-t"><span class="ali-ora">' + esc(p.ora) + '</span><span class="ali-nome">' + esc(p.nome) + '</span>' +
        (r ? '<span class="ali-stato">' + (r.comeDaPiano ? '✓' : r.saltato ? '–' : '✎') + '</span>' : '<span class="ali-va">›</span>') + '</div>' +
        (piattoDi(k, p.id) ? '<div class="ali-piatto">' + esc(piattoDi(k, p.id)) + '</div>' : '') +
        '<div class="ali-ingr-breve">' + esc(p.ingredienti.map(function (i) { return i[0]; }).join(' · ')) + '</div>' +
        (r && !r.comeDaPiano ? '<div class="ali-reg">' + esc(r.saltato ? 'Saltato' : r.testo) + '</div>' : '') +
        '</a>';
    });
    h += '</div>';
    var extra = (leggi(K.diario, {})[k] || []).filter(function (e) { return !trovaPasto(k, e.pasto); });
    if (extra.length) h += '<div class="ali-extra">' + extra.map(function (e) { return '<div><b>' + esc(e.nome) + ' ' + esc(e.ora) + '</b> ' + esc(e.testo) + '</div>'; }).join('') + '</div>';
    if (g.tipo.kcal) h += '<div class="ali-tot">' + esc(g.tipo.kcal + (g.tipo.prot ? ' · ' + g.tipo.prot : '')) + ' <span>(stima, ±10-15%)</span></div>';
    h += '<div class="ali-chef"><div class="ali-chef-t">👨‍🍳 Agente chef</div>' +
      '<p>Decide i piatti dei prossimi 3 giorni partendo da quello che hai in dispensa (' + leggi(K.dispensa, []).length + ' prodotti) e ti dice cosa manca.</p>' +
      '<button class="ali-btn ali-btn-pri" data-act="chef-menu">Menu dei prossimi 3 giorni</button>' +
      '<button class="ali-link" data-act="chef-incolla">Ho la risposta: importa menu e spesa</button></div>';
    return h;
  }

  function vistaPasto(id) {
    var k = stato.data, p = trovaPasto(k, id), pi = piano();
    if (!p) return '<p class="ali-vuoto">Pasto non trovato. <a href="' + BASE + '">Torna al giorno</a></p>';
    var disp = leggi(K.dispensa, []);
    var r = (leggi(K.diario, {})[k] || []).filter(function (e) { return e.pasto === id; })[0];
    var h = '<a class="ali-indietro" href="' + BASE + '">‹ ' + esc(etichettaData(k)) + '</a>' +
      '<div class="ali-det-tit"><span class="ali-ora">' + esc(p.ora) + '</span><h2>' + esc(p.nome) + '</h2></div>' +
      (piattoDi(k, id) ? '<p class="ali-piatto ali-piatto-g">' + esc(piattoDi(k, id)) + '</p>' : '') +
      (p.nota ? '<p class="ali-nota">' + esc(p.nota) + '</p>' : '') +
      (p.preApnea ? '<p class="ali-avv">Prima dell\'acqua: niente legumi, crucifere, molto crudo, gassate.</p>' : '') +
      '<ul class="ali-ingr">';
    p.ingredienti.forEach(function (i) {
      var c = disp.filter(function (d) { return stessa(d.nome, i[0]); })[0];
      var pz = pesoPezzo(i[0]);
      h += '<li><span class="ali-in-n">' + esc(i[0]) + (c ? ' <i class="ali-hai" title="In dispensa">●</i>' : '') + '</span>' +
        '<span class="ali-in-q">' + esc(pz ? fmtQ(i[1], 'g', i[0]) + ' · ' + i[1] + ' g' : i[1] + ' g') + '</span></li>';
    });
    h += '</ul>';
    if (/verdura cotta/.test(p.ingredienti.map(function (i) { return i[0]; }).join())) h += '<p class="ali-pic">Verdura cotta a scelta: ' + esc(pi.verduraCotta.join(', ')) + '.</p>';
    if (ricettaDi(k, id)) h += '<div class="ali-ricetta"><div class="ali-chef-t">👨‍🍳 Ricetta dello chef</div><p>' + esc(ricettaDi(k, id)).replace(/\n/g, '<br>') + '</p></div>';
    h += '<button class="ali-btn ali-btn-chef" data-act="chef" data-id="' + esc(id) + '">👨‍🍳 ' + (ricettaDi(k, id) ? 'Chiedi altro allo chef' : 'Ricetta') + '</button>' +
      '<button class="ali-link" data-act="chef-copia" data-id="' + esc(id) + '">Copia la richiesta per Claude</button>';
    h += '<div class="ali-det-reg">' + (r ? '<div class="ali-reg">' + esc(r.comeDaPiano ? '✓ Mangiato come da piano alle ' + r.ora : r.saltato ? 'Saltato' : '✎ ' + r.testo) + '</div>' : '') +
      '<div class="ali-due"><button class="ali-btn ali-btn-ok" data-act="come-piano" data-id="' + esc(id) + '">✓ Come da piano</button>' +
      '<button class="ali-btn ali-btn-sec" data-act="voce" data-id="' + esc(id) + '">🎙 Ho mangiato altro</button></div></div>';
    return h;
  }

  function vistaSpesa() {
    var s = leggi(K.spesa, []);
    var h = '<div class="ali-sez-t"><h2>Lista della spesa</h2></div>';
    if (!s.length) {
      h += '<p class="ali-vuoto">Lista vuota. Di\' «aggiungi latte e caffè», oppure genera la spesa dal piano dei prossimi 7 giorni.</p>';
    } else {
      h += '<ul class="ali-lista">' + s.map(function (x, i) {
        return '<li class="' + (x.preso ? 'ali-preso' : '') + '"><button data-act="spunta" data-i="' + i + '" aria-label="Preso">' + (x.preso ? '✓' : '') + '</button>' +
          '<span class="ali-l-n">' + esc(x.nome) + '</span><span class="ali-l-q">' + esc(fmtQ(x.q, x.u, x.nome)) + '</span>' +
          (x.origine === 'piano' || x.origine === 'chef' ? '<i class="ali-orig">' + x.origine + '</i>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    h += '<div class="ali-due"><button class="ali-btn ali-btn-sec" data-act="genera">Genera dai prossimi 7 giorni</button>' +
      (s.some(function (x) { return x.preso; }) ? '<button class="ali-btn ali-btn-ok" data-act="in-dispensa">Presi → dispensa</button>' : '') + '</div>' +
      (s.length ? '<button class="ali-link" data-act="condividi-spesa">Condividi la lista</button>' : '') +
      '<p class="ali-pic">Frutta e verdura sono a peso indicativo; i prodotti già in dispensa vengono scalati.</p>';
    return h;
  }

  function vistaDispensa() {
    var d = leggi(K.dispensa, []);
    var h = '<div class="ali-sez-t"><h2>Dispensa</h2></div>';
    if (!d.length) h += '<p class="ali-vuoto">Vuota. Quando torni dalla spesa di\' «ho comprato tutto», oppure «in dispensa ho riso, pasta e 6 uova».</p>';
    else h += '<ul class="ali-lista ali-disp">' + d.map(function (x) {
      return '<li><span class="ali-l-n">' + esc(x.nome) + '</span><span class="ali-l-q">' + esc(fmtQ(x.q, x.u, x.nome)) + '</span></li>';
    }).join('') + '</ul>';
    h += '<p class="ali-pic">Quando segni un pasto «come da piano», le quantità usate vengono scalate da sole.</p>';
    return h;
  }

  function vistaDiario() {
    var dia = leggi(K.diario, {}), h = '<div class="ali-sez-t"><h2>Diario dei pasti</h2></div>';
    for (var g = 0; g < 7; g++) {
      var k = sposta(oggiKey(), -g), gi = giornata(k), reg = dia[k] || [];
      h += '<div class="ali-dia-g"><div class="ali-dia-t"><b>' + esc(etichettaData(k)) + '</b><span style="color:' + gi.tipo.colore + '">' + esc(gi.tipo.breve) + '</span></div><ul>';
      gi.tipo.pasti.forEach(function (p) {
        var r = reg.filter(function (e) { return e.pasto === p.id; })[0];
        h += '<li class="' + (r ? '' : 'ali-manca') + '"><span>' + esc(p.nome) + '</span><span>' + esc(r ? (r.comeDaPiano ? '✓ come da piano' : r.saltato ? 'saltato' : r.testo) : '—') + '</span></li>';
      });
      reg.filter(function (e) { return !trovaPasto(k, e.pasto); }).forEach(function (e) {
        h += '<li><span>' + esc(e.nome) + ' ' + esc(e.ora) + '</span><span>' + esc(e.testo) + '</span></li>';
      });
      h += '</ul></div>';
    }
    h += '<button class="ali-btn ali-btn-sec" data-act="condividi-diario">Condividi la settimana (per la nutrizionista o il coach)</button>';
    return h;
  }

  function testoDiario() {
    var dia = leggi(K.diario, {}), out = ['Diario pasti, ultimi 7 giorni (piano: ' + piano().versione + ')'];
    for (var g = 6; g >= 0; g--) {
      var k = sposta(oggiKey(), -g), gi = giornata(k), reg = dia[k] || [];
      out.push('', etichettaData(k).replace(/^(Oggi|Ieri|Domani) · /, '') + ' (' + gi.tipo.nome + ')');
      gi.tipo.pasti.forEach(function (p) {
        var r = reg.filter(function (e) { return e.pasto === p.id; })[0];
        out.push('- ' + p.nome + ': ' + (r ? (r.comeDaPiano ? 'come da piano (' + r.ora + ')' : r.saltato ? 'saltato' : r.testo + ' (' + r.ora + ')') : 'non registrato'));
      });
      reg.filter(function (e) { return !trovaPasto(k, e.pasto); }).forEach(function (e) { out.push('- ' + e.nome + ' ' + e.ora + ': ' + e.testo); });
    }
    return out.join('\n');
  }
  function condividi(testo, titolo) {
    if (navigator.share) { navigator.share({ title: titolo, text: testo }).catch(function () {}); }
    else copia(testo, 'Copiato negli appunti');
  }

  function ridisegna() {
    if (!stato.root) return;
    var v = vista(), corpo;
    if (v === 'pasto') corpo = vistaPasto(stato.percorso[1]);
    else if (v === 'spesa') corpo = vistaSpesa();
    else if (v === 'dispensa') corpo = vistaDispensa();
    else if (v === 'diario') corpo = vistaDiario();
    else corpo = vistaOggi();
    stato.root.innerHTML = '<div class="ali">' + (v === 'pasto' ? '' : '<div class="ali-eyebrow">Alimentazione</div>' + schede()) +
      '<div class="ali-corpo">' + corpo + '</div>' +
      '<button class="ali-mic" data-act="voce" aria-label="Parla"><span>🎙</span></button></div>';
  }

  function clic(ev) {
    var b = ev.target.closest('[data-act]');
    if (!b) return;
    var a = b.getAttribute('data-act'), k = stato.data;
    if (a !== 'annulla') ev.preventDefault();
    switch (a) {
      case 'voce': apriVoce(b.getAttribute('data-id') || (vista() === 'pasto' ? stato.percorso[1] : null)); break;
      case 'chiudi-voce': chiudiVoce(); break;
      case 'giorno': stato.data = sposta(k, +b.getAttribute('data-d')); ridisegna(); break;
      case 'tipo': {
        var ord = Object.keys(piano().tipi), over = leggi(K.tipi, {});
        var cur = tipoDi(k), nx = ord[(ord.indexOf(cur) + 1) % ord.length];
        if (nx === piano().settimana[daKey(k).getDay()]) delete over[k]; else over[k] = nx;
        scrivi(K.tipi, over); ridisegna(); break;
      }
      case 'chef': apriChef(k, b.getAttribute('data-id')); break;
      case 'chef-copia': copiaChef(k, b.getAttribute('data-id')); break;
      case 'chef-menu': apriUrlClaude(promptMenu(3)); break;
      case 'chef-incolla': apriIncolla(); break;
      case 'come-piano': esegui({ tipo: 'pasto', pasto: b.getAttribute('data-id'), comeDaPiano: true, testo: '' }); break;
      case 'spunta': { var s = leggi(K.spesa, []), i = +b.getAttribute('data-i'); if (s[i]) s[i].preso = !s[i].preso; scrivi(K.spesa, s); ridisegna(); break; }
      case 'in-dispensa': {
        var snap = istantanea(), s2 = leggi(K.spesa, []), d = leggi(K.dispensa, []);
        s2.filter(function (x) { return x.preso; }).forEach(function (x) { aggiungiA(d, x); });
        scrivi(K.dispensa, d); scrivi(K.spesa, s2.filter(function (x) { return !x.preso; }));
        stato.annulla = snap; ridisegna(); toast('Presi spostati in dispensa', true); break;
      }
      case 'genera': esegui({ tipo: 'genera-spesa' }); break;
      case 'condividi-spesa': condividi(leggi(K.spesa, []).filter(function (x) { return !x.preso; }).map(function (x) { return '• ' + x.nome + (x.q != null ? ' ' + fmtQ(x.q, x.u, x.nome) : ''); }).join('\n'), 'Lista della spesa'); break;
      case 'condividi-diario': condividi(testoDiario(), 'Diario pasti'); break;
      case 'annulla': if (stato.annulla) { ripristina(stato.annulla); stato.annulla = null; ridisegna(); toast('Annullato', false); } break;
    }
  }

  window.Mr9Alimentazione = {
    mount: function (el, opz) {
      if (stato.root) stato.root.removeEventListener('click', clic);
      el.removeEventListener('click', clic);
      stato.root = el;
      stato.percorso = (opz && opz.percorso) || [];
      el.addEventListener('click', clic);
      ridisegna();
      caricaPiano();
      caricaMenuChef();
    },
    unmount: function () {
      chiudiVoce();
      if (stato.root) stato.root.removeEventListener('click', clic);
      stato.root = null;
    },
    // esposto per i test
    _interpreta: interpreta,
    _testoDiario: testoDiario,
    _importaChef: importaChef,
    _promptMenu: function () { return promptMenu(3); }
  };
})();
