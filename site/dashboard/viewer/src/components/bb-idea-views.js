/* <bb-idea-views>: the Ideas tab (viewer/CONTRACT.md §16.3), PICKS.md's "Idea queue" pick: proposals-ideas-v2 01 Lens
   board (one data-ui <data-views> over state.json ideas with five presets, Roadmap · Table · Board · Lineage · Text, and
   its fuel-gauge header), + 02's Agent / Zach split (`split`), + 03's gate state in each lane header (`gate_state`, from
   the gates slice and the iterations' best). Each pick is a setting, so switching it is a page.json edit.

   Roadmap is the Oct 3 lens board as a host view registered with data-ui (`type: lanes`, data-ui CONTRACT §1
   "Registering by hand") on the core that loadViews() returns: lanes are rungs, cards are ideas in implementation order,
   an edge is an idea's own Needs: line and nothing else, a click opens the zoom card (data-ui's side peek). Its layout
   engine is the board's graph.js, spliced in verbatim below; its drawing is 01's lanes.js plus the gate-state line.
   WHY a copy here and not an import: a component loads nothing itself (tests/boundary), and data-ui has no swimlane view
   yet (proposals-ideas-v2 README, data-ui gap 1: upstream `lanes` as a stock type, then delete this copy).

   Rows: the fold (viewer/tools/folds/ideas) adds the Lens fields to S0's base rows; here they get 01's names back for
   data-ui (id = iid, lane = whose, solutions = solutions_md, expect = expect_then), so the .base below is 01's ideas.base. */
import { BBElement, esc, fmtNum } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadViews, loadKpi } from '../core/kit.js';
import { md } from '../core/inline.js';
import schema from './bb-idea-views.schema.js';

/* ── the Oct 3 lens board's layout engine (proposals-ideas-v2/_shared/lanes/graph.js, verbatim from here to the next
   rule; its own header says where it came from) ─────────────────────────────────────────────────────────────────── */
