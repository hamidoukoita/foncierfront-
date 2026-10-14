import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { SocieteService } from '../../core/services/societe.service';
import { KycService } from '../../core/services/kyc.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { DocumentKycResponse } from '../../core/models/kyc.models';
import { messageErreurApi } from '../../core/utils/api-error';
import { StatutAgrementBannerComponent } from './components/statut-agrement-banner.component';
import { IdentiteFormComponent } from './components/identite-form.component';
import { ReferencesLegalesComponent } from './components/references-legales.component';
import { DossierKycComponent } from './components/dossier-kyc.component';
import { ResponsableLegalComponent } from './components/responsable-legal.component';
import { ReglesReservationComponent } from './components/regles-reservation.component';

/** Profil de la société promotrice : statut, coordonnées et règles de réservation modifiables, références légales, KYC. */
@Component({
  selector: 'app-profil-societe',
  standalone: true,
  imports: [
    StatutAgrementBannerComponent,
    IdentiteFormComponent,
    ReferencesLegalesComponent,
    DossierKycComponent,
    ResponsableLegalComponent,
    ReglesReservationComponent,
  ],
  templateUrl: './profil-societe.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilSocieteComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly kycService = inject(KycService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly profil = this.societeService.profilSociete;
  readonly utilisateur = this.authService.currentUser;
  readonly documents = signal<DocumentKycResponse[]>([]);
  readonly chargementKyc = signal(true);

  ngOnInit(): void {
    this.societeService.getProfilSociete().subscribe({
      error: (e) => this.toast.error('Profil indisponible', messageErreurApi(e, 'Impossible de charger la société.')),
    });
    this.kycService.getStatut().subscribe({
      next: (dossier) => {
        this.documents.set(dossier.documents ?? []);
        this.chargementKyc.set(false);
      },
      error: () => this.chargementKyc.set(false),
    });
  }
}
