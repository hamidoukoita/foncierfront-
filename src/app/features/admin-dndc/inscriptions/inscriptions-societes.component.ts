import { ActivatedRoute } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { SocietePromotriceBackend } from '../../../core/models/backend.models';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

type InscriptionFilter = 'EN_ATTENTE' | 'VALIDEES' | 'REFUSEES';


@Component({
  selector: 'app-inscriptions-societes',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    PaginationComponent,
    ConfirmDialogComponent,
    MatIconModule, 
    MatButtonModule, 
    MatRippleModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './inscriptions-societes.component.html',
  styleUrl: './inscriptions-societes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InscriptionsSocietesComponent implements OnInit {
  private readonly superAdminService = inject(SuperAdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly currentFilter = signal<InscriptionFilter>('EN_ATTENTE');
  readonly selectedSociete = signal<SocietePromotriceBackend | null>(null);
  readonly motifNotification = signal<string>('Dossier d’agrément validé conforme par l’administration.');
  readonly searchTerm = signal<string>('');
  readonly currentPage = signal<number>(1);
  readonly pageSize = 6;

  // Dialogues et états de chargement
  readonly isConfirmValiderOpen = signal<boolean>(false);
  readonly isRefusModalOpen = signal<boolean>(false);
  readonly motifRefusModal = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);

  readonly societes = this.superAdminService.societes;
  readonly isLoading = this.superAdminService.isLoading;

  /**
   * Liste complète filtrée par onglet de statut et mot-clé de recherche
   */
  readonly filteredSocietes = computed(() => {
    let list = this.societes();
    const filter = this.currentFilter();
    const q = this.searchTerm().toLowerCase().trim();

    if (filter === 'VALIDEES') {
      list = list.filter(s => s.statutAgrement === 'VERIFIER');
    } else if (filter === 'REFUSEES') {
      list = list.filter(s => s.statutAgrement === 'REFUSER');
    } else {
      list = list.filter(s => s.statutAgrement === 'EN_ATTENTE');
    }

    if (q) {
      list = list.filter(s => 
        (s.nom && s.nom.toLowerCase().includes(q)) ||
        (s.numeroAgrement && s.numeroAgrement.toLowerCase().includes(q)) ||
        (s.nif && s.nif.toLowerCase().includes(q)) ||
        (s.telephone && s.telephone.includes(q))
      );
    }

    return list;
  });

  /**
   * Liste paginée selon la page courante
   */
  readonly paginatedSocietes = computed(() => {
    const list = this.filteredSocietes();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  readonly countEnAttente = computed(() => this.societes().filter(s => s.statutAgrement === 'EN_ATTENTE').length);
  readonly countValidees = computed(() => this.societes().filter(s => s.statutAgrement === 'VERIFIER').length);
  readonly countRefusees = computed(() => this.societes().filter(s => s.statutAgrement === 'REFUSER').length);

  ngOnInit(): void {
    const focusId = this.route.snapshot.queryParamMap.get('focusSocieteId');

    this.superAdminService.loadSocietes().subscribe(list => {
      if (list && list.length > 0) {
        let socToSelect = null;
        
        if (focusId) {
          const id = Number(focusId);
          socToSelect = list.find(s => s.id === id);
          if (socToSelect) {
            // Update filter based on societe status
            if (socToSelect.statutAgrement === 'VERIFIER') this.currentFilter.set('VALIDEES');
            else if (socToSelect.statutAgrement === 'REFUSER') this.currentFilter.set('REFUSEES');
            else this.currentFilter.set('EN_ATTENTE');
          }
        }
        
        if (!socToSelect && !this.selectedSociete()) {
          socToSelect = list.find(s => s.statutAgrement === 'EN_ATTENTE') || list[0];
        }

        if (socToSelect) {
          this.selectedSociete.set(socToSelect);
        }
      }
    });
  }

  selectSociete(soc: SocietePromotriceBackend): void {
    this.selectedSociete.set(soc);
  }

  setFilter(f: InscriptionFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
    const first = this.filteredSocietes()[0];
    if (first) {
      this.selectedSociete.set(first);
    }
  }

  ouvrirConfirmationValidation(): void {
    if (!this.selectedSociete()) return;
    this.isConfirmValiderOpen.set(true);
  }

  confirmerValidation(): void {
    const current = this.selectedSociete();
    if (!current) return;

    this.isSubmitting.set(true);
    this.superAdminService.validerSociete(current.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isConfirmValiderOpen.set(false);
        this.toast.success('Société validée', `L’agrément de "${current.nom}" est officiellement validé.`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Erreur validation societe:', err);
        this.toast.error('Erreur', 'Impossible de valider la société.');
      }
    });
  }

  ouvrirModalRefus(): void {
    const current = this.selectedSociete();
    if (!current) return;
    this.motifRefusModal.set('Dossier incomplet : pièces d’agrément non conformes aux critères réglementaires.');
    this.isRefusModalOpen.set(true);
  }

  confirmerRefus(): void {
    const current = this.selectedSociete();
    const motif = this.motifRefusModal().trim();
    if (!current) return;

    if (!motif) {
      this.toast.warning('Motif requis', 'Veuillez saisir un motif justifiant le refus du dossier.');
      return;
    }

    this.isSubmitting.set(true);
    this.superAdminService.refuserSociete(current.id, motif).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isRefusModalOpen.set(false);
        this.toast.warning('Dossier refusé', `Le dossier de "${current.nom}" a été rejeté.`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Erreur refus societe:', err);
        this.toast.error('Erreur', 'Impossible de rejeter le dossier.');
      }
    });
  }

  readonly isKycModalOpen = signal<boolean>(false);
  readonly kycDocuments = signal<any[]>([]);

  consulterDocumentKyc(s: SocietePromotriceBackend): void {
    this.superAdminService.getKycDocuments(s.id).subscribe({
      next: (res) => {
        this.kycDocuments.set(res.documents || []);
        this.isKycModalOpen.set(true);
      },
      error: (err) => {
        this.toast.error('Erreur', 'Impossible de charger le dossier KYC.');
      }
    });
  }

  fermerKycModal(): void {
    this.isKycModalOpen.set(false);
    this.kycDocuments.set([]);
  }
}
