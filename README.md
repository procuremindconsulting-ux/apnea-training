# Mr. 9 Training

Web app di allenamento per apnea agonistica (statica e dinamica).

Sezioni: **Allenamento fisico** (palestra e aerobico, attiva), **Apnea**, **Mentale**, **Alimentazione** (predisposte, ancora vuote).

## Come funziona il ciclo con il coach

1. Il coach pianificato (un'attività Claude che gira ogni giorno) legge i piani e gli esiti nel repository privato `apnea-training-database` e scrive le prossime sedute in `fisico/coda.json`.
2. L'app, collegata una volta sola con un token GitHub (Fisico → Collega il coach), legge la coda ogni volta che la apri e mostra solo la seduta corrente.
3. Ogni esercizio ha il suo timer già pronto, con un solo pulsante:
   - serie con recupero a tocco (fai la serie, tocchi, parte il recupero, poi si azzera; a fine esercizio lo stesso tocco porta avanti);
   - esercizi a tempo (plank) con lavoro e recupero automatici;
   - interval timer per corsa, bici e nuoto, con segnali acustici e vibrazione a ogni cambio fase.
4. A fine seduta rispondi a 2-3 domande e confermi: l'esito viene salvato in `fisico/esiti/` del repository dati.
5. Al controllo successivo il coach legge l'esito, adatta le sedute e aggiorna la coda.

Senza collegamento l'app funziona lo stesso a mano: carichi la scheda incollando il JSON e condividi l'esito con la chat del coach.

Il formato dei dati è in [docs/FORMATO.md](docs/FORMATO.md). Piani, istruzioni del coach, coda ed esiti stanno nel repository privato `apnea-training-database`: questo repository contiene solo il codice dell'app e non deve contenere dati personali.

## Struttura

- `index.html`, `app.css`, `app.js`: l'app, senza dipendenze né build.
- `esempi/scheda-esempio.json`: scheda di prova (Fisico → Collega il coach → Caricare una scheda a mano → Opzioni → Carica una scheda di esempio).
- `img/esercizi/<id>.webp`: immagini degli esercizi (in arrivo); l'app le trova dall'`id` dell'esercizio.
- Sul telefono restano la seduta in corso e lo storico (localStorage); sedute ed esiti condivisi stanno nel repository privato `apnea-training-database`.

## Provarla in locale

```
python3 -m http.server 8000
```

e apri http://localhost:8000.
