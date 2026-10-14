import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export interface OngletFiltre {
  valeur: string;
  libelle: string;
  icone?: string;
  /** Nombre d'éléments affiché à côté du libellé (omis si non renseigné). */
  compte?: number;
}

/**
 * Rangée de filtres au style commun du dashboard société (programmes, parcelles, agents…) :
 * boutons séparés, le filtre actif passe en bleu anthracite.
 */
@Component({
  selector: 'app-filtre-onglets',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center gap-2" role="tablist">
      @for (onglet of onglets(); track onglet.valeur) {
        @let estActif = onglet.valeur === actif();
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="estActif"
          (click)="changement.emit(onglet.valeur)"
          class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-bold shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          [class]="estActif
            ? 'border-brand-secondary bg-brand-secondary text-white'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'"
        >
          <mat-icon class="!h-[18px] !w-[18px] !text-[18px] text-brand-primary">{{ onglet.icone || 'filter_list' }}</mat-icon>
          <span>
            {{ onglet.libelle }}
            @if (onglet.compte !== undefined) {
              <b class="ml-0.5">{{ onglet.compte }}</b>
            }
          </span>
        </button>
      }
    </div>
  `,
})
export class FiltreOngletsComponent {
  readonly onglets = input.required<OngletFiltre[]>();
  readonly actif = input.required<string>();
  readonly changement = output<string>();
}
