import { ActivatedRoute } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { SocietePromotriceBackend } from '../../../core/models/backend.models';
import { DocumentKycResponse, TypeDocumentKyc } from '../../../core/models/kyc.models';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TelephonePipe } from '../../../shared/pipes/telephone.pipe';

type InscriptionFilter = 'EN_ATTENTE' | 'VALIDEES' | 'REFUSEES';

interface DocumentOuvert {
  doc: DocumentKycResponse;
  url: string;
  urlSure: SafeResourceUrl;
}

const LIBELLES_DOCUMENT_KYC: Record<TypeDocumentKyc, string> = {
  [TypeDocumentKyc.AGREMENT_MINISTERIEL]: 'Dossier d’agrément',
  [TypeDocumentKyc.NIF]: 'Immatriculation fiscale (NIF)',
  [TypeDocumentKyc.RCCM]: 'Extrait RCCM',
  [TypeDocumentKyc.ATTESTATION_FISCALE]: 'Attestation fiscale',
};


@Component({
  selector: 'app-inscriptions-societes',
  standalone: true,
  imports: [TelephonePipe, 
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
  private readonly sanitizer = inject(DomSanitizer);
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
  readonly kycDocuments = signal<DocumentKycResponse[]>([]);
  /** Document KYC affiché dans la modale, chargé avec le jeton puis servi en URL locale. */
  readonly documentOuvert = signal<DocumentOuvert | null>(null);
  readonly chargementDocument = signal<boolean>(false);

  consulterDocumentKyc(s: SocietePromotriceBackend): void {
    this.superAdminService.getKycDocuments(s.id).subscribe({
      next: (res) => {
        const documents = res.documents ?? [];
        this.kycDocuments.set(documents);
        this.isKycModalOpen.set(true);
        if (documents.length > 0) this.afficherDocument(documents[0]);
      },
      error: () => {
        this.toast.error('Erreur', 'Impossible de charger le dossier KYC.');
      }
    });
  }

  afficherDocument(doc: DocumentKycResponse): void {
    if (this.documentOuvert()?.doc.id === doc.id) return;
    this.chargementDocument.set(true);
    this.superAdminService.getKycDocumentFichier(doc.id).subscribe({
      next: (fichier) => {
        this.libererDocument();
        const url = URL.createObjectURL(fichier);
        this.documentOuvert.set({ doc, url, urlSure: this.sanitizer.bypassSecurityTrustResourceUrl(url) });
        this.chargementDocument.set(false);
      },
      error: () => {
        this.chargementDocument.set(false);
        this.toast.error('Erreur', 'Impossible d’ouvrir ce document.');
      }
    });
  }

  libelleTypeDocument(type: TypeDocumentKyc): string {
    return LIBELLES_DOCUMENT_KYC[type] ?? 'Document';
  }

  fermerKycModal(): void {
    this.isKycModalOpen.set(false);
    this.kycDocuments.set([]);
    this.libererDocument();
  }

  private libererDocument(): void {
    const ouvert = this.documentOuvert();
    if (ouvert) URL.revokeObjectURL(ouvert.url);
    this.documentOuvert.set(null);
  }
}
