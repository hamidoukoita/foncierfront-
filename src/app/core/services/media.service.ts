import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MediaCible, MediaFoncier, TypeMedia } from '../models/media.models';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Accès à l'API /api/medias : photos, panoramas 360° et visites virtuelles. */
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
  envoyerFichier(cible: MediaCible, fichier: File, type: Exclude<TypeMedia, 'VISITE_VIRTUELLE'>, titre: string): Observable<HttpEvent<ApiResponse<MediaFoncier>>> {
    const form = new FormData();
    form.append('file', fichier, fichier.name);
    form.append('type', type);
    if (titre.trim()) form.append('titre', titre.trim());
    return this.http.post<ApiResponse<MediaFoncier>>(`${this.API_BASE}/medias/${cible.kind}/${cible.id}/fichier`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  ajouterLien(cible: MediaCible, lienExterne: string, titre: string): Observable<MediaFoncier> {
    return this.http
      .post<ApiResponse<MediaFoncier>>(`${this.API_BASE}/medias/${cible.kind}/${cible.id}/lien`, {
        lienExterne: lienExterne.trim(),
        titre: titre.trim() || undefined,
      })
      .pipe(map((res) => res.data));
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.API_BASE}/medias/${id}`).pipe(map(() => undefined));
  }

  /** URL utilisable dans une balise <img>, une texture WebGL ou une iframe. */
  urlAbsolue(media: MediaFoncier): string {
    return media.type === 'VISITE_VIRTUELLE' ? media.url : `${this.FILES_BASE}${media.url}`;
  }
}
