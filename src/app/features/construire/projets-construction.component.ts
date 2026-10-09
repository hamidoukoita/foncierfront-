import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SocieteService } from '../../core/services/societe.service';
import { AuthService } from '../../core/services/auth.service';
import {
  EtatEtudeConstruction,
  ModelMaison,
  ProjetConstruction,
} from '../../core/models/societe.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { MatIcon } from '@angular/material/icon';

type ConstructionFilter = 'TOUS' | 'EN_ETUDE' | 'ACCEPTER' | 'REFUSER';
type ViewMode = 'PROJETS' | 'MODELES';

const ETAPES = [
  'Dossier reçu',
  'Étude technique',
  'Devis transmis',
  'Validation acquéreur',
  'Préparation chantier',
  'Travaux en cours',
  'Réception',
] as const;

@Component({
  selector: 'app-projets-construction',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, StatusBadgeComponent, MatIcon],
  templateUrl: './projets-construction.component.html',
  styleUrl: './projets-construction.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjetsConstructionComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly viewMode = signal<ViewMode>('PROJETS');
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly currentFilter = signal<ConstructionFilter>('TOUS');
  readonly searchTerm = signal('');

  readonly projets = this.societeService.projetsConstruction;
  readonly modeles = signal<ModelMaison[]>([]);

  readonly isModelModalOpen = signal(false);
  readonly isProgressModalOpen = signal(false);
  readonly isDetailModalOpen = signal(false);
  readonly isSaving = signal(false);
  readonly activeProject = signal<ProjetConstruction | null>(null);
  readonly activeModel = signal<ModelMaison | null>(null);
  readonly compatibleModels = signal<ModelMaison[]>([]);
  readonly etapesDisponibles = ETAPES;

  readonly selectedImageFile = signal<File | null>(null);
  readonly selectedPlanFile = signal<File | null>(null);

  readonly modelForm = this.fb.nonNullable.group({
    libeller: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    surfaceTerrainMin: [null as number | null],
    surfaceTerrainMax: [null as number | null],
    surfaceConstruite: [null as number | null],
    nombreChambres: [null as number | null],
    nombreSallesBain: [null as number | null],
    typeTerrainCompatible: [''],
  });

  readonly progressForm = this.fb.nonNullable.group({
    progression: [0, [Validators.min(0), Validators.max(100)]],
    etapeAvancement: ['Dossier reçu'],
    commentaireAvancement: [''],
    modelMaisonId: ['' as string | number],
  });

  ngOnInit(): void {
    this.reloadAll();
  }

  /** Chargement automatique (pas de bouton Actualiser) */
  private reloadAll(): void {
    this.loadProjects();
    this.loadModels();
  }

  private loadProjects(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.societeService.getProjetsConstruction().subscribe({
      next: () => this.isLoading.set(false),
      error: (e) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.extractError(e, 'Impossible de charger les projets.'));
      },
    });
  }

  private loadModels(): void {
    const societeId =
      this.societeService.getSocieteId() ?? this.authService.currentUser()?.societeId;
    this.societeService.getModelesMaison(societeId ?? undefined).subscribe({
      next: (items) => this.modeles.set(items ?? []),
      error: (e) =>
        this.errorMessage.set(this.extractError(e, 'Impossible de charger les modèles.')),
    });
  }

  readonly filteredProjets = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const f = this.currentFilter();
    return this.projets().filter((p) => {
      if (f !== 'TOUS' && p.etatEtude !== f) return false;
      if (!q) return true;
      return [
        p.numeroDossier,
        p.modeleVilla,
        p.prospectNom,
        p.prospectTelephone,
        p.localisationTerrain,
        p.titreFoncierNumero,
        p.etapeAvancement,
        p.typeTerrain,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  });

  readonly filteredModeles = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.modeles();
    return this.modeles().filter((m) =>
      [m.libeller, m.description, m.typeTerrainCompatible]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  });

  readonly countTous = computed(() => this.projets().length);
  readonly countEnEtude = computed(
    () => this.projets().filter((p) => p.etatEtude === 'EN_ETUDE').length,
  );
  readonly countAcceptes = computed(
    () => this.projets().filter((p) => p.etatEtude === 'ACCEPTER').length,
  );
  readonly countRefuses = computed(
    () => this.projets().filter((p) => p.etatEtude === 'REFUSER').length,
  );

  setFilter(f: ConstructionFilter): void {
    this.currentFilter.set(f);
  }
  setView(m: ViewMode): void {
    this.viewMode.set(m);
    this.searchTerm.set('');
    // Recharge discrètement à chaque changement d'onglet
    if (m === 'PROJETS') this.loadProjects();
    else this.loadModels();
  }

  openCreateModel(): void {
    this.activeModel.set(null);
    this.modelForm.reset({
      libeller: '',
      description: '',
      surfaceTerrainMin: null,
      surfaceTerrainMax: null,
      surfaceConstruite: null,
      nombreChambres: null,
      nombreSallesBain: null,
      typeTerrainCompatible: '',
    });
    this.selectedImageFile.set(null);
    this.selectedPlanFile.set(null);
    this.errorMessage.set('');
    this.isModelModalOpen.set(true);
  }

  openEditModel(model: ModelMaison): void {
    this.activeModel.set(model);
    this.modelForm.reset({
      libeller: model.libeller || '',
      description: model.description || '',
      surfaceTerrainMin: model.surfaceTerrainMin ?? null,
      surfaceTerrainMax: model.surfaceTerrainMax ?? null,
      surfaceConstruite: model.surfaceConstruite ?? null,
      nombreChambres: model.nombreChambres ?? null,
      nombreSallesBain: model.nombreSallesBain ?? null,
      typeTerrainCompatible: model.typeTerrainCompatible || '',
    });
    this.selectedImageFile.set(null);
    this.selectedPlanFile.set(null);
    this.errorMessage.set('');
    this.isModelModalOpen.set(true);
  }

  onImageFile(event: Event): void {
    this.selectedImageFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }
  onPlanFile(event: Event): void {
    this.selectedPlanFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  saveModel(): void {
    if (this.modelForm.invalid) {
      this.modelForm.markAllAsTouched();
      this.errorMessage.set('Le nom du modèle est obligatoire.');
      return;
    }

    const societeId =
      this.societeService.getSocieteId() ?? this.authService.currentUser()?.societeId ?? null;
    if (societeId == null) {
      this.errorMessage.set('Société introuvable dans la session. Reconnectez-vous.');
      return;
    }

    const v = this.modelForm.getRawValue();
    const min = v.surfaceTerrainMin;
    const max = v.surfaceTerrainMax;
    if (min != null && max != null && min > max) {
      this.errorMessage.set('La surface min ne peut pas dépasser la surface max.');
      return;
    }

    const request = {
      libeller: v.libeller.trim(),
      description: v.description.trim() || undefined,
      surfaceTerrainMin: min ?? undefined,
      surfaceTerrainMax: max ?? undefined,
      surfaceConstruite: v.surfaceConstruite ?? undefined,
      nombreChambres: v.nombreChambres ?? undefined,
      nombreSallesBain: v.nombreSallesBain ?? undefined,
      typeTerrainCompatible: v.typeTerrainCompatible.trim() || undefined,
      societeId,
    };

    this.isSaving.set(true);
    this.errorMessage.set('');
    const editing = this.activeModel();

    const afterSave = (modelId: number) => {
      const img = this.selectedImageFile();
      const plan = this.selectedPlanFile();
      if (!img && !plan) {
        this.finishModelSave(editing ? 'Modèle mis à jour.' : 'Modèle créé avec succès.');
        return;
      }
      const done = () => this.finishModelSave('Modèle et fichiers enregistrés.');
      const uploadPlan = () => {
        if (!plan) {
          done();
          return;
        }
        this.societeService.uploadModelMaisonPlan(modelId, plan).subscribe({
          next: () => done(),
          error: (e) => this.handleSaveError(e),
        });
      };
      if (img) {
        this.societeService.uploadModelMaisonImage(modelId, img).subscribe({
          next: () => uploadPlan(),
          error: (e) => this.handleSaveError(e),
        });
      } else uploadPlan();
    };

    if (editing) {
      this.societeService.updateModelMaison(editing.id, request).subscribe({
        next: (u) => afterSave(u.id),
        error: (e) => this.handleSaveError(e),
      });
    } else {
      this.societeService.createModelMaison(request).subscribe({
        next: (c) => afterSave(c.id),
        error: (e) => this.handleSaveError(e),
      });
    }
  }

  deleteModel(model: ModelMaison): void {
    if (!confirm(`Supprimer « ${model.libeller} » ?`)) return;
    this.isSaving.set(true);
    this.societeService.deleteModelMaison(model.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set('Modèle supprimé.');
        this.loadModels();
        this.clearMessagesSoon();
      },
      error: (e) => this.handleSaveError(e),
    });
  }

  private finishModelSave(message: string): void {
    this.isSaving.set(false);
    this.successMessage.set(message);
    this.isModelModalOpen.set(false);
    this.loadModels();
    this.clearMessagesSoon();
  }

  openProjectDetail(p: ProjetConstruction): void {
    this.activeProject.set(p);
    this.isDetailModalOpen.set(true);
  }

  openProgressModal(p: ProjetConstruction): void {
    this.activeProject.set(p);
    this.progressForm.reset({
      progression: p.progression ?? 0,
      etapeAvancement: p.etapeAvancement ?? 'Dossier reçu',
      commentaireAvancement: p.commentaireAvancement ?? '',
      modelMaisonId: p.modeleMaisonId ?? '',
    });
    this.compatibleModels.set([]);
    this.isProgressModalOpen.set(true);
    this.societeService.getModelesMaisonCompatibles(p.surfaceTerrainM2, p.typeTerrain).subscribe({
      next: (items) => this.compatibleModels.set(items.length ? items : this.modeles()),
      error: () => this.compatibleModels.set(this.modeles()),
    });
  }

  saveProgress(): void {
    const project = this.activeProject();
    if (!project) return;
    const form = this.progressForm.getRawValue();
    const progression = Math.min(100, Math.max(0, Number(form.progression) || 0));
    this.isSaving.set(true);
    this.societeService
      .updateProjetAvancement(project.id, {
        progression,
        etapeAvancement: form.etapeAvancement.trim() || 'Avancement en cours',
        commentaireAvancement: form.commentaireAvancement.trim() || undefined,
      })
      .subscribe({
        next: () => {
          const modelId = form.modelMaisonId ? Number(form.modelMaisonId) : null;
          if (!modelId || modelId === project.modeleMaisonId) {
            this.afterProjectUpdate('Avancement mis à jour.');
            return;
          }
          this.societeService.changerModeleProjet(project.id, modelId).subscribe({
            next: () => this.afterProjectUpdate('Avancement et modèle mis à jour.'),
            error: (e) => this.handleSaveError(e),
          });
        },
        error: (e) => this.handleSaveError(e),
      });
  }

  validerProjet(p: ProjetConstruction): void {
    this.isSaving.set(true);
    this.societeService.validerProjetConstruction(p.id).subscribe({
      next: () => this.afterProjectUpdate('Projet accepté.'),
      error: (e) => this.handleSaveError(e),
    });
  }

  refuserProjet(p: ProjetConstruction): void {
    const motif = prompt('Motif du refus (optionnel) :') ?? undefined;
    this.isSaving.set(true);
    this.societeService.refuserProjetConstruction(p.id, motif || undefined).subscribe({
      next: () => this.afterProjectUpdate('Projet refusé.'),
      error: (e) => this.handleSaveError(e),
    });
  }

  private afterProjectUpdate(message: string): void {
    this.isSaving.set(false);
    this.isProgressModalOpen.set(false);
    this.isDetailModalOpen.set(false);
    this.successMessage.set(message);
    this.loadProjects();
    this.clearMessagesSoon();
  }

  formatPrice(v?: number): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v) + ' F';
  }

  modelSurface(m: ModelMaison): string {
    if (m.surfaceTerrainMin != null && m.surfaceTerrainMax != null)
      return `${m.surfaceTerrainMin}–${m.surfaceTerrainMax} m²`;
    if (m.surfaceTerrainMin != null) return `≥ ${m.surfaceTerrainMin} m²`;
    if (m.surfaceTerrainMax != null) return `≤ ${m.surfaceTerrainMax} m²`;
    return '—';
  }

  imageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return `http://localhost:8080${url}`;
    return url;
  }

  statusLabel(e: EtatEtudeConstruction): string {
    const map: Record<string, string> = {
      EN_ETUDE: 'En étude',
      ACCEPTER: 'Accepté',
      REFUSER: 'Refusé',
      DEVIS_TRANSMIS: 'Devis transmis',
      EN_CHANTIER: 'En chantier',
    };
    return map[e] || e;
  }

  private handleSaveError(error: unknown): void {
    this.isSaving.set(false);
    this.errorMessage.set(this.extractError(error, 'Enregistrement impossible.'));
  }

  private clearMessagesSoon(): void {
    setTimeout(() => {
      this.successMessage.set('');
      this.errorMessage.set('');
    }, 4000);
  }

  private extractError(error: unknown, fallback: string): string {
    const err = error as {
      error?: { message?: string; error?: string; errors?: Array<{ defaultMessage?: string }> };
      message?: string;
      status?: number;
    };
    const body = err?.error;
    if (body?.message) return body.message;
    if (typeof body?.error === 'string' && body.error !== 'Bad Request') return body.error;
    if (Array.isArray(body?.errors) && body!.errors!.length) {
      return (
        body!
          .errors!.map((e) => e.defaultMessage)
          .filter(Boolean)
          .join(' · ') || fallback
      );
    }
    if (err?.message && !err.message.startsWith('Http failure')) return err.message;
    if (err?.status === 403) return 'Accès refusé.';
    if (err?.status === 401) return 'Session expirée — reconnectez-vous.';
    return fallback;
  }
}
