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
| `tipo` | no | `palestra`, `corsa`, `nuoto`, `bici`, `misto` |
| `data` | no | data prevista `AAAA-MM-GG` |
| `durata_stimata_min` | no | minuti |
| `note` | no | indicazioni generali, mostrate prima di iniziare |
| `esercizi` | sì | elenco di esercizi (vedi sotto) |
| `domande` | no | domande di fine seduta; se assenti l'app usa 3 domande standard |

### Esercizio: tre tipi

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
