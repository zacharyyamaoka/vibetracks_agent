// The groups, in run order. Each gets a fresh state (HOME from pristine/, a new vt serve, a new page).
import sidebar from './sidebar.mjs'
import open from './open.mjs'
import menu from './menu.mjs'
import pin from './pin.mjs'
import view from './view.mjs'
import drag from './drag.mjs'
import verbs from './verbs.mjs'
import rollup from './rollup.mjs'
import review from './review.mjs'
import newtrack from './newtrack.mjs'
import cli from './cli.mjs'
import pause from './pause.mjs'
import fold from './fold.mjs'
import search from './search.mjs'
import speed from './speed.mjs'

// pause (ruler v2, S2.10) runs after every v1 group, and fold, search and speed (ruler v3: S2.9, S2.11, S1.6) after it, so every
// earlier group runs exactly as it did in the ruler that added it
export const GROUPS = [sidebar, open, menu, pin, view, drag, verbs, rollup, review, newtrack, cli, pause, fold, search, speed]
