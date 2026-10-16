import { Reservation } from '../../core/models/societe.models';

export const LIBELLES_STATUT: Record<Reservation['statut'], string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  VENDUE: 'Vendue',
  EXPIREE: 'Expirée',
  ANNULEE: 'Annulée',
};

/** Clé de couleur du badge de statut : une vente est un succès, pas un bien « vendu » indisponible. */
export const TON_STATUT: Record<Reservation['statut'], string> = {
  EN_ATTENTE: 'EN_ATTENTE',
  EN_COURS: 'RESERVE',
  VENDUE: 'CONFIRME',
  EXPIREE: 'ANNULE',
  ANNULEE: 'ANNULE',
};

/** La réservation bloque encore le bien. */
export function estActive(r: Reservation): boolean {
  return r.statut === 'EN_ATTENTE' || r.statut === 'EN_COURS';
}