// GENERATED: vibetracks @ 7bf9ecd clank/src/roadmap/graph.ts (the Oct 3 kinsim lens board's layout, ported there from
// clank-kinsim src/roadmap/graph.ts @ 69e91af), types stripped by esbuild 0.x; its one import (doc.ts's blankRung) stubbed.
// Do not edit: re-port it. Pure functions: lanes (axes) x cards (rungs) -> Ladder, Depth, Now.Next.Later layouts, boxes, curves.
const blankRung = (id, axis, dependsOn = []) => ({ id, axis, title: id, depends_on: dependsOn });
const BANKED = /* @__PURE__ */ new Set(["green", "done"]);
const edgeKey = (edge) => `${edge.from}>${edge.to}`;
function finish(axes, rungs, edges) {
  const byId = new Map(rungs.map((rung) => [rung.id, rung]));
  const axisIndex = new Map(axes.map((axis, i) => [axis.id, i]));
  const parents = new Map(rungs.map((rung) => [rung.id, []]));
  const children = new Map(rungs.map((rung) => [rung.id, []]));
  for (const edge of edges) {
    parents.get(edge.to).push(edge.from);
    children.get(edge.from).push(edge.to);
  }
  const closure = (start, next) => {
    const seen = /* @__PURE__ */ new Set();
    const stack = [...next.get(start) ?? []];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id) || id === start) continue;
      seen.add(id);
      stack.push(...next.get(id) ?? []);
    }
    return seen;
  };
  return {
    axes,
    rungs,
    edges,
    byId,
    parents,
    children,
    up: new Map(rungs.map((rung) => [rung.id, closure(rung.id, parents)])),
    down: new Map(rungs.map((rung) => [rung.id, closure(rung.id, children)])),
    feedback: feedbackEdges(axes, rungs, edges, axisIndex),
    axisIndex,
    hasWaves: rungs.some((rung) => rung.wave != null)
  };
}
function modelFromParts(axes, parts) {
  const rungs = parts.map((part, index) => ({
    id: part.id,
    axis: part.axis,
    title: part.id,
    status: part.status ?? "missing",
    frontier: false,
    triage: [],
    wave: part.wave ?? null,
    est: part.est ?? 0,
    sameAs: part.sameAs ?? null,
    index,
    rung: blankRung(part.id, part.axis, part.pre ?? [])
  }));
  const edges = [];
  for (const part of parts) {
    for (const parent of part.pre ?? []) edges.push({ from: parent, to: part.id, kind: "pre" });
    if (part.sameAs) edges.push({ from: part.sameAs, to: part.id, kind: "same" });
  }
  return finish(axes, rungs, edges);
}
function feedbackEdges(axes, rungs, edges, axisIndex) {
  const byId = new Map(rungs.map((rung) => [rung.id, rung]));
  const authored = (id) => (axisIndex.get(byId.get(id).axis) ?? 0) * 1e4 + byId.get(id).index;
  const feedback = /* @__PURE__ */ new Set();
  for (; ; ) {
    const live = edges.filter((edge) => !feedback.has(edgeKey(edge)));
    const indegree = new Map(rungs.map((rung) => [rung.id, 0]));
    for (const edge of live) indegree.set(edge.to, indegree.get(edge.to) + 1);
    const queue = [...indegree].filter(([, d]) => d === 0).map(([id]) => id);
    const seen = /* @__PURE__ */ new Set();
    while (queue.length) {
      const id = queue.shift();
      seen.add(id);
      for (const edge of live) {
        if (edge.from !== id) continue;
        const d = indegree.get(edge.to) - 1;
        indegree.set(edge.to, d);
        if (d === 0) queue.push(edge.to);
      }
    }
    if (seen.size === rungs.length) return feedback;
    const reaches = (from, goal) => {
      const stack = [from];
      const visited = /* @__PURE__ */ new Set();
      while (stack.length) {
        const id = stack.pop();
        if (id === goal) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        for (const edge of live) if (edge.from === id) stack.push(edge.to);
      }
      return false;
    };
    const cyclic = live.filter((edge) => !seen.has(edge.from) && !seen.has(edge.to) && reaches(edge.to, edge.from));
    cyclic.sort((a, b) => authored(b.from) - authored(a.from) || authored(a.to) - authored(b.to));
    feedback.add(edgeKey(cyclic[0]));
  }
}
const isBanked = (model, id) => BANKED.has(model.byId.get(id)?.status ?? "");
function buckets(model) {
  const target = (id) => {
    const seen = /* @__PURE__ */ new Set();
    let current = id;
    let blocked = false;
    while (model.byId.get(current).sameAs && !seen.has(current)) {
      seen.add(current);
      blocked || (blocked = model.byId.get(current).triage.length > 0);
      current = model.byId.get(current).sameAs;
    }
    return { end: current, blocked };
  };
  const unmet = (id) => (model.parents.get(id) ?? []).filter((p) => !isBanked(model, p));
  const own = /* @__PURE__ */ new Map();
  for (const rung of model.rungs) {
    if (isBanked(model, rung.id)) own.set(rung.id, "banked");
    else if (!unmet(rung.id).length && !rung.triage.length) own.set(rung.id, "ready");
  }
  for (const rung of model.rungs) {
    if (own.has(rung.id)) continue;
    const waiting = unmet(rung.id);
    const oneStep = waiting.length ? waiting.every((p) => own.get(p) === "ready") && !rung.triage.length : true;
    own.set(rung.id, oneStep ? "next" : "later");
  }
  return new Map(model.rungs.map((rung) => {
    const { end, blocked } = target(rung.id);
    const placed = own.get(end);
    return [rung.id, blocked && placed === "ready" ? "next" : placed];
  }));
}
const bucket = (model, id) => buckets(model).get(id);
const BUCKETS = [
  { id: "banked", title: "Banked", perRow: 3 },
  { id: "ready", title: "Ready now", perRow: 2 },
  { id: "next", title: "Next", perRow: 2 },
  { id: "later", title: "Later", perRow: 3 }
];
function depthColumns(model) {
  const memo = /* @__PURE__ */ new Map();
  const col = (id) => {
    const cached = memo.get(id);
    if (cached != null) return cached;
    memo.set(id, 0);
    const rung = model.byId.get(id);
    let c = 0;
    if (rung.sameAs) c = col(rung.sameAs);
    else for (const edge of model.edges) if (edge.to === id && edge.kind === "pre" && !model.feedback.has(edgeKey(edge))) c = Math.max(c, col(edge.from) + 1);
    memo.set(id, c);
    return c;
  };
  model.rungs.forEach((rung) => col(rung.id));
  return memo;
}
function packRows(model, at) {
  const row = /* @__PURE__ */ new Map();
  const rows = /* @__PURE__ */ new Map();
  for (const axis of model.axes) {
    const members = model.rungs.filter((r) => r.axis === axis.id).map((r) => r.id).sort((a, b) => at(a) - at(b) || model.byId.get(a).index - model.byId.get(b).index);
    const lastEnd = [];
    for (const id of members) {
      const start = at(id);
      let chosen = -1;
      for (const parent of model.parents.get(id) ?? []) {
        if (!row.has(parent) || model.byId.get(parent).axis !== axis.id) continue;
        if (lastEnd[row.get(parent)] < start) {
          chosen = row.get(parent);
          break;
        }
      }
      if (chosen < 0) chosen = lastEnd.findIndex((end) => end < start);
      if (chosen < 0) {
        chosen = lastEnd.length;
        lastEnd.push(-Infinity);
      }
      lastEnd[chosen] = start;
      row.set(id, chosen);
    }
    rows.set(axis.id, Math.max(1, lastEnd.length));
  }
  return { row, rows };
}
function layout(model, lens) {
  const pos = /* @__PURE__ */ new Map();
  if (lens === "ladder") {
    for (const axis of model.axes) model.rungs.filter((r) => r.axis === axis.id).forEach((r, i) => pos.set(r.id, { gc: i, gr: 0 }));
    const slots2 = Math.max(1, ...[...pos.values()].map((p) => p.gc + 1));
    return { lens, pos, rows: new Map(model.axes.map((a) => [a.id, 1])), slots: slots2, heads: Array.from({ length: slots2 }, (_, i) => ({ at: i, span: 1, label: i === 0 ? "rung 0" : String(i) })) };
  }
  if (lens === "board") {
    const rows2 = /* @__PURE__ */ new Map();
    const heads = [];
    let start = 0;
    const placed = buckets(model);
    for (const b of BUCKETS) {
      const members = (axis) => model.rungs.filter((r) => r.axis === axis && placed.get(r.id) === b.id);
      const width = Math.max(1, Math.min(b.perRow, Math.max(...model.axes.map((a) => members(a.id).length))));
      for (const axis of model.axes) {
        const list = members(axis.id);
        list.forEach((r, i) => pos.set(r.id, { gc: start + i % width, gr: Math.floor(i / width) }));
        rows2.set(axis.id, Math.max(rows2.get(axis.id) ?? 1, Math.ceil(list.length / width)));
      }
      heads.push({ at: start, span: width, label: `${b.title} \xB7 ${[...placed.values()].filter((v) => v === b.id).length}`, bucket: b.id });
      start += width;
    }
    return { lens, pos, rows: rows2, slots: start, heads };
  }
  if (lens === "waves" && model.hasWaves) {
    const maxWave = Math.max(...model.rungs.map((r) => r.wave ?? 0));
    const wave = (id) => model.byId.get(id).wave ?? maxWave + 1;
    const memo = /* @__PURE__ */ new Map();
    const sub = (id) => {
      const cached = memo.get(id);
      if (cached != null) return cached;
      memo.set(id, 0);
      const rung = model.byId.get(id);
      let c = 0;
      if (rung.sameAs && wave(rung.sameAs) === wave(id)) c = sub(rung.sameAs);
      else for (const edge of model.edges) {
        if (edge.to === id && edge.kind === "pre" && !model.feedback.has(edgeKey(edge)) && wave(edge.from) === wave(id)) c = Math.max(c, sub(edge.from) + 1);
      }
      memo.set(id, c);
      return c;
    };
    const widths = Array.from({ length: maxWave + 2 }, (_, w) => Math.max(1, ...model.rungs.filter((r) => wave(r.id) === w).map((r) => sub(r.id) + 1)));
    const starts = widths.map((_, w) => widths.slice(0, w).reduce((sum, width) => sum + width, 0));
    const at = (id) => starts[wave(id)] + sub(id);
    const { row: row2, rows: rows2 } = packRows(model, at);
    model.rungs.forEach((r) => pos.set(r.id, { gc: at(r.id), gr: row2.get(r.id) }));
    const heads = widths.map((span, w) => ({ at: starts[w], span, label: w === maxWave + 1 ? "no wave" : `w${w}` }));
    return { lens, pos, rows: rows2, slots: starts[maxWave + 1] + widths[maxWave + 1], heads };
  }
  const col = depthColumns(model);
  const { row, rows } = packRows(model, (id) => col.get(id));
  model.rungs.forEach((r) => pos.set(r.id, { gc: col.get(r.id), gr: row.get(r.id) }));
  const slots = Math.max(1, ...[...col.values()].map((c) => c + 1));
  return { lens: "depth", pos, rows, slots, heads: Array.from({ length: slots }, (_, i) => ({ at: i, span: 1, label: i === 0 ? "depth 0" : String(i) })) };
}
function place(model, lay, o) {
  const lr = o.orient === "lr";
  const across = (lr ? o.cellW : o.cellH) + o.gapAcross;
  const within = (lr ? o.cellH : o.cellW) + o.gapWithin;
  const lanes = [];
  let cursor = lr ? o.head : o.label;
  for (const axis of model.axes) {
    const n = lay.rows.get(axis.id) ?? 1;
    const size = n * within - o.gapWithin + o.pad * 2;
    lanes.push({ axis, start: cursor, size });
    cursor += size + o.laneGap;
  }
  const laneOf = new Map(lanes.map((lane) => [lane.axis.id, lane]));
  const origin = lr ? o.label : o.head;
  const nodes = /* @__PURE__ */ new Map();
  for (const [id, slot] of lay.pos) {
    const lane = laneOf.get(model.byId.get(id).axis);
    const a = origin + slot.gc * across;
    const w = lane.start + o.pad + slot.gr * within;
    nodes.set(id, lr ? { x: a, y: w, w: o.cellW, h: o.cellH } : { x: w, y: a, w: o.cellW, h: o.cellH });
  }
  const extentA = origin + lay.slots * across;
  const extentW = cursor - o.laneGap;
  return {
    orient: o.orient,
    nodes,
    lanes,
    gaps: { across: o.gapAcross, within: o.gapWithin },
    heads: lay.heads.map((h) => ({ ...h, a: origin + h.at * across, len: h.span * across - o.gapAcross })),
    width: (lr ? extentA : extentW) + 6,
    height: (lr ? extentW : extentA) + 6
  };
}
function neighbour(model, geo, from, dir) {
  const origin = geo.nodes.get(from);
  const source = model.byId.get(from);
  if (!origin || !source) return null;
  const centre = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
  const here = centre(origin);
  const candidates = [];
  for (const [id, box] of geo.nodes) {
    if (id === from) continue;
    const there = centre(box);
    const dx = there.x - here.x;
    const dy = there.y - here.y;
    const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
    if (along <= 0.5) continue;
    const across = Math.abs(dir === "left" || dir === "right" ? dy : dx);
    candidates.push({ id, score: along + 2 * across, across });
  }
  const best = (list) => list.sort((a, b) => a.score - b.score || a.across - b.across || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]?.id ?? null;
  const alongLane = geo.orient === "lr" ? dir === "left" || dir === "right" : dir === "up" || dir === "down";
  if (alongLane) {
    return best(candidates.filter((c) => model.byId.get(c.id)?.axis === source.axis));
  }
  return best(candidates);
}
function firstRung(model, geo) {
  const reading = [...geo.nodes].sort(([a, p], [b, q]) => p.y - q.y || p.x - q.x || (a < b ? -1 : a > b ? 1 : 0));
  return (reading.find(([id]) => model.byId.get(id)?.frontier) ?? reading[0])?.[0] ?? null;
}
const ELBOW_RADIUS = 6;
function elbowPath(geo, a, b) {
  const lr = geo.orient === "lr";
  const along = (box) => lr ? { lo: box.x, len: box.w } : { lo: box.y, len: box.h };
  const across = (box) => lr ? { lo: box.y, len: box.h } : { lo: box.x, len: box.w };
  const u1 = along(a).lo + along(a).len, v1 = across(a).lo + across(a).len / 2;
  const u2 = along(b).lo, v2 = across(b).lo + across(b).len / 2;
  const g1 = u1 + geo.gaps.across / 2, g2 = u2 - geo.gaps.across / 2;
  let route;
  if (Math.abs(g1 - g2) < 1e-6) route = [[u1, v1], [g1, v1], [g1, v2], [u2, v2]];
  else {
    const above = across(b).lo - geo.gaps.within / 2, below = across(b).lo + across(b).len + geo.gaps.within / 2;
    const vc = Math.abs(above - v1) <= Math.abs(below - v1) ? above : below;
    route = [[u1, v1], [g1, v1], [g1, vc], [g2, vc], [g2, v2], [u2, v2]];
  }
  const points = route.filter((p, i) => {
    if (i === 0 || i === route.length - 1) return i === 0 || p[0] !== route[i - 1][0] || p[1] !== route[i - 1][1];
    const q = route[i - 1], n = route[i + 1];
    return !(p[0] === q[0] && p[0] === n[0] || p[1] === q[1] && p[1] === n[1]);
  });
  const xy = ([u, v]) => lr ? [u, v] : [v, u];
  const line = (from, to) => from[1] === to[1] ? `H${to[0]}` : `V${to[1]}`;
  let at = xy(points[0]);
  let d = `M${at[0]} ${at[1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1], corner = points[i], next = points[i + 1];
    const inLen = Math.abs(corner[0] - prev[0]) + Math.abs(corner[1] - prev[1]), outLen = Math.abs(next[0] - corner[0]) + Math.abs(next[1] - corner[1]);
    const r = Math.min(ELBOW_RADIUS, inLen / 2, outLen / 2);
    const before = xy([corner[0] - Math.sign(corner[0] - prev[0]) * r, corner[1] - Math.sign(corner[1] - prev[1]) * r]);
    const after = xy([corner[0] + Math.sign(next[0] - corner[0]) * r, corner[1] + Math.sign(next[1] - corner[1]) * r]);
    const c = xy(corner);
    if (before[0] !== at[0] || before[1] !== at[1]) d += ` ${line(at, before)}`;
    d += ` Q${c[0]} ${c[1]} ${after[0]} ${after[1]}`;
    at = after;
  }
  const last = xy(points[points.length - 1]);
  return `${d} ${line(at, last)}`;
}
function edgePath(geo, edge, style = "curve") {
  const a = geo.nodes.get(edge.from);
  const b = geo.nodes.get(edge.to);
  if (edge.kind === "same") {
    const lr = geo.orient === "lr";
    if (lr ? a.x === b.x : a.y === b.y) return lr ? `M${a.x - 4} ${a.y + a.h / 2} V${b.y + b.h / 2}` : `M${a.x + a.w / 2} ${a.y - 4} H${b.x + b.w / 2}`;
    if (lr) {
      const right = b.x > a.x;
      const x13 = right ? a.x + a.w : a.x, x23 = right ? b.x : b.x + b.w, y13 = a.y + a.h / 2, y23 = b.y + b.h / 2;
      const d3 = Math.max(12, Math.min(48, Math.abs(x23 - x13) / 2)) * (right ? 1 : -1);
      return `M${x13} ${y13} C${x13 + d3} ${y13}, ${x23 - d3} ${y23}, ${x23} ${y23}`;
    }
    const down = b.y > a.y;
    const x12 = a.x + a.w / 2, x22 = b.x + b.w / 2, y12 = down ? a.y + a.h : a.y, y22 = down ? b.y : b.y + b.h;
    const d2 = Math.max(12, Math.min(48, Math.abs(y22 - y12) / 2)) * (down ? 1 : -1);
    return `M${x12} ${y12} C${x12} ${y12 + d2}, ${x22} ${y22 - d2}, ${x22} ${y22}`;
  }
  if (style === "elbow") return elbowPath(geo, a, b);
  if (geo.orient === "lr") {
    const x12 = a.x + a.w, y12 = a.y + a.h / 2, x22 = b.x, y22 = b.y + b.h / 2;
    const d2 = Math.max(12, Math.min(48, Math.abs(x22 - x12) / 2));
    return `M${x12} ${y12} C${x12 + d2} ${y12}, ${x22 - d2} ${y22}, ${x22} ${y22}`;
  }
  const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
  const d = Math.max(12, Math.min(48, Math.abs(y2 - y1) / 2));
  return `M${x1} ${y1} C${x1} ${y1 + d}, ${x2} ${y2 - d}, ${x2} ${y2}`;
}
function criticalPath(model, goal) {
  const memo = /* @__PURE__ */ new Map();
  const weight = (id) => {
    const rung = model.byId.get(id);
    return isBanked(model, id) || rung.sameAs ? 0 : rung.est;
  };
  const dist = (id) => {
    const cached = memo.get(id);
    if (cached) return cached;
    memo.set(id, { d: 0, via: null });
    let best = 0;
    let via = null;
    for (const edge of model.edges) {
      if (edge.to !== id || model.feedback.has(edgeKey(edge))) continue;
      const d = dist(edge.from).d;
      if (d > best) {
        best = d;
        via = edge.from;
      }
    }
    const value = { d: best + weight(id), via };
    memo.set(id, value);
    return value;
  };
  const path = [];
  for (let id = goal; id; id = dist(id).via) path.unshift(id);
  return { total: dist(goal).d, path: path.filter((id) => weight(id) > 0 || id === goal) };
}
/* ── end of graph.js (its export list dropped: the functions are used in this module) ── */

/* ── the lanes view: 01's lanes.js (proposals-ideas-v2/_shared/lanes/), with the changes marked ADDED: each lane
   header can carry a state line (`laneState`, 03's gate state), the label column widens for it, titles draw as Markdown ─────────────────── */

let cellValue = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v.value : v); // replaced by data-ui's own on load

const LENSES = [['ladder', 'Ladder'], ['depth', 'Depth'], ['now', 'Now · Next · Later']];

function opts(lens, orient, rich, narrow, extra) {
  const lr = orient === 'lr';
  const w = rich ? 200 : 214, h = rich ? 80 : 28;
  // ADDED: a header with a state line needs a wider label column (lr) or a taller head (td), and one more line of pad
  return { orient, cellW: w, cellH: h, gapAcross: rich ? 22 : 14, gapWithin: rich ? 10 : 6, laneGap: 8,
    label: lr ? (narrow ? (extra ? 108 : 92) : (extra ? 178 : 150)) : (lens === 'now' ? 96 : 72),
    head: lr ? 26 : (extra ? 64 : 50), pad: 8 + (lr ? 7 * extra : 0) };
}

class LanesView {
  constructor(host, el) {
    this.host = host;
    this.el = el;
    this.sel = null;
    el.classList.add('dv-lanes');
    el.innerHTML = '<div class="dv-lanes-bar"></div><div class="dv-lanes-stage" tabindex="0" aria-label="Roadmap: lanes are rungs, cards are ideas"><div class="dv-lanes-canvas"></div></div>';
    this.bar = el.querySelector('.dv-lanes-bar');
    this.stage = el.querySelector('.dv-lanes-stage');
    this.canvas = el.querySelector('.dv-lanes-canvas');
    this.onClick = (e) => {
      const b = e.target.closest('[data-lens],[data-orient],[data-cards]');
      if (b && this.bar.contains(b)) {
        const cfg = { ...(this.input.view.lanes || {}) };
        if (b.dataset.lens) cfg.lens = b.dataset.lens;
        if (b.dataset.orient) cfg.orient = b.dataset.orient;
        if (b.dataset.cards) cfg.cards = b.dataset.cards;
        this.host.setView({ lanes: cfg });
        return;
      }
      const card = e.target.closest('.dv-lanes-card');
      if (card && !this.dragged) {
        if (card.dataset.fold) {
          const ids = card.dataset.fold.split(',');
          this.host.open(ids[0], { records: this.input.rows.filter((r) => ids.includes(r.id)), title: card.textContent.trim() });
        } else this.host.open(card.dataset.id);
      }
    };
    el.addEventListener('click', this.onClick);
    // drag to pan (Oct 3: "Grab anywhere and drag"); a short press is still a click
    this.onDown = (e) => {
      if (e.button !== 0) return;
      const s = { x: e.clientX, y: e.clientY, l: this.stage.scrollLeft, t: this.stage.scrollTop };
      this.dragged = false;
      const move = (m) => {
        const dx = m.clientX - s.x, dy = m.clientY - s.y;
        if (!this.dragged && Math.hypot(dx, dy) < 5) return;
        this.dragged = true;
        this.stage.classList.add('is-drag');
        this.stage.scrollLeft = s.l - dx;
        this.stage.scrollTop = s.t - dy;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        this.stage.classList.remove('is-drag');
        setTimeout(() => { this.dragged = false; }, 0);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    this.stage.addEventListener('pointerdown', this.onDown);
    // arrow keys walk a lane (graph.js `neighbour`), Enter opens the zoom card
    this.onKey = (e) => {
      const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
      if (!dir || !this.model) return;
      e.preventDefault();
      const next = this.sel && this.geo.nodes.has(this.sel) ? neighbour(this.model, this.geo, this.sel, dir) : firstRung(this.model, this.geo);
      if (next && !next.startsWith('done:')) this.host.open(next);
    };
    this.stage.addEventListener('keydown', this.onKey);
  }

  update(input) {
    this.input = input;
    const v = input.view.lanes || {};
    const lens = LENSES.some(([k]) => k === v.lens) ? v.lens : 'ladder';
    const orient = v.orient === 'td' ? 'td' : 'lr';
    const rich = v.cards === 'rich';
    const fold = v.done ? v.done === 'collapse' : lens !== 'ladder';
    const P = { lane: v.lane || 'rung', needs: v.needs || 'needs', order: v.order || 'order', done: v.done_property || 'done',
      state: v.state || 'board', label: v.label || 'id', title: v.title || input.dataset.titleProperty || 'title',
      note: v.laneNote, split: v.split, flag: v.flag, sub: v.sub };
    const laneState = v.laneState || null; // ADDED: {<lane name>: {text, title?, tone?}}
    this.el.classList.toggle('rich', rich);
    // ---- lanes: every value of the lane property, in laneOrder first (an empty rung is still a lane) -------------
    const val = (r, p) => (p ? cellValue(r[p]) : null);
    const order = [...(v.laneOrder || [])];
    for (const r of input.rows) { const k = String(val(r, P.lane) ?? 'none'); if (!order.includes(k)) order.push(k); }
    const splitOrder = P.split ? [...(v.splitOrder || [])] : [null];
    if (P.split) for (const r of input.rows) { const k = String(val(r, P.split) ?? '—'); if (!splitOrder.includes(k)) splitOrder.push(k); }
    const axisOf = (r) => String(val(r, P.lane) ?? 'none') + (P.split ? ' / ' + String(val(r, P.split) ?? '—') : '');
    // with a split (whose move: Agent / Zach, Nov 19 "so it makes the blockers clear") a rung gets one sub-lane per owner
    // that has an idea on it; a rung with no idea at all keeps one empty lane, so the ladder never loses a rung
    const used = new Set(input.rows.map(axisOf));
    const axes = [];
    for (const l of order) {
      const subs = splitOrder.filter((s) => !P.split || used.has(l + ' / ' + s));
      for (const s of (subs.length ? subs : [P.split ? splitOrder[0] : null])) axes.push({ id: l + (P.split ? ' / ' + s : ''), title: l, split: s });
    }
    const rows = [...input.rows].sort((a, b) => (val(a, P.order) ?? 1e9) - (val(b, P.order) ?? 1e9));
    const shown = new Set(rows.map((r) => r.id));
    // ---- cards (done ideas fold into one "+N done" card per lane outside Ladder) --------------------------------
    const cards = [];
    const foldOf = new Map();
    const folds = new Map();
    for (const r of rows) {
      const done = !!val(r, P.done);
      if (fold && done) {
        const key = 'done:' + axisOf(r);
        if (!folds.has(key)) { folds.set(key, []); cards.push({ id: key, axis: axisOf(r), fold: true, done: true }); }
        folds.get(key).push(r.id);
        foldOf.set(r.id, key);
      } else cards.push({ id: r.id, axis: axisOf(r), row: r, done });
    }
    const at = (id) => foldOf.get(id) || id;
    const rungs = cards.map((c, index) => ({ id: c.id, axis: c.axis, title: c.id, status: c.done ? 'green' : 'missing', frontier: false,
      triage: [], wave: null, est: 0, sameAs: null, index, rung: {} }));
    const edges = [];
    const how = new Map();
    for (const r of rows) {
      const needs = (val(r, P.needs) || []);
      const hows = val(r, P.needs + '_how') || [];
      needs.forEach((n, k) => {
        if (!shown.has(n)) return;
        const e = { from: at(n), to: at(r.id), kind: 'pre' };
        if (e.from === e.to || edges.some((x) => x.from === e.from && x.to === e.to)) return;
        edges.push(e);
        how.set(e.from + '>' + e.to, hows[k] || 'written');
      });
    }
    const model = finish(axes, rungs, edges);
    const lay = layout(model, lens === 'now' ? 'board' : lens);
    const narrow = (this.el.clientWidth || 1000) < 560;
    this.el.classList.toggle('narrow', narrow);
    const O = opts(lens, orient, rich, narrow, laneState ? 1 : 0);
    if (P.split && orient === 'lr') O.pad += 6;   // a split lane's label is one line longer (rung, owner, counts)
    const geo = place(model, lay, O);
    this.model = model;
    this.geo = geo;
    this.cards = cards;
    this.folds = folds;
    // ---- draw ------------------------------------------------------------------------------------------------
    const t = input.tokens;
    const col = input.columns[P.state] || {};
    const slot = (value) => { const s = (col.colors || {})[value]; return s ? t.series[(s - 1) % t.series.length] : t.muted; };
    const lr = orient === 'lr';
    let html = '';
    geo.lanes.forEach((lane) => {
      const ax = lane.axis;
      const members = rows.filter((r) => axisOf(r) === ax.id);
      const open = members.filter((r) => !val(r, P.done)).length;
      const note = P.note && members[0] ? val(members[0], P.note) : '';
      const box = lr ? `left:0;top:${lane.start}px;width:${geo.width}px;height:${lane.size}px` : `top:0;left:${lane.start}px;height:${geo.height}px;width:${lane.size}px`;
      const lab = lr ? `left:10px;top:${lane.start + 6}px;width:${O.label - 18}px;max-height:${lane.size - 8}px` : `left:${lane.start + 6}px;top:6px;width:${lane.size - 12}px;height:${O.head - 8}px`;
      const name = ax.split ? `${esc(ax.title)} <span>${esc(ax.split)}</span>` : esc(ax.title);
      const st = laneState && laneState[ax.title]; // ADDED: 03's gate state, the same on each owner's lane of a rung
      const stHtml = st ? `<span class="gs${st.tone ? ' ' + esc(st.tone) : ''}" title="${esc(st.title || st.text)}">${esc(st.text)}</span>` : '';
      html += `<div class="dv-lanes-lane" style="${box}"></div>`;
      html += `<div class="dv-lanes-label" style="${lab}" title="${esc(note || '')}" data-lane="${esc(ax.id)}"><b>${name}</b><span>${members.length - open} done · ${open} open</span>${stHtml}${lr && rich && note ? `<span>${esc(note)}</span>` : ''}</div>`;
      if (!members.length) {
        const where = lr ? `left:${O.label + 4}px;top:${lane.start + 12}px` : `left:${lane.start + 10}px;top:${O.head + 8}px`;
        html += `<div class="dv-lanes-empty" style="${where}">no idea on this rung yet</div>`;
      }
    });
    for (const h of geo.heads) {
      const box = lr ? `left:${h.a}px;top:4px;width:${h.len}px` : `left:6px;top:${h.a}px;width:${O.label - 10}px`;
      html += `<div class="dv-lanes-head" style="${box}">${esc(lens === 'ladder' ? (h.at === 0 ? 'in the order crossed off, then open →' : '') : lens === 'depth' ? (h.at === 0 ? 'needs nothing open' : `${h.at} step${h.at > 1 ? 's' : ''} in`) : h.label.replace('Banked', 'Done'))}</div>`;
    }
    html += `<svg class="dv-lanes-svg" width="${geo.width}" height="${geo.height}">`;
    for (const e of edges) {
      html += `<path data-from="${esc(e.from)}" data-to="${esc(e.to)}" class="${how.get(e.from + '>' + e.to) === 'inferred' ? 'inferred' : ''}" d="${edgePath(geo, e, v.lines === 'elbow' ? 'elbow' : 'curve')}"><title>${esc(e.to)} needs ${esc(e.from)}${how.get(e.from + '>' + e.to) === 'inferred' ? ' (inferred, not yet confirmed)' : ''}</title></path>`;
    }
    html += '</svg>';
    for (const c of cards) {
      const b = geo.nodes.get(c.id);
      if (!b) continue;
      const pos = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
      if (c.fold) {
        const ids = folds.get(c.id);
        html += `<button class="dv-lanes-card is-done is-fold" data-id="${esc(c.id)}" data-fold="${esc(ids.join(','))}" style="${pos}" title="${esc(ids.join(', '))}">+${ids.length} done</button>`;
        continue;
      }
      const r = c.row;
      const state = val(r, P.state);
      const flag = P.flag ? val(r, P.flag) : null;
      const rc = r[P.lane];
      const mark = rc && typeof rc === 'object' && rc.basis ? ({ derived: '~', claimed: '”', chosen: '' }[rc.basis] ?? '') : '';
      const unl = (val(r, 'unlocks') || []).length;
      const title = String(val(r, P.title) ?? r.id);
      const tip = `${r.id} · ${title}${state ? ' · ' + state : ''}${mark ? ' · rung ' + (rc.note || '') : ''}${flag ? ' · ' + flag : ''}`;
      // ADDED: the title as ideas.md writes it (**bold**, `code`), drawn as Markdown the way bb-idea-preview draws it
      const flagHtml = flag ? `<span class="flag" title="${esc(flag)}">Zach</span>` : '';
      const markHtml = mark ? `<span class="mark" title="${esc(rc.note || '')}">${mark}</span>` : '';
      const inner = rich
        ? `<span class="top"><span class="id">${esc(val(r, P.label))}</span>${flagHtml}${markHtml}</span><span class="t">${md(title)}</span><span class="sub">${esc(P.sub ? String(val(r, P.sub) ?? '') : String(state ?? ''))}</span>`
        : `<span class="id">${esc(val(r, P.label))}</span><span class="t">${md(title)}</span>${flagHtml}${markHtml}`;
      html += `<button class="dv-lanes-card${c.done ? ' is-done' : ''} unlocks-${Math.min(2, unl)}" data-id="${esc(r.id)}" style="${pos};--st:${slot(state)}" title="${esc(tip)}">${inner}</button>`;
    }
    this.canvas.style.width = geo.width + 'px';
    this.canvas.style.height = geo.height + 'px';
    this.canvas.innerHTML = html;
    // ---- bar -------------------------------------------------------------------------------------------------
    const seg = (key, list, cur) => `<span class="dv-lanes-seg" role="group">${list.map(([k, label]) => `<button type="button" data-${key}="${k}" aria-pressed="${k === cur}">${label}</button>`).join('')}</span>`;
    const inferred = [...how.values()].filter((x) => x === 'inferred').length;
    this.bar.innerHTML = `${seg('lens', LENSES, lens)}${seg('orient', [['lr', '→'], ['td', '↓']], orient)}${seg('cards', [['compact', 'Compact'], ['rich', 'Game cards']], rich ? 'rich' : 'compact')}`
      + `<span class="dv-lanes-key"><span><i></i>needs (a Needs: line)</span>${inferred ? '<span class="k-dash"><i class="dash"></i>inferred, unconfirmed</span>' : ''}<span class="k-need">● needs</span><span class="k-unlock">● unlocks</span><span title="the mark after a card: who set its rung">rung set: ~ from records · ” from words · none = written</span></span>`;
    this.host.setStatus(`${axes.length} lanes · ${edges.length} needs edge${edges.length === 1 ? '' : 's'}${inferred ? ` (${inferred} inferred)` : ''} · ${fold ? 'done ideas folded' : 'every idea in crossed-off order'}`);
    this.mark();
  }

  peeked(peek) {
    this.sel = peek ? peek.id : null;
    this.mark();
  }

  mark() {
    if (!this.model) return;
    const sel = this.sel && this.model.byId.has(this.sel) ? this.sel : null;
    const need = new Set(sel ? this.model.parents.get(sel) : []);
    const unlock = new Set(sel ? this.model.children.get(sel) : []);
    this.el.classList.toggle('has-sel', !!sel);
    for (const b of this.canvas.querySelectorAll('.dv-lanes-card')) {
      const id = b.dataset.id;
      b.classList.toggle('is-sel', id === sel);
      b.classList.toggle('is-need', need.has(id));
      b.classList.toggle('is-unlock', unlock.has(id));
    }
    for (const p of this.canvas.querySelectorAll('path')) {
      p.classList.toggle('is-need', !!sel && p.dataset.to === sel);
      p.classList.toggle('is-unlock', !!sel && p.dataset.from === sel);
    }
    if (sel) {
      const b = this.geo.nodes.get(sel);
      const s = this.stage;
      if (b && (b.x < s.scrollLeft || b.x + b.w > s.scrollLeft + s.clientWidth || b.y < s.scrollTop || b.y + b.h > s.scrollTop + s.clientHeight)) {
        s.scrollTo({ left: Math.max(0, b.x - 60), top: Math.max(0, b.y - 40), behavior: 'smooth' });
      }
    }
  }

  destroy() {
    this.el.removeEventListener('click', this.onClick);
    this.stage.removeEventListener('pointerdown', this.onDown);
    this.stage.removeEventListener('keydown', this.onKey);
  }
}

let registered = false;
/** `type: lanes` on data-ui's own core (the module loadViews() returns), once per page. */
function registerLanes(core) {
  if (registered) return;
  registered = true;
  if (typeof core.cellValue === 'function') cellValue = core.cellValue;
  try {
    core.registerView('lanes', { name: 'Roadmap', icon: 'map', load: async () => LanesView });
  } catch (e) {
    if (!/already registered/.test(String(e?.message))) throw e; // a host page registered the same board first
  }
}

/* ── 01's dataset properties (proposals-ideas-v2/_shared/common PROPERTIES), the field names data-ui sees ───────── */
const BOARD = ['Up next', 'Zach to decide', 'Won', 'No win', 'Settled'];
export const PROPERTIES = {
  id: { type: 'text', label: 'Id', width: 64 },
  title: { type: 'text', label: 'Idea', width: 300 },
  lane: { type: 'text', label: 'Whose', width: 70, colors: { Agent: 1, Zach: 5 } },
  board: { type: 'text', label: 'Board', width: 116, colors: { 'Up next': 1, 'Zach to decide': 5, Won: 3, 'No win': 0, Settled: 0 } },
  board_rank: { type: 'number', label: 'Board order', hidden: true },
  outcome: { type: 'text', label: 'Outcome', width: 120 },
  done: { type: 'boolean', label: 'Crossed off', width: 60 },
  solutions: { type: 'text', label: 'Solution(s)', display: 'markdown', width: 300,
    note: 'the solutions that tried it (the → in ideas.md, meta.json); each links to its folder' },
  solution_ids: { type: 'list', label: 'Solution ids', hidden: true },
  solution: { type: 'text', label: 'Solution', display: 'link', width: 260,
    note: 'the solution that tried it, one click to its folder; the record lists every one' },
  score: { type: 'number', label: 'Score', digits: 3, better: 'lower', width: 80 },
  delta: { type: 'number', label: 'Δ vs parent', unitText: '%', decimals: 1, better: 'lower', width: 90 },
  bet: { type: 'text', label: 'Bet', width: 84, note: 'the % its Expect: named before the run' },
  expect: { type: 'text', label: 'Expect', width: 240 },
  rung: { type: 'text', label: 'Rung', width: 140,
    note: 'the gate the idea serves; its mark says who set it: C written, ~ inferred from records, ” inferred from words' },
  rung_set: { type: 'text', label: 'Rung set by', width: 190,
    colors: { written: 3, 'inferred by lane I2 · from records': 1, 'inferred by lane I2 · from words': 5, unassigned: 0 } },
  rung_says: { type: 'text', label: 'The gate', width: 260 },
  rung_why: { type: 'text', label: 'Rung, why', width: 260 },
  rung_state: { type: 'text', label: 'Rung state', hidden: true },
  ladder: { type: 'list', label: 'Ladder', hidden: true },
  needs: { type: 'list', label: 'Needs', relation: true, width: 90,
    note: "only from the idea's own Needs: line: it cannot start until these are done" },
  needs_how: { type: 'list', label: 'Needs set by', width: 90 },
  needs_why: { type: 'text', label: 'Needs, why', width: 300 },
  needs_label: { type: 'list', label: 'Edge', hidden: true },
  unlocks: { type: 'list', label: 'Unlocks', relation: true, width: 90, derived: 'the ideas whose Needs: line names this one' },
  waits_on: { type: 'text', label: 'Blocker', width: 150, derived: 'an open need owned by Zach' },
  built_on: { type: 'list', label: 'Built on', relation: true, width: 90,
    note: "recorded: its solution's parent in meta.json was made by this idea (lineage, not a need)" },
  answered_by: { type: 'list', label: 'Answered by', relation: true, width: 100 },
  order: { type: 'number', label: 'Order', width: 60,
    note: 'implementation order: the order ideas were crossed off (git), then the open ones as written' },
  horizon: { type: 'text', label: 'Now · Next · Later', width: 110,
    derived: 'from Needs: lines only: Done, Ready now (needs met), Next (one step), Later',
    colors: { Done: 0, 'Ready now': 3, Next: 1, Later: 5 } },
  words: { type: 'text', label: 'Words', width: 420 },
  result: { type: 'text', label: 'Result', width: 360 },
  queued: { type: 'text', label: 'Queued in', width: 80 },
  closed: { type: 'text', label: 'Crossed off in', width: 90 },
  queued_t: { type: 'date', label: 'Queued' },
  closed_t: { type: 'date', label: 'Crossed off' },
  line: { type: 'number', label: 'Line', width: 50 },
  source: { type: 'text', label: 'In ideas.md', width: 80 },
  section: { type: 'text', label: 'Section', hidden: true },
  text: { type: 'text', label: 'The line', hidden: true },
  open: { type: 'boolean', label: 'Open', hidden: true },
  key: { type: 'text', label: 'Row id in state.json', hidden: true },
};

/** state.json ideas -> data-ui rows under 01's field names. A row folded without the Lens fields (the ideas fold not run)
    still draws: on no rung ("Unassigned", saying why), in the file's order, with no edge. */
export function viewRows(ideas) {
  return ideas.map((r, i) => {
    const lens = typeof r.iid === 'string';
    const row = { ...r, key: r.id, id: String(lens ? r.iid : r.id), lane: r.whose || (r.lane === 'human' ? 'Zach' : 'Agent'),
      solutions: r.solutions_md ?? (r.solutions?.length ? r.solutions.join(', ') : { value: null, why: 'not tried yet' }),
      expect: r.expect_then ?? r.expect ?? null };
    delete row.whose; delete row.solutions_md; delete row.expect_then; delete row.iid;
    if (!lens) {
      Object.assign(row, { rung: { value: 'Unassigned', note: 'unassigned: this state.json was folded without the Lens board fields' },
        rung_set: 'unassigned', done: !r.open, order: i + 1, needs: [], needs_how: [], unlocks: [], built_on: [],
        horizon: r.open ? 'Ready now' : 'Done', words: r.text ?? null,
        board: r.open ? (r.lane === 'human' ? 'Zach to decide' : 'Up next') : 'Settled' });
    }
    return row;
  });
}

/** The ladder's lanes: what the fold read from OBJECTIVES.md (the same list on every row), then any rung a row names. */
export function ladderOf(rows) {
  const out = [...(rows.find((r) => Array.isArray(r.ladder))?.ladder || [])];
  for (const r of rows) { const k = String(cellValue(r.rung) ?? 'Unassigned'); if (!out.includes(k)) out.push(k); }
  if (out.includes('Unassigned')) out.push(out.splice(out.indexOf('Unassigned'), 1)[0]); // unassigned is the last lane
  return out;
}

const pct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : Math.abs(v) < 0.05 ? '±0 %' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} %`);
const rungNo = (r) => { const m = /^(\S+) · /.exec(String(cellValue(r.rung) ?? '')); return m ? m[1] : null; };
const OWN = new Set(['new best', 'beat its parent', 'no change', 'worse', 'tried']); // 01's "tried with its own solution"

