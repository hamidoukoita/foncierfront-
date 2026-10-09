import { describe, it, expect } from 'vitest';
import { flattenPath, parseTransform, applyMatrix, simplifyRing, orientedBoxSides } from './svg-geometry';
import { matchIlot, matchLotName, parseAreaText, parseSvgPlan, resolveScale } from './svg-plan-parser';
import { sanitizeSvgText } from './svg-sanitizer';

const OPTS = { mode: 'AUTO' as const, canvasWidth: 1200, canvasHeight: 720 };

/** Grille de lots rectangulaires (cols × rows), chacun 40×60, espacés de 5. */
function gridRects(cols: number, rows: number, namer?: (n: number) => string): string {
  let out = '';
  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const attrs = namer ? ` id="${namer(n)}"` : '';
      out += `<rect${attrs} x="${20 + c * 45}" y="${20 + r * 65}" width="40" height="60" fill="none" stroke="#000"/>`;
      n++;
    }
  }
  return out;
}

describe('svg-geometry', () => {
  it('parse les transformations imbriquées', () => {
    const m = parseTransform('translate(10 20) scale(2)');
    expect(applyMatrix(m, { x: 1, y: 1 })).toEqual({ x: 12, y: 22 });
    const r = parseTransform('rotate(90)');
    const p = applyMatrix(r, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  it('garde les angles exacts des chemins droits (M L H V Z, relatif)', () => {
    const [sp] = flattenPath('M10 10 h40 v60 H10 z');
    expect(sp.closed).toBe(true);
    expect(sp.curved).toBe(false);
    expect(sp.points).toEqual([
      { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 70 }, { x: 10, y: 70 },
    ]);
  });

  it('sépare les sous-chemins d’un chemin composé', () => {
    const subs = flattenPath('M0 0h10v10h-10z M20 0h10v10h-10z');
    expect(subs).toHaveLength(2);
    expect(subs.every((s) => s.closed)).toBe(true);
  });

  it('aplatit les arcs et les courbes puis simplifie sans perdre les coins', () => {
    const [sp] = flattenPath('M0 0 L100 0 L100 50 Q50 80 0 50 Z');
    expect(sp.curved).toBe(true);
    const simple = simplifyRing(sp.points, 0.5);
    expect(simple.length).toBeLessThan(sp.points.length);
    expect(simple).toContainEqual({ x: 100, y: 0 });
  });

  it('gère les drapeaux d’arc collés (« a1 1 0 011 1 »)', () => {
    const [sp] = flattenPath('M0 0 a10 10 0 011 20 z');
    expect(sp.points.length).toBeGreaterThan(3);
  });

  it('rectangle orienté : côtés court/long indépendants de la rotation', () => {
    const rot = parseTransform('rotate(30)');
    const pts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 60 }, { x: 0, y: 60 }].map((p) => applyMatrix(rot, p));
    const { short, long } = orientedBoxSides(pts);
    expect(short).toBeCloseTo(40, 3);
    expect(long).toBeCloseTo(60, 3);
  });
});

describe('reconnaissance de libellés', () => {
  it('reconnaît les noms de lots courants', () => {
    expect(matchLotName('lot-12')).toBe('12');
    expect(matchLotName('Lot_007')).toBe('7');
    expect(matchLotName('PARCELLE 5')).toBe('5');
    expect(matchLotName('L14')).toBe('14');
    expect(matchLotName('lot12_copy')).toBe('12');
    expect(matchLotName('path1234')).toBeNull();
    expect(matchLotName('rect845')).toBeNull();
  });
  it('reconnaît les îlots (accents compris)', () => {
    expect(matchIlot('Îlot 3')).toBe('3');
    expect(matchIlot('bloc-A')).toBe('A');
    expect(matchIlot('lot-3')).toBeNull();
  });
  it('lit les superficies écrites en texte', () => {
    expect(parseAreaText('450 m²')).toBe(450);
    expect(parseAreaText('1 200 m2')).toBe(1200);
    expect(parseAreaText('312,5 m²')).toBe(312.5);
    expect(parseAreaText('1.200 m²')).toBe(1200);
    expect(parseAreaText('12')).toBeNull();
  });
});

describe('sécurité du SVG importé', () => {
  it('supprime scripts, handlers, foreignObject et ressources externes', () => {
    const evil = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
      <script>alert(2)</script>
      <foreignObject><div>x</div></foreignObject>
      <image href="https://evil.example/x.png"/>
      <a href="javascript:alert(3)"><rect id="r" width="5" height="5" onclick="alert(4)" style="fill:url(http://evil/x)"/></a>
      <use href="http://evil/#x"/>
    </svg>`;
    const res = sanitizeSvgText(evil);
    expect(res.root).not.toBeNull();
    const html = new XMLSerializer().serializeToString(res.root as Element);
    expect(html).not.toMatch(/script|foreignObject|onload|onclick|javascript:|evil/i);
    expect(html).toContain('<rect');
  });

  it('refuse les entités XML', () => {
    const res = sanitizeSvgText('<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(res.root).toBeNull();
  });

  it('refuse un fichier qui n’est pas un SVG', () => {
    expect(sanitizeSvgText('<html><body/></html>').root).toBeNull();
    expect(sanitizeSvgText('pas du xml').root).toBeNull();
  });

  it('ne laisse pas passer un script déplacé hors d’un élément inconnu', () => {
    const res = sanitizeSvgText('<svg xmlns="http://www.w3.org/2000/svg"><a><script>alert(1)</script><rect width="1" height="1"/></a></svg>');
    const html = new XMLSerializer().serializeToString(res.root as Element);
    expect(html).not.toMatch(/script/i);
    expect(html).toContain('<rect');
  });
});

describe('détection des lots', () => {
  it('détecte des lots nommés (id lot-N) et ignore routes / décors', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      ${gridRects(3, 2, (n) => `lot-${n}`)}
      <path id="route-principale" d="M0 150 H300" stroke="#444" stroke-width="8"/>
      <circle cx="250" cy="250" r="5"/>
    </svg>`;
    const res = parseSvgPlan(svg, OPTS);
    expect(res.ok).toBe(true);
    const lots = res.analysis!.lots;
    expect(lots).toHaveLength(6);
    expect(lots.map((l) => l.numero).sort()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(lots.every((l) => l.source === 'NOM' && !l.numeroAuto)).toBe(true);
  });

  it('lit les numéros et superficies dans les textes, et les îlots dans les conteneurs', () => {
    const block = (ox: number, label: string, first: number) => `
      <g id="${label}">
        <rect id="cadre-${label}" x="${ox}" y="0" width="200" height="140" fill="none"/>
        ${[0, 1, 2].map((i) => `
          <rect x="${ox + 5 + i * 63}" y="10" width="60" height="120" fill="#eee"/>
          <text x="${ox + 35 + i * 63}" y="60" text-anchor="middle">${first + i}</text>
          <text x="${ox + 35 + i * 63}" y="80" text-anchor="middle">${300 + i * 10} m²</text>`).join('')}
      </g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 160">
      ${block(0, 'ilot-1', 1)}${block(250, 'ilot-2', 4)}
    </svg>`;
    const res = parseSvgPlan(svg, OPTS);
    expect(res.ok).toBe(true);
    const lots = res.analysis!.lots;
    expect(lots).toHaveLength(6);
    expect(res.analysis!.stats.containers).toBe(2);
    const l5 = lots.find((l) => l.numero === '5')!;
    expect(l5.numeroIlot).toBe('2');
    expect(l5.superficieTexteM2).toBe(310);
    expect(lots.every((l) => !l.numeroAuto)).toBe(true);
  });

  it('numérote automatiquement quand le fichier ne contient aucun numéro', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">${gridRects(3, 2)}</svg>`;
    const res = parseSvgPlan(svg, OPTS);
    expect(res.ok).toBe(true);
    const lots = res.analysis!.lots;
    expect(lots).toHaveLength(6);
    expect(lots.every((l) => l.numeroAuto)).toBe(true);
    expect(lots.map((l) => l.numero)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(res.analysis!.warnings.join(' ')).toMatch(/numérotés dans l’ordre/);
  });

  it('découpe un chemin composé en plusieurs lots', () => {
    const d = [0, 1, 2, 3].map((i) => `M${10 + i * 50} 10h40v60h-40z`).join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 100"><path d="${d}"/></svg>`;
    const res = parseSvgPlan(svg, OPTS);
    expect(res.ok).toBe(true);
    expect(res.analysis!.lots).toHaveLength(4);
    const bg = res.buildBackground(new Set(res.analysis!.lots.map((l) => l.key)));
    expect(bg.markup).not.toContain('<path'); // tout le tracé composé est retiré
  });

  it('applique les transformations de groupe et ramène tout dans le canevas', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <g transform="translate(500 500) scale(0.5)">${gridRects(3, 2, (n) => `lot-${n}`)}</g>
    </svg>`;
    const res = parseSvgPlan(svg, OPTS);
    expect(res.ok).toBe(true);
    for (const lot of res.analysis!.lots) {
      for (const p of lot.points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1200);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(720);
      }
    }
  });

  it('prend en compte le style défini par classes CSS dans le fond', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <style>.route{fill:none;stroke:#334155;stroke-width:8}</style>
      ${gridRects(3, 2, (n) => `lot-${n}`)}
      <path class="route" d="M0 150 H300"/>
    </svg>`;
    const res = parseSvgPlan(svg, OPTS);
    const bg = res.buildBackground(new Set(res.analysis!.lots.map((l) => l.key)));
    expect(bg.markup).toContain('stroke:#334155');
    expect(bg.markup).not.toContain('<style');
  });

  it('retire les lots (et leurs textes) du fond mais garde le reste', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      ${gridRects(3, 2, (n) => `lot-${n}`)}
      <path id="route" d="M0 150 H300" stroke="#444"/>
      <text x="10" y="290">Rue des Cocotiers</text>
    </svg>`;
    const res = parseSvgPlan(svg, OPTS);
    const keys = res.analysis!.lots.map((l) => l.key);
    const withAll = res.buildBackground(new Set(keys));
    expect(withAll.markup).not.toContain('<rect');
    expect(withAll.markup).toContain('bg-route');
    expect(withAll.markup).toContain('Rue des Cocotiers');
    const withNone = res.buildBackground(new Set());
    expect((withNone.markup.match(/<rect/g) ?? []).length).toBe(6);
  });

  it('refuse un SVG sans contour fermé', () => {
    const res = parseSvgPlan('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L10 10"/></svg>', OPTS);
    expect(res.ok).toBe(false);
  });

  it('le mode « par nom » n’accepte que les lots nommés', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">${gridRects(3, 2)}</svg>`;
    const res = parseSvgPlan(svg, { ...OPTS, mode: 'BY_NAME' });
    expect(res.ok).toBe(false);
  });
});

