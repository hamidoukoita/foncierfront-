import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Intercepteur HTTP moderne Angular 17+ (HttpInterceptorFn)
 * - Injecte automatiquement l'en-tête Authorization: Bearer <token> sur toutes les requêtes vers le backend
 * - Intercepte les statuts 401 (Jeton expiré ou session invalide) pour déconnecter proprement
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Ne pas ajouter le token pour la requête de login initiale
  const isAuthRequest = req.url.includes('/api/auth/login');

  let authReq = req;
  if (token && !isAuthRequest) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401: Jeton expiré ou non authentifié -> Déconnexion automatique
      if (error.status === 401 && !isAuthRequest) {
        console.warn('[JwtInterceptor] Erreur HTTP 401 (Session expirée). Déconnexion automatique.');
        authService.logout();
        router.navigate(['/auth/login'], {
          queryParams: {
            reason: 'session_expiree'
          }
        });
      }
      return throwError(() => error);
    })
  );
};
