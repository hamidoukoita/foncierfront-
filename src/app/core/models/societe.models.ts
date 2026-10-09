export type StatutProgramme = 'PUBLIE' | 'BROUILLON' | 'ARCHIVE';

export interface Programme {
  id: number;
  nom: string;
  localisation: string;
  statut: StatutProgramme;
  lotsTotal: number;
  lotsDisponibles: number;
  titreFoncierRef: string;
  description?: string;
  superficieTotale?: number;
  avancement?: number;
  eauSomapep?: boolean;
  electriciteEdm?: boolean;
  voirieBitumee?: boolean;
  viabilisationDetails?: string;
  imageUrl?: string;
  iconEmoji?: string;
  planMasseId?: number | null;
  planMasseNomFichier?: string;
  planMasseVersion?: string;
  planMasseDateMiseAJour?: string;
}

export type StatutLot = 'DISPONIBLE' | 'RESERVE' | 'VENDU' | 'INDISPONIBLE_LITIGE';

export interface ParcelleLot {
  id: number;
  designation: string; // Ex: 'Lot N° 104' ou 'L 104'
  titreFoncier: string;
  programmeNom: string;
  programmeId?: number;
  superficieM2: number;
  dimensions: string; // Ex: '16×25'
  facade?: number;
  profondeur?: number;
  prixFcfa: number;
  statut: StatutLot;
  delaiGelRestant?: string;
  numeroIlot?: string;
  numeroIlotLotissement?: string;
  bornesCertifiees?: number;
  /** Géométrie vectorielle JSON si le bien est positionné sur un plan. */
  geometryJson?: string;
}

export type StatutReservation = 'EN_ATTENTE' | 'CONFIRMEE' | 'ANNULEE';

export interface Reservation {
  id: number;
  lotDesignation: string;
  programmeNom: string;
  prospectNom: string;
  prospectTelephone: string;
  montantFcfa: number;
  dateReservation: string;
  delaiGel72h: string; // Ex: 'Reste 36h' ou 'Compromis signé'
  delaiExpire: boolean;
  agentAssignId?: number;
  agentAssignNom?: string;
  statut: StatutReservation;
}

export type StatutVisite = 'CONFIRME' | 'EN_ATTENTE' | 'EFFECTUE' | 'ANNULE';

export interface VisiteRendezVous {
  id: number;
  dateIso?: string;    // Date/heure ISO du rendez-vous (tri et « à venir »)
  jourSemaine: string; // SAM.
  jourMois: string;    // 26
  heureDebut: string;  // 10:00
  heureFin: string;    // 11:30
  dateComplete: string; // Septembre 2026
  prospectNom: string;
  prospectTelephone: string;
  programmeNom: string;
  bienCible: string;   // Lot 05 (280 m²)
  agentAssignId?: number;
  agentAssignNom?: string;
  agentStatutConfirmation?: string;
  statut: StatutVisite;
  typeVisite: 'CHANTIER' | 'SIEGE';
}

export type StatutAgent = 'ACTIF' | 'SUSPENDU';

export interface AgentCollaborateur {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  initiales: string;
  telephone: string;
  fonctionDeleguee: string;
  rdvVisitesCount: number;
  reservationsCount: number;
  statut: StatutAgent;
}

export type EtatEtudeConstruction = 'EN_ETUDE' | 'DEVIS_TRANSMIS' | 'EN_CHANTIER' | 'ACCEPTER' | 'REFUSER';
export type StatutTerrain = 'TITRE_FONCIER' | 'PERMIS_OCCUPER';

export interface ModelMaison {
  id: number;
  libeller: string;
  description?: string;
  imageUrl?: string;
  planUrl?: string;
  surfaceTerrainMin?: number;
  surfaceTerrainMax?: number;
  surfaceConstruite?: number;
  nombreChambres?: number;
  nombreSallesBain?: number;
  typeTerrainCompatible?: string;
  societeId?: number;
  societeNom?: string;
}

export interface ProjetConstruction {
  id: number;
  numeroDossier?: string;
  modeleVilla: string;
  modeleMaisonId?: number;
  modeleMaisonImageUrl?: string;
  modeleMaisonPlanUrl?: string;
  croquisIcon: string;
  surfaceTerrainM2: number;
  prospectNom: string;
  prospectTelephone: string;
  localisationTerrain: string;
  precisionLocalisation?: string;
  typeTerrain?: string;
  statutTerrain?: StatutTerrain;
  titreFoncierNumero?: string;
  chargeTechniqueNom?: string;
  chargeTechniqueStatut?: string;
  devisMontantFcfa?: number;
  etatEtude: EtatEtudeConstruction;
  progression: number;
  etapeAvancement?: string;
  commentaireAvancement?: string;
  dateDerniereMiseAJour?: string;
  delaiInfo?: string;
  description?: string;
}

export interface NotificationItem {
  id: number;
  titre: string;
  message: string;
  prospectConcerne?: string;
  dateRelative: string;
  type: 'RESERVATION' | 'VISITE' | 'CONSTRUCTION' | 'PAIEMENT';
  nonLu: boolean;
  actionLabel: string;
  actionRoute: string;
  iconEmoji: string;
}

export interface ProfilSociete {
  id: number;
  raisonSociale: string;
  formeJuridique: string;
  numeroAgrement: string;
  agrementStatut: 'VALIDE_MINISTERE' | 'EN_ATTENTE_VALIDATION' | 'REJETE';
  rccm: string;
  nif: string;
  directeurGerant: string;
  siegeSocial: string;
  telephoneFixe: string;
  emailOfficiel: string;
  siteWeb: string;
  documentKycNom: string;
  documentKycTaille: string;
  documentKycDate: string;
  documentKycUrl: string;
}

export interface DashboardKPIs {
  programmesActifsCount: number;
  programmesActifsSubtext: string;
  parcellesDisponiblesCount: number;
  parcellesTotalCount: number;
  reservationsEnCoursCount: number;
  reservationsSubtext: string;
  visitesCount: number;
  visitesSubtext: string;
}
