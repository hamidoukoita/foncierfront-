import { Reservation } from '../../core/models/societe.models';

/**
 * Montant à rendre ou déjà rendu à l'acquéreur : le bien a été vendu à un autre
 * et il a choisi (ou reçu d'office) le remboursement.
 */
export function estRemboursee(r: Reservation): boolean {
  return r.rembourse || r.suiteVente === 'REMBOURSEMENT_EN_COURS' || r.suiteVente === 'REMBOURSEE';
}

/** Montant réellement conservé par la société : un report ne compte qu'une fois, sur la réservation d'origine. */
export function montantEncaisse(r: Reservation): number {
  return estRemboursee(r) || r.reservationOrigineId ? 0 : r.montantReservationFcfa;
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
      return r.rembourse ? 'Remboursée (bien vendu à un autre acquéreur)' : null;
  }
}
