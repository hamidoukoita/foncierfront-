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
export type StatutReservationBackend = 'EN_ATTENTE' | 'CONFIRMER' | 'REFUSER';
export type StatutRendezVousBackend = 'EN_ATTENTE' | 'ACCEPTER' | 'REFUSER';

export interface ReservationBackend {
  id: number;
  numeroDossier: string;
  dateReservation: string;
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
}

export interface RendezVousBackend {
  id: number;
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
}

export interface ModelMaisonBackend {
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


