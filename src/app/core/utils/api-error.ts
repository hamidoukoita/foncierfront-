import { HttpErrorResponse } from '@angular/common/http';

export const MESSAGE_SERVEUR_INJOIGNABLE = 'Impossible de joindre le serveur Foncier+. Vérifiez votre connexion puis réessayez.';
export const MESSAGE_ERREUR_SERVEUR = 'Le serveur rencontre un problème. Veuillez réessayer dans un instant.';

/**
 * Message lisible extrait d'une erreur HTTP du backend Foncier+.
 * Les erreurs serveur (5xx) et réseau ont un message fixe : aucun détail technique n'est affiché.
 */
export function messageErreurApi(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return MESSAGE_SERVEUR_INJOIGNABLE;
    if (error.status >= 500) return MESSAGE_ERREUR_SERVEUR;
    const body = error.error as { message?: string; errors?: Record<string, string> } | null;
    const detail = body?.errors ? Object.values(body.errors).join(' ') : '';
    return body?.message || detail || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
