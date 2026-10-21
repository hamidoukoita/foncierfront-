import { diagnostiquerPanorama } from './panorama';

describe('diagnostiquerPanorama', () => {
  it('accepte une image équirectangulaire 2:1', () => {
    expect(diagnostiquerPanorama(8192, 4096)).toEqual({ cas: 'conforme' });
  });

  it('complète un panorama de téléphone plus large que 2:1', () => {
    expect(diagnostiquerPanorama(1919, 820)).toEqual({ cas: 'a-completer', largeur: 1919, hauteur: 960 });
  });

  it('limite la largeur à celle que la visionneuse peut afficher', () => {
    expect(diagnostiquerPanorama(12000, 3000)).toEqual({ cas: 'a-completer', largeur: 8192, hauteur: 4096 });
  });

  it('signale une photo classique trop haute pour un panorama', () => {
    expect(diagnostiquerPanorama(1600, 1200)).toEqual({ cas: 'trop-etroite' });
  });
});
