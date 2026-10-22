import { LienPanorama } from '../../../core/models/media.models';
import { indexDepart, libellePorte, vueArrivee } from './visite-virtuelle';

const lien = (l: Partial<LienPanorama>): LienPanorama => ({ id: 1, sourceId: 10, cibleId: 20, azimut: 0, elevation: 0, libelle: 'Salon', ...l });

describe('vueArrivee', () => {
  it('utilise la vue réglée par la société', () => {
    const l = lien({ azimutArrivee: 45, elevationArrivee: -5 });
    expect(vueArrivee([l], l)).toEqual({ azimut: 45, elevation: -5 });
  });

  it('se place dos au point retour sans réglage', () => {
    const aller = lien({});
    const retour = lien({ id: 2, sourceId: 20, cibleId: 10, azimut: 170 });
    expect(vueArrivee([aller, retour], aller)).toEqual({ azimut: -10, elevation: 0 });
  });

  it('ne propose rien sans réglage ni point retour', () => {
    const l = lien({});
    expect(vueArrivee([l], l)).toBeNull();
  });
});

describe('indexDepart', () => {
  const panoramas = [{ id: 10 }, { id: 20 }, { id: 30 }];

  it('commence par la pièce choisie', () => {
    expect(indexDepart(panoramas, 30)).toBe(2);
  });

  it('commence par la première pièce sans choix ou si elle a disparu', () => {
    expect(indexDepart(panoramas, null)).toBe(0);
    expect(indexDepart(panoramas, 99)).toBe(0);
  });
});

describe('libellePorte', () => {
  const panoramas = [{ id: 10, titre: 'Pièce 1' }, { id: 20, titre: 'Salon' }];

  it('garde le libellé saisi', () => {
    expect(libellePorte(lien({ libelle: 'Vers le jardin' }), panoramas)).toBe('Vers le jardin');
  });

  it('prend le nom de la pièce d’arrivée sans libellé', () => {
    expect(libellePorte(lien({ libelle: null, cibleId: 10 }), panoramas)).toBe('Pièce 1');
  });
});
