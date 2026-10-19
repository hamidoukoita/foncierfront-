import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { AgentStatistiquesService } from '../../../core/services/agent-statistiques.service';
import {
  DossierAgent,
  PageHistorique,
  PeriodeStatistiques,
  VisiteAgent,
} from '../../../core/models/agent-statistiques.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { AgentDossiersComponent } from './agent-dossiers.component';
import { AgentVisitesComponent } from './agent-visites.component';

export type ListeHistorique = 'dossiers' | 'visites';

const TAILLE_PAGE = 20;

/**
 * Historique d'un agent (dossiers ou visites), chargé page par page indépendamment des indicateurs :
 * la fiche s'affiche sans attendre la liste, et « Voir plus » ajoute la page suivante.
 */
@Component({
  selector: 'app-agent-historique',
  standalone: true,
  imports: [MatIcon, AgentDossiersComponent, AgentVisitesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (erreur(); as message) {
      <div class="flex flex-wrap items-center justify-between gap-3 py-4">
        <p class="text-xs text-gray-600">{{ message }}</p>
        <button type="button" class="bouton bouton-sm bouton-contour" (click)="charger(page() + 1)">
          <mat-icon>refresh</mat-icon>
          Réessayer
        </button>
      </div>
    } @else if (premierChargement()) {
      <div class="animate-pulse space-y-3 py-3" aria-busy="true" aria-label="Chargement de l’historique">
        @for (i of squelette; track i) {
          <span class="block h-12 rounded-xl bg-gray-100"></span>
        }
      </div>
    } @else {
      @if (liste() === 'dossiers') {
        <app-agent-dossiers [dossiers]="dossiers()" />
      } @else {
        <app-agent-visites [visites]="visites()" />
      }
      @if (!derniere()) {
        <div class="mt-3 flex flex-col items-center gap-1">
          <button type="button" class="bouton bouton-sm bouton-contour" [disabled]="chargement()" (click)="charger(page() + 1)">
            @if (chargement()) {
              <mat-icon class="animate-spin">autorenew</mat-icon>
            } @else {
              <mat-icon>expand_more</mat-icon>
            }
            Voir plus
          </button>
          <p class="text-[11px] text-gray-400">{{ affiches() }} sur {{ total() }}</p>
        </div>
      }
    }
  `,
})
export class AgentHistoriqueComponent {
  private readonly service = inject(AgentStatistiquesService);
  private requete?: Subscription;

  readonly agentId = input.required<number>();
  readonly periode = input.required<PeriodeStatistiques>();
  readonly liste = input.required<ListeHistorique>();

  readonly dossiers = signal<DossierAgent[]>([]);
  readonly visites = signal<VisiteAgent[]>([]);
  /** Dernière page chargée (-1 avant la première). */
  readonly page = signal(-1);
  readonly total = signal(0);
  readonly derniere = signal(true);
  readonly chargement = signal(false);
  readonly premierChargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly affiches = signal(0);

  protected readonly squelette = [0, 1, 2, 3];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.requete?.unsubscribe());
    // Nouvel agent, nouvelle période ou autre onglet : on repart de la première page.
    effect(() => {
      this.agentId();
      this.periode();
      this.liste();
      untracked(() => {
        this.dossiers.set([]);
        this.visites.set([]);
        this.page.set(-1);
        this.premierChargement.set(true);
        this.charger(0);
      });
    });
  }

  charger(page: number): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.requete?.unsubscribe();
    const agentId = this.agentId();
    const periode = this.periode();
    const requete: Observable<PageHistorique<DossierAgent | VisiteAgent>> =
      this.liste() === 'dossiers'
        ? this.service.dossiers(agentId, periode, page, TAILLE_PAGE)
        : this.service.visites(agentId, periode, page, TAILLE_PAGE);
    this.requete = requete.subscribe({
      next: (resultat) => {
        if (this.liste() === 'dossiers') {
          this.dossiers.update((l) => [...l, ...(resultat.elements as DossierAgent[])]);
          this.affiches.set(this.dossiers().length);
        } else {
          this.visites.update((l) => [...l, ...(resultat.elements as VisiteAgent[])]);
          this.affiches.set(this.visites().length);
        }
        this.page.set(resultat.page);
        this.total.set(resultat.total);
        this.derniere.set(resultat.derniere);
        this.chargement.set(false);
        this.premierChargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.premierChargement.set(false);
        this.erreur.set(messageErreurApi(err, 'Impossible de charger l’historique.'));
      },
    });
  }
}
