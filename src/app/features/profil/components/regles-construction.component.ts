import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfilSociete } from '../../../core/models/societe.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { formaterFcfa } from '../../../core/utils/format';
import { MontantDirective } from '../../../shared/directives/montant.directive';

/** « Construire sur mon terrain » : budget minimum affiché aux acquéreurs avant l'envoi de leur projet. */
@Component({
  selector: 'app-regles-construction',
  standalone: true,
  imports: [MatIcon, MontantDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white rounded-2xl p-6 border border-gray-100/90 shadow-card space-y-5">
      <div>
        <h2 class="text-sm font-bold text-brand-secondary">Construire sur mon terrain</h2>
        <p class="text-xs text-gray-500 mt-0.5">Ce que voient les acquéreurs avant de vous envoyer un projet de construction.</p>
      </div>

      <div class="space-y-2">
        <label for="budget-minimum" class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          Budget minimum de construction
        </label>
        <div class="flex max-w-xs items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15">
          <input
            id="budget-minimum"
            appMontant
            [montant]="budget()"
            (montantChange)="budget.set($event)"
            placeholder="Aucun minimum"
            class="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-brand-secondary outline-none"
          />
          <span class="text-[11px] font-semibold text-gray-500">FCFA</span>
        </div>
        <p class="text-[11px] text-gray-500 flex items-start gap-1.5">
          <mat-icon class="!text-sm !w-4 !h-4 text-brand-primary shrink-0">payments</mat-icon>
          @if (budget()) {
            Affiché sur votre fiche : l’acquéreur peut indiquer un budget plus élevé (facultatif), jamais en dessous de {{ fcfa(budget()!) }}.
          } @else {
            Sans minimum, l’acquéreur indique librement son budget (facultatif).
          }
        </p>
      </div>

      <div class="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
        @if (modifie()) {
          <span class="mr-auto text-[11px] font-semibold text-brand-warning flex items-center gap-1">
            <mat-icon class="!text-sm !w-4 !h-4">edit</mat-icon> Modification non enregistrée
          </span>
        }
        <button type="button" (click)="budget.set(budgetEnregistre())" [disabled]="!modifie() || isSaving()" class="bouton bouton-discret">
          Annuler
        </button>
        <button type="button" (click)="enregistrer()" [disabled]="!modifie() || isSaving()" class="bouton bouton-primaire">
          {{ isSaving() ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </section>
  `,
})
export class ReglesConstructionComponent {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly profil = input.required<ProfilSociete>();
  readonly isSaving = signal(false);

  readonly budgetEnregistre = computed(() => this.profil().budgetMinimumConstruction ?? null);
  readonly budget = linkedSignal<number | null>(() => this.budgetEnregistre());
  readonly modifie = computed(() => (this.budget() || null) !== this.budgetEnregistre());

  fcfa(montant: number): string {
    return formaterFcfa(montant);
  }

  enregistrer(): void {
    this.isSaving.set(true);
    this.societeService.updateReglesConstruction(this.budget() || null).subscribe({
      next: () => {
        this.isSaving.set(false);
        const budget = this.budget();
        this.toast.success('Budget minimum enregistré', budget ? formaterFcfa(budget) : 'Aucun minimum.');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toast.error('Budget minimum', messageErreurApi(err, 'Enregistrement impossible.'));
      },
    });
  }
}
