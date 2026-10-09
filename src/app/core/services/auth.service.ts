import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { 
  LoginRequest, 
  LoginResponse, 
  AuthUser, 
  ApiResponse, 
  UserRole,
  JwtTokenPayload,
  RegisterSocieteRequest,
  RegisterSocieteResponse
} from '../models/auth.models';

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly API_URL = 'http://localhost:8080/api/auth';
  private readonly TOKEN_KEY = 'foncier_jwt_token';
  private readonly USER_KEY = 'foncier_auth_user';

  // État géré avec Angular Signals - initialisé avec la session stockée
  private readonly state = signal<AuthState>({
    user: this.loadUserFromStorage(),
    isLoading: false,
    error: null
  });

  // Signaux publics exposés
  readonly currentUser = computed(() => this.state().user);
  readonly isAuthenticated = computed(() => !!this.state().user);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly authError = computed(() => this.state().error);

  /**
   * Vérifie si l'utilisateur est un Administrateur Plateforme / DNCG
   */
  readonly isPlatformAdmin = computed(() => {
    const user = this.state().user;
    if (!user) return false;
    const roleStr = String(user.role).toUpperCase();
    return (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.ADMIN_PLATEFORME ||
      user.role === UserRole.ROLE_ADMIN ||
      roleStr === 'ADMIN' ||
      roleStr === 'ADMIN_PLATEFORME' ||
      roleStr === 'ROLE_ADMIN' ||
      roleStr === 'ADMIN_DNDC' ||
      roleStr === 'SUPER_ADMIN'
    );
  });

  /**
   * Alias de compatibilité
   */
  readonly isSuperAdmin = computed(() => this.isPlatformAdmin());

  /**
   * Vérifie si l'utilisateur est un Agent Promoteur Responsable (Direction Société type SEMA SA)
   */
  readonly isResponsableSociete = computed(() => {
    const user = this.state().user;
    if (!user) return false;
    if (this.isPlatformAdmin()) return false;
    const roleStr = String(user.role).toUpperCase();
    return (
      (user.role === UserRole.AGENT_PROMOTEUR ||
       user.role === UserRole.ROLE_AGENT_PROMOTEUR ||
       roleStr === 'AGENT_PROMOTEUR' ||
       roleStr === 'ROLE_AGENT_PROMOTEUR' ||
       roleStr === 'AGENT' ||
       roleStr === 'ROLE_PROMOTEUR') &&
      user.estResponsableSociete === true
    );
  });

  /**
   * Initiales de l'utilisateur pour l'avatar UI
   */
  readonly userInitials = computed(() => {
    const user = this.state().user;
    if (!user) return 'FP';
    if (user.societeNom && this.isResponsableSociete()) {
      const parts = user.societeNom.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.societeNom.substring(0, 2).toUpperCase();
    }
    const prenomInitial = user.prenom?.[0] ?? '';
    const nomInitial = user.nom?.[0] ?? '';
    return (prenomInitial + nomInitial).toUpperCase() || 'FP';
  });

  /**
   * Charge l'utilisateur depuis le LocalStorage avec vérification de validité et expiration
   */
  private loadUserFromStorage(): AuthUser | null {
    try {
      const userJson = localStorage.getItem(this.USER_KEY);
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (!userJson || !token) return null;

      const payload = this.decodeTokenPayload(token);
      if (payload?.exp && payload.exp * 1000 < Date.now()) {
        console.warn('[AuthService] Token JWT expiré lors de la restauration de session.');
        this.clearStorage();
        return null;
      }

      const user = JSON.parse(userJson) as AuthUser;
      if (!user) return null;

      const roleStr = String(user.role || '').toUpperCase();
      const isAdmin = roleStr === 'ADMIN' || roleStr === 'ROLE_ADMIN' || roleStr === 'ADMIN_PLATEFORME' || roleStr === 'ADMIN_DNDC';
      const isPromoteur = (roleStr === 'AGENT_PROMOTEUR' || roleStr === 'ROLE_AGENT_PROMOTEUR' || roleStr === 'AGENT') && user.estResponsableSociete === true;

      if (!isAdmin && !isPromoteur) {
        console.warn('[AuthService] Session stockée non autorisée sur le web. Purge automatique.');
        this.clearStorage();
        return null;
      }

      return user;
    } catch {
      this.clearStorage();
      return null;
    }
  }

  /**
   * Connexion unique via l'API Spring Boot (POST /api/auth/login)
   * Applique le cloisonnement strict :
   * - ADMIN -> /admin/dashboard
   * - AGENT_PROMOTEUR avec estResponsableSociete === true -> /societe/dashboard
   * - Agent Collaborateur (estResponsableSociete === false) -> Bloqué (réservé mobile)
   */
  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));

    return this.http.post<ApiResponse<LoginResponse>>(`${this.API_URL}/login`, credentials).pipe(
      tap((response) => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Échec de la connexion.');
        }

        const data = response.data;
        const rawRole = (data.role || '').toUpperCase();
        const permissions = data.permissions || [];

        // 1. Détection Administrateur Plateforme / DNCG
        const isAdmin = 
          rawRole === 'ADMIN' || 
          rawRole === 'ROLE_ADMIN' || 
          rawRole === 'ADMIN_PLATEFORME' || 
          rawRole === 'ADMIN_DNDC' || 
          rawRole === 'SUPER_ADMIN' ||
          permissions.includes('OP_ALL');

        if (isAdmin) {
          const authUser: AuthUser = {
            id: data.id,
            nom: data.nom,
            prenom: data.prenom,
            telephone: data.telephone,
            email: data.email || `${data.telephone}@foncierplus.ml`,
            role: UserRole.ADMIN,
            estResponsableSociete: false,
            societeId: data.societeId,
            societeNom: data.societeNom || 'Direction Nationale du Cadastre (DNCG)',
            token: data.token,
            statut: data.statut,
            permissions: permissions,
            fonctionLibelle: data.fonctionLibelle || 'Administrateur Plateforme',
            avatarUrl: data.avatarUrl,
            matricule: data.matricule
          };

          this.setAuthenticatedUser(authUser);
          this.router.navigate(['/admin/dashboard']);
          return;
        }

        // 2. Détection Agent Promoteur Responsable
        const isAgent = rawRole === 'AGENT' || rawRole === 'AGENT_PROMOTEUR' || rawRole === 'ROLE_AGENT_PROMOTEUR' || rawRole === 'ROLE_PROMOTEUR';
        const isResponsable = isAgent && (
          data.estResponsableSociete === true ||
          rawRole === 'ROLE_PROMOTEUR' ||
          permissions.includes('RESPONSABLE_SOCIETE') ||
          permissions.includes('GESTION_AGENTS_SOCIETE')
        );

        if (isResponsable) {
          const authUser: AuthUser = {
            id: data.id,
            nom: data.nom,
            prenom: data.prenom,
            telephone: data.telephone,
            email: data.email || `${data.telephone}@foncierplus.ml`,
            role: UserRole.AGENT_PROMOTEUR,
            estResponsableSociete: true,
            societeId: data.societeId,
            societeNom: data.societeNom,
            token: data.token,
            statut: data.statut,
            permissions: permissions,
            fonctionLibelle: data.fonctionLibelle || 'Directeur Société Promotrice',
            avatarUrl: data.avatarUrl,
            matricule: data.matricule
          };

          this.setAuthenticatedUser(authUser);
          this.router.navigate(['/societe/dashboard']);
          return;
        }

        // 3. Cas de l'Agent Collaborateur Terrain (Non responsable) -> Bloqué sur le Web
        if (isAgent && !isResponsable) {
          this.clearStorage();
          const mobileOnlyError = 'Votre compte agent terrain est accessible uniquement depuis l\'application mobile.';
          this.state.update(s => ({ ...s, isLoading: false, error: mobileOnlyError, user: null }));
          throw new Error(mobileOnlyError);
        }

        // 4. Tout autre rôle (ex: acquéreur) -> Refusé
        this.clearStorage();
        const unauthorizedError = 'Accès refusé : votre profil n\'est pas habilité à accéder à cette interface d\'administration.';
        this.state.update(s => ({ ...s, isLoading: false, error: unauthorizedError, user: null }));
        throw new Error(unauthorizedError);
      }),
      catchError((error: HttpErrorResponse | Error) => {
        let errorMsg = 'Numéro de téléphone ou mot de passe incorrect.';

        if (error instanceof Error && error.message) {
          errorMsg = error.message;
        } else if (error instanceof HttpErrorResponse) {
          if (error.error?.message) {
            errorMsg = error.error.message;
          } else if (error.status === 401) {
            errorMsg = 'Identifiants invalides. Veuillez vérifier votre numéro et mot de passe.';
          } else if (error.status === 403) {
            errorMsg = 'Votre compte n\'est pas autorisé ou est en attente d\'agrément.';
          } else if (error.status === 0) {
            errorMsg = 'Impossible de contacter le serveur d\'authentification (Foncierback).';
          }
        }

        this.state.update(s => ({ ...s, isLoading: false, error: errorMsg }));
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Enregistre un dossier d'agrément pour une société promotrice et crée le compte responsable initial
   * Accessible publiquement via POST /api/auth/register-societe
   */
  registerSociete(payload: RegisterSocieteRequest): Observable<ApiResponse<RegisterSocieteResponse>> {
    return this.http.post<ApiResponse<RegisterSocieteResponse>>(`${this.API_URL}/register-societe`, payload).pipe(
      catchError((error: HttpErrorResponse | Error) => {
        let errorMsg = "Échec de l'enregistrement de la société.";
        if (error instanceof HttpErrorResponse) {
          if (error.error?.message) {
            errorMsg = error.error.message;
          } else if (error.status === 409) {
            errorMsg = "Un compte ou une société avec ces identifiants (téléphone, agrément ou NIF) existe déjà.";
          } else if (error.status === 400) {
            errorMsg = "Les informations fournies sont incomplètes ou invalides.";
          } else if (error.status === 0) {
            errorMsg = "Impossible de joindre le serveur Foncierback.";
          }
        } else if (error instanceof Error && error.message) {
          errorMsg = error.message;
        }
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Détermine la route autorisée pour un utilisateur donné
   */
  getAuthorizedDashboardRoute(user: AuthUser | null = this.state().user): string {
    if (!user) return '/auth/login';

    if (this.isPlatformAdmin()) {
      return '/admin/dashboard';
    }

    if (this.isResponsableSociete()) {
      return '/societe/dashboard';
    }

    return '/auth/login';
  }

  /**
   * Décode de façon sécurisée le JWT Payload sans dépendance externe
   */
  decodeTokenPayload(token: string): JwtTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload) as JwtTokenPayload;
    } catch {
      return null;
    }
  }

  setAuthenticatedUser(user: AuthUser | null): void {
    if (user) {
      localStorage.setItem(this.TOKEN_KEY, user.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.state.update(s => ({ ...s, user, isLoading: false, error: null }));
    } else {
      this.clearStorage();
      this.state.set({ user: null, isLoading: false, error: null });
    }
  }

  /**
   * Déconnexion complète et purge de session
   */
  logout(): void {
    this.clearStorage();
    this.state.set({ user: null, isLoading: false, error: null });
    this.router.navigate(['/auth/login']);
  }

  private clearStorage(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('foncier_token');
    localStorage.removeItem('foncier_user');
    localStorage.removeItem('foncier_user_session');
  }

  /**
   * Récupère le jeton JWT courant
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY) || localStorage.getItem('foncier_token');
  }
}
