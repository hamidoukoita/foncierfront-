import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfilSociete } from '../../../core/models/societe.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { formaterDuree } from '../../../core/utils/format';
import { DELAI_ATTRIBUTION_PAR_DEFAUT_HEURES } from '../../reservations/reservation-delai';

/** Délais proposés (heures), dans les bornes acceptées par le backend : 24 h → 14 jours. */
const DELAIS_PROPOSES = [24, 48, 72, 120, 168, 336];

const MODES = [
  {
    multiple: false,
    icone: 'person',
    titre: 'Une seule fois',
    texte: 'Dès qu’une demande est en cours, le bien n’accepte plus d’autre réservation.',
  },
  {
    multiple: true,
    icone: 'groups',
    titre: 'Plusieurs fois',
    texte: 'Plusieurs acquéreurs peuvent réserver le même bien et être confirmés.',
  },
] as const;

/** Règles de réservation de la société, appliquées à tous ses lots et parcelles. */
@Component({
  selector: 'app-regles-reservation',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white rounded-2xl p-6 border border-gray-100/90 shadow-card space-y-5">
      <div>
        <h2 class="text-sm font-bold text-brand-secondary">Règles de réservation</h2>
        <p class="text-xs text-gray-500 mt-0.5">S’appliquent à tous vos lots de cités et parcelles individuelles.</p>
      </div>

      <!-- Délai d'attribution -->
      <div class="space-y-2">
        <span class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Délai pour attribuer un agent</span>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Délai d’attribution">
          @for (h of delais(); track h) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="delai() === h"
              (click)="delai.set(h)"
              class="cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors"
              [class]="delai() === h
                ? 'border-brand-primary bg-brand-primary text-white shadow-xs'
                : 'border-gray-200 bg-white text-gray-600 hover:border-brand-primary/50 hover:text-brand-secondary'"
            >
              {{ duree(h) }}
            </button>
          }
        </div>
        <p class="text-[11px] text-gray-500 flex items-start gap-1.5">
          <mat-icon class="!text-sm !w-4 !h-4 text-brand-primary shrink-0">timer</mat-icon>
          Passé ce délai, une demande toujours sans agent est annulée automatiquement. Le nouveau délai s’applique aussi aux demandes en cours.
        </p>
      </div>

      <!-- Réservation unique ou multiple -->
      <div class="space-y-2">
        <span class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Un même bien peut être réservé</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Réservation multiple">
          @for (m of modes; track m.multiple) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="multiple() === m.multiple"
              (click)="multiple.set(m.multiple)"
              class="cursor-pointer rounded-xl border p-3.5 text-left transition-colors flex items-start gap-3"
              [class]="multiple() === m.multiple
                ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary'
                : 'border-gray-200 bg-white hover:border-brand-primary/50'"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                [class]="multiple() === m.multiple ? 'bg-brand-primary text-white' : 'bg-brand-bg text-gray-500'"
              >
                <mat-icon class="!h-5 !w-5 !text-[20px]">{{ m.icone }}</mat-icon>
              </span>
              <span class="min-w-0">
                <span class="block text-xs font-bold text-brand-secondary">{{ m.titre }}</span>
                <span class="mt-0.5 block text-[11px] leading-snug text-gray-500">{{ m.texte }}</span>
              </span>
            </button>
          }
        </div>
      </div>

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
          class="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Annuler
        </button>
        <button
          type="button"
          (click)="enregistrer()"
          [disabled]="!modifie() || isSaving()"
          class="px-5 py-2.5 text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs cursor-pointer transition-colors"
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
  readonly modes = MODES;

  private readonly delaiEnregistre = computed(
    () => this.profil().delaiAttributionHeures ?? DELAI_ATTRIBUTION_PAR_DEFAUT_HEURES,
  );
  private readonly multipleEnregistre = computed(() => this.profil().reservationMultiple ?? false);

  readonly delai = linkedSignal(() => this.delaiEnregistre());
  readonly multiple = linkedSignal(() => this.multipleEnregistre());

  /** Délais proposés, plus la valeur enregistrée si elle n'en fait pas partie. */
  readonly delais = computed(() =>
    [...new Set([...DELAIS_PROPOSES, this.delaiEnregistre()])].sort((a, b) => a - b),
  );

  readonly modifie = computed(
    () => this.delai() !== this.delaiEnregistre() || this.multiple() !== this.multipleEnregistre(),
  );

  duree(heures: number): string {
    return formaterDuree(heures);
  }

  reinitialiser(): void {
    this.delai.set(this.delaiEnregistre());
    this.multiple.set(this.multipleEnregistre());
  }

  enregistrer(): void {
    this.isSaving.set(true);
    this.societeService
      .updateReglesReservation({ delaiAttributionHeures: this.delai(), reservationMultiple: this.multiple() })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.success(
            'Règles enregistrées',
            `Agent à attribuer sous ${formaterDuree(this.delai())} · réservation ${this.multiple() ? 'multiple' : 'unique'}.`,
          );
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error('Règles de réservation', messageErreurApi(err, 'Enregistrement impossible.'));
        },
      });
  }
}
