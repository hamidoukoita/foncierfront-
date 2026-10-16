import { LienPanorama } from '../../../core/models/media.models';
import { Direction, normaliserAzimut } from './panorama-geometrie';
import { PointPanorama } from './panorama-viewer.component';

/** Points de passage posés dans le panorama donné. */
export function pointsDuPanorama(liens: LienPanorama[], panoramaId: number): PointPanorama[] {
  return liens
    .filter((l) => l.sourceId === panoramaId)
    .map((l) => ({ id: l.id, azimut: l.azimut, elevation: l.elevation, libelle: l.libelle }));
}

/**
 * Direction à regarder en arrivant dans une pièce : dos à la porte par laquelle on revient
 * (le point retour de la pièce d'arrivée vers celle de départ). Null sans point retour.
 */
export function vueArrivee(liens: LienPanorama[], depuisId: number, versId: number): Direction | null {
  const retour = liens.find((l) => l.sourceId === versId && l.cibleId === depuisId);
  return retour ? { azimut: normaliserAzimut(retour.azimut + 180), elevation: 0 } : null;
}
