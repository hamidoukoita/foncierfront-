import { Reservation } from '../../core/models/societe.models';
import { decompteReservation } from './reservation-delai';

const HEURE = 3_600_000;
const DEBUT = new Date('2026-10-10T08:00:00').getTime();

function reservation(partiel: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    lotDesignation: 'Lot 12',
    programmeNom: 'Cité Kalaban',
    prospectNom: 'Awa Traoré',
    prospectTelephone: '70000001',
    montantFcfa: 5_000_000,
    montantReservationFcfa: 25_000,
    rembourse: false,
    dateReservation: '10/10/2026',
    statut: 'EN_COURS',
    agentAssignId: 4,
    dateReservationIso: '2026-10-09T08:00:00',
    dateDebutDecompteIso: '2026-10-10T08:00:00',
    dateExpirationIso: '2026-10-13T08:00:00',
    ...partiel,
  };
}

describe('decompteReservation', () => {
  it('compte le temps restant depuis le démarrage par l’agent', () => {
    const d = decompteReservation(reservation(), DEBUT + 10 * HEURE);
    expect(d?.niveau).toBe('normal');
    expect(d?.libelle).toBe('2 j 14 h restants');
    expect(d?.totalHeures).toBe(72);
  });

  it('devient urgent dans le dernier tiers, puis écoulé à l’échéance', () => {
    expect(decompteReservation(reservation(), DEBUT + 60 * HEURE)?.niveau).toBe('urgent');
    const ecoule = decompteReservation(reservation(), DEBUT + 73 * HEURE);
    expect(ecoule?.niveau).toBe('depasse');
    expect(ecoule?.progression).toBe(1);
  });

  it('suit la durée fixée par la société', () => {
    const d = decompteReservation(reservation({ dateExpirationIso: '2026-10-11T08:00:00' }), DEBUT + 20 * HEURE);
    expect(d?.totalHeures).toBe(24);
    expect(d?.libelle).toBe('4 h 00 restantes');
  });

  it('ne s’applique ni avant le démarrage ni après la vente', () => {
    expect(decompteReservation(reservation({ statut: 'EN_ATTENTE', dateDebutDecompteIso: undefined }), DEBUT)).toBeNull();
    expect(decompteReservation(reservation({ statut: 'VENDUE' }), DEBUT)).toBeNull();
  });
});
