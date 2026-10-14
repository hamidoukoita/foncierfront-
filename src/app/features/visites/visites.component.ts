import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { StatutVisite, VisiteRendezVous } from '../../core/models/societe.models';
import { messageErreurApi } from '../../core/utils/api-error';
import { normaliser } from '../../core/utils/format';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { StatsCardComponent } from '../../shared/components/stats-card/stats-card.component';
import { MotifDialogComponent } from '../../shared/components/motif-dialog/motif-dialog.component';
import { PanneauLateralComponent } from '../../shared/components/panneau-lateral/panneau-lateral.component';
import { AttributionAgentDialogComponent } from '../../shared/components/attribution-agent-dialog/attribution-agent-dialog.component';
import {
  FiltreOngletsComponent,
  OngletFiltre,
} from '../../shared/components/filtre-onglets/filtre-onglets.component';
import {
  compterProchainsJours,
  estAVenir,
  grouperParJour,
  trierPourAgenda,
} from './visite-agenda';
import {
  MODALITES_VISITE,
  VisiteDetailComponent,
} from './visite-detail/visite-detail.component';
import { VisiteLigneComponent } from './visite-ligne/visite-ligne.component';
import { ChampRechercheComponent } from '../../shared/components/champ-recherche/champ-recherche.component';

type FiltreStatut = 'TOUS' | StatutVisite;
type FiltreModalite = 'TOUS' | VisiteRendezVous['typeVisite'];
type Dialogue = 'attribution' | 'refus' | null;

const TAILLE_PAGE = 10;

