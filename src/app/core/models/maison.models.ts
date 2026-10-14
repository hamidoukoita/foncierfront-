/** Statuts d'un bien côté backend (StatutParcelle). */
export type StatutBien = 'DISPONIBLE' | 'RESERVER' | 'VENDUE' | 'INDISPONIBLE' | 'EN_LITIGE';

/** Maison clé en main publiée par la société (bien foncier à part entière). */
export interface MaisonCleEnMain {
  id: number;
  reference: string;
  titre: string;
  description?: string;
  prix: number;
  superficie: number;
  surfaceHabitable?: number;
  nombreChambres?: number;
  nombreSallesBain?: number;
  nombreNiveaux?: number;
  numeroTitreFoncier?: string;
  adresse?: string;
  latitude?: number;
  longitude?: number;
  statut: StatutBien;
  reservationMultiple?: boolean;
  imageUrl?: string;
  nombrePanoramas?: number;
  societeId?: number;
  societeNom?: string;
  equipements: string[];
  commodites: { id: number; nom: string }[];
}

export type MaisonCleEnMainRequest = Omit<
  MaisonCleEnMain,
  'id' | 'reservationMultiple' | 'imageUrl' | 'nombrePanoramas' | 'societeId' | 'societeNom' | 'commodites'
>;
