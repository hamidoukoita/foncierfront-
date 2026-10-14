import { VisiteRendezVous } from '../../core/models/societe.models';
import { compterProchainsJours, grouperParJour, trierPourAgenda } from './visite-agenda';

const MAINTENANT = new Date('2026-10-13T12:00:00');

function visite(id: number, dateIso: string): VisiteRendezVous {
  return {
    id,
    dateIso,
    jourSemaine: '',
    jourMois: '',
    heureDebut: '',
    heureFin: '',
    dateComplete: '',
    prospectNom: `Acquéreur ${id}`,
    prospectTelephone: '',
    programmeNom: '',
    bienCible: '',
    statut: 'CONFIRME',
    typeVisite: 'SIEGE',
  };
}

describe('agenda des visites', () => {
  const liste = [
    visite(1, '2026-10-10T09:00:00'),
    visite(2, '2026-10-14T10:00:00'),
    visite(3, '2026-10-13T08:00:00'),
    visite(4, '2026-10-12T15:00:00'),
    visite(5, '2026-10-13T16:00:00'),
  ];

  it('place les visites à venir (aujourd’hui inclus) avant l’historique', () => {
    expect(trierPourAgenda(liste, MAINTENANT).map((v) => v.id)).toEqual([3, 5, 2, 4, 1]);
  });

  it('regroupe par journée avec des libellés relatifs', () => {
    const jours = grouperParJour(trierPourAgenda(liste, MAINTENANT), MAINTENANT);
    expect(jours.map((j) => j.libelle).slice(0, 3)).toEqual(['Aujourd’hui', 'Demain', 'Hier']);
    expect(jours[0].visites.length).toBe(2);
    expect(jours[0].estAujourdhui).toBe(true);
  });

  it('compte les visites des prochains jours', () => {
    expect(compterProchainsJours(liste, MAINTENANT, 1)).toBe(2);
    expect(compterProchainsJours(liste, MAINTENANT, 7)).toBe(3);
  });
});
