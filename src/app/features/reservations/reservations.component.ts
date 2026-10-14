import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { Reservation } from '../../core/models/societe.models';
import { messageErreurApi } from '../../core/utils/api-error';
import { formaterDuree, formaterMontantCompact, normaliser } from '../../core/utils/format';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { StatsCardComponent } from '../../shared/components/stats-card/stats-card.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MotifDialogComponent } from '../../shared/components/motif-dialog/motif-dialog.component';
import { PanneauLateralComponent } from '../../shared/components/panneau-lateral/panneau-lateral.component';
import { AttributionAgentDialogComponent } from '../../shared/components/attribution-agent-dialog/attribution-agent-dialog.component';
import {
  FiltreOngletsComponent,
  OngletFiltre,
} from '../../shared/components/filtre-onglets/filtre-onglets.component';
import {
  DELAI_ATTRIBUTION_PAR_DEFAUT_HEURES,
  DelaiAttribution,
  delaiAttribution,
} from './reservation-delai';
import { ReservationLigneComponent } from './reservation-ligne/reservation-ligne.component';
import { ChampRechercheComponent } from '../../shared/components/champ-recherche/champ-recherche.component';
import {
  LIBELLES_STATUT,
  ReservationDetailComponent,
} from './reservation-detail/reservation-detail.component';

type FiltreStatut = 'TOUTES' | Reservation['statut'];
type Dialogue = 'attribution' | 'confirmation' | 'refus' | null;

const TAILLE_PAGE = 8;
const RAFRAICHISSEMENT_DELAIS_MS = 60_000;