/** 03's gate state for each rung's lane header: the rung in force climbs (how many of the box's gates its best passes,
    and that best); every later rung is "not started". Unassigned gets none. */
export function laneStates(rows, data) {
  const ladder = ladderOf(rows);
  const state = new Map();
  for (const r of rows) if (r.rung_state) state.set(String(cellValue(r.rung)), r.rung_state);
  const its = Array.isArray(data.iterations) ? data.iterations : [];
  const last = its[its.length - 1];
  const gates = Array.isArray(data.gates) ? data.gates : [];
  const judged = gates.filter((g) => g.passed === true || g.passed === false);
  const failed = judged.filter((g) => g.passed === false);
  const unit = data.objective?.unit ? ` ${data.objective.unit}` : '';
  const out = {};
  ladder.forEach((name, k) => {
    if (name === 'Unassigned') return;
    const st = state.get(name) || (k === 0 ? 'current' : 'not started'); // rung 1 is the ruler in force (OBJECTIVES.md title)
    if (st !== 'current') { out[name] = { text: st || 'not started', tone: 'idle' }; return; }
    const best = last && last.best_so_far !== null && last.best_so_far !== undefined
      ? `best ${fmtNum(last.best_so_far)}${unit} (${last.best_holder})` : 'nothing admissible scored yet';
    const gatesText = judged.length ? `${judged.length - failed.length} of ${gates.length} gates pass` : gates.length ? `${gates.length} gates, not judged yet` : '';
    const of = gates.find((g) => g.of)?.of;
    out[name] = {
      text: ['climbing', gatesText].filter(Boolean).join(' · '),
      title: [`climbing: ${best}`, gatesText && `${gatesText}${of ? ` (judged on ${of}, dev)` : ''}`,
        failed.length ? `failing: ${failed.map((g) => g.id).join(', ')}` : ''].filter(Boolean).join(' · '),
      tone: failed.length ? 'bad' : 'climb',
    };
  });
  return out;
}

