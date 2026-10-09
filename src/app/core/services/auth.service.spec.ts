import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';
import { LoginResponse } from '../models/auth.models';

describe('AuthService - Cloisonnement strict des 2 rôles Web et Authentification', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: { navigate: (commands: string[]) => Promise<boolean> };

  beforeEach(() => {
    localStorage.clear();
    router = {
      navigate: vi.fn().mockResolvedValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('devrait être initialisé sans utilisateur si aucun token valide', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isPlatformAdmin()).toBe(false);
    expect(service.isResponsableSociete()).toBe(false);
  });

  it('devrait authentifier un Administrateur Plateforme et rediriger vers /admin/dashboard', () => {
    const mockAdminResponse: LoginResponse = {
      token: 'jwt-admin-token',
      type: 'Bearer',
      id: 1,
      telephone: '70000000',
      nom: 'Diallo',
      prenom: 'Admin',
      role: 'ADMIN',
      permissions: ['ROLE_ADMIN']
    };

    service.login({ telephone: '70000000', motDePasse: 'admin123' }).subscribe(() => {
      const user = service.currentUser();
      expect(user).not.toBeNull();
      expect(user?.role).toBe('ADMIN');
      expect(user?.nom).toBe('Diallo');
      expect(service.isPlatformAdmin()).toBe(true);
      expect(service.isResponsableSociete()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'Connexion réussie', data: mockAdminResponse });
  });

  it('devrait authentifier un Agent Promoteur Responsable et rediriger vers /societe/dashboard', () => {
    const mockPromoteurResponse: LoginResponse = {
      token: 'jwt-promoteur-token',
      type: 'Bearer',
      id: 2,
      telephone: '71000000',
      nom: 'Traoré',
      prenom: 'Moussa',
      role: 'AGENT',
      societeId: 10,
      societeNom: 'SEMA SA',
      estResponsableSociete: true,
      permissions: ['RESPONSABLE_SOCIETE']
    };

    service.login({ telephone: '71000000', motDePasse: 'pass123' }).subscribe(() => {
      const user = service.currentUser();
      expect(user).not.toBeNull();
      expect(user?.role).toBe('AGENT_PROMOTEUR');
      expect(user?.estResponsableSociete).toBe(true);
      expect(user?.societeNom).toBe('SEMA SA');
      expect(service.isPlatformAdmin()).toBe(false);
      expect(service.isResponsableSociete()).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/societe/dashboard']);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'Connexion réussie', data: mockPromoteurResponse });
  });

  it('devrait REJETER un agent non-responsable avec le message strict exigeant l\'application mobile', () => {
    const mockAgentNonResponsable: LoginResponse = {
      token: 'jwt-agent-token',
      type: 'Bearer',
      id: 3,
      telephone: '72000000',
      nom: 'Coulibaly',
      prenom: 'Terrain',
      role: 'AGENT',
      societeId: 10,
      estResponsableSociete: false,
      permissions: []
    };

    service.login({ telephone: '72000000', motDePasse: 'pass123' }).subscribe({
      next: () => {
        expect.unreachable('La connexion d\'un agent non-responsable sur le web aurait dû être rejetée');
      },
      error: (err: Error) => {
        expect(err.message).toBe("Votre compte agent terrain est accessible uniquement depuis l'application mobile.");
        expect(service.currentUser()).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
        expect(localStorage.getItem('foncier_jwt_token')).toBeNull();
      }
    });

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'Connexion réussie', data: mockAgentNonResponsable });
  });

  it('devrait vider la session et rediriger vers /auth/login lors du logout', () => {
    // Simuler une session active
    localStorage.setItem('foncier_jwt_token', 'sample-token');
    localStorage.setItem('foncier_user_session', JSON.stringify({
      id: 1,
      telephone: '70000000',
      nom: 'Test',
      prenom: 'User',
      role: 'ADMIN',
      token: 'sample-token'
    }));

    service.logout();

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('foncier_jwt_token')).toBeNull();
    expect(localStorage.getItem('foncier_user_session')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
