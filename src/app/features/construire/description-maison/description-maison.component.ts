import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DescriptionMaison } from '../../../core/models/projet-echange.models';
import { caracteristiquesMaison } from '../../../core/utils/description-maison';

/** Caractéristiques d'une maison (souhaits de l'acquéreur ou proposition) en pastilles, puis les précisions. */
@Component({
  selector: 'app-description-maison',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (caracteristiques().length) {
      <ul class="flex flex-wrap gap-1.5">
        @for (c of caracteristiques(); track c) {
          <li class="rounded-lg bg-brand-bg px-2.5 py-1 text-xs font-semibold text-brand-secondary">{{ c }}</li>
        }
      </ul>
    }
    @if (description()?.precisions; as precisions) {
      <p class="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">{{ precisions }}</p>
    }
    @if (!caracteristiques().length && !description()?.precisions) {
      <p class="text-xs text-gray-500">Aucun détail renseigné.</p>
    }
  `,
})
export class DescriptionMaisonComponent {
  readonly description = input<DescriptionMaison | null | undefined>(null);
  readonly caracteristiques = computed(() => caracteristiquesMaison(this.description()));
}
