import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard vérifiant si l'utilisateur possède une session active valide.
 * En cas d'échec, redirige vers /auth/login avec conservation de l'URL cible.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    if (authService.isPlatformAdmin() || authService.isResponsableSociete()) {
      return true;
    }
    authService.logout();
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
};

/**
 * Guard empêchant un utilisateur déjà authentifié d'accéder aux pages de login/auth.
 * Redirige automatiquement vers son tableau de bord spécifique selon son rôle.
 * Protège contre les boucles infinies si le rôle n'a pas de dashboard web.
 */
export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const targetDashboard = authService.getAuthorizedDashboardRoute();
    if (targetDashboard && targetDashboard !== '/auth/login') {
      return router.createUrlTree([targetDashboard]);
    }
    authService.logout();
  }

  return true;
};