/** The fuel gauge (01's five cards, common fuel_cards) from the rows alone: what is left, what waits on Zach, the hit
    rate, the bets against the ledger, how much of the roadmap is set. Each spark is the count after each change to the
    queue (an idea queued or crossed off, the fold's commit times). */
export function fuelCards(rows) {
  const t = (iso) => (iso ? Date.parse(iso) : null);
  const times = [...new Set(rows.flatMap((r) => [t(r.queued_t), t(r.closed_t)]).filter((x) => x !== null && Number.isFinite(x)))].sort((a, b) => a - b);
  const openAt = (list) => times.map((T) => ({ y: list.filter((r) => t(r.queued_t) !== null && t(r.queued_t) <= T && !(t(r.closed_t) !== null && t(r.closed_t) <= T)).length }));
  const agent = rows.filter((r) => r.lane === 'Agent');
  const human = rows.filter((r) => r.lane === 'Zach');
  const agentOpen = agent.filter((r) => !r.done);
  const humanOpen = human.filter((r) => !r.done);
  const agentDone = agent.filter((r) => r.done);
  const own = agentDone.filter((r) => OWN.has(r.outcome));
  const hits = own.filter((r) => r.outcome === 'new best');
  const bets = rows.filter((r) => r.bet && r.delta !== null && r.delta !== undefined);
  const wordsOnly = rows.filter((r) => !r.bet && r.expect && r.delta !== null && r.delta !== undefined).length;
  const unassigned = rows.filter((r) => r.rung_set === 'unassigned' || cellValue(r.rung) === 'Unassigned').length;
  const written = rows.filter((r) => r.rung_set === 'written').length;
  const inferred = rows.length - unassigned - written;
  const needsN = rows.reduce((n, r) => n + (r.needs || []).length, 0);
  const needsInf = rows.reduce((n, r) => n + (r.needs_how || []).filter((h) => h !== 'written').length, 0);
  const byRung = new Map();
  for (const r of rows.filter((x) => !x.done)) { const k = rungNo(r) || '–'; byRung.set(k, (byRung.get(k) || 0) + 1); }
  let rungLine = [...byRung].filter(([k]) => k !== '–').sort(([a], [b]) => String(a).localeCompare(String(b), 'en', { numeric: true }))
    .map(([k, v]) => `${v} on rung ${k}`).join(' · ');
  if (byRung.get('–')) rungLine += `${rungLine ? ' · ' : ''}${byRung.get('–')} unassigned`;
  const withBet = agentOpen.filter((r) => r.bet).length;
  return [
    { id: 'agent', label: 'Ideas left for the agent', value: { value: agentOpen.length, unit: 'open' },
      // WHY warn, not bad: an empty queue is a problem to fix (amber), never a failure (calm UI: amber/red only for problems)
      delta: { text: withBet ? `${withBet} bet a number` : 'none bets a number', tone: agentOpen.length <= 2 ? 'warn' : 'neutral' },
      spark: times.length > 1 ? openAt(agent) : null, from: `open in “I'll try” after each of ${times.length} queue changes` },
    { id: 'human', label: 'For Zach to decide', value: { value: humanOpen.length, unit: 'open' },
      delta: { text: `${human.length - humanOpen.length} decided`, tone: 'neutral' },
      spark: times.length > 1 ? openAt(human) : null, from: 'open in “Suggestions for Zach”' },
    { id: 'hits', label: 'Hit rate',
      value: own.length ? { value: Math.round((100 * hits.length) / own.length), unit: '%' } : { value: null, why: 'no idea tried with its own solution yet' },
      delta: { text: `${hits.length} new best${hits.length === 1 ? '' : 's'} of ${own.length} tried`, tone: 'neutral' },
      spark: times.length > 1 && own.length ? times.map((T) => ({ y: hits.filter((r) => t(r.closed_t) !== null && t(r.closed_t) <= T).length })) : null,
      from: `${agentDone.length} crossed off · ${agentDone.filter((r) => r.outcome === 'answered by others').length} answered by others' runs` },
    { id: 'bets', label: 'Bets vs the ledger', value: { value: bets.length, unit: 'numeric bets' },
      delta: { text: `${wordsOnly} more in words only`, tone: 'neutral' },
      from: bets.map((r) => `${r.id} bet ${r.bet}, got ${pct(r.delta)}`).join(' · ') || 'no Expect: line names a % yet' },
    { id: 'roadmap', label: 'On the roadmap', value: { value: rows.length - unassigned, unit: `of ${rows.length} on a rung` },
      delta: { text: `${inferred} inferred · ${unassigned} unassigned`, tone: 'neutral' },
      from: `${written || 'none'} written by hand yet${rungLine ? ` · open: ${rungLine}` : ''} · ${needsN} Needs: edge${needsN === 1 ? '' : 's'} (${needsInf} inferred)` },
  ];
}

