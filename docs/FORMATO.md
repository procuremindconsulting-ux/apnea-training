# Formato dati: scheda ed esito

L'app e il coach (le chat Claude del progetto "Mr. 9 Minutes") si scambiano due tipi di messaggio in JSON:

1. **Scheda** (`mr9-scheda-v1`): il coach → l'app. Contiene una o più sedute.
2. **Esito** (`mr9-esito-v1`): l'app → il coach. Viene creato quando confermi una seduta.

L'app mostra sempre e solo la prima seduta non ancora confermata. Le altre restano nascoste e compaiono una alla volta.

## Scheda (`mr9-scheda-v1`)

```json
{
  "formato": "mr9-scheda-v1",
  "sezione": "fisico",
  "note_coach": "Messaggio breve mostrato nella pagina Fisico (facoltativo)",
  "sedute": [ { …seduta… } ]
}
```

### Seduta

| Campo | Obbligatorio | Significato |
|---|---|---|
| `id` | sì | identificativo unico, es. `"2026-11-16-forza"` |
| `titolo` | sì | es. `"Forza – Lunedì completa"` |
| `tipo` | no | `palestra`, `corsa`, `nuoto`, `bici`, `misto` (pagina Fisico), `apnea` (pagina Apnea, vedi *Sedute di apnea*), `mentale` (pagina Mentale, vedi *Sedute mentali*) |
| `data` | no | data prevista `AAAA-MM-GG` |
| `durata_stimata_min` | no | minuti |
| `note` | no | indicazioni generali, mostrate prima di iniziare |
| `esercizi` | sì | elenco di esercizi (vedi sotto) |
| `domande` | no | domande di fine seduta; se assenti l'app usa 3 domande standard |

### Esercizio: quattro tipi (il quarto, `apnee`, è descritto in *Sedute di apnea*)

Campi comuni: `id` (consigliato, serve anche per l'immagine), `nome`, `tipo`, `note`, `condizione` (avviso mostrato in giallo, es. "Solo se il dolore è al massimo 2/10"), `immagine` (URL; se manca l'app cerca `img/esercizi/<id>.webp`).

**`serie`**: serie e ripetizioni con recupero a tocco.

```json
{ "id": "squat", "nome": "Squat", "tipo": "serie",
  "serie": 3, "ripetizioni": 6, "carico": "95% del CR", "rir": 3,
  "recupero_s": 150, "recupero_dopo_s": 180 }
```

- `ripetizioni` può essere un numero o un testo (`"10 per gamba"`).
- Per gli esercizi a tempo (plank, isometrie) si usa `lavoro_s` al posto di `ripetizioni`: il tocco avvia il conto alla rovescia del lavoro, poi parte da solo il recupero.
- `rir` oppure `rpe` (facoltativi): se presenti, l'app chiede di registrarli per ogni serie.
- `recupero_dopo_s` (facoltativo): recupero dopo l'ultima serie, prima dell'esercizio successivo.

**`circuito`**: giri di più esercizi, con recupero tra un giro e l'altro.

```json
{ "id": "core", "nome": "Core", "tipo": "circuito", "giri": 3, "recupero_s": 60,
  "voci": [ { "nome": "Plank", "lavoro_s": 40 }, { "nome": "Dead bug", "ripetizioni": "8 per lato" } ] }
```

**`intervalli`**: interval timer preconfigurato (corsa, bici, nuoto, riscaldamenti a tempo).

```json
{ "id": "ripetute", "nome": "Ripetute", "tipo": "intervalli",
  "fasi": [
    { "nome": "Corsa lenta", "durata_s": 300, "intensita": "facile" },
    { "ripeti": 3, "fasi": [
      { "nome": "Veloce", "durata_s": 180, "intensita": "forte" },
      { "nome": "Recupero", "durata_s": 60, "intensita": "recupero" } ] },
    { "nome": "Allunghi 4 × 80 m", "intensita": "massimale" },
    { "nome": "Nuoto 400 m", "metri": 400, "intensita": "medio" }
  ] }
```

- `intensita`: `facile`, `recupero`, `medio`, `forte`, `massimale` (decide il colore).
- Una fase senza `durata_s` è libera (a distanza o a sensazione): il cronometro conta in avanti e si passa alla fase dopo con il tasto ›.
- `ripeti` + `fasi` crea un blocco ripetuto.

### Domande di fine seduta

```json
"domande": [
  { "id": "impegno", "testo": "Impegno percepito", "tipo": "scala", "min": 1, "max": 10, "etichette": ["Facilissima", "Massimale"] },
  { "id": "dolore", "testo": "Dolore articolare", "tipo": "scala", "min": 0, "max": 10 },
  { "id": "fc", "testo": "FC media", "tipo": "numero", "unita": "bpm" },
  { "id": "sostituzione", "testo": "Hai fatto bici al posto della corsa?", "tipo": "scelta", "opzioni": ["No", "Sì"] },
  { "id": "dolori", "testo": "Dolori o fastidi?", "tipo": "testo" }
]
```

