import { Reservation } from '../../core/models/societe.models';

/** Délai appliqué par le backend tant qu'une société n'a pas fixé le sien. */
export const DELAI_ATTRIBUTION_PAR_DEFAUT_HEURES = 72;
const HEURE_MS = 3_600_000;

export type NiveauDelai = 'normal' | 'urgent' | 'depasse';

export interface DelaiAttribution {
  niveau: NiveauDelai;
  libelle: string;
  /** Part du délai déjà consommée (0 → 1), pour la jauge. */
  progression: number;
  /** Durée totale du délai fixé par la société, en heures. */
  totalHeures: number;
}

/**
 * Temps restant pour attribuer un agent à une demande en attente, jusqu'à l'échéance
 * calculée par le backend selon le délai de la société.
 * Retourne null quand le délai ne s'applique plus (agent attribué, demande traitée).
 */
export function delaiAttribution(r: Reservation, maintenant: number): DelaiAttribution | null {
  if (r.statut !== 'EN_ATTENTE' || r.agentAssignId || !r.dateReservationIso) return null;
  const debut = new Date(r.dateReservationIso).getTime();
  if (Number.isNaN(debut)) return null;

  const echeance = r.dateExpirationIso ? new Date(r.dateExpirationIso).getTime() : NaN;
  const fin = echeance > debut ? echeance : debut + DELAI_ATTRIBUTION_PAR_DEFAUT_HEURES * HEURE_MS;
  const totalMs = fin - debut;
  const totalHeures = Math.round(totalMs / HEURE_MS);
  const restantMs = fin - maintenant;
  if (restantMs <= 0) return { niveau: 'depasse', libelle: 'Délai dépassé', progression: 1, totalHeures };

  const heures = Math.floor(restantMs / HEURE_MS);
  const minutes = Math.floor((restantMs % HEURE_MS) / 60_000);
  return {
    // Urgent dans le dernier tiers du délai (sous 24 h pour un délai de 72 h).
    niveau: restantMs < totalMs / 3 ? 'urgent' : 'normal',
    libelle:
      heures >= 48
        ? `${Math.floor(heures / 24)} j ${heures % 24} h restants`
        : heures > 0
          ? `${heures} h ${String(minutes).padStart(2, '0')} restantes`
          : `${minutes} min restantes`,
    progression: 1 - restantMs / totalMs,
    totalHeures,
  };
}
