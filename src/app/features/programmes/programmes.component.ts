import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MediaCible } from '../../core/models/media.models';
import { MediaManagerComponent } from '../../shared/components/media-manager/media-manager.component';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { ParcelleLot, Programme } from '../../core/models/societe.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { PlanMasseComponent } from '../../shared/components/plan-masse/plan-masse.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatIcon } from '@angular/material/icon';

type ProgrammeFilter = 'TOUS' | 'PUBLIES' | 'BROUILLONS';

type ProgrammeStatutForm = 'PUBLIE' | 'BROUILLON' | 'ARCHIVE';

@Component({
  selector: 'app-programmes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    StatusBadgeComponent,
    PaginationComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    PlanMasseComponent,
    MediaManagerComponent,
    ConfirmDialogComponent,
    MatIcon
],
  templateUrl: './programmes.component.html',
  styleUrl: './programmes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgrammesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly currentFilter = signal<ProgrammeFilter>('TOUS');
  readonly isCreateModalOpen = signal(false);
  readonly isEditModalOpen = signal(false);
  readonly programmeToEdit = signal<Programme | null>(null);
  readonly currentPage = signal(1);

  readonly selectedProgrammeForPlan = signal<Programme | null>(null);
  readonly selectedProgrammeLots = signal<ParcelleLot[]>([]);
  readonly programmeToDeleteId = signal<number | null>(null);
  /** Programme dont on ouvre les photos / panoramas 360° / visites virtuelles. */
  readonly mediaCible = signal<MediaCible | null>(null);

  openMedias(prog: Programme): void {
    this.mediaCible.set({ kind: 'programme', id: prog.id, titre: prog.nom });
  }
  /** Résumé affiché dans la confirmation de suppression (nom du programme et nombre de lots concernés). */
  readonly deleteSummary = signal<{ nom: string; lots: number } | null>(null);
  readonly isCheckingDelete = signal<boolean>(false);
  readonly deleteMessage = computed(() => {
    const s = this.deleteSummary();
    if (!s) return 'Cette action est irréversible.';
    const lots = s.lots === 0 ? 'aucun lot' : `${s.lots} lot${s.lots > 1 ? 's' : ''}`;
    return `Le programme « ${s.nom} » sera définitivement supprimé, avec son plan de masse (routes, espaces verts, équipements) et ${lots}. Cette action est irréversible.`;
  });
  readonly attachedVisuel3D = signal<string | null>(null);

  readonly programmes = this.societeService.programmes;
  readonly parcelles = this.societeService.parcelles;

  readonly programmeForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.minLength(3)]],
    localisation: ['', [Validators.required, Validators.minLength(2)]],
    superficieTotale: [0, [Validators.required, Validators.min(100)]],
    titreFoncierRef: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.maxLength(500)]],
    eauSomapep: [false],
    electriciteEdm: [false],
    voirieBitumee: [false],
    avancement: [0, [Validators.min(0), Validators.max(100)]],
    statut: ['PUBLIE' as ProgrammeStatutForm],
  });

  ngOnInit(): void {
    this.loadProgrammes();
  }

  loadProgrammes(): void {
    this.isLoading.set(true);
    this.societeService.getProgrammes().subscribe({
      next: () => {
        this.isLoading.set(false);
        const editId = Number(this.route.snapshot.queryParamMap.get('edit'));
        if (editId) {
          const programme = this.programmes().find((item) => item.id === editId);
          if (programme) {
            this.openEditModal(programme);
          }
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        this.toast.error('Chargement impossible', this.apiErrorMessage(error, 'Les programmes n’ont pas pu être récupérés.'));
      },
    });
  }

  readonly filteredProgrammes = computed(() => {
    const filter = this.currentFilter();
    const list = this.programmes();
    if (filter === 'PUBLIES') return list.filter((p) => p.statut === 'PUBLIE');
    if (filter === 'BROUILLONS') return list.filter((p) => p.statut === 'BROUILLON');
    return list;
  });

  readonly countTous = computed(() => this.programmes().length);
  readonly countPublies = computed(() => this.programmes().filter((p) => p.statut === 'PUBLIE').length);
  readonly countBrouillons = computed(() => this.programmes().filter((p) => p.statut === 'BROUILLON').length);
  readonly lotsForSelectedProgramme = computed(() => this.selectedProgrammeLots());

  setFilter(filter: ProgrammeFilter): void {
    this.currentFilter.set(filter);
    this.currentPage.set(1);
  }

  openCreateModal(): void {
    this.submitError.set(null);
    this.isSubmitting.set(false);
    this.attachedVisuel3D.set(null);
    this.programmeForm.reset({
      nom: '',
      localisation: '',
      superficieTotale: 0,
      titreFoncierRef: '',
      description: '',
      eauSomapep: false,
      electriciteEdm: false,
      voirieBitumee: false,
      avancement: 0,
      statut: 'PUBLIE',
    });
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    if (this.isSubmitting()) return;
    this.isCreateModalOpen.set(false);
    this.submitError.set(null);
  }

  openEditModal(prog: Programme): void {
    this.programmeToEdit.set(prog);
    this.submitError.set(null);
    this.programmeForm.reset({
      nom: prog.nom ?? '',
      localisation: prog.localisation ?? '',
      superficieTotale: prog.superficieTotale ?? 0,
      titreFoncierRef: prog.titreFoncierRef ?? '',
      description: prog.description ?? '',
      eauSomapep: prog.eauSomapep ?? false,
      electriciteEdm: prog.electriciteEdm ?? false,
      voirieBitumee: prog.voirieBitumee ?? false,
      avancement: prog.avancement ?? 0,
      statut: prog.statut,
    });
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    if (this.isSubmitting()) return;
    this.isEditModalOpen.set(false);
    this.programmeToEdit.set(null);
    this.submitError.set(null);
  }

  saveEditedProgramme(): void {
    const prog = this.programmeToEdit();
    if (!prog) return;

    if (this.programmeForm.invalid) {
      this.programmeForm.markAllAsTouched();
      this.toast.warning('Formulaire incomplet', 'Veuillez corriger les champs obligatoires avant d’enregistrer.');
      return;
    }

    const value = this.programmeForm.getRawValue();
    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.societeService.updateProgramme(prog.id, {
      nom: value.nom.trim(),
      localisation: value.localisation.trim(),
      titreFoncierRef: value.titreFoncierRef.trim(),
      superficieTotale: value.superficieTotale,
      description: value.description.trim(),
      eauSomapep: value.eauSomapep,
      electriciteEdm: value.electriciteEdm,
      voirieBitumee: value.voirieBitumee,
      avancement: value.avancement,
      statut: value.statut,
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.isEditModalOpen.set(false);
        this.programmeToEdit.set(null);
        this.societeService.getProgrammes().subscribe();
        this.toast.success(
          'Programme modifié',
          response.data
            ? `Les informations de « ${response.data.nom} » ont été mises à jour.`
            : 'Les informations du programme ont été mises à jour.',
        );
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const message = this.apiErrorMessage(error, 'Impossible de modifier le programme pour le moment.');
        this.submitError.set(message);
        this.toast.error('Modification impossible', message);
      },
    });
  }

  suspendreBrouillon(): void {
    this.programmeForm.patchValue({ statut: 'BROUILLON' });
    this.saveProgramme('BROUILLON');
  }

  publierProgramme(): void {
    this.programmeForm.patchValue({ statut: 'PUBLIE' });
    this.saveProgramme('PUBLIE');
  }

  private saveProgramme(statutTarget: 'PUBLIE' | 'BROUILLON'): void {
    this.submitError.set(null);
    if (this.programmeForm.invalid) {
      this.programmeForm.markAllAsTouched();
      this.toast.warning('Formulaire incomplet', 'Veuillez renseigner les champs obligatoires avant de continuer.');
      return;
    }

    const value = this.programmeForm.getRawValue();
    this.isSubmitting.set(true);

    this.societeService.createProgramme({
      nom: value.nom.trim(),
      localisation: value.localisation.trim(),
      titreFoncierRef: value.titreFoncierRef.trim(),
      superficieTotale: value.superficieTotale,
      lotsTotal: 0,
      eauSomapep: value.eauSomapep,
      electriciteEdm: value.electriciteEdm,
      voirieBitumee: value.voirieBitumee,
      avancement: value.avancement,
      description: value.description.trim(),
      statut: statutTarget,
    }).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.societeService.getProgrammes().subscribe();
        const prefix = statutTarget === 'PUBLIE' ? 'Programme publié' : 'Brouillon enregistré';
        const createdId = created.data?.id;
        this.toast.success(
          prefix,
          createdId
            ? `« ${value.nom.trim()} » est enregistré. Le Studio Plan de masse va maintenant permettre de créer ses lots.`
            : `« ${value.nom.trim()} » est enregistré.`,
        );
        if (createdId) {
          this.router.navigate(['/societe/programmes', createdId, 'plan-masse']);
        }
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const message = this.apiErrorMessage(error, 'Impossible d’enregistrer le programme pour le moment.');
        this.submitError.set(message);
        this.toast.error('Enregistrement impossible', message);
      },
    });
  }

  openPlanMasseStudio(prog: Programme): void {
    this.router.navigate(['/societe/programmes', prog.id, 'plan-masse']);
  }

  togglePlanMasse(prog: Programme): void {
    if (this.selectedProgrammeForPlan()?.id === prog.id) {
      this.selectedProgrammeForPlan.set(null);
      this.selectedProgrammeLots.set([]);
      return;
    }

    this.selectedProgrammeForPlan.set(prog);
    this.selectedProgrammeLots.set([]);
    this.societeService.getLotsByProgramme(prog.id).subscribe({
      next: (lots) => {
        this.selectedProgrammeLots.set(lots);
        this.toast.info('Aperçu du plan', `${lots.length} lot(s) chargé(s) depuis le backend.`);
      },
      error: (error) => this.toast.error('Erreur de chargement', this.apiErrorMessage(error, 'Impossible de charger les lots de ce programme.')),
    });
  }

  attachPlanMasseHint(): void {
    this.toast.info('Plan de masse', 'Le plan se construit dans le Studio Plan de masse.');
  }

  attacherVisuel3D(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.obj,.gltf,.glb';
    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.attachedVisuel3D.set(file.name);
      this.toast.info('Visuel 3D sélectionné', 'Le fichier est sélectionné localement. Le backend actuel ne propose pas encore de stockage binaire pour ce visuel.');
    };
    input.click();
  }

  /**
   * Suppression possible pour tout programme, sauf si des lots sont réservés/vendus
   * ou si des réservations actives existent : le backend supprimerait tout en cascade.
   */
  requestDeleteProgramme(prog: Programme): void {
    this.isCheckingDelete.set(true);
    forkJoin({
      lots: this.societeService.getLotsByProgrammeStrict(prog.id),
      reservations: this.societeService.getReservations(),
    }).subscribe({
      next: ({ lots, reservations }) => {
        this.isCheckingDelete.set(false);
        const lotsEngages = lots.filter((l) => l.statut === 'RESERVE' || l.statut === 'VENDU').length;
        const reservationsActives = reservations.filter((r) => r.programmeNom === prog.nom && r.statut !== 'ANNULEE').length;
        if (lotsEngages > 0 || reservationsActives > 0) {
          const motifs = [
            lotsEngages ? `${lotsEngages} lot(s) réservé(s) ou vendu(s)` : '',
            reservationsActives ? `${reservationsActives} réservation(s) active(s)` : '',
          ].filter(Boolean).join(' et ');
          this.toast.warning('Suppression impossible', `« ${prog.nom} » comporte ${motifs}. Traitez ces dossiers avant de supprimer le programme.`);
          return;
        }
        this.deleteSummary.set({ nom: prog.nom, lots: lots.length });
        this.programmeToDeleteId.set(prog.id);
      },
      error: (error) => {
        this.isCheckingDelete.set(false);
        this.toast.error('Vérification impossible', this.apiErrorMessage(error, 'Impossible de vérifier le contenu du programme.'));
      },
    });
  }

  confirmDeleteProgramme(): void {
    const id = this.programmeToDeleteId();
    if (!id) return;

    this.isLoading.set(true);
    this.societeService.deleteProgramme(id).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.programmeToDeleteId.set(null);
        this.deleteSummary.set(null);
        this.societeService.getProgrammes().subscribe();
        this.toast.success('Programme supprimé', 'Le programme a été retiré de votre catalogue.');
      },
      error: (error) => {
        this.isLoading.set(false);
        this.programmeToDeleteId.set(null);
        this.deleteSummary.set(null);
        this.toast.error('Suppression impossible', this.apiErrorMessage(error, 'Impossible de supprimer ce programme.'));
      },
    });
  }

  cancelDeleteProgramme(): void {
    this.programmeToDeleteId.set(null);
    this.deleteSummary.set(null);
  }

  handleLotAction(event: { lot: ParcelleLot; action: 'RESERVER' | 'TOGGLE_LITIGE' | 'VOIR' }): void {
    if (event.action === 'VOIR' && event.lot.programmeId) {
      this.router.navigate(['/societe/programmes', event.lot.programmeId, 'plan-masse']);
      return;
    }

    this.toast.info('Action disponible dans le Studio', 'La gestion graphique et métier des lots se fait désormais dans le Studio Plan de masse.');
  }

  getProgressionPercent(prog: Programme): number {
    return Math.max(0, Math.min(100, prog.avancement ?? 0));
  }

  private apiErrorMessage(error: unknown, fallback: string): string {
    const item = error as {
      error?: { message?: string; data?: { message?: string } };
      message?: string;
    };
    return item?.error?.message || item?.error?.data?.message || item?.message || fallback;
  }
}
