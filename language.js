/* language.js — Internationalization (German / English)
 *
 * Provides:
 *   LANG        — translation table { de: {...}, en: {...} }
 *   currentLang — current language code ('de' or 'en')
 *   t(key)      — return translated string for key
 *   setLang(l)  — switch language and dispatch 'langchange' event
 *   getLang()   — return current language code
 *
 * Load this BEFORE any other game script that uses t().
 */

var LANG = {
  de: {
    /* === Win / Lose overlay (game.js) === */
    'won': 'GEWONNEN',
    'lost': 'VERLOREN',

    /* === Save / Load flash (ui.js) === */
    'saved': 'GESPEICHERT',
    'loaded': 'GELADEN',

    /* === Side panel buttons (ui.js) === */
    'save_btn': 'SPEICHERN',
    'load_btn': 'LADEN',

    /* === Camera slider (ui.js) === */
    'camera_label': 'Kamera:',

    /* === Faction info labels (ui.js) === */
    'fighter_label': 'Jaeger:',
    'adv_fighter_label': 'Adv.Jaeger:',
    'bomber_label': 'Bomber:',
    'transporter_label': 'Trans.:',

    /* === Pause indicator (ui.js) === */
    'paused': 'PAUSED',

    /* === Player selection screen (ui.js) === */
    'title': 'USI - Star Fleet',
    'choose_group': 'Choose your group (1-3 possible):',
    'select_hint': 'Use 1/2/3 or Up/Down + Enter to select.',
    'group1': 'Group 1 (Red)',
    'group2': 'Group 2 (Green)',
    'group3': 'Group 3 (Yellow)',
    'arrow': '->',
    'help_link': 'Hilfe',

    /* === Planet menu — labels (planeten.js) === */
    'level_label': 'Level',
    'build_label': 'Bauen:',
    'order_label': 'Auftrag:',
    'quantity_label': 'Anzahl:',
    'info_label': 'Info:',
    'soldiers_label': 'Soldaten:',
    'forts_label': 'Forts:',
    'behavior_label': 'Verhalten:',
    'planet_label': 'Planet:',
    'all_armies_label': 'alle Armeen:',
    'shield_label': 'Schild:',
    'rockets_label': 'Raketen:',

    /* === Planet menu — production options === */
    'next_level': 'naechstes Level',
    'soldiers': 'Soldaten',
    'fighter': 'Jaeger',
    'transporter': 'Transporter',
    'adv_fighter': 'Adv. Jaeger',
    'forts': 'Forts',
    'bomber': 'Bomber',
    'nothing': 'Nichts',
    'short_next_level': 'n. Level',

    /* === Planet menu — status === */
    'attack_mode': 'Angriff',
    'defense_mode': 'Verteidigung',
    'war_status': 'Krieg',
    'peace_status': 'Frieden',
    'inactive': 'inaktiv',
    'destroyed': 'zerstoert',

    /* === Planet menu — back button === */
    'back': 'zur\u00fcck',

    /* === Keyboard hints (planeten.js) === */
    'key_hints': 'Tasten: 1-7=Bauen 8/C=Nichts W/9=Kampfmodus ESC=Zurueck',

    /* === Language toggle button === */
    'lang_de': 'DE',
    'lang_en': 'EN',
  },

  en: {
    /* === Win / Lose overlay (game.js) === */
    'won': 'VICTORY',
    'lost': 'DEFEAT',

    /* === Save / Load flash (ui.js) === */
    'saved': 'SAVED',
    'loaded': 'LOADED',

    /* === Side panel buttons (ui.js) === */
    'save_btn': 'SAVE',
    'load_btn': 'LOAD',

    /* === Camera slider (ui.js) === */
    'camera_label': 'Camera:',

    /* === Faction info labels (ui.js) === */
    'fighter_label': 'Fighter:',
    'adv_fighter_label': 'A.Fighter:',
    'bomber_label': 'Bomber:',
    'transporter_label': 'Trans.:',

    /* === Pause indicator (ui.js) === */
    'paused': 'PAUSED',

    /* === Player selection screen (ui.js) === */
    'title': 'USI - Star Fleet',
    'choose_group': 'Choose your group (1-3 possible):',
    'select_hint': 'Use 1/2/3 or Up/Down + Enter to select.',
    'group1': 'Group 1 (Red)',
    'group2': 'Group 2 (Green)',
    'group3': 'Group 3 (Yellow)',
    'arrow': '->',
    'help_link': 'Help',

    /* === Planet menu — labels (planeten.js) === */
    'level_label': 'Level',
    'build_label': 'Build:',
    'order_label': 'Order:',
    'quantity_label': 'Qty:',
    'info_label': 'Info:',
    'soldiers_label': 'Soldiers:',
    'forts_label': 'Forts:',
    'behavior_label': 'Behavior:',
    'planet_label': 'Planet:',
    'all_armies_label': 'All armies:',
    'shield_label': 'Shield:',
    'rockets_label': 'Rockets:',

    /* === Planet menu — production options === */
    'next_level': 'Next Level',
    'soldiers': 'Soldiers',
    'fighter': 'Fighter',
    'transporter': 'Transporter',
    'adv_fighter': 'Adv. Fighter',
    'forts': 'Forts',
    'bomber': 'Bomber',
    'nothing': 'Nothing',
    'short_next_level': 'n. Level',

    /* === Planet menu — status === */
    'attack_mode': 'Attack',
    'defense_mode': 'Defense',
    'war_status': 'War',
    'peace_status': 'Peace',
    'inactive': 'inactive',
    'destroyed': 'destroyed',

    /* === Planet menu — back button === */
    'back': 'back',

    /* === Keyboard hints (planeten.js) === */
    'key_hints': 'Keys: 1-7=Build 8/C=Nothing W/9=Combat ESC=Back',

    /* === Language toggle button === */
    'lang_de': 'DE',
    'lang_en': 'EN',
  }
};

