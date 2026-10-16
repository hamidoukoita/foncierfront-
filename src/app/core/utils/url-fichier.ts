import { environment } from '../../../environments/environment';

/** Origine du backend : les fichiers sont servis à sa racine (/uploads/…), hors du préfixe /api. */
const ORIGINE_FICHIERS = environment.apiUrl.replace(/\/api\/?$/, '');

/** URL utilisable dans une balise <img> pour un chemin renvoyé par l'API. */
export function urlFichier(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return url.startsWith('/') ? `${ORIGINE_FICHIERS}${url}` : url;
}
