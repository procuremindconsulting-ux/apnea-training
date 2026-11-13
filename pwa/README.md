# App installabile sul telefono (PWA)

Questa cartella, insieme a `manifest.webmanifest`, `sw.js` e `icons/` nella radice, fa sì che l'app:

- si installi sulla schermata Home e si apra **a schermo intero, senza barra del browser**;
- funzioni **anche senza rete** (palestra, piscina) dopo la prima apertura;
- **non spenga lo schermo** mentre è aperta;
- abbia un layout pensato per il telefono (notch, barra home, niente zoom involontario, pulsanti grandi).

## File

| File | A cosa serve |
|---|---|
| `manifest.webmanifest` | Nome, icona, colori, apertura `standalone` in verticale |
| `sw.js` | Service worker: cache per l'uso offline |
| `icons/` | Icone Android (normali e "maskable"), iPhone, favicon |
| `pwa/head-snippet.html` | Righe da incollare nell'`<head>` di `index.html` |
| `pwa/pwa.js` | Registra il service worker, tiene lo schermo acceso, banner di installazione |
| `pwa/pwa.css` | Base mobile + stile del banner |
| `pwa/keepawake.mp4` | Video muto di 2 KB usato per tenere acceso lo schermo sugli iPhone più vecchi |

## Integrazione in `index.html`

1. Incollare il contenuto di `pwa/head-snippet.html` nell'`<head>`.
2. In fondo al `<body>`: `<script type="module" src="pwa/pwa.js"></script>`.

L'app va pubblicata in **HTTPS** (es. GitHub Pages): senza HTTPS il telefono non la installa come app e non tiene lo schermo acceso.

## Schermo sempre acceso

Si attiva da solo all'apertura. Il codice dell'app può comunque controllarlo:

```js
keepAwake.on();            // tieni acceso
keepAwake.off();           // lascia spegnere
keepAwake.mode;            // 'wakelock' | 'video' | 'pending' | 'off'
keepAwake.onChange(m => …) // per mostrare un'icona "schermo acceso"
```

Per non attivarlo in automatico: `<html data-keep-awake-default="off">`.

Come funziona:

- **Android / Chrome e iPhone con iOS 18.4 o più recente**: usa la Screen Wake Lock API.
- Il sistema rilascia il blocco quando si passa ad un'altra app o si blocca il telefono: al ritorno l'app lo richiede di nuovo da sola.
- **iPhone con iOS più vecchio** (dove l'API non c'è o non funziona dall'icona Home): usa un video muto invisibile in loop. iOS lo avvia solo dopo un tocco, quindi parte al primo tocco sullo schermo.
- Con il **risparmio energetico** attivo alcuni telefoni possono rifiutare il blocco.

## Istruzioni per installare l'app

### iPhone (Safari)

1. Aprire il link dell'app in **Safari**.
2. Toccare **Condividi** (quadrato con freccia verso l'alto).
3. Scegliere **Aggiungi alla schermata Home**.
4. Lasciare attivo **Apri come app web** e toccare **Aggiungi**.
5. Aprire sempre l'app dall'icona **Mr. 9**.

### Android (Chrome)

1. Aprire il link dell'app in **Chrome**.
2. Toccare **Installa** nel banner dell'app, oppure il menu **⋮** → **Installa app**.
3. Aprire sempre l'app dall'icona **Mr. 9**.

Le stesse istruzioni compaiono nell'app quando è aperta nel browser (si possono richiamare con `pwa.showInstallHelp()`).

## Aggiornamenti

Dopo una modifica all'app, cambiare `VERSION` in `sw.js` (`v1` → `v2`): alla successiva apertura con rete i telefoni scaricano la nuova versione.
