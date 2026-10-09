import { MediaCible } from '../../core/models/media.models';
import { MediaManagerComponent } from '../../shared/components/media-manager/media-manager.component';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { ParcelleLot, StatutLot } from '../../core/models/societe.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatIcon } from '@angular/material/icon';

type ParcelleFilter = 'TOUTES' | 'DISPONIBLES' | 'RESERVEES' | 'VENDUES' | 'LITIGES';

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
    ConfirmDialogComponent,
    MatIcon
],
  templateUrl: './parcelles.component.html',
  styleUrl: './parcelles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcellesComponent implements OnInit {
  /** Parcelle dont on ouvre les photos / panoramas 360° / visites virtuelles. */
  readonly mediaCible = signal<MediaCible | null>(null);

  openMedias(p: ParcelleLot): void {
    this.mediaCible.set({ kind: 'bien', id: p.id, titre: p.designation });
  }

  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal<boolean>(false);
  readonly currentFilter = signal<ParcelleFilter>('TOUTES');
  readonly currentPage = signal<number>(1);
  readonly isAddModalOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  // Gestion du dialogue de confirmation de gel/litige
  readonly parcelleToToggleLitige = signal<ParcelleLot | null>(null);

  readonly parcelles = this.societeService.parcelles;

  ngOnInit(): void {
    this.loadParcelles();

    // Écoute d'éventuels paramètres de recherche globale passés depuis la topbar
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchQuery.set(params['q']);
      }
    });
  }

  loadParcelles(): void {
    this.isLoading.set(true);
    this.societeService.getParcelles().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
  }

  readonly filteredParcelles = computed(() => {
    let list = this.parcelles();
    const filter = this.currentFilter();
    const q = this.searchQuery().toLowerCase().trim();

    // Filtre statut
    switch (filter) {
      case 'DISPONIBLES': list = list.filter(p => p.statut === 'DISPONIBLE'); break;
      case 'RESERVEES': list = list.filter(p => p.statut === 'RESERVE'); break;
      case 'VENDUES': list = list.filter(p => p.statut === 'VENDU'); break;
      case 'LITIGES': list = list.filter(p => p.statut === 'INDISPONIBLE_LITIGE'); break;
    }

    // Filtre recherche par mot-clé
    if (q) {
      list = list.filter(p => 
        p.designation.toLowerCase().includes(q) ||
        p.titreFoncier.toLowerCase().includes(q) ||
        p.programmeNom.toLowerCase().includes(q)
      );
    }

    return list;
  });

  readonly countToutes = computed(() => this.parcelles().length);
  readonly countDisponibles = computed(() => this.parcelles().filter(p => p.statut === 'DISPONIBLE').length);
  readonly countReservees = computed(() => this.parcelles().filter(p => p.statut === 'RESERVE').length);
  readonly countVendues = computed(() => this.parcelles().filter(p => p.statut === 'VENDU').length);
  readonly countLitiges = computed(() => this.parcelles().filter(p => p.statut === 'INDISPONIBLE_LITIGE').length);

  readonly parcelleForm = this.fb.nonNullable.group({
    designation: ['', [Validators.required]],
    titreFoncier: ['', [Validators.required]],
    programmeNom: ['Parcelle individuelle'],
    superficieM2: [0, [Validators.required, Validators.min(1)]],
    dimensions: ['', [Validators.required]],
    prixFcfa: [0, [Validators.required, Validators.min(1)]],
    statut: ['DISPONIBLE' as StatutLot]
  });

  setFilter(f: ParcelleFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR').format(price);
  }

  openAddModal(): void {
    this.parcelleForm.reset({
      designation: '',
      titreFoncier: '',
      programmeNom: 'Parcelle individuelle',
      superficieM2: 0,
      dimensions: '',
      prixFcfa: 0,
      statut: 'DISPONIBLE'
    });
    this.isAddModalOpen.set(true);
  }

  submitAddParcelle(): void {
    if (this.parcelleForm.invalid) {
      this.parcelleForm.markAllAsTouched();
      this.toast.warning('Champs incomplets', 'Veuillez vérifier les informations de la parcelle.');
      return;
    }

    const val = this.parcelleForm.getRawValue();
    this.isLoading.set(true);
    const dimensions = val.dimensions
      .split(/[x×*]/)
      .map(value => Number(value.trim()))
      .filter(value => Number.isFinite(value) && value > 0);

    this.societeService.createParcelle({
      numeroTitreFoncier: val.titreFoncier,
      reference: val.designation,
      superficie: val.superficieM2,
      prix: val.prixFcfa,
      facade: dimensions[0],
      profondeur: dimensions[1],
      statut: val.statut
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isAddModalOpen.set(false);
        this.toast.success('Parcelle enregistrée', `${val.designation} (${val.titreFoncier}) a été ajoutée.`);
      },
      error: (err) => {
        console.error('Erreur création parcelle:', err);
        this.isLoading.set(false);
        this.isAddModalOpen.set(false);
        this.toast.error('Erreur', 'Impossible d’enregistrer la parcelle.');
      }
    });
  }

  requestToggleLitige(parcelle: ParcelleLot): void {
    this.parcelleToToggleLitige.set(parcelle);
  }

  confirmToggleLitige(): void {
    const p = this.parcelleToToggleLitige();
    if (!p) return;

    const nextStatut: StatutLot = p.statut === 'INDISPONIBLE_LITIGE' ? 'DISPONIBLE' : 'INDISPONIBLE_LITIGE';
    this.societeService.updateStatutParcelle(p.id, nextStatut);

    if (nextStatut === 'INDISPONIBLE_LITIGE') {
      this.toast.warning('Lot gelé en litige', `${p.designation} a été immédiatement retiré de la vente suite à contestation.`);
    } else {
      this.toast.success('Litige levé', `${p.designation} est à nouveau disponible à la réservation.`);
    }

    this.parcelleToToggleLitige.set(null);
  }

  cancelToggleLitige(): void {
    this.parcelleToToggleLitige.set(null);
  }
}
