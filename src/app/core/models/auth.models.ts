export type StatutCompte = 
  | 'ACTIF' 
  | 'SUSPENDU' 
  | 'EN_ATTENTE_VALIDATION' 
  | 'VALIDE_MINISTERE' 
  | 'REJETE' 
  | 'DESACTIVE';

/**
 * Énumération des deux seuls rôles autorisés sur l'application Web/Desktop Foncier+ :
 * 1. ADMIN : Administrateur Souverain Plateforme / DNCG
 * 2. AGENT_PROMOTEUR : Agent Promoteur Responsable (Direction Société type SEMA SA)
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  ADMIN_PLATEFORME = 'ADMIN_PLATEFORME',
  ROLE_ADMIN = 'ROLE_ADMIN',
  AGENT_PROMOTEUR = 'AGENT_PROMOTEUR',
  ROLE_AGENT_PROMOTEUR = 'ROLE_AGENT_PROMOTEUR'
}

export type UserRoleType = 
  | 'ADMIN' 
  | 'ADMIN_PLATEFORME' 
  | 'ROLE_ADMIN' 
  | 'AGENT_PROMOTEUR' 
  | 'ROLE_AGENT_PROMOTEUR';

export interface LoginRequest {
  telephone: string;
  motDePasse: string;
}

export interface LoginResponse {
  token: string;
  type?: string;
  id: number;
  nom: string;
  prenom: string;
  email?: string;
  telephone: string;
  role: string;
  estResponsableSociete?: boolean;
  societeId?: number;
  societeNom?: string;
  statut?: StatutCompte | string;
  permissions?: string[];
  fonctionLibelle?: string;
  niveauAccesCode?: string;
  avatarUrl?: string;
  matricule?: string;
}

export interface AuthUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: UserRole;
  estResponsableSociete: boolean;
  societeId?: number;
  societeNom?: string;
  token: string;
  statut?: StatutCompte | string;
  permissions?: string[];
  fonctionLibelle?: string;
  avatarUrl?: string;
  matricule?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface RegisterSocieteRequest {
  nomSociete: string;
  adresse?: string;
  telephoneSociete: string;
  emailSociete?: string;
  siteWeb?: string;
  description?: string;
  numeroAgrement: string;
  dateAgrement?: string;
  nif: string;
  rccm?: string;
  nomResponsable: string;
  prenomResponsable: string;
  telephoneResponsable: string;
  emailResponsable?: string;
  motDePasse: string;
  documentKycNom?: string;
}

export interface RegisterSocieteResponse {
  id: number;
  nomCommercial: string;
  numeroAgrement: string;
  statutAgrement: string;
  email?: string;
  telephone?: string;
}

export interface JwtTokenPayload {
  id?: number;
  sub?: string;
  nom?: string;
  prenom?: string;
  email?: string;
  role?: string;
  estResponsableSociete?: boolean;
  societeId?: number;
  permissions?: string[];
  niveauAcces?: string;
  exp?: number;
  iat?: number;
}
