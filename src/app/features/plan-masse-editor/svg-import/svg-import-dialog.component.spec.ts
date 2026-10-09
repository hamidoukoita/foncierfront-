import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SvgImportDialogComponent, SvgImportResult } from './svg-import-dialog.component';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
  ${[1, 2, 3, 4].map((n) => `<rect id="lot-${n}" x="${10 + (n - 1) * 70}" y="20" width="60" height="100"/><text x="${40 + (n - 1) * 70}" y="70" text-anchor="middle">${n}</text>`).join('')}
  <path id="route" d="M0 150H300" stroke="#444" stroke-width="10"/>
</svg>`;

describe('SvgImportDialogComponent', () => {
  let http: HttpTestingController;

  function setup(existing: Array<{ id: number; numeroLot: string }> = []) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SvgImportDialogComponent);
    fixture.componentRef.setInput('programmeId', 7);
    fixture.componentRef.setInput('existingLots', existing);
    fixture.detectChanges();
    return fixture;
  }

  async function load(fixture: ReturnType<typeof setup>) {
    const file = new File([SVG], 'plan_masse.svg', { type: 'image/svg+xml' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    fixture.componentInstance.onFileInput({ target: input } as unknown as Event);
    await new Promise((r) => setTimeout(r, 20));
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('analyse le fichier et rend l’aperçu (fond sans lots, 4 lots détectés)', async () => {
    const fixture = setup();
    await load(fixture);
    const c = fixture.componentInstance;
    expect(c.allLots()).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('polygon').length).toBe(4);
    expect(fixture.nativeElement.querySelector('g[style*="pointer-events"]').innerHTML).toContain('bg-route');
    expect(c.canConfirm()).toBe(false); // prix au m² requis pour créer
  });

  it('crée les lots avec géométrie, superficie et prix calculés', async () => {
    const fixture = setup();
    await load(fixture);
    const c = fixture.componentInstance;
    c.setCalibKind('TYPICAL_LOT');
    c.calibValue.set(300);
    c.prixM2.set(10000);
    expect(c.canConfirm()).toBe(true);

    let result: SvgImportResult | undefined;
    c.imported.subscribe((r) => (result = r));
    c.confirm();
    const reqs = http.match((r) => r.method === 'POST' && r.url.endsWith('/lots-programmes'));
    expect(reqs.length).toBeGreaterThan(0);
    const body = reqs[0].request.body;
    expect(body.programmeId).toBe(7);
    expect(body.superficie).toBe(300);
    expect(body.prix).toBe(3_000_000);
    expect(JSON.parse(body.geometryJson).points).toHaveLength(4);
    // Concurrence bornée : 5 max en vol, ici 4 lots → tous partis ; on répond pour finir.
    reqs.forEach((r) => r.flush({ success: true, message: '', data: { id: 1 } }));
    await new Promise((r) => setTimeout(r, 20));
    expect(result?.created).toBe(4);
    expect(result?.failed).toBe(0);
    expect(result?.backgroundMarkup).toContain('<g');
  });

  it('ne met à jour que la forme d’un lot existant (même numéro)', async () => {
    const fixture = setup([{ id: 42, numeroLot: 'Lot N° 2' }]);
    await load(fixture);
    const c = fixture.componentInstance;
    c.setCalibKind('TYPICAL_LOT');
    c.prixM2.set(5000);
    expect(c.toUpdate()).toBe(1);
    expect(c.toCreate()).toBe(3);
    c.confirm();
    const patch = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/lots-programmes/42/geometry'));
    expect(JSON.parse(patch.request.body.geometryJson).type).toBe('POLYGON');
    http.match(() => true).forEach((r) => r.flush({ success: true, message: '', data: { id: 1 } }));
  });

  it('rapporte les échecs sans interrompre le lot', async () => {
    const fixture = setup();
    await load(fixture);
    const c = fixture.componentInstance;
    c.setCalibKind('TYPICAL_LOT');
    c.prixM2.set(5000);
    let result: SvgImportResult | undefined;
    c.imported.subscribe((r) => (result = r));
    c.confirm();
    const reqs = http.match(() => true);
    reqs[0].flush({ message: 'doublon' }, { status: 409, statusText: 'Conflict' });
    reqs.slice(1).forEach((r) => r.flush({ success: true, message: '', data: { id: 9 } }));
    await new Promise((r) => setTimeout(r, 20));
    expect(result?.created).toBe(3);
    expect(result?.failed).toBe(1);
    expect(result?.firstError).toMatch(/existe déjà/);
  });

  it('refuse un fichier qui n’est pas un SVG', async () => {
    const fixture = setup();
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'plan.pdf', { type: 'application/pdf' })] });
    fixture.componentInstance.onFileInput({ target: input } as unknown as Event);
    await new Promise((r) => setTimeout(r, 10));
    expect(fixture.componentInstance.error()).toMatch(/SVG/);
  });
});
