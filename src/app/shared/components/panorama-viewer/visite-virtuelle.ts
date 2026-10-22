import { LienPanorama } from '../../../core/models/media.models';
import { Direction, normaliserAzimut } from './panorama-geometrie';
import { PointPanorama } from './panorama-viewer.component';

/** Texte d'une porte : son libellé, sinon le nom de la pièce où elle mène. */
export function libellePorte(lien: LienPanorama, panoramas: { id: number; titre: string }[]): string {
  return lien.libelle?.trim() || panoramas.find((p) => p.id === lien.cibleId)?.titre || 'Pièce';
}

/** Points de passage posés dans le panorama donné. */
export function pointsDuPanorama(
  liens: LienPanorama[],
  panoramaId: number,
  panoramas: { id: number; titre: string }[],
): PointPanorama[] {
  return liens
    .filter((l) => l.sourceId === panoramaId)
    .map((l) => ({ id: l.id, azimut: l.azimut, elevation: l.elevation, libelle: libellePorte(l, panoramas) }));
}

/**
 * Direction à regarder en arrivant par ce point : la vue réglée par la société si elle existe,
 * sinon dos à la porte du point retour (de la pièce d'arrivée vers celle de départ). Null à défaut.
 */
export function vueArrivee(liens: LienPanorama[], lien: LienPanorama): Direction | null {
  if (lien.azimutArrivee != null && lien.elevationArrivee != null) {
    return { azimut: lien.azimutArrivee, elevation: lien.elevationArrivee };
  }
  const retour = liens.find((l) => l.sourceId === lien.cibleId && l.cibleId === lien.sourceId);
  return retour ? { azimut: normaliserAzimut(retour.azimut + 180), elevation: 0 } : null;
}

/** Index de la pièce de départ : celle choisie par la société, sinon la première. */
export function indexDepart(panoramas: { id: number }[], departId: number | null): number {
  const i = departId == null ? -1 : panoramas.findIndex((p) => p.id === departId);
  return i >= 0 ? i : 0;
}

/** Charge à l'avance les images des pièces accessibles : le passage se fait sans attente. */
export function prechargerPanoramas(urls: string[]): void {
  for (const url of urls) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
  }
}
