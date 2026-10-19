import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { KycService } from '../../../core/services/kyc.service';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentKycResponse, TypeDocumentKyc } from '../../../core/models/kyc.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

type StatutDossier = 'CHARGEMENT' | 'EN_ATTENTE' | 'VERIFIER' | 'REFUSER' | 'ERREUR';

interface PieceKyc {
  type: TypeDocumentKyc;
  libelle: string;
  aide: string;
  obligatoire: boolean;
}

/** Pièces du dossier : le dossier consolidé déposé à l'inscription suffit, les autres le complètent. */
const PIECES: PieceKyc[] = [
  {
    type: TypeDocumentKyc.AGREMENT_MINISTERIEL,
    libelle: 'Dossier d’agrément',
    aide: 'Arrêté d’agrément ministériel, ou PDF consolidé déposé à l’inscription',
    obligatoire: true,
  },
  { type: TypeDocumentKyc.RCCM, libelle: 'Extrait RCCM', aide: 'Registre du commerce', obligatoire: false },
  { type: TypeDocumentKyc.NIF, libelle: 'Immatriculation fiscale (NIF)', aide: 'Carte ou attestation NIF', obligatoire: false },
  {
    type: TypeDocumentKyc.ATTESTATION_FISCALE,
    libelle: 'Attestation fiscale',
    aide: 'Attestation de régularité fiscale',
    obligatoire: false,
  },
];

const TAILLE_MAX_OCTETS = 25 * 1024 * 1024;

/**
 * Seule page accessible au responsable tant que l'agrément de sa société n'est pas validé :
 * suivi de l'examen par l'administrateur et dépôt ou remplacement des pièces du dossier.
 */
@Component({
  selector: 'app-kyc-attente',
  standalone: true,
  imports: [MatIcon, LogoComponent],
  templateUrl: './kyc-attente.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KycAttenteComponent implements OnInit {
  private readonly kycService = inject(KycService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly pieces = PIECES;
  readonly statut = signal<StatutDossier>('CHARGEMENT');
  readonly documents = signal<DocumentKycResponse[]>([]);
  /** Type de pièce en cours d'envoi (un seul à la fois). */
  readonly envoiEnCours = signal<TypeDocumentKyc | null>(null);
  readonly soumissionEnCours = signal(false);

  readonly dossierComplet = computed(() =>
    PIECES.filter((p) => p.obligatoire).every((p) => this.document(p.type)),
  );
  readonly modifiable = computed(() => this.statut() === 'EN_ATTENTE' || this.statut() === 'REFUSER');

  ngOnInit(): void {
    this.chargerStatut();
  }

  chargerStatut(): void {
    this.kycService.getStatut().subscribe({
      next: (res) => {
        this.statut.set(res.statutAgrement as StatutDossier);
        this.documents.set(res.documents ?? []);
      },
      error: () => this.statut.set('ERREUR'),
    });
  }

  document(type: TypeDocumentKyc): DocumentKycResponse | undefined {
    return this.documents().find((d) => d.typeDocument === type);
  }

  taille(doc: DocumentKycResponse): string {
    return `${(doc.tailleFichier / 1024 / 1024).toFixed(2)} Mo`;
  }

  deposer(event: Event, type: TypeDocumentKyc): void {
    const champ = event.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    if (fichier.size > TAILLE_MAX_OCTETS) {
      this.toast.error('Document trop volumineux', 'La taille maximale est de 25 Mo.');
      return;
    }

    this.envoiEnCours.set(type);
    this.kycService.uploadDocument(fichier, type).subscribe({
      next: () => {
        this.envoiEnCours.set(null);
        this.toast.success('Document ajouté', 'L’administrateur peut désormais le consulter.');
        this.chargerStatut();
      },
      error: (err) => {
        this.envoiEnCours.set(null);
        this.toast.error('Envoi impossible', messageErreurApi(err, 'Le document n’a pas pu être envoyé.'));
      },
    });
  }

  /** Après un refus : renvoie le dossier corrigé à l'examen. */
  soumettreANouveau(): void {
    this.soumissionEnCours.set(true);
    this.kycService.soumettreDossier().subscribe({
      next: () => {
        this.soumissionEnCours.set(false);
        this.toast.success('Dossier renvoyé', 'Votre dossier est de nouveau en cours d’examen.');
        this.chargerStatut();
      },
      error: (err) => {
        this.soumissionEnCours.set(false);
        this.toast.error('Soumission impossible', messageErreurApi(err, 'Le dossier n’a pas pu être renvoyé.'));
      },
    });
  }

  allerAuTableauDeBord(): void {
    this.router.navigateByUrl('/societe/dashboard');
  }

  seDeconnecter(): void {
    this.authService.logout();
  }
}
