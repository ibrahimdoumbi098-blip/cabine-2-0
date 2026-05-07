/**
 * KioskService — Cabine 2.0
 * Gère le mode kiosque pour les terminaux POS dédiés.
 *
 * Fonctionnalités:
 *  - Plein écran immersif (cache barre de navigation + status bar)
 *  - Blocage du bouton retour Android
 *  - Verrouillage de la tâche (lockTask) via plugin Capacitor KioskPlugin
 *  - PIN admin pour sortir du mode kiosque
 *  - Persistance dans localStorage
 */

const KIOSK_KEY   = 'cabine_kiosk_enabled';
const ADMIN_KEY   = 'cabine_kiosk_pin';
const DEFAULT_PIN = '1234'; // doit être changé dans les Paramètres

// ─── État ─────────────────────────────────────────────────────────────────────
let _listeners = [];
let _isKiosk   = localStorage.getItem(KIOSK_KEY) === 'true';

function notify() {
  _listeners.forEach(fn => fn(_isKiosk));
}

// ─── Plein écran natif ────────────────────────────────────────────────────────
async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen)            await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen)    await el.mozRequestFullScreen();
  } catch (_) { /* pas disponible en WebView */ }

  // Capacitor StatusBar hide
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.hide();
    } catch (_) {}
  }
}

async function exitFullscreen() {
  try {
    if (document.exitFullscreen)            await document.exitFullscreen();
    else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen)  await document.mozCancelFullScreen();
  } catch (_) {}

  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.show();
    } catch (_) {}
  }
}

// ─── Lock Task (Android Device Owner / Task Pinning) ─────────────────────────
async function lockTask() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    await window.Capacitor.Plugins.KioskPlugin?.lockTask?.();
  } catch (e) {
    console.warn('KioskService: lockTask non disponible', e.message);
  }
}

async function unlockTask() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    await window.Capacitor.Plugins.KioskPlugin?.unlockTask?.();
  } catch (e) {
    console.warn('KioskService: unlockTask non disponible', e.message);
  }
}

// ─── Bouton retour Android ────────────────────────────────────────────────────
let _backHandler = null;
async function disableBackButton() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const { App } = await import('@capacitor/app');
    _backHandler = App.addListener('backButton', ({ canGoBack }) => {
      // En kiosque : ignorer le bouton retour entièrement
      if (_isKiosk) return;
      if (!canGoBack) App.exitApp();
    });
  } catch (_) {}
}

async function restoreBackButton() {
  if (_backHandler) {
    await _backHandler.remove();
    _backHandler = null;
  }
}

// ─── Gestion du PIN admin ─────────────────────────────────────────────────────
function getAdminPin() {
  return localStorage.getItem(ADMIN_KEY) || DEFAULT_PIN;
}

function setAdminPin(pin) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN doit être 4 à 6 chiffres');
  localStorage.setItem(ADMIN_KEY, pin);
}

function verifyAdminPin(pin) {
  return pin === getAdminPin();
}

// ─── API publique ─────────────────────────────────────────────────────────────
const KioskService = {
  isKiosk: () => _isKiosk,

  async enable() {
    _isKiosk = true;
    localStorage.setItem(KIOSK_KEY, 'true');
    await enterFullscreen();
    await lockTask();
    await disableBackButton();
    document.documentElement.classList.add('kiosk');
    notify();
  },

  async disable(adminPin) {
    if (!verifyAdminPin(adminPin)) {
      throw new Error('PIN administrateur incorrect');
    }
    _isKiosk = false;
    localStorage.setItem(KIOSK_KEY, 'false');
    await exitFullscreen();
    await unlockTask();
    await restoreBackButton();
    document.documentElement.classList.remove('kiosk');
    notify();
  },

  // Restaure l'état au chargement (si l'app redémarre en kiosque)
  async restore() {
    if (_isKiosk) {
      await enterFullscreen();
      await lockTask();
      await disableBackButton();
      document.documentElement.classList.add('kiosk');
    }
  },

  onChange(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  },

  getAdminPin,
  setAdminPin,
  verifyAdminPin,
};

export default KioskService;
