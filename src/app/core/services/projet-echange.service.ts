import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackendApiResponse } from '../models/backend.models';
import {
  ElementFil,
  MessageProjet,
  PropositionProjet,
  PropositionProjetRequest,
} from '../models/projet-echange.models';
import { FichierProjet } from '../models/societe.models';

/** Discussion avec l'acquéreur sur un projet de construction : messages et propositions. */
@Injectable({ providedIn: 'root' })
export class ProjetEchangeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/projets-construction`;

  fil(projetId: number): Observable<ElementFil[]> {
    return this.http
      .get<BackendApiResponse<ElementFil[]>>(`${this.base}/${projetId}/fil`)
      .pipe(map((res) => (Array.isArray(res.data) ? res.data : [])));
  }

  envoyerMessage(projetId: number, texte: string): Observable<MessageProjet> {
    return this.http
      .post<BackendApiResponse<MessageProjet>>(`${this.base}/${projetId}/messages`, { texte })
      .pipe(map((res) => res.data));
  }

  proposer(projetId: number, request: PropositionProjetRequest): Observable<PropositionProjet> {
    return this.http
      .post<BackendApiResponse<PropositionProjet>>(`${this.base}/${projetId}/propositions`, request)
      .pipe(map((res) => res.data));
  }

  joindrePlan(propositionId: number, fichier: File): Observable<FichierProjet> {
    const form = new FormData();
    form.append('fichier', fichier, fichier.name);
    return this.http
      .post<BackendApiResponse<FichierProjet>>(`${this.base}/propositions/${propositionId}/plans`, form)
      .pipe(map((res) => res.data));
  }
}
