import { MediaCible } from '../../core/models/media.models';
import { MediaManagerComponent } from '../../shared/components/media-manager/media-manager.component';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SocieteService } from '../../core/services/societe.service';
import { SvgImportDialogComponent, SvgImportResult } from './svg-import/svg-import-dialog.component';
import { sanitizeSvgText } from './svg-import/svg-sanitizer';
import { ToastService } from '../../core/services/toast.service';
import { Programme, StatutLot } from '../../core/models/societe.models';
import {
  LotProgrammeBackend,
  LotProgrammeRequestBackend,
  PlanElementTypeBackend,
  PlanMasseBackend,
  PlanMasseRequestBackend,
  PlanMasseElementBackend,
} from '../../core/models/backend.models';

export interface GeometryPoint {
  x: number;
  y: number;
}

interface PolygonGeometry {
  type: 'POLYGON';
  points: GeometryPoint[];
}

interface LineGeometry {
  type: 'LINE';
  points: GeometryPoint[];
}

interface PointGeometry {
  type: 'POINT';
  x: number;
  y: number;
}

type StudioGeometry = PolygonGeometry | LineGeometry | PointGeometry;

export type StudioTool =
  | 'SELECT'
  | 'PLACE_PRESET'
  | 'DRAW_FREE'
  | 'ADD_ROAD'
  | 'ADD_GREEN'
  | 'ADD_POI';

export type LotStatutType = StatutLot;

interface ShapePreset {
  id: string;
  label: string;
  description: string;
  points: GeometryPoint[];
  preview: string;
}

export interface StudioLot {
  id: number;
  numeroLot: string;
  numeroIlot: string;
  numeroIlotLotissement?: string;
  reference: string;
  superficie: number;
  prix: number;
  facade?: number;
  profondeur?: number;
  statut: LotStatutType;
  geometry: GeometryPoint[];
}

export interface StudioElement {
  id: number;
  type: PlanElementTypeBackend;
  nom: string;
  description?: string;
  geometry: StudioGeometry;
  styleJson?: string;
  visible: boolean;
  zIndex: number;
  planMasseId: number;
}

type LotRowDirection = 'HORIZONTAL' | 'VERTICAL';

interface PanState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewBoxX: number;
  startViewBoxY: number;
}

interface DragState {
  kind: 'LOT_VERTEX' | 'LOT_BODY' | 'ELEMENT_VERTEX' | 'ELEMENT_BODY';
  id: number;
  vertexIndex?: number;
  lastPoint: GeometryPoint;
  changed: boolean;
}

interface EditorSnapshot {
  lots: StudioLot[];
  elements: StudioElement[];
}

