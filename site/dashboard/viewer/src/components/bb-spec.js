/* <bb-spec>: the Spec tab (viewer/CONTRACT.md §5.2, §16.1, §16.3). A thin wrapper: ONE data-ui <data-views> with an
   inline .base over state.json spec.requirements, the presets of proposals-pages/spec/spec.base:
   - By section (the default, proposals-pages/spec/2-tree.html): the table grouped by OBJECTIVES.md section, a pass bar;
   - Requirements: the flat table;
   - Requirement × test file (3-matrix.html): one status column per test file the spec map names. The slice carries each
     requirement's map `patterns` and its `failing` tests, not per-file counts, so a cell says only what those prove:
     fail = a failing test from that file; pass = the requirement's tests ran and none from that file failed;
     not run = no junit run was folded; blank = the map names no test there. A glob in the map (tests/test_site_*) is
     one column, named as written: the slice does not list the files it matched.
   - By result: a board, fail · unverified · not run · pass · deferred.
   Above it, one line of counts ("12 of 14 shalls pass · 948 tests, 0 failing"), or the slice's own `why` when no run
   was folded: a count it does not have is never shown as 0. A requirement's `statement` and `description` (the body of
   its specs/*.md, when the box has that folder) are plain text in the side panel. */
// TODO(lane MD): render description with data-ui's markdown rows + Obsidian side panel once re-vendored
import { BBElement, esc, fmtNum } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadViews } from '../core/kit.js';
import { noteRows, notePages } from '../core/notes.js';
import schema from './bb-spec.schema.js';
import { gatesBase, gatesDataset, PRESETS } from './bb-gates.rows.js';

let uid = 0;