@Component({
  selector: 'app-visites',
  standalone: true,
  imports: [
    MatIcon,
    PaginationComponent,
    StatsCardComponent,
    MotifDialogComponent,
    PanneauLateralComponent,
    AttributionAgentDialogComponent,
    FiltreOngletsComponent,
    VisiteDetailComponent,
    VisiteLigneComponent,
    ChampRechercheComponent,
  ],
  templateUrl: './visites.component.html',
  styleUrl: './visites.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitesComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly visites = this.societeService.visites;
  readonly agents = this.societeService.agents;
  readonly agentsActifs = this.societeService.agentsActifs;

  readonly isLoading = signal(false);
  readonly filtreStatut = signal<FiltreStatut>('TOUS');
  readonly filtreModalite = signal<FiltreModalite>('TOUS');
  /** 'TOUS', 'SANS_AGENT' ou l'identifiant d'un agent. */
  readonly filtreAgent = signal('TOUS');
  readonly recherche = signal('');
  readonly page = signal(1);
  readonly taillePage = TAILLE_PAGE;

  readonly selectionId = signal<number | null>(null);
  readonly selection = computed(() => this.visites().find((v) => v.id === this.selectionId()) ?? null);
  readonly dialogue = signal<Dialogue>(null);
  readonly enCours = signal(false);

  readonly modalites = MODALITES_VISITE;
  readonly suggestionsRefus = [
    'Créneau indisponible, merci de proposer une autre date',
    'Bien plus disponible à la visite',
    'Acquéreur injoignable',
  ];

  ngOnInit(): void {
    this.actualiser();
    this.societeService.getAgents().subscribe();
  }

  actualiser(): void {
    this.isLoading.set(true);
    this.societeService.getVisites().subscribe({
      next: () => this.isLoading.set(false),
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Rendez-vous', messageErreurApi(err, 'Chargement impossible.'));
      },
    });
  }

  // ---------- Indicateurs ----------

  readonly kpis = computed(() => {
    const liste = this.visites();
    const maintenant = new Date();
    const actives = liste.filter((v) => v.statut === 'EN_ATTENTE' || v.statut === 'CONFIRME');
    return {
      aujourdhui: compterProchainsJours(actives, maintenant, 1),
      semaine: compterProchainsJours(actives, maintenant, 7),
      aConfirmer: liste.filter((v) => v.statut === 'EN_ATTENTE' && estAVenir(v, maintenant)).length,
      sansAgent: actives.filter((v) => !v.agentAssignId && estAVenir(v, maintenant)).length,
    };
  });

  readonly ongletsStatut = computed<OngletFiltre[]>(() => {
    const liste = this.visites();
    const compte = (s: StatutVisite) => liste.filter((v) => v.statut === s).length;
    return [
      { valeur: 'TOUS', libelle: 'Tous', compte: liste.length },
      { valeur: 'EN_ATTENTE', libelle: 'À confirmer', icone: 'hourglass_top', compte: compte('EN_ATTENTE') },
      { valeur: 'CONFIRME', libelle: 'Confirmés', icone: 'event_available', compte: compte('CONFIRME') },
      { valeur: 'EFFECTUE', libelle: 'Effectués', icone: 'done_all', compte: compte('EFFECTUE') },
      { valeur: 'ANNULE', libelle: 'Annulés', icone: 'event_busy', compte: compte('ANNULE') },
    ];
  });

  readonly ongletsModalite: OngletFiltre[] = [
    { valeur: 'TOUS', libelle: 'Tous lieux' },
    { valeur: 'SIEGE', libelle: MODALITES_VISITE.SIEGE.libelle, icone: MODALITES_VISITE.SIEGE.icone },
    { valeur: 'CHANTIER', libelle: MODALITES_VISITE.CHANTIER.libelle, icone: MODALITES_VISITE.CHANTIER.icone },
  ];

  // ---------- Agenda ----------

  readonly filtrees = computed(() => {
    const statut = this.filtreStatut();
    const modalite = this.filtreModalite();
    const agent = this.filtreAgent();
    const terme = normaliser(this.recherche().trim());

    const liste = this.visites()
      .filter((v) => statut === 'TOUS' || v.statut === statut)
      .filter((v) => modalite === 'TOUS' || v.typeVisite === modalite)
      .filter((v) =>
        agent === 'TOUS'
          ? true
          : agent === 'SANS_AGENT'
            ? !v.agentAssignId
            : String(v.agentAssignId) === agent,
      )
      .filter(
        (v) =>
          !terme ||
          [v.prospectNom, v.prospectTelephone, v.programmeNom, v.bienCible, v.lieu].some((x) =>
            normaliser(x).includes(terme),
          ),
      );
    return trierPourAgenda(liste, new Date());
  });

  /** Journées de la page courante. */
  readonly jours = computed(() => {
    const debut = (this.page() - 1) * TAILLE_PAGE;
    return grouperParJour(this.filtrees().slice(debut, debut + TAILLE_PAGE), new Date());
  });

  readonly filtresActifs = computed(
    () =>
      this.filtreStatut() !== 'TOUS' ||
      this.filtreModalite() !== 'TOUS' ||
      this.filtreAgent() !== 'TOUS' ||
      !!this.recherche().trim(),
  );

  changerStatut(valeur: string): void {
    this.filtreStatut.set(valeur as FiltreStatut);
    this.page.set(1);
  }

  changerModalite(valeur: string): void {
    this.filtreModalite.set(valeur as FiltreModalite);
    this.page.set(1);
  }

  changerAgent(valeur: string): void {
    this.filtreAgent.set(valeur);
    this.page.set(1);
  }

  rechercher(terme: string): void {
    this.recherche.set(terme);
    this.page.set(1);
  }

  reinitialiserFiltres(): void {
    this.filtreStatut.set('TOUS');
    this.filtreModalite.set('TOUS');
    this.filtreAgent.set('TOUS');
    this.recherche.set('');
    this.page.set(1);
  }

  /** Raccourci depuis un indicateur : rendez-vous à confirmer. */
  voirAConfirmer(): void {
    this.reinitialiserFiltres();
    this.filtreStatut.set('EN_ATTENTE');
  }

  // ---------- Panneau et actions ----------

  ouvrir(v: VisiteRendezVous): void {
    this.selectionId.set(v.id);
  }

  fermer(): void {
    // Échap ferme d'abord le dialogue ouvert par-dessus le panneau.
    if (!this.enCours() && !this.dialogue()) this.selectionId.set(null);
  }

  /** Action principale d'une ligne : attribuer (ce qui confirme) ou confirmer si un agent est déjà prévu. */
  actionPrincipale(v: VisiteRendezVous): void {
    this.selectionId.set(v.id);
    if (v.agentAssignId) this.confirmer();
    else this.dialogue.set('attribution');
  }

  ouvrirDialogue(d: Exclude<Dialogue, null>): void {
    this.dialogue.set(d);
  }

  fermerDialogue(): void {
    if (!this.enCours()) this.dialogue.set(null);
  }

  attribuer(agentId: number): void {
    const v = this.selection();
    if (!v) return;
    const agent = this.agents().find((a) => a.id === agentId);
    const nomAgent = agent ? `${agent.prenom} ${agent.nom}` : 'L’agent choisi';
    this.executer(this.societeService.assignAgentToVisite(v.id, agentId), {
      titre: 'Rendez-vous confirmé',
      message: `${nomAgent} accompagnera ${v.prospectNom} (${this.modalites[v.typeVisite].libelle.toLowerCase()}).`,
      echec: 'Attribution impossible.',
    });
  }

  confirmer(): void {
    const v = this.selection();
    if (!v) return;
    this.executer(this.societeService.accepterVisite(v.id), {
      titre: 'Rendez-vous confirmé',
      message: `Le rendez-vous de ${v.prospectNom} est confirmé.`,
      echec: 'Confirmation impossible.',
    });
  }

  refuser(motif: string): void {
    const v = this.selection();
    if (!v) return;
    this.executer(this.societeService.refuserVisite(v.id, motif), {
      titre: v.statut === 'EN_ATTENTE' ? 'Demande refusée' : 'Rendez-vous annulé',
      message: `${v.prospectNom} sera informé du motif.`,
      echec: 'Action impossible.',
    });
  }

  private executer(
    action: Observable<unknown>,
    textes: { titre: string; message: string; echec: string },
  ): void {
    this.enCours.set(true);
    action.subscribe({
      next: () => {
        this.enCours.set(false);
        this.dialogue.set(null);
        this.toast.success(textes.titre, textes.message);
      },
      error: (err) => {
        this.enCours.set(false);
        this.dialogue.set(null);
        this.toast.error('Action refusée', messageErreurApi(err, textes.echec));
      },
    });
  }
}