const LENS = { ladder: 'ladder', depth: 'depth', 'now-next-later': 'now' };
const PRESET = { roadmap: 'Roadmap', table: 'Table', board: 'Board', lineage: 'Lineage', text: 'Text' };
const ZOOM = { sections: [
  { name: 'Proof', properties: ['outcome', 'solutions', 'bet', 'result'] },
  { name: 'On the roadmap', properties: ['rung', 'rung_set', 'rung_why', 'horizon', 'needs', 'needs_why', 'unlocks', 'waits_on'] },
  { name: 'The idea', properties: ['words', 'expect', 'lane', 'built_on', 'queued', 'closed', 'source'] },
] };
const BY_ORDER = [{ property: 'order', direction: 'ASC' }];

/** 01's ideas.base as a document, the settings applied: which preset opens, the lens, the cards, the split, the state. */
export function baseDoc(rows, s, { laneState = null, focus = null } = {}) {
  const ladder = ladderOf(rows);
  const lanes = { lane: 'rung', laneOrder: ladder, laneNote: 'rung_says', needs: 'needs', order: 'order', state: 'board',
    flag: 'waits_on', sub: 'outcome', lens: LENS[s.lens] || 'ladder', cards: s.cards === 'game' ? 'rich' : 'compact' };
  if (s.split) Object.assign(lanes, { split: 'lane', splitOrder: ['Agent', 'Zach'] }); // 02's Agent / Zach split
  if (laneState) lanes.laneState = laneState;
  const lineage = { parents: 'built_on', label: 'id', kept: { board: ['Won', 'Up next'] }, extinct: 'show' };
  if (focus) lineage.focus = focus;
  return {
    defaultView: PRESET[s.preset] || 'Roadmap',
    facets: ['rung', 'board', 'lane', 'horizon', 'rung_set'],
    views: [
      { type: 'lanes', name: 'Roadmap', order: ['id', 'title', 'rung', 'horizon', 'needs', 'unlocks', 'outcome'], lanes, record: ZOOM },
      { type: 'table', name: 'Table', order: ['order', 'id', 'title', 'board', 'rung', 'horizon', 'needs', 'solution', 'bet'],
        sort: BY_ORDER, rowHeight: 'medium', display: { solution: 'link' }, record: ZOOM },
      { type: 'kanban', name: 'Board', order: ['title', 'id', 'rung', 'solutions'], groupBy: { property: 'board' }, groupOrder: BOARD,
        sort: BY_ORDER, record: ZOOM },
      { type: 'lineage', name: 'Lineage', filters: `rung == ${JSON.stringify(ladder[0] || 'Unassigned')}`,
        order: ['id', 'title', 'outcome', 'solutions', 'built_on'], lineage, record: ZOOM },
      { type: 'list', name: 'Text', order: ['id', 'title', 'horizon', 'needs', 'outcome'], groupBy: { property: 'rung' }, groupOrder: ladder,
        sort: BY_ORDER, markers: 'none', record: ZOOM },
    ],
  };
}

