import { TypeBienBackend } from './backend.models';

/** Fenêtre d'analyse des indicateurs : 30 jours, 90 jours ou depuis la création du compte. */
export type PeriodeStatistiques = 'MOIS' | 'TRIMESTRE' | 'TOUT';

export type StatutDossierAgent = 'EN_ATTENTE' | 'EN_COURS' | 'VENDUE' | 'EXPIREE' | 'ANNULEE';
export type StatutVisiteAgent = 'EN_ATTENTE' | 'ACCEPTER' | 'REFUSER';

/** Réservation suivie par l'agent (champs utiles à la page détail). */
export interface DossierAgent {
  id: number;
  numeroDossier: string;
  statut: StatutDossierAgent;
  bienDesignation?: string;
  programmeNom?: string;
  typeBien?: TypeBienBackend;
  acquereurNom?: string;
  montant?: number;
  montantReservation?: number;
  dateReservation: string;
  dateAttribution?: string;
  dateConclusion?: string;
}

/** Rendez-vous de visite attribué à l'agent. */
export interface VisiteAgent {
  id: number;
  dateRendezVous: string;
  statut: StatutVisiteAgent;
  bienDesignation?: string;
  programmeNom?: string;
  acquereurNom?: string;
  lieu?: string;
}

export interface AgentStatistiques {
  periode: PeriodeStatistiques;
  agent: {
    id: number;
    nom: string;
    prenom: string;
    telephone: string;
    statut: string;
    dateAffectation?: string;
    dateCreation?: string;
  };
  reservations: {
    attribuees: number;
    enAttente: number;
    enCours: number;
    vendues: number;
    expirees: number;
    annulees: number;
    tauxConversion: number | null;
  };
  visites: {
    attribuees: number;
    enAttente: number;
    prevues: number;
    effectuees: number;
    refusees: number;
  };
  activite: {
    chiffreAffaires: number;
    reservationsEncaissees: number;
  };
  reactivite: {
    delaiMoyenPriseEnChargeHeures: number | null;
    delaiMoyenVenteHeures: number | null;
  };
}

/** Page d'historique (dossiers ou visites), les plus récents d'abord. */
export interface PageHistorique<T> {
  elements: T[];
  page: number;
  taille: number;
  total: number;
  derniere: boolean;
}
