import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../services/auth.service';
import { 
  adminPlatformGuard, 
  promoteurResponsableGuard 
} from './role.guard';
import { AuthUser, UserRole } from '../models/auth.models';

describe('Role Guards - Cloisonnement strict des 2 accès Web', () => {
  let authService: AuthService;
  let router: Router;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const createMockState = (url: string) => ({ url } as RouterStateSnapshot);

  const mockAdminUser: AuthUser = {
    id: 1,
    telephone: '70000000',
    nom: 'Diallo',
    prenom: 'Admin',
    email: 'admin@foncierplus.ml',
    role: UserRole.ROLE_ADMIN,
    estResponsableSociete: false,
    token: 'jwt-admin'
  };

  const mockPromoteurUser: AuthUser = {
    id: 2,
    telephone: '71000000',
    nom: 'Traoré',
    prenom: 'Moussa',
    email: 'moussa@sema-sa.ml',
    role: UserRole.ROLE_AGENT_PROMOTEUR,
    estResponsableSociete: true,
    societeId: 10,
    societeNom: 'SEMA SA',
    token: 'jwt-promoteur'
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/dashboard', children: [] },
          { path: 'societe/dashboard', children: [] },
          { path: 'access-denied', children: [] },
          { path: 'auth/login', children: [] }
        ])
      ]
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('adminPlatformGuard', () => {
    it('devrait autoriser l\'accès pour un Administrateur Plateforme', () => {
      authService.setAuthenticatedUser(mockAdminUser);
      const result = TestBed.runInInjectionContext(() => adminPlatformGuard(mockRoute, createMockState('/admin/dashboard')));
      expect(result).toBe(true);
    });

    it('devrait bloquer et renvoyer vers /access-denied si l\'utilisateur est un Promoteur Responsable', () => {
      authService.setAuthenticatedUser(mockPromoteurUser);
      const result = TestBed.runInInjectionContext(() => adminPlatformGuard(mockRoute, createMockState('/admin/dashboard')));
      expect(result instanceof UrlTree).toBe(true);
      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toContain('/access-denied');
    });

    it('devrait bloquer et renvoyer vers /auth/login si l\'utilisateur n\'est pas authentifié', () => {
      authService.setAuthenticatedUser(null);
      const result = TestBed.runInInjectionContext(() => adminPlatformGuard(mockRoute, createMockState('/admin/dashboard')));
      expect(result instanceof UrlTree).toBe(true);
      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toContain('/auth/login');
    });
  });

  describe('promoteurResponsableGuard', () => {
    it('devrait autoriser l\'accès pour un Promoteur Responsable', () => {
      authService.setAuthenticatedUser(mockPromoteurUser);
      const result = TestBed.runInInjectionContext(() => promoteurResponsableGuard(mockRoute, createMockState('/societe/dashboard')));
      expect(result).toBe(true);
    });

    it('devrait bloquer un Administrateur Plateforme et renvoyer vers /access-denied', () => {
      authService.setAuthenticatedUser(mockAdminUser);
      const result = TestBed.runInInjectionContext(() => promoteurResponsableGuard(mockRoute, createMockState('/societe/dashboard')));
      expect(result instanceof UrlTree).toBe(true);
      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toContain('/access-denied');
    });

    it('devrait bloquer et renvoyer vers /auth/login si non authentifié', () => {
      authService.setAuthenticatedUser(null);
      const result = TestBed.runInInjectionContext(() => promoteurResponsableGuard(mockRoute, createMockState('/societe/dashboard')));
      expect(result instanceof UrlTree).toBe(true);
      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toContain('/auth/login');
    });
  });
});