/* Cookie helpers for the shared DE/EN preference */
function getLangCookie() {
  try {
    var cookies = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < cookies.length; i++) {
      var c = cookies[i].trim();
      var eq = c.indexOf('=');
      if (eq < 0) continue;
      if (c.substring(0, eq) !== 'usi-lang') continue;
      var val = decodeURIComponent(c.substring(eq + 1));
      if (val === 'en' || val === 'de') return val;
    }
  } catch (e) { /* cookies may be blocked */ }
  return null;
}

function setLangCookie(lang) {
  try {
    var expires = new Date(Date.now() + 31536000e3).toUTCString();
    document.cookie = 'usi-lang=' + encodeURIComponent(lang) +
      '; expires=' + expires + '; path=/; SameSite=Lax';
  } catch (e) { /* cookies may be blocked */ }
}

/* Current language — cookie first (default 'en' on first visit).
 * Migrate an older localStorage preference once, if present. */
var currentLang = (function() {
  var saved = getLangCookie();
  if (saved === 'en' || saved === 'de') return saved;
  try {
    var legacy = localStorage.getItem('usi-lang');
    if (legacy === 'en' || legacy === 'de') {
      setLangCookie(legacy);
      return legacy;
    }
  } catch (e) { /* localStorage may be blocked */ }
  /* First visit: English is the default and becomes the stored preference */
  setLangCookie('en');
  return 'en';
})();

/* t(key) — translate a key, with fallback chain */
function t(key) {
  if (LANG[currentLang] && LANG[currentLang][key]) return LANG[currentLang][key];
  if (LANG['de'] && LANG['de'][key]) return LANG['de'][key];
  return key;
}

/* setLang(lang) — switch language, save to cookie (and localStorage fallback) */
function setLang(lang) {
  if (lang !== 'de' && lang !== 'en') return;
  currentLang = lang;
  setLangCookie(lang);
  try { localStorage.setItem('usi-lang', lang); } catch (e) { }
  window.dispatchEvent(new CustomEvent('langchange'));
}

/* getLang() — return current language code */
function getLang() {
  return currentLang;
}
