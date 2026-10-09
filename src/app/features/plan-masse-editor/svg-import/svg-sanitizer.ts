/**
 * Nettoyage défensif d'un SVG téléversé par une société.
 *
 * Un SVG est un document actif (scripts, handlers, ressources externes, foreignObject…).
 * Le contenu importé sera ré-affiché dans le Studio, enregistré en base puis relu par
 * d'autres clients : on applique donc une liste blanche stricte AVANT toute utilisation.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Éléments conservés tels quels. */
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line',
  'text', 'tspan', 'lineargradient', 'radialgradient', 'stop', 'pattern', 'clippath',
  'mask', 'use', 'symbol', 'style', 'image', 'marker',
]);

/** Éléments supprimés avec tout leur contenu. */
const DROPPED_TAGS = new Set([
  'script', 'foreignobject', 'iframe', 'object', 'embed', 'animate', 'animatetransform',
  'animatemotion', 'animatecolor', 'set', 'metadata', 'title', 'desc', 'filter', 'switch',
  'audio', 'video', 'canvas', 'link', 'cursor', 'font', 'font-face',
]);

const SAFE_IMAGE_HREF = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

export interface SanitizeResult {
  root: Element | null;
  error?: string;
  warnings: string[];
}

export function sanitizeSvgText(raw: string): SanitizeResult {
  const warnings: string[] = [];
  let text = raw.replace(/^\uFEFF/, '').trim();

  if (!text) return { root: null, error: 'Le fichier est vide.', warnings };
  if (/<!ENTITY/i.test(text)) {
    return { root: null, error: 'Fichier refusé : il contient des entités XML (<!ENTITY>).', warnings };
  }
  // DOCTYPE inutile et potentiellement dangereux.
  text = text.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Tolérance : beaucoup d'exports omettent les déclarations de namespace.
  if (!/<svg[^>]*\sxmlns\s*=/.test(text)) {
    text = text.replace(/<svg\b/, `<svg xmlns="${SVG_NS}"`);
  }
  if (/xlink:/.test(text) && !/xmlns:xlink\s*=/.test(text)) {
    text = text.replace(/<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch {
    return { root: null, error: 'Le fichier n’est pas un SVG lisible.', warnings };
  }
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { root: null, error: 'Le fichier n’est pas un SVG valide (XML mal formé).', warnings };
  }
  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg') {
    return { root: null, error: 'Le fichier ne contient pas d’élément <svg>.', warnings };
  }

  normalizeLabels(root);
  const removed = { tags: new Set<string>(), attrs: 0 };
  sanitizeNode(root, removed);
  if (removed.tags.size) {
    warnings.push(`Éléments non pris en charge ignorés : ${[...removed.tags].sort().join(', ')}.`);
  }
  inlineStylesheets(root);
  return { root, warnings };
}

/** Réinjecte les libellés d'éditeur (Inkscape, <title>) dans data-label avant nettoyage. */
function normalizeLabels(root: Element): void {
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of all) {
    let label: string | null = null;
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.endsWith(':label') || attr.name === 'inkscape:label') label = attr.value;
    }
    if (!label) {
      const title = Array.from(el.children).find((c) => c.localName.toLowerCase() === 'title');
      if (title?.textContent) label = title.textContent;
    }
    if (label) el.setAttribute('data-label', label.trim().slice(0, 120));
  }
}

function sanitizeNode(node: Element, removed: { tags: Set<string>; attrs: number }): void {
  for (const child of Array.from(node.children)) {
    const tag = child.localName.toLowerCase();
    if (DROPPED_TAGS.has(tag) || child.namespaceURI?.includes('sodipodi')) {
      child.remove();
      if (tag !== 'title' && tag !== 'desc' && tag !== 'metadata') removed.tags.add(tag);
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      // Élément inconnu (a, namedview…) : on conserve ses enfants graphiques.
      removed.tags.add(tag);
      const kids = Array.from(child.childNodes);
      for (const kid of kids) node.insertBefore(kid, child);
      child.remove();
      // Les enfants déplacés ne figurent pas dans l'instantané parcouru : on re-nettoie ce niveau.
      sanitizeNode(node, removed);
      return;
    }
    sanitizeAttributes(child, tag, removed);
    if (tag === 'style') {
      child.textContent = sanitizeCss(child.textContent ?? '');
    }
    sanitizeNode(child, removed);
  }
  sanitizeAttributes(node, node.localName.toLowerCase(), removed);
}