/* ── the component ─────────────────────────────────────────────────────────────────────────────────────────────── */
let uid = 0;

export class BBIdeaViews extends BBElement {
  static schema = schema;
  static css = `
bb-idea-views { --bbiv-h: 640px; }
bb-idea-views .bbiv-fuel { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin: 0 0 12px; }
bb-idea-views .bbiv-fuel data-kpi { min-width: 0; }
bb-idea-views .bbiv-wait { color: var(--bb-muted); font-size: 13px; }
bb-idea-views data-views { min-width: 0; --data-height: var(--bbiv-h); } /* WHY no display: data-views is data-ui's flex column; block spilled the table out of its frame */
@media (max-width: 640px) { bb-idea-views { --bbiv-h: 560px; } }
bb-idea-views .dv-view-lanes { display: flex; flex-direction: column; height: 100%; min-height: 0; }
bb-idea-views .dv-lanes-bar { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; padding: 6px 2px 8px; font-size: 12.5px; color: var(--dv-muted); }
bb-idea-views .dv-lanes-seg { display: inline-flex; border: 1px solid var(--dv-border); border-radius: 7px; overflow: hidden; }
bb-idea-views .dv-lanes-seg button { font: inherit; padding: 3px 9px; border: 0; background: var(--dv-bg); color: var(--dv-fg); cursor: pointer; }
bb-idea-views .dv-lanes-seg button + button { border-left: 1px solid var(--dv-border); }
bb-idea-views .dv-lanes-seg button[aria-pressed="true"] { background: var(--dv-accent); color: var(--dv-on-accent); }
bb-idea-views .dv-lanes-key { display: inline-flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
bb-idea-views .dv-lanes-key i { display: inline-block; width: 18px; height: 0; border-top: 2px solid currentColor; vertical-align: middle; margin-right: 4px; }
bb-idea-views .dv-lanes-key i.dash { border-top-style: dashed; }
bb-idea-views .dv-lanes-key .k-need { color: var(--bbiv-need); }
bb-idea-views .dv-lanes-key .k-unlock { color: var(--bbiv-unlock); }
bb-idea-views .dv-lanes { --bbiv-need: #2c64d1; --bbiv-unlock: #7c3aed; }
:root[data-theme="dark"] bb-idea-views .dv-lanes { --bbiv-need: #6d9bf0; --bbiv-unlock: #a98bf5; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) bb-idea-views .dv-lanes { --bbiv-need: #6d9bf0; --bbiv-unlock: #a98bf5; } }
bb-idea-views .dv-lanes-stage { flex: 1; min-height: 0; overflow: auto; position: relative; border: 1px solid var(--dv-border); border-radius: 8px;
  background: var(--dv-bg); cursor: grab; outline: none; }
bb-idea-views .dv-lanes-stage.is-drag { cursor: grabbing; user-select: none; }
bb-idea-views .dv-lanes-canvas { position: relative; }
bb-idea-views .dv-lanes-lane { position: absolute; background: var(--dv-subtle); border-radius: 8px; }
bb-idea-views .dv-lanes-lane:nth-child(even) { background: color-mix(in srgb, var(--dv-subtle) 55%, var(--dv-bg)); }
bb-idea-views .dv-lanes-label { position: absolute; font-size: 12px; line-height: 1.3; color: var(--dv-fg); overflow: hidden; }
bb-idea-views .dv-lanes-label b { display: block; font-size: 12.5px; }
bb-idea-views .dv-lanes-label span { color: var(--dv-muted); display: block; font-size: 11.5px; }
bb-idea-views .dv-lanes-label .gs { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
bb-idea-views .dv-lanes-label .gs.climb { color: var(--dv-fg); }
bb-idea-views .dv-lanes-label .gs.bad { color: var(--bb-bad); font-weight: 600; }
bb-idea-views .dv-lanes-head { position: absolute; font-size: 11.5px; color: var(--dv-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
bb-idea-views .dv-lanes-svg { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
bb-idea-views .dv-lanes-svg path { fill: none; stroke: var(--dv-muted); stroke-width: 1.6; opacity: .75; }
bb-idea-views .dv-lanes-svg path.inferred { stroke-dasharray: 5 4; }
bb-idea-views .dv-lanes-svg path.is-need { stroke: var(--bbiv-need); stroke-width: 2.4; opacity: 1; }
bb-idea-views .dv-lanes-svg path.is-unlock { stroke: var(--bbiv-unlock); stroke-width: 2.4; opacity: 1; }
bb-idea-views .dv-lanes-card { position: absolute; box-sizing: border-box; display: flex; gap: 6px; align-items: center; text-align: left;
  font: 12px/1.25 var(--dv-font); color: var(--dv-fg); background: var(--dv-bg); border: 1px solid var(--dv-border);
  border-left: 4px solid var(--st, var(--dv-muted)); border-radius: 7px; padding: 3px 7px 3px 6px; cursor: pointer; overflow: hidden; }
bb-idea-views .dv-lanes-card:hover { border-color: var(--dv-accent); border-left-color: var(--st, var(--dv-muted)); }
bb-idea-views .dv-lanes-card .id { font-family: var(--dv-mono); font-size: 10.5px; color: var(--dv-muted); flex: none; }
bb-idea-views .dv-lanes-card .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
bb-idea-views .dv-lanes-card.is-done { opacity: .72; }
bb-idea-views .dv-lanes-card.is-done .t { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--dv-muted) 60%, transparent); }
bb-idea-views .dv-lanes-card.is-fold { justify-content: center; font-style: italic; color: var(--dv-muted); border-style: dashed; border-left-style: solid; }
bb-idea-views .dv-lanes-card .flag { flex: none; font-size: 10px; font-weight: 600; color: #8a5300; background: #f59e0b2e; border-radius: 4px; padding: 0 4px; }
:root[data-theme="dark"] bb-idea-views .dv-lanes-card .flag { color: #f0a24a; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) bb-idea-views .dv-lanes-card .flag { color: #f0a24a; } }
bb-idea-views .dv-lanes-card .mark { flex: none; font-size: 10px; color: var(--dv-muted); }
bb-idea-views .dv-lanes-card.is-sel { outline: 2px solid var(--dv-accent); outline-offset: 1px; opacity: 1; }
bb-idea-views .dv-lanes-card.is-need { box-shadow: 0 0 0 2px var(--bbiv-need); opacity: 1; }
bb-idea-views .dv-lanes-card.is-unlock { box-shadow: 0 0 0 2px var(--bbiv-unlock); opacity: 1; }
bb-idea-views .dv-lanes.has-sel .dv-lanes-card:not(.is-sel):not(.is-need):not(.is-unlock) { opacity: .45; }
bb-idea-views .dv-lanes.rich .dv-lanes-card { flex-direction: column; align-items: stretch; gap: 3px; padding: 0 8px 6px; border-left-width: 1px;
  border-top: 6px solid var(--st, var(--dv-muted)); }
bb-idea-views .dv-lanes.rich .dv-lanes-card .top { display: flex; justify-content: space-between; gap: 6px; padding-top: 4px; }
bb-idea-views .dv-lanes.rich .dv-lanes-card .t { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-weight: 600; }
bb-idea-views .dv-lanes.rich .dv-lanes-card .sub { font-size: 11px; color: var(--dv-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
bb-idea-views .dv-lanes.rich .dv-lanes-card.unlocks-1 { box-shadow: 0 0 0 1px var(--st); }
bb-idea-views .dv-lanes.rich .dv-lanes-card.unlocks-2 { box-shadow: 0 0 0 2px var(--st); }
bb-idea-views .dv-lanes.narrow .dv-lanes-key > span:not(.k-dash) { display: none; }
bb-idea-views .dv-lanes.narrow .dv-lanes-label span { font-size: 11px; }
bb-idea-views .dv-lanes-empty { position: absolute; font-size: 12px; color: var(--dv-muted); font-style: italic; }
`;

