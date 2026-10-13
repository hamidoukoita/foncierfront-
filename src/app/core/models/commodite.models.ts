/** Type de commodité défini par l'administrateur (École, Santé, Marché…). */
export interface TypeCommodite {
  id: number;
  libelle: string;
  description?: string;
}

export interface TypeCommoditeRequest {
  libelle: string;
  description?: string;
}

/** Commodité de proximité référencée par une société (école, CSCOM, marché…). */
export interface Commodite {
  id: number;
  nom: string;
  icone?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  typeCommoditeId?: number | null;
  typeCommoditeLibelle?: string | null;
  societeId?: number | null;
}

export interface CommoditeRequest {
  nom: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  typeCommoditeId: number;
}

/** Rattachement d'une commodité à une cité OU à une parcelle, avec distance. */
export interface ProximiteCommodite {
  id: number;
  distanceKm?: number | null;
  programmeId?: number | null;
  programmeNom?: string | null;
  bienId?: number | null;
  bienReference?: string | null;
  commodite: Commodite;
}

export interface ProximiteCommoditeRequest {
  commoditeId: number;
  programmeId?: number | null;
  bienId?: number | null;
  distanceKm?: number | null;
}
