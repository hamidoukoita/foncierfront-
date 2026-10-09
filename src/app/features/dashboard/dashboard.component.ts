import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SocieteService } from '../../core/services/societe.service';
import { AuthService } from '../../core/services/auth.service';
import { StatutLot } from '../../core/models/societe.models';
import { StatsCardComponent } from '../../shared/components/stats-card/stats-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { MatIconModule } from '@angular/material/icon';

/** Couleurs de statut, identiques à celles du Studio plan de masse. */
const COULEURS = { dispo: 'var(--foncier-success)', reserve: 'var(--foncier-primary)', vendu: 'var(--foncier-danger)', indispo: '#94A3B8' } as const;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StatsCardComponent, StatusBadgeComponent, LoadingSkeletonComponent, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  readonly authService = inject(AuthService);

  readonly isLoading = this.societeService.isLoading;
  readonly loadError = signal<string | null>(null);

  readonly profil = this.societeService.profilSociete;
  readonly kpis = this.societeService.kpis;
  readonly programmes = this.societeService.programmes;
  readonly agents = this.societeService.agents;
  readonly reservations = this.societeService.reservations;
  readonly visites = this.societeService.visites;
  readonly notifications = this.societeService.notifications;
  readonly projets = this.societeService.projetsConstruction;

  /** Lots des programmes + parcelles individuelles de la société. */
  private readonly biens = computed(() => [...this.societeService.lotsProgrammes(), ...this.societeService.parcelles()]);

  readonly nomSociete = computed(() => this.profil().raisonSociale || this.authService.currentUser()?.societeNom || '');

  readonly agrement = computed(() => {
    const p = this.profil();
    if (!p.id) return null;
    switch (p.agrementStatut) {
      case 'VALIDE_MINISTERE':
        return { label: 'Agrément validé', classes: 'bg-emerald-50 border-emerald-300 text-brand-success', dot: 'bg-brand-success' };
      case 'REJETE':
        return { label: 'Agrément refusé', classes: 'bg-rose-50 border-rose-300 text-brand-danger', dot: 'bg-brand-danger' };
      default:
        return { label: 'Agrément en attente', classes: 'bg-amber-50 border-amber-300 text-brand-warning', dot: 'bg-brand-warning' };
    }
  });

  readonly stockDisponibleValeur = computed(() =>
    this.biens().filter(b => b.statut === 'DISPONIBLE').reduce((s, b) => s + (b.prixFcfa || 0), 0));

  /** Répartition réelle par statut et dégradé de l'anneau. */
  readonly distribution = computed(() => {
    const b = this.biens();
    const n = (s: StatutLot) => b.filter(x => x.statut === s).length;
    const dispo = n('DISPONIBLE'), reserve = n('RESERVE'), vendu = n('VENDU'), indispo = n('INDISPONIBLE_LITIGE');
    const total = b.length;
    const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
    let ring = 'conic-gradient(#3B4A66 0deg 360deg)';
    if (total) {
      let a = 0;
      const seg = (v: number, c: string) => { const from = a; a += (v / total) * 360; return `${c} ${from}deg ${a}deg`; };
      ring = `conic-gradient(from -90deg, ${seg(dispo, COULEURS.dispo)}, ${seg(reserve, COULEURS.reserve)}, ${seg(vendu, COULEURS.vendu)}, ${seg(indispo, COULEURS.indispo)})`;
    }
    return { total, dispo, reserve, vendu, indispo, pctDispo: pct(dispo), pctReserve: pct(reserve), pctVendu: pct(vendu), ring };
  });

  /** Lots par statut pour chaque programme (barres empilées). */
  readonly parProgramme = computed(() => this.programmes().map(p => {
    const lots = this.societeService.lotsProgrammes().filter(l => l.programmeId === p.id);
    const n = (s: StatutLot) => lots.filter(l => l.statut === s).length;
    const total = lots.length;
    const w = (v: number) => (total ? (v / total) * 100 : 0);
    const dispo = n('DISPONIBLE'), reserve = n('RESERVE'), vendu = n('VENDU'), indispo = n('INDISPONIBLE_LITIGE');
    return { programme: p, total, dispo, reserve, vendu, indispo,
      wDispo: w(dispo), wReserve: w(reserve), wVendu: w(vendu), wIndispo: w(indispo) };
  }));

  readonly derniersReservations = computed(() => [...this.reservations()].sort((a, b) => b.id - a.id).slice(0, 5));

  /** Rendez-vous à honorer à partir d'aujourd'hui, du plus proche au plus lointain. */
  readonly visitesAVenir = computed(() => {
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    return this.visites()
      .filter(v => (v.statut === 'EN_ATTENTE' || v.statut === 'CONFIRME') && (!v.dateIso || new Date(v.dateIso) >= debutJour))
      .sort((a, b) => (a.dateIso ?? '').localeCompare(b.dateIso ?? ''));
  });

  readonly notificationsRecentes = computed(() => [...this.notifications()].sort((a, b) => b.id - a.id).slice(0, 4));
  readonly notificationsNonLues = computed(() => this.notifications().filter(n => n.nonLu).length);
  readonly agentsActifs = computed(() => this.agents().filter(a => a.statut === 'ACTIF').length);
  readonly projetsEnEtude = computed(() => this.projets().filter(p => p.etatEtude === 'EN_ETUDE').length);
  readonly avancementMoyen = computed(() => {
    const l = this.programmes();
    return l.length ? Math.round(l.reduce((s, p) => s + (p.avancement ?? 0), 0) / l.length) : null;
  });

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loadError.set(null);
    this.societeService.loadAllDashboardData().subscribe({
      error: () => this.loadError.set('Certaines données du tableau de bord n’ont pas pu être chargées.'),
    });
    // Données complémentaires : un échec ici ne bloque pas le reste de la page.
    this.societeService.getProjetsConstruction().pipe(catchError(() => of([]))).subscribe();
    this.societeService.getProfilSociete().pipe(catchError(() => of(null))).subscribe();
  }

  formatFcfa(montant: number): string {
    return new Intl.NumberFormat('fr-FR').format(montant) + ' FCFA';
  }

  formatCompact(montant: number): string {
    if (montant >= 1_000_000_000) return (montant / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Mrd FCFA';
    if (montant >= 1_000_000) return (montant / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M FCFA';
    return this.formatFcfa(montant);
  }
}
