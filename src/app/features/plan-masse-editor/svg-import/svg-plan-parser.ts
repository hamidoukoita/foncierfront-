import {
  BBox,
  FlatSubpath,
  IDENTITY,
  Matrix,
  Pt,
  applyMatrix,
  boundingBox,
  dedupeRing,
  flattenPath,
  median,
  multiply,
  orientedBoxSides,
  parseNumberList,
  parseTransform,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  simplifyRing,
} from './svg-geometry';
import { prefixIds, sanitizeSvgText } from './svg-sanitizer';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type DetectionMode = 'AUTO' | 'BY_NAME' | 'ALL_POLYGONS';

export interface ParseOptions {
  mode: DetectionMode;
  canvasWidth: number;
  canvasHeight: number;
  margin?: number;
}

export interface DetectedLot {
  /** Identifiant stable dans une analyse (sert à inclure/exclure). */
  key: string;
  numero: string;
  /** Vrai si le numéro n'a trouvé aucune source dans le fichier (numérotation séquentielle). */
  numeroAuto: boolean;
  numeroIlot: string;
  /** Contour en coordonnées du canevas du Studio. */
  points: Pt[];
  areaPx2: number;
  shortPx: number;
  longPx: number;
  /** Superficie lue dans un texte du plan (« 450 m² »), si présente. */
  superficieTexteM2?: number;
  source: 'NOM' | 'FORME';
  warning?: string;
}

export interface FitTransform {
  scale: number;
  tx: number;
  ty: number;
}

export interface SvgPlanAnalysis {
  lots: DetectedLot[];
  fit: FitTransform;
  warnings: string[];
  stats: { shapes: number; closedShapes: number; texts: number; containers: number };
}

export interface BackgroundResult {
  /** Contenu à insérer dans le groupe « fond importé » (déjà dans l'espace du canevas). */
  markup: string;
  sizeBytes: number;
  /** Tracés composés dont seuls certains sous-chemins sont des lots : laissés dans le fond. */
  leftovers: number;
}

export interface SvgPlanParseResult {
  ok: boolean;
  error?: string;
  analysis?: SvgPlanAnalysis;
  buildBackground(includedKeys: ReadonlySet<string>): BackgroundResult;
}

// ---------------------------------------------------------------------------
// Constantes de reconnaissance
// ---------------------------------------------------------------------------

const SKIP_CONTAINERS = new Set(['defs', 'clippath', 'mask', 'pattern', 'symbol', 'marker', 'style', 'lineargradient', 'radialgradient']);
const SHAPE_TAGS = new Set(['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line']);
const INHERITED_ROOT_ATTRS = [
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'fill-rule', 'fill-opacity', 'stroke-opacity', 'opacity', 'font-family', 'font-size',
  'font-weight', 'text-anchor', 'style',
];

