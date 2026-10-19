import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mêmes règles que le backend (Formats.java) : un formulaire valide ici l'est aussi côté serveur. */
const NOM_PERSONNE = /^\p{L}[\p{L} '’-]*$/u;
const TELEPHONE_MALI = /^[25-9]\d{7}$/;
const TEXTE_UTILE = /[\p{L}\p{N}]/u;

/** Chiffres seuls d'un numéro saisi « 76 12 34 56 » ou « +223 76… ». */
export function chiffresTelephone(saisie: string | null | undefined): string {
  const chiffres = (saisie ?? '').replace(/\D/g, '');
  return chiffres.length === 11 && chiffres.startsWith('223') ? chiffres.slice(3) : chiffres;
}

/** Champ obligatoire qui refuse les saisies faites seulement d'espaces ou de ponctuation. */
export const texteRequis: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v) return { required: true };
  return TEXTE_UTILE.test(v) ? null : { texteVide: true };
};

/** Nom ou prénom : lettres (accents compris), espaces, tirets et apostrophes. */
export const nomPersonne: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  return NOM_PERSONNE.test(v) ? null : { nomPersonne: true };
};

/** Numéro malien à 8 chiffres (les espaces sont tolérés à la saisie). */
export const telephoneMali: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  return TELEPHONE_MALI.test(chiffresTelephone(v)) ? null : { telephoneMali: true };
};

/** Date du jour au format des champs `type="date"` (AAAA-MM-JJ), en heure locale. */
export function aujourdhuiIso(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Date (AAAA-MM-JJ) qui ne doit pas dépasser aujourd'hui. */
export const datePasseeOuJour: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '');
  if (!v) return null;
  return v > aujourdhuiIso() ? { dateFuture: true } : null;
};

/** Message d'erreur lisible pour un champ, null s'il est valide ou pas encore touché. */
export function messageErreur(c: AbstractControl | null, libelle: string): string | null {
  if (!c || !c.invalid || !c.touched) return null;
  const e = c.errors ?? {};
  if (e['required']) return `${libelle} est obligatoire.`;
  if (e['texteVide']) return `${libelle} doit contenir des lettres ou des chiffres.`;
  if (e['nomPersonne']) return `${libelle} ne doit contenir que des lettres.`;
  if (e['telephoneMali']) return 'Numéro malien à 8 chiffres attendu (ex. 76 12 34 56).';
  if (e['email']) return 'Adresse e-mail invalide.';
  if (e['dateFuture']) return `${libelle} ne peut pas être dans le futur.`;
  if (e['minlength']) return `${libelle} doit contenir au moins ${e['minlength'].requiredLength} caractères.`;
  if (e['maxlength']) return `${libelle} est trop long.`;
  return `${libelle} est invalide.`;
}
