import { Pipe, PipeTransform } from '@angular/core';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Affiche un numéro enregistré au format international E.164 (ou à l'ancien format malien
 * à 8 chiffres) : « 76 12 34 56 » pour le Mali, « +33 6 12 34 56 78 » pour les autres pays.
 * `| telephone: true` ajoute aussi « +223 » aux numéros maliens.
 */
export function formaterTelephone(numero: string | null | undefined, avecIndicatif = false): string {
  const brut = (numero ?? '').trim();
  if (!brut) return '';
  const chiffres = brut.replace(/\D/g, '');
  const international = brut.startsWith('+') ? `+${chiffres}` : chiffres.length === 8 ? `+223${chiffres}` : `+${chiffres}`;
  const n = parsePhoneNumberFromString(international);
  if (!n) return brut;
  if (n.country === 'ML' && !avecIndicatif) return n.formatNational();
  return n.formatInternational();
}

/** Lien d'appel : toujours le numéro international complet, pour appeler depuis l'étranger. */
export function lienAppel(numero: string | null | undefined): string {
  const n = parsePhoneNumberFromString(formaterTelephone(numero, true));
  return n ? n.getURI() : `tel:${numero ?? ''}`;
}

@Pipe({ name: 'telephone', standalone: true })
export class TelephonePipe implements PipeTransform {
  transform(numero: string | null | undefined, avecIndicatif = false): string {
    return formaterTelephone(numero, avecIndicatif);
  }
}
