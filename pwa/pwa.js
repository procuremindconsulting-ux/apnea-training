/* Supporto "app vera" sul telefono:
 *  1. registra il service worker (installazione + offline)
 *  2. tiene lo schermo acceso (window.keepAwake)
 *  3. mostra il suggerimento "Aggiungi a schermata Home" quando l'app è aperta nel browser
 *
 * Uso: <script type="module" src="pwa/pwa.js"></script> in fondo al body.
 * Nessuna dipendenza. Tutto è esposto su window.keepAwake e window.pwa.
 */

const BASE = new URL('..', import.meta.url); // radice dell'app (cartella che contiene pwa/)

/* ---------- 1. Service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', BASE), { scope: BASE.pathname }).catch((err) => {
      console.warn('[pwa] service worker non registrato', err);
    });
  });
}

/* ---------- 2. Schermo sempre acceso ---------- */
/* Strategia:
 *  - Screen Wake Lock API dove c'è (Android/Chrome, iOS 16.4+ in Safari, iOS 18.4+ anche da Home).
 *  - Il sistema rilascia il lock quando l'app va in background: lo richiediamo di nuovo al ritorno.
 *  - Se l'API manca o fallisce (iOS più vecchi, app da Home prima di iOS 18.4) si usa un video
 *    muto in loop, invisibile, che impedisce al telefono di spegnere lo schermo. iOS lo fa partire
 *    solo dopo un tocco, quindi lo agganciamo al primo tocco sullo schermo.
 */
const keepAwake = (() => {
  let wanted = false;
  let sentinel = null;
  let video = null;
  let mode = 'off'; // 'off' | 'wakelock' | 'video' | 'pending'
  const listeners = new Set();

  const emit = () => listeners.forEach((fn) => fn(mode));
  const setMode = (m) => {
    if (m !== mode) {
      mode = m;
      document.documentElement.dataset.keepAwake = m;
      emit();
    }
  };

  // Su iOS prima della 18.4 il Wake Lock da app installata "risponde ok" ma non funziona:
  // lì usiamo direttamente il video.
  const iosVer = (() => {
    const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && m ? Number(m[1]) + Number(m[2]) / 100 : null;
  })();
  const standaloneNow = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const wakeLockUnreliable = () => iosVer !== null && iosVer < 18.04 && standaloneNow();

  async function tryWakeLock() {
    if (!('wakeLock' in navigator) || wakeLockUnreliable()) return false;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        sentinel = null;
        // Rilasciato dal sistema (app in background, risparmio energetico...): riprova quando torna visibile.
        if (wanted && document.visibilityState === 'visible') acquire();
        else if (wanted) setMode('pending');
      });
      stopVideo();
      setMode('wakelock');
      return true;
    } catch (err) {
      // NotAllowedError: serve un gesto, batteria scarica, o PWA iOS senza supporto.
      return false;
    }
  }

  function ensureVideo() {
    if (video) return video;
    video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('aria-hidden', 'true');
    video.muted = true;
    video.loop = true;
    video.preload = 'auto';
    video.src = new URL('pwa/keepawake.mp4', BASE).href;
    Object.assign(video.style, {
      position: 'fixed', width: '1px', height: '1px', opacity: '0.01',
      pointerEvents: 'none', left: '0', bottom: '0', zIndex: '-1',
    });
    document.body.appendChild(video);
    return video;
  }

  async function tryVideo() {
    try {
      await ensureVideo().play();
      setMode('video');
      return true;
    } catch {
      return false;
    }
  }

  function stopVideo() {
    if (video && !video.paused) video.pause();
  }

  async function acquire() {
    if (!wanted || document.visibilityState !== 'visible') return;
    if (sentinel) return;
    if (await tryWakeLock()) return;
    if (await tryVideo()) return;
    setMode('pending'); // riproviamo al prossimo tocco
  }

  // Al primo tocco (e a ogni tocco finché non abbiamo il lock) riproviamo: su iOS serve un gesto.
  const onGesture = () => {
    if (wanted && (mode === 'pending' || mode === 'off' || (mode === 'video' && video?.paused))) acquire();
  };
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) =>
    document.addEventListener(ev, onGesture, { capture: true, passive: true })
  );

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (mode === 'video' && video?.paused) video.play().catch(() => setMode('pending'));
      acquire();
    }
  });
  // iOS: tornando da un'altra app a volte arriva solo pageshow/focus.
  window.addEventListener('pageshow', () => acquire());
  window.addEventListener('focus', () => acquire());

  return {
    /** Tiene lo schermo acceso finché non chiami off(). */
    on() {
      wanted = true;
      return acquire();
    },
    /** Permette di nuovo al telefono di spegnere lo schermo. */
    async off() {
      wanted = false;
      stopVideo();
      if (sentinel) {
        const s = sentinel;
        sentinel = null;
        await s.release().catch(() => {});
      }
      setMode('off');
    },
    /** 'off' | 'wakelock' | 'video' | 'pending' (in attesa di un tocco) */
    get mode() { return mode; },
    get active() { return mode === 'wakelock' || mode === 'video'; },
    /** Notifica ogni cambio di stato; ritorna la funzione per smettere di ascoltare. */
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();

window.keepAwake = keepAwake;

// Gabriele vuole lo schermo sempre acceso mentre usa l'app: attivo di default.
// Per disattivarlo in una pagina: <html data-keep-awake-default="off">
if (document.documentElement.dataset.keepAwakeDefault !== 'off') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => keepAwake.on(), { once: true });
  } else {
    keepAwake.on();
  }
}