function sanitizeAttributes(el: Element, tag: string, removed: { attrs: number }): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    const lower = name.toLowerCase();
    const value = attr.value;

    const isXlinkHref = lower === 'xlink:href';
    if (lower === 'href' || isXlinkHref) {
      const ok =
        (tag === 'image' && SAFE_IMAGE_HREF.test(value)) ||
        (tag !== 'image' && value.startsWith('#'));
      el.removeAttribute(name);
      if (ok) el.setAttribute('href', value);
      else removed.attrs++;
      continue;
    }

    if (lower.startsWith('on')) {
      el.removeAttribute(name);
      removed.attrs++;
      continue;
    }
    // Attributs à namespace (inkscape:, sodipodi:, xml:…) : inutiles pour le rendu.
    if (name.includes(':') && lower !== 'xml:space') {
      el.removeAttribute(name);
      continue;
    }
    if (lower === 'style') {
      const cleaned = sanitizeCss(value);
      if (cleaned) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
      continue;
    }
    if (lower === 'filter' || lower === 'src' || lower === 'cursor') {
      el.removeAttribute(name);
      continue;
    }
    if (/javascript:|expression\(|^\s*data:text/i.test(value)) {
      el.removeAttribute(name);
      removed.attrs++;
      continue;
    }
    if (/url\(/i.test(value)) {
      const cleaned = sanitizeCss(value);
      if (cleaned) el.setAttribute(name, cleaned);
      else el.removeAttribute(name);
    }
  }
}

/** Retire @import, expression(), javascript: et tout url() hors références internes (#id). */
export function sanitizeCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/-moz-binding[^;]*;?/gi, '')
    .replace(/behavior\s*:[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (full, _q: string, target: string) =>
      target.trim().startsWith('#') ? full : 'none',
    );
}

// ---------------------------------------------------------------------------
// Feuilles de style → attributs inline (le fond sera ré-affiché hors du fichier d'origine)
// ---------------------------------------------------------------------------

export function inlineStylesheets(root: Element): void {
  const styles = Array.from(root.querySelectorAll('style'));
  for (const styleEl of styles) {
    const css = (styleEl.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = ruleRe.exec(css)) !== null) {
      const selectors = match[1].trim();
      if (selectors.startsWith('@')) continue;
      const declarations = match[2]
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean);
      for (const selector of selectors.split(',').map((s) => s.trim()).filter(Boolean)) {
        let targets: Element[] = [];
        try {
          targets = Array.from(root.querySelectorAll(selector));
        } catch {
          continue; // sélecteur non supporté : on l'ignore
        }
        for (const target of targets) mergeDeclarations(target, declarations);
      }
    }
    styleEl.remove();
  }
}

/** Les déclarations déjà présentes dans l'attribut style de l'élément l'emportent sur la feuille. */
function mergeDeclarations(el: Element, declarations: string[]): void {
  const existing = new Map<string, string>();
  for (const part of (el.getAttribute('style') ?? '').split(';')) {
    const idx = part.indexOf(':');
    if (idx > 0) existing.set(part.slice(0, idx).trim().toLowerCase(), part.slice(idx + 1).trim());
  }
  const merged = new Map<string, string>();
  for (const decl of declarations) {
    const idx = decl.indexOf(':');
    if (idx > 0) merged.set(decl.slice(0, idx).trim().toLowerCase(), decl.slice(idx + 1).trim());
  }
  for (const [k, v] of existing) merged.set(k, v);
  el.setAttribute('style', [...merged].map(([k, v]) => `${k}:${v}`).join(';'));
}

// ---------------------------------------------------------------------------
// Isolation des identifiants (évite les collisions avec le Studio : #grid, #softShadow…)
// ---------------------------------------------------------------------------

export function prefixIds(root: Element, prefix: string): void {
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  const ids = new Set<string>();
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id) ids.add(id);
  }
  if (!ids.size) return;

  const rewrite = (value: string): string =>
    value.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g, (full, q: string, id: string) =>
      ids.has(id) ? `url(${q}#${prefix}${id}${q})` : full,
    );

  for (const el of all) {
    const id = el.getAttribute('id');
    if (id) el.setAttribute('id', prefix + id);
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'id') continue;
      if (attr.name === 'href' && attr.value.startsWith('#')) {
        const target = attr.value.slice(1);
        if (ids.has(target)) el.setAttribute('href', `#${prefix}${target}`);
      } else if (/url\(/i.test(attr.value)) {
        el.setAttribute(attr.name, rewrite(attr.value));
      }
    }
  }
}