@Component({
  selector: 'app-plan-masse-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MediaManagerComponent, SvgImportDialogComponent],
  templateUrl: './plan-masse-editor.component.html',
  styleUrl: './plan-masse-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanMasseEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('planCanvas', { static: false }) private planCanvas?: ElementRef<SVGSVGElement>;

  readonly canvasWidth = 1200;
  readonly canvasHeight = 720;

  readonly programme = signal<Programme | null>(null);
  readonly planMasse = signal<PlanMasseBackend | null>(null);
  readonly lots = signal<StudioLot[]>([]);
  readonly elements = signal<StudioElement[]>([]);

  readonly activeTool = signal<StudioTool>('SELECT');
  readonly selectedLot = signal<StudioLot | null>(null);
  readonly selectedElement = signal<StudioElement | null>(null);
  readonly selectedPreset = signal<string | null>(null);
  readonly drawingPoints = signal<GeometryPoint[]>([]);
  readonly elementDraftGeometry = signal<StudioGeometry | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly saveStatus = signal<'idle' | 'saved' | 'error'>('idle');
  readonly lastSavedLabel = signal('');
  readonly isDirty = signal(false);
  readonly snapToGrid = signal(true);
  readonly showGrid = signal(true);
  /** Échelle du plan : 8 px/m par défaut, recalculée à l'import d'un plan SVG. */
  readonly pixelsPerMeter = signal(8);
  /** Pas d'accrochage en pixels : le plus petit pas « rond » (m) lisible à l'échelle courante (20 px à 8 px/m). */
  readonly snapStep = computed(() => {
    const ppm = this.pixelsPerMeter();
    const meters = [0.5, 1, 2.5, 5, 10, 25, 50].find((m) => m * ppm >= 12) ?? 50;
    return meters * ppm;
  });
  readonly scaleBar = computed(() => {
    const ppm = this.pixelsPerMeter();
    const meters = [5, 10, 20, 50, 100, 200, 500].find((m) => m * ppm >= 60) ?? 500;
    return { meters, px: meters * ppm };
  });

  // --- Plan SVG importé (fond) ---
  readonly isImportOpen = signal(false);
  readonly backgroundMarkup = signal('');
  readonly backgroundOpacity = signal(0.9);
  readonly layerBackground = signal(true);
  readonly safeBackground = computed<SafeHtml>(() =>
    // Balisage issu de notre assainisseur à liste blanche (import ou relecture du plan enregistré).
    this.sanitizer.bypassSecurityTrustHtml(this.backgroundMarkup()),
  );
  readonly existingLotRefs = computed(() => this.lots().map((l) => ({ id: l.id, numeroLot: l.numeroLot })));
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  readonly zoom = signal(1);
  readonly viewBoxX = signal(0);
  readonly viewBoxY = signal(0);
  readonly cursorPosition = signal<GeometryPoint>({ x: 0, y: 0 });
  readonly isPanMode = signal(false);
  readonly isRowModalOpen = signal(false);
  readonly isGeneratingRow = signal(false);
  readonly roadMode = signal<'GOUDRONNEE' | 'NON_GOUDRONNEE'>('GOUDRONNEE');
  readonly majorGridX = Array.from({ length: 16 }, (_, index) => index * 80);
  readonly majorGridY = Array.from({ length: 10 }, (_, index) => index * 80);
  readonly isCreateLotModalOpen = signal(false);
  /** Consigne de l'outil actif, affichée dans la barre du plan (remplace les notifications répétées). */
  readonly toolHint = signal<string>('');
  /** Lot dont on ouvre les photos / panoramas 360° / visites virtuelles. */
  readonly mediaCible = signal<MediaCible | null>(null);

  openLotMedias(): void {
    const lot = this.selectedLot();
    if (lot) this.mediaCible.set({ kind: 'bien', id: lot.id, titre: lot.numeroLot });
  }
  readonly isElementModalOpen = signal(false);
  readonly isEditLotModalOpen = signal(false);
  readonly searchQuery = signal('');
  readonly currentTableFilter = signal<'ALL' | 'DISPO' | 'RESERVE' | 'VENDU' | 'A_POSITIONNER'>('ALL');

  readonly layerLots = signal(true);
  readonly layerRoads = signal(true);
  readonly layerGreen = signal(true);
  readonly layerPois = signal(true);

  readonly historyStack = signal<EditorSnapshot[]>([]);
  readonly redoStack = signal<EditorSnapshot[]>([]);
  private dragState: DragState | null = null;
  private panState: PanState | null = null;

  readonly lotForm = this.fb.nonNullable.group({
    numeroLot: ['', [Validators.required, Validators.maxLength(50)]],
    numeroIlot: ['1', [Validators.required, Validators.maxLength(50)]],
    numeroIlotLotissement: ['', [Validators.maxLength(100)]],
    reference: ['', [Validators.maxLength(100)]],
    // 0 = à saisir : aucune superficie ni aucun prix inventé (le backend exige des valeurs > 0).
    superficie: [0, [Validators.required, Validators.min(1)]],
    prix: [0, [Validators.required, Validators.min(1)]],
    facade: [0, [Validators.min(0)]],
    profondeur: [0, [Validators.min(0)]],
    statut: ['DISPONIBLE' as LotStatutType, Validators.required],
  });

  readonly rowForm = this.fb.nonNullable.group({
    count: [4, [Validators.required, Validators.min(2), Validators.max(30)]],
    spacingMeters: [3, [Validators.required, Validators.min(0.5), Validators.max(50)]],
    direction: ['HORIZONTAL' as LotRowDirection, Validators.required],
  });

  readonly elementForm = this.fb.nonNullable.group({
    type: ['ECOLE' as PlanElementTypeBackend, Validators.required],
    nom: ['', [Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(255)]],
  });

  readonly shapePresets: readonly ShapePreset[] = [
    {
      id: 'RECTANGLE',
      label: 'Rectangle',
      description: 'Forme standard',
      points: [
        { x: -100, y: -60 },
        { x: 100, y: -60 },
        { x: 100, y: 60 },
        { x: -100, y: 60 },
      ],
      preview: '20,18 82,18 82,58 20,58',
    },
    {
      id: 'CARRE',
      label: 'Carré',
      description: 'Forme équilibrée',
      points: [
        { x: -70, y: -70 },
        { x: 70, y: -70 },
        { x: 70, y: 70 },
        { x: -70, y: 70 },
      ],
      preview: '28,16 74,16 74,62 28,62',
    },
    {
      id: 'TRAPEZE',
      label: 'Trapèze',
      description: 'Terrain irrégulier léger',
      points: [
        { x: -100, y: -60 },
        { x: 65, y: -60 },
        { x: 100, y: 60 },
        { x: -65, y: 60 },
      ],
      preview: '30,18 70,18 80,60 20,60',
    },
    {
      id: 'L',
      label: 'Forme en L',
      description: 'Emprise angulaire',
      points: [
        { x: -100, y: -70 },
        { x: 20, y: -70 },
        { x: 20, y: -10 },
        { x: 100, y: -10 },
        { x: 100, y: 70 },
        { x: -100, y: 70 },
      ],
      preview: '20,18 56,18 56,32 78,32 78,62 20,62',
    },
    {
      id: 'PENTAGONE',
      label: 'Pentagone',
      description: 'Contour polygonal',
      points: [
        { x: -90, y: -35 },
        { x: 0, y: -75 },
        { x: 90, y: -35 },
        { x: 65, y: 70 },
        { x: -60, y: 70 },
      ],
      preview: '24,40 50,18 76,40 68,64 32,64',
    },
    {
      id: 'HEXAGONE',
      label: 'Hexagone',
      description: 'Contour à 6 sommets',
      points: [
        { x: -85, y: -45 },
        { x: 0, y: -75 },
        { x: 85, y: -45 },
        { x: 85, y: 45 },
        { x: 0, y: 75 },
        { x: -85, y: 45 },
      ],
      preview: '28,20 50,14 72,20 72,60 50,68 28,60',
    },
    {
      id: 'IRREGULIER',
      label: 'Irrégulier',
      description: 'Prêt à être remodelé',
      points: [
        { x: -100, y: -55 },
        { x: -20, y: -78 },
        { x: 85, y: -50 },
        { x: 60, y: 5 },
        { x: 92, y: 72 },
        { x: -30, y: 68 },
        { x: -110, y: 15 },
      ],
      preview: '18,38 40,22 72,30 64,44 76,64 42,62 18,48',
    },
  ];

  readonly totalLots = computed(() => this.lots().length);
  readonly lotsDisponibles = computed(() => this.lots().filter((l) => l.statut === 'DISPONIBLE').length);
  readonly lotsReserves = computed(() => this.lots().filter((l) => l.statut === 'RESERVE').length);
  readonly lotsVendus = computed(() => this.lots().filter((l) => l.statut === 'VENDU').length);
  readonly lotsNonPositionnes = computed(() => this.lots().filter((l) => l.geometry.length < 3).length);
  readonly lotsPositionnes = computed(() => this.lots().filter((l) => l.geometry.length >= 3));
  readonly lotsAPositionner = computed(() => this.lots().filter((l) => l.geometry.length < 3));
  readonly canPlaceShape = computed(() => this.selectedLot() !== null);
  readonly selectedLotPositioned = computed(() => (this.selectedLot()?.geometry.length ?? 0) >= 3);
  readonly positionedLotsCount = computed(() => this.lotsPositionnes().length);
  readonly selectedLotMetrics = computed(() => {
    const lot = this.selectedLot();
    if (!lot || lot.geometry.length < 3) return null;

    const xs = lot.geometry.map((point) => point.x);
    const ys = lot.geometry.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    let areaPx2 = 0;
    let perimeterPx = 0;
    for (let index = 0; index < lot.geometry.length; index++) {
      const current = lot.geometry[index];
      const next = lot.geometry[(index + 1) % lot.geometry.length];
      areaPx2 += current.x * next.y - next.x * current.y;
      perimeterPx += Math.hypot(next.x - current.x, next.y - current.y);
    }

    return {
      centerX: ((minX + maxX) / 2) / this.pixelsPerMeter(),
      centerY: ((minY + maxY) / 2) / this.pixelsPerMeter(),
      width: (maxX - minX) / this.pixelsPerMeter(),
      height: (maxY - minY) / this.pixelsPerMeter(),
      area: Math.abs(areaPx2) / 2 / (this.pixelsPerMeter() * this.pixelsPerMeter()),
      perimeter: perimeterPx / this.pixelsPerMeter(),
    };
  });

  viewBoxAttribute(): string {
    return `${this.viewBoxX()} ${this.viewBoxY()} ${this.getViewBoxWidth()} ${this.getViewBoxHeight()}`;
  }

  getViewBoxWidth(): number {
    return this.canvasWidth / this.zoom();
  }

  getViewBoxHeight(): number {
    return this.canvasHeight / this.zoom();
  }


  readonly filteredLots = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.currentTableFilter();
    return this.lots().filter((lot) => {
      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'DISPO' && lot.statut === 'DISPONIBLE') ||
        (filter === 'RESERVE' && lot.statut === 'RESERVE') ||
        (filter === 'VENDU' && lot.statut === 'VENDU') ||
        (filter === 'A_POSITIONNER' && lot.geometry.length < 3);
      const matchesQuery =
        !query ||
        lot.numeroLot.toLowerCase().includes(query) ||
        lot.reference.toLowerCase().includes(query) ||
        lot.numeroIlot.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
  });

  readonly visibleRoadElements = computed(() =>
    this.elements().filter(
      (e) =>
        this.layerRoads() &&
        (e.type === 'ROUTE_GOUDRONNEE' || e.type === 'ROUTE_NON_GOUDRONNEE') &&
        e.visible,
    ),
  );

  readonly visibleGreenElements = computed(() =>
    this.elements().filter((e) => e.type === 'ESPACE_VERT' && this.layerGreen() && e.visible),
  );

  readonly visiblePoiElements = computed(() =>
    this.elements().filter(
      (e) =>
        this.layerPois() &&
        !['ROUTE_GOUDRONNEE', 'ROUTE_NON_GOUDRONNEE', 'ESPACE_VERT'].includes(e.type) &&
        e.visible,
    ),
  );

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.toast.warning('Programme manquant', 'Ouvrez le studio depuis un programme foncier.');
      this.router.navigate(['/societe/programmes']);
      return;
    }
    this.load(id);
  }

  private load(programmeId: number): void {
    this.isLoading.set(true);

    this.societeService.getProgrammeById(programmeId).subscribe({
      next: (programme) => {
        if (!programme) {
          this.toast.error('Programme introuvable', 'Le programme demandé n’existe pas ou n’est pas accessible.');
          this.isLoading.set(false);
          return;
        }
        this.programme.set(programme);
        this.loadLots(programmeId);
        this.loadPlan(programmeId);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Chargement impossible', 'Le programme n’a pas pu être récupéré depuis l’API.');
      },
    });
  }

  private loadLots(programmeId: number): void {
    this.societeService.getLotsByProgrammeStrict(programmeId).subscribe({
      next: (lots) => {
        this.lots.set(lots.map((lot) => this.mapLot(lot)));
        this.isLoading.set(false);
      },
      error: (error) => {
        this.lots.set([]);
        this.isLoading.set(false);
        this.toast.error('Lots indisponibles', this.apiErrorMessage(error, 'Impossible de récupérer les lots du programme. Vérifiez que l’API /lots-programmes est démarrée.'));
      },
    });
  }

  private loadPlan(programmeId: number): void {
    this.societeService.getPlanMasseByProgramme(programmeId).subscribe({
      next: (plan) => {
        if (plan) {
          this.loadPlanElements(plan);
          return;
        }

        // Un programme peut ne pas encore avoir de Plan de masse en base.
        // On crée alors le contexte vide du Studio dès son ouverture.
        this.societeService.upsertPlanMasse(this.planRequest()).subscribe({
          next: (response) => {
            if (response.data) {
              this.loadPlanElements(response.data);
            } else {
              this.planMasse.set(null);
              this.elements.set([]);
            }
          },
          error: () => {
            this.planMasse.set(null);
            this.elements.set([]);
            this.toast.error('Plan de masse indisponible', 'Le programme est chargé, mais le contexte du Studio n’a pas pu être initialisé.');
          },
        });
      },
      error: () => this.elements.set([]),
    });
  }

  private loadPlanElements(plan: PlanMasseBackend): void {
    this.planMasse.set(plan);
    this.restoreFromSnapshot(plan.plan);
    this.societeService.getPlanMasseElements(plan.id).subscribe({
      next: (elements) => this.elements.set(elements.map((element) => this.mapElement(element))),
      error: () => this.elements.set([]),
    });
  }

  setTool(tool: StudioTool): void {
    this.activeTool.set(tool);
    this.drawingPoints.set([]);
    this.elementDraftGeometry.set(null);

    if (tool !== 'PLACE_PRESET') this.selectedPreset.set(null);
    if (tool !== 'SELECT') this.selectedElement.set(null);

    const messages: Record<StudioTool, string> = {
      SELECT: 'Sélectionnez un lot ou un élément. Glissez un objet pour le déplacer.',
      PLACE_PRESET: 'Sélectionnez un lot à positionner puis glissez une forme préconçue sur le plan.',
      DRAW_FREE: 'Sélectionnez un lot puis dessinez librement son contour.',
      ADD_ROAD: 'Cliquez sur le plan pour tracer la route, puis double-cliquez pour terminer.',
      ADD_GREEN: 'Cliquez pour dessiner une zone verte, puis double-cliquez pour terminer.',
      ADD_POI: 'Cliquez sur le plan pour positionner un point d’intérêt.',
    };

    this.toolHint.set(messages[tool]);
  }

  openCreateLotModal(): void {
    this.lotForm.reset({
      numeroLot: this.nextLotNumber(),
      numeroIlot: this.selectedLot()?.numeroIlot || '1',
      numeroIlotLotissement: '',
      reference: '',
      superficie: 0,
      prix: 0,
      facade: 0,
      profondeur: 0,
      statut: 'DISPONIBLE',
    });
    this.isCreateLotModalOpen.set(true);
  }

  confirmCreateLot(): void {
    if (this.lotForm.invalid) {
      this.lotForm.markAllAsTouched();
      this.toast.warning('Formulaire incomplet', 'Renseignez le numéro de lot, l’îlot, la superficie et le prix (valeurs supérieures à 0).');
      return;
    }

    const programme = this.programme();
    if (!programme) return;

    const value = this.lotForm.getRawValue();
    const numeroIlot = value.numeroIlot.trim() || '1';
    const request: LotProgrammeRequestBackend = {
      numeroLot: this.stripLotPrefix(value.numeroLot),
      numeroIlot,
      numeroIlotLotissement: value.numeroIlotLotissement.trim() || undefined,
      reference: value.reference.trim() || undefined,
      superficie: value.superficie,
      prix: value.prix,
      facade: value.facade || undefined,
      profondeur: value.profondeur || undefined,
      statut: this.toBackendStatus(value.statut),
      programmeId: programme.id,
      // Pas de geometry ici : le lot est d'abord créé comme objet métier.
    };

    this.isSaving.set(true);
    this.saveStatus.set('idle');

    this.societeService.createLotProgramme(request).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        if (!response.data) {
          this.toast.error('Création impossible', 'Le backend n’a pas renvoyé le lot créé.');
          return;
        }

        const created = this.mapBackendLot(response.data);
        this.pushHistory();
        this.lots.update((items) => [...items, created]);
        this.selectedLot.set(created);
        this.selectedElement.set(null);
        this.isCreateLotModalOpen.set(false);
        this.saveStatus.set('idle');
        this.toast.success('Lot créé', `${created.numeroLot} est enregistré dans la base.`);

        // Le lot est posé immédiatement sur le plan (rectangle) : sa géométrie est enregistrée via
        // PATCH /lots-programmes/{id}/geometry. Pas de rechargement concurrent de la liste ici,
        // qui pouvait écraser la forme avant la fin de l'enregistrement.
        this.placeSelectedLotAsRectangle();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Création impossible', this.apiErrorMessage(error, 'Le lot n’a pas pu être créé.'));
      },
    });
  }

  private reloadLotsFromBackend(preferredLotId?: number): void {
    const programme = this.programme();
    if (!programme) return;

    this.societeService.getLotsByProgrammeStrict(programme.id).subscribe({
      next: (lots) => {
        const mapped = lots.map((lot) => this.mapLot(lot));
        this.lots.set(mapped);
        if (preferredLotId != null) {
          const preferred = mapped.find((lot) => lot.id === preferredLotId);
          if (preferred) this.selectedLot.set(preferred);
        }
      },
      error: (error) => {
        this.toast.error('Actualisation impossible', this.apiErrorMessage(error, 'Le lot a été créé mais la liste n’a pas pu être actualisée. Rechargez le Studio.'));
      },
    });
  }

  selectLot(lot: StudioLot, event?: Event): void {
    event?.stopPropagation();
    this.selectedLot.set(lot);
    this.selectedElement.set(null);

    if (this.activeTool() === 'SELECT') return;
    if (this.activeTool() === 'PLACE_PRESET') {
      this.toast.info('Lot sélectionné', `${lot.numeroLot} est prêt à recevoir une forme préconçue.`);
    }
  }

  clearSelection(): void {
    this.selectedLot.set(null);
    this.selectedElement.set(null);
  }

  startPlaceLot(lot: StudioLot): void {
    this.selectedLot.set(lot);
    this.selectedElement.set(null);
    this.activeTool.set('PLACE_PRESET');
    this.toast.info('Lot prêt', `${lot.numeroLot} : choisissez un gabarit puis glissez-le sur le plan, ou utilisez « Rectangle direct ».`);
  }

  placeSelectedLotAsRectangle(): void {
    const lot = this.selectedLot();
    if (!lot) {
      this.toast.warning('Lot requis', 'Sélectionnez d’abord un lot créé.');
      return;
    }

    const rectangle = this.shapePresets.find((item) => item.id === 'RECTANGLE');
    if (!rectangle) return;

    const positioned = this.lotsPositionnes();
    const index = positioned.length;
    const center = {
      x: Math.min(this.canvasWidth - 180, 180 + (index % 5) * 210),
      y: Math.min(this.canvasHeight - 150, 140 + Math.floor(index / 5) * 170),
    };

    this.applyPresetToLot(lot, rectangle, this.editorPointFromGeometry(center));
  }

  private editorPointFromGeometry(point: GeometryPoint): GeometryPoint {
    return {
      x: this.snapPoint(point).x,
      y: this.snapPoint(point).y,
    };
  }

  onLotDragStart(event: DragEvent, lot: StudioLot): void {
    this.selectedLot.set(lot);
    this.selectedElement.set(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-foncier-lot', String(lot.id));
      event.dataTransfer.setData('text/plain', `lot:${lot.id}`);
    }
  }

  onLotDragEnd(): void {
    // Aucun état persistant à nettoyer ici : la sélection du lot reste utile après le dépôt.
  }

  onShapeDragStart(event: DragEvent, preset: ShapePreset): void {
    if (!this.selectedLot()) {
      event.preventDefault();
      this.toast.warning('Lot requis', 'Créez d’abord un lot puis sélectionnez-le avant de glisser une forme.');
      return;
    }
    this.selectedPreset.set(preset.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-foncier-preset', preset.id);
      event.dataTransfer.setData('text/plain', preset.id);
    }
  }

  onShapeDragEnd(): void {
    this.selectedPreset.set(null);
  }

  cancelPresetPlacement(): void {
    this.selectedPreset.set(null);
    this.activeTool.set('SELECT');
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();

    const lotIdRaw = event.dataTransfer?.getData('application/x-foncier-lot');
    if (lotIdRaw) {
      const lotId = Number(lotIdRaw);
      const lot = this.lots().find((item) => item.id === lotId);
      if (!lot) {
        this.toast.error('Lot introuvable', 'Le lot glissé n’existe plus dans les données chargées.');
        return;
      }
      this.selectedLot.set(lot);
      this.selectedElement.set(null);
      const rectangle = this.shapePresets.find((item) => item.id === 'RECTANGLE');
      if (rectangle) {
        this.applyPresetToLot(lot, rectangle, this.editorPoint(event));
      }
      return;
    }

    const presetId = event.dataTransfer?.getData('application/x-foncier-preset') || event.dataTransfer?.getData('text/plain');
    if (!presetId) return;

    const preset = this.shapePresets.find((item) => item.id === presetId);
    if (!preset) return;

    const target = this.selectedLot();
    if (!target) {
      this.toast.warning('Lot requis', 'Sélectionnez le lot déjà créé qui doit recevoir cette forme.');
      return;
    }

    this.applyPresetToLot(target, preset, this.editorPoint(event));
    this.selectedPreset.set(null);
  }

  choosePreset(preset: ShapePreset): void {
    const lot = this.selectedLot();
    if (!lot) {
      this.toast.warning('Lot requis avant le dessin', 'Créez un lot ou sélectionnez un lot existant avant de choisir une forme.');
      return;
    }

    this.selectedPreset.set(preset.id);
    this.activeTool.set('PLACE_PRESET');
    this.selectedElement.set(null);
    this.toast.info('Gabarit sélectionné', `${preset.label} est prêt. Glissez-le sur le plan ou cliquez sur la zone où vous voulez placer ${lot.numeroLot}.`);
  }

  private applyPresetToLot(lot: StudioLot, preset: ShapePreset, center: GeometryPoint): void {
    if (lot.geometry.length >= 3) {
      this.toast.info('Gabarit remplacé', `${lot.numeroLot} utilise maintenant le modèle ${preset.label}. Ajustez ensuite ses sommets.`);
    }

    this.pushHistory();
    const geometry = this.buildPresetGeometry(lot, preset, center);
    const updated = { ...lot, geometry };

    this.lots.update((items) => items.map((item) => (item.id === lot.id ? updated : item)));
    this.selectedLot.set(updated);
    this.activeTool.set('SELECT');
    this.selectedPreset.set(null);
    this.persistLotGeometry(updated, `Forme ${preset.label} enregistrée`, `${updated.numeroLot} est maintenant représenté sur le plan.`);
  }

  private buildPresetGeometry(lot: StudioLot, preset: ShapePreset, center: GeometryPoint): GeometryPoint[] {
    const bounds = preset.points.reduce(
      (acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y),
      }),
      { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
    );

    const baseWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const baseHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const { width, height } = this.getPreferredLotCanvasSize(lot);

    return preset.points.map((point) => ({
      x: this.clamp(
        center.x + ((point.x - (bounds.minX + bounds.maxX) / 2) / baseWidth) * width,
        12,
        this.canvasWidth - 12,
      ),
      y: this.clamp(
        center.y + ((point.y - (bounds.minY + bounds.maxY) / 2) / baseHeight) * height,
        12,
        this.canvasHeight - 12,
      ),
    }));
  }

  private getPreferredLotCanvasSize(lot: StudioLot): { width: number; height: number } {
    const facade = lot.facade && lot.facade > 0 ? lot.facade : null;
    const profondeur = lot.profondeur && lot.profondeur > 0 ? lot.profondeur : null;
    const superficie = lot.superficie > 0 ? lot.superficie : 400;
    const pxPerMeter = this.pixelsPerMeter();
    const k = pxPerMeter / 8; // conserve le comportement historique à 8 px/m

    let widthMeters = facade;
    let heightMeters = profondeur;

    if (!widthMeters && !heightMeters) {
      const side = Math.sqrt(superficie);
      widthMeters = side;
      heightMeters = side;
    } else if (!widthMeters) {
      widthMeters = superficie / (heightMeters || 1);
    } else if (!heightMeters) {
      heightMeters = superficie / widthMeters;
    }

    return {
      width: this.clamp((widthMeters || 20) * pxPerMeter, 110 * k, 340),
      height: this.clamp((heightMeters || 20) * pxPerMeter, 90 * k, 260),
    };
  }

  startFreeDrawSelectedLot(): void {
    const lot = this.selectedLot();
    if (!lot) {
      this.toast.warning('Sélection requise', 'Sélectionnez d’abord le lot dont vous voulez dessiner le contour.');
      return;
    }
    this.activeTool.set('DRAW_FREE');
    this.drawingPoints.set([]);
    this.toast.info('Dessin libre', `Tracez maintenant le contour de ${lot.numeroLot}. Double-cliquez pour terminer.`);
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (this.dragState || this.panState) return;
    this.cursorPosition.set(this.toCanvasPoint(event));

    if (this.isPanMode()) {
      const viewX = this.viewBoxX();
      const viewY = this.viewBoxY();
      this.panState = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewBoxX: viewX,
        startViewBoxY: viewY,
      };
      this.planCanvas?.nativeElement.setPointerCapture?.(event.pointerId);
      return;
    }

    const tool = this.activeTool();

    if (tool === 'PLACE_PRESET') {
      const presetId = this.selectedPreset();
      const lot = this.selectedLot();
      if (presetId && lot) {
        const preset = this.shapePresets.find((item) => item.id === presetId);
        if (preset) {
          const point = this.editorPoint(event);
          this.applyPresetToLot(lot, preset, point);
          return;
        }
      }

      const target = event.target as Element | null;
      if (target?.tagName === 'svg') this.clearSelection();
      return;
    }

    if (tool === 'SELECT') {
      const target = event.target as Element | null;
      if (target?.tagName === 'svg') this.clearSelection();
      return;
    }

    const point = this.toCanvasPoint(event);

    if (tool === 'ADD_POI') {
      this.elementDraftGeometry.set({ type: 'POINT', x: point.x, y: point.y });
      this.elementForm.reset({ type: 'ECOLE', nom: '', description: '' });
      this.isElementModalOpen.set(true);
      return;
    }

    this.drawingPoints.update((points) => [...points, point]);
  }

  onCanvasDoubleClick(event: MouseEvent): void {
    event.preventDefault();

    const rawPoints = this.drawingPoints();
    const points = rawPoints.length > 1 ? rawPoints.slice(0, -1) : rawPoints;
    this.drawingPoints.set(points);

    if (this.activeTool() === 'DRAW_FREE') {
      const lot = this.selectedLot();
      if (!lot) {
        this.toast.warning('Lot manquant', 'Sélectionnez un lot avant de dessiner son contour.');
        this.drawingPoints.set([]);
        return;
      }
      if (points.length < 3) {
        this.toast.warning('Contour incomplet', 'Un lot doit comporter au moins trois points.');
        return;
      }
      this.pushHistory();
      const updated = { ...lot, geometry: [...points] };
      this.lots.update((items) => items.map((item) => (item.id === lot.id ? updated : item)));
      this.selectedLot.set(updated);
      this.drawingPoints.set([]);
      this.activeTool.set('SELECT');
      this.persistLotGeometry(updated, 'Contour enregistré', `${updated.numeroLot} a été redessiné et sauvegardé.`);
      return;
    }

    if (this.activeTool() === 'ADD_ROAD') {
      if (points.length < 2) {
        this.toast.warning('Tracé incomplet', 'Une route doit comporter au moins deux points.');
        return;
      }
      this.elementDraftGeometry.set({ type: 'LINE', points: [...points] });
      // Respecte le « Type de route » choisi dans le panneau Aménagement.
      this.elementForm.reset({ type: this.roadMode() === 'NON_GOUDRONNEE' ? 'ROUTE_NON_GOUDRONNEE' : 'ROUTE_GOUDRONNEE', nom: '', description: '' });
      this.isElementModalOpen.set(true);
      return;
    }

    if (this.activeTool() === 'ADD_GREEN') {
      if (points.length < 3) {
        this.toast.warning('Zone incomplète', 'Une zone verte doit comporter au moins trois points.');
        return;
      }
      this.elementDraftGeometry.set({ type: 'POLYGON', points: [...points] });
      this.elementForm.reset({ type: 'ESPACE_VERT', nom: '', description: '' });
      this.isElementModalOpen.set(true);
    }
  }

  selectElement(element: StudioElement, event?: Event): void {
    event?.stopPropagation();
    this.selectedElement.set(element);
    this.selectedLot.set(null);
    this.activeTool.set('SELECT');
  }

  addLotVertexAtEdge(event: MouseEvent, lot: StudioLot): void {
    event.preventDefault();
    event.stopPropagation();
    if (lot.geometry.length < 3) return;
    const point = this.editorPoint(event);
    const segmentIndex = this.findNearestSegment(lot.geometry, point);
    if (segmentIndex < 0) return;

    this.pushHistory();
    const geometry = [...lot.geometry];
    geometry.splice(segmentIndex + 1, 0, point);
    const updated = { ...lot, geometry };
    this.lots.update((items) => items.map((item) => (item.id === lot.id ? updated : item)));
    this.selectedLot.set(updated);
    this.persistLotGeometry(updated, 'Sommet ajouté', `Le contour de ${updated.numeroLot} a été affiné.`);
  }

  deleteLotVertex(event: MouseEvent, lot: StudioLot, vertexIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (lot.geometry.length <= 3) {
      this.toast.warning('Contour minimal atteint', 'Un polygone doit conserver au moins trois sommets.');
      return;
    }

    this.pushHistory();
    const geometry = lot.geometry.filter((_, index) => index !== vertexIndex);
    const updated = { ...lot, geometry };
    this.lots.update((items) => items.map((item) => (item.id === lot.id ? updated : item)));
    this.selectedLot.set(updated);
    this.persistLotGeometry(updated, 'Sommet supprimé', `Le contour de ${updated.numeroLot} a été mis à jour.`);
  }

  startLotVertexDrag(event: PointerEvent, lot: StudioLot, vertexIndex: number): void {
    if (this.isPanMode()) return;
    event.stopPropagation();
    this.pushHistory();
    this.dragState = {
      kind: 'LOT_VERTEX',
      id: lot.id,
      vertexIndex,
      lastPoint: this.toCanvasPoint(event),
      changed: false,
    };
  }

  startLotBodyDrag(event: PointerEvent, lot: StudioLot): void {
    if (this.isPanMode()) return;
    event.stopPropagation();
    this.pushHistory();
    this.selectedLot.set(lot);
    this.selectedElement.set(null);
    this.dragState = {
      kind: 'LOT_BODY',
      id: lot.id,
      lastPoint: this.toCanvasPoint(event),
      changed: false,
    };
  }

  addElementVertexAtEdge(event: MouseEvent, element: StudioElement): void {
    event.preventDefault();
    event.stopPropagation();
    if (element.geometry.type === 'POINT' || element.geometry.points.length < 2) return;
    const point = this.editorPoint(event);
    const segmentIndex = this.findNearestSegment(
      element.geometry.points,
      point,
      element.geometry.type === 'POLYGON',
    );
    if (segmentIndex < 0) return;

    this.pushHistory();
    const points = [...element.geometry.points];
    points.splice(segmentIndex + 1, 0, point);
    const geometry: StudioGeometry =
      element.geometry.type === 'POLYGON'
        ? { type: 'POLYGON', points }
        : { type: 'LINE', points };
    const updated = { ...element, geometry };
    this.elements.update((items) => items.map((item) => (item.id === element.id ? updated : item)));
    this.selectedElement.set(updated);
    this.persistElementGeometry(updated);
  }

  deleteElementVertex(event: MouseEvent, element: StudioElement, vertexIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    const min = element.geometry.type === 'POLYGON' ? 3 : 2;
    if (element.geometry.type === 'POINT' || element.geometry.points.length <= min) {
      this.toast.warning('Contour minimal atteint', `Cet élément doit conserver au moins ${min} points.`);
      return;
    }

    this.pushHistory();
    const points = element.geometry.points.filter((_, index) => index !== vertexIndex);
    const geometry: StudioGeometry =
      element.geometry.type === 'POLYGON'
        ? { type: 'POLYGON', points }
        : { type: 'LINE', points };
    const updated = { ...element, geometry };
    this.elements.update((items) => items.map((item) => (item.id === element.id ? updated : item)));
    this.selectedElement.set(updated);
    this.persistElementGeometry(updated);
  }

  startElementVertexDrag(event: PointerEvent, element: StudioElement, vertexIndex: number): void {
    if (this.isPanMode()) return;
    event.stopPropagation();
    if (element.geometry.type === 'POINT') return;
    this.pushHistory();
    this.dragState = {
      kind: 'ELEMENT_VERTEX',
      id: element.id,
      vertexIndex,
      lastPoint: this.toCanvasPoint(event),
      changed: false,
    };
  }

  startElementBodyDrag(event: PointerEvent, element: StudioElement): void {
    if (this.isPanMode()) return;
    event.stopPropagation();
    this.pushHistory();
    this.selectedElement.set(element);
    this.selectedLot.set(null);
    this.dragState = {
      kind: 'ELEMENT_BODY',
      id: element.id,
      lastPoint: this.toCanvasPoint(event),
      changed: false,
    };
  }

  onCanvasPointerMove(event: PointerEvent): void {
    const current = this.toCanvasPoint(event);
    this.cursorPosition.set(current);

    if (this.panState && this.panState.pointerId === event.pointerId) {
      const rect = this.planCanvas?.nativeElement.getBoundingClientRect();
      if (rect) {
        const viewWidth = this.getViewBoxWidth();
        const viewHeight = this.getViewBoxHeight();
        const dx = (event.clientX - this.panState.startClientX) / rect.width * viewWidth;
        const dy = (event.clientY - this.panState.startClientY) / rect.height * viewHeight;
        this.setViewBox(this.panState.startViewBoxX - dx, this.panState.startViewBoxY - dy);
      }
      return;
    }

    if (!this.dragState) return;
    const dx = current.x - this.dragState.lastPoint.x;
    const dy = current.y - this.dragState.lastPoint.y;

    if (Math.abs(dx) + Math.abs(dy) < 0.2) return;
    this.dragState.changed = true;

    if (this.dragState.kind === 'LOT_VERTEX') {
      const { id, vertexIndex } = this.dragState;
      const vertex = this.snapToGrid() ? this.snapPoint(current) : current;
      this.lots.update((items) =>
        items.map((lot) => {
          if (lot.id !== id || vertexIndex === undefined) return lot;
          const geometry = lot.geometry.map((point, index) =>
            index === vertexIndex ? { x: vertex.x, y: vertex.y } : point,
          );
          return { ...lot, geometry };
        }),
      );
      this.refreshSelectedLot(id);
    }

    if (this.dragState.kind === 'LOT_BODY') {
      const { id } = this.dragState;
      this.lots.update((items) =>
        items.map((lot) => {
          if (lot.id !== id) return lot;
          const moved = lot.geometry.map((point) => ({ x: point.x + dx, y: point.y + dy }));
          return { ...lot, geometry: this.alignLotGeometry(moved, id) };
        }),
      );
      this.keepLotInsideCanvas(id);
      this.refreshSelectedLot(id);
    }

    if (this.dragState.kind === 'ELEMENT_VERTEX') {
      const { id, vertexIndex } = this.dragState;
      this.elements.update((items) =>
        items.map((element) => {
          if (element.id !== id || vertexIndex === undefined || element.geometry.type === 'POINT') return element;
          const points = element.geometry.points.map((point, index) =>
            index === vertexIndex ? { x: current.x, y: current.y } : point,
          );
          return {
            ...element,
            geometry:
              element.geometry.type === 'POLYGON'
                ? { type: 'POLYGON', points }
                : { type: 'LINE', points },
          };
        }),
      );
      this.refreshSelectedElement(id);
    }

    if (this.dragState.kind === 'ELEMENT_BODY') {
      const { id } = this.dragState;
      this.elements.update((items) =>
        items.map((element) => ({
          ...element,
          geometry:
            element.id === id ? this.translateGeometry(element.geometry, dx, dy) : element.geometry,
        })),
      );
      this.refreshSelectedElement(id);
    }

    this.dragState.lastPoint = current;
  }

  onCanvasPointerUp(event?: PointerEvent): void {
    if (this.panState) {
      if (!event || event.pointerId === this.panState.pointerId) {
        try { this.planCanvas?.nativeElement.releasePointerCapture?.(this.panState.pointerId); } catch {}
        this.panState = null;
      }
      return;
    }

    const drag = this.dragState;
    this.dragState = null;
    if (!drag?.changed) return;

    if (drag.kind === 'LOT_VERTEX' || drag.kind === 'LOT_BODY') {
      const lot = this.lots().find((item) => item.id === drag.id);
      if (lot) this.persistLotGeometry(lot, 'Position enregistrée', `${lot.numeroLot} a été sauvegardé automatiquement.`);
    } else {
      const element = this.elements().find((item) => item.id === drag.id);
      if (element) this.persistElementGeometry(element);
    }
  }

  setPanMode(): void {
    this.isPanMode.update((value) => !value);
    if (this.isPanMode()) {
      this.activeTool.set('SELECT');
      this.selectedPreset.set(null);
      this.toast.info('Navigation du plan', 'Faites glisser le fond du plan pour le déplacer. La molette contrôle le zoom.');
    }
  }

  zoomIn(): void { this.setZoomAroundCenter(Math.min(2.5, this.zoom() + 0.25)); }

  zoomOut(): void { this.setZoomAroundCenter(Math.max(0.5, this.zoom() - 0.25)); }

  resetView(): void {
    this.zoom.set(1);
    this.viewBoxX.set(0);
    this.viewBoxY.set(0);
  }

  fitToLots(): void {
    const positioned = this.lots().filter((lot) => lot.geometry.length >= 3);
    if (!positioned.length) {
      this.resetView();
      this.toast.info('Centrage du plan', 'Aucun lot positionné : vue générale rétablie.');
      return;
    }

    const allPoints = positioned.flatMap((lot) => lot.geometry);
    const minX = Math.min(...allPoints.map((point) => point.x));
    const maxX = Math.max(...allPoints.map((point) => point.x));
    const minY = Math.min(...allPoints.map((point) => point.y));
    const maxY = Math.max(...allPoints.map((point) => point.y));
    const contentW = Math.max(240, maxX - minX + 100);
    const contentH = Math.max(180, maxY - minY + 100);
    const nextZoom = this.clamp(Math.min(this.canvasWidth / contentW, this.canvasHeight / contentH), 0.5, 2.5);

    this.zoom.set(nextZoom);
    this.setViewBox(minX - 50, minY - 50);
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.planCanvas?.nativeElement.getBoundingClientRect();
    if (!rect) return;

    const oldZoom = this.zoom();
    const nextZoom = this.clamp(oldZoom * (event.deltaY < 0 ? 1.12 : 0.89), 0.5, 2.5);
    if (nextZoom === oldZoom) return;

    const ratioX = (event.clientX - rect.left) / rect.width;
    const ratioY = (event.clientY - rect.top) / rect.height;
    const worldX = this.viewBoxX() + ratioX * this.getViewBoxWidth();
    const worldY = this.viewBoxY() + ratioY * this.getViewBoxHeight();
    const nextW = this.canvasWidth / nextZoom;
    const nextH = this.canvasHeight / nextZoom;

    this.zoom.set(nextZoom);
    this.setViewBox(worldX - ratioX * nextW, worldY - ratioY * nextH);
  }

  alignSelectedLotToGrid(): void {
    const lot = this.selectedLot();
    if (!lot || lot.geometry.length < 3) return;
    this.pushHistory();
    const geometry = lot.geometry.map((point) => this.snapPoint(point));
    const updated = { ...lot, geometry: this.alignLotGeometry(geometry, lot.id) };
    this.lots.update((items) => items.map((item) => item.id === lot.id ? updated : item));
    this.selectedLot.set(updated);
    this.persistLotGeometry(updated, 'Alignement enregistré', `${updated.numeroLot} a été aligné sur la grille et ses voisins.`);
  }

  openLotRowModal(): void {
    const lot = this.selectedLot();
    if (!lot) {
      this.toast.warning('Lot modèle requis', 'Sélectionnez d’abord un lot existant à dupliquer en série.');
      return;
    }
    this.rowForm.reset({ count: 4, spacingMeters: 3, direction: 'HORIZONTAL' });
    this.isRowModalOpen.set(true);
  }

  generateLotRow(): void {
    const source = this.selectedLot();
    const programme = this.programme();
    if (!source || !programme || this.rowForm.invalid) {
      this.rowForm.markAllAsTouched();
      return;
    }

    const value = this.rowForm.getRawValue();
    const count = Math.max(2, Math.min(30, value.count));
    const spacingPx = value.spacingMeters * this.pixelsPerMeter();
    const direction = value.direction;
    const baseGeometry = source.geometry.length >= 3 ? source.geometry : this.buildPresetGeometry(
      source,
      this.shapePresets.find((preset) => preset.id === 'RECTANGLE')!,
      this.getSuggestedDropPoint(source),
    );

    const numbers = this.nextLotNumbers(count - 1);
    const requests: LotProgrammeRequestBackend[] = numbers.map((numeroLot, index) => {
      const dx = direction === 'HORIZONTAL' ? spacingPx * (index + 1) : 0;
      const dy = direction === 'VERTICAL' ? spacingPx * (index + 1) : 0;
      const geometry = baseGeometry.map((point) => ({
        x: this.clamp(point.x + dx, 8, this.canvasWidth - 8),
        y: this.clamp(point.y + dy, 8, this.canvasHeight - 8),
      }));

      return {
        numeroLot: this.stripLotPrefix(numeroLot),
        numeroIlot: source.numeroIlot || '1',
        numeroIlotLotissement: source.numeroIlotLotissement,
        reference: undefined,
        superficie: source.superficie,
        prix: source.prix,
        facade: source.facade,
        profondeur: source.profondeur,
        statut: this.toBackendStatus(source.statut),
        programmeId: programme.id,
        geometryJson: JSON.stringify({ type: 'POLYGON', points: geometry }),
      };
    });

    this.isGeneratingRow.set(true);
    this.isSaving.set(true);
    this.societeService.ensureLotsCreated(requests).subscribe({
      next: (responses) => {
        const createdLots = responses
          .map((response) => response.data ? this.mapBackendLot(response.data) : null)
          .filter((lot): lot is StudioLot => lot !== null);
        this.lots.update((items) => [...items, ...createdLots]);
        this.pushHistory();
        this.selectedLot.set(createdLots.length ? createdLots[createdLots.length - 1] : source);
        this.isGeneratingRow.set(false);
        this.isSaving.set(false);
        this.isRowModalOpen.set(false);
        this.saveStatus.set('saved');
        this.markSaved();
        this.toast.success('Rangée créée', `${createdLots.length} nouveau(x) lot(s) ont été créé(s) et positionné(s).`);
      },
      error: (error) => {
        this.isGeneratingRow.set(false);
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Création interrompue', this.apiErrorMessage(error, 'La rangée de lots n’a pas pu être créée complètement.'));
      },
    });
  }

  generateSmartRoads(): void {
    const positioned = this.lots().filter((lot) => lot.geometry.length >= 3);
    if (positioned.length < 2) {
      this.toast.warning('Lots insuffisants', 'Positionnez au moins deux lots avant de générer les routes.');
      return;
    }

    const routes: StudioGeometry[] = [];
    const rowGroups = this.groupLotsByAxis(positioned, 'Y');
    for (let index = 0; index < rowGroups.length - 1; index++) {
      const upper = rowGroups[index];
      const lower = rowGroups[index + 1];
      const y = (this.maxLotY(upper) + this.minLotY(lower)) / 2;
      const minX = Math.max(10, Math.min(...[...upper, ...lower].flatMap((lot) => lot.geometry.map((point) => point.x))) - 25);
      const maxX = Math.min(this.canvasWidth - 10, Math.max(...[...upper, ...lower].flatMap((lot) => lot.geometry.map((point) => point.x))) + 25);
      if (maxX - minX > 90) routes.push({ type: 'LINE', points: [{ x: minX, y }, { x: maxX, y }] });
    }

    const columnGroups = this.groupLotsByAxis(positioned, 'X');
    for (let index = 0; index < columnGroups.length - 1; index++) {
      const left = columnGroups[index];
      const right = columnGroups[index + 1];
      const x = (this.maxLotX(left) + this.minLotX(right)) / 2;
      const minY = Math.max(10, Math.min(...[...left, ...right].flatMap((lot) => lot.geometry.map((point) => point.y))) - 25);
      const maxY = Math.min(this.canvasHeight - 10, Math.max(...[...left, ...right].flatMap((lot) => lot.geometry.map((point) => point.y))) + 25);
      if (maxY - minY > 90) routes.push({ type: 'LINE', points: [{ x, y: minY }, { x, y: maxY }] });
    }

    const unique = routes.filter((candidate) => !this.hasSimilarRoad(candidate));
    if (!unique.length) {
      this.toast.info('Routes déjà présentes', 'Aucune nouvelle route n’a été ajoutée au plan.');
      return;
    }

    this.isSaving.set(true);
    this.ensurePlanMasse().subscribe({
      next: (response) => {
        const plan = response.data;
        if (!plan) {
          this.isSaving.set(false);
          this.toast.error('Plan indisponible', 'Impossible de préparer le Plan de masse pour les routes.');
          return;
        }
        forkJoin(unique.map((geometry, index) => this.societeService.createPlanMasseElement({
          type: this.roadMode() === 'GOUDRONNEE' ? 'ROUTE_GOUDRONNEE' : 'ROUTE_NON_GOUDRONNEE',
          nom: `Route ${index + 1}`,
          description: 'Route générée à partir de la disposition des lots.',
          geometryJson: JSON.stringify(geometry),
          visible: true,
          zIndex: 4,
          planMasseId: plan.id,
        }))).subscribe({
          next: (responses) => {
            const created = responses.map((res) => res.data ? this.mapElement(res.data) : null).filter((item): item is StudioElement => item !== null);
            this.elements.update((items) => [...items, ...created]);
            this.isSaving.set(false);
            this.markSaved();
            this.saveStatus.set('saved');
            this.toast.success('Routes générées', `${created.length} route(s) ont été placées entre les lots.`);
          },
          error: (error) => {
            this.isSaving.set(false);
            this.saveStatus.set('error');
            this.toast.error('Routes non enregistrées', this.apiErrorMessage(error, 'Les routes n’ont pas pu être enregistrées.'));
          },
        });
      },
      error: (error) => {
        this.isSaving.set(false);
        this.toast.error('Plan indisponible', this.apiErrorMessage(error, 'Impossible de préparer le Plan de masse.'));
      },
    });
  }

  openEditLot(): void {
    const lot = this.selectedLot();
    if (!lot) return;
    this.lotForm.reset({
      numeroLot: lot.numeroLot,
      numeroIlot: lot.numeroIlot,
      numeroIlotLotissement: lot.numeroIlotLotissement ?? '',
      reference: lot.reference,
      superficie: lot.superficie,
      prix: lot.prix,
      facade: lot.facade ?? 0,
      profondeur: lot.profondeur ?? 0,
      statut: lot.statut,
    });
    this.isEditLotModalOpen.set(true);
  }

  saveLotDetails(): void {
    const lot = this.selectedLot();
    if (!lot || this.lotForm.invalid) return;

    const value = this.lotForm.getRawValue();
    const updated: StudioLot = {
      ...lot,
      numeroLot: value.numeroLot,
      numeroIlot: value.numeroIlot,
      numeroIlotLotissement: value.numeroIlotLotissement || undefined,
      reference: value.reference,
      superficie: value.superficie,
      prix: value.prix,
      facade: value.facade || undefined,
      profondeur: value.profondeur || undefined,
      statut: value.statut,
    };

    this.isEditLotModalOpen.set(false);
    this.persistLot(updated, 'Lot mis à jour', `${updated.numeroLot} a été enregistré dans le backend.`);
  }

  deleteSelectedLotFromInspector(): void {
    const lot = this.selectedLot();
    if (!lot) return;

    const confirmed = window.confirm(`Supprimer ${lot.numeroLot} ? Cette action supprimera aussi sa représentation du plan.`);
    if (!confirmed) return;

    this.isSaving.set(true);
    this.societeService.deleteLotProgramme(lot.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.pushHistory();
        this.lots.update((items) => items.filter((item) => item.id !== lot.id));
        this.selectedLot.set(null);
        this.saveStatus.set('saved');
        this.syncPlanSnapshot();
        this.toast.success('Lot supprimé', `${lot.numeroLot} a été supprimé du backend.`);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Suppression impossible', this.apiErrorMessage(error, 'Le lot n’a pas pu être supprimé.'));
      },
    });
  }

  resetLotGeometry(): void {
    const lot = this.selectedLot();
    if (!lot) return;
    this.pushHistory();
    const updated = { ...lot, geometry: [] };
    this.lots.update((items) => items.map((item) => (item.id === lot.id ? updated : item)));
    this.selectedLot.set(updated);
    this.toast.info('Lot libéré', `${lot.numeroLot} n’a plus de forme graphique et peut recevoir un nouveau modèle.`);
    this.activeTool.set('PLACE_PRESET');
    this.persistLot(updated, 'Position réinitialisée', `${lot.numeroLot} est prêt à être repositionné.`);
  }

  scaleSelectedLot(factor: number): void {
    const lot = this.selectedLot();
    if (!lot || lot.geometry.length < 3) {
      this.toast.warning('Lot non positionné', 'Positionnez d’abord un lot avant de modifier sa taille.');
      return;
    }

    this.pushHistory();
    const center = this.getLotCenter(lot);
    const geometry = lot.geometry.map((point) => ({
      x: this.clamp(center.x + (point.x - center.x) * factor, 10, this.canvasWidth - 10),
      y: this.clamp(center.y + (point.y - center.y) * factor, 10, this.canvasHeight - 10),
    }));
    const updated = { ...lot, geometry };
    this.lots.update((items) => items.map((item) => (item.id === lot.id ? updated : item)));
    this.selectedLot.set(updated);
    this.persistLotGeometry(updated, 'Taille enregistrée', `${updated.numeroLot} a été redimensionné.`);
  }

  toggleSnap(): void {
    this.snapToGrid.update((value) => !value);
  }

  toggleGrid(): void {
    this.showGrid.update((value) => !value);
  }

  rotateSelectedLot(degrees: number): void {
    const lot = this.selectedLot();
    if (!lot || lot.geometry.length < 3) {
      this.toast.warning('Lot non positionné', 'Positionnez d’abord le lot avant de le faire pivoter.');
      return;
    }

    this.pushHistory();
    const center = this.getLotCenter(lot);
    const radians = (degrees * Math.PI) / 180;
    const geometry = lot.geometry.map((point) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return {
        x: this.clamp(center.x + dx * Math.cos(radians) - dy * Math.sin(radians), 8, this.canvasWidth - 8),
        y: this.clamp(center.y + dx * Math.sin(radians) + dy * Math.cos(radians), 8, this.canvasHeight - 8),
      };
    });
    const updated = { ...lot, geometry };
    this.lots.update((items) => items.map((item) => (item.id === lot.id ? updated : item)));
    this.selectedLot.set(updated);
    this.persistLotGeometry(updated, 'Rotation enregistrée', `${updated.numeroLot} a été pivoté de ${degrees > 0 ? '+' : ''}${degrees}°.`);
  }

  duplicateSelectedLot(): void {
    const lot = this.selectedLot();
    const programme = this.programme();
    if (!lot || !programme) {
      this.toast.warning('Sélection requise', 'Sélectionnez un lot avant de le dupliquer.');
      return;
    }

    const nextNumber = this.nextLotNumber();
    const geometry = lot.geometry.length >= 3
      ? lot.geometry.map((point) => ({
          x: this.clamp(point.x + 32, 8, this.canvasWidth - 8),
          y: this.clamp(point.y + 32, 8, this.canvasHeight - 8),
        }))
      : undefined;

    this.isSaving.set(true);
    this.societeService.createLotProgramme({
      numeroLot: this.stripLotPrefix(nextNumber),
      numeroIlot: lot.numeroIlot || '1',
      numeroIlotLotissement: lot.numeroIlotLotissement,
      reference: undefined,
      superficie: lot.superficie,
      prix: lot.prix,
      facade: lot.facade,
      profondeur: lot.profondeur,
      statut: this.toBackendStatus(lot.statut),
      programmeId: programme.id,
      geometryJson: geometry?.length ? JSON.stringify({ type: 'POLYGON', points: geometry }) : undefined,
    }).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        if (!response.data) {
          this.toast.error('Duplication impossible', 'Le backend n’a pas renvoyé le lot dupliqué.');
          return;
        }
        const created = this.mapBackendLot(response.data);
        this.pushHistory();
        this.lots.update((items) => [...items, created]);
        this.selectedLot.set(created);
        this.toast.success('Lot dupliqué', `${created.numeroLot} a été créé comme nouveau lot.`);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Duplication impossible', this.apiErrorMessage(error, 'Le nouveau lot n’a pas pu être créé.'));
      },
    });
  }

  autoPlaceRemainingLots(): void {
    const pending = this.lotsAPositionner();
    if (!pending.length) {
      this.toast.info('Plan déjà positionné', 'Tous les lots disposent déjà d’une géométrie.');
      return;
    }

    this.pushHistory();
    const columns = Math.max(2, Math.ceil(Math.sqrt(this.lots().length)));
    const positioned = pending.map((lot, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const center = { x: 150 + col * 190, y: 125 + row * 155 };
      const rectangle = this.shapePresets.find((item) => item.id === 'RECTANGLE')!;
      return { ...lot, geometry: this.buildPresetGeometry(lot, rectangle, center) };
    });

    this.lots.update((items) => items.map((item) => positioned.find((lot) => lot.id === item.id) ?? item));
    this.isSaving.set(true);
    this.saveStatus.set('idle');

    forkJoin(positioned.map((lot) =>
      this.societeService.updateLotProgrammeGeometry(lot.id, JSON.stringify({ type: 'POLYGON', points: lot.geometry }))
    )).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isDirty.set(true);
        this.savePlan();
        this.toast.success('Lots positionnés', `${positioned.length} lot(s) ont été placés automatiquement avec un gabarit rectangle.`);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Positionnement impossible', this.apiErrorMessage(error, 'Certains lots n’ont pas pu être enregistrés.'));
      },
    });
  }

  openElementTypeModal(type: PlanElementTypeBackend): void {
    this.activeTool.set('ADD_POI');
    this.elementForm.patchValue({ type });
  }

  confirmElement(): void {
    const programme = this.programme();
    const geometry = this.elementDraftGeometry();
    if (!programme || !geometry || this.elementForm.invalid) return;

    this.isSaving.set(true);
    this.ensurePlanMasse().subscribe({
      next: (response) => {
        const plan = response.data;
        if (!plan) {
          this.isSaving.set(false);
          this.toast.error('Plan indisponible', "Le plan de masse n'a pas pu être créé ou récupéré.");
          return;
        }

        const value = this.elementForm.getRawValue();
        this.societeService
          .createPlanMasseElement({
            type: value.type,
            nom: value.nom.trim() || undefined,
            description: value.description.trim() || undefined,
            geometryJson: JSON.stringify(geometry),
            visible: true,
            zIndex: 10,
            planMasseId: plan.id,
          })
          .subscribe({
            next: (result) => {
              this.isSaving.set(false);
              if (result.data) {
                const mapped = this.mapElement(result.data);
                this.pushHistory();
                this.elements.update((items) => [...items, mapped]);
                this.selectedElement.set(mapped);
              }
              this.elementDraftGeometry.set(null);
              this.drawingPoints.set([]);
              this.isElementModalOpen.set(false);
              this.activeTool.set('SELECT');
              this.saveStatus.set('saved');
              this.syncPlanSnapshot();
              this.toast.success('Élément ajouté', 'L’élément a été positionné et enregistré sur le plan.');
            },
            error: (error) => {
              this.isSaving.set(false);
              this.saveStatus.set('error');
              this.toast.error('Ajout impossible', this.apiErrorMessage(error, 'L’élément n’a pas pu être enregistré.'));
            },
          });
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Plan de masse indisponible', this.apiErrorMessage(error, 'Le plan ne peut pas encore recevoir cet élément.'));
      },
    });
  }

  deleteSelectedElement(): void {
    const element = this.selectedElement();
    if (!element) return;
    this.isSaving.set(true);

    this.societeService.deletePlanMasseElement(element.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.pushHistory();
        this.elements.update((items) => items.filter((item) => item.id !== element.id));
        this.selectedElement.set(null);
        this.syncPlanSnapshot();
        this.toast.success('Élément supprimé', 'L’élément a été supprimé du plan.');
      },
      error: (error) => {
        this.isSaving.set(false);
        this.toast.error('Suppression impossible', this.apiErrorMessage(error, 'L’élément n’a pas pu être supprimé.'));
      },
    });
  }

  private persistElementGeometry(element: StudioElement): void {
    this.isSaving.set(true);
    this.saveStatus.set('idle');

    this.societeService
      .updatePlanMasseElement(element.id, {
        type: element.type,
        nom: element.nom || undefined,
        description: element.description,
        geometryJson: JSON.stringify(element.geometry),
        styleJson: element.styleJson,
        visible: element.visible,
        zIndex: element.zIndex,
        planMasseId: element.planMasseId,
      })
      .subscribe({
        next: (response) => {
          this.isSaving.set(false);
          if (response.data) this.selectedElement.set(this.mapElement(response.data));
          this.saveStatus.set('saved');
          this.isDirty.set(false);
          this.markSaved();
          this.syncPlanSnapshot();
        },
        error: (error) => {
          this.isSaving.set(false);
          this.saveStatus.set('error');
          this.toast.error('Enregistrement impossible', this.apiErrorMessage(error, 'La position n’a pas pu être enregistrée.'));
        },
      });
  }

  private persistLotGeometry(
    lot: StudioLot,
    successTitle = 'Géométrie enregistrée',
    successMessage = `${lot.numeroLot} a été repositionné.`,
  ): void {
    if (lot.geometry.length < 3) {
      this.toast.warning('Contour incomplet', 'La géométrie doit contenir au moins trois sommets.');
      return;
    }

    this.isSaving.set(true);
    this.saveStatus.set('idle');

    const geometryJson = JSON.stringify({ type: 'POLYGON', points: lot.geometry });

    this.societeService.updateLotProgrammeGeometry(lot.id, geometryJson).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        if (response.data) {
          const mapped = this.mapBackendLot(response.data);
          this.lots.update((items) => items.map((item) => (item.id === mapped.id ? mapped : item)));
          this.selectedLot.set(mapped);
        }
        this.saveStatus.set('saved');
        this.isDirty.set(false);
        this.markSaved();
        this.toast.success(successTitle, successMessage);
        this.syncPlanSnapshot();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Géométrie non enregistrée', this.apiErrorMessage(error, 'La forme du lot n’a pas pu être enregistrée.'));
      },
    });
  }

  private persistLot(lot: StudioLot, successTitle: string, successMessage: string): void {
    const programme = this.programme();
    if (!programme) return;

    const request: LotProgrammeRequestBackend = {
      numeroLot: this.stripLotPrefix(lot.numeroLot),
      numeroIlot: lot.numeroIlot,
      numeroIlotLotissement: lot.numeroIlotLotissement,
      reference: lot.reference || undefined,
      superficie: lot.superficie,
      prix: lot.prix,
      facade: lot.facade,
      profondeur: lot.profondeur,
      statut: this.toBackendStatus(lot.statut),
      programmeId: programme.id,
      geometryJson: lot.geometry.length >= 3 ? JSON.stringify({ type: 'POLYGON', points: lot.geometry }) : undefined,
    };

    this.isSaving.set(true);
    this.saveStatus.set('idle');

    this.societeService.updateLotProgramme(lot.id, request).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        if (response.data) {
          const mapped = this.mapBackendLot(response.data);
          this.lots.update((items) => items.map((item) => (item.id === mapped.id ? mapped : item)));
          this.selectedLot.set(mapped);
        }
        this.saveStatus.set('saved');
        this.isDirty.set(false);
        this.markSaved();
        this.toast.success(successTitle, successMessage);
        this.syncPlanSnapshot();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.toast.error('Enregistrement impossible', this.apiErrorMessage(error, 'La modification n’a pas pu être enregistrée.'));
      },
    });
  }

  private ensurePlanMasse() {
    return this.societeService.upsertPlanMasse(this.planRequest());
  }

  savePlan(): void {
    const programme = this.programme();
    if (!programme) return;

    this.isSaving.set(true);
    this.saveStatus.set('idle');

    this.societeService.upsertPlanMasse(this.planRequest()).pipe(
      switchMap((response) => {
        const plan = response.data;
        if (!plan) throw new Error('Le backend n’a pas renvoyé le Plan de masse.');

        this.planMasse.set(plan);

        const lotRequests = this.lots()
          .filter((lot) => lot.geometry.length >= 3)
          .map((lot) => this.societeService.updateLotProgrammeGeometry(
            lot.id,
            JSON.stringify({ type: 'POLYGON', points: lot.geometry }),
          ));

        const elementRequests = this.elements().map((element) => this.societeService.updatePlanMasseElement(
          element.id,
          {
            type: element.type,
            nom: element.nom || undefined,
            description: element.description,
            geometryJson: JSON.stringify(element.geometry),
            styleJson: element.styleJson,
            visible: element.visible,
            zIndex: element.zIndex,
            planMasseId: plan.id,
          },
        ));

        return forkJoin({
          plan: of(plan),
          lots: lotRequests.length ? forkJoin(lotRequests) : of([]),
          elements: elementRequests.length ? forkJoin(elementRequests) : of([]),
        });
      }),
    ).subscribe({
      next: ({ plan }) => {
        this.isSaving.set(false);
        this.planMasse.set(plan);
        this.saveStatus.set('saved');
        this.markSaved();
        this.isDirty.set(false);
        this.toast.success('Plan enregistré', 'Le Plan de masse, les lots positionnés et les aménagements sont enregistrés côté serveur.');
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.isDirty.set(true);
        this.toast.error('Sauvegarde impossible', this.apiErrorMessage(error, 'Le Plan de masse n’a pas pu être enregistré complètement.'));
      },
    });
  }

  /**
   * Regroupe les mises à jour de l'aperçu du plan : chaque micro-modification (sommet, rotation…)
   * déclenchait un PUT complet, devenu coûteux avec un fond importé. Une demande explicite
   * (showToast) ou la fermeture de l'écran envoie immédiatement.
   */
  private syncPlanSnapshot(showToast = false): void {
    if (!this.programme()) return;
    if (showToast) {
      this.flushSnapshot(true);
      return;
    }
    this.isDirty.set(true);
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => this.flushSnapshot(false), 1200);
  }

  private flushSnapshot(showToast: boolean): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (!this.programme()) return;
    this.isSaving.set(true);
    const request = this.planRequest();
    const existing = this.planMasse();
    const call = existing
      ? this.societeService.updatePlanMasse(existing.id, request)
      : this.societeService.upsertPlanMasse(request);
    call.subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.planMasse.set(response.data ?? existing ?? null);
        this.saveStatus.set('saved');
        this.markSaved();
        this.isDirty.set(false);
        if (showToast) this.toast.success('Plan enregistré', 'Le Plan de masse est enregistré côté serveur.');
      },
      error: (error) => {
        this.isSaving.set(false);
        this.saveStatus.set('error');
        this.isDirty.set(true);
        this.toast.error('Sauvegarde impossible', this.apiErrorMessage(error, 'Le Plan de masse n’a pas pu être sauvegardé.'));
      },
    });
  }

  ngOnDestroy(): void {
    if (this.snapshotTimer) this.flushSnapshot(false);
  }

  // --- Import d'un plan SVG ---------------------------------------------------

  openImport(): void {
    this.isImportOpen.set(true);
  }

  onSvgImported(result: SvgImportResult): void {
    const programme = this.programme();
    this.isImportOpen.set(false);
    this.backgroundMarkup.set(result.backgroundMarkup);
    this.layerBackground.set(true);
    this.pixelsPerMeter.set(result.pixelsPerMeter);
    this.snapToGrid.set(false); // les sommets importés ne sont pas sur la grille
    // L'annulation locale ne peut pas défaire des lots déjà créés côté serveur : on repart d'un historique vide.
    this.historyStack.set([]);
    this.redoStack.set([]);
    this.selectedLot.set(null);
    this.selectedElement.set(null);
    this.resetView();
    if (!programme) return;

    this.isSaving.set(true);
    this.societeService.getLotsByProgrammeStrict(programme.id).subscribe({
      next: (lots) => {
        this.lots.set(lots.map((lot) => this.mapLot(lot)));
        this.flushSnapshot(true);
        const detail = `${result.created} lot(s) créé(s), ${result.updated} mis à jour.`;
        if (result.failed > 0) {
          this.toast.warning('Import partiel', `${detail} ${result.failed} échec(s) : ${result.firstError ?? 'erreur inconnue'}`);
        } else {
          this.toast.success('Plan importé', `${detail} Renseignez ensuite les prix si nécessaire.`);
        }
      },
      error: (error) => {
        this.isSaving.set(false);
        this.toast.error('Actualisation impossible', this.apiErrorMessage(error, 'Les lots sont importés mais la liste n’a pas pu être rechargée. Rechargez le Studio.'));
      },
    });
  }

  removeBackground(): void {
    if (!window.confirm('Retirer le fond importé ? Les lots et leurs formes sont conservés.')) return;
    this.backgroundMarkup.set('');
    this.syncPlanSnapshot();
  }

  onBackgroundOpacity(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.backgroundOpacity.set(this.clamp(value, 0.1, 1));
    this.syncPlanSnapshot();
  }

  /** Relit le fond et l'échelle depuis l'aperçu enregistré (assaini de nouveau à la lecture). */
  private restoreFromSnapshot(svg: string | undefined): void {
    if (!svg || !svg.includes('fond-importe')) {
      const ppmOnly = /data-px-per-m="([\d.]+)"/.exec(svg ?? '');
      if (ppmOnly && Number(ppmOnly[1]) > 0) this.pixelsPerMeter.set(Number(ppmOnly[1]));
      return;
    }
    const result = sanitizeSvgText(svg);
    if (!result.root) return;
    const ppm = parseFloat(result.root.getAttribute('data-px-per-m') ?? '');
    if (Number.isFinite(ppm) && ppm > 0) this.pixelsPerMeter.set(ppm);
    const group = result.root.querySelector('[id="fond-importe"]');
    if (!group) return;
    const opacity = parseFloat(group.getAttribute('opacity') ?? '');
    if (Number.isFinite(opacity)) this.backgroundOpacity.set(this.clamp(opacity, 0.1, 1));
    const serializer = new XMLSerializer();
    const markup = Array.from(group.childNodes)
      .map((node) => serializer.serializeToString(node))
      .join('')
      .replace(/\sxmlns(?::\w+)?="[^"]*"/g, '');
    this.backgroundMarkup.set(markup);
  }

  private polygonAreaPx(points: GeometryPoint[]): number {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  }

  private planRequest(): PlanMasseRequestBackend {
    const programme = this.programme();
    if (!programme) throw new Error('Programme indisponible');
    return {
      programmeId: programme.id,
      version: `auto-${new Date().toISOString().slice(0, 19)}`,
      description: `Plan de masse interactif de ${programme.nom}`,
      plan: this.buildSvgSnapshot(),
    };
  }

  private buildSvgSnapshot(): string {
    const lots = this.lots()
      .filter((lot) => lot.geometry.length >= 3)
      .map(
        (lot) =>
          `<polygon points="${this.pointsToSvgInternal(lot.geometry)}" data-lot-id="${lot.id}" fill="${this.getLotFillColor(lot)}" fill-opacity="0.42" stroke="${this.getLotStrokeColor(lot)}" stroke-width="2"/>`,
      )
      .join('');
    const elements = this.elements().map((element) => this.elementToSvg(element)).join('');
    const background = this.backgroundMarkup()
      ? `<g id="fond-importe" opacity="${this.backgroundOpacity()}">${this.backgroundMarkup()}</g>`
      : '';
    const labels = this.lots()
      .filter((lot) => lot.geometry.length >= 3)
      .map((lot) => {
        const c = this.getLotCenter(lot);
        const size = this.clamp(Math.sqrt(this.polygonAreaPx(lot.geometry)) * 0.28, 6, 14);
        const text = lot.numeroLot.replace(/^Lot N° /, '').replace(/[<>&"']/g, '');
        return `<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${size.toFixed(1)}" font-weight="700" fill="#1A2B4C" pointer-events="none">${text}</text>`;
      })
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.canvasWidth} ${this.canvasHeight}" data-px-per-m="${this.pixelsPerMeter()}"><rect width="100%" height="100%" fill="#f7f5ef"/>${background}${elements}${lots}${labels}</svg>`;
  }

  private elementToSvg(element: StudioElement): string {
    if (element.geometry.type === 'LINE') {
      return `<polyline points="${this.pointsToSvgInternal(element.geometry.points)}" fill="none" stroke="${this.elementStroke(element.type)}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (element.geometry.type === 'POLYGON') {
      return `<polygon points="${this.pointsToSvgInternal(element.geometry.points)}" fill="${this.elementFill(element.type)}" fill-opacity="0.52" stroke="${this.elementStroke(element.type)}" stroke-width="2"/>`;
    }
    return `<circle cx="${element.geometry.x}" cy="${element.geometry.y}" r="10" fill="${this.elementStroke(element.type)}"/>`;
  }

  private pointsToSvgInternal(points: GeometryPoint[]): string {
    return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  toggleLayer(layer: 'lots' | 'roads' | 'green' | 'pois'): void {
    if (layer === 'lots') this.layerLots.update((value) => !value);
    if (layer === 'roads') this.layerRoads.update((value) => !value);
    if (layer === 'green') this.layerGreen.update((value) => !value);
    if (layer === 'pois') this.layerPois.update((value) => !value);
  }

  undo(): void {
    const history = this.historyStack();
    if (!history.length) return;
    const previous = history[history.length - 1];
    this.redoStack.update((redo) => [...redo, this.snapshot()]);
    this.historyStack.update((items) => items.slice(0, -1));
    this.restore(previous);
  }

  redo(): void {
    const redo = this.redoStack();
    if (!redo.length) return;
    const next = redo[redo.length - 1];
    this.historyStack.update((history) => [...history, this.snapshot()]);
    this.redoStack.update((items) => items.slice(0, -1));
    this.restore(next);
  }

  private pushHistory(): void {
    this.isDirty.set(true);
    this.saveStatus.set('idle');
    this.historyStack.update((items) => [...items.slice(-39), this.snapshot()]);
    this.redoStack.set([]);
  }

  private snapshot(): EditorSnapshot {
    return JSON.parse(JSON.stringify({ lots: this.lots(), elements: this.elements() }));
  }

  private restore(snapshot: EditorSnapshot): void {
    this.isDirty.set(true);
    this.saveStatus.set('idle');
    this.lots.set(snapshot.lots);
    this.elements.set(snapshot.elements);
    this.selectedLot.set(null);
    this.selectedElement.set(null);
  }

  getLotFillColor(lot: StudioLot): string {
    switch (lot.statut) {
      case 'DISPONIBLE':
        return '#4A7A56';
      case 'RESERVE':
        return '#E5A96A';
      case 'VENDU':
        return '#C64B4B';
      default:
        return '#73808F';
    }
  }

  getLotStrokeColor(lot: StudioLot): string {
    return this.selectedLot()?.id === lot.id ? '#1A2B4C' : '#FFFFFF';
  }

  getElementPath(element: StudioElement): string {
    if (element.geometry.type === 'LINE' || element.geometry.type === 'POLYGON') {
      return this.pointsToSvgInternal(element.geometry.points);
    }
    return '';
  }

  pointsToSvg(points: GeometryPoint[]): string {
    return this.pointsToSvgInternal(points);
  }

  getLotCenter(lot: StudioLot): GeometryPoint {
    if (!lot.geometry.length) return { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };
    return {
      x: lot.geometry.reduce((sum, point) => sum + point.x, 0) / lot.geometry.length,
      y: lot.geometry.reduce((sum, point) => sum + point.y, 0) / lot.geometry.length,
    };
  }

  getElementIcon(element: StudioElement): string {
    const icons: Partial<Record<PlanElementTypeBackend, string>> = {
      MOSQUEE: '☪',
      EGLISE: '✝',
      ECOLE: '🎓',
      MARCHE: '⌂',
      COMMERCE: '▦',
      EQUIPEMENT_PUBLIC: '⚕',
      AUTRE: '●',
    };
    return icons[element.type] ?? '●';
  }

  getElementCenter(element: StudioElement): GeometryPoint {
    if (element.geometry.type === 'POINT') return { x: element.geometry.x, y: element.geometry.y };
    const points = element.geometry.points;
    if (!points.length) return { x: 0, y: 0 };
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }

  elementStroke(type: PlanElementTypeBackend): string {
    if (type === 'ROUTE_GOUDRONNEE') return '#334155';
    if (type === 'ROUTE_NON_GOUDRONNEE') return '#A9773F';
    if (type === 'ESPACE_VERT') return '#4A7A56';
    return '#1A2B4C';
  }

  elementFill(type: PlanElementTypeBackend): string {
    return type === 'ESPACE_VERT' ? '#A9C59A' : '#E6E1D7';
  }

  getElementTypeOptions(): Array<{ value: PlanElementTypeBackend; label: string }> {
    return [
      { value: 'ROUTE_GOUDRONNEE', label: 'Route goudronnée' },
      { value: 'ROUTE_NON_GOUDRONNEE', label: 'Route non goudronnée' },
      { value: 'MOSQUEE', label: 'Mosquée' },
      { value: 'EGLISE', label: 'Église' },
      { value: 'ECOLE', label: 'École' },
      { value: 'ESPACE_VERT', label: 'Espace vert' },
      { value: 'MARCHE', label: 'Marché' },
      { value: 'COMMERCE', label: 'Commerce' },
      { value: 'EQUIPEMENT_PUBLIC', label: 'Équipement public' },
      { value: 'AUTRE', label: 'Autre point d’intérêt' },
    ];
  }

  elementTypeLabel(type: PlanElementTypeBackend): string {
    return this.getElementTypeOptions().find((item) => item.value === type)?.label ?? 'Élément';
  }

  statusLabel(statut: LotStatutType): string {
    return {
      DISPONIBLE: 'Disponible',
      RESERVE: 'Réservé',
      VENDU: 'Vendu',
      INDISPONIBLE_LITIGE: 'Indisponible',
    }[statut];
  }

  private mapLot(lot: import('../../core/models/societe.models').ParcelleLot): StudioLot {
    const parsed = this.parseGeometry(lot.geometryJson);
    return {
      id: lot.id,
      numeroLot: lot.designation,
      numeroIlot: lot.numeroIlot ?? '',
      numeroIlotLotissement: lot.numeroIlotLotissement,
      reference: lot.titreFoncier || '',
      superficie: lot.superficieM2,
      prix: lot.prixFcfa,
      facade: lot.facade,
      profondeur: lot.profondeur,
      statut: lot.statut,
      geometry: parsed.type === 'POLYGON' ? parsed.points : [],
    };
  }

  private mapBackendLot(lot: LotProgrammeBackend): StudioLot {
    const parsed = this.parseGeometry(lot.geometryJson);
    return {
      id: lot.id,
      numeroLot: lot.numeroLot.startsWith('Lot') ? lot.numeroLot : `Lot N° ${lot.numeroLot}`,
      numeroIlot: lot.numeroIlot ?? '',
      numeroIlotLotissement: lot.numeroIlotLotissement,
      reference: lot.reference,
      superficie: lot.superficie,
      prix: lot.prix,
      facade: lot.facade,
      profondeur: lot.profondeur,
      statut:
        lot.statut === 'RESERVER'
          ? 'RESERVE'
          : lot.statut === 'VENDUE'
            ? 'VENDU'
            : lot.statut === 'INDISPONIBLE'
              ? 'INDISPONIBLE_LITIGE'
              : 'DISPONIBLE',
      geometry: parsed.type === 'POLYGON' ? parsed.points : [],
    };
  }

  private mapElement(element: PlanMasseElementBackend): StudioElement {
    return {
      id: element.id,
      type: element.type,
      nom: element.nom || this.elementTypeLabel(element.type),
      description: element.description,
      geometry: this.parseGeometry(element.geometryJson),
      styleJson: element.styleJson,
      visible: element.visible,
      zIndex: element.zIndex,
      planMasseId: element.planMasseId,
    };
  }

  private parseGeometry(value?: string): StudioGeometry {
    if (!value) return { type: 'POINT', x: 0, y: 0 };
    try {
      const parsed = JSON.parse(value) as StudioGeometry;
      if (parsed?.type === 'POLYGON' && Array.isArray(parsed.points)) {
        return { type: 'POLYGON', points: parsed.points.filter(this.isPoint) };
      }
      if (parsed?.type === 'LINE' && Array.isArray(parsed.points)) {
        return { type: 'LINE', points: parsed.points.filter(this.isPoint) };
      }
      if (parsed?.type === 'POINT' && this.isNumber(parsed.x) && this.isNumber(parsed.y)) {
        return { type: 'POINT', x: parsed.x, y: parsed.y };
      }
    } catch {
      // Geometry invalid: keep it invisible rather than invent a position.
    }
    return { type: 'POINT', x: 0, y: 0 };
  }

  private isPoint(value: unknown): value is GeometryPoint {
    const point = value as GeometryPoint;
    return !!point && typeof point.x === 'number' && typeof point.y === 'number';
  }

  private isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private refreshSelectedLot(id: number): void {
    this.selectedLot.set(this.lots().find((lot) => lot.id === id) ?? null);
  }

  private refreshSelectedElement(id: number): void {
    this.selectedElement.set(this.elements().find((element) => element.id === id) ?? null);
  }

  private keepLotInsideCanvas(id: number): void {
    this.lots.update((items) =>
      items.map((lot) => {
        if (lot.id !== id || lot.geometry.length < 3) return lot;
        const minX = Math.min(...lot.geometry.map((point) => point.x));
        const maxX = Math.max(...lot.geometry.map((point) => point.x));
        const minY = Math.min(...lot.geometry.map((point) => point.y));
        const maxY = Math.max(...lot.geometry.map((point) => point.y));
        const dx = minX < 8 ? 8 - minX : maxX > this.canvasWidth - 8 ? this.canvasWidth - 8 - maxX : 0;
        const dy = minY < 8 ? 8 - minY : maxY > this.canvasHeight - 8 ? this.canvasHeight - 8 - maxY : 0;
        return dx === 0 && dy === 0
          ? lot
          : { ...lot, geometry: lot.geometry.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
      }),
    );
  }

  private translateGeometry(geometry: StudioGeometry, dx: number, dy: number): StudioGeometry {
    if (geometry.type === 'POINT') return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
    return { ...geometry, points: geometry.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  }

  private nextLotNumber(): string {
    const numbers = this.lots()
      .map((lot) => Number((lot.numeroLot.match(/(\d+)$/) ?? [])[1]))
      .filter((number) => Number.isFinite(number));
    return `Lot N° ${(numbers.length ? Math.max(...numbers) + 1 : 1)}`;
  }

  private stripLotPrefix(value: string): string {
    return value.trim().replace(/^Lot\s*N[°º]?\s*/i, '');
  }

  private toBackendStatus(status: LotStatutType): LotProgrammeRequestBackend['statut'] {
    return status === 'RESERVE'
      ? 'RESERVER'
      : status === 'VENDU'
        ? 'VENDUE'
        : status === 'INDISPONIBLE_LITIGE'
          ? 'INDISPONIBLE'
          : 'DISPONIBLE';
  }

  private getSuggestedDropPoint(lot: StudioLot): GeometryPoint {
    if (lot.geometry.length >= 3) return this.getLotCenter(lot);
    const index = Math.max(0, this.lots().findIndex((item) => item.id === lot.id));
    const col = index % 4;
    const row = Math.floor(index / 4);
    return {
      x: 190 + col * 245,
      y: 180 + row * 180,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private findNearestSegment(points: GeometryPoint[], target: GeometryPoint, closed = true): number {
    if (points.length < 2) return -1;
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    const segmentCount = closed ? points.length : points.length - 1;
    for (let index = 0; index < segmentCount; index++) {
      const nextIndex = index + 1 < points.length ? index + 1 : 0;
      const distance = this.distanceToSegment(target, points[index], points[nextIndex]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestDistance <= 28 ? bestIndex : -1;
  }

  private distanceToSegment(p: GeometryPoint, a: GeometryPoint, b: GeometryPoint): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    const x = a.x + t * dx;
    const y = a.y + t * dy;
    return Math.hypot(p.x - x, p.y - y);
  }

  private snapPoint(point: GeometryPoint): GeometryPoint {
    if (!this.snapToGrid()) return point;
    const size = this.snapStep();
    return {
      x: this.clamp(Math.round(point.x / size) * size, 0, this.canvasWidth),
      y: this.clamp(Math.round(point.y / size) * size, 0, this.canvasHeight),
    };
  }

  private editorPoint(event: PointerEvent | MouseEvent | DragEvent): GeometryPoint {
    return this.snapPoint(this.toCanvasPoint(event));
  }

  private toCanvasPoint(event: PointerEvent | MouseEvent | DragEvent): GeometryPoint {
    const svg = this.planCanvas?.nativeElement;
    if (!svg) return { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };
    const rect = svg.getBoundingClientRect();
    const ratioX = (event.clientX - rect.left) / rect.width;
    const ratioY = (event.clientY - rect.top) / rect.height;
    const x = this.viewBoxX() + ratioX * this.getViewBoxWidth();
    const y = this.viewBoxY() + ratioY * this.getViewBoxHeight();
    return {
      x: this.clamp(x, 0, this.canvasWidth),
      y: this.clamp(y, 0, this.canvasHeight),
    };
  }

  private setZoomAroundCenter(nextZoom: number): void {
    const currentCenterX = this.viewBoxX() + this.getViewBoxWidth() / 2;
    const currentCenterY = this.viewBoxY() + this.getViewBoxHeight() / 2;
    this.zoom.set(this.clamp(nextZoom, 0.5, 2.5));
    this.setViewBox(currentCenterX - this.getViewBoxWidth() / 2, currentCenterY - this.getViewBoxHeight() / 2);
  }

  private setViewBox(x: number, y: number): void {
    const maxX = Math.max(0, this.canvasWidth - this.getViewBoxWidth());
    const maxY = Math.max(0, this.canvasHeight - this.getViewBoxHeight());
    this.viewBoxX.set(this.clamp(x, 0, maxX));
    this.viewBoxY.set(this.clamp(y, 0, maxY));
  }

  private alignLotGeometry(points: GeometryPoint[], lotId: number): GeometryPoint[] {
    let geometry = points.map((point) => this.snapToGrid() ? this.snapPoint(point) : point);
    if (geometry.length < 3) return geometry;

    const currentCenter = {
      x: geometry.reduce((sum, point) => sum + point.x, 0) / geometry.length,
      y: geometry.reduce((sum, point) => sum + point.y, 0) / geometry.length,
    };
    const threshold = 10;
    let dx = 0;
    let dy = 0;

    for (const other of this.lots()) {
      if (other.id === lotId || other.geometry.length < 3) continue;
      const otherCenter = this.getLotCenter(other);
      if (Math.abs(currentCenter.x - otherCenter.x) <= threshold) dx = otherCenter.x - currentCenter.x;
      if (Math.abs(currentCenter.y - otherCenter.y) <= threshold) dy = otherCenter.y - currentCenter.y;
    }

    geometry = geometry.map((point) => ({ x: point.x + dx, y: point.y + dy }));
    const minX = Math.min(...geometry.map((point) => point.x));
    const maxX = Math.max(...geometry.map((point) => point.x));
    const minY = Math.min(...geometry.map((point) => point.y));
    const maxY = Math.max(...geometry.map((point) => point.y));
    const edgeDx = minX < 8 ? 8 - minX : maxX > this.canvasWidth - 8 ? this.canvasWidth - 8 - maxX : 0;
    const edgeDy = minY < 8 ? 8 - minY : maxY > this.canvasHeight - 8 ? this.canvasHeight - 8 - maxY : 0;
    return geometry.map((point) => ({ x: point.x + edgeDx, y: point.y + edgeDy }));
  }

  private nextLotNumbers(count: number): string[] {
    const existing = new Set(this.lots().map((lot) => this.stripLotPrefix(lot.numeroLot)));
    const values: string[] = [];
    let candidate = 1;
    // Recalculate from numeric suffixes without depending on Number prototype.
    const numeric = this.lots()
      .map((lot) => Number((lot.numeroLot.match(/(\d+)$/) ?? [])[1]))
      .filter((number) => Number.isFinite(number));
    candidate = numeric.length ? Math.max(...numeric) + 1 : 1;
    while (values.length < count) {
      const value = String(candidate++);
      if (!existing.has(value) && !values.includes(value)) values.push(value);
    }
    return values.map((value) => `Lot N° ${value}`);
  }

  private groupLotsByAxis(lots: StudioLot[], axis: 'X' | 'Y'): StudioLot[][] {
    const sorted = [...lots].sort((a, b) => (axis === 'X' ? this.getLotCenter(a).x - this.getLotCenter(b).x : this.getLotCenter(a).y - this.getLotCenter(b).y));
    const groups: StudioLot[][] = [];
    const tolerance = 75;
    for (const lot of sorted) {
      const last = groups[groups.length - 1];
      if (!last) { groups.push([lot]); continue; }
      const lastValue = axis === 'X' ? this.getLotCenter(last[last.length - 1]).x : this.getLotCenter(last[last.length - 1]).y;
      const value = axis === 'X' ? this.getLotCenter(lot).x : this.getLotCenter(lot).y;
      if (Math.abs(value - lastValue) <= tolerance) last.push(lot);
      else groups.push([lot]);
    }
    return groups;
  }

  private minLotX(lots: StudioLot[]): number { return Math.min(...lots.flatMap((lot) => lot.geometry.map((point) => point.x))); }
  private maxLotX(lots: StudioLot[]): number { return Math.max(...lots.flatMap((lot) => lot.geometry.map((point) => point.x))); }
  private minLotY(lots: StudioLot[]): number { return Math.min(...lots.flatMap((lot) => lot.geometry.map((point) => point.y))); }
  private maxLotY(lots: StudioLot[]): number { return Math.max(...lots.flatMap((lot) => lot.geometry.map((point) => point.y))); }

  private hasSimilarRoad(candidate: StudioGeometry): boolean {
    if (candidate.type !== 'LINE' || candidate.points.length < 2) return false;
    const a = candidate.points[0];
    const b = candidate.points[candidate.points.length - 1];
    return this.elements().some((element) => {
      if (!['ROUTE_GOUDRONNEE', 'ROUTE_NON_GOUDRONNEE'].includes(element.type) || element.geometry.type !== 'LINE' || element.geometry.points.length < 2) return false;
      const c = element.geometry.points[0];
      const d = element.geometry.points[element.geometry.points.length - 1];
      return Math.abs(a.x - c.x) < 12 && Math.abs(a.y - c.y) < 12 && Math.abs(b.x - d.x) < 12 && Math.abs(b.y - d.y) < 12;
    });
  }

  private markSaved(): void {
    this.lastSavedLabel.set(
      new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }

  lotFieldError(field: 'numeroLot' | 'numeroIlot' | 'superficie' | 'prix'): string {
    const control = this.lotForm.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required')) return 'Champ obligatoire.';
    if (control.hasError('maxlength')) return 'Valeur trop longue.';
    if (control.hasError('min')) return 'La valeur doit être supérieure à zéro.';
    return 'Valeur invalide.';
  }

  private apiErrorMessage(error: unknown, fallback: string): string {
    const item = error as {
      error?: {
        message?: string;
        data?: { message?: string };
        errors?: Record<string, string>;
      };
      message?: string;
      status?: number;
    };
    const validationErrors = item?.error?.errors;
    const validationMessage = validationErrors && Object.keys(validationErrors).length
      ? Object.entries(validationErrors).map(([field, message]) => `${field}: ${message}`).join(' · ')
      : '';

    const statusMessages: Record<number, string> = {
      400: 'La demande est invalide. Vérifiez les champs saisis.',
      401: 'Votre session a expiré. Reconnectez-vous puis réessayez.',
      403: 'Vous n’avez pas les droits nécessaires pour cette action.',
      404: 'La ressource demandée est introuvable.',
      409: 'Cette donnée existe déjà. Vérifiez les numéros et références.',
      500: 'Le serveur a rencontré une erreur. Vérifiez les logs Spring Boot.',
    };

    return validationMessage || item?.error?.message || item?.error?.data?.message || statusMessages[item?.status ?? 0] || item?.message || fallback;
  }
}