describe('échelle réelle', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
    ${gridRects(3, 2, (n) => `lot-${n}`)}
  </svg>`;

  it('1 unité = 1 m : un lot de 40×60 vaut 2 400 m²', () => {
    const res = parseSvgPlan(svg, OPTS);
    const a = res.analysis!;
    const scale = resolveScale(a, a.lots, { kind: 'UNIT_METERS', metersPerUnit: 1 })!;
    expect(scale.medianLotAreaM2).toBeCloseTo(2400, 0);
  });

  it('calibrage sur un lot type : retrouve la superficie demandée', () => {
    const res = parseSvgPlan(svg, OPTS);
    const a = res.analysis!;
    const scale = resolveScale(a, a.lots, { kind: 'TYPICAL_LOT', areaM2: 300 })!;
    expect(scale.medianLotAreaM2).toBeCloseTo(300, 0);
    // façade ≈ côté court, profondeur ≈ côté long
    const lot = a.lots[0];
    expect(lot.shortPx / scale.pixelsPerMeter).toBeLessThan(lot.longPx / scale.pixelsPerMeter);
  });

  it('signale une échelle peu plausible', () => {
    const res = parseSvgPlan(svg, OPTS);
    const a = res.analysis!;
    const scale = resolveScale(a, a.lots, { kind: 'UNIT_METERS', metersPerUnit: 0.001 })!;
    expect(scale.warning).toBeTruthy();
  });

  it('retourne null sans donnée exploitable', () => {
    const res = parseSvgPlan(svg, OPTS);
    expect(resolveScale(res.analysis!, res.analysis!.lots, { kind: 'TEXT_AREAS' })).toBeNull();
  });
});

describe('plan réaliste (150 lots, plan pivoté, ids d’éditeur)', () => {
  /** 3 îlots × 50 lots : enceinte, routes en bandes, espace vert, textes en tspan, rotation 12°. */
  function realisticPlan(): string {
    let lots = '';
    let texts = '';
    let id = 1000;
    let n = 1;
    for (let ilot = 0; ilot < 3; ilot++) {
      const oy = 60 + ilot * 330;
      lots += `<rect id="rect${id++}" x="40" y="${oy - 10}" width="1020" height="300" fill="none" stroke="#999"/>`;
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < 25; c++) {
          const x = 50 + c * 40;
          const y = oy + row * 135;
          lots += `<path id="path${id++}" d="M${x} ${y} h36 v120 h-36 z" fill="#f1efe8" stroke="#555"/>`;
          texts += `<text x="${x + 18}" y="${y + 60}" font-size="10" text-anchor="middle"><tspan x="${x + 18}" y="${y + 60}">${n}</tspan></text>`;
          n++;
        }
      }
    }
    const roads = `<polygon id="path${id++}" points="0,330 1100,330 1100,345 0,345" fill="#666"/><polygon id="path${id++}" points="0,660 1100,660 1100,675 0,675" fill="#666"/>`;
    const green = `<path id="path${id++}" d="M1080 100 h80 v200 h-80 z" fill="#9c9"/>`;
    const boundary = `<polygon id="path${id++}" points="5,5 1190,5 1190,990 5,990" fill="none" stroke="#000"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1000"><g transform="rotate(12 600 500)">${boundary}${roads}${green}${lots}${texts}</g></svg>`;
  }

  it('détecte exactement les 150 lots numérotés par leur texte, en moins de 2 s', () => {
    const t0 = performance.now();
    const res = parseSvgPlan(realisticPlan(), OPTS);
    const elapsed = performance.now() - t0;
    expect(res.ok).toBe(true);
    const a = res.analysis!;
    expect(elapsed).toBeLessThan(2000);
    expect(a.lots.length).toBe(150);
    expect(a.lots.every((l) => !l.numeroAuto)).toBe(true);
    expect(new Set(a.lots.map((l) => l.numero)).size).toBe(150);
    expect(a.stats.containers).toBeGreaterThanOrEqual(3);
    const ilots = new Set(a.lots.map((l) => l.numeroIlot));
    expect(ilots.size).toBeGreaterThanOrEqual(1);
  });

  it('les lots restent des quadrilatères exacts malgré la rotation', () => {
    const res = parseSvgPlan(realisticPlan(), OPTS);
    expect(res.analysis!.lots.every((l) => l.points.length === 4)).toBe(true);
  });

  it('le fond conserve routes, espace vert et enceinte mais plus les lots ni leurs numéros', () => {
    const res = parseSvgPlan(realisticPlan(), OPTS);
    const bg = res.buildBackground(new Set(res.analysis!.lots.map((l) => l.key)));
    expect((bg.markup.match(/<text/g) ?? []).length).toBe(0);
    expect((bg.markup.match(/<path/g) ?? []).length).toBe(1); // l'espace vert
    expect((bg.markup.match(/<polygon/g) ?? []).length).toBe(3); // 2 routes + enceinte
    expect(bg.leftovers).toBe(0);
  });
});
