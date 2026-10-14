import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Champ de recherche au style commun des pages du dashboard société. */
@Component({
  selector: 'app-champ-recherche',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="relative block">
      <mat-icon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</mat-icon>
      <input
        type="search"
        [value]="valeur()"
        (input)="changement.emit($any($event.target).value)"
        [placeholder]="placeholder()"
        [attr.aria-label]="libelle() || placeholder()"
        class="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
      />
    </label>
  `,
})
export class ChampRechercheComponent {
  readonly valeur = input<string>('');
  readonly placeholder = input<string>('Rechercher…');
  readonly libelle = input<string>('');
  readonly changement = output<string>();
}
