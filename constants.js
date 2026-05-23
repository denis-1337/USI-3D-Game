/* constants.js - ported from fpc_port/src/constants.pas */

/* Unit costs / ship type IDs */
var soldaten    = 400;
var nlevel      = 400;
var jager       = 180;       // reduced from 200 — cheaper interceptor
var advjager    = 240;       // reduced from 250 — balanced mid-tier
var transporter = 260;
var forts       = 300;
var bomber      = 350;       // increased from 320 — expensive heavy hitter

/* Game constants */
var maxships    = 255;
var smartk      = 130;
var rakk        = 140;
var ammok       = 20;
var seite       = 4000;
var pge         = 5;
var mut         = 2;

/* ---- Ship balance constants ---- */

/* Fire rate (ticks between shots). Lower = faster.
 * Jäger fires much faster than Bomber to compensate for lower per-shot damage. */
var JAGER_FIRE_RATE     = 3;   // very fast — 10 shots/sec at 30 FPS
var ADVJAGER_FIRE_RATE  = 4;   // fast — 7.5 shots/sec
var BOMBER_FIRE_RATE    = 7;   // slow — 4.3 shots/sec

/* Base hit chance (percentage). Higher = more likely to hit.
 * Jäger has lower base accuracy but makes up with volume of fire. */
var JAGER_HIT_CHANCE    = 75;  // 75% base accuracy
var ADVJAGER_HIT_CHANCE = 80;  // 80% base accuracy
var BOMBER_HIT_CHANCE   = 90;  // 90% base accuracy (heavy weapons are accurate)

/* Type advantage multipliers (rock-paper-scissors):
 * Jäger > Bomber:  +40% damage (fighters intercept bombers)
 * Bomber > Transporter: +50% damage (bombers crush transports)
 * Transporter > Jäger:  +35% damage (transports have heavy armor vs fighters)
 * Adv Jäger is balanced: slight advantage vs Bomber (+25%), slight disadvantage vs Transporter (-10%) */
var JAGER_VS_BOMBER_MULT       = 1.40;
var BOMBER_VS_TRANSPORTER_MULT = 1.50;
var TRANSPORTER_VS_JAGER_MULT  = 1.35;
var ADVJAGER_VS_BOMBER_MULT    = 1.25;
var ADVJAGER_VS_TRANSPORTER_MULT = 0.90;

/* Speed bonus to hit chance evasion: faster ships are harder to hit.
 * For every 10 speed units the target is faster than the attacker,
 * the attacker's hit chance drops by this many percentage points. */
var SPEED_EVASION_PENALTY = 3;  // 3% penalty per 10 speed units difference
