import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { runBounded } from '../../../core/utils/bounded-batch';
import { LotProgrammeRequestBackend } from '../../../core/models/backend.models';
import { StatutLot } from '../../../core/models/societe.models';
import {
  Calibration,
  DetectedLot,
  DetectionMode,
  SvgPlanAnalysis,
  SvgPlanParseResult,
  parseSvgPlan,
  resolveScale,
} from './svg-plan-parser';

export interface ExistingLotRef {
  id: number;
  numeroLot: string;
}

export interface SvgImportResult {
  /** Fond à afficher sous les lots (déjà dans l'espace du canevas). */
  backgroundMarkup: string;
  pixelsPerMeter: number;
  created: number;
  updated: number;
  failed: number;
  firstError?: string;
}

export interface ImportRow {
  lot: DetectedLot;
  superficie: number;
  facade: number;
  profondeur: number;
  prix: number;
  existingId: number | null;
}

type CalibrationKind = Calibration['kind'];

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const BACKGROUND_WARN_BYTES = 1_500_000;

/** Numéro comparable : « Lot N° 012 » → « 12 ». */
function normalizeNumero(value: string): string {
  return value
    .replace(/^lot\s*n?°?\s*/i, '')
    .trim()
    .replace(/^0+(?=\d)/, '')
    .toLowerCase();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

@Component({
  selector: 'app-svg-import-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './svg-import-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvgImportDialogComponent {
  private readonly api = inject(SocieteService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly programmeId = input.required<number>();
  readonly existingLots = input.required<ExistingLotRef[]>();
  readonly canvasWidth = input(1200);
  readonly canvasHeight = input(720);

  readonly closed = output<void>();
  readonly imported = output<SvgImportResult>();

  readonly fileInfo = signal<{ name: string; size: number } | null>(null);
  readonly mode = signal<DetectionMode>('AUTO');
  readonly parseResult = signal<SvgPlanParseResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly included = signal<ReadonlySet<string>>(new Set());
  readonly calibKind = signal<CalibrationKind>('UNIT_METERS');
  readonly calibValue = signal(1);
  readonly prixM2 = signal(0);
  readonly statut = signal<StatutLot>('DISPONIBLE');
  readonly busy = signal(false);
  readonly progress = signal({ done: 0, total: 0 });
  readonly dragOver = signal(false);

  private svgText = '';
  private cancelled = false;

  readonly analysis = computed<SvgPlanAnalysis | null>(() => this.parseResult()?.analysis ?? null);
  readonly allLots = computed(() => this.analysis()?.lots ?? []);
  readonly includedLots = computed(() => this.allLots().filter((l) => this.included().has(l.key)));
  readonly hasTextAreas = computed(() => this.includedLots().some((l) => l.superficieTexteM2));

  readonly calibration = computed<Calibration | null>(() => {
    const v = this.calibValue();
    switch (this.calibKind()) {
      case 'UNIT_METERS':
        return v > 0 ? { kind: 'UNIT_METERS', metersPerUnit: v } : null;
      case 'TYPICAL_LOT':
        return v > 0 ? { kind: 'TYPICAL_LOT', areaM2: v } : null;
      case 'PLAN_WIDTH':
        return v > 0 ? { kind: 'PLAN_WIDTH', meters: v } : null;
      case 'TEXT_AREAS':
        return { kind: 'TEXT_AREAS' };
    }
  });

  readonly scale = computed(() => {
    const a = this.analysis();
    const c = this.calibration();
    if (!a || !c) return null;
    return resolveScale(a, this.includedLots(), c);
  });

  readonly background = computed(() => this.parseResult()?.buildBackground(this.included()) ?? null);
  readonly previewBackground = computed<SafeHtml>(() =>
    // Le balisage provient de notre assainisseur (liste blanche) : il est sûr à injecter.
    this.sanitizer.bypassSecurityTrustHtml(this.background()?.markup ?? ''),
  );

  readonly existingByNumero = computed(() => {
    const map = new Map<string, number>();
    for (const l of this.existingLots()) map.set(normalizeNumero(l.numeroLot), l.id);
    return map;
  });

  readonly rows = computed<ImportRow[]>(() => {
    const scale = this.scale();
    if (!scale) return [];
    const ppm = scale.pixelsPerMeter;
    const prixM2 = this.prixM2();
    return this.includedLots().map((lot) => {
      const superficie = lot.superficieTexteM2 ?? Math.max(1, Math.round(lot.areaPx2 / (ppm * ppm)));
      return {
        lot,
        superficie,
        facade: round1(lot.shortPx / ppm),
        profondeur: round1(lot.longPx / ppm),
        prix: Math.max(1, Math.round((superficie * prixM2) / 1000) * 1000),
        existingId: this.existingByNumero().get(normalizeNumero(lot.numero)) ?? null,
      };
    });
  });

  readonly modes: ReadonlyArray<{ value: DetectionMode; label: string }> = [
    { value: 'AUTO', label: 'Automatique' },
    { value: 'BY_NAME', label: 'Par nom' },
    { value: 'ALL_POLYGONS', label: 'Toutes les formes' },
  ];

  private readonly rowsByKey = computed(() => new Map(this.rows().map((r) => [r.lot.key, r])));

  rowFor(key: string): ImportRow | undefined {
    return this.rowsByKey().get(key);
  }

  onCalibSelect(event: Event): void {
    this.setCalibKind((event.target as HTMLSelectElement).value as CalibrationKind);
  }

  onStatutSelect(event: Event): void {
    this.statut.set((event.target as HTMLSelectElement).value as StatutLot);
  }

  readonly toCreate = computed(() => this.rows().filter((r) => r.existingId === null).length);
  readonly toUpdate = computed(() => this.rows().filter((r) => r.existingId !== null).length);
  readonly backgroundHeavy = computed(() => (this.background()?.sizeBytes ?? 0) > BACKGROUND_WARN_BYTES);

  readonly canConfirm = computed(
    () =>
      !this.busy() &&
      this.rows().length > 0 &&
      this.scale() !== null &&
      // Un prix au m² n'est requis que si des lots doivent être créés (le backend exige un prix > 0).
      (this.toCreate() === 0 || this.prixM2() > 0),
  );

  // --- Fichier ------------------------------------------------------------------

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.loadFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.loadFile(file);
  }

  private async loadFile(file: File): Promise<void> {
    this.error.set(null);
    const looksSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    if (!looksSvg) {
      this.error.set('Choisissez un fichier au format SVG (.svg).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.error.set(`Fichier trop volumineux (${(file.size / 1048576).toFixed(1)} Mo). Maximum : 5 Mo.`);
      return;
    }
    try {
      this.svgText = await file.text();
    } catch {
      this.error.set('Impossible de lire ce fichier.');
      return;
    }
    this.fileInfo.set({ name: file.name, size: file.size });
    this.analyse();
  }

  setMode(mode: DetectionMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    if (this.svgText) this.analyse();
  }

  private analyse(): void {
    const result = parseSvgPlan(this.svgText, {
      mode: this.mode(),
      canvasWidth: this.canvasWidth(),
      canvasHeight: this.canvasHeight(),
    });
    if (!result.ok || !result.analysis) {
      this.parseResult.set(null);
      this.included.set(new Set());
      this.error.set(result.error ?? 'Ce plan n’a pas pu être analysé.');
      return;
    }
    this.error.set(null);
    this.parseResult.set(result);
    this.included.set(new Set(result.analysis.lots.map((l) => l.key)));

    // Échelle : si le plan indique ses superficies (« 450 m² »), on s'en sert pour calibrer seul.
    const withText = result.analysis.lots.filter((l) => l.superficieTexteM2).length;
    if (withText >= result.analysis.lots.length * 0.5) {
      this.setCalibKind('TEXT_AREAS');
    } else if (this.calibKind() === 'TEXT_AREAS') {
      this.setCalibKind('UNIT_METERS');
    }
  }

  // --- Sélection ----------------------------------------------------------------

  toggleLot(key: string): void {
    this.included.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  setAll(include: boolean): void {
    this.included.set(include ? new Set(this.allLots().map((l) => l.key)) : new Set());
  }

  // --- Échelle ------------------------------------------------------------------

  setCalibKind(kind: CalibrationKind): void {
    this.calibKind.set(kind);
    const defaults: Record<CalibrationKind, number> = { UNIT_METERS: 1, TYPICAL_LOT: 300, PLAN_WIDTH: 300, TEXT_AREAS: 0 };
    this.calibValue.set(defaults[kind]);
  }

  onNumber(event: Event, target: 'calib' | 'prix'): void {
    const value = Number((event.target as HTMLInputElement).value);
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    if (target === 'calib') this.calibValue.set(safe);
    else this.prixM2.set(safe);
  }

  // --- Aperçu -------------------------------------------------------------------

  pointsAttr(lot: DetectedLot): string {
    return lot.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  center(lot: DetectedLot): { x: number; y: number } {
    const n = lot.points.length;
    return { x: lot.points.reduce((s, p) => s + p.x, 0) / n, y: lot.points.reduce((s, p) => s + p.y, 0) / n };
  }

  labelSize(lot: DetectedLot): number {
    return Math.max(6, Math.min(15, Math.sqrt(lot.areaPx2) * 0.3));
  }

  // --- Enregistrement ----------------------------------------------------------

  confirm(): void {
    const scale = this.scale();
    const bg = this.background();
    if (!this.canConfirm() || !scale || !bg) return;

    const programmeId = this.programmeId();
    const statut = this.statut();
    const rows = this.rows();

    const tasks = rows.map((row) => {
      const geometryJson = JSON.stringify({
        type: 'POLYGON',
        points: row.lot.points.map((p) => ({ x: round1(p.x), y: round1(p.y) })),
      });
      if (row.existingId !== null) {
        const id = row.existingId;
        // Lot déjà connu : seule sa forme est mise à jour (prix, statut et réservations intacts).
        return () => this.api.updateLotProgrammeGeometry(id, geometryJson);
      }
      const request: LotProgrammeRequestBackend = {
        numeroLot: row.lot.numero,
        numeroIlot: row.lot.numeroIlot || '1',
        superficie: row.superficie,
        prix: row.prix,
        facade: row.facade > 0 ? row.facade : undefined,
        profondeur: row.profondeur > 0 ? row.profondeur : undefined,
        statut: statut === 'RESERVE' ? 'RESERVER' : statut === 'VENDU' ? 'VENDUE' : statut === 'INDISPONIBLE_LITIGE' ? 'INDISPONIBLE' : 'DISPONIBLE',
        programmeId,
        geometryJson,
      };
      return () => this.api.createLotProgramme(request);
    });

    this.cancelled = false;
    this.busy.set(true);
    this.progress.set({ done: 0, total: tasks.length });

    runBounded(tasks, 5, (done, total) => this.progress.set({ done, total })).subscribe({
      next: (outcomes) => {
        this.busy.set(false);
        if (this.cancelled) return;
        let created = 0;
        let updated = 0;
        let failed = 0;
        let firstError: string | undefined;
        outcomes.forEach((o, i) => {
          if (o.ok) {
            if (rows[i].existingId === null) created++;
            else updated++;
          } else {
            failed++;
            firstError ??= this.errorMessage(o.error);
          }
        });
        if (created + updated === 0) {
          this.toast.error('Import impossible', firstError ?? 'Aucun lot n’a pu être enregistré.');
          return;
        }
        this.imported.emit({
          backgroundMarkup: bg.markup,
          pixelsPerMeter: scale.pixelsPerMeter,
          created,
          updated,
          failed,
          firstError,
        });
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Import interrompu', 'Une erreur inattendue a interrompu l’enregistrement.');
      },
    });

    this.destroyRef.onDestroy(() => (this.cancelled = true));
  }

  close(): void {
    if (!this.busy()) this.closed.emit();
  }

  private errorMessage(error: unknown): string {
    const e = error as { error?: { message?: string }; message?: string; status?: number } | null;
    if (e?.status === 409) return 'Un lot portant ce numéro existe déjà.';
    return e?.error?.message ?? e?.message ?? 'Erreur inconnue.';
  }
}
