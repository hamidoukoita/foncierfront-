export type StatutProgramme = 'PUBLIE' | 'BROUILLON' | 'ARCHIVE';

export interface Programme {
  id: number;
  nom: string;
  localisation: string;
  /** Coordonnées GPS de la cité (carte OpenStreetMap de l'application mobile). */
  latitude?: number | null;
  longitude?: number | null;
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

/**
 * Cycle d'une réservation : payée → en attente d'un agent → décompte démarré par l'agent (en cours)
 * → vendue avant l'échéance, ou expirée. L'acquéreur peut annuler tant que le bien n'est pas vendu.
 */
export type StatutReservation = 'EN_ATTENTE' | 'EN_COURS' | 'VENDUE' | 'EXPIREE' | 'ANNULEE';

export interface Reservation {
  id: number;
  lotDesignation: string;
  programmeNom: string;
  prospectNom: string;
  prospectTelephone: string;
  montantFcfa: number;
  dateReservation: string;
  agentAssignId?: number;
  agentAssignNom?: string;
  statut: StatutReservation;
  /** N° de dossier (ex. RES-2026-004). */
  numeroDossier?: string;
  /** Dates ISO : tri et calcul du délai de gel. */
  dateReservationIso?: string;
  /** Décompte démarré par l'agent, jusqu'à l'échéance. */
  dateDebutDecompteIso?: string;
  dateExpirationIso?: string;
  dateConclusionIso?: string;
  dureeReservationHeures?: number;
  motifAnnulation?: string;
  /** Paiement Orange Money simulé (zéro si la société a choisi la gratuité). */
  montantReservationFcfa: number;
  referencePaiement?: string;
  datePaiementIso?: string;
  rembourse: boolean;
  /** LOT_PROGRAMME, PARCELLE_INDIVIDUELLE ou MAISON_CLE_EN_MAIN. */
  typeBien?: string;
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
  lieu?: string;
  /** Compte-rendu saisi par l'agent après la visite (application mobile). */
  compteRendu?: string;
  motifRefus?: string;
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
  estResponsableSociete?: boolean;
  dateAffectation?: string;
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
  nombrePanoramas?: number;
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
  /** Message libre de l'acquéreur au promoteur. */
  description?: string;
  motifRefus?: string;
  dateDemande?: string;
  /** Vrai quand l'acquéreur décrit sa propre maison au lieu de choisir un modèle du catalogue. */
  modelePersonnalise: boolean;
  /** Maison clé en main prise comme référence par l'acquéreur. */
  maisonReferenceTitre?: string;
  maisonReferenceImageUrl?: string;
  descriptionModelePersonnalise?: string;
  nombreChambresSouhaitees?: number;
  nombreSallesBainSouhaitees?: number;
  surfaceConstruiteSouhaitee?: number;
  fichiers: FichierProjet[];
}

export interface FichierProjet {
  id: number;
  type: 'TITRE_FONCIER' | 'PLAN' | 'PHOTO';
  nomOriginal: string;
  contentType?: string;
  taille?: number;
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
  /** Date de l'arrêté d'agrément (ISO), renseignée par l'administration. */
  dateAgrement?: string | null;
  /** Présentation de la société (visible des acquéreurs). */
  description?: string;
  /** Heures laissées pour attribuer un agent à une demande avant son annulation automatique. */
  delaiAttributionHeures?: number;
  /** Un même lot ou une même parcelle peut-il être réservé par plusieurs acquéreurs. */
  reservationMultiple?: boolean;
  /** Nombre maximal de réservations en cours sur un même bien (1 = unique). */
  reservationsMax?: number;
  /** Montant payé par l'acquéreur pour réserver un lot ou une parcelle (FCFA). */
  prixReservation?: number;
  /** Chemin du logo (/uploads/logos/…), affiché sur les publications côté acquéreurs. */
  logoUrl?: string | null;
  /** Assistant de première connexion terminé ou passé. */
  parametrageInitialFait?: boolean;
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

/** Règles de réservation communes à tous les biens d'une société. */
export interface ReglesReservation {
  /** Durée de la réservation, comptée à partir du démarrage du décompte par l'agent. */
  delaiAttributionHeures: number;
  /** Nombre maximal de réservations en cours sur un même bien (1 = unique). */
  reservationsMax: number;
  /** Montant fixe payé pour réserver un lot ou une parcelle (FCFA). */
  prixReservation: number;
}
