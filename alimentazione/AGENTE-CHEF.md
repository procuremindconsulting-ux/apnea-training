# Agente chef

L'agente chef è Claude, chiamato dall'app con una richiesta già scritta. L'app non ha una chiave API: apre `claude.ai/new?q=...` (o copia la richiesta).

## Cosa fa
1. **Menu dei prossimi 3 giorni** (schermata Giorno, o a voce «chef, menu dei prossimi giorni»): l'app manda dispensa con quantità, piano dei 3 giorni con grammi e regole. Lo chef sceglie un piatto per ogni pasto usando prima la dispensa e chiude con due blocchi che l'app legge:

```
MENU
14/11 | Pranzo | Penne al pomodoro con straccetti di manzo
SPESA
- spinaci 400 g
```

2. **Importa**: «Ho la risposta: importa menu e spesa» legge gli appunti (o fa incollare). I piatti compaiono sotto ogni pasto, i prodotti mancanti vanno in lista con l'etichetta «chef». Annulla disponibile.
4. **Chef nel cloud**: lo chef pianificato scrive `alimentazione/menu.json` (formato mr9-menu-v1) nel repository dati; l'app lo legge all'apertura, sostituisce il menu dei giorni futuri, mostra la ricetta nel pasto e aggiunge la spesa con etichetta «chef». L'app scrive `alimentazione/dispensa.json` (mr9-dispensa-v1) a ogni modifica della dispensa.
3. **Ricetta** del singolo pasto: se il piatto è già deciso dal menu, lo chef prepara quel piatto con le grammature del piano.

## Regole date allo chef
- Grammature del piano rispettate, niente grassi oltre l'olio indicato.
- Prima la dispensa (i freschi per primi); sostituzioni solo equivalenti e segnalate.
- Cibi da evitare e regole extra: campi `nonPiacciono` e `regoleChef` del piano privato.
- Prima dell'apnea e la sera prima: digeribile, niente legumi, crucifere, molto crudo, gassate.
- Piatti veloci (20-25 minuti).

## Volendo: progetto Claude "Chef"
Si può creare su claude.ai un progetto "Chef" con queste regole come istruzioni. Il link dell'app apre però una chat nuova fuori dal progetto: per usare il progetto, «Copia la richiesta» e incollala lì.

Il piano vero sta nel repository dati privato (`alimentazione/piano.json`); qui c'è solo un piano d'esempio.
