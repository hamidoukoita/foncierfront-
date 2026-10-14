import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BackendApiResponse } from '../models/backend.models';
import { MaisonCleEnMain, MaisonCleEnMainRequest } from '../models/maison.models';
import { SocieteService } from './societe.service';

/** Maisons clés en main de la société connectée. */
@Injectable({ providedIn: 'root' })
export class MaisonsService {
  private readonly http = inject(HttpClient);
  private readonly societeService = inject(SocieteService);
  private readonly base = `${environment.apiUrl}/maisons-cle-en-main`;

  readonly maisons = signal<MaisonCleEnMain[]>([]);

  charger(): Observable<MaisonCleEnMain[]> {
    const societeId = this.societeService.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));
    return this.http.get<BackendApiResponse<MaisonCleEnMain[]>>(`${this.base}/societe/${societeId}`).pipe(
      map((res) => (res.data ?? []).map((m) => ({ ...m, equipements: m.equipements ?? [], commodites: m.commodites ?? [] }))),
      tap((liste) => this.maisons.set(liste)),
    );
  }

  creer(maison: MaisonCleEnMainRequest): Observable<MaisonCleEnMain> {
    return this.http
      .post<BackendApiResponse<MaisonCleEnMain>>(this.base, maison)
      .pipe(map((res) => res.data), tap(() => this.charger().subscribe()));
  }

  modifier(id: number, maison: MaisonCleEnMainRequest): Observable<MaisonCleEnMain> {
    return this.http
      .put<BackendApiResponse<MaisonCleEnMain>>(`${this.base}/${id}`, maison)
      .pipe(map((res) => res.data), tap(() => this.charger().subscribe()));
  }

  supprimer(id: number): Observable<void> {
    return this.http
      .delete<BackendApiResponse<void>>(`${this.base}/${id}`)
      .pipe(map(() => undefined), tap(() => this.maisons.update((l) => l.filter((m) => m.id !== id))));
  }
}
