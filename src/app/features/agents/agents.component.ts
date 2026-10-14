import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SocieteService } from '../../core/services/societe.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AgentCollaborateur } from '../../core/models/societe.models';
import { normaliser } from '../../core/utils/format';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatsCardComponent } from '../../shared/components/stats-card/stats-card.component';
import { ChampRechercheComponent } from '../../shared/components/champ-recherche/champ-recherche.component';
import {
  FiltreOngletsComponent,
  OngletFiltre,
} from '../../shared/components/filtre-onglets/filtre-onglets.component';
import { AgentCarteComponent } from './agent-carte/agent-carte.component';
import { NouvelAgentDialogComponent } from './nouvel-agent-dialog/nouvel-agent-dialog.component';

type AgentFilter = 'TOUS' | 'ACTIFS' | 'SUSPENDUS';

const TAILLE_PAGE = 9;

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    MatIconModule,
    PaginationComponent,
    ConfirmDialogComponent,
    StatsCardComponent,
    ChampRechercheComponent,
    FiltreOngletsComponent,
    AgentCarteComponent,
    NouvelAgentDialogComponent,
  ],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly agents = this.societeService.agents;
  readonly currentFilter = signal<AgentFilter>('TOUS');
  readonly currentPage = signal(1);
  readonly searchQuery = signal('');
  readonly isLoading = signal(false);
  readonly isToggling = signal(false);
  readonly isAddModalOpen = signal(false);
  readonly agentToToggle = signal<AgentCollaborateur | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly filteredAgents = computed(() => {
    let list = this.agents();
    const filter = this.currentFilter();
    if (filter === 'ACTIFS') list = list.filter(a => a.statut === 'ACTIF');
    if (filter === 'SUSPENDUS') list = list.filter(a => a.statut === 'SUSPENDU');

    const q = normaliser(this.searchQuery().trim());
    if (q) {
      list = list.filter(a =>
        [`${a.prenom} ${a.nom}`, a.telephone, a.matricule].some(v => normaliser(v).includes(q))
      );
    }
    return list;
  });

  readonly taillePage = TAILLE_PAGE;
  readonly pagedAgents = computed(() => {
    const start = (this.currentPage() - 1) * TAILLE_PAGE;
    return this.filteredAgents().slice(start, start + TAILLE_PAGE);
  });

  readonly countTous = computed(() => this.agents().length);
  readonly countActifs = computed(() => this.agents().filter(a => a.statut === 'ACTIF').length);
  readonly countSuspendus = computed(() => this.agents().filter(a => a.statut === 'SUSPENDU').length);
  readonly dossiersSuivis = computed(() =>
    this.agents().reduce((s, a) => s + a.rdvVisitesCount + a.reservationsCount, 0));
  /** Plus forte charge de l'équipe : référence des jauges de charge. */
  readonly chargeMax = computed(() =>
    Math.max(0, ...this.agents().map(a => a.rdvVisitesCount + a.reservationsCount)));

  readonly onglets = computed<OngletFiltre[]>(() => [
    { valeur: 'TOUS', libelle: 'Tous', icone: 'apps', compte: this.countTous() },
    { valeur: 'ACTIFS', libelle: 'Actifs', icone: 'how_to_reg', compte: this.countActifs() },
    { valeur: 'SUSPENDUS', libelle: 'Suspendus', icone: 'person_off', compte: this.countSuspendus() },
  ]);

  ngOnInit(): void {
    this.isLoading.set(true);
    this.societeService.getAgents().subscribe({
      next: () => this.isLoading.set(false),
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Erreur', 'Impossible de charger les agents.');
      }
    });
  }

  setFilter(f: string): void {
    this.currentFilter.set(f as AgentFilter);
    this.currentPage.set(1);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  requestToggleAgentStatut(agent: AgentCollaborateur): void {
    if (agent.estResponsableSociete) {
      this.toast.warning('Action interdite', 'Le responsable de la société ne peut pas être suspendu ici.');
      return;
    }
    if (this.currentUserId() != null && agent.id === this.currentUserId()) {
      this.toast.warning('Action interdite', 'Vous ne pouvez pas suspendre votre propre compte.');
      return;
    }
    this.agentToToggle.set(agent);
  }

  confirmToggleAgentStatut(): void {
    const ag = this.agentToToggle();
    if (!ag) return;

    const next: 'ACTIF' | 'SUSPENDU' = ag.statut === 'ACTIF' ? 'SUSPENDU' : 'ACTIF';
    this.isToggling.set(true);

    this.societeService.updateAgentStatut(ag.id, next).subscribe({
      next: () => {
        this.isToggling.set(false);
        this.agentToToggle.set(null);
        if (next === 'SUSPENDU') {
          this.toast.warning(
            'Accès suspendu',
            `${ag.prenom} ${ag.nom} ne peut plus se connecter. Sa session sera invalidée.`
          );
        } else {
          this.toast.success(
            'Compte réactivé',
            `${ag.prenom} ${ag.nom} peut à nouveau se connecter.`
          );
        }
      },
      error: (err) => {
        this.isToggling.set(false);
        const msg = err?.error?.message || err?.message || 'Le changement de statut a échoué.';
        this.toast.error('Erreur', msg);
      }
    });
  }

  cancelToggleAgentStatut(): void {
    this.agentToToggle.set(null);
  }

  canToggle(agent: AgentCollaborateur): boolean {
    if (agent.estResponsableSociete) return false;
    if (this.currentUserId() != null && agent.id === this.currentUserId()) return false;
    return true;
  }
}
