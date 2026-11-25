/* <bb-solution-detail>: one solution's page (viewer/CONTRACT.md §16.3), the body of pages/solution.json that every
   "click a dot" lands on. Ported from proposals-headliner/_detail: the kicker, the id, its change, four number cards
   (objective, holdout, rank, vs parent), a red card for failed gates, the lineage chain and children, gates and costs
   side by side, provenance, and prev / next. Reads only state.json `iterations`, `ablations`, `costs`, `gates` and
   `playback`; the proposal's per-task chart, ideas and ledger history are not in the state, so they are not here.

   When the state lists a saved bb-run/1 record for this solution, its run is explained by the stock <bb-evidence>
   (CONTRACT §14), given this element's context and state; else a calm note says none was saved. Every link to another
   solution fires bb-open {kind: 'solution', id, href} (the page follows links.solution unless a listener prevents it). */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { makeDetail, idFromUrl, pct } from './bb-solution-detail.model.js';
import './bb-evidence.js';
import schema from './bb-solution-detail.schema.js';
import css from './bb-solution-detail.css.js';

const dtf = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const date = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? dtf.format(new Date(t)) : '—'; };
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
/** 4 significant digits on this page (the exact value is in the title). */
const fmt = (v, d = 4) => (!fin(v) ? '—' : Number.isInteger(v) ? v.toLocaleString('en-CA') : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-CA') : String(+v.toPrecision(d)));
const exact = (v) => (fin(v) ? String(v) : '');
const pctNum = (a) => (a >= 10 ? a.toFixed(1) : a >= 0.1 ? a.toFixed(2) : a >= 0.001 ? a.toPrecision(2) : a === 0 ? '0' : '<0.001');
const pctTxt = (p) => (p === null ? '' : `${p > 0 ? '+' : p < 0 ? '−' : '±'}${pctNum(Math.abs(p))} %`);
const sha7 = (c) => (c && c.sha ? String(c.sha).slice(0, 7) : '—');
const gname = (g) => String(g).replace(/_/g, ' ');
const OPS = { '<=': '≤', '>=': '≥', '<': '<', '>': '>', is: 'is' };
const TIER = {
  'on the front': (c) => `on the front <span class="sub">(one of the ${c.front} there)</span>`,
  admissible: () => 'behind the front',
  'not admissible': () => '<span class="sub">not admissible: never on the front</span>',
  'ablation run': () => '<span class="sub">ablation run: never on the front</span>',
};

export class BBSolutionDetail extends BBElement {
  static schema = schema;
  static css = css;

  connectedCallback() {
    super.connectedCallback();
    // a hash-routed site (#solution=<id>) changes the id without a reload: read it again, only when the setting is ""
    this._onHash ||= () => { if (!this.settings.id) this.update(); };
    addEventListener('hashchange', this._onHash);
  }

  teardown() { if (this._onHash) removeEventListener('hashchange', this._onHash); }

  /** bb-open {kind: 'solution', id}; the context follows links.solution unless a listener prevented it. */
  open(id) {
    return this.context.open(this, { kind: 'solution', id, href: this.context.href('solution', { id }) });
  }

  link(id, body, rel = '') {
    return `<a href="${esc(this.context.href('solution', { id }))}" data-open="${esc(id)}"${rel ? ` data-rel="${rel}"` : ''}>${body}</a>`;
  }

  render() {
    const id = this.settings.id || idFromUrl(typeof location === 'undefined' ? null : location);
    const D = this.detail = makeDetail(this.data, id);
    if (!D) return this.empty(schema.empty, id ? `Asked for <b class="bb-mono">${esc(id)}</b>.` : 'No id given: open this page as <span class="bb-mono">?id=&lt;solution&gt;</span> or <span class="bb-mono">#solution=&lt;id&gt;</span>.');
    const d = this.data, o = d.objective || {}, r = D.row;
    const unit = o.unit || '', obj = o.label || o.name || 'objective';
    const U = (v) => `${fmt(v)}${unit ? ` <small>${esc(unit)}</small>` : ''}`;
    const Ut = (v) => `${fmt(v)}${unit ? ` ${esc(unit)}` : ''}`;
    const tone = (p) => (p === null || p === 0 ? '' : (p < 0) === (D.direction === 'lower') ? 'good' : 'bad');
    const failed = Object.entries(r.failed_gates || {});
    const isBest = D.best && D.best.id === r.id;

    const kicker = D.ablation
      ? `${esc(d.box || '')} · ablation run after #${esc(r.after ?? '—')}${D.gen !== null ? ` · generation ${esc(D.gen)}` : ''} · created ${date(r.created)}`
      : `${esc(d.box || '')} · #${esc(r.n)} of ${D.total}${D.gen !== null ? ` · generation ${esc(D.gen)}` : ''} · created ${date(r.created)}`;
    const badges = (D.ablation ? '<span class="badge abl">ablation run · not search progress</span>' : '')
      + (isBest ? '<span class="badge best">best</span>' : '');
    const verdict = this.verdictLine(D, Ut);

    const cards = `<div class="nums">
      <div class="num"><div class="l">${esc(obj)} · dev</div><div class="v" title="${exact(r.objective)}">${U(r.objective)}</div>
        <div class="s">${r.admissible ? '<span class="badge ok">admissible</span>' : '<span class="badge no">not admissible</span>'}${fin(r.gate_pass_rate) ? ` gate pass rate ${fmt(100 * r.gate_pass_rate, 3)} %` : ''}</div></div>
      <div class="num"><div class="l">holdout (reporting only)</div><div class="v" title="${exact(r.holdout)}">${fin(r.holdout) ? U(r.holdout) : '— <small>not scored</small>'}</div>
        <div class="s">${fin(r.holdout) ? `${pctTxt(D.holdoutVsDev)} vs dev` : 'not scored on holdout'}</div></div>
      <div class="num"><div class="l">rank</div><div class="v">${D.rank ? `${D.rank} <small>of ${D.admissibleCount} admissible</small>` : D.ablation ? '— <small>ablations are not ranked</small>' : '— <small>not admissible</small>'}</div>
        <div class="s">${D.bestAt && D.bestAt.value !== null ? `best so far at #${esc(D.bestAt.n)}: ${Ut(D.bestAt.value)}${D.bestAt.holder ? ` (${esc(D.bestAt.holder)})` : ''}` : o.ruler ? `ruler ${esc(o.ruler)}` : ''}</div></div>
      <div class="num"><div class="l">vs parent${D.parent ? ` ${esc(D.parent.id)}` : ''}</div><div class="v ${tone(D.vsParent)}">${D.parent ? (D.vsParent === null ? '—' : pctTxt(D.vsParent)) : '— <small>no parent</small>'}</div>
        <div class="s">${D.parent ? (D.parent.missing ? 'the parent is not in this state' : `parent ${Ut(D.parent.objective)}`) : 'a root solution'}</div></div>
    </div>`;
    const fails = failed.length ? `<div class="fails"><b class="bad">Fails ${failed.length} gate${failed.length === 1 ? '' : 's'}:</b> ${failed.map(([g, n]) => `${esc(gname(g))} on ${esc(n)} task${n === 1 ? '' : 's'}`).join(', ')}. A gate failure never moves the best line.</div>` : '';

    this.innerHTML = `<div class="bbs">
      <div class="kicker">${kicker}</div>
      <h1>${esc(r.id)}</h1>
      <div class="change">${badges}${esc(r.change || '')}</div>
      <div class="verdict">${verdict}</div>
      ${cards}${fails}
      ${D.ablation ? this.ablationBlock(D) : ''}
      <section class="blk"><h2>Lineage</h2>${this.lineage(D)}</section>
      <div class="twocol">
        <section class="blk"><h2>Gates</h2>${this.gates(D)}</section>
        <section class="blk"><h2>Costs</h2>${this.costs(D)}</section>
      </div>
      <section class="blk"><h2>Saved run</h2><div class="bbs-run">${D.runs.length ? '' : `<div class="note">${D.playbackListed
        ? `<b>No saved run for ${esc(r.id)}.</b> The box's export saved runs for ${esc([...new Set(((d.playback || {}).runs || []).map((x) => x.solution))].join(', ') || 'no solution')}; a bb-run/1 record listed in playback.runs would be explained here.`
        : '<b>No saved runs in this state.</b> When the box\'s export writes bb-run/1 records and lists them in playback.runs, this solution\'s run is explained here (what each metric scored, which samples it came from).'}</div>`}</div></section>
      <section class="blk"><h2>Provenance</h2>${this.provenance(D)}</section>
      <div class="pager">${D.prev ? this.link(D.prev.id, `← ${D.prev.n ? `#${esc(D.prev.n)} ` : ''}${esc(D.prev.id)}`, 'prev') : '<span></span>'}${D.next ? this.link(D.next.id, `${D.next.n ? `#${esc(D.next.n)} ` : ''}${esc(D.next.id)} →`, 'next') : '<span></span>'}</div>
    </div>`;
    this.wire();
    if (D.runs.length) this.evidence(D);
  }

  verdictLine(D, Ut) {
    const r = D.row;
    if (D.ablation) return `<b>Ablation run</b> of ${D.parent && !D.parent.missing ? this.link(D.parent.id, esc(D.parent.id), 'parent') : esc(r.parent || '—')}: a study variant, not a search step, run after #${esc(r.after ?? '—')}. It never moves the best line.`;
    if (r.verdict === 'kept') {
      const b = D.bestBefore;
      return `<b class="good">Kept:</b> a new best at #${esc(r.n)}${b && b.value !== null ? `, beating ${Ut(b.value)}${b.holder ? ` (${esc(b.holder)})` : ''} by ${pctTxt(pct(r.objective, b.value))}` : ' (the first admissible solution)'}.`;
    }
    if (r.verdict === 'discarded') return `<b>Discarded:</b> admissible, but not better than the best so far${D.bestAt && D.bestAt.value !== null ? ` (${Ut(D.bestAt.value)}${D.bestAt.holder ? `, ${esc(D.bestAt.holder)}` : ''})` : ''}.`;
    if (r.verdict === 'failed') return '<b class="bad">Failed:</b> not admissible (a gate failed), so it never moves the best line.';
    return `<b>${esc(r.verdict || '—')}</b>`;
  }

  ablationBlock(D) {
    const f = D.facts;
    const rows = [
      f.component ? ['part', `${esc(f.op)}: <b>${esc(f.component)}</b>`] : null,
      f.kind ? ['study kind', esc(f.kind)] : null,
      f.fit ? ['weights', f.fit === 'frozen' ? 'frozen (every other part and weight as the base)' : 'refit'] : null,
      f.study ? ['study', `<code>${esc(f.study)}</code>`] : null,
      ['after', `#${esc(D.row.after ?? '—')}: the iteration evaluated just before it`],
    ].filter(Boolean);
    return `<section class="blk"><h2>What this run changed</h2><dl class="prov">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></section>`;
  }

  lineage(D) {
    const r = D.row;
    const chain = D.chain.map((x, i) => {
      const prev = i ? D.chain[i - 1] : null;
      const dlt = prev && !prev.missing && !x.missing ? pct(x.objective, prev.objective) : null;
      const tone = dlt === null || dlt === 0 ? '' : (dlt < 0) === (D.direction === 'lower') ? 'good' : 'bad';
      const body = x.missing ? `${esc(x.id)} <span class="f">not in this state</span>`
        : `${esc(x.id)} <span class="f">${fmt(x.objective, 3)}</span>${dlt !== null ? `<span class="d ${tone}">${pctTxt(dlt)}</span>` : ''}`;
      const rel = x === D.parent ? 'parent' : '';
      return (i ? '<span class="arr">→</span>' : '') + (x === r ? `<span class="me">${body}</span>` : x.missing ? `<span class="gone">${body}</span>` : this.link(x.id, body, rel));
    }).join('');
    const kidsIt = D.children.iterations.map((k) => this.link(k.id, `${esc(k.id)} <span class="f">${fmt(k.objective, 3)}</span>`, 'child')).join('');
    const ab = D.children.ablations;
    const showAb = ab.slice(0, 6).map((k) => this.link(k.id, `${esc(k.id)} <span class="f">${fmt(k.objective, 3)}</span>`, 'child')).join('');
    return `<div class="chain">${chain}</div>
      ${kidsIt ? `<div class="chain" style="margin-top:8px"><span class="lead">children:</span>${kidsIt}</div>` : ''}
      ${ab.length ? `<div class="chain bbs-abkids" style="margin-top:8px"><span class="lead">ablation runs of it (${ab.length}):</span>${showAb}${ab.length > 6 ? `<button class="more" data-more-kids>… ${ab.length - 6} more</button>` : ''}</div>` : ''}
      ${!kidsIt && !ab.length ? '<div class="faint" style="font-size:12.5px;margin-top:6px">No solution in this state names it as its parent.</div>' : ''}`;
  }

  gates(D) {
    if (!D.gates.length) return '<div class="note">No gate table in this state.</div>';
    const rows = D.gates.map((g) => {
      const u = g.unit ? ` ${esc(g.unit)}` : '';
      const rule = g.op !== null && g.threshold !== null ? `${esc(OPS[g.op] || g.op)} ${fmt(g.threshold)}${u}` : '';
      const state = g.passed === true ? '<span class="ok-mark">✓</span> passes' : g.passed === false ? `<span class="bad">✗ fails${g.failed_tasks ? ` on ${g.failed_tasks} task${g.failed_tasks === 1 ? '' : 's'}` : ''}</span>` : '<span class="sub">not judged</span>';
      const margin = g.judged && g.passed !== null ? (fin(g.margin)
        ? `<div class="sub">worst ${fmt(g.worst)}${u}${rule ? ` (limit ${rule})` : ''}: ${fmt(Math.abs(g.margin))}${u} ${g.margin >= 0 ? 'to spare' : 'over'}${g.tasks ? ` · ${g.tasks} tasks` : ''}</div>`
        : g.why_null ? `<div class="sub">${esc(g.why_null)}${g.tasks ? ` · ${g.tasks} tasks` : ''}</div>` : '') : '';
      return `<tr><td><div class="gname">${esc(g.id)}</div>${g.pass_when ? `<div class="sub">${esc(g.pass_when)}</div>` : ''}</td><td class="state">${state}${margin}</td></tr>`;
    }).join('');
    const judged = D.gates.some((g) => g.judged);
    return `<div class="scroll"><table><thead><tr><th>gate</th><th>this solution (dev)</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${judged ? '' : '<div class="faint" style="font-size:12px;margin-top:4px">Worst values and margins are recorded for the solution the gate table judges (the best), not for this one.</div>'}`;
  }

  costs(D) {
    if (!D.costsSlice) return '<div class="note">No cost recorded per solution in this state.</div>';
    if (!D.hasCosts) return `<div class="note">No costs row for ${esc(D.id)} in this state.</div>`;
    const rows = D.costs.map((c) => `<tr><td>${esc(c.meta.chip)}</td>
      <td class="n" title="${exact(c.value)}">${c.value === null ? '—' : `${fmt(c.value)}${c.meta.unit ? ` ${esc(c.meta.unit)}` : ''}`}</td>
      <td>${c.value === null ? `<span class="sub">not recorded: ${esc(c.why)}</span>` : (TIER[c.tier] ? TIER[c.tier](c) : esc(c.tier || '—'))}</td></tr>`).join('');
    return `<div class="scroll"><table><thead><tr><th>cost</th><th class="n">value</th><th>on that cost's front</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="faint" style="font-size:12px;margin-top:4px">A front is over admissible iterations only: cheaper and at least as good.</div>`;
  }

  provenance(D) {
    const r = D.row, c = r.commit, pb = r.proposed_by || {};
    const commit = c ? `<span class="bb-mono">${esc(sha7(c))}</span> ${esc(c.subject || '')} <span class="faint">(${esc(c.where || '')}${c.date ? `, ${date(c.date)}` : ''})</span>` : '—';
    return `<dl class="prov">
      <dt>created</dt><dd>${date(r.created)}</dd>
      <dt>evaluated</dt><dd>${date(r.evaluated)}</dd>
      <dt>commit</dt><dd>${commit}</dd>
      <dt>proposed by</dt><dd>${esc(pb.agent || r.proposer || '—')}${pb.model ? ` · ${esc(pb.model)}` : ''}${pb.backfilled ? ' <span class="faint">(backfilled)</span>' : ''}</dd>
      <dt>tags</dt><dd>${(r.tags || []).map((t) => `<code>${esc(t)}</code>`).join(' ') || '—'}</dd>
      ${D.gen !== null ? `<dt>generation</dt><dd>${esc(D.gen)}</dd>` : ''}
    </dl>`;
  }

  wire() {
    this.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); this.open(a.dataset.open); }));
    this.querySelector('[data-more-kids]')?.addEventListener('click', (e) => {
      const box = e.target.closest('.bbs-abkids');
      e.target.remove();
      const extra = this.detail.children.ablations.slice(6).map((k) => this.link(k.id, `${esc(k.id)} <span class="f">${fmt(k.objective, 3)}</span>`, 'child')).join('');
      box.insertAdjacentHTML('beforeend', extra);
      box.querySelectorAll('[data-open]').forEach((a) => { if (!a.dataset.wired) { a.dataset.wired = '1'; a.addEventListener('click', (ev) => { ev.preventDefault(); this.open(a.dataset.open); }); } });
    });
    this.querySelectorAll('[data-open]').forEach((a) => { a.dataset.wired = '1'; });
  }

  /** The stock <bb-evidence> for this solution's saved run: its settings, then this element's context and state (the
      way bb-page sets a section). It holds only `playback` (its own reads). */
  evidence(D) {
    const ev = document.createElement('bb-evidence');
    ev.settings = { run: D.id, picker: false };
    ev.context = this.context;
    ev.state = this.data;
    this.querySelector('.bbs-run').append(ev);
  }
}
register(BBSolutionDetail);
