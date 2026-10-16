import { Reservation } from '../../core/models/societe.models';

/** Valeurs appliquées par le backend tant qu'une société n'a pas fixé les siennes. */
export const DUREE_RESERVATION_PAR_DEFAUT_HEURES = 72;
export const PRIX_RESERVATION_PAR_DEFAUT = 25_000;
const HEURE_MS = 3_600_000;

export type NiveauDelai = 'normal' | 'urgent' | 'depasse';

export interface DecompteReservation {
  niveau: NiveauDelai;
  libelle: string;
  /** Part de la durée déjà écoulée (0 → 1), pour la jauge. */
  progression: number;
  /** Durée totale de la réservation, en heures. */
  totalHeures: number;
}

/**
 * Temps restant d'une réservation dont l'agent a démarré le décompte, jusqu'à l'échéance
 * calculée par le backend. Retourne null avant le démarrage ou une fois la réservation terminée.
 */
export function decompteReservation(r: Reservation, maintenant: number): DecompteReservation | null {
  if (r.statut !== 'EN_COURS' || !r.dateDebutDecompteIso || !r.dateExpirationIso) return null;
  const debut = new Date(r.dateDebutDecompteIso).getTime();
  const fin = new Date(r.dateExpirationIso).getTime();
  if (Number.isNaN(debut) || Number.isNaN(fin) || fin <= debut) return null;

  const totalMs = fin - debut;
  const totalHeures = Math.round(totalMs / HEURE_MS);
  const restantMs = fin - maintenant;
  if (restantMs <= 0) return { niveau: 'depasse', libelle: 'Délai écoulé', progression: 1, totalHeures };

  const heures = Math.floor(restantMs / HEURE_MS);
  const minutes = Math.floor((restantMs % HEURE_MS) / 60_000);
  return {
    // Urgent dans le dernier tiers de la durée.
    niveau: restantMs < totalMs / 3 ? 'urgent' : 'normal',
    libelle:
      heures >= 48
        ? `${Math.floor(heures / 24)} j ${heures % 24} h restants`
        : heures > 0
          ? `${heures} h ${String(minutes).padStart(2, '0')} restantes`
          : `${minutes} min restantes`,
    progression: Math.min(1, Math.max(0, 1 - restantMs / totalMs)),
    totalHeures,
  };
}
