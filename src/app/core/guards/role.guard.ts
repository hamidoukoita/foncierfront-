import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard pour l'Administration Souveraine Plateforme (DNCG).
 * Bloqué pour tout le monde SAUF l'Administrateur Plateforme.
 */
export const adminPlatformGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  if (authService.isPlatformAdmin()) {
    return true;
  }

  // Tentative non autorisée : redirection vers la page d'accès refusé 403
  return router.createUrlTree(['/access-denied'], {
    queryParams: {
      roleRequis: 'ADMIN_PLATEFORME',
      tentative: state.url
    }
  });
};

/**
 * Guard pour la Direction Société Promotrice Agréée.
 * Accessible UNIQUEMENT par l'Agent Promoteur Responsable (estResponsableSociete = true).
 */
export const promoteurResponsableGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  if (authService.isResponsableSociete()) {
    return true;
  }

  return router.createUrlTree(['/access-denied'], {
    queryParams: {
      roleRequis: 'AGENT_PROMOTEUR_RESPONSABLE',
      tentative: state.url
    }
  });
};

/**
 * Alias de compatibilité
 */
export const adminGuard: CanActivateFn = adminPlatformGuard;
export const societeGuard: CanActivateFn = promoteurResponsableGuard;
