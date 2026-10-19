import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { AgentStatistiquesService } from '../../../core/services/agent-statistiques.service';
import { AgentStatistiques, PeriodeStatistiques } from '../../../core/models/agent-statistiques.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { formaterDuree, formaterFcfa, formaterMontantCompact, initiales } from '../../../core/utils/format';
import { FiltreOngletsComponent, OngletFiltre } from '../../../shared/components/filtre-onglets/filtre-onglets.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AgentHistoriqueComponent, ListeHistorique } from './agent-historique.component';
import { IndicateurTuileComponent } from './indicateur-tuile.component';

const PERIODES: OngletFiltre[] = [
  { valeur: 'MOIS', libelle: '30 jours', icone: 'calendar_view_month' },
  { valeur: 'TRIMESTRE', libelle: '3 mois', icone: 'date_range' },
  { valeur: 'TOUT', libelle: 'Depuis le début', icone: 'all_inclusive' },
];

/**
 * Activité d'un agent collaborateur : indicateurs par période (un appel léger, mis en cache),
 * puis dossiers et visites chargés à part, page par page.
 */
@Component({
  selector: 'app-agent-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MatIcon,
    FiltreOngletsComponent,
    StatusBadgeComponent,
    IndicateurTuileComponent,
    AgentHistoriqueComponent,
  ],
  templateUrl: './agent-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentDetailComponent {
  private readonly service = inject(AgentStatistiquesService);
  private requete?: Subscription;

  /** Identifiant de l'agent, lié au paramètre de route `:id`. */
  readonly id = input.required<string>();

  readonly periodes = PERIODES;
  readonly periode = signal<PeriodeStatistiques>('TOUT');
  readonly onglet = signal<ListeHistorique>('dossiers');
  readonly stats = signal<AgentStatistiques | null>(null);
  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);

  readonly nomComplet = computed(() => {
    const a = this.stats()?.agent;
    return a ? `${a.prenom} ${a.nom}`.trim() : '';
  });
  readonly initiales = computed(() => initiales(this.nomComplet()));
  readonly ongletsListe = computed<OngletFiltre[]>(() => [
    { valeur: 'dossiers', libelle: 'Dossiers', icone: 'receipt_long', compte: this.stats()?.reservations.attribuees ?? 0 },
    { valeur: 'visites', libelle: 'Visites', icone: 'event', compte: this.stats()?.visites.attribuees ?? 0 },
  ]);
  /** Emplacements du squelette affiché au premier chargement. */
  readonly squelette = Array.from({ length: 6 }, (_, i) => i);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.requete?.unsubscribe());
    effect(() => {
      const agentId = Number(this.id());
      const periode = this.periode();
      untracked(() => this.charger(agentId, periode));
    });
  }

  choisirPeriode(valeur: string): void {
    this.periode.set(valeur as PeriodeStatistiques);
  }

  choisirOnglet(valeur: string): void {
    this.onglet.set(valeur as ListeHistorique);
  }

  recharger(): void {
    this.charger(Number(this.id()), this.periode());
  }

  montant(valeur: number): string {
    return valeur >= 1e6 ? `${formaterMontantCompact(valeur)} FCFA` : formaterFcfa(valeur);
  }

  delai(heures: number | null): string {
    if (heures === null) return '—';
    return heures < 1 ? `${Math.round(heures * 60)} min` : formaterDuree(Math.round(heures));
  }

  pourcentage(taux: number | null): string {
    return taux === null ? '—' : `${taux} %`;
  }

  private charger(agentId: number, periode: PeriodeStatistiques): void {
    // Données déjà vues : affichage immédiat, rafraîchies en arrière-plan.
    const enCache = this.service.enCache(agentId, periode);
    if (enCache) this.stats.set(enCache);
    else if (this.stats()?.agent.id !== agentId) this.stats.set(null);
    this.chargement.set(true);
    this.erreur.set(null);
    // Un changement rapide de période annule la requête précédente.
    this.requete?.unsubscribe();
    this.requete = this.service.charger(agentId, periode).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(messageErreurApi(err, 'Impossible de charger l’activité de cet agent.'));
      },
    });
  }
}
