import { Reservation } from '../../core/models/societe.models';
import { delaiAttribution } from './reservation-delai';

const HEURE = 3_600_000;
const DEPOT = new Date('2026-10-10T08:00:00').getTime();

function demande(partiel: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    lotDesignation: 'Lot 12',
    programmeNom: 'Cité Kalaban',
    prospectNom: 'Awa Traoré',
    prospectTelephone: '70000001',
    montantFcfa: 5_000_000,
    dateReservation: '10/10/2026',
    delaiGel72h: '',
    delaiExpire: false,
    statut: 'EN_ATTENTE',
    dateReservationIso: '2026-10-10T08:00:00',
    ...partiel,
  };
}

describe('delaiAttribution', () => {
  it('reste normal au-delà de 24 h restantes', () => {
    const d = delaiAttribution(demande(), DEPOT + 10 * HEURE);
    expect(d?.niveau).toBe('normal');
    expect(d?.libelle).toBe('2 j 14 h restants');
    expect(d?.totalHeures).toBe(72);
  });

  it('suit le délai fixé par la société via l’échéance du backend', () => {
    const r = demande({ dateExpirationIso: '2026-10-11T08:00:00' });
    const d = delaiAttribution(r, DEPOT + 20 * HEURE);
    expect(d?.totalHeures).toBe(24);
    expect(d?.libelle).toBe('4 h 00 restantes');
    expect(d?.niveau).toBe('urgent');
    expect(delaiAttribution(r, DEPOT + 25 * HEURE)?.niveau).toBe('depasse');
  });

  it('devient urgent sous 24 h', () => {
    expect(delaiAttribution(demande(), DEPOT + 60 * HEURE)?.niveau).toBe('urgent');
  });

  it('signale un délai dépassé après 72 h', () => {
    expect(delaiAttribution(demande(), DEPOT + 73 * HEURE)?.niveau).toBe('depasse');
  });

  it('ne s’applique plus une fois un agent attribué ou la demande traitée', () => {
    expect(delaiAttribution(demande({ agentAssignId: 4 }), DEPOT)).toBeNull();
    expect(delaiAttribution(demande({ statut: 'CONFIRMEE' }), DEPOT)).toBeNull();
  });
});
