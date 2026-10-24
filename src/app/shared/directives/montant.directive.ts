import { Directive, ElementRef, effect, forwardRef, inject, input, output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Au-delà, la saisie s'arrête (100 milliards de FCFA). */
const CHIFFRES_MAX = 12;

/** « 200000000 » → « 200 000 000 ». */
export function grouperMilliers(chiffres: string): string {
  return chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Champ de montant en FCFA : chiffres seuls, groupés par milliers pendant la frappe
 * (« 200 000 000 »), la valeur restant un nombre (null si vide).
 * - dans un formulaire réactif : `<input appMontant formControlName="prix" />` ;
 * - sinon : `<input appMontant [montant]="prix()" (montantChange)="prix.set($event)" />`.
 */
@Directive({
  selector: 'input[appMontant]',
  standalone: true,
  host: {
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'surSaisie()',
    '(blur)': 'surSortie()',
  },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MontantDirective), multi: true }],
})
export class MontantDirective implements ControlValueAccessor {
  private readonly champ = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  /** Valeur affichée hors formulaire réactif. */
  readonly montant = input<number | null | undefined>(undefined);
  readonly montantChange = output<number | null>();

  private auChangement: (valeur: number | null) => void = () => {};
  private auToucher: () => void = () => {};

  constructor() {
    effect(() => {
      const valeur = this.montant();
      if (valeur !== undefined && valeur !== this.valeurActuelle()) this.afficher(valeur);
    });
  }

  writeValue(valeur: number | string | null): void {
    const nombre = valeur === null || valeur === '' ? null : Number(valeur);
    this.afficher(Number.isFinite(nombre) ? nombre : null);
  }

  registerOnChange(fn: (valeur: number | null) => void): void {
    this.auChangement = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.auToucher = fn;
  }

  setDisabledState(desactive: boolean): void {
    this.champ.disabled = desactive;
  }

  surSaisie(): void {
    const texte = this.champ.value;
    const curseur = this.champ.selectionStart ?? texte.length;
    const chiffresAvant = texte.slice(0, curseur).replace(/\D/g, '').length;
    const chiffres = texte.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, CHIFFRES_MAX);

    const groupe = grouperMilliers(chiffres);
    this.champ.value = groupe;
    // Le curseur reste après le même nombre de chiffres.
    let position = 0;
    for (let vus = 0; position < groupe.length && vus < chiffresAvant; position++) {
      if (groupe[position] !== ' ') vus++;
    }
    this.champ.setSelectionRange(position, position);

    const valeur = chiffres === '' ? null : Number(chiffres);
    this.auChangement(valeur);
    this.montantChange.emit(valeur);
  }

  surSortie(): void {
    this.auToucher();
  }

  private valeurActuelle(): number | null {
    const chiffres = this.champ.value.replace(/\D/g, '');
    return chiffres === '' ? null : Number(chiffres);
  }

  private afficher(valeur: number | null): void {
    this.champ.value = valeur === null ? '' : grouperMilliers(String(Math.round(valeur)));
  }
}
