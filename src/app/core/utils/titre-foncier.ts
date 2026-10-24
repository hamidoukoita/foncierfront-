import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Numéro de Titre Foncier : toujours « TF- » suivi de la référence (ex. TF-1024/Kati). */
export const PREFIXE_TF = 'TF-';

const PREFIXE_SAISI = /^T\.?\s*F\.?(?=[\s\-:_n°º#.]|\d|$)[\s\-:_.]*(n\s*[°º]|#)?[\s\-:_.]*/i;

/** Référence seule, sans le préfixe éventuellement tapé : « tf 1024 / Kati » → « 1024 / Kati ». */
export function referenceTitreFoncier(saisie: string | null | undefined): string {
  return (saisie ?? '').trim().replace(/\s{2,}/g, ' ').replace(PREFIXE_SAISI, '');
}

/** Numéro enregistré : « 1024/Kati » → « TF-1024/Kati » ; vide si aucune référence. */
export function titreFoncierComplet(saisie: string | null | undefined): string {
  const ref = referenceTitreFoncier(saisie);
  return ref ? PREFIXE_TF + ref : '';
}

/** Validateur : la référence après « TF- » doit commencer par une lettre ou un chiffre (vide accepté). */
export function titreFoncierValide(control: AbstractControl<string | null>): ValidationErrors | null {
  const ref = referenceTitreFoncier(control.value);
  return !ref || /^[\p{L}\p{N}]/u.test(ref) ? null : { titreFoncier: true };
}
