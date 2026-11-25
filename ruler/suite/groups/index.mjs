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

export const GROUPS = [sidebar, open, menu, pin, view, drag, verbs, rollup, review, newtrack, cli]