  async render() {
    const ideas = this.data.ideas;
    if (!Array.isArray(ideas) || !ideas.length) return this.empty();
    const s = this.settings;
    const box = this.data.box || 'Box';
    const wait = document.createElement('div');
    wait.className = 'bbiv-wait';
    wait.textContent = 'Loading the idea views…';
    this.replaceChildren(wait);
    const core = await loadViews();
    registerLanes(core);
    const rows = viewRows(ideas);
    const its = this.data.iterations || [];
    const holder = its.length ? its[its.length - 1].best_holder : null;
    const focus = holder ? rows.find((r) => (r.solution_ids || []).includes(holder))?.id || null : null;
    const doc = baseDoc(rows, s, { laneState: s.gate_state ? laneStates(rows, this.data) : null, focus });
    const text = `# ${box}: the idea queue, PICKS.md's Lens board (proposals-ideas-v2 01) as bb-idea-views draws it\n${core.stringifyBase(doc)}`;
    const views = document.createElement('data-views');
    views.id = `bbiv-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('views', 'tabs');
    views.setAttribute('view-counts', '');
    views.setAttribute('view', doc.defaultView);
    views.setAttribute('aria-label', `${box}: ideas`);
    const wrap = document.createElement('div');
    wrap.className = 'bbiv';
    this.append(wrap);
    if (s.fuel) {
      // WHY create, connect, then set .card: a <data-kpi> made before kpi.js defined it would keep .card as a plain
      // property and never draw (bb-kpi-strip connects first for the same reason)
      await loadKpi();
      const fuel = document.createElement('div');
      fuel.className = 'bbiv-fuel';
      fuel.setAttribute('role', 'group');
      fuel.setAttribute('aria-label', 'Fuel gauge');
      wrap.append(fuel);
      for (const c of fuelCards(rows)) {
        const k = document.createElement('data-kpi');
        k.dataset.id = c.id;
        k.textContent = `${c.label}: ${c.value.value ?? '—'} ${c.value.unit || ''}`;
        fuel.append(k);
        k.card = c;
      }
    }
    // settled = the first view drew (the story runner and shoot wait on the "Loading" line going away)
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; wait.remove(); }, { once: true });
    views.baseText = text;
    views.base = core.parseBase(text);
    // WHY the settings in the data id: data-ui keeps a reader's view changes per data id, so a page.json edit (a new
    // preset, lens or split) starts fresh instead of reopening yesterday's tweaks
    views.data = { id: `bb/${box}/ideas/${s.preset}.${s.lens}.${s.cards}.${+s.split}.${+s.gate_state}`, title: `${box} ideas`,
      titleProperty: 'title', linkProperty: 'source', properties: PROPERTIES, rows };
    wrap.append(views);
  }
}
register(BBIdeaViews);