/** The test file a map pattern names: the part before "::" (tests/test_ruler_dataset.<ext>::test_x -> tests/test_ruler_dataset.<ext>). */
export const testFile = (pattern) => String(pattern).split('::')[0];
/** A file's column name: its base name without the extension or the test_ prefix (a glob keeps its *). */
export const fileSlug = (file) => String(file).split('/').pop().replace(/\.[A-Za-z0-9]+$/, '').replace(/^test_/, '');
const keyOf = (slug) => `t_${slug.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '') || 'x'}${/\*/.test(slug) ? '_glob' : ''}`;
const globRe = (file) => new RegExp(`^${file.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);

/** One column per test file the map names, in name order. */
export function matrixColumns(requirements = []) {
  const cols = new Map();
  for (const r of requirements) for (const p of r.patterns || []) {
    const file = testFile(p);
    const slug = fileSlug(file);
    const key = keyOf(slug);
    if (!cols.has(key)) cols.set(key, { key, file, label: slug.replace(/_/g, ' '), glob: file.includes('*') });
  }
  return [...cols.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** What one requirement's tests in one file prove (see the header): null when the map names no test there. */
export function matrixCell(req, col, ran) {
  const files = (req.patterns || []).map(testFile);
  if (!files.includes(col.file)) return null;
  if (!ran || req.result === 'not run') return 'not run';
  const re = col.glob ? globRe(col.file) : null;
  if ((req.failing || []).some((t) => (re ? re.test(testFile(t)) : testFile(t) === col.file))) return 'fail';
  return req.tests > 0 ? 'pass' : 'unverified';
}

const CONTRACT_SECTION = "Contract: the tooling's own tests";
export const sectionLabel = (r) => (r.section !== null && r.section !== undefined
  ? `§${r.section}${r.section_title ? ` ${r.section_title}` : ''}` : r.kind === 'contract' ? CONTRACT_SECTION : 'No section');

/** Did the fold read a test run? (counts are null with a `why` when it did not, CONTRACT §16.1) */
export const ranOf = (spec) => !!spec && spec.tests !== null && spec.tests !== undefined;

export function specRows(spec) {
  const ran = ranOf(spec);
  const reqs = spec?.requirements || [];
  const cols = matrixColumns(reqs);
  return reqs.map((r, k) => {
    const num = (v) => (ran && Number.isFinite(v) ? v : null);
    const tests = num(r.tests);
    const pass = num(r.pass);
    const fail = num(r.fail);
    const row = {
      k, id: String(r.id), name: r.name ?? null, result: r.result ?? null, verb: r.verb ?? null, kind: r.kind ?? null,
      section_label: sectionLabel(r), statement: r.statement ?? null, description: r.description ?? null, source: r.source ?? null,
      tests, pass, fail, skipped: tests !== null && pass !== null && fail !== null && tests - pass - fail > 0 ? tests - pass - fail : null,
      pass_share: pass !== null && fail !== null && pass + fail > 0 ? Math.round((100 * pass) / (pass + fail)) : null,
      patterns: r.patterns || [], failing: r.failing || [],
    };
    if (typeof r._note === 'string') row._note = r._note; // a specs/*.md file opens as the note (CONTRACT §17)
    for (const c of cols) row[c.key] = matrixCell(r, c, ran);
    return row;
  });
}

/** The header line: counts from the folded run, or the slice's why. Never a null shown as 0. */
export function headerText(spec, { showTests = true } = {}) {
  if (!spec) return '';
  const n = (v) => fmtNum(v);
  const kinds = [spec.should ? `${n(spec.should)} should` : '', spec.deferred ? `${n(spec.deferred)} deferred` : ''].filter(Boolean).join(', ');
  if (!ranOf(spec) || spec.shall_pass === null || spec.shall_pass === undefined) {
    const shalls = Number.isFinite(spec.shall_active) ? `${n(spec.shall_active)} shall${spec.shall_active === 1 ? '' : 's'}${kinds ? `, ${kinds}` : ''}` : '';
    return [shalls, spec.why || 'no test run folded'].filter(Boolean).join(' · ');
  }
  const parts = [`${n(spec.shall_pass)} of ${n(spec.shall_active)} shalls pass`];
  if (spec.shall_fail) parts.push(`${n(spec.shall_fail)} fail`);
  if (spec.shall_unverified) parts.push(`${n(spec.shall_unverified)} unverified`);
  if (showTests) parts.push(`${n(spec.tests)} tests, ${n(spec.tests_failed ?? 0)} failing`);
  return parts.join(' · ');
}

const RESULT_TONES = { pass: 'good', fail: 'bad', unverified: 'warn', deferred: 'muted', 'not run': 'muted' };

export function specBase(rows, cols, settings) {
  const t = settings.show_tests;
  const groups = [...new Set(rows.map((r) => r.section_label))];
  const sort = [{ property: 'k', direction: 'ASC' }];
  const matrixDisplay = Object.fromEntries(cols.map((c) => [c.key, 'status']));
  // the side panel: what the requirement says first (its statement and, from specs/*.md, its description), then its tests
  const record = { sections: [{ name: 'Requirement', properties: ['id', 'result', 'verb', 'section_label', 'statement', 'description', 'source'] },
    ...(t ? [{ name: 'Tests', properties: ['tests', 'pass', 'fail', 'skipped', 'pass_share', 'patterns', 'failing'] }] : [])] };
  return {
    open: { mode: 'side', splitAt: 980 },
    properties: {
      id: { displayName: 'Id' }, name: { displayName: 'Requirement' }, section_label: { displayName: 'OBJECTIVES section' },
      verb: { displayName: 'Kind' }, result: { displayName: 'Result' }, tests: { displayName: 'Tests' }, pass: { displayName: 'Pass' },
      fail: { displayName: 'Fail' }, pass_share: { displayName: 'Passing' }, patterns: { displayName: 'Map (spec map)' },
      failing: { displayName: 'Failing tests' }, statement: { displayName: 'Statement' }, description: { displayName: 'Description' },
      ...Object.fromEntries(cols.map((c) => [c.key, { displayName: c.label }])),
    },
    views: [
      { type: 'table', name: 'By section', record, order: t ? ['id', 'name', 'result', 'pass_share', 'tests'] : ['id', 'name', 'result', 'verb'],
        groupBy: { property: 'section_label', direction: 'ASC' }, groupOrder: groups, sort, display: { result: 'status', ...(t ? { pass_share: 'bar' } : {}) },
        columnSize: { id: 80, name: 380, result: 140, pass_share: 220, tests: 90, verb: 110 } },
      { type: 'table', name: 'Requirements', record, order: t ? ['id', 'name', 'result', 'verb', 'tests', 'pass', 'fail', 'section_label'] : ['id', 'name', 'result', 'verb', 'section_label'],
        sort, display: { result: 'status' }, columnSize: { id: 80, name: 320, result: 130, verb: 100, tests: 80, pass: 80, fail: 80, section_label: 320 } },
      { type: 'table', name: 'Requirement × test file', record, order: ['id', 'name', ...cols.map((c) => c.key)], sort, display: matrixDisplay,
        columnSize: { id: 64, name: 220, ...Object.fromEntries(cols.map((c) => [c.key, 120])) } },
      { type: 'kanban', name: 'By result', record, order: t ? ['name', 'id', 'tests', 'section_label'] : ['name', 'id', 'section_label'],
        groupBy: { property: 'result' }, groupOrder: ['fail', 'unverified', 'not run', 'pass', 'deferred'], columnWidth: 260, sort },
    ],
  };
}

export const VIEW_NAMES = { tree: 'By section', table: 'Requirements', matrix: 'Requirement × test file' };

export class BBSpec extends BBElement {
  static schema = schema;
  static css = `
bb-spec { --bbs-h: 640px; }
bb-spec .bbs-wait { color: var(--bb-muted); font-size: 13px; }
bb-spec .bbs-head { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; margin: 0 0 10px; font-size: 14px; }
bb-spec .bbs-head .counts { font-weight: 600; font-variant-numeric: tabular-nums; }
bb-spec .bbs-head .why { color: var(--bb-muted); font-weight: 400; }
bb-spec .bbs-head .from { color: var(--bb-muted); font-size: 12.5px; overflow-wrap: anywhere; }
bb-spec data-views { min-width: 0; --data-height: var(--bbs-h); }
bb-spec .bbs-switch { margin-left: auto; display: inline-flex; border: 1px solid var(--bb-border); border-radius: 9px; overflow: hidden; background: var(--bb-card); }
bb-spec .bbs-switch button { border: 0; background: transparent; color: var(--bb-muted); font: inherit; font-size: 12.5px; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
bb-spec .bbs-switch button + button { border-left: 1px solid var(--bb-border); }
bb-spec .bbs-switch button[aria-pressed="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 600; }
@media (max-width: 640px) { bb-spec { --bbs-h: 560px; } }
`;

  /** The reader's flip (Requirements / History) while page.json's `view` is unchanged, else the setting. */
  shown() {
    const s = this.settings;
    return s.toggle && this._flip && this._flip.from === s.view ? this._flip.view : s.view;
  }

  async render() {
    const spec = this.data.spec;
    const reqs = spec?.requirements;
    if (!spec || !Array.isArray(reqs) || !reqs.length) return this.empty();
    const s = this.settings;
    const hist = !!(this.data.spec_history && this.data.spec_history.tests.length);
    const shown = hist ? this.shown() : this.shown() === 'history' ? 'tree' : this.shown();
    if (shown === 'history') return this.history();
    const box = this.data.box || 'Box';
    const ran = ranOf(spec);
    const wait = document.createElement('div');
    wait.className = 'bbs-wait';
    wait.textContent = 'Loading the requirements…';
    this.replaceChildren(wait);
    const token = (this._token = (this._token || 0) + 1);
    const core = await loadViews();
    if (token !== this._token) return; // a newer render started meanwhile
    const rows = specRows(spec);
    const cols = matrixColumns(reqs);
    const doc = specBase(rows, cols, s);
    const text = `# ${box}: spec, proposals-pages/spec/spec.base's presets over state.json spec.requirements (bb-spec)\n${core.stringifyBase(doc)}`;
    const head = document.createElement('div');
    head.className = 'bbs-head';
    const run = spec.junit_run;
    head.innerHTML = `<span class="counts${ran ? '' : ' why'}">${esc(headerText(spec, { showTests: s.show_tests }))}</span>`
      + (ran && run?.at ? `<span class="from">junit run ${esc(String(run.at).slice(0, 16).replace('T', ' '))}${run.skipped ? ` · ${fmtNum(run.skipped)} skipped` : ''}</span>` : '');
    const views = document.createElement('data-views');
    views.id = `bbs-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('view', VIEW_NAMES[shown] || 'By section');
    views.setAttribute('aria-label', `${box}: spec`);
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; wait.remove(); }, { once: true });
    views.baseText = text;
    views.base = core.parseBase(text);
    if (noteRows(rows)) views.pageRenderer = notePages(views, rows);
    const num = (label, extra = {}) => ({ type: 'number', label, decimals: 0, ...extra });
    views.data = { id: `bb/${box}/spec/${s.view}.${+s.show_tests}`, title: `${box} spec`, titleProperty: 'name',
      properties: {
        k: num('Order', { hidden: true }),
        id: { type: 'text', label: 'Id' }, name: { type: 'text', label: 'Requirement' },
        verb: { type: 'text', label: 'Kind', note: 'shall / should / deferred: OBJECTIVES.md; contract: a test of the box\'s own tooling' },
        kind: { type: 'text', label: 'From' }, section_label: { type: 'text', label: 'OBJECTIVES section' }, source: { type: 'text', label: 'Source' },
        result: { type: 'text', label: 'Result', tones: RESULT_TONES, display: 'status',
          note: 'pass: every mapped test passes; fail: one fails; unverified: no test maps to it; deferred: a later ruler; not run: no test run folded' },
        tests: num('Tests'), pass: num('Pass'), fail: num('Fail'), skipped: num('Skipped'),
        pass_share: num('Passing', { unitText: '%', better: 'higher', note: 'pass ÷ (pass + fail), skipped left out' }),
        patterns: { type: 'list', label: 'Map (spec map)' }, failing: { type: 'list', label: 'Failing tests' },
        statement: { type: 'text', label: 'Statement' }, description: { type: 'text', label: 'Description' },
        ...Object.fromEntries(cols.map((c) => [c.key, { type: 'text', label: c.label, tones: RESULT_TONES, display: 'status',
          note: c.glob ? `${c.file}: a pattern in the map; the slice does not list the files it matched` : c.file }])),
      },
      rows };
    if (hist && s.toggle) this.addSwitch(head, shown);
    this.append(head, views);
  }

  addSwitch(head, shown) {
    const sw = document.createElement('span');
    sw.className = 'bbs-switch';
    sw.setAttribute('role', 'group');
    sw.setAttribute('aria-label', 'Spec view');
    sw.innerHTML = `<button data-flip="tree" aria-pressed="${shown !== 'history'}">Requirements</button><button data-flip="history" aria-pressed="${shown === 'history'}">History</button>`;
    sw.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const want = b.dataset.flip === 'tree' ? (this.settings.view === 'history' ? 'tree' : this.settings.view) : 'history';
      this._flip = { view: want, from: this.settings.view };
      this.render();
    }));
    head.append(sw);
  }

  /** History (CONTRACT §16.8): the gates .base's spec presets (data-ui §56's nested matrix, then its table) over the rows
      bb-gates.rows.js expands from spec_history: section › requirement › test file › test per commit. */
  async history() {
    const d = this.data;
    const s = this.settings;
    const box = d.box || 'Box';
    const token = (this._token = (this._token || 0) + 1);
    const wait = document.createElement('div');
    wait.className = 'bbs-wait';
    wait.textContent = 'Loading the history…';
    this.replaceChildren(wait);
    const core = await loadViews();
    if (token !== this._token) return;
    const h = d.spec_history;
    const ran = h.commits.filter((c) => c.ran);
    const last = ran[ran.length - 1];
    const head = document.createElement('div');
    head.className = 'bbs-head';
    head.innerHTML = `<span class="counts">${esc(`${fmtNum(h.tests.length)} tests over ${fmtNum(h.commits.length)} commits`)}</span>`
      + `<span class="from">${esc(`a junit run on each commit's archive (${fmtNum(ran.length)} with a suite)${last ? ` · newest ${last.sha}: ${fmtNum(last.tests)} tests, ${fmtNum(last.failed)} failing` : ''}`)}</span>`;
    const text = gatesBase({ ruler: false, spec: true, commits: h.commits.map((c) => c.sha) });
    const views = document.createElement('data-views');
    views.id = `bbs-h-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('toolbar', 'compact');
    views.setAttribute('view', PRESETS['spec-matrix']);
    views.setAttribute('aria-label', `${box}: spec history`);
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = `history:${e.detail.type}`; wait.remove(); }, { once: true });
    views.baseText = text;
    views.base = core.parseBase(text);
    views.data = gatesDataset(d, { ruler: false, spec: true });
    if (s.toggle) this.addSwitch(head, 'history');
    this.append(head, views);
  }
}
register(BBSpec);
