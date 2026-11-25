// bb-nav: the tab bar (Vibe Tracks style): the built-in tabs (§16.2 added Ablation; §17 renamed Reports to Analysis and
// added References and Notes), the box's own tabs after them, the Needs-you pill, and top right the GitHub button and the
// settings gear (viewer/CONTRACT.md §5.1, §11, §17). Pure: no DOM.
import { PAGES, PAGE_LABELS, PAGE_ALIASES } from '../core/slices.js';

export default {
  tag: 'bb-nav', name: 'Tabs', version: 1, wave: 1,
  description: "The box's tabs (Overview, Spec, Feedback, Iterations, Ablation, Agents, Activity, Audits, Analysis, Ideas, References, Notes, then the box's own from site/tabs/) with each tab's count read from state.json, the Needs-you pill, a GitHub button to the box's repo and a settings gear (Appearance: Light / Dark / System).",
  reads: ['spec', 'feedback', 'iterations', 'ablations', 'unscored', 'agents', 'activity', 'audits', 'reports', 'analysis', 'needs', 'ideas',
    'references', 'notes', 'tabs'],
  settings: [
    { id: 'current', type: 'select', label: 'Current tab', default: 'overview',
      info: "a box's own tab is current when the page's `page` is its slug; `reports` is the old id of Analysis",
      options: [...PAGES.map((p) => ({ value: p, label: PAGE_LABELS[p] })),
        ...Object.entries(PAGE_ALIASES).map(([old, p]) => ({ value: old, label: `${PAGE_LABELS[p]} (old id "${old}")` }))] },
    { id: 'counts', type: 'checkbox', label: 'Show counts', default: true },
    { id: 'brand', type: 'checkbox', label: "Show the box's name", default: true },
    { id: 'needs_pill', type: 'checkbox', label: 'Needs-you pill', default: true },
    { id: 'href', type: 'text', label: 'Tab link pattern', default: '', info: '{page} is replaced; empty = the page\'s links.page' },
  ],
  blocks: [{ type: 'link', name: "A link to the box's own page", settings: [
    { id: 'label', type: 'text', label: 'Label', default: '' },
    { id: 'url', type: 'url', label: 'URL', default: '' }] }],
  max_blocks: 6,
  limit: 1,
  presets: [{ name: 'Tabs' }],
  empty: 'The tabs always render.',
};
