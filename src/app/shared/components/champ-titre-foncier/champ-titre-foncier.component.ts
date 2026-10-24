import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { PREFIXE_TF, referenceTitreFoncier, titreFoncierComplet } from '../../../core/utils/titre-foncier';

/**
 * Champ de numéro de Titre Foncier : « TF- » est affiché en préfixe fixe, l'utilisateur ne tape que
 * la référence. La valeur du formulaire est le numéro complet (« TF-1024/Kati »).
 */
@Component({
  selector: 'app-champ-titre-foncier',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChampTitreFoncierComponent), multi: true },
  ],
  template: `
    <div
      class="flex w-full items-stretch overflow-hidden rounded-xl border bg-white focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15"
      [class]="invalide() ? 'border-red-400' : 'border-gray-200'"
    >
      <span class="flex items-center border-r border-gray-200 bg-brand-bg px-3 font-mono text-sm font-bold text-brand-secondary">{{ prefixe }}</span>
      <input
        type="text"
        [id]="idChamp()"
        [value]="reference()"
        [disabled]="desactive()"
        [placeholder]="placeholder()"
        (input)="saisir($any($event.target).value)"
        (blur)="toucher()"
        maxlength="97"
        class="min-w-0 flex-1 px-3.5 py-3 text-sm font-normal outline-none"
      />
    </div>
  `,
})
export class ChampTitreFoncierComponent implements ControlValueAccessor {
  readonly idChamp = input<string | null>(null);
  readonly placeholder = input('1024/Kati');
  readonly invalide = input(false);

  readonly prefixe = PREFIXE_TF;
  readonly reference = signal('');
  readonly desactive = signal(false);

  private changement: (valeur: string) => void = () => undefined;
  private touche: () => void = () => undefined;

  writeValue(valeur: string | null): void {
    this.reference.set(referenceTitreFoncier(valeur));
  }

  registerOnChange(fn: (valeur: string) => void): void {
    this.changement = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touche = fn;
  }

  setDisabledState(desactive: boolean): void {
    this.desactive.set(desactive);
  }

  saisir(texte: string): void {
    this.reference.set(texte);
    this.changement(titreFoncierComplet(texte));
  }

  toucher(): void {
    // Un préfixe recopié par l'utilisateur (« TF 1024 ») disparaît du champ à la sortie.
    this.reference.set(referenceTitreFoncier(this.reference()));
    this.touche();
  }
}
