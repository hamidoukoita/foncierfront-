import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  BackendApiResponse, 
  ProgrammeFoncierBackend, 
  SocietePromotriceBackend, 
  UtilisateurBackend, 
  ParcelleIndividuelleBackend,
  AdministrateurRequestBackend,
  AdministrateurResponseBackend
} from '../models/backend.models';

@Injectable({
  providedIn: 'root'
})
export class SuperAdminService {
  private readonly http = inject(HttpClient);
  private readonly API_BASE = environment.apiUrl;

  readonly societes = signal<SocietePromotriceBackend[]>([]);
  readonly programmes = signal<ProgrammeFoncierBackend[]>([]);
  readonly parcelles = signal<ParcelleIndividuelleBackend[]>([]);
  readonly utilisateurs = signal<UtilisateurBackend[]>([]);
  readonly isLoading = signal<boolean>(false);

  // --- COMPUTES & METRIQUES ADMIN DYNAMIQUES ---
  readonly societesEnAttente = computed(() => {
    return this.societes().filter(s => s.statutAgrement === 'EN_ATTENTE');
  });

  readonly societesValidees = computed(() => {
    return this.societes().filter(s => s.statutAgrement === 'VERIFIER');
  });

  readonly societesRefusees = computed(() => {
    return this.societes().filter(s => s.statutAgrement === 'REFUSER');
  });

  readonly countSocietesEnAttente = computed(() => this.societesEnAttente().length);
  readonly countSocietesValidees = computed(() => this.societesValidees().length);
  readonly countSocietesRefusees = computed(() => this.societesRefusees().length);
  readonly totalSocietes = computed(() => this.societes().length);

  readonly tauxHomologation = computed(() => {
    const total = this.totalSocietes();
    if (total === 0) return 100;
    const valides = this.countSocietesValidees();
    return Math.round((valides / total) * 100);
  });

  /**
   * Charge toutes les sociétés promotrices depuis la base de données
   */
  loadSocietes(): Observable<SocietePromotriceBackend[]> {
    this.isLoading.set(true);
    return this.http.get<BackendApiResponse<SocietePromotriceBackend[]>>(`${this.API_BASE}/societes-promotrices`).pipe(
      map(res => res.data || []),
      tap(data => {
        const enriched: SocietePromotriceBackend[] = data.map(s => ({
          ...s,
          formeJuridique: s.formeJuridique || (s.nom.toUpperCase().includes('SARL') ? 'SARL' : (s.nom.toUpperCase().includes('SA') ? 'Société Anonyme (S.A)' : 'Entreprise Agréée')),
          representantLegal: s.representantLegal || 'Représentant Déclaré',
          documentKycNom: s.documentKycNom || `Dossier_Agrement_${s.nom.replace(/[\s.()]/g, '_')}.pdf`,
          dateRelative: s.statutAgrement === 'VERIFIER' ? 'Agréée' : (s.statutAgrement === 'REFUSER' ? 'Dossier rejeté' : 'En attente d’audit')
        }));
        this.societes.set(enriched);
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.error('[SuperAdminService] Erreur chargement societes:', err);
        this.isLoading.set(false);
        return of(this.societes());
      })
    );
  }

  /**
   * Valide et homologue l'agrément d'une société en BDD
   */
  validerSociete(id: number): Observable<void> {
    return this.http.post<void>(`${this.API_BASE}/admin/kyc/${id}/valider`, {}).pipe(
      tap(() => {
        this.societes.update(list => list.map(s => s.id === id ? { ...s, statutAgrement: 'VERIFIER' } : s));
      })
    );
  }

  /**
   * Rejette le dossier d'agrément d'une société en BDD avec enregistrement du motif
   */
  refuserSociete(id: number, motif: string): Observable<void> {
    return this.http.post<void>(`${this.API_BASE}/admin/kyc/${id}/rejeter`, { motif }).pipe(
      tap(() => {
        this.societes.update(list => list.map(s => s.id === id ? { ...s, statutAgrement: 'REFUSER', description: motif } : s));
      })
    );
  }

  getKycDocuments(id: number): Observable<any> {
    return this.http.get<any>(`${this.API_BASE}/admin/kyc/societes/${id}/documents`);
  }

  /**
   * Charge les programmes fonciers depuis la base de données
   */
  loadProgrammes(): Observable<ProgrammeFoncierBackend[]> {
    return this.http.get<BackendApiResponse<ProgrammeFoncierBackend[]>>(`${this.API_BASE}/programmes-fonciers`).pipe(
      map(res => res.data || []),
      tap(data => this.programmes.set(data)),
      catchError(err => {
        console.error('[SuperAdminService] Erreur chargement programmes:', err);
        return of(this.programmes());
      })
    );
  }

  /**
   * Charge les parcelles individuelles depuis la base de données
   */
  loadParcelles(): Observable<ParcelleIndividuelleBackend[]> {
    return this.http.get<BackendApiResponse<ParcelleIndividuelleBackend[]>>(`${this.API_BASE}/parcelles-individuelles`).pipe(
      map(res => res.data || []),
      tap(data => this.parcelles.set(data)),
      catchError(err => {
        console.error('[SuperAdminService] Erreur chargement parcelles:', err);
        return of(this.parcelles());
      })
    );
  }

  /**
   * Charge la liste des utilisateurs réels depuis la base de données
   */
  loadUtilisateurs(): Observable<UtilisateurBackend[]> {
    return this.http.get<BackendApiResponse<UtilisateurBackend[]>>(`${this.API_BASE}/utilisateurs`).pipe(
      map(res => res.data || []),
      tap(data => {
        const enriched: UtilisateurBackend[] = data.map(u => {
          const typeStr = (u.typeUtilisateur || '').toUpperCase();
          let roleLibelle = 'Acquéreur';
          let entite = '— Indépendant —';

          if (typeStr.includes('ADMIN')) {
            roleLibelle = 'Super Admin';
            entite = 'Administration Plateforme';
          } else if (typeStr.includes('AGENT') || typeStr.includes('PROMOTEUR')) {
            roleLibelle = 'Agent Promoteur';
            entite = 'Société Partenaire';
          }

          return {
            ...u,
            entiteRattachee: entite,
            roleLibelle: roleLibelle
          };
        });
        this.utilisateurs.set(enriched);
      }),
      catchError(err => {
        console.error('[SuperAdminService] Erreur chargement utilisateurs:', err);
        return of(this.utilisateurs());
      })
    );
  }

  /**
   * Bascule le statut d'un compte utilisateur (ACTIF <-> SUSPENDU)
   */
  toggleStatutUtilisateur(id: number): Observable<UtilisateurBackend> {
    return this.http.patch<BackendApiResponse<UtilisateurBackend>>(`${this.API_BASE}/utilisateurs/${id}/toggle-statut`, {}).pipe(
      map(res => res.data),
      tap(updated => {
        this.utilisateurs.update(list => list.map(u => u.id === id ? { ...u, statut: updated.statut } : u));
      })
    );
  }

  /**
   * Crée un nouvel administrateur sur la plateforme
   */
  creerAdministrateur(request: AdministrateurRequestBackend): Observable<AdministrateurResponseBackend> {
    return this.http.post<BackendApiResponse<AdministrateurResponseBackend>>(`${this.API_BASE}/administrateurs`, request).pipe(
      map(res => res.data),
      tap(() => {
        this.loadUtilisateurs().subscribe();
      })
    );
  }
}
