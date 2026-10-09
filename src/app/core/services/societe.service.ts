import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  AgentCollaborateur,
  DashboardKPIs,
  NotificationItem,
  ParcelleLot,
  Programme,
  ProjetConstruction,
  ProfilSociete,
  Reservation,
  VisiteRendezVous,
  StatutAgent,
  StatutVisite,
  EtatEtudeConstruction,
  StatutProgramme,
  StatutLot,
  ModelMaison
} from '../models/societe.models';
import {
  BackendApiResponse,
  ProgrammeFoncierBackend,
  ParcelleIndividuelleBackend,
  ReservationBackend,
  RendezVousBackend,
  AgentPromoteurBackend,
  SocietePromotriceBackend,
  NotificationBackend,
  ProjetConstructionBackend,
  PlanMasseBackend,
  PlanMasseRequestBackend,
  PlanMasseElementBackend,
  PlanMasseElementRequestBackend,
  LotProgrammeBackend,
  ModelMaisonBackend,
  ModelMaisonRequestBackend,
  AvancementProjetRequestBackend,
  LotProgrammeRequestBackend,
  PlanElementTypeBackend
} from '../models/backend.models';

@Injectable({
  providedIn: 'root'
})
export class SocieteService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly API_BASE = 'http://localhost:8080/api';

  // Signaux réactifs pour les collections - Initialisés VIDES (Zéro fake data en mémoire)
  readonly programmes = signal<Programme[]>([]);
  readonly lotsProgrammes = signal<ParcelleLot[]>([]);
  readonly parcelles = signal<ParcelleLot[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly visites = signal<VisiteRendezVous[]>([]);
  readonly agents = signal<AgentCollaborateur[]>([]);
  readonly projetsConstruction = signal<ProjetConstruction[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  /**
   * État initial vide : les valeurs métier proviennent ensuite exclusivement de l'API.
   */
  readonly profilSociete = signal<ProfilSociete>({
    id: 0,
    raisonSociale: '',
    formeJuridique: '',
    numeroAgrement: '',
    agrementStatut: 'EN_ATTENTE_VALIDATION',
    rccm: '',
    nif: '',
    directeurGerant: '',
    siegeSocial: '',
    telephoneFixe: '',
    emailOfficiel: '',
    siteWeb: '',
    documentKycNom: '',
    documentKycTaille: '',
    documentKycDate: '',
    documentKycUrl: ''
  });

  readonly isLoading = signal<boolean>(false);


  /**
   * KPIs du tableau de bord calculés dynamiquement à partir des données réelles
   */
  readonly kpis = computed<DashboardKPIs>(() => {
    const progs = this.programmes();
    const biens = [...this.lotsProgrammes(), ...this.parcelles()];
    const res = this.reservations();
    const vis = this.visites();

    const programmesActifs = progs.filter(p => p.statut === 'PUBLIE').length;
    const parcellesDispo = biens.filter(p => p.statut === 'DISPONIBLE').length;
    const parcellesTotal = biens.length;
    const reservationsEnCours = res.filter(r => r.statut === 'EN_ATTENTE' || r.statut === 'CONFIRMEE').length;
    const visitesAConfirmer = vis.filter(v => v.statut === 'EN_ATTENTE' || v.statut === 'CONFIRME').length;

    return {
      programmesActifsCount: programmesActifs,
      programmesActifsSubtext: progs.length > 0 ? `${progs.length} programme(s) au catalogue` : 'Aucun programme',
      parcellesDisponiblesCount: parcellesDispo,
      parcellesTotalCount: parcellesTotal,
      reservationsEnCoursCount: reservationsEnCours,
      reservationsSubtext: reservationsEnCours > 0 ? 'Dossiers à traiter' : 'Aucune réservation en cours',
      visitesCount: visitesAConfirmer,
      visitesSubtext: visitesAConfirmer > 0 ? 'Rendez-vous à honorer' : 'Aucun rendez-vous à confirmer'
    };
  });

  getSocieteId(): number | null {
    const user = this.authService.currentUser();
    return user?.societeId ?? null;
  }

  private getUserId(): number | null {
    const user = this.authService.currentUser();
    return user?.id ?? null;
  }

  // ==========================================
  // PROGRAMMES FONCIERS
  // ==========================================

  getProgrammes(): Observable<Programme[]> {
    const societeId = this.getSocieteId();
    if (!societeId) {
      return throwError(() => new Error('Aucune société promotrice n\'est associée à la session courante.'));
    }

    return this.http.get<BackendApiResponse<ProgrammeFoncierBackend[]>>(
      `${this.API_BASE}/programmes-fonciers/societe/${societeId}`
    ).pipe(
      map(res => Array.isArray(res.data) ? res.data.map(p => this.mapProgrammeBackend(p)) : []),
      tap(mapped => this.programmes.set(mapped))
    );
  }

  private mapProgrammeBackend(p: ProgrammeFoncierBackend): Programme {
    return {
      id: p.id,
      nom: p.nom,
      localisation: p.lieu ?? '',
      statut: p.statut === 'DISPONIBLE' ? 'PUBLIE' : (p.statut === 'COMPLETER' ? 'ARCHIVE' : 'BROUILLON'),
      lotsTotal: p.totalLots ?? 0,
      lotsDisponibles: 0, // nombre disponible non fourni par l'API actuelle
      titreFoncierRef: p.numeroTitreMere ?? '',
      description: p.description ?? '',
      superficieTotale: p.superficieTotale,
      avancement: p.avancement ?? 0,
      eauSomapep: p.eauSomapep ?? false,
      electriciteEdm: p.electriciteEdm ?? false,
      voirieBitumee: p.voirieBitumee ?? false,
      viabilisationDetails: [
        p.eauSomapep ? 'Eau SOMAPEP' : '',
        p.electriciteEdm ? 'Électricité EDM' : '',
        p.voirieBitumee ? 'Voirie bitumée' : ''
      ].filter(Boolean).join(' • '),
      planMasseId: p.planMasseId
    };
  }

  getProgrammeById(id: number): Observable<Programme | null> {
    return this.http.get<BackendApiResponse<ProgrammeFoncierBackend>>(
      `${this.API_BASE}/programmes-fonciers/${id}`
    ).pipe(
      map(res => res.data ? this.mapProgrammeBackend(res.data) : null)
    );
  }

  createProgramme(request: {
    nom: string;
    localisation: string;
    titreFoncierRef: string;
    lotsTotal?: number;
    superficieTotale?: number;
    viabilisationDetails?: string;
    description?: string;
    eauSomapep?: boolean;
    electriciteEdm?: boolean;
    voirieBitumee?: boolean;
    avancement?: number;
    statut?: string
  }): Observable<BackendApiResponse<ProgrammeFoncierBackend>> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));

    if (!request.superficieTotale || request.superficieTotale <= 0) {
      return throwError(() => new Error('La superficie totale du programme est obligatoire.'));
    }

    const payload = {
      nom: request.nom.trim(),
      description: request.description?.trim() || '',
      lieu: request.localisation.trim(),
      numeroTitreMere: request.titreFoncierRef.trim(),
      superficieTotale: request.superficieTotale,
      statut: request.statut === 'PUBLIE' ? 'DISPONIBLE' : (request.statut === 'ARCHIVE' ? 'COMPLETER' : 'INDISPONIBLE'),
      societeId,
      eauSomapep: request.eauSomapep ?? false,
      electriciteEdm: request.electriciteEdm ?? false,
      voirieBitumee: request.voirieBitumee ?? false,
      avancement: request.avancement ?? 0
    };

    return this.http.post<BackendApiResponse<ProgrammeFoncierBackend>>(`${this.API_BASE}/programmes-fonciers`, payload).pipe(
      tap((res) => {
        if (res.data) {
          const mappedNew = this.mapProgrammeBackend(res.data);
          this.programmes.update(list => [mappedNew, ...list.filter(item => item.id !== mappedNew.id)]);
        }
      })
    );
  }

  updateProgramme(id: number, request: Partial<Programme>): Observable<BackendApiResponse<ProgrammeFoncierBackend>> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));
    const payload = {
      nom: request.nom?.trim(),
      description: request.description,
      lieu: request.localisation?.trim(),
      numeroTitreMere: request.titreFoncierRef?.trim(),
      superficieTotale: request.superficieTotale,
      statut: request.statut === 'PUBLIE' ? 'DISPONIBLE' : (request.statut === 'ARCHIVE' ? 'COMPLETER' : 'INDISPONIBLE'),
      societeId: societeId,
      eauSomapep: request.eauSomapep,
      electriciteEdm: request.electriciteEdm,
      voirieBitumee: request.voirieBitumee,
      avancement: request.avancement
    };

    return this.http.put<BackendApiResponse<ProgrammeFoncierBackend>>(`${this.API_BASE}/programmes-fonciers/${id}`, payload).pipe(
      tap((res) => {
        if (res.data) {
          const mapped = this.mapProgrammeBackend(res.data);
          this.programmes.update(list => list.map(item => item.id === id ? mapped : item));
        }
      })
    );
  }

  deleteProgramme(id: number): Observable<BackendApiResponse<VoidFunction>> {
    return this.http.delete<BackendApiResponse<VoidFunction>>(`${this.API_BASE}/programmes-fonciers/${id}`).pipe(
      tap(() => this.programmes.update(list => list.filter(p => p.id !== id)))
    );
  }

  // ==========================================
  // LOTS DU PROGRAMME
  // ==========================================

  private mapLotsByProgrammeResponse(res: BackendApiResponse<LotProgrammeBackend[]>): ParcelleLot[] {
    if (!res.data || !Array.isArray(res.data)) return [];
    return res.data.map(l => ({
      id: l.id,
      designation: l.numeroLot.startsWith('Lot') ? l.numeroLot : `Lot N° ${l.numeroLot}`,
      titreFoncier: l.reference,
      programmeNom: l.programmeNom || '',
      programmeId: l.programmeId,
      superficieM2: l.superficie,
      dimensions: l.facade != null && l.profondeur != null ? `${l.facade}×${l.profondeur}` : '—',
      facade: l.facade,
      profondeur: l.profondeur,
      prixFcfa: l.prix,
      statut: (l.statut === 'RESERVER' ? 'RESERVE' : (l.statut === 'VENDUE' ? 'VENDU' : (l.statut === 'INDISPONIBLE' ? 'INDISPONIBLE_LITIGE' : 'DISPONIBLE'))) as StatutLot,
      numeroIlot: l.numeroIlot,
      numeroIlotLotissement: l.numeroIlotLotissement,
      geometryJson: l.geometryJson,
      bornesCertifiees: undefined
    }));
  }

  /**
   * Lecture tolérante utilisée par les écrans qui peuvent vivre sans lot.
   * Le Studio utilise la version stricte ci-dessous afin de ne jamais masquer
   * une erreur API pendant une opération métier.
   */
  getLotsByProgramme(programmeId: number): Observable<ParcelleLot[]> {
    return this.http.get<BackendApiResponse<LotProgrammeBackend[]>>(`${this.API_BASE}/lots-programmes/programme/${programmeId}`).pipe(
      map(res => this.mapLotsByProgrammeResponse(res)),
      catchError(err => {
        console.warn(`[SocieteService] Lots programme ${programmeId} non trouvés via API:`, err);
        return of([]);
      })
    );
  }

  /**
   * Lecture stricte pour le Studio Plan de masse. Toute erreur HTTP remonte
   * au composant afin de distinguer une vraie liste vide d'un problème réseau,
   * d'authentification ou de backend.
   */
  getLotsByProgrammeStrict(programmeId: number): Observable<ParcelleLot[]> {
    return this.http.get<BackendApiResponse<LotProgrammeBackend[]>>(`${this.API_BASE}/lots-programmes/programme/${programmeId}`).pipe(
      map(res => this.mapLotsByProgrammeResponse(res))
    );
  }

  createLotProgramme(request: LotProgrammeRequestBackend): Observable<BackendApiResponse<LotProgrammeBackend>> {
    return this.http.post<BackendApiResponse<LotProgrammeBackend>>(`${this.API_BASE}/lots-programmes`, request);
  }

  /**
   * Crée plusieurs lots métier en utilisant le même contrat API que le formulaire unitaire.
   * Le backend reste la source de vérité : aucune génération locale d'identifiant n'est utilisée.
   */
  ensureLotsCreated(requests: LotProgrammeRequestBackend[]): Observable<BackendApiResponse<LotProgrammeBackend>[]> {
    if (!requests.length) return of([]);
    return forkJoin(requests.map((request) => this.createLotProgramme(request)));
  }

  updateLotProgramme(id: number, request: Partial<LotProgrammeRequestBackend>): Observable<BackendApiResponse<LotProgrammeBackend>> {
    return this.http.put<BackendApiResponse<LotProgrammeBackend>>(`${this.API_BASE}/lots-programmes/${id}`, request);
  }

  updateLotProgrammeGeometry(id: number, geometryJson: string): Observable<BackendApiResponse<LotProgrammeBackend>> {
    return this.http.patch<BackendApiResponse<LotProgrammeBackend>>(
      `${this.API_BASE}/lots-programmes/${id}/geometry`,
      { geometryJson }
    );
  }

  deleteLotProgramme(id: number): Observable<BackendApiResponse<void>> {
    return this.http.delete<BackendApiResponse<void>>(`${this.API_BASE}/lots-programmes/${id}`);
  }

  // ==========================================
  // PLANS DE MASSE
  // ==========================================

  getPlanMasseByProgramme(programmeId: number): Observable<PlanMasseBackend | null> {
    return this.http.get<BackendApiResponse<PlanMasseBackend>>(`${this.API_BASE}/plans-masse/programme/${programmeId}`).pipe(
      map(res => res.data || null),
      catchError(err => {
        console.warn(`[SocieteService] Plan masse pour programme ${programmeId} non trouvé:`, err);
        return of(null);
      })
    );
  }

  savePlanMasse(request: PlanMasseRequestBackend): Observable<BackendApiResponse<PlanMasseBackend>> {
    return this.http.post<BackendApiResponse<PlanMasseBackend>>(`${this.API_BASE}/plans-masse`, request);
  }

  /**
   * Crée le plan de masse lorsqu'il n'existe pas encore, sinon le met à jour.
   * Aucun fallback local n'est utilisé : le backend reste la source de vérité.
   */
  upsertPlanMasse(request: PlanMasseRequestBackend): Observable<BackendApiResponse<PlanMasseBackend>> {
    return this.getPlanMasseByProgramme(request.programmeId).pipe(
      switchMap(existing => existing
        ? this.http.put<BackendApiResponse<PlanMasseBackend>>(`${this.API_BASE}/plans-masse/${existing.id}`, request)
        : this.savePlanMasse(request)
      )
    );
  }

  /**
   * Met à jour un plan de masse dont l'identifiant est déjà connu (pas de GET préalable :
   * un GET qui échouerait faisait basculer `upsertPlanMasse` vers un POST et créait un doublon).
   */
  updatePlanMasse(id: number, request: PlanMasseRequestBackend): Observable<BackendApiResponse<PlanMasseBackend>> {
    return this.http.put<BackendApiResponse<PlanMasseBackend>>(`${this.API_BASE}/plans-masse/${id}`, request);
  }

  getPlanMasseElements(planMasseId: number): Observable<PlanMasseElementBackend[]> {
    return this.http.get<BackendApiResponse<PlanMasseElementBackend[]>>(
      `${this.API_BASE}/plans-masse-elements/plan-masse/${planMasseId}`
    ).pipe(
      map(res => Array.isArray(res.data) ? res.data : []),
      catchError(err => {
        console.error('[SocieteService] Erreur lors du chargement des éléments du plan:', err);
        return of([]);
      })
    );
  }

  createPlanMasseElement(request: PlanMasseElementRequestBackend): Observable<BackendApiResponse<PlanMasseElementBackend>> {
    return this.http.post<BackendApiResponse<PlanMasseElementBackend>>(
      `${this.API_BASE}/plans-masse-elements`,
      request
    );
  }

  updatePlanMasseElement(id: number, request: PlanMasseElementRequestBackend): Observable<BackendApiResponse<PlanMasseElementBackend>> {
    return this.http.put<BackendApiResponse<PlanMasseElementBackend>>(
      `${this.API_BASE}/plans-masse-elements/${id}`,
      request
    );
  }

  deletePlanMasseElement(id: number): Observable<BackendApiResponse<void>> {
    return this.http.delete<BackendApiResponse<void>>(
      `${this.API_BASE}/plans-masse-elements/${id}`
    );
  }

  static readonly PLAN_ELEMENT_TYPES: readonly PlanElementTypeBackend[] = [
    'ROUTE_GOUDRONNEE',
    'ROUTE_NON_GOUDRONNEE',
    'MOSQUEE',
    'EGLISE',
    'ECOLE',
    'ESPACE_VERT',
    'MARCHE',
    'COMMERCE',
    'EQUIPEMENT_PUBLIC',
    'AUTRE'
  ];

  // ==========================================
  // PARCELLES INDIVIDUELLES
  // ==========================================

  getParcelles(): Observable<ParcelleLot[]> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));

    return this.http.get<BackendApiResponse<ParcelleIndividuelleBackend[]>>(
      `${this.API_BASE}/parcelles-individuelles/societe/${societeId}`
    ).pipe(
      map(res => {
        if (!res.data || !Array.isArray(res.data)) return [];
        return res.data.map(p => ({
          id: p.id,
          designation: p.reference || `Parcelle #${p.id}`,
          titreFoncier: p.numeroTitreFoncier || '—',
          programmeNom: 'Parcelle individuelle',
          programmeId: undefined,
          superficieM2: p.superficie,
          dimensions: p.facade != null && p.profondeur != null ? `${p.facade}×${p.profondeur}` : '—',
          facade: p.facade,
          profondeur: p.profondeur,
          prixFcfa: p.prix,
          statut: (p.statut === 'RESERVER' ? 'RESERVE' : (p.statut === 'VENDUE' ? 'VENDU' : (p.statut === 'INDISPONIBLE' ? 'INDISPONIBLE_LITIGE' : 'DISPONIBLE'))) as StatutLot,
          geometryJson: p.geometryJson,
          delaiGelRestant: p.statut === 'RESERVER' ? 'Réservé (72h)' : undefined
        }));
      }),
      tap(mapped => this.parcelles.set(mapped)),
      catchError(err => {
        console.error('[SocieteService] Erreur lors du chargement des parcelles réelles:', err);
        return of([]);
      })
    );
  }

  updateStatutParcelle(id: number, statut: 'DISPONIBLE' | 'RESERVE' | 'VENDU' | 'INDISPONIBLE_LITIGE'): void {
    this.parcelles.update(list => list.map(p => p.id === id ? { ...p, statut } : p));
  }

  createParcelle(request: {
    numeroTitreFoncier: string;
    reference?: string;
    superficie: number;
    prix: number;
    facade?: number;
    profondeur?: number;
    statut?: string;
  }): Observable<BackendApiResponse<ParcelleIndividuelleBackend>> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));
    if (!request.reference?.trim()) return throwError(() => new Error('La référence de la parcelle est obligatoire.'));
    const payload = {
      numeroTitreFoncier: request.numeroTitreFoncier,
      reference: request.reference.trim(),
      superficie: request.superficie,
      prix: request.prix,
      facade: request.facade,
      profondeur: request.profondeur,
      statut: request.statut === 'RESERVE' ? 'RESERVER' : (request.statut === 'VENDU' ? 'VENDUE' : (request.statut === 'INDISPONIBLE_LITIGE' ? 'INDISPONIBLE' : (request.statut || 'DISPONIBLE'))),
      societeId,
      murCloture: false,
      eauSomapep: false,
      electriciteEdm: false,
      voieBitumee: false
    };

    return this.http.post<BackendApiResponse<ParcelleIndividuelleBackend>>(`${this.API_BASE}/parcelles-individuelles`, payload).pipe(
      tap(() => this.getParcelles().subscribe())
    );
  }

  deleteParcelle(id: number): Observable<BackendApiResponse<void>> {
    return this.http.delete<BackendApiResponse<void>>(`${this.API_BASE}/parcelles-individuelles/${id}`).pipe(
      tap(() => this.parcelles.update(list => list.filter(p => p.id !== id)))
    );
  }


  // ==========================================
  // AGENTS & COLLABORATEURS DE LA SOCIÉTÉ
  // ==========================================

  getAgents(): Observable<AgentCollaborateur[]> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));

    return this.http.get<BackendApiResponse<AgentPromoteurBackend[]>>(
      `${this.API_BASE}/agents-promoteurs/societe/${societeId}`
    ).pipe(
      map(res => {
        if (!res.data || !Array.isArray(res.data)) return [];
        return res.data.map(a => {
          const prenom = a.prenom || '';
          const nom = a.nom || '';
          const initials = ((prenom[0] || '') + (nom[0] || '')).toUpperCase() || 'AG';
          return {
            id: a.id,
            matricule: a.id.toString(),
            nom: nom,
            prenom: prenom,
            initiales: initials,
            telephone: a.telephone,
            fonctionDeleguee: a.typeFonctionLibelle || '',
            rdvVisitesCount: 0,
            reservationsCount: 0,
            statut: (a.statut === 'ACTIF' ? 'ACTIF' : 'SUSPENDU') as StatutAgent
          };
        });
      }),
      tap(mapped => this.agents.set(mapped)),
      catchError(err => {
        console.error('[SocieteService] Erreur lors du chargement des agents réels:', err);
        return of([]);
      })
    );
  }

  createAgent(agentData: { prenom: string; nom: string; telephone: string; motDePasse: string; fonctionDeleguee?: string }): Observable<BackendApiResponse<AgentPromoteurBackend>> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));
    const payload = {
      nom: agentData.nom.trim(),
      prenom: agentData.prenom.trim(),
      telephone: agentData.telephone.trim(),
      motDePasse: agentData.motDePasse,
      statut: 'ACTIF',
      estResponsableSociete: false,
      societeId
    };

    return this.http.post<BackendApiResponse<AgentPromoteurBackend>>(`${this.API_BASE}/agents-promoteurs`, payload).pipe(
      tap(() => this.getAgents().subscribe())
    );
  }

  // ==========================================
  // RÉSERVATIONS
  // ==========================================

  getReservations(): Observable<Reservation[]> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));

    return this.http.get<BackendApiResponse<ReservationBackend[]>>(
      `${this.API_BASE}/reservations/societe/${societeId}`
    ).pipe(
      map(res => (Array.isArray(res.data) ? res.data : []).map(r => ({
        id: r.id,
        lotDesignation: r.bienDesignation || r.bienReference || 'Bien foncier',
        programmeNom: r.programmeNom || 'Parcelle individuelle',
        prospectNom: r.acquereurNom || 'Acquéreur non renseigné',
        prospectTelephone: r.acquereurTelephone || 'Non renseigné',
        montantFcfa: r.montant ?? 0,
        dateReservation: r.dateReservation ? new Date(r.dateReservation).toLocaleDateString('fr-FR') : 'Non renseignée',
        delaiGel72h: r.statut === 'EN_ATTENTE' ? 'En attente de traitement' :
          r.statut === 'CONFIRMER' ? 'Confirmée' : 'Refusée',
        delaiExpire: false,
        agentAssignId: r.agentId,
        agentAssignNom: r.agentNom,
        statut: (r.statut === 'CONFIRMER' ? 'CONFIRMEE' : (r.statut === 'REFUSER' ? 'ANNULEE' : 'EN_ATTENTE')) as Reservation['statut']
      }))),
      tap(mapped => this.reservations.set(mapped))
    );
  }

  confirmerReservation(id: number): Observable<BackendApiResponse<ReservationBackend>> {
    return this.http.patch<BackendApiResponse<ReservationBackend>>(`${this.API_BASE}/reservations/${id}/confirmer`, {}).pipe(
      tap(() => this.getReservations().subscribe())
    );
  }

  refuserReservation(id: number, motif: string): Observable<BackendApiResponse<ReservationBackend>> {
    return this.http.patch<BackendApiResponse<ReservationBackend>>(`${this.API_BASE}/reservations/${id}/refuser?motif=${encodeURIComponent(motif)}`, {}).pipe(
      tap(() => this.getReservations().subscribe())
    );
  }

  assignAgentToReservation(reservationId: number, agentNom: string): void {
    this.reservations.update(list => list.map(r => r.id === reservationId ? { ...r, agentAssignNom: agentNom } : r));
  }

  // ==========================================
  // RENDEZ-VOUS & VISITES
  // ==========================================

  getVisites(): Observable<VisiteRendezVous[]> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));

    return this.http.get<BackendApiResponse<RendezVousBackend[]>>(
      `${this.API_BASE}/rendez-vous/societe/${societeId}`
    ).pipe(
      map(res => (Array.isArray(res.data) ? res.data : []).map(v => {
        const dateObj = new Date(v.dateRendezVous);
        const heureDebut = v.creneauHeureDebut || dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const heureFin = v.creneauHeureFin || '';
        return {
          id: v.id,
          dateIso: v.dateRendezVous,
          jourSemaine: Number.isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase(),
          jourMois: Number.isNaN(dateObj.getTime()) ? '' : dateObj.getDate().toString(),
          heureDebut,
          heureFin,
          dateComplete: Number.isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          prospectNom: v.acquereurNom || 'Acquéreur non renseigné',
          prospectTelephone: v.acquereurTelephone || 'Non renseigné',
          programmeNom: v.programmeNom || 'Parcelle individuelle',
          bienCible: v.bienDesignation || v.bienReference || v.lieu || 'Bien foncier',
          agentAssignId: v.agentId,
          agentAssignNom: v.agentNom,
          statut: (v.statut === 'ACCEPTER' ? 'CONFIRME' : (v.statut === 'REFUSER' ? 'ANNULE' : 'EN_ATTENTE')) as StatutVisite,
          typeVisite: v.typeRDV
        };
      })),
      tap(mapped => this.visites.set(mapped))
    );
  }

  assignAgentToVisite(visiteId: number, agentNom: string): void {
    this.visites.update(list => list.map(v => v.id === visiteId ? { ...v, agentAssignNom: agentNom, agentStatutConfirmation: 'Assigné' } : v));
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  getNotifications(): Observable<NotificationItem[]> {
    const userId = this.getUserId();
    const url = userId
      ? `${this.API_BASE}/notifications/utilisateur/${userId}`
      : `${this.API_BASE}/notifications`;

    return this.http.get<BackendApiResponse<NotificationBackend[]>>(url).pipe(
      map(res => {
        if (!res.data || !Array.isArray(res.data)) return [];
        return res.data.map(n => {
          const rawType = (n.typeNotificationLibelle || '').toUpperCase();
          const type: NotificationItem['type'] =
            rawType.includes('VISITE') ? 'VISITE' :
            rawType.includes('CONSTRUCT') ? 'CONSTRUCTION' :
            rawType.includes('PAIEMENT') ? 'PAIEMENT' : 'RESERVATION';

          return {
            id: n.id,
            titre: n.titre,
            message: n.message,
            prospectConcerne: n.utilisateurNom ? `${n.utilisateurPrenom || ''} ${n.utilisateurNom}`.trim() : undefined,
            dateRelative: n.dateEnvoi ? new Date(n.dateEnvoi).toLocaleDateString('fr-FR') : 'Récemment',
            type,
            nonLu: !n.lue,
            actionLabel: 'Consulter',
            actionRoute: '/societe/reservations',
            iconEmoji: '🔔'
          };
        });
      }),
      tap(mapped => this.notifications.set(mapped)),
      catchError(err => {
        console.error('[SocieteService] Erreur lors du chargement des notifications réelles:', err);
        return of([]);
      })
    );
  }

  markAllNotificationsAsRead(): void {
    const unreadIds = this.notifications()
      .filter(notification => notification.nonLu)
      .map(notification => notification.id);

    if (unreadIds.length === 0) return;

    forkJoin(
      unreadIds.map(id =>
        this.http.patch<BackendApiResponse<NotificationBackend>>(
          `${this.API_BASE}/notifications/${id}/lire`,
          {}
        )
      )
    ).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, nonLu: false })));
      },
      error: error => {
        console.error('[SocieteService] Impossible de marquer les notifications comme lues :', error);
      }
    });
  }

  // ==========================================
  // PROJETS CONSTRUCTION & PROFIL SOCIÉTÉ
  // ==========================================

  getProjetsConstruction(): Observable<ProjetConstruction[]> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));
    return this.http.get<BackendApiResponse<ProjetConstructionBackend[]>>(`${this.API_BASE}/projets-construction/societe/${societeId}`).pipe(
      map(res => (Array.isArray(res.data) ? res.data : []).map(p => ({
        id: p.id,
        numeroDossier: p.numeroDossier,
        modeleVilla: p.modelMaisonLibeller ?? 'Modèle non sélectionné',
        modeleMaisonId: p.modelMaisonId,
        modeleMaisonImageUrl: p.modelMaisonImageUrl,
        modeleMaisonPlanUrl: p.modelMaisonPlanUrl,
        croquisIcon: '🏠',
        surfaceTerrainM2: p.superficieTerrain ?? 0,
        prospectNom: p.acquereurNom ?? 'Acquéreur non renseigné',
        prospectTelephone: p.acquereurTelephone ?? '',
        localisationTerrain: p.localisationTerrain ?? '',
        typeTerrain: p.typeTerrain,
        statutTerrain: 'TITRE_FONCIER' as const,
        titreFoncierNumero: p.numeroTitreFoncier,
        chargeTechniqueNom: p.agentNom,
        chargeTechniqueStatut: p.agentId ? 'Agent affecté' : undefined,
        devisMontantFcfa: p.budgetEstime,
        etatEtude: (p.statut as EtatEtudeConstruction) ?? 'EN_ETUDE',
        progression: p.progression ?? 0,
        etapeAvancement: p.etapeAvancement,
        commentaireAvancement: p.commentaireAvancement,
        dateDerniereMiseAJour: p.dateDerniereMiseAJour,
        delaiInfo: '',
        description: p.description
      }))),
      tap(mapped => this.projetsConstruction.set(mapped))
    );
  }

  getModelesMaison(societeId = this.getSocieteId()): Observable<ModelMaison[]> {
    const id = societeId ?? undefined;
    return this.http.get<BackendApiResponse<ModelMaisonBackend[]>>(`${this.API_BASE}/modeles-maison`, {
      params: id ? { societeId: id } : {}
    }).pipe(
      map(res => (Array.isArray(res.data) ? res.data : []).map(m => ({
        id: m.id, libeller: m.libeller, description: m.description, imageUrl: m.imageUrl, planUrl: m.planUrl,
        surfaceTerrainMin: m.surfaceTerrainMin, surfaceTerrainMax: m.surfaceTerrainMax, surfaceConstruite: m.surfaceConstruite,
        nombreChambres: m.nombreChambres, nombreSallesBain: m.nombreSallesBain,
        typeTerrainCompatible: m.typeTerrainCompatible, societeId: m.societeId, societeNom: m.societeNom
      })))
    );
  }

  getModelesMaisonCompatibles(surfaceTerrain?: number, typeTerrain?: string, societeId = this.getSocieteId()): Observable<ModelMaison[]> {
    const params: Record<string, string | number> = {};
    if (surfaceTerrain != null) params['surfaceTerrain'] = surfaceTerrain;
    if (typeTerrain) params['typeTerrain'] = typeTerrain;
    if (societeId != null) params['societeId'] = societeId;
    return this.http.get<BackendApiResponse<ModelMaisonBackend[]>>(`${this.API_BASE}/modeles-maison/compatibles`, { params }).pipe(
      map(res => (Array.isArray(res.data) ? res.data : []).map(m => ({
        id: m.id, libeller: m.libeller, description: m.description, imageUrl: m.imageUrl, planUrl: m.planUrl,
        surfaceTerrainMin: m.surfaceTerrainMin, surfaceTerrainMax: m.surfaceTerrainMax, surfaceConstruite: m.surfaceConstruite,
        nombreChambres: m.nombreChambres, nombreSallesBain: m.nombreSallesBain,
        typeTerrainCompatible: m.typeTerrainCompatible, societeId: m.societeId, societeNom: m.societeNom
      })))
    );
  }

  createModelMaison(request: ModelMaisonRequestBackend): Observable<ModelMaisonBackend> {
    return this.http.post<BackendApiResponse<ModelMaisonBackend>>(`${this.API_BASE}/modeles-maison`, request).pipe(
      map(res => {
        if (!res?.data?.id) throw new Error(res?.message || 'Le serveur n\'a pas renvoyé le modèle créé.');
        return res.data;
      })
    );
  }

  updateModelMaison(id: number, request: ModelMaisonRequestBackend): Observable<ModelMaisonBackend> {
    return this.http.put<BackendApiResponse<ModelMaisonBackend>>(`${this.API_BASE}/modeles-maison/${id}`, request).pipe(map(res => res.data));
  }

  deleteModelMaison(id: number): Observable<void> {
    return this.http.delete<BackendApiResponse<void>>(`${this.API_BASE}/modeles-maison/${id}`).pipe(map(() => undefined));
  }

  uploadModelMaisonImage(id: number, file: File): Observable<ModelMaisonBackend> {
    const form = new FormData(); form.append('file', file, file.name);
    return this.http.post<BackendApiResponse<ModelMaisonBackend>>(`${this.API_BASE}/modeles-maison/${id}/image`, form).pipe(map(res => res.data));
  }

  uploadModelMaisonPlan(id: number, file: File): Observable<ModelMaisonBackend> {
    const form = new FormData(); form.append('file', file, file.name);
    return this.http.post<BackendApiResponse<ModelMaisonBackend>>(`${this.API_BASE}/modeles-maison/${id}/plan`, form).pipe(map(res => res.data));
  }

  updateProjetAvancement(id: number, request: AvancementProjetRequestBackend): Observable<ProjetConstructionBackend> {
    return this.http.patch<BackendApiResponse<ProjetConstructionBackend>>(`${this.API_BASE}/projets-construction/${id}/avancement`, request).pipe(map(res => res.data));
  }

  updateProjetConstruction(id: number, request: Record<string, unknown>): Observable<ProjetConstructionBackend> {
    return this.http.put<BackendApiResponse<ProjetConstructionBackend>>(`${this.API_BASE}/projets-construction/${id}`, request).pipe(map(res => res.data));
  }

  changerModeleProjet(id: number, modelMaisonId: number): Observable<ProjetConstructionBackend> {
    return this.http.patch<BackendApiResponse<ProjetConstructionBackend>>(`${this.API_BASE}/projets-construction/${id}/modele/${modelMaisonId}`, {}).pipe(map(res => res.data));
  }

  validerProjetConstruction(id: number): Observable<ProjetConstructionBackend> {
    return this.http.patch<BackendApiResponse<ProjetConstructionBackend>>(
      `${this.API_BASE}/projets-construction/${id}/valider`, {}
    ).pipe(map(res => res.data));
  }

  refuserProjetConstruction(id: number, motif?: string): Observable<ProjetConstructionBackend> {
    const q = motif ? `?motif=${encodeURIComponent(motif)}` : '';
    return this.http.patch<BackendApiResponse<ProjetConstructionBackend>>(
      `${this.API_BASE}/projets-construction/${id}/refuser${q}`, {}
    ).pipe(map(res => res.data));
  }



  getProfilSociete(): Observable<ProfilSociete | null> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));

    return this.http.get<BackendApiResponse<SocietePromotriceBackend>>(
      `${this.API_BASE}/societes-promotrices/${societeId}`
    ).pipe(
      map(res => {
        if (!res.data) return null;
        const s = res.data;
        return {
          id: s.id,
          raisonSociale: s.nom ?? '',
          formeJuridique: '',
          numeroAgrement: s.numeroAgrement ?? '',
          agrementStatut: s.statutAgrement === 'VERIFIER' ? 'VALIDE_MINISTERE' :
            s.statutAgrement === 'REFUSER' ? 'REJETE' : 'EN_ATTENTE_VALIDATION',
          rccm: '',
          nif: s.nif ?? '',
          directeurGerant: '',
          siegeSocial: s.adresse ?? '',
          telephoneFixe: s.telephone ?? '',
          emailOfficiel: s.email ?? '',
          siteWeb: s.siteWeb ?? '',
          documentKycNom: '',
          documentKycTaille: '',
          documentKycDate: '',
          documentKycUrl: ''
        } satisfies ProfilSociete;
      }),
      tap(mapped => {
        if (mapped) this.profilSociete.set(mapped);
      })
    );
  }

  updateProfilSociete(data: Partial<ProfilSociete>): Observable<BackendApiResponse<SocietePromotriceBackend>> {
    const societeId = this.getSocieteId();
    if (!societeId) return throwError(() => new Error('Société promotrice introuvable dans la session.'));

    const current = this.profilSociete();
    const payload = {
      nom: data.raisonSociale ?? current.raisonSociale,
      adresse: data.siegeSocial ?? current.siegeSocial,
      telephone: data.telephoneFixe ?? current.telephoneFixe,
      email: data.emailOfficiel ?? current.emailOfficiel,
      nif: current.nif || null,
      numeroAgrement: current.numeroAgrement || null,
      dateAgrement: null,
      statutAgrement: current.agrementStatut === 'VALIDE_MINISTERE' ? 'VERIFIER' :
        current.agrementStatut === 'REJETE' ? 'REFUSER' : 'EN_ATTENTE',
      logoUrl: current.documentKycUrl || null,
      siteWeb: data.siteWeb ?? current.siteWeb,
      description: null
    };

    return this.http.put<BackendApiResponse<SocietePromotriceBackend>>(
      `${this.API_BASE}/societes-promotrices/${societeId}`,
      payload
    ).pipe(
      tap(res => {
        if (res.data) {
          const s = res.data;
          this.profilSociete.set({
            ...current,
            id: s.id,
            raisonSociale: s.nom ?? '',
            siegeSocial: s.adresse ?? '',
            telephoneFixe: s.telephone ?? '',
            emailOfficiel: s.email ?? '',
            siteWeb: s.siteWeb ?? '',
            nif: s.nif ?? '',
            numeroAgrement: s.numeroAgrement ?? ''
          });
        }
      })
    );
  }

  /**
   * Charge toutes les données du dashboard à partir des endpoints réels.
   * Les lots de chaque programme sont ensuite récupérés pour éviter tout KPI simulé.
   */
  loadAllDashboardData(): Observable<unknown> {
    this.isLoading.set(true);
    return this.getProgrammes().pipe(
      switchMap(programmes => {
        const lotsRequest = programmes.length
          ? forkJoin(programmes.map(programme => this.getLotsByProgramme(programme.id))).pipe(
              map(groups => groups.flat())
            )
          : of([] as ParcelleLot[]);

        return forkJoin({
          programmes: of(programmes),
          lotsProgrammes: lotsRequest,
          parcelles: this.getParcelles(),
          agents: this.getAgents(),
          reservations: this.getReservations(),
          visites: this.getVisites(),
          notifications: this.getNotifications()
        });
      }),
      tap(result => {
        this.lotsProgrammes.set(result.lotsProgrammes);
        this.isLoading.set(false);
      }),
      catchError(error => {
        console.error('[SocieteService] Erreur de chargement du dashboard:', error);
        this.isLoading.set(false);
        return throwError(() => error);
      })
    );
  }
}

