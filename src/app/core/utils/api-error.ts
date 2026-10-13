import { HttpErrorResponse } from '@angular/common/http';

/** Message lisible extrait d'une erreur HTTP du backend Foncier+. */
export function messageErreurApi(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; errors?: Record<string, string> } | null;
    const detail = body?.errors ? Object.values(body.errors).join(' ') : '';
    return body?.message || detail || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
