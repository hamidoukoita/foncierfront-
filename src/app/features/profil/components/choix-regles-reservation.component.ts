import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { formaterDuree, formaterFcfa } from '../../../core/utils/format';

/** Durées proposées (heures), dans les bornes acceptées par le backend : 24 h → 14 jours. */
const DELAIS_PROPOSES = [24, 48, 72, 120, 168, 336];

/** Montants de réservation proposés (FCFA) ; tout autre montant peut être saisi. */
const PRIX_PROPOSES = [10_000, 25_000, 50_000, 100_000];
const PRIX_MAX = 5_000_000;

/** Plafond accepté par le backend. */
const RESERVATIONS_MAX_LIMITE = 20;

/**
 * Choix des règles de réservation (prix, durée, nombre de réservations par bien).
 * Sans enregistrement : utilisé par le profil et par l'assistant de première connexion.
 */
@Component({
  selector: 'app-choix-regles-reservation',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="space-y-2">
        <span class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Prix de la réservation</span>
        <div class="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Prix de la réservation">
          @for (p of prixProposes; track p) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="prix() === p"
              (click)="prix.set(p)"
              class="cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors"
              [class]="prix() === p
                ? 'border-brand-primary bg-brand-primary text-white shadow-xs'
                : 'border-gray-200 bg-white text-gray-600 hover:border-brand-primary/50 hover:text-brand-secondary'"
            >
              {{ fcfa(p) }}
            </button>
          }
          <label class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 focus-within:border-brand-primary">
            <span class="text-[11px] font-semibold text-gray-500">Autre</span>
            <input
              type="number"
              min="0"
              [max]="prixMax"
              step="1000"
              [value]="prix()"
              (input)="saisirPrix($any($event.target).value)"
              class="w-24 border-0 bg-transparent p-0 text-xs font-bold text-brand-secondary outline-none"
              aria-label="Montant de la réservation en FCFA"
            />
            <span class="text-[11px] font-semibold text-gray-500">FCFA</span>
          </label>
        </div>
        <p class="text-[11px] text-gray-500 flex items-start gap-1.5">
          <mat-icon class="!text-sm !w-4 !h-4 text-brand-primary shrink-0">smartphone</mat-icon>
          Payé par l’acquéreur avec Orange Money (simulé) pour réserver un lot, une parcelle ou une maison clé en main ; jamais remboursé s’il se désiste.
        </p>
      </div>

      <div class="space-y-2">
        <span class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Durée de la réservation</span>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Durée de la réservation">
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
          Le décompte démarre quand l’agent prend le dossier en charge. Sans vente à l’échéance, la réservation expire : le montant n’est pas rendu et le bien redevient disponible.
        </p>
      </div>

      <div class="space-y-2">
        <span class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Réservations en cours par bien</span>
        <div class="flex flex-wrap items-center gap-4">
          <div class="inline-flex items-center rounded-xl border border-gray-200 bg-white" role="group" aria-label="Nombre maximal de réservations par bien">
            <button type="button" class="bouton bouton-discret" (click)="changerMax(-1)" [disabled]="reservationsMax() <= 1" aria-label="Diminuer">
              <mat-icon>remove</mat-icon>
            </button>
            <span class="min-w-10 text-center text-base font-extrabold text-brand-secondary" aria-live="polite">{{ reservationsMax() }}</span>
            <button type="button" class="bouton bouton-discret" (click)="changerMax(1)" [disabled]="reservationsMax() >= maxLimite" aria-label="Augmenter">
              <mat-icon>add</mat-icon>
            </button>
          </div>
          <p class="min-w-0 flex-1 text-[11px] leading-snug text-gray-500">
            @if (reservationsMax() === 1) {
              Une réservation en cours bloque le bien : personne d’autre ne peut le réserver ni demander de visite.
            } @else {
              Jusqu’à {{ reservationsMax() }} acquéreurs peuvent réserver le même bien ; à la vente, les autres sont remboursés.
              Le nombre atteint, plus aucune réservation ni demande de visite.
            }
          </p>
        </div>
      </div>
    </div>
  `,
})
export class ChoixReglesReservationComponent {
  readonly delai = model.required<number>();
  /** Nombre maximal de réservations en cours sur un même bien (1 = unique). */
  readonly reservationsMax = model.required<number>();
  readonly prix = model.required<number>();
  /** Valeur enregistrée, ajoutée aux délais proposés si elle n'en fait pas partie. */
  readonly delaiEnregistre = input<number | null>(null);
  readonly maxLimite = RESERVATIONS_MAX_LIMITE;
  readonly prixProposes = PRIX_PROPOSES;
  readonly prixMax = PRIX_MAX;

  readonly delais = computed(() => {
    const enregistre = this.delaiEnregistre();
    const liste = enregistre == null ? DELAIS_PROPOSES : [...DELAIS_PROPOSES, enregistre];
    return [...new Set(liste)].sort((a, b) => a - b);
  });

  duree(heures: number): string {
    return formaterDuree(heures);
  }

  fcfa(montant: number): string {
    return formaterFcfa(montant);
  }

  changerMax(pas: number): void {
    this.reservationsMax.update((n) => Math.min(RESERVATIONS_MAX_LIMITE, Math.max(1, n + pas)));
  }

  saisirPrix(valeur: string): void {
    const montant = Math.round(Number(valeur));
    if (Number.isFinite(montant)) this.prix.set(Math.min(PRIX_MAX, Math.max(0, montant)));
  }
}