/* ---------- 3. Installazione / "Aggiungi a schermata Home" ---------- */
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  window.navigator.standalone === true;

const DISMISS_KEY = 'mr9-install-dismissed';
const DISMISS_DAYS = 7;

function recentlyDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}
function rememberDismiss() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // mostriamo il nostro banner invece della mini-barra di Chrome
  deferredPrompt = e;
  showInstallBanner();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallBanner();
});

const SHARE_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="pwa-ico"><path fill="currentColor" d="M12 2l4 4-1.4 1.4L13 5.8V15h-2V5.8L9.4 7.4 8 6l4-4zM5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V11a1 1 0 011-1z"/></svg>';
const PLUS_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="pwa-ico"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const DOTS_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="pwa-ico"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>';

function installSteps() {
  if (isIOS) {
    const notSafari = /CriOS|FxiOS|EdgiOS/.test(ua);
    return `
      <ol class="pwa-steps">
        ${notSafari ? '<li>Apri questa pagina in <b>Safari</b> (oppure usa il menu ⋯ del browser se offre "Aggiungi a Home").</li>' : ''}
        <li>Tocca <b>Condividi</b> ${SHARE_ICON} nella barra in basso (o in alto su iPad).</li>
        <li>Scorri e scegli <b>Aggiungi alla schermata Home</b> ${PLUS_ICON}.</li>
        <li>Lascia attivo <b>Apri come app web</b> e tocca <b>Aggiungi</b>.</li>
        <li>Da ora apri l'app dall'icona <b>Mr. 9</b>: niente barra del browser.</li>
      </ol>`;
  }
  return `
    <ol class="pwa-steps">
      <li>Tocca il menu ${DOTS_ICON} in alto a destra di Chrome.</li>
      <li>Scegli <b>Installa app</b> (o <b>Aggiungi a schermata Home</b> → <b>Installa</b>).</li>
      <li>Da ora apri l'app dall'icona <b>Mr. 9</b>: si apre a schermo intero.</li>
    </ol>`;
}

let banner = null;
function showInstallBanner({ force = false } = {}) {
  if (isStandalone()) return;
  if (!force && recentlyDismissed()) return;
  if (!force && !isIOS && !isAndroid && !deferredPrompt) return; // su desktop solo se installabile
  if (banner) return;

  banner = document.createElement('div');
  banner.className = 'pwa-install';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', "Installa l'app");
  banner.innerHTML = `
    <div class="pwa-install__card">
      <img src="${new URL('icons/icon-192.png', BASE).href}" alt="" class="pwa-install__icon" width="48" height="48">
      <div class="pwa-install__text">
        <strong>Installa Mr. 9 sul telefono</strong>
        <span>Si apre a schermo intero come un'app, funziona anche senza rete e tiene lo schermo acceso.</span>
      </div>
      <div class="pwa-install__actions">
        ${deferredPrompt ? '<button type="button" class="pwa-btn pwa-btn--primary" data-act="install">Installa</button>' : '<button type="button" class="pwa-btn pwa-btn--primary" data-act="how">Come si fa</button>'}
        <button type="button" class="pwa-btn" data-act="later">Più tardi</button>
      </div>
      <div class="pwa-install__how" hidden>${installSteps()}</div>
    </div>`;
  banner.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'install' && deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice.catch(() => ({}));
      deferredPrompt = null;
      if (outcome === 'accepted') hideInstallBanner();
      else banner.querySelector('.pwa-install__how').hidden = false;
    } else if (act === 'how') {
      const how = banner.querySelector('.pwa-install__how');
      how.hidden = !how.hidden;
    } else if (act === 'later') {
      rememberDismiss();
      hideInstallBanner();
    }
  });
  document.body.appendChild(banner);
}
function hideInstallBanner() {
  banner?.remove();
  banner = null;
}

// iOS non ha "beforeinstallprompt": mostriamo le istruzioni dopo un attimo.
// Android: se Chrome non emette l'evento (es. già rifiutato) mostriamo comunque le istruzioni.
window.addEventListener('load', () => {
  setTimeout(() => { if (!deferredPrompt) showInstallBanner(); }, 2500);
});

document.documentElement.classList.toggle('pwa-standalone', isStandalone());
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', () =>
  document.documentElement.classList.toggle('pwa-standalone', isStandalone())
);

window.pwa = {
  isStandalone,
  isIOS,
  isAndroid,
  /** Mostra di nuovo le istruzioni di installazione (es. da un pulsante nelle impostazioni). */
  showInstallHelp: () => showInstallBanner({ force: true }),
};
