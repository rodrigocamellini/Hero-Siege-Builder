import fs from 'node:fs';

function loadOurPoints() {
  const json = JSON.parse(fs.readFileSync('files_incarnation/incarnation_completa (1).json', 'utf8'));
  const raw = json?.datasetColl?.[0]?.data ?? json?.data ?? json;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function loadRefPoints() {
  const s = fs.readFileSync('pastareferencia/INFOSNODES.js', 'utf8');
  const start = s.indexOf('treeFromExtract');
  if (start < 0) return [];
  const nodesStart = s.indexOf('nodes:[', start);
  const nodesEnd = s.indexOf('],connections:[', nodesStart);
  if (nodesStart < 0 || nodesEnd < 0) return [];
  const seg = s.slice(nodesStart, nodesEnd);
  const re = /\{id:(\d+),x:(-?\d+(?:\.\d+)?),y:(-?\d+(?:\.\d+)?),nodeType:"/g;
  const out = [];
  for (const m of seg.matchAll(re)) out.push({ x: Number(m[2]), y: Number(m[3]) });
  return out.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function bounds(pts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1e-9, maxX - minX);
  const h = Math.max(1e-9, maxY - minY);
  return { minX, minY, maxX, maxY, w, h };
}

function normalize(pts) {
  const b = bounds(pts);
  return pts.map((p) => ({ x: (p.x - b.minX) / b.w, y: (p.y - b.minY) / b.h }));
}

function key(p, step) {
  const x = Math.round(p.x / step) * step;
  const y = Math.round(p.y / step) * step;
  return `${x.toFixed(6)},${y.toFixed(6)}`;
}

function overlapRatio(a, b, step) {
  const sa = new Set(a.map((p) => key(p, step)));
  let hit = 0;
  for (const p of b) if (sa.has(key(p, step))) hit++;
  const denom = Math.max(1, Math.min(sa.size, b.length));
  return { step, hit, a: sa.size, b: b.length, ratio: hit / denom };
}

function rmsNearest(a, b) {
  let sum = 0;
  let max = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    sum += best;
    if (best > max) max = best;
  }
  const mean = sum / Math.max(1, a.length);
  return { rms: Math.sqrt(mean), max: Math.sqrt(max) };
}

const our = loadOurPoints();
const ref = loadRefPoints();

console.log('ourPoints', our.length);
console.log('refPoints', ref.length);
console.log('ourBounds', bounds(our));
console.log('refBounds', bounds(ref));

const ourN = normalize(our);
const refN = normalize(ref);

for (const step of [0.02, 0.01, 0.005, 0.002]) {
  const o = overlapRatio(ourN, refN, step);
  console.log('normOverlap', step, `hit=${o.hit}`, `ratio=${(o.ratio * 100).toFixed(2)}%`);
}

const aToB = rmsNearest(ourN, refN);
const bToA = rmsNearest(refN, ourN);
console.log('nearestRMS our->ref', aToB);
console.log('nearestRMS ref->our', bToA);
