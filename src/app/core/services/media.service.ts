import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LienPanorama, LienPanoramaRequest, MediaCible, MediaFoncier, TypeMedia } from '../models/media.models';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Accès à l'API /api/medias : photos, panoramas 360° et points de passage de la visite virtuelle. */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly API_BASE = 'http://localhost:8080/api';
  /** Les fichiers sont servis à la racine du backend (/uploads/medias/…), hors du préfixe /api. */
  private readonly FILES_BASE = 'http://localhost:8080';

  list(cible: MediaCible): Observable<MediaFoncier[]> {
    return this.http
      .get<ApiResponse<MediaFoncier[]>>(`${this.API_BASE}/medias/${cible.kind}/${cible.id}`)
      .pipe(map((res) => (Array.isArray(res.data) ? res.data : [])));
  }

  /** Envoi d'un fichier (photo ou panorama) avec progression. */
  envoyerFichier(cible: MediaCible, fichier: File, type: TypeMedia, titre: string): Observable<HttpEvent<ApiResponse<MediaFoncier>>> {
    const form = new FormData();
    form.append('file', fichier, fichier.name);
    form.append('type', type);
    if (titre.trim()) form.append('titre', titre.trim());
    return this.http.post<ApiResponse<MediaFoncier>>(`${this.API_BASE}/medias/${cible.kind}/${cible.id}/fichier`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /** Fait de cette photo la couverture de sa cité ou de son bien. */
  definirCouverture(id: number): Observable<MediaFoncier> {
    return this.http
      .patch<ApiResponse<MediaFoncier>>(`${this.API_BASE}/medias/${id}/couverture`, {})
      .pipe(map((res) => res.data));
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.API_BASE}/medias/${id}`).pipe(map(() => undefined));
  }

  // ---------- Visite virtuelle : points de passage entre panoramas d'une maison ----------

  liens(bienId: number): Observable<LienPanorama[]> {
    return this.http
      .get<ApiResponse<LienPanorama[]>>(`${this.API_BASE}/medias/bien/${bienId}/liens`)
      .pipe(map((res) => (Array.isArray(res.data) ? res.data : [])));
  }

  /** Crée le point (et le retour si demandé) ; renvoie les points créés. */
  creerLien(requete: LienPanoramaRequest): Observable<LienPanorama[]> {
    return this.http
      .post<ApiResponse<LienPanorama[]>>(`${this.API_BASE}/medias/liens`, requete)
      .pipe(map((res) => res.data ?? []));
  }

  modifierLien(id: number, requete: LienPanoramaRequest): Observable<LienPanorama> {
    return this.http
      .put<ApiResponse<LienPanorama>>(`${this.API_BASE}/medias/liens/${id}`, requete)
      .pipe(map((res) => res.data));
  }

  supprimerLien(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.API_BASE}/medias/liens/${id}`).pipe(map(() => undefined));
  }

  /** URL utilisable dans une balise <img> ou une texture WebGL. */
  urlAbsolue(media: MediaFoncier): string {
    return `${this.FILES_BASE}${media.url}`;
  }
}
