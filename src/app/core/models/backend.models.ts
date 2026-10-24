import type { DescriptionMaison, PropositionProjet } from './projet-echange.models';

export type TypeBienBackend = 'LOT_PROGRAMME' | 'PARCELLE_INDIVIDUELLE' | 'MAISON_CLE_EN_MAIN' | 'BIEN_FONCIER';

export interface BackendApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type StatutAgrementBackend = 'EN_ATTENTE' | 'VERIFIER' | 'REFUSER';

export interface SocietePromotriceBackend {
  id: number;
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  nif: string;
  numeroAgrement: string;
  dateAgrement: string;
  statutAgrement: StatutAgrementBackend;
  logoUrl?: string;
  siteWeb?: string;
  description?: string;
  /** Règles de réservation fixées par la société. */
  delaiAttributionHeures?: number;
  reservationMultiple?: boolean;
  reservationsMax?: number;
  prixReservation?: number;
  pourcentageRemboursementAnnulation?: number;
  budgetMinimumConstruction?: number | null;
  /** Assistant de première connexion terminé ou passé. */
  parametrageInitialFait?: boolean;
  // Métadonnées d'interface
  formeJuridique?: string;
  representantLegal?: string;
  documentKycNom?: string;
  dateRelative?: string;
}

export type StatutProgrammeBackend = 'DISPONIBLE' | 'COMPLETER' | 'INDISPONIBLE';

export interface ProgrammeFoncierBackend {
  id: number;
  nom: string;
  description?: string;
  lieu: string;
  latitude?: number | null;
  longitude?: number | null;
  numeroTitreMere: string;
  superficieTotale: number;
  statut: StatutProgrammeBackend;
  dateCreation: string;
  avancement: number;
  eauSomapep: boolean;
  electriciteEdm: boolean;
  voirieBitumee: boolean;
  societeId: number;
  societeNom?: string;
  totalLots?: number;
  planMasseId?: number | null;
}

export interface ParcelleIndividuelleBackend {
  id: number;
  reference: string;
  superficie: number;
  prix: number;
  facade: number;
  profondeur: number;
  latitude?: number;
  longitude?: number;
  statut: string;
  numeroTitreFoncier: string;
  murCloture: boolean;
  eauSomapep: boolean;
  electriciteEdm: boolean;
  voieBitumee: boolean;
  societeId: number;
  geometryJson?: string;
  societeNom?: string;
}

export interface AgentPromoteurBackend {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  statut: 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE' | 'DESACTIVE';
  dateCreation: string;
  estResponsableSociete: boolean;
  dateAffectation?: string;
  societeId?: number;
  societeNom?: string;
  typeFonctionId?: number;
  typeFonctionLibelle?: string;
  reservationsCount?: number;
  rdvVisitesCount?: number;
}

export interface UtilisateurBackend {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  statut: 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE' | 'DESACTIVE';
  dateCreation: string;
  typeUtilisateur: string;
  // Décorateurs d'affichage
  entiteRattachee?: string;
  roleLibelle?: string;
}

export type StatutParcelleBackend = 'DISPONIBLE' | 'RESERVER' | 'VENDUE' | 'INDISPONIBLE';
/** CONFIRMER et REFUSER : anciens dossiers, antérieurs à la réservation payante. */
export type StatutReservationBackend = 'EN_ATTENTE' | 'EN_COURS' | 'VENDUE' | 'EXPIREE' | 'ANNULEE' | 'CONFIRMER' | 'REFUSER';
export type StatutRendezVousBackend = 'EN_ATTENTE' | 'ACCEPTER' | 'REFUSER';

export interface ReservationBackend {
  id: number;
  typeBien?: TypeBienBackend;
  numeroDossier: string;
  dateReservation: string;
  dateExpiration?: string;
  statut: StatutReservationBackend;
  motifRefus?: string;
  dateTraitement?: string;
  bienId: number;
  acquereurId?: number;
  agentId?: number;
  bienReference?: string;
  bienDesignation?: string;
  programmeNom?: string;
  montant?: number;
  acquereurNom?: string;
  acquereurTelephone?: string;
  agentNom?: string;
  motifAnnulation?: string;
  dateDebutDecompte?: string;
  dateConclusion?: string;
  dureeReservationHeures?: number;
  montantReservation?: number;
  moyenPaiement?: string;
  referencePaiement?: string;
  datePaiement?: string;
  rembourse?: boolean;
  pourcentageRemboursement?: number;
  montantRembourse?: number;
  dateRemboursement?: string;
  suiteVente?: 'A_CHOISIR' | 'REMBOURSEMENT_EN_COURS' | 'REMBOURSEE' | 'REMPLACEE';
  dateLimiteChoix?: string;
  dateRemboursementPrevue?: string;
  reservationOrigineId?: number;
}

export interface RendezVousBackend {
  id: number;
  typeBien?: TypeBienBackend;
  dateRendezVous: string;
  statut: StatutRendezVousBackend;
  motifRefus?: string;
  compteRendu?: string;
  typeRDV: 'SIEGE' | 'CHANTIER';
  lieu?: string;
  creneauId?: number;
  acquereurId?: number;
  agentId?: number;
  bienId?: number;
  bienReference?: string;
  bienDesignation?: string;
  programmeNom?: string;
  acquereurNom?: string;
  acquereurTelephone?: string;
  agentNom?: string;
  creneauHeure?: string;
  creneauHeureDebut?: string;
  creneauHeureFin?: string;
}

