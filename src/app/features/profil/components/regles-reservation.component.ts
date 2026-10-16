import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfilSociete } from '../../../core/models/societe.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { formaterDuree, formaterFcfa } from '../../../core/utils/format';
import { DUREE_RESERVATION_PAR_DEFAUT_HEURES, PRIX_RESERVATION_PAR_DEFAUT } from '../../reservations/reservation-delai';
import { ChoixReglesReservationComponent } from './choix-regles-reservation.component';

/** Règles de réservation de la société : prix, durée et réservation unique ou multiple. */
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
        [(multiple)]="multiple"
        [(prix)]="prix"
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
  private readonly multipleEnregistre = computed(() => this.profil().reservationMultiple ?? false);
  private readonly prixEnregistre = computed(() => this.profil().prixReservation ?? PRIX_RESERVATION_PAR_DEFAUT);

  readonly delai = linkedSignal(() => this.delaiEnregistre());
  readonly multiple = linkedSignal(() => this.multipleEnregistre());
  readonly prix = linkedSignal(() => this.prixEnregistre());

  readonly modifie = computed(
    () =>
      this.delai() !== this.delaiEnregistre() ||
      this.multiple() !== this.multipleEnregistre() ||
      this.prix() !== this.prixEnregistre(),
  );

  reinitialiser(): void {
    this.delai.set(this.delaiEnregistre());
    this.multiple.set(this.multipleEnregistre());
    this.prix.set(this.prixEnregistre());
  }

  enregistrer(): void {
    this.isSaving.set(true);
    this.societeService
      .updateReglesReservation({
        delaiAttributionHeures: this.delai(),
        reservationMultiple: this.multiple(),
        prixReservation: this.prix(),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.success(
            'Règles enregistrées',
            `${formaterFcfa(this.prix())} · ${formaterDuree(this.delai())} · réservation ${this.multiple() ? 'multiple' : 'unique'}.`,
          );
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error('Règles de réservation', messageErreurApi(err, 'Enregistrement impossible.'));
        },
      });
  }
}
