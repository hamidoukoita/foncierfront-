/**
 * Géométrie SVG pure (sans DOM) utilisée par l'import de plan de masse.
 * Tout est testable en Node : matrices, transformations, chemins (path `d`),
 * aplatissement des courbes, simplification et outils de polygones.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Matrice affine [a b c d e f] au sens SVG : x' = a·x + c·y + e ; y' = b·x + d·y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Retourne m1 × m2 (m2 est appliquée en premier, comme l'imbrication de transform SVG). */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function applyMatrix(m: Matrix, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

const NUMBER_RE = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

export function parseNumberList(value: string | null | undefined): number[] {
  if (!value) return [];
  return (value.match(NUMBER_RE) ?? []).map(Number).filter((n) => Number.isFinite(n));
}

/** Parse un attribut `transform` (matrix, translate, scale, rotate, skewX, skewY) en une matrice. */
export function parseTransform(value: string | null | undefined): Matrix {
  if (!value) return IDENTITY;
  let result: Matrix = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    const name = match[1];
    const a = parseNumberList(match[2]);
    let m: Matrix = IDENTITY;
    switch (name) {
      case 'matrix':
        if (a.length === 6) m = [a[0], a[1], a[2], a[3], a[4], a[5]];
        break;
      case 'translate':
        m = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
        break;
      case 'scale':
        m = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const rad = ((a[0] ?? 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rot: Matrix = [cos, sin, -sin, cos, 0, 0];
        if (a.length >= 3) {
          m = multiply(multiply([1, 0, 0, 1, a[1], a[2]], rot), [1, 0, 0, 1, -a[1], -a[2]]);
        } else {
          m = rot;
        }
        break;
      }
      case 'skewX':
        m = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        m = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    result = multiply(result, m);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Chemins (attribut `d`)
// ---------------------------------------------------------------------------

export interface FlatSubpath {
  points: Pt[];
  closed: boolean;
  /** Vrai si le sous-chemin contient au moins une courbe (Bézier ou arc) aplatie. */
  curved: boolean;
}

interface Scanner {
  s: string;
  i: number;
}

function skipSeparators(sc: Scanner): void {
  while (sc.i < sc.s.length && /[\s,]/.test(sc.s[sc.i])) sc.i++;
}

function readNumber(sc: Scanner): number | null {
  skipSeparators(sc);
  const re = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
  re.lastIndex = sc.i;
  const m = re.exec(sc.s);
  if (!m) return null;
  sc.i = re.lastIndex;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Les drapeaux d'arc sont des chiffres isolés (« a1 1 0 011 1 » est valide). */
function readFlag(sc: Scanner): number | null {
  skipSeparators(sc);
  const c = sc.s[sc.i];
  if (c === '0' || c === '1') {
    sc.i++;
    return Number(c);
  }
  return null;
}

const CUBIC_STEPS = 16;
const QUAD_STEPS = 12;

function cubicPoints(p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= CUBIC_STEPS; i++) {
    const t = i / CUBIC_STEPS;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

function quadPoints(p0: Pt, p1: Pt, p2: Pt): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= QUAD_STEPS; i++) {
    const t = i / QUAD_STEPS;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
}

/** Conversion arc SVG (paramétrage « endpoint ») → points (SVG 1.1, annexe F.6.5). */
function arcPoints(
  from: Pt,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: number,
  sweep: number,
  to: Pt,
): Pt[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (from.x === to.x && from.y === to.y)) return [to];

  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const steps = Math.max(4, Math.ceil(Math.abs(dTheta) / (Math.PI / 18)));
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dTheta * i) / steps;
    out.push({
      x: cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi,
      y: cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi,
    });
  }
  out[out.length - 1] = to;
  return out;
}

/**
 * Aplatit un attribut `d` en sous-chemins de points (coordonnées locales),
 * puis applique la matrice. Les segments droits (M L H V Z) restent exacts.
 */
export function flattenPath(d: string, matrix: Matrix = IDENTITY): FlatSubpath[] {
  const sc: Scanner = { s: d, i: 0 };
  const subpaths: FlatSubpath[] = [];
  let current: FlatSubpath | null = null;
  let pos: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let lastCubicCtrl: Pt | null = null;
  let lastQuadCtrl: Pt | null = null;
  let cmd = '';

  const flush = (): void => {
    if (current && current.points.length >= 2) subpaths.push(current);
    current = null;
  };
  const begin = (p: Pt): void => {
    flush();
    current = { points: [p], closed: false, curved: false };
    start = p;
    pos = p;
  };
  const ensure = (): FlatSubpath => {
    if (!current) {
      current = { points: [pos], closed: false, curved: false };
      start = pos;
    }
    return current;
  };

  const readPair = (relative: boolean): Pt | null => {
    const x = readNumber(sc);
    const y = readNumber(sc);
    if (x === null || y === null) return null;
    return relative ? { x: pos.x + x, y: pos.y + y } : { x, y };
  };

  while (true) {
    skipSeparators(sc);
    if (sc.i >= sc.s.length) break;
    const ch = sc.s[sc.i];
    if (/[A-Za-z]/.test(ch)) {
      cmd = ch;
      sc.i++;
    } else if (!cmd) {
      break; // données invalides
    }

    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    let ok = true;

    switch (up) {
      case 'M': {
        const p = readPair(rel);
        if (!p) { ok = false; break; }
        begin(p);
        cmd = rel ? 'l' : 'L'; // paires suivantes = lignes implicites
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case 'L': {
        const p = readPair(rel);
        if (!p) { ok = false; break; }
        ensure().points.push(p);
        pos = p;
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case 'H': {
        const x = readNumber(sc);
        if (x === null) { ok = false; break; }
        const p = { x: rel ? pos.x + x : x, y: pos.y };
        ensure().points.push(p);
        pos = p;
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case 'V': {
        const y = readNumber(sc);
        if (y === null) { ok = false; break; }
        const p = { x: pos.x, y: rel ? pos.y + y : y };
        ensure().points.push(p);
        pos = p;
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case 'C': {
        const c1 = readPair(rel);
        const savedPos = pos;
        const c2 = c1 ? readPairFrom(sc, rel, savedPos) : null;
        const p = c2 ? readPairFrom(sc, rel, savedPos) : null;
        if (!c1 || !c2 || !p) { ok = false; break; }
        const sp = ensure();
        sp.points.push(...cubicPoints(savedPos, c1, c2, p));
        sp.curved = true;
        pos = p;
        lastCubicCtrl = c2;
        lastQuadCtrl = null;
        break;
      }
      case 'S': {
        const savedPos = pos;
        const c2 = readPair(rel);
        const p = c2 ? readPairFrom(sc, rel, savedPos) : null;
        if (!c2 || !p) { ok = false; break; }
        const c1: Pt = lastCubicCtrl
          ? { x: 2 * savedPos.x - lastCubicCtrl.x, y: 2 * savedPos.y - lastCubicCtrl.y }
          : savedPos;
        const sp = ensure();
        sp.points.push(...cubicPoints(savedPos, c1, c2, p));
        sp.curved = true;
        pos = p;
        lastCubicCtrl = c2;
        lastQuadCtrl = null;
        break;
      }
      case 'Q': {
        const savedPos = pos;
        const c1 = readPair(rel);
        const p = c1 ? readPairFrom(sc, rel, savedPos) : null;
        if (!c1 || !p) { ok = false; break; }
        const sp = ensure();
        sp.points.push(...quadPoints(savedPos, c1, p));
        sp.curved = true;
        pos = p;
        lastQuadCtrl = c1;
        lastCubicCtrl = null;
        break;
      }
      case 'T': {
        const savedPos = pos;
        const p = readPair(rel);
        if (!p) { ok = false; break; }
        const c1: Pt = lastQuadCtrl
          ? { x: 2 * savedPos.x - lastQuadCtrl.x, y: 2 * savedPos.y - lastQuadCtrl.y }
          : savedPos;
        const sp = ensure();
        sp.points.push(...quadPoints(savedPos, c1, p));
        sp.curved = true;
        pos = p;
        lastQuadCtrl = c1;
        lastCubicCtrl = null;
        break;
      }
      case 'A': {
        const rx = readNumber(sc);
        const ry = readNumber(sc);
        const rot = readNumber(sc);
        const large = readFlag(sc);
        const sweep = readFlag(sc);
        const savedPos = pos;
        const p = readPair(rel);
        if (rx === null || ry === null || rot === null || large === null || sweep === null || !p) {
          ok = false;
          break;
        }
        const sp = ensure();
        sp.points.push(...arcPoints(savedPos, rx, ry, rot, large, sweep, p));
        sp.curved = true;
        pos = p;
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case 'Z': {
        if (current) {
          (current as FlatSubpath).closed = true;
          pos = start;
          flush();
        }
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      default:
        ok = false;
    }
    if (!ok) break;
  }
  flush();

  return subpaths.map((sp) => {
    const pts = sp.points.map((p) => applyMatrix(matrix, p));
    return { points: dedupeRing(pts, sp.closed), closed: sp.closed, curved: sp.curved };
  });
}

/** Lit une paire de nombres (relative à `origin` si `relative`). */
function readPairFrom(sc: Scanner, relative: boolean, origin: Pt): Pt | null {
  const x = readNumber(sc);
  const y = readNumber(sc);
  if (x === null || y === null) return null;
  return relative ? { x: origin.x + x, y: origin.y + y } : { x, y };
}

const EPS = 1e-6;

/** Supprime les doublons consécutifs et le point final identique au premier. */
export function dedupeRing(points: Pt[], closed: boolean): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > EPS || Math.abs(last.y - p.y) > EPS) out.push(p);
  }
  if (closed && out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first.x - last.x) <= EPS && Math.abs(first.y - last.y) <= EPS) out.pop();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Simplification (Douglas-Peucker)
// ---------------------------------------------------------------------------

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdpOpen(points: Pt[], epsilon: number): Pt[] {
  if (points.length <= 2) return points.slice();
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let maxDist = 0;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = distToSegment(points[i], points[lo], points[hi]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxDist > epsilon) {
      keep[idx] = true;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifie un anneau fermé (sans point final dupliqué) en conservant les angles marqués. */
export function simplifyRing(points: Pt[], epsilon: number): Pt[] {
  if (points.length <= 4) return points.slice();
  let far = 0;
  let farDist = -1;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const first = rdpOpen(points.slice(0, far + 1), epsilon);
  const second = rdpOpen([...points.slice(far), points[0]], epsilon);
  const merged = [...first.slice(0, -1), ...second.slice(0, -1)];
  return merged.length >= 3 ? merged : points.slice();
}

// ---------------------------------------------------------------------------
// Outils de polygones
// ---------------------------------------------------------------------------

export function polygonArea(points: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(points: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    // Polygone dégénéré : moyenne des sommets.
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundingBox(points: Pt[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Rectangle orienté d'aire minimale (essai de chaque direction d'arête).
 * Renvoie {short, long} = côtés du rectangle (façade ≈ côté court, profondeur ≈ côté long).
 */
export function orientedBoxSides(points: Pt[]): { short: number; long: number } {
  let best: { w: number; h: number; area: number } | null = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (!Number.isFinite(angle) || (a.x === b.x && a.y === b.y)) continue;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      const rx = p.x * cos - p.y * sin;
      const ry = p.x * sin + p.y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;
    if (!best || area < best.area) best = { w, h, area };
  }
  if (!best) return { short: 0, long: 0 };
  return { short: Math.min(best.w, best.h), long: Math.max(best.w, best.h) };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
