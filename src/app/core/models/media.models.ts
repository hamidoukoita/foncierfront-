/** Nature d'un média rattaché à un programme ou à un bien foncier (lot, parcelle). */
export type TypeMedia = 'PHOTO' | 'PANORAMA_360' | 'VISITE_VIRTUELLE';

export interface MediaFoncier {
  id: number;
  type: TypeMedia;
  titre?: string;
  description?: string;
  /** Chemin relatif (/uploads/medias/…) pour un fichier, lien https pour une visite virtuelle. */
  url: string;
  typeContenu?: string;
  ordre: number;
  dateAjout?: string;
  programmeId?: number | null;
  bienId?: number | null;
}

/** Élément auquel on rattache les médias. `bien` couvre les lots de programme et les parcelles individuelles. */
export interface MediaCible {
  kind: 'programme' | 'bien';
  id: number;
  titre: string;
}

export const MEDIA_TAILLE_MAX_OCTETS = 25 * 1024 * 1024;
export const MEDIA_TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];
