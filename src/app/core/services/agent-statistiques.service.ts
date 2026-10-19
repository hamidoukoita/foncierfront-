import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BackendApiResponse } from '../models/backend.models';
import {
  AgentStatistiques,
  DossierAgent,
  PageHistorique,
  PeriodeStatistiques,
  VisiteAgent,
} from '../models/agent-statistiques.models';

/**
 * Activité d'un agent collaborateur, consultée par le responsable de la société :
 * indicateurs (légers, calculés par la base) et historique paginé, chargés séparément.
 */
@Injectable({ providedIn: 'root' })
export class AgentStatistiquesService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/agents-promoteurs`;
  /** Dernières données reçues par agent et période : affichées aussitôt, puis rafraîchies. */
  private readonly cache = new Map<string, AgentStatistiques>();

  enCache(agentId: number, periode: PeriodeStatistiques): AgentStatistiques | undefined {
    return this.cache.get(`${agentId}:${periode}`);
  }

  charger(agentId: number, periode: PeriodeStatistiques): Observable<AgentStatistiques> {
    const params = new HttpParams().set('periode', periode);
    return this.http
      .get<BackendApiResponse<AgentStatistiques>>(`${this.API_URL}/${agentId}/statistiques`, { params })
      .pipe(
        map((res) => res.data),
        tap((stats) => this.cache.set(`${agentId}:${periode}`, stats)),
      );
  }

  dossiers(agentId: number, periode: PeriodeStatistiques, page: number, taille: number): Observable<PageHistorique<DossierAgent>> {
    return this.page<DossierAgent>(agentId, 'dossiers', periode, page, taille);
  }

  visites(agentId: number, periode: PeriodeStatistiques, page: number, taille: number): Observable<PageHistorique<VisiteAgent>> {
    return this.page<VisiteAgent>(agentId, 'visites', periode, page, taille);
  }

  private page<T>(
    agentId: number,
    liste: 'dossiers' | 'visites',
    periode: PeriodeStatistiques,
    page: number,
    taille: number,
  ): Observable<PageHistorique<T>> {
    const params = new HttpParams().set('periode', periode).set('page', page).set('taille', taille);
    return this.http
      .get<BackendApiResponse<PageHistorique<T>>>(`${this.API_URL}/${agentId}/${liste}`, { params })
      .pipe(map((res) => res.data));
  }
}
