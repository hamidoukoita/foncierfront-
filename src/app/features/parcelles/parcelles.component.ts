import { MediaCible } from '../../core/models/media.models';
import { MediaManagerComponent } from '../../shared/components/media-manager/media-manager.component';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { ParcelleLot, StatutLot } from '../../core/models/societe.models';
import { ParcelleIndividuelleBackend } from '../../core/models/backend.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { MatIcon } from '@angular/material/icon';

type ParcelleFilter = 'TOUTES' | 'DISPONIBLES' | 'RESERVEES' | 'VENDUES' | 'INDISPONIBLES';

@Component({
  selector: 'app-parcelles',
  standalone: true,
  imports: [
    MediaManagerComponent,
    CommonModule,
    ReactiveFormsModule,
    StatusBadgeComponent,
    PaginationComponent,
    EmptyStateComponent,
    MatIcon,
  ],
  templateUrl: './parcelles.component.html',
  styleUrl: './parcelles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcellesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly pageSize = 5;

  readonly mediaCible = signal<MediaCible | null>(null);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isEditLoading = signal(false);
  readonly currentFilter = signal<ParcelleFilter>('TOUTES');
  readonly currentPage = signal(1);
  readonly isAddModalOpen = signal(false);
  readonly searchQuery = signal('');
  readonly editingParcelle = signal<ParcelleLot | null>(null);
  readonly editingParcelleData = signal<ParcelleIndividuelleBackend | null>(null);

  readonly parcelles = this.societeService.parcelles;

  readonly parcelleForm = this.fb.nonNullable.group({
    designation: ['', [Validators.required, Validators.maxLength(100)]],
    titreFoncier: ['', [Validators.required, Validators.maxLength(100)]],
    superficieM2: [0, [Validators.required, Validators.min(1)]],
    dimensions: [''],
    prixFcfa: [0, [Validators.required, Validators.min(1)]],
    statut: ['DISPONIBLE' as StatutLot, [Validators.required]],
  });

  ngOnInit(): void {
    this.loadParcelles();
    this.route.queryParams.subscribe((params) => {
      if (params['q']) {
        this.searchQuery.set(String(params['q']));
        this.currentPage.set(1);
      }
    });
  }

  openMedias(parcelle: ParcelleLot): void {
    this.mediaCible.set({ kind: 'bien', id: parcelle.id, titre: parcelle.designation });
  }

  loadParcelles(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.societeService.getParcelles().subscribe({
      next: () => this.isLoading.set(false),
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(this.errorMessage(error, 'Impossible de charger les parcelles.'));
        this.toast.error('Chargement impossible', this.loadError() ?? undefined);
      },
    });
  }

  readonly filteredParcelles = computed(() => {
    let list = this.parcelles();
    const filter = this.currentFilter();
    const q = this.searchQuery().toLowerCase().trim();

    switch (filter) {
      case 'DISPONIBLES':
        list = list.filter((p) => p.statut === 'DISPONIBLE');
        break;
      case 'RESERVEES':
        list = list.filter((p) => p.statut === 'RESERVE');
        break;
      case 'VENDUES':
        list = list.filter((p) => p.statut === 'VENDU');
        break;
      case 'INDISPONIBLES':
        list = list.filter((p) => p.statut === 'INDISPONIBLE_LITIGE');
        break;
    }

    if (q) {
      list = list.filter((p) =>
        [p.designation, p.titreFoncier, p.programmeNom].some((value) =>
          (value ?? '').toLowerCase().includes(q),
        ),
      );
    }
    return list;
  });

  readonly paginatedParcelles = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredParcelles().slice(start, start + this.pageSize);
  });

  readonly countToutes = computed(() => this.parcelles().length);
  readonly countDisponibles = computed(() => this.parcelles().filter((p) => p.statut === 'DISPONIBLE').length);
  readonly countReservees = computed(() => this.parcelles().filter((p) => p.statut === 'RESERVE').length);
  readonly countVendues = computed(() => this.parcelles().filter((p) => p.statut === 'VENDU').length);
  readonly countIndisponibles = computed(() => this.parcelles().filter((p) => p.statut === 'INDISPONIBLE_LITIGE').length);

  setFilter(filter: ParcelleFilter): void {
    this.currentFilter.set(filter);
    this.currentPage.set(1);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  formatPrice(price: number | null | undefined): string {
    return new Intl.NumberFormat('fr-FR').format(Number(price ?? 0));
  }

  statusLabel(status: StatutLot): string {
    switch (status) {
      case 'DISPONIBLE': return 'Disponible';
      case 'RESERVE': return 'Réservée';
      case 'VENDU': return 'Vendue';
      default: return 'Indisponible';
    }
  }

  openAddModal(): void {
    this.editingParcelle.set(null);
    this.editingParcelleData.set(null);
    this.parcelleForm.reset({
      designation: '',
      titreFoncier: '',
      superficieM2: 0,
      dimensions: '',
      prixFcfa: 0,
      statut: 'DISPONIBLE',
    });
    this.isAddModalOpen.set(true);
  }

  openEditModal(parcelle: ParcelleLot): void {
    this.isEditLoading.set(true);
    this.societeService.getParcelleDetails(parcelle.id).subscribe({
      next: (details) => {
        this.editingParcelle.set(parcelle);
        this.editingParcelleData.set(details);
        this.parcelleForm.reset({
          designation: details.reference || parcelle.designation,
          titreFoncier: details.numeroTitreFoncier || parcelle.titreFoncier,
          superficieM2: Number(details.superficie ?? parcelle.superficieM2 ?? 0),
          dimensions: details.facade != null && details.profondeur != null
            ? `${details.facade}x${details.profondeur}`
            : parcelle.dimensions === '—' ? '' : parcelle.dimensions,
          prixFcfa: Number(details.prix ?? parcelle.prixFcfa ?? 0),
          statut: this.toUiStatus(details.statut),
        });
        this.isAddModalOpen.set(true);
        this.isEditLoading.set(false);
      },
      error: (error: unknown) => {
        this.isEditLoading.set(false);
        this.toast.error('Modification indisponible', this.errorMessage(error, 'Les détails de la parcelle ne peuvent pas être chargés.'));
      },
    });
  }

  submitAddParcelle(): void {
    if (this.parcelleForm.invalid) {
      this.parcelleForm.markAllAsTouched();
      this.toast.warning('Champs incomplets', 'Vérifiez la référence, le titre foncier, la superficie et le prix.');
      return;
    }

    const value = this.parcelleForm.getRawValue();
    const dimensions = this.parseDimensions(value.dimensions);
    const existing = this.editingParcelleData();
    const commonRequest = {
      numeroTitreFoncier: value.titreFoncier.trim(),
      reference: value.designation.trim(),
      superficie: Number(value.superficieM2),
      prix: Number(value.prixFcfa),
      facade: dimensions[0] ?? existing?.facade ?? undefined,
      profondeur: dimensions[1] ?? existing?.profondeur ?? undefined,
      statut: value.statut,
    };

    this.isSaving.set(true);
    const editing = this.editingParcelle();
    const request = editing
      ? this.societeService.updateParcelle(editing.id, {
          ...commonRequest,
          societeId: existing?.societeId,
          geometryJson: existing?.geometryJson,
          murCloture: existing?.murCloture,
          eauSomapep: existing?.eauSomapep,
          electriciteEdm: existing?.electriciteEdm,
          voieBitumee: existing?.voieBitumee,
        })
      : this.societeService.createParcelle(commonRequest);

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isAddModalOpen.set(false);
        this.toast.success(
          editing ? 'Parcelle modifiée' : 'Parcelle créée',
          `${value.designation} a bien été ${editing ? 'mise à jour' : 'enregistrée'}.`,
        );
        this.loadParcelles();
        this.editingParcelle.set(null);
        this.editingParcelleData.set(null);
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.toast.error(
          editing ? 'Modification impossible' : 'Création impossible',
          this.errorMessage(error, 'Le serveur n’a pas pu enregistrer cette parcelle.'),
        );
      },
    });
  }

  closeForm(): void {
    if (this.isSaving()) return;
    this.isAddModalOpen.set(false);
    this.editingParcelle.set(null);
    this.editingParcelleData.set(null);
  }

  private parseDimensions(value: string): number[] {
    if (!value.trim()) return [];
    return value.split(/[x×*]/)
      .map((part) => Number(part.trim()))
      .filter((number) => Number.isFinite(number) && number > 0)
      .slice(0, 2);
  }

  private toUiStatus(status: string): StatutLot {
    switch (status) {
      case 'RESERVER': return 'RESERVE';
      case 'VENDUE': return 'VENDU';
      case 'INDISPONIBLE': return 'INDISPONIBLE_LITIGE';
      default: return 'DISPONIBLE';
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    const candidate = error as { error?: { message?: string; detail?: string }; message?: string };
    return candidate?.error?.message || candidate?.error?.detail || candidate?.message || fallback;
  }
}