/** Ordre de traitement : demandes en attente d'abord (la plus ancienne, donc la plus urgente, en tête). */
function comparer(a: Reservation, b: Reservation): number {
  const poids = (r: Reservation) => (r.statut === 'EN_ATTENTE' ? 0 : 1);
  if (poids(a) !== poids(b)) return poids(a) - poids(b);
  const date = (r: Reservation) => new Date(r.dateReservationIso ?? 0).getTime();
  return a.statut === 'EN_ATTENTE' ? date(a) - date(b) : date(b) - date(a);
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [
    MatIcon,
    RouterLink,
    PaginationComponent,
    StatsCardComponent,
    ConfirmDialogComponent,
    MotifDialogComponent,
    PanneauLateralComponent,
    AttributionAgentDialogComponent,
    FiltreOngletsComponent,
    ReservationLigneComponent,
    ChampRechercheComponent,
    ReservationDetailComponent,
  ],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly reservations = this.societeService.reservations;
  readonly agents = this.societeService.agents;
  readonly agentsActifs = this.societeService.agentsActifs;

  /** Règles fixées par la société dans son profil. */
  readonly regles = computed(() => {
    const profil = this.societeService.profilSociete();
    return {
      delai: formaterDuree(profil.delaiAttributionHeures ?? DELAI_ATTRIBUTION_PAR_DEFAUT_HEURES),
      multiple: profil.reservationMultiple ?? false,
    };
  });

  readonly isLoading = signal(false);
  readonly filtreStatut = signal<FiltreStatut>('TOUTES');
  /** 'TOUS', 'SANS_AGENT' ou l'identifiant d'un agent. */
  readonly filtreAgent = signal('TOUS');
  readonly recherche = signal('');
  readonly page = signal(1);
  readonly taillePage = TAILLE_PAGE;

  /** Horloge des comptes à rebours, rafraîchie chaque minute. */
  readonly maintenant = signal(Date.now());

  readonly selectionId = signal<number | null>(null);
  readonly selection = computed(
    () => this.reservations().find((r) => r.id === this.selectionId()) ?? null,
  );
  readonly dialogue = signal<Dialogue>(null);
  readonly enCours = signal(false);

  readonly libellesStatut = LIBELLES_STATUT;
  readonly suggestionsRefus = [
    'Bien déjà réservé par un autre acquéreur',
    'Dossier incomplet',
    'Acquéreur injoignable',
  ];

  constructor() {
    const minuterie = setInterval(() => this.maintenant.set(Date.now()), RAFRAICHISSEMENT_DELAIS_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(minuterie));
  }

  ngOnInit(): void {
    this.actualiser();
    this.societeService.getAgents().subscribe();
    this.societeService.getProfilSociete().subscribe({ error: () => undefined });
  }

  actualiser(): void {
    this.isLoading.set(true);
    this.societeService.getReservations().subscribe({
      next: () => this.isLoading.set(false),
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Réservations', messageErreurApi(err, 'Chargement impossible.'));
      },
    });
  }

  // ---------- Indicateurs ----------

  readonly kpis = computed(() => {
    const attente = this.reservations().filter((r) => r.statut === 'EN_ATTENTE');
    const sansAgent = attente.filter((r) => !r.agentAssignId);
    const maintenant = this.maintenant();
    return {
      aTraiter: attente.length,
      sansAgent: sansAgent.length,
      urgentes: sansAgent.filter((r) => delaiAttribution(r, maintenant)?.niveau === 'urgent').length,
      confirmees: this.reservations().filter((r) => r.statut === 'CONFIRMEE').length,
      valeurOption: formaterMontantCompact(attente.reduce((s, r) => s + r.montantFcfa, 0)),
    };
  });

  readonly onglets = computed<OngletFiltre[]>(() => {
    const liste = this.reservations();
    const compte = (s: Reservation['statut']) => liste.filter((r) => r.statut === s).length;
    return [
      { valeur: 'TOUTES', libelle: 'Toutes', compte: liste.length },
      { valeur: 'EN_ATTENTE', libelle: 'À traiter', icone: 'hourglass_top', compte: compte('EN_ATTENTE') },
      { valeur: 'CONFIRMEE', libelle: 'Confirmées', icone: 'task_alt', compte: compte('CONFIRMEE') },
      { valeur: 'ANNULEE', libelle: 'Annulées', icone: 'block', compte: compte('ANNULEE') },
    ];
  });

  // ---------- Liste ----------

  readonly filtrees = computed(() => {
    const statut = this.filtreStatut();
    const agent = this.filtreAgent();
    const terme = normaliser(this.recherche().trim());

    return this.reservations()
      .filter((r) => statut === 'TOUTES' || r.statut === statut)
      .filter((r) =>
        agent === 'TOUS'
          ? true
          : agent === 'SANS_AGENT'
            ? !r.agentAssignId
            : String(r.agentAssignId) === agent,
      )
      .filter(
        (r) =>
          !terme ||
          [r.numeroDossier, r.prospectNom, r.prospectTelephone, r.lotDesignation, r.programmeNom].some(
            (v) => normaliser(v).includes(terme),
          ),
      )
      .sort(comparer);
  });

  readonly pageCourante = computed(() => {
    const debut = (this.page() - 1) * TAILLE_PAGE;
    return this.filtrees().slice(debut, debut + TAILLE_PAGE);
  });

  readonly filtresActifs = computed(
    () =>
      this.filtreStatut() !== 'TOUTES' || this.filtreAgent() !== 'TOUS' || !!this.recherche().trim(),
  );

  changerStatut(valeur: string): void {
    this.filtreStatut.set(valeur as FiltreStatut);
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
    this.filtreStatut.set('TOUTES');
    this.filtreAgent.set('TOUS');
    this.recherche.set('');
    this.page.set(1);
  }

  /** Raccourci depuis un indicateur : demandes en attente sans agent. */
  voirSansAgent(): void {
    this.filtreStatut.set('EN_ATTENTE');
    this.filtreAgent.set('SANS_AGENT');
    this.page.set(1);
  }

  delai(r: Reservation): DelaiAttribution | null {
    return delaiAttribution(r, this.maintenant());
  }

  // ---------- Panneau et actions ----------

  ouvrir(r: Reservation): void {
    this.selectionId.set(r.id);
  }

  fermer(): void {
    // Échap ferme d'abord le dialogue ouvert par-dessus le panneau.
    if (!this.enCours() && !this.dialogue()) this.selectionId.set(null);
  }

  /** Action principale d'une ligne, selon l'étape du dossier. */
  actionPrincipale(r: Reservation): void {
    this.selectionId.set(r.id);
    this.dialogue.set(r.agentAssignId ? 'confirmation' : 'attribution');
  }

  ouvrirDialogue(d: Exclude<Dialogue, null>): void {
    this.dialogue.set(d);
  }

  fermerDialogue(): void {
    if (!this.enCours()) this.dialogue.set(null);
  }

  attribuer(agentId: number): void {
    const r = this.selection();
    if (!r) return;
    const agent = this.agents().find((a) => a.id === agentId);
    const nomAgent = agent ? `${agent.prenom} ${agent.nom}` : 'l’agent choisi';
    this.executer(this.societeService.assignAgentToReservation(r.id, agentId), {
      titre: 'Dossier attribué',
      message: `${r.lotDesignation} (${r.prospectNom}) est confié à ${nomAgent}.`,
      echec: 'Attribution impossible.',
    });
  }

  confirmer(): void {
    const r = this.selection();
    if (!r) return;
    this.executer(this.societeService.confirmerReservation(r.id), {
      titre: 'Réservation confirmée',
      message: `${r.lotDesignation} est désormais réservé à ${r.prospectNom}.`,
      echec: 'Confirmation impossible.',
    });
  }

  refuser(motif: string): void {
    const r = this.selection();
    if (!r) return;
    this.executer(this.societeService.refuserReservation(r.id, motif), {
      titre: 'Demande refusée',
      message: `La demande de ${r.prospectNom} sur ${r.lotDesignation} est annulée.`,
      echec: 'Refus impossible.',
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
        // Le backend a pu annuler la demande (délai d'attribution dépassé) : on resynchronise.
        this.actualiser();
      },
    });
  }
}
