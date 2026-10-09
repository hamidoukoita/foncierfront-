import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DocumentKycResponse, DossierKycStatusResponse, TypeDocumentKyc } from '../models/kyc.models';

@Injectable({
  providedIn: 'root'
})
export class KycService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/societes/kyc`;

  getStatut(): Observable<DossierKycStatusResponse> {
    return this.http.get<DossierKycStatusResponse>(`${this.API_URL}/statut`);
  }

  uploadDocument(file: File, type: TypeDocumentKyc): Observable<DocumentKycResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return this.http.post<DocumentKycResponse>(`${this.API_URL}/upload`, formData);
  }

  soumettreDossier(): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/soumettre`, {});
  }
}
