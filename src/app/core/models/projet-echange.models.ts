import { FichierProjet } from './societe.models';

export type StyleMaison = 'MODERNE' | 'TRADITIONNEL' | 'CONTEMPORAIN' | 'LIBRE';
export type TypeCuisine = 'INTERIEURE' | 'EXTERIEURE' | 'LES_DEUX';
export type EquipementMaison =
  | 'TERRASSE'
  | 'BALCON'
  | 'COUR'
  | 'CHAMBRE_GARDIEN'
  | 'MUR_CLOTURE'
  | 'FORAGE'
  | 'CITERNE'
  | 'PANNEAUX_SOLAIRES';

/** Description d'une maison : souhaits de l'acquéreur ou maison proposée par la société. */
export interface DescriptionMaison {
  nombreNiveaux?: number | null;
  style?: StyleMaison | null;
  nombreChambres?: number | null;
  nombreSuites?: number | null;
  nombreSallesBain?: number | null;
  nombreSalons?: number | null;
  salleAManger?: boolean | null;
  toilettesVisiteurs?: boolean | null;
  magasin?: boolean | null;
  cuisine?: TypeCuisine | null;
  placesGarage?: number | null;
  equipements?: EquipementMaison[] | null;
  surfaceHabitable?: number | null;
  precisions?: string | null;
}

export type StatutProposition = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'CADUQUE';
export type CoteEchange = 'ACQUEREUR' | 'SOCIETE';

export interface PropositionProjet {
  id: number;
  projetId: number;
  numero: number;
  titre: string;
  maison?: DescriptionMaison | null;
  modelMaisonId?: number | null;
  modelMaisonLibeller?: string | null;
  modelMaisonImageUrl?: string | null;
  prixEstime?: number | null;
  delaiMois?: number | null;
  commentaire?: string | null;
  statut: StatutProposition;
  reponseAcquereur?: string | null;
  dateProposition: string;
  dateReponse?: string | null;
  auteurNom?: string | null;
  plans: FichierProjet[];
}

export interface MessageProjet {
  id: number;
  texte: string;
  cote: CoteEchange;
  auteurNom?: string | null;
  dateEnvoi: string;
}

/** Élément du fil d'échange, par ordre chronologique. */
export type ElementFil =
  | { type: 'MESSAGE'; date: string; message: MessageProjet }
  | { type: 'PROPOSITION'; date: string; proposition: PropositionProjet };

export interface PropositionProjetRequest {
  titre: string;
  modelMaisonId?: number;
  maison?: DescriptionMaison;
  prixEstime?: number;
  delaiMois?: number;
  commentaire?: string;
}

export const LIBELLES_STYLE: Record<StyleMaison, string> = {
  MODERNE: 'Moderne',
  TRADITIONNEL: 'Traditionnel / soudanais',
  CONTEMPORAIN: 'Contemporain',
  LIBRE: 'Au choix du promoteur',
};

/** Icône et explication de chaque style, pour qui ne connaît pas les termes d'architecture. */
export const PRESENTATION_STYLE: Record<StyleMaison, { icone: string; description: string }> = {
  MODERNE: { icone: 'domain', description: 'Lignes droites, toit plat, grandes fenêtres' },
  TRADITIONNEL: { icone: 'fort', description: 'Façades en banco ou crépi, à la manière de Djenné' },
  CONTEMPORAIN: { icone: 'villa', description: 'Volumes originaux, matériaux mélangés' },
  LIBRE: { icone: 'auto_awesome', description: 'Le promoteur conseille l’acquéreur' },
};

export const LIBELLES_CUISINE: Record<TypeCuisine, string> = {
  INTERIEURE: 'Cuisine intérieure',
  EXTERIEURE: 'Cuisine extérieure',
  LES_DEUX: 'Cuisine intérieure et extérieure',
};

export const LIBELLES_EQUIPEMENT: Record<EquipementMaison, string> = {
  TERRASSE: 'Terrasse',
  BALCON: 'Balcon',
  COUR: 'Cour',
  CHAMBRE_GARDIEN: 'Chambre de gardien',
  MUR_CLOTURE: 'Mur de clôture',
  FORAGE: 'Forage ou puits',
  CITERNE: 'Château d’eau / citerne',
  PANNEAUX_SOLAIRES: 'Panneaux solaires',
};

export const LIBELLES_STATUT_PROPOSITION: Record<StatutProposition, string> = {
  EN_ATTENTE: 'En attente de réponse',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Déclinée',
  CADUQUE: 'Sans suite',
};