Le domande `scala`, `numero` e `scelta` sono obbligatorie, salvo `"facoltativa": true`; quelle `testo` sono sempre facoltative.

## Esito (`mr9-esito-v1`)

```json
{
  "formato": "mr9-esito-v1",
  "seduta_id": "2026-11-16-forza",
  "titolo": "Forza – Lunedì completa",
  "inizio": "2026-11-16T18:30:00.000Z",
  "fine": "2026-11-16T19:38:00.000Z",
  "durata_min": 68,
  "esercizi": [
    { "id": "squat", "nome": "Squat", "tipo": "serie", "stato": "fatto",
      "prescritto": { "serie": 3, "ripetizioni": 6, "carico": "95% del CR", "rir": 3, "recupero_s": 150 },
      "serie_eseguite": [ { "n": 1, "rip": 6, "carico": 70, "rir": 3 }, { "n": 2, "rip": 6, "carico": 70, "rir": 2 } ],
      "note": "seconda serie più dura" },
    { "id": "core", "tipo": "circuito", "stato": "fatto", "prescritto": { "giri": 3 }, "giri_fatti": 3 },
    { "id": "corsa", "tipo": "intervalli", "stato": "parziale", "fasi_totali": 10, "fasi_completate": 7, "tempo_s": 1980 }
  ],
  "risposte": [ { "id": "impegno", "domanda": "Impegno percepito", "valore": 6 } ],
  "note_finali": "…"
}
```

`stato` di un esercizio: `fatto`, `parziale`, `saltato`, `non_fatto`.

## Una coda, tre pagine

Tutte le sedute stanno in `fisico/coda.json` e tutti gli esiti in `fisico/esiti/`. L'app le divide per `tipo`: `apnea` nella pagina **Apnea** (le scrive Dave), `mentale` nella pagina **Mentale** (le scrive Gus), tutte le altre in **Fisico** (Papa Swolio e Kilian). Ogni pagina mostra solo la propria prossima seduta; una sola seduta per volta può essere in corso. Ogni agente cambia solo le sedute del proprio tipo. L'esito porta `"sezione"`: `fisico`, `apnea` o `mentale`.

## Sedute di apnea (Dave)

