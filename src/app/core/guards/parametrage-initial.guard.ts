import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { SocieteService } from '../services/societe.service';

/**
 * Première connexion d'une société agréée : propose l'assistant (logo, règles de réservation)
 * avant le tableau de bord, tant qu'il n'a été ni terminé ni passé.
 * En cas d'erreur de chargement du profil, on n'empêche pas l'accès au tableau de bord.
 */
export const parametrageInitialGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const societeService = inject(SocieteService);
  const router = inject(Router);

  if (!authService.isAuthenticated() || authService.isPlatformAdmin()) return true;

  return societeService.getProfilSociete().pipe(
    map((profil) =>
      profil && profil.agrementStatut === 'VALIDE_MINISTERE' && !profil.parametrageInitialFait
        ? router.createUrlTree(['/societe/bienvenue'])
        : true,
    ),
    catchError(() => of(true)),
  );
};