export interface NotificationBackend {
  id: number;
  titre: string;
  message: string;
  lue: boolean;
  dateEnvoi?: string;
  typeNotificationId?: number;
  typeNotificationLibelle?: string;
  utilisateurId?: number;
  utilisateurNom?: string;
  utilisateurPrenom?: string;
  utilisateurTelephone?: string;
  /** Élément concerné (ex. PROJET_CONSTRUCTION) et son identifiant. */
  cibleType?: string | null;
  cibleId?: number | null;
}

export interface ProjetConstructionBackend {
  id: number;
  numeroDossier?: string;
  numeroTitreFoncier?: string;
  localisationTerrain?: string;
  superficieTerrain?: number;
  typeTerrain?: string;
  description?: string;
  budgetEstime?: number;
  documentTfUrl?: string;
  statut?: string;
  progression?: number;
  etapeAvancement?: string;
  commentaireAvancement?: string;
  dateDerniereMiseAJour?: string;
  motifRefus?: string;
  dateDemande?: string;
  dateTraitement?: string;
  acquereurId?: number;
  acquereurNom?: string;
  acquereurTelephone?: string;
  modelMaisonId?: number;
  modelMaisonLibeller?: string;
  modelMaisonImageUrl?: string;
  modelMaisonPlanUrl?: string;
  societeId?: number;
  societeNom?: string;
  agentId?: number;
  agentNom?: string;
  modelePersonnalise?: boolean;
  maisonReferenceId?: number;
  maisonReferenceTitre?: string;
  maisonReferenceImageUrl?: string;
  maisonSouhaitee?: DescriptionMaison | null;
  propositionRetenue?: PropositionProjet | null;
  fichiers?: FichierProjetBackend[];
}

export interface FichierProjetBackend {
  id: number;
  type: 'TITRE_FONCIER' | 'PLAN' | 'PHOTO';
  nomOriginal: string;
  contentType?: string;
  taille?: number;
  dateAjout?: string;
}

export interface ModelMaisonBackend {
  id: number;
  libeller: string;
  description?: string;
  imageUrl?: string;
  planUrl?: string;
  /** Nombre de panoramas 360° de la galerie du modèle. */
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

export interface ModelMaisonRequestBackend {
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
}

export interface AvancementProjetRequestBackend {
  progression: number;
  etapeAvancement?: string;
  commentaireAvancement?: string;
}

export interface PlanMasseBackend {
  id: number;
  plan: string;
  description?: string;
  version: string;
  programmeId: number;
  programmeNom?: string;
  dateMiseAJour?: string;
  dateCreation?: string;
}

export interface PlanMasseRequestBackend {
  plan: string;
  description?: string;
  version?: string;
  programmeId: number;
}

export type PlanElementTypeBackend =
  | 'ROUTE_GOUDRONNEE'
  | 'ROUTE_NON_GOUDRONNEE'
  | 'MOSQUEE'
  | 'EGLISE'
  | 'ECOLE'
  | 'ESPACE_VERT'
  | 'MARCHE'
  | 'COMMERCE'
  | 'EQUIPEMENT_PUBLIC'
  | 'AUTRE';

export interface PlanMasseElementBackend {
  id: number;
  type: PlanElementTypeBackend;
  nom?: string;
  description?: string;
  geometryJson: string;
  styleJson?: string;
  visible: boolean;
  zIndex: number;
  planMasseId: number;
}

export interface PlanMasseElementRequestBackend {
  type: PlanElementTypeBackend;
  nom?: string;
  description?: string;
  geometryJson: string;
  styleJson?: string;
  visible?: boolean;
  zIndex?: number;
  planMasseId: number;
}

export interface LotProgrammeBackend {
  id: number;
  numeroLot: string;
  numeroIlot?: string;
  numeroIlotLotissement?: string;
  reference: string;
  superficie: number;
  prix: number;
  facade?: number;
  profondeur?: number;
  latitude?: number;
  longitude?: number;
  geometryJson?: string;
  statut: 'DISPONIBLE' | 'RESERVER' | 'VENDUE' | 'INDISPONIBLE';
  programmeId: number;
  programmeNom?: string;
  commodites?: Array<{ id: number; nom: string }>;
}

export interface LotProgrammeRequestBackend {
  numeroLot: string;
  numeroIlot: string;
  numeroIlotLotissement?: string;
  reference?: string;
  superficie: number;
  prix: number;
  facade?: number;
  profondeur?: number;
  latitude?: number;
  longitude?: number;
  geometryJson?: string;
  statut: 'DISPONIBLE' | 'RESERVER' | 'VENDUE' | 'INDISPONIBLE';
  programmeId: number;
}

export interface AdministrateurRequestBackend {
  nom: string;
  prenom: string;
  telephone: string;
  motDePasse?: string;
  statut?: 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE' | 'DESACTIVE';
}

export interface AdministrateurResponseBackend {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  statut: string;
  dateCreation: string;
  typeUtilisateur: string;
}


