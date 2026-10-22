/** Nature d'un média rattaché à un programme ou à un bien foncier (lot, parcelle). */
export type TypeMedia = 'PHOTO' | 'PANORAMA_360';

export interface MediaFoncier {
  id: number;
  type: TypeMedia;
  titre?: string;
  description?: string;
  /** Chemin relatif du fichier (/uploads/medias/…). */
  url: string;
  typeContenu?: string;
  ordre: number;
  dateAjout?: string;
  programmeId?: number | null;
  bienId?: number | null;
}

/**
 * Élément auquel on rattache les médias. `bien` couvre les lots, les parcelles individuelles
 * et les maisons clés en main ; `modele` les modèles du catalogue de construction.
 */
export interface MediaCible {
  kind: 'programme' | 'bien' | 'modele';
  id: number;
  titre: string;
}

/** Point de passage d'une visite virtuelle : du panorama source vers le panorama cible. */
export interface LienPanorama {
  id: number;
  sourceId: number;
  cibleId: number;
  /** Direction du point dans la sphère, en degrés. */
  azimut: number;
  elevation: number;
  /** Libellé saisi ; null : le nom de la pièce d'arrivée. */
  libelle: string | null;
  /** Direction regardée en arrivant dans la pièce cible ; null : calculée automatiquement. */
  azimutArrivee?: number | null;
  elevationArrivee?: number | null;
}

/** Visite virtuelle d'une maison : pièce de départ (null : la première) et points de passage. */
export interface VisiteVirtuelle {
  panoramaDepartId: number | null;
  liens: LienPanorama[];
}

export interface LienPanoramaRequest {
  sourceId?: number;
  cibleId?: number;
  azimut: number;
  elevation: number;
  libelle?: string;
  creerRetour?: boolean;
}

export const MEDIA_TAILLE_MAX_OCTETS = 25 * 1024 * 1024;
export const MEDIA_TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];