Seduta con `"tipo": "apnea"` e, facoltativi: `"disciplina"` (`statica`, `dinamica`, `secco`), `"sforzo_max"` (tetto di sforzo 0-10 mostrato prima di iniziare), `"compagno"` (nome mostrato nel controllo di sicurezza), `"sicurezza"` (elenco di frasi da spuntare; se manca l'app usa le sue tre). Gli esercizi in acqua sono di tipo **`apnee`**; si possono usare anche gli altri tipi (es. `intervalli` per lo stretching).

**Prima di iniziare** l'app chiede di spuntare i controlli di sicurezza (compagno in acqua, nessun malessere, niente iperventilazione): il pulsante si accende solo quando sono tutti spuntati. Se l'ultimo esito di apnea dice "No" a *Tutto regolare?*, si aggiunge il controllo "hai sentito il medico".

### Esercizio `apnee`

Come `intervalli`, ma ogni fase è un **respiro** o un'**apnea** (`"fase": "respiro"` / `"fase": "apnea"`), con i blocchi `ripeti` se servono.

```json
{ "id": "c2", "nome": "Tabella C2", "tipo": "apnee",
  "fasi": [
    { "fase": "respiro", "nome": "Preparazione" },
    { "fase": "apnea", "durata_s": 165 }, { "fase": "respiro", "durata_s": 60 },
    { "fase": "apnea", "durata_s": 165 }, { "fase": "respiro", "durata_s": 55 },
    { "fase": "apnea", "nome": "Lunga", "sforzo": 6, "annunci_s": 60 },
    { "ripeti": 6, "fasi": [
      { "fase": "respiro", "durata_s": 75 },
      { "fase": "apnea", "nome": "Dinamica 50 m", "metri": 50, "sforzo": 5 } ] }
  ] }
```

| Campo della fase | Significato |
|---|---|
| `fase` | `respiro` o `apnea` (azzurro chiaro / blu) |
| `durata_s` | apnea a tempo fisso (tabelle CO₂/O₂) o recupero a tempo. **Senza** `durata_s` la fase è libera: il cronometro conta in avanti |
| `sforzo` | sforzo previsto sulla scala 0-10 di Gabriele, detto a voce e mostrato |
| `metri` | per la dinamica: distanza prevista, poi modificabile |
| `annunci_s` | solo apnee libere: la voce dice il tempo trascorso ogni N secondi (es. 60). Se manca, silenzio |
| `nome`, `note` | facoltativi |

L'unico pulsante (il riquadro grande): primo tocco = parte la tabella; durante un'**apnea** tocco = "esco" (se era a tempo fisso viene segnata `uscita_anticipata`), a tempo scaduto passa da sola al respiro; durante un **respiro a tempo** l'apnea parte da sola (*Salta fase ›* per anticipare); durante un **respiro libero** tocco = parte l'apnea. Voce italiana disattivabile: "Apnea", "Respira", 30" e 10" alla fine delle fasi a tempo, bip negli ultimi 3 secondi. A fine tabella si segnano per ogni apnea tempo (già compilato), metri e **sforzo 0-10**.

Domande di fine seduta predefinite (se la seduta non ne porta di sue): *Sforzo massimo raggiunto* (0-10), *Come ti sei sentito?* (1-5), *Tutto regolare? Niente samba, niente malesseri* (Sì/No), note.

Nell'esito, oltre ai campi soliti: `disciplina`, `sicurezza` (controlli spuntati e ora) e per ogni esercizio `apnee`:

```json
{ "id": "c2", "tipo": "apnee", "stato": "fatto", "apnee_previste": 8, "fasi_totali": 16, "fasi_completate": 16, "tempo_s": 1740,
  "apnee": [
    { "n": 1, "nome": "Apnea", "prevista_s": 165, "tempo_s": 165, "sforzo": 4 },
    { "n": 8, "nome": "Apnea", "prevista_s": 165, "tempo_s": 151, "sforzo": 7, "uscita_anticipata": true } ] }
```

## Sedute mentali (Gus)

Seduta con `"tipo": "mentale"`, un `"sottofondo"` (`titolo`, `url` YouTube, `durata_s`) ed esercizi `intervalli` con il testo **`guida`** in ogni fase (esempio completo in `gus/ISTRUZIONI.md`).

- Il sottofondo compare come piccolo player YouTube in basso a destra e parte con il primo tocco sul timer; si ferma in pausa e a fine seduta. Se il telefono blocca l'avvio automatico, basta toccare ▶ sul player.
- La voce guida (sintesi vocale italiana del telefono) legge il testo `guida` all'inizio di ogni fase, frase per frase, abbassando la musica mentre parla. Il testo resta anche scritto sotto il timer. Pausa: si fermano timer, musica e voce. Interruttore *Voce guida* sopra il timer.
- Pause nel parlato: "…" o punto. Frasi brevi.
- Domande predefinite (se la seduta non ne porta di sue): *Quanto ti senti calmo* (1-10), *Quanto sei rimasto concentrato* (1-10), *Ti è piaciuto il sottofondo?* (Sì / Così così / No), note. Nell'esito c'è anche `sottofondo`.

## Dove stanno i file (repository privato `apnea-training-database`, branch `main`)

| Percorso | Chi scrive | Contenuto |
|---|---|---|
| `fisico/coda.json` | coach | scheda `mr9-scheda-v1` con le prossime sedute |
| `fisico/esiti/<AAAA-MM-GG>_<id-seduta>.json` | app | un esito `mr9-esito-v1` per seduta confermata |
| `coach/registro.json` | coach | esiti già letti, ultimo controllo |
| `coach/diario.md` | coach | decisioni prese e motivo |
| `piani/*.md` | atleta / coach | piani di riferimento |

L'app scarta dalla coda le sedute che hanno già un esito, quindi una seduta confermata non ricompare anche se il coach non ha ancora aggiornato la coda.

## Istruzioni da dare alle chat del coach (modalità a mano)

Incolla questo testo nelle istruzioni del progetto "Mr. 9 Minutes" (o all'inizio delle chat "Allenamento fisico" e "Allenamento aerobico"):

> Quando ti mando un messaggio che inizia con "ESITO SEDUTA dall'app Mr. 9 Training", contiene un JSON `mr9-esito-v1` con quello che ho fatto davvero. Analizzalo, confrontalo con il piano, adatta le sedute successive e rispondimi con un breve commento più un unico blocco JSON nel formato `mr9-scheda-v1` (specifica: docs/FORMATO.md del repository apnea-training). Metti nel JSON la prossima seduta, o le prossime della settimana in ordine: l'app mi mostra solo la prima e le altre una alla volta. Per ogni esercizio usa `serie`, `circuito` o `intervalli`, con i recuperi in secondi (`recupero_s`) e, per i lavori a tempo, le fasi con `durata_s`. Usa per ogni esercizio un `id` stabile (es. `squat`, `stacco-rumeno`), così l'app ritrova la sua immagine. Aggiungi `domande` di fine seduta quando ti servono dati specifici (FC, dolori, segnali di fatica).
