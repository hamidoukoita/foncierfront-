import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/**
 * Bouton d'action en pied de carte (programme, parcelle) : même hauteur, même largeur.
 * Usage : <button appCarteAction icone="360" variante="primaire">Visualisation 360°</button>
 */
@Component({
  selector: 'button[appCarteAction], a[appCarteAction]',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
    '[class.carte-action-primaire]': "variante() === 'primaire'",
    '[class.carte-action-secondaire]': "variante() === 'secondaire'",
  },
  template: `
    <mat-icon class="!h-[18px] !w-[18px] shrink-0 !text-[18px]">{{ icone() }}</mat-icon>
    <span class="truncate"><ng-content /></span>
  `,
  styles: `
    :host(.carte-action-primaire) {
      color: #fff;
      background: linear-gradient(135deg, #f29a43 0%, var(--foncier-primary) 55%, #cc6f14 100%);
      box-shadow: var(--foncier-shadow-btn);
    }
    :host(.carte-action-primaire:hover) { box-shadow: var(--foncier-shadow-btn-hover); }
    :host(.carte-action-secondaire) {
      color: #fff;
      background: var(--foncier-secondary);
      box-shadow: 0 4px 12px rgba(26, 43, 76, 0.22);
    }
    :host(.carte-action-secondaire:hover) { background: #22365c; }
  `,
})
export class CarteActionComponent {
  readonly icone = input.required<string>();
  readonly variante = input<'primaire' | 'secondaire'>('primaire');
}
