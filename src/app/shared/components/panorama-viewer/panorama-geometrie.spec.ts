import { directionDepuisEcran, normaliserAzimut, orientationVers, positionAEcran, Vue } from './panorama-geometrie';

const vue = (yaw = 0, pitch = 0): Vue => ({ yaw, pitch, fov: (75 * Math.PI) / 180, largeur: 1200, hauteur: 800 });

describe('panorama-geometrie', () => {
  it('le centre de l’écran vise la direction de la caméra', () => {
    const v = { ...vue(), ...orientationVers({ azimut: 120, elevation: 15 }) };
    const d = directionDepuisEcran(600, 400, v);
    expect(d.azimut).toBeCloseTo(120, 6);
    expect(d.elevation).toBeCloseTo(15, 6);
  });

  it('aller-retour écran → direction → écran', () => {
    const v = vue(0.7, -0.2);
    for (const [x, y] of [[100, 120], [600, 400], [1100, 700]]) {
      const p = positionAEcran(directionDepuisEcran(x, y, v), v);
      expect(p?.x).toBeCloseTo(x, 4);
      expect(p?.y).toBeCloseTo(y, 4);
    }
  });

  it('un point derrière la caméra n’est pas affiché', () => {
    expect(positionAEcran({ azimut: 180, elevation: 0 }, vue())).toBeNull();
  });

  it('normalise l’azimut', () => {
    expect(normaliserAzimut(190)).toBe(-170);
    expect(normaliserAzimut(-180)).toBe(180);
  });
});
