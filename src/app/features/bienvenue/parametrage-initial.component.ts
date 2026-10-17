import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { switchMap } from 'rxjs/operators';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { messageErreurApi } from '../../core/utils/api-error';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { ChoixReglesReservationComponent } from '../profil/components/choix-regles-reservation.component';
import { LogoSocieteComponent } from '../profil/components/logo-societe.component';
import { DUREE_RESERVATION_PAR_DEFAUT_HEURES, PRIX_RESERVATION_PAR_DEFAUT } from '../reservations/reservation-delai';

type Etape = 'logo' | 'regles';

const ETAPES: readonly { id: Etape; titre: string }[] = [
  { id: 'logo', titre: 'Logo' },
  { id: 'regles', titre: 'Réservations' },
];

/**
 * Assistant de première connexion d'une société agréée : logo puis règles de réservation.
 * Passable à tout moment : les règles par défaut s'appliquent (25 000 FCFA, 72 h, réservation unique)
 * et le logo pourra être ajouté depuis le profil.
 */
@Component({
  selector: 'app-parametrage-initial',
  standalone: true,
  imports: [MatIcon, LogoComponent, LogoSocieteComponent, ChoixReglesReservationComponent],
  templateUrl: './parametrage-initial.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametrageInitialComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly profil = this.societeService.profilSociete;
  readonly etapes = ETAPES;
  readonly etape = signal<Etape>('logo');
  readonly enCours = signal(false);

  readonly delai = linkedSignal(() => this.profil().delaiAttributionHeures ?? DUREE_RESERVATION_PAR_DEFAUT_HEURES);
  readonly prix = linkedSignal(() => this.profil().prixReservation ?? PRIX_RESERVATION_PAR_DEFAUT);
  readonly reservationsMax = linkedSignal(() => this.profil().reservationsMax ?? 1);

  readonly indexEtape = computed(() => ETAPES.findIndex((e) => e.id === this.etape()));

  ngOnInit(): void {
    this.societeService.getProfilSociete().subscribe({ error: () => undefined });
  }

  /** Ignore l'assistant : règles par défaut, logo à ajouter plus tard depuis le profil. */
  passer(): void {
    this.enCours.set(true);
    this.societeService.terminerParametrageInitial().subscribe({
      next: () => this.allerAuDashboard(),
      error: (err) => this.echec(err),
    });
  }

  terminer(): void {
    this.enCours.set(true);
    this.societeService
      .updateReglesReservation({
        delaiAttributionHeures: this.delai(),
        reservationsMax: this.reservationsMax(),
        prixReservation: this.prix(),
      })
      .pipe(switchMap(() => this.societeService.terminerParametrageInitial()))
      .subscribe({
        next: () => {
          this.toast.success('Espace configuré', 'Vous pourrez modifier ces réglages depuis le profil de la société.');
          this.allerAuDashboard();
        },
        error: (err) => this.echec(err),
      });
  }

  private allerAuDashboard(): void {
    this.enCours.set(false);
    this.router.navigateByUrl('/societe/dashboard');
  }

  private echec(err: unknown): void {
    this.enCours.set(false);
    this.toast.error('Configuration', messageErreurApi(err, 'Enregistrement impossible.'));
  }
}
