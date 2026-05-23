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
    'key_hints': 'Tasten: 1-7=Bauen C=Abbrechen W=Angriff/Verteidigung ESC=Zurueck',

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
    'key_hints': 'Keys: 1-7=Build C=Cancel W=Attack/Defense ESC=Back',

    /* === Language toggle button === */
    'lang_de': 'DE',
    'lang_en': 'EN',
  }
};

/* Current language — load from localStorage, default 'de' */
var currentLang = (function() {
  try {
    var saved = localStorage.getItem('usi-lang');
    if (saved === 'en' || saved === 'de') return saved;
  } catch (e) { /* localStorage may be blocked */ }
  return 'de';
})();

/* t(key) — translate a key, with fallback chain */
function t(key) {
  if (LANG[currentLang] && LANG[currentLang][key]) return LANG[currentLang][key];
  if (LANG['de'] && LANG['de'][key]) return LANG['de'][key];
  return key;
}

/* setLang(lang) — switch language, save to localStorage, dispatch event */
function setLang(lang) {
  if (lang !== 'de' && lang !== 'en') return;
  currentLang = lang;
  try { localStorage.setItem('usi-lang', lang); } catch (e) { }
  window.dispatchEvent(new CustomEvent('langchange'));
}

/* getLang() — return current language code */
function getLang() {
  return currentLang;
}
