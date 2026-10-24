import { caracteristiquesMaison, libelleNiveaux } from './description-maison';

describe('description-maison', () => {
  it('nomme les niveaux comme sur un chantier malien', () => {
    expect(libelleNiveaux(1)).toBe('Plain-pied');
    expect(libelleNiveaux(2)).toBe('R+1');
    expect(libelleNiveaux(null)).toBeNull();
  });

  it('résume les souhaits de l’acquéreur', () => {
    expect(
      caracteristiquesMaison({
        nombreNiveaux: 2,
        style: 'MODERNE',
        nombreChambres: 4,
        nombreSuites: 2,
        nombreSallesBain: 1,
        placesGarage: 1,
        cuisine: 'LES_DEUX',
        equipements: ['TERRASSE', 'FORAGE'],
      }),
    ).toEqual([
      'R+1 · Moderne',
      '4 chambres dont 2 avec salle de bain',
      '1 salle de bain',
      'Cuisine intérieure et extérieure',
      'Garage 1 véhicule',
      'Terrasse',
      'Forage ou puits',
    ]);
  });

  it('ne dit rien d’une maison non décrite', () => {
    expect(caracteristiquesMaison(null)).toEqual([]);
    expect(caracteristiquesMaison({ placesGarage: 0 })).toEqual([]);
  });
});
