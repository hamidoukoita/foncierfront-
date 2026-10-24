import { Reservation } from '../../core/models/societe.models';

/**
 * Montant à rendre ou déjà rendu à l'acquéreur : le bien a été vendu à un autre
 * et il a choisi (ou reçu d'office) le remboursement, ou il a annulé et la société rembourse une part.
 */
export function estRemboursee(r: Reservation): boolean {
  return r.rembourse || r.suiteVente === 'REMBOURSEMENT_EN_COURS' || r.suiteVente === 'REMBOURSEE';
}

/**
 * Montant réellement conservé par la société : déduction faite de la part remboursée
 * (tout, si le montant rendu n'est pas connu) ; un report ne compte qu'une fois, sur la réservation d'origine.
 */
export function montantEncaisse(r: Reservation): number {
  if (r.reservationOrigineId) return 0;
  if (r.suiteVente === 'REMBOURSEMENT_EN_COURS') return 0;
  if (!r.rembourse) return r.montantReservationFcfa;
  return r.montantRembourseFcfa == null ? 0 : r.montantReservationFcfa - r.montantRembourseFcfa;
}

/** Libellé court de la suite donnée après la vente du bien à un autre acquéreur, null sinon. */
export function libelleSuiteVente(r: Reservation): string | null {
  switch (r.suiteVente) {
    case 'A_CHOISIR':
      return 'Bien vendu à un autre : choix de l’acquéreur attendu (remboursé d’office sous 48 h)';
    case 'REMBOURSEMENT_EN_COURS':
      return 'Bien vendu à un autre : remboursement en cours (sous 24 h)';
    case 'REMBOURSEE':
      return 'Remboursée (bien vendu à un autre acquéreur)';
    case 'REMPLACEE':
      return 'Reportée sur un autre bien de la société';
    default:
      if (!r.rembourse) return null;
      // Annulation par l'acquéreur : seule source d'un remboursement sans suite de vente, avec un montant rendu.
      if (r.statut === 'ANNULEE' && r.montantRembourseFcfa != null) {
        const pourcentage = r.pourcentageRemboursement ?? 100;
        return pourcentage >= 100
          ? 'Annulée par l’acquéreur : remboursée en totalité'
          : `Annulée par l’acquéreur : ${pourcentage} % remboursé`;
      }
      return 'Remboursée (bien vendu à un autre acquéreur)';
  }
}
