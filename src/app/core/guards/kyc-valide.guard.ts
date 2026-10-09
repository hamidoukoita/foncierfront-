import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { KycService } from '../services/kyc.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const kycValideGuard: CanActivateFn = (route, state) => {
  const kycService = inject(KycService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si on n'est pas authentifié, on laisse l'authGuard gérer
  if (!authService.isAuthenticated()) {
    return true;
  }

  // Si l'utilisateur est admin, le KYC ne le concerne pas pour naviguer (normalement il n'a pas accès à /societe/* de toute façon)
  if (authService.isPlatformAdmin()) {
    return true;
  }

  return kycService.getStatut().pipe(
    map(response => {
      if (response.statutAgrement === 'VERIFIER') {
        return true;
      }
      return router.createUrlTree(['/societe/kyc-attente']);
    }),
    catchError(() => {
      // En cas d'erreur de récupération, par sécurité on redirige vers l'attente
      return of(router.createUrlTree(['/societe/kyc-attente']));
    })
  );
};