const LOT_NAME_RES: readonly RegExp[] = [
  /(?:^|[^a-z0-9])(?:lots?|parcelles?|parc)\s*[-_ .:°n]*\s*0*(\d+[a-z]?)(?![a-z0-9])/i,
  /^l\s*[-_ ]?\s*0*(\d+[a-z]?)$/i,
  /^p\s*[-_ ]?\s*0*(\d+)$/i,
];
const ILOT_RE = /(?:^|[^a-z0-9])(?:ilot|bloc|block|section)\s*[-_ .:°n]*\s*([a-z0-9]{1,4})(?![a-z0-9])/i;
const NUMBER_TEXT_RE = /^(?:lot|parcelle|parc|l|p|n°|n)?\s*[-.:°]?\s*0*(\d{1,4}[a-z]?)$/i;
const AREA_TEXT_RE = /(\d[\d\s.,]*)\s*(?:m2|m²|m\^2|mc|ca)(?![a-z0-9])/i;

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function matchLotName(label: string): string | null {
  const clean = stripAccents(label).trim();
  if (!clean) return null;
  for (const re of LOT_NAME_RES) {
    const m = re.exec(clean);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function matchIlot(label: string): string | null {
  const m = ILOT_RE.exec(stripAccents(label));
  return m ? m[1].toUpperCase() : null;
}

export function parseAreaText(text: string): number | null {
  const m = AREA_TEXT_RE.exec(text);
  if (!m) return null;
  let raw = m[1].replace(/\s+/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
  else if (raw.includes(',') && raw.includes('.')) raw = raw.replace(/\./g, '').replace(',', '.');
  else raw = raw.replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Collecte
// ---------------------------------------------------------------------------

interface Shape {
  /** Identifiant de l'élément source (attribut data-pm). */
  elId: number;
  points: Pt[];
  curved: boolean;
  label: string;
  /** Libellés des groupes ancêtres, du plus proche au plus lointain. */
  groupLabels: string[];
  groupKey: string;
  area: number;
  centroid: Pt;
  bbox: BBox;
  sides: { short: number; long: number };
  /** Vrai si le sous-chemin n'est pas fermé dans le fichier source. */
  open: boolean;
  /** Remplissage résolu (hérité des groupes), en minuscules ; '' si non précisé. */
  fill: string;
}

interface TextItem {
  elId: number;
  content: string;
  center: Pt;
}

interface Collector {
  nextId: number;
  shapes: Shape[];
  openCount: number;
  texts: TextItem[];
  unsupported: number;
  rawBounds: Pt[];
  hasImage: boolean;
}

function labelOf(el: Element): string {
  return el.getAttribute('data-lot') ?? el.getAttribute('data-name') ?? el.getAttribute('data-label') ?? el.getAttribute('id') ?? '';
}

function isHidden(el: Element): boolean {
  if (el.getAttribute('display') === 'none' || el.getAttribute('visibility') === 'hidden') return true;
  const style = el.getAttribute('style') ?? '';
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
}

function fillOf(el: Element): string | null {
  const m = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(el.getAttribute('style') ?? '');
  const v = (m?.[1] ?? el.getAttribute('fill'))?.trim().toLowerCase();
  return v ? v : null;
}

function shapeSubpaths(el: Element, tag: string, m: Matrix): FlatSubpath[] {
  const num = (name: string): number => {
    const v = parseFloat(el.getAttribute(name) ?? '');
    return Number.isFinite(v) ? v : 0;
  };
  switch (tag) {
    case 'path':
      return flattenPath(el.getAttribute('d') ?? '', m);
    case 'polygon':
    case 'polyline': {
      const n = parseNumberList(el.getAttribute('points'));
      const pts: Pt[] = [];
      for (let i = 0; i + 1 < n.length; i += 2) pts.push(applyMatrix(m, { x: n[i], y: n[i + 1] }));
      const closed = tag === 'polygon';
      return pts.length >= 2 ? [{ points: dedupeRing(pts, closed), closed, curved: false }] : [];
    }
    case 'rect': {
      const x = num('x');
      const y = num('y');
      const w = num('width');
      const h = num('height');
      if (w <= 0 || h <= 0) return [];
      const pts = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }].map((p) => applyMatrix(m, p));
      return [{ points: pts, closed: true, curved: false }];
    }
    case 'circle':
    case 'ellipse': {
      const cx = num('cx');
      const cy = num('cy');
      const rx = tag === 'circle' ? num('r') : num('rx');
      const ry = tag === 'circle' ? num('r') : num('ry');
      if (rx <= 0 || ry <= 0) return [];
      const pts: Pt[] = [];
      for (let i = 0; i < 32; i++) {
        const t = (i / 32) * Math.PI * 2;
        pts.push(applyMatrix(m, { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }));
      }
      return [{ points: pts, closed: true, curved: true }];
    }
    case 'line': {
      const a = applyMatrix(m, { x: num('x1'), y: num('y1') });
      const b = applyMatrix(m, { x: num('x2'), y: num('y2') });
      return [{ points: [a, b], closed: false, curved: false }];
    }
    default:
      return [];
  }
}

function textItem(el: Element, m: Matrix, elId: number): TextItem | null {
  const content = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!content) return null;
  const firstSpan = el.querySelector('tspan');
  const readCoord = (name: string): number => {
    const own = parseNumberList(el.getAttribute(name))[0];
    if (own !== undefined) return own;
    const spanVal = firstSpan ? parseNumberList(firstSpan.getAttribute(name))[0] : undefined;
    return spanVal ?? 0;
  };
  const style = el.getAttribute('style') ?? '';
  const fsMatch = /font-size\s*:\s*([\d.]+)/i.exec(style);
  const fontSize = parseFloat(fsMatch?.[1] ?? el.getAttribute('font-size') ?? '') || 10;
  const anchorMatch = /text-anchor\s*:\s*(\w+)/i.exec(style);
  const anchor = anchorMatch?.[1] ?? el.getAttribute('text-anchor') ?? 'start';
  const width = content.length * fontSize * 0.55;
  const x = readCoord('x');
  const y = readCoord('y');
  const cx = anchor === 'middle' ? x : anchor === 'end' ? x - width / 2 : x + width / 2;
  const cy = y - fontSize * 0.35;
  return { elId, content, center: applyMatrix(m, { x: cx, y: cy }) };
}

function walk(el: Element, m: Matrix, groups: string[], groupPath: string, inheritedFill: string, ctx: Collector): void {
  for (const child of Array.from(el.children)) {
    const tag = child.localName.toLowerCase();
    if (SKIP_CONTAINERS.has(tag) || isHidden(child)) continue;
    const cm = multiply(m, parseTransform(child.getAttribute('transform')));

    if (tag === 'g' || tag === 'svg') {
      const label = labelOf(child);
      const key = `${groupPath}/${ctx.nextId++}`;
      walk(child, cm, label ? [label, ...groups] : groups, key, fillOf(child) ?? inheritedFill, ctx);
      continue;
    }
    if (tag === 'use') {
      ctx.unsupported++;
      continue;
    }
    if (tag === 'image') {
      ctx.hasImage = true;
      continue;
    }
    if (tag === 'text') {
      const elId = ctx.nextId++;
      child.setAttribute('data-pm', String(elId));
      const item = textItem(child, cm, elId);
      if (item) ctx.texts.push(item);
      continue;
    }
    if (!SHAPE_TAGS.has(tag)) continue;

    const elId = ctx.nextId++;
    child.setAttribute('data-pm', String(elId));
    const subs = shapeSubpaths(child, tag, cm);
    const label = labelOf(child);
    for (const sub of subs) {
      ctx.rawBounds.push(...sub.points);
      if (!sub.closed) ctx.openCount++;
      ctx.shapes.push({
        elId,
        points: sub.points,
        curved: sub.curved,
        label,
        groupLabels: groups,
        groupKey: groupPath,
        area: 0,
        centroid: { x: 0, y: 0 },
        bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        sides: { short: 0, long: 0 },
        open: !sub.closed,
        fill: fillOf(child) ?? inheritedFill,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

export function parseSvgPlan(svgText: string, options: ParseOptions): SvgPlanParseResult {
  const failed = (error: string): SvgPlanParseResult => ({
    ok: false,
    error,
    buildBackground: () => ({ markup: '', sizeBytes: 0, leftovers: 0 }),
  });

  const sanitized = sanitizeSvgText(svgText);
  if (!sanitized.root) return failed(sanitized.error ?? 'SVG illisible.');
  const root = sanitized.root;
  const warnings = [...sanitized.warnings];

  const ctx: Collector = { nextId: 1, shapes: [], openCount: 0, texts: [], unsupported: 0, rawBounds: [], hasImage: false };
  walk(root, IDENTITY, [], 'root', fillOf(root) ?? '', ctx);

  if (ctx.shapes.length === 0) return failed('Aucune forme vectorielle trouvée dans ce SVG.');
  if (ctx.shapes.length > 6000) return failed('Plan trop complexe (plus de 6 000 formes). Simplifiez-le avant l’import.');
  if (ctx.unsupported) warnings.push(`${ctx.unsupported} élément(s) <use> ignoré(s) pour la détection (conservés dans le fond).`);

  // --- Cadre de référence ---------------------------------------------------
  const content = boundingBox(ctx.rawBounds);
  let frame: BBox = content;
  const vb = parseNumberList(root.getAttribute('viewBox'));
  const w = parseFloat(root.getAttribute('width') ?? '');
  const h = parseFloat(root.getAttribute('height') ?? '');
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    frame = { minX: vb[0], minY: vb[1], maxX: vb[0] + vb[2], maxY: vb[1] + vb[3] };
  } else if (w > 0 && h > 0) {
    frame = { minX: 0, minY: 0, maxX: w, maxY: h };
  }
  const frameW0 = frame.maxX - frame.minX;
  const frameH0 = frame.maxY - frame.minY;
  const contentW = content.maxX - content.minX;
  const contentH = content.maxY - content.minY;
  if (!ctx.hasImage && contentW > 0 && contentH > 0 && (contentW * contentH) / (frameW0 * frameH0) < 0.2) {
    const padX = contentW * 0.03;
    const padY = contentH * 0.03;
    frame = { minX: content.minX - padX, minY: content.minY - padY, maxX: content.maxX + padX, maxY: content.maxY + padY };
  }
  const frameW = frame.maxX - frame.minX;
  const frameH = frame.maxY - frame.minY;
  if (!(frameW > 0 && frameH > 0)) return failed('Dimensions du plan indéterminées.');

  const diag = Math.hypot(frameW, frameH);
  const frameArea = frameW * frameH;
  const closeTol = diag * 1e-4;
  const simplifyEps = diag * 0.0015;

  // --- Formes fermées exploitables -----------------------------------------
  const closedShapes: Shape[] = [];
  for (const s of ctx.shapes) {
    let pts = s.points;
    let isClosed = !s.open;
    if (!isClosed && pts.length >= 4) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= closeTol) {
        pts = pts.slice(0, -1);
        isClosed = true;
      }
    }
    if (!isClosed || pts.length < 3) continue;
    if (s.curved) pts = simplifyRing(pts, simplifyEps);
    if (pts.length < 3 || pts.length > 120) continue;
    const area = polygonArea(pts);
    if (area < frameArea * 1e-6) continue;
    s.points = pts;
    s.area = area;
    s.centroid = polygonCentroid(pts);
    s.bbox = boundingBox(pts);
    s.sides = orientedBoxSides(pts);
    closedShapes.push(s);
  }
  if (closedShapes.length === 0) return failed('Aucun contour fermé détecté : les lots doivent être des polygones ou des chemins fermés.');
  if (closedShapes.length > 3500) return failed('Trop de contours fermés (plus de 3 500). Simplifiez le plan avant l’import.');

  const medianAll = median(closedShapes.map((s) => s.area));

  // --- Conteneurs (îlots, enceinte) ----------------------------------------
  const containers = new Set<Shape>();
  for (const c of closedShapes) {
    let inside = 0;
    for (const d of closedShapes) {
      if (d === c || d.area >= c.area * 0.9 || d.area < medianAll * 0.25) continue;
      const p = d.centroid;
      if (p.x < c.bbox.minX || p.x > c.bbox.maxX || p.y < c.bbox.minY || p.y > c.bbox.maxY) continue;
      if (pointInPolygon(p, c.points) && ++inside >= 2) break;
    }
    if (inside >= 2) containers.add(c);
  }

  // --- Sélection des lots ----------------------------------------------------
  const base = closedShapes.filter(
    (s) => !containers.has(s) && s.sides.long / Math.max(s.sides.short, 1e-9) <= 15 && s.area <= frameArea * 0.35,
  );

  const namedMap = new Map<Shape, string>();
  const groupBest = new Map<string, Shape>();
  for (const s of base) {
    const own = matchLotName(s.label);
    if (own) {
      namedMap.set(s, own);
      continue;
    }
    // Lot nommé par son groupe : on garde la plus grande forme du groupe.
    const grp = s.groupLabels.length ? matchLotName(s.groupLabels[0]) : null;
    if (grp) {
      const prev = groupBest.get(s.groupKey);
      if (!prev || s.area > prev.area) groupBest.set(s.groupKey, s);
    }
  }
  for (const s of groupBest.values()) namedMap.set(s, matchLotName(s.groupLabels[0]) ?? '');

  const baseMedian = median(base.map((s) => s.area));
  const bySize = base.filter((s) => s.area >= baseMedian / 12 && s.area <= baseMedian * 12);
  // Une couleur de remplissage rare (espace vert, équipement…) distingue une zone spéciale d'un lot.
  const fillCounts = new Map<string, number>();
  for (const s of bySize) fillCounts.set(s.fill, (fillCounts.get(s.fill) ?? 0) + 1);
  const minGroup = Math.max(3, Math.ceil(bySize.length * 0.05));
  const byFill = bySize.filter((s) => (fillCounts.get(s.fill) ?? 0) >= minGroup);
  const heuristic = byFill.length >= Math.max(2, bySize.length * 0.5) ? byFill : bySize;
  const named = base.filter((s) => namedMap.has(s));

  let selected: Shape[];
  switch (options.mode) {
    case 'BY_NAME':
      selected = named;
      break;
    case 'ALL_POLYGONS':
      selected = base;
      break;
    default:
      selected = named.length >= 3 && named.length >= heuristic.length * 0.5 ? named : heuristic;
  }
  if (selected.length === 0) {
    return failed(
      options.mode === 'BY_NAME'
        ? 'Aucun lot nommé (id « lot-12 », « parcelle_5 »…) n’a été trouvé. Essayez la détection automatique.'
        : 'Aucun lot reconnu. Essayez un autre mode de détection.',
    );
  }
  if (ctx.openCount > 0 && selected.length < 3) {
    warnings.push('Certains contours ne sont pas fermés dans le fichier : fermez-les dans votre logiciel de dessin.');
  }

  // --- Textes : numéros, superficies -----------------------------------------
  const consumedTexts = new Set<number>();
  const textsByShape = new Map<Shape, TextItem[]>();
  const sortedBySize = [...selected].sort((a, b) => a.area - b.area);
  for (const t of ctx.texts) {
    for (const s of sortedBySize) {
      const p = t.center;
      if (p.x < s.bbox.minX || p.x > s.bbox.maxX || p.y < s.bbox.minY || p.y > s.bbox.maxY) continue;
      if (pointInPolygon(p, s.points)) {
        const list = textsByShape.get(s) ?? [];
        list.push(t);
        textsByShape.set(s, list);
        break;
      }
    }
  }

  // --- Îlots -------------------------------------------------------------------
  const containerIlot = new Map<Shape, string>();
  const containersBySize = [...containers].sort((a, b) => a.area - b.area);
  for (const c of containersBySize) {
    let ilot = matchIlot(c.label) ?? c.groupLabels.map(matchIlot).find((v): v is string => !!v) ?? null;
    if (!ilot) {
      for (const t of ctx.texts) {
        const ilotText = matchIlot(t.content);
        if (!ilotText) continue;
        if (pointInPolygon(t.center, c.points)) {
          ilot = ilotText;
          break;
        }
      }
    }
    if (ilot) containerIlot.set(c, ilot);
  }

  // --- Construction des lots (coordonnées source) ------------------------------
  const ordered = [...selected].sort((a, b) => {
    const band = Math.max(a.sides.short, b.sides.short, 1e-9);
    const ra = Math.floor(a.centroid.y / band);
    const rb = Math.floor(b.centroid.y / band);
    return ra !== rb ? ra - rb : a.centroid.x - b.centroid.x;
  });

  interface Draft {
    shape: Shape;
    numero: string;
    numeroAuto: boolean;
    ilot: string;
    areaText?: number;
  }
  const drafts: Draft[] = [];
  let auto = 1;
  for (const s of ordered) {
    const texts = textsByShape.get(s) ?? [];
    let numero = namedMap.get(s) ?? '';
    let numeroAuto = false;
    let areaText: number | undefined;
    let numberItem: TextItem | undefined;

    for (const t of texts) {
      const a = parseAreaText(t.content);
      if (a !== null) {
        areaText = a;
        consumedTexts.add(t.elId);
      }
    }
    if (!numero) {
      const candidates = texts
        .filter((t) => parseAreaText(t.content) === null && NUMBER_TEXT_RE.test(t.content))
        .sort(
          (p, q) =>
            Math.hypot(p.center.x - s.centroid.x, p.center.y - s.centroid.y) -
            Math.hypot(q.center.x - s.centroid.x, q.center.y - s.centroid.y),
        );
      numberItem = candidates[0];
      if (numberItem) {
        const m = NUMBER_TEXT_RE.exec(numberItem.content);
        numero = (m?.[1] ?? numberItem.content).toUpperCase();
      }
    } else {
      numberItem = texts.find((t) => NUMBER_TEXT_RE.test(t.content) && parseAreaText(t.content) === null);
    }
    if (numberItem) consumedTexts.add(numberItem.elId);
    if (!numero) {
      numero = String(auto++);
      numeroAuto = true;
    }

    let ilot = '';
    for (const c of containersBySize) {
      const id = containerIlot.get(c);
      if (!id) continue;
      const p = s.centroid;
      if (p.x < c.bbox.minX || p.x > c.bbox.maxX || p.y < c.bbox.minY || p.y > c.bbox.maxY) continue;
      if (pointInPolygon(p, c.points)) {
        ilot = id;
        break;
      }
    }
    if (!ilot) ilot = s.groupLabels.map(matchIlot).find((v): v is string => !!v) ?? '';
    drafts.push({ shape: s, numero, numeroAuto, ilot: ilot || '1', areaText });
  }

  // Doublons de numéro dans un même îlot.
  const seen = new Map<string, number>();
  const duplicateWarn = new Set<Draft>();
  for (const d of drafts) {
    const key = `${d.ilot}|${d.numero}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) {
      d.numero = `${d.numero}-${count}`;
      duplicateWarn.add(d);
    }
  }
  if (duplicateWarn.size) warnings.push(`${duplicateWarn.size} numéro(s) en double ont été suffixés (ex. « 12-2 »). Vérifiez-les.`);

  // --- Ajustement au canevas ---------------------------------------------------
  const margin = options.margin ?? 24;
  const scale = Math.min((options.canvasWidth - 2 * margin) / frameW, (options.canvasHeight - 2 * margin) / frameH);
  const fit: FitTransform = {
    scale,
    tx: (options.canvasWidth - frameW * scale) / 2 - frame.minX * scale,
    ty: (options.canvasHeight - frameH * scale) / 2 - frame.minY * scale,
  };
  const toCanvas = (p: Pt): Pt => ({
    x: Math.min(options.canvasWidth, Math.max(0, p.x * fit.scale + fit.tx)),
    y: Math.min(options.canvasHeight, Math.max(0, p.y * fit.scale + fit.ty)),
  });

  const lots: DetectedLot[] = drafts.map((d, index) => {
    const points = d.shape.points.map(toCanvas);
    return {
      key: `lot-${index}`,
      numero: d.numero,
      numeroAuto: d.numeroAuto,
      numeroIlot: d.ilot,
      points,
      areaPx2: polygonArea(points),
      shortPx: d.shape.sides.short * fit.scale,
      longPx: d.shape.sides.long * fit.scale,
      superficieTexteM2: d.areaText,
      source: namedMap.has(d.shape) ? 'NOM' : 'FORME',
      warning: duplicateWarn.has(d) ? 'Numéro en double' : undefined,
    };
  });

  const autoCount = lots.filter((l) => l.numeroAuto).length;
  if (autoCount > 0) {
    warnings.push(
      autoCount === lots.length
        ? 'Aucun numéro de lot trouvé dans le fichier : les lots sont numérotés dans l’ordre de lecture (1, 2, 3…).'
        : `${autoCount} lot(s) sans numéro dans le fichier ont reçu un numéro automatique.`,
    );
  }

  const shapeIdsByLot = new Map<string, number>();
  drafts.forEach((d, i) => shapeIdsByLot.set(`lot-${i}`, d.shape.elId));
  // Nombre de sous-chemins fermés exploitables par élément (chemins composés).
  const closedPerElement = new Map<number, number>();
  for (const s of closedShapes) closedPerElement.set(s.elId, (closedPerElement.get(s.elId) ?? 0) + 1);

  const textIdsByLot = new Map<string, number[]>();
  // Les textes consommés sont retirés du fond uniquement si leur lot est inclus.
  drafts.forEach((d, i) => {
    const ids = (textsByShape.get(d.shape) ?? []).filter((t) => consumedTexts.has(t.elId)).map((t) => t.elId);
    textIdsByLot.set(`lot-${i}`, ids);
  });

  const buildBackground = (includedKeys: ReadonlySet<string>): BackgroundResult => {
    const clone = root.cloneNode(true) as Element;
    const byId = new Map<string, Element>();
    clone.querySelectorAll('[data-pm]').forEach((el) => byId.set(el.getAttribute('data-pm') ?? '', el));

    const removedSubs = new Map<number, number>();
    for (const key of includedKeys) {
      const elId = shapeIdsByLot.get(key);
      if (elId === undefined) continue;
      removedSubs.set(elId, (removedSubs.get(elId) ?? 0) + 1);
      for (const tid of textIdsByLot.get(key) ?? []) byId.get(String(tid))?.remove();
    }
    let leftovers = 0;
    for (const [elId, removed] of removedSubs) {
      if (removed >= (closedPerElement.get(elId) ?? 1)) byId.get(String(elId))?.remove();
      else leftovers++;
    }

    clone.querySelectorAll('[data-pm]').forEach((el) => el.removeAttribute('data-pm'));
    clone.querySelectorAll('[data-label]').forEach((el) => el.removeAttribute('data-label'));
    prefixIds(clone, 'bg-');

    const doc = clone.ownerDocument;
    const group = doc.createElementNS(SVG_NS, 'g');
    group.setAttribute('transform', `matrix(${fit.scale} 0 0 ${fit.scale} ${fit.tx} ${fit.ty})`);
    for (const attr of INHERITED_ROOT_ATTRS) {
      const v = clone.getAttribute(attr);
      if (v) group.setAttribute(attr, v);
    }
    while (clone.firstChild) group.appendChild(clone.firstChild);

    const markup = new XMLSerializer()
      .serializeToString(group)
      .replace(/\sxmlns(?::\w+)?="[^"]*"/g, '');
    return { markup, sizeBytes: markup.length, leftovers };
  };

  if (options.mode === 'AUTO' && named.length === 0 && heuristic.length > 400) {
    warnings.push('Beaucoup de formes sont reconnues comme lots : vérifiez la liste avant de valider.');
  }

  return {
    ok: true,
    buildBackground,
    analysis: {
      lots,
      fit,
      warnings,
      stats: {
        shapes: ctx.shapes.length,
        closedShapes: closedShapes.length,
        texts: ctx.texts.length,
        containers: containers.size,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Échelle réelle (mètres)
// ---------------------------------------------------------------------------

export type Calibration =
  | { kind: 'UNIT_METERS'; metersPerUnit: number }
  | { kind: 'TYPICAL_LOT'; areaM2: number }
  | { kind: 'TEXT_AREAS' }
  | { kind: 'PLAN_WIDTH'; meters: number };

export interface ScaleResult {
  /** Pixels du canevas par mètre réel. */
  pixelsPerMeter: number;
  medianLotAreaM2: number;
  warning?: string;
}

export function resolveScale(analysis: SvgPlanAnalysis, lots: DetectedLot[], calibration: Calibration): ScaleResult | null {
  if (!lots.length) return null;
  let ppm = 0;
  switch (calibration.kind) {
    case 'UNIT_METERS':
      if (calibration.metersPerUnit > 0) ppm = analysis.fit.scale / calibration.metersPerUnit;
      break;
    case 'TYPICAL_LOT':
      if (calibration.areaM2 > 0) ppm = Math.sqrt(median(lots.map((l) => l.areaPx2)) / calibration.areaM2);
      break;
    case 'TEXT_AREAS': {
      const ratios = lots.filter((l) => l.superficieTexteM2).map((l) => Math.sqrt(l.areaPx2 / (l.superficieTexteM2 as number)));
      if (ratios.length) ppm = median(ratios);
      break;
    }
    case 'PLAN_WIDTH': {
      const box = boundingBox(lots.flatMap((l) => l.points));
      if (calibration.meters > 0) ppm = (box.maxX - box.minX) / calibration.meters;
      break;
    }
  }
  if (!(ppm > 0) || !Number.isFinite(ppm)) return null;
  const medianLotAreaM2 = median(lots.map((l) => l.areaPx2)) / (ppm * ppm);
  let warning: string | undefined;
  if (medianLotAreaM2 < 40 || medianLotAreaM2 > 5000) {
    warning = `Un lot médian de ${Math.round(medianLotAreaM2).toLocaleString('fr-FR')} m² paraît peu plausible : vérifiez l’échelle.`;
  }
  return { pixelsPerMeter: ppm, medianLotAreaM2, warning };
}
