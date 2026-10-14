import { ApercuMediasService, PanoramaAffichable } from '../../core/services/apercu-medias.service';
import { FoncierCardComponent } from '../../shared/components/foncier-card/foncier-card.component';
import { PanoramaModalComponent } from '../../shared/components/panorama-modal/panorama-modal.component';
import { CarteActionComponent } from '../../shared/components/carte-action/carte-action.component';
import { CouvertureDialogComponent } from '../../shared/components/couverture-dialog/couverture-dialog.component';
import { MediaCible } from '../../core/models/media.models';
import { MediaManagerComponent } from '../../shared/components/media-manager/media-manager.component';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, effect, untracked } from '@angular/core';
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
    FoncierCardComponent,
    PanoramaModalComponent,
    CarteActionComponent,
    CouvertureDialogComponent,
  ],
  providers: [ApercuMediasService],
  templateUrl: './parcelles.component.html',
  styleUrl: './parcelles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcellesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly pageSize = 6;

  readonly mediaCible = signal<MediaCible | null>(null);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isDetailsLoading = signal(false);
  readonly currentFilter = signal<ParcelleFilter>('TOUTES');
  readonly currentPage = signal(1);
  readonly isAddModalOpen = signal(false);
  readonly searchQuery = signal('');
  readonly editingParcelle = signal<ParcelleLot | null>(null);
  readonly editingParcelleData = signal<ParcelleIndividuelleBackend | null>(null);
  readonly detailParcelle = signal<ParcelleLot | null>(null);
  readonly detailData = signal<ParcelleIndividuelleBackend | null>(null);

  readonly parcelles = this.societeService.parcelles;

  readonly parcelleForm = this.fb.nonNullable.group({
    designation: ['', [Validators.required, Validators.maxLength(100)]],
    titreFoncier: ['', [Validators.required, Validators.maxLength(100)]],
    superficieM2: [0, [Validators.required, Validators.min(1)]],
    dimensions: [''],
    prixFcfa: [0, [Validators.required, Validators.min(1)]],
    latitude: this.fb.control<number | null>(null),
    longitude: this.fb.control<number | null>(null),
    statut: ['DISPONIBLE' as StatutLot, [Validators.required]],
    // Viabilisation (VRD) réalisée sur la parcelle
    eauSomapep: [false],
    electriciteEdm: [false],
    voieBitumee: [false],
    murCloture: [false],
  });

  /** Équipements de viabilisation proposés dans le formulaire. */
  readonly equipementsVrd = [
    { cle: 'eauSomapep', libelle: 'Eau SOMAPEP', detail: 'Compteur ou borne-fontaine', icone: 'water_drop' },
    { cle: 'electriciteEdm', libelle: 'Électricité EDM', detail: 'Poteau ou raccordement', icone: 'bolt' },
    { cle: 'voieBitumee', libelle: 'Voie bitumée', detail: 'Accès goudronné', icone: 'add_road' },
    { cle: 'murCloture', libelle: 'Clôture', detail: 'Mur ou soubassement', icone: 'fence' },
  ] as const;

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

  /** Photos de couverture et panoramas 360° des cartes. */
  readonly apercu = inject(ApercuMediasService);
  /** Visite 360° en cours d'affichage. */
  readonly visite360 = signal<{ titre: string; panoramas: PanoramaAffichable[] } | null>(null);

  private readonly chargementApercus = effect(() => {
    const parcelles = this.parcelles();
    untracked(() =>
      this.apercu.charger(parcelles.map((p) => ({ kind: 'bien' as const, id: p.id, titre: p.designation }))),
    );
  });

  /** Ouvre la visite 360° ; sans panorama, invite à en ajouter depuis la médiathèque. */
  ouvrir360(parcelle: ParcelleLot): void {
    const panoramas = this.apercu.panoramas(parcelle.id);
    if (panoramas.length === 0) {
      this.toast.info('Aucune vue 360°', 'Ajoutez un panorama 360° pour proposer la visite virtuelle de la parcelle.');
      this.openMedias(parcelle);
      return;
    }
    this.visite360.set({ titre: parcelle.designation, panoramas });
  }


  /** Cible dont on choisit la photo de couverture. */
  readonly couvertureCible = signal<MediaCible | null>(null);

  ouvrirCouverture(item: ParcelleLot): void {
    this.couvertureCible.set({ kind: 'bien', id: item.id, titre: item.designation });
  }

  fermerCouverture(modifiee: boolean): void {
    const cible = this.couvertureCible();
    if (cible && modifiee) this.apercu.rafraichir(cible);
    this.couvertureCible.set(null);
  }

  /** Ferme la médiathèque et met à jour la couverture / les panoramas de la carte. */
  fermerMedias(): void {
    const cible = this.mediaCible();
    if (cible) this.apercu.rafraichir(cible);
    this.mediaCible.set(null);
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

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  setFilter(filter: ParcelleFilter): void {
    this.currentFilter.set(filter);
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
      latitude: null,
      longitude: null,
      statut: 'DISPONIBLE',
      eauSomapep: false,
      electriciteEdm: false,
      voieBitumee: false,
      murCloture: false,
    });
    this.isAddModalOpen.set(true);
  }

  openEditModal(parcelle: ParcelleLot): void {
    this.isDetailsLoading.set(true);
    this.societeService.getParcelleDetails(parcelle.id).subscribe({
      next: (details: ParcelleIndividuelleBackend) => {
        this.editingParcelle.set(parcelle);
        this.editingParcelleData.set(details);
        const dims =
          details.facade != null && details.profondeur != null
            ? `${details.facade} x ${details.profondeur}`
            : parcelle.dimensions || '';
        this.parcelleForm.reset({
          designation: details.reference || parcelle.designation,
          titreFoncier: details.numeroTitreFoncier || parcelle.titreFoncier || '',
          superficieM2: details.superficie ?? parcelle.superficieM2 ?? 0,
          dimensions: dims,
          prixFcfa: Number(details.prix ?? parcelle.prixFcfa ?? 0),
          latitude: details.latitude ?? null,
          longitude: details.longitude ?? null,
          statut: this.toUiStatus(String(details.statut || parcelle.statut)),
          eauSomapep: !!details.eauSomapep,
          electriciteEdm: !!details.electriciteEdm,
          voieBitumee: !!details.voieBitumee,
          murCloture: !!details.murCloture,
        });
        this.isDetailsLoading.set(false);
        this.isAddModalOpen.set(true);
      },
      error: (error: unknown) => {
        this.isDetailsLoading.set(false);
        this.toast.error(
          'Modification indisponible',
          this.errorMessage(error, 'Les détails de la parcelle ne peuvent pas être chargés.'),
        );
      },
    });
  }

  submitAddParcelle(): void {
    if (this.parcelleForm.invalid) {
      this.parcelleForm.markAllAsTouched();
      this.toast.warning('Champs incomplets', 'Vérifiez la référence, le titre foncier, la superficie et le prix.');
      return;
    }

    const val = this.parcelleForm.getRawValue();
    const editing = this.editingParcelle();
    this.isSaving.set(true);
    const dimensions = this.parseDimensions(val.dimensions || '');

    const payload = {
      numeroTitreFoncier: val.titreFoncier,
      reference: val.designation,
      superficie: val.superficieM2,
      prix: val.prixFcfa,
      facade: dimensions[0],
      profondeur: dimensions[1],
      latitude: val.latitude,
      longitude: val.longitude,
      statut: val.statut,
      eauSomapep: val.eauSomapep,
      electriciteEdm: val.electriciteEdm,
      voieBitumee: val.voieBitumee,
      murCloture: val.murCloture,
    };

    const request$ = editing
      ? this.societeService.updateParcelle(editing.id, payload)
      : this.societeService.createParcelle(payload);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isAddModalOpen.set(false);
        this.toast.success(
          editing ? 'Parcelle modifiée' : 'Parcelle créée',
          `${val.designation} a bien été ${editing ? 'mise à jour' : 'enregistrée'}.`,
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

  openDetails(parcelle: ParcelleLot): void {
    this.detailParcelle.set(parcelle);
    this.detailData.set(null);
    this.isDetailsLoading.set(true);
    this.societeService.getParcelleDetails(parcelle.id).subscribe({
      next: (details: ParcelleIndividuelleBackend) => {
        this.detailData.set(details);
        this.isDetailsLoading.set(false);
      },
      error: (error: unknown) => {
        this.isDetailsLoading.set(false);
        this.toast.error(
          'Détails partiels',
          this.errorMessage(error, 'Certaines informations détaillées ne sont pas accessibles.'),
        );
      },
    });
  }

  closeDetails(): void {
    this.detailParcelle.set(null);
    this.detailData.set(null);
  }

  closeForm(): void {
    if (this.isSaving()) return;
    this.isAddModalOpen.set(false);
    this.editingParcelle.set(null);
    this.editingParcelleData.set(null);
  }

  private parseDimensions(value: string): number[] {
    if (!value.trim()) return [];
    return value
      .split(/[x×*]/)
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 2);
  }

  private toUiStatus(status: string): StatutLot {
    switch (status) {
      case 'RESERVER':
      case 'RESERVE':
        return 'RESERVE';
      case 'VENDUE':
      case 'VENDU':
        return 'VENDU';
      case 'INDISPONIBLE':
      case 'INDISPONIBLE_LITIGE':
        return 'INDISPONIBLE_LITIGE';
      default:
        return 'DISPONIBLE';
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    const candidate = error as { error?: { message?: string; detail?: string }; message?: string };
    return candidate?.error?.message || candidate?.error?.detail || candidate?.message || fallback;
  }
}
