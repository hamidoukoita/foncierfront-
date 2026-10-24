import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfilSociete } from '../../../core/models/societe.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { formaterDuree, formaterFcfa } from '../../../core/utils/format';
import { DUREE_RESERVATION_PAR_DEFAUT_HEURES, PRIX_RESERVATION_PAR_DEFAUT } from '../../reservations/reservation-delai';
import { ChoixReglesReservationComponent } from './choix-regles-reservation.component';

/** Règles de réservation de la société : prix, remboursement, durée et nombre de réservations par bien. */
@Component({
  selector: 'app-regles-reservation',
  standalone: true,
  imports: [MatIcon, ChoixReglesReservationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white rounded-2xl p-6 border border-gray-100/90 shadow-card space-y-5">
      <div>
        <h2 class="text-sm font-bold text-brand-secondary">Règles de réservation</h2>
        <p class="text-xs text-gray-500 mt-0.5">S’appliquent à tous vos lots de cités, parcelles et maisons clés en main.</p>
      </div>

      <app-choix-regles-reservation
        [(delai)]="delai"
        [(reservationsMax)]="reservationsMax"
        [(prix)]="prix"
        [(remboursement)]="remboursement"
        [delaiEnregistre]="delaiEnregistre()"
      />

      <div class="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
        @if (modifie()) {
          <span class="mr-auto text-[11px] font-semibold text-brand-warning flex items-center gap-1">
            <mat-icon class="!text-sm !w-4 !h-4">edit</mat-icon> Modifications non enregistrées
          </span>
        }
        <button
          type="button"
          (click)="reinitialiser()"
          [disabled]="!modifie() || isSaving()"
          class="bouton bouton-discret"
        >
          Annuler
        </button>
        <button
          type="button"
          (click)="enregistrer()"
          [disabled]="!modifie() || isSaving()"
          class="bouton bouton-primaire"
        >
          {{ isSaving() ? 'Enregistrement…' : 'Enregistrer les règles' }}
        </button>
      </div>
    </section>
  `,
})
export class ReglesReservationComponent {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly profil = input.required<ProfilSociete>();
  readonly isSaving = signal(false);

  readonly delaiEnregistre = computed(
    () => this.profil().delaiAttributionHeures ?? DUREE_RESERVATION_PAR_DEFAUT_HEURES,
  );
  private readonly maxEnregistre = computed(() => this.profil().reservationsMax ?? 1);
  private readonly prixEnregistre = computed(() => this.profil().prixReservation ?? PRIX_RESERVATION_PAR_DEFAUT);
  private readonly remboursementEnregistre = computed(() => this.profil().pourcentageRemboursementAnnulation ?? 0);

  readonly delai = linkedSignal(() => this.delaiEnregistre());
  readonly reservationsMax = linkedSignal(() => this.maxEnregistre());
  readonly prix = linkedSignal(() => this.prixEnregistre());
  readonly remboursement = linkedSignal(() => this.remboursementEnregistre());

  readonly modifie = computed(
    () =>
      this.delai() !== this.delaiEnregistre() ||
      this.reservationsMax() !== this.maxEnregistre() ||
      this.prix() !== this.prixEnregistre() ||
      this.remboursement() !== this.remboursementEnregistre(),
  );

  reinitialiser(): void {
    this.delai.set(this.delaiEnregistre());
    this.reservationsMax.set(this.maxEnregistre());
    this.prix.set(this.prixEnregistre());
    this.remboursement.set(this.remboursementEnregistre());
  }

  enregistrer(): void {
    this.isSaving.set(true);
    this.societeService
      .updateReglesReservation({
        delaiAttributionHeures: this.delai(),
        reservationsMax: this.reservationsMax(),
        prixReservation: this.prix(),
        pourcentageRemboursementAnnulation: this.remboursement(),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.success(
            'Règles enregistrées',
            `${formaterFcfa(this.prix())} · ${formaterDuree(this.delai())} · ${this.reservationsMax()} réservation(s) par bien.`,
          );
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error('Règles de réservation', messageErreurApi(err, 'Enregistrement impossible.'));
        },
      });
  }
}
