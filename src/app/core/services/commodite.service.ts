import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BackendApiResponse } from '../models/backend.models';
import {
  Commodite,
  CommoditeRequest,
  ProximiteCommodite,
  ProximiteCommoditeRequest,
  TypeCommodite,
  TypeCommoditeRequest,
} from '../models/commodite.models';
import { SocieteService } from './societe.service';

/**
 * Référentiel des commodités :
 * - types (administrateur plateforme),
 * - commodités et rattachements avec distance (société promotrice).
 */
@Injectable({ providedIn: 'root' })
export class CommoditeService {
  private readonly http = inject(HttpClient);
  private readonly societeService = inject(SocieteService);
  private readonly api = environment.apiUrl;

  readonly types = signal<TypeCommodite[]>([]);
  readonly commodites = signal<Commodite[]>([]);
  readonly proximites = signal<ProximiteCommodite[]>([]);

  // ---------- Types (administrateur) ----------

  loadTypes(): Observable<TypeCommodite[]> {
    return this.http
      .get<BackendApiResponse<TypeCommodite[]>>(`${this.api}/types-commodite`)
      .pipe(
        map((res) => res.data ?? []),
        tap((list) => this.types.set(list)),
      );
  }

  saveType(request: TypeCommoditeRequest, id?: number): Observable<TypeCommodite | null> {
    const call$ = id
      ? this.http.put<BackendApiResponse<TypeCommodite>>(`${this.api}/types-commodite/${id}`, request)
      : this.http.post<BackendApiResponse<TypeCommodite>>(`${this.api}/types-commodite`, request);
    return call$.pipe(
      map((res) => res.data ?? null),
      tap(() => this.loadTypes().subscribe()),
    );
  }

  deleteType(id: number): Observable<void> {
    return this.http.delete<BackendApiResponse<void>>(`${this.api}/types-commodite/${id}`).pipe(
      map(() => undefined),
      tap(() => this.types.update((list) => list.filter((t) => t.id !== id))),
    );
  }

  // ---------- Commodités de la société ----------

  loadCommodites(): Observable<Commodite[]> {
    const societeId = this.societeService.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société introuvable dans la session.'));
    return this.http
      .get<BackendApiResponse<Commodite[]>>(`${this.api}/commodites/societe/${societeId}`)
      .pipe(
        map((res) => res.data ?? []),
        tap((list) => this.commodites.set(list)),
        catchError((err) => {
          console.error('[CommoditeService] loadCommodites:', err);
          this.commodites.set([]);
          return throwError(() => err);
        }),
      );
  }

  saveCommodite(request: CommoditeRequest, id?: number): Observable<Commodite | null> {
    const payload = { ...request, societeId: this.societeService.getSocieteId() };
    const call$ = id
      ? this.http.put<BackendApiResponse<Commodite>>(`${this.api}/commodites/${id}`, payload)
      : this.http.post<BackendApiResponse<Commodite>>(`${this.api}/commodites`, payload);
    return call$.pipe(
      map((res) => res.data ?? null),
      tap(() => {
        this.loadCommodites().subscribe();
        this.loadProximites().subscribe();
      }),
    );
  }

  deleteCommodite(id: number): Observable<void> {
    return this.http.delete<BackendApiResponse<void>>(`${this.api}/commodites/${id}`).pipe(
      map(() => undefined),
      tap(() => {
        this.commodites.update((list) => list.filter((c) => c.id !== id));
        this.proximites.update((list) => list.filter((p) => p.commodite.id !== id));
      }),
    );
  }

  // ---------- Rattachements (distance à une cité / parcelle) ----------

  loadProximites(): Observable<ProximiteCommodite[]> {
    const societeId = this.societeService.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société introuvable dans la session.'));
    return this.http
      .get<BackendApiResponse<ProximiteCommodite[]>>(`${this.api}/proximites-commodites/societe/${societeId}`)
      .pipe(
        map((res) => res.data ?? []),
        tap((list) => this.proximites.set(list)),
        catchError((err) => {
          console.error('[CommoditeService] loadProximites:', err);
          this.proximites.set([]);
          // Ne bloque pas toute la page : liste vide acceptable
          return of([]);
        }),
      );
  }

  saveProximite(request: ProximiteCommoditeRequest, id?: number): Observable<ProximiteCommodite | null> {
    const call$ = id
      ? this.http.put<BackendApiResponse<ProximiteCommodite>>(`${this.api}/proximites-commodites/${id}`, request)
      : this.http.post<BackendApiResponse<ProximiteCommodite>>(`${this.api}/proximites-commodites`, request);
    return call$.pipe(
      map((res) => res.data ?? null),
      tap(() => this.loadProximites().subscribe()),
    );
  }

  deleteProximite(id: number): Observable<void> {
    return this.http.delete<BackendApiResponse<void>>(`${this.api}/proximites-commodites/${id}`).pipe(
      map(() => undefined),
      tap(() => this.proximites.update((list) => list.filter((p) => p.id !== id))),
    );
  }
}
