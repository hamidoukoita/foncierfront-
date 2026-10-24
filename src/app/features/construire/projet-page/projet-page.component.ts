import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { forkJoin, of, switchMap } from 'rxjs';
import { ElementFil } from '../../../core/models/projet-echange.models';
import { FichierProjet, ModelMaison, ProjetConstruction } from '../../../core/models/societe.models';
import { ProjetEchangeService } from '../../../core/services/projet-echange.service';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { messageErreurApi } from '../../../core/utils/api-error';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MotifDialogComponent } from '../../../shared/components/motif-dialog/motif-dialog.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AvancementDialogComponent } from '../avancement-dialog/avancement-dialog.component';
import { FilProjetComponent } from '../fil-projet/fil-projet.component';
import { LIBELLES_STATUT_PROJET, ProjetDetailComponent } from '../projet-detail/projet-detail.component';
import { PropositionFormComponent, PropositionSaisie } from '../proposition-form/proposition-form.component';

type Dialogue = 'acceptation' | 'refus' | 'proposition' | 'avancement' | null;

/** L'acquéreur peut répondre à tout moment : le fil se met à jour régulièrement. */
const RAFRAICHISSEMENT_MS = 30_000;

/**
 * Page d'un projet de construction : le dossier de l'acquéreur à gauche, la discussion
 * (messages et propositions) à droite, et les décisions de la société en en-tête.
 */
@Component({
  selector: 'app-projet-page',
  standalone: true,
  imports: [
    RouterLink,
    MatIcon,
    StatusBadgeComponent,
    ProjetDetailComponent,
    FilProjetComponent,
    PropositionFormComponent,
    AvancementDialogComponent,
    ConfirmDialogComponent,
    MotifDialogComponent,
  ],
  templateUrl: './projet-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjetPageComponent {
  readonly id = input.required<string>();

  private readonly societeService = inject(SocieteService);
  private readonly echanges = inject(ProjetEchangeService);
  private readonly toast = inject(ToastService);

  readonly projet = signal<ProjetConstruction | null>(null);
  readonly fil = signal<ElementFil[]>([]);
  readonly modeles = signal<ModelMaison[]>([]);
  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly dialogue = signal<Dialogue>(null);
  readonly enCours = signal(false);
  readonly envoiMessage = signal(false);

  private readonly filProjet = viewChild(FilProjetComponent);

  readonly enCoursDeTraitement = computed(() => {
    const statut = this.projet()?.etatEtude;
    return statut === 'EN_ETUDE' || statut === 'EN_DISCUSSION';
  });
  readonly libelleStatut = computed(() => {
    const p = this.projet();
    return p ? (LIBELLES_STATUT_PROJET[p.etatEtude] ?? p.etatEtude) : '';
  });
  readonly propositionsEnAttente = computed(
    () => this.fil().filter((e) => e.type === 'PROPOSITION' && e.proposition.statut === 'EN_ATTENTE').length,
  );
  readonly suggestionsRefus = [
    'Titre Foncier illisible ou non fourni',
    'Terrain hors de notre zone d’intervention',
    'Projet incompatible avec la superficie du terrain',
  ];

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => {
        this.charger(id);
        this.lireNotifications(id);
      });
    });
    this.societeService.getModelesMaison().subscribe({
      next: (items) => this.modeles.set(items ?? []),
      error: () => this.modeles.set([]),
    });
    const minuterie = setInterval(() => this.rafraichirFil(), RAFRAICHISSEMENT_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(minuterie));
  }

  private get projetId(): number {
    return Number(this.id());
  }

  charger(id = this.projetId): void {
    this.chargement.set(true);
    this.erreur.set(null);
    forkJoin({ projet: this.societeService.getProjetConstruction(id), fil: this.echanges.fil(id) }).subscribe({
      next: ({ projet, fil }) => {
        this.projet.set(projet);
        this.fil.set(fil);
        this.chargement.set(false);
      },
      error: (e) => {
        this.chargement.set(false);
        this.erreur.set(messageErreurApi(e, 'Impossible de charger ce projet.'));
      },
    });
  }

  /** Le projet est ouvert : ses notifications ne sont plus « nouvelles » (échec sans conséquence). */
  private lireNotifications(id: number): void {
    this.societeService.marquerNotificationsLuesPourCible('PROJET_CONSTRUCTION', id).subscribe({ error: () => undefined });
  }

  /** Recharge discrètement le dossier et le fil (réponse de l'acquéreur, statut). */
  private rafraichirFil(): void {
    if (!this.projet() || this.dialogue()) return;
    forkJoin({
      projet: this.societeService.getProjetConstruction(this.projetId),
      fil: this.echanges.fil(this.projetId),
    }).subscribe({
      next: ({ projet, fil }) => {
        this.projet.set(projet);
        if (JSON.stringify(fil) !== JSON.stringify(this.fil())) this.fil.set(fil);
      },
    });
  }

  ouvrir(d: Exclude<Dialogue, null>): void {
    this.dialogue.set(d);
  }

  fermerDialogue(): void {
    if (!this.enCours()) this.dialogue.set(null);
  }

  envoyerMessage(texte: string): void {
    this.envoiMessage.set(true);
    this.echanges.envoyerMessage(this.projetId, texte).subscribe({
      next: () => {
        this.envoiMessage.set(false);
        this.filProjet()?.vider();
        this.charger();
      },
      error: (e) => {
        this.envoiMessage.set(false);
        this.toast.error('Message non envoyé', messageErreurApi(e, 'Réessayez.'));
      },
    });
  }

  proposer(saisie: PropositionSaisie): void {
    this.enCours.set(true);
    this.echanges
      .proposer(this.projetId, saisie.request)
      .pipe(switchMap((p) => (saisie.plan ? this.echanges.joindrePlan(p.id, saisie.plan) : of(null))))
      .subscribe({
        next: () => {
          this.toast.success('Proposition envoyée', `${this.projet()?.prospectNom} va pouvoir y répondre.`);
          this.terminerAction();
        },
        error: (e) => {
          this.enCours.set(false);
          this.toast.error('Proposition non envoyée', messageErreurApi(e, 'Réessayez.'));
          // La proposition a pu être créée sans son plan : le fil reflète l'état réel.
          this.charger();
        },
      });
  }

  accepter(): void {
    const p = this.projet();
    if (!p) return;
    this.enCours.set(true);
    this.societeService.validerProjetConstruction(p.id).subscribe({
      next: () => {
        this.toast.success('Projet accepté', `${p.prospectNom} est informé et peut suivre l’avancement.`);
        this.terminerAction();
      },
      error: (e) => this.echec(e),
    });
  }

  refuser(motif: string): void {
    const p = this.projet();
    if (!p) return;
    this.enCours.set(true);
    this.societeService.refuserProjetConstruction(p.id, motif).subscribe({
      next: () => {
        this.toast.success('Projet refusé', `${p.prospectNom} recevra le motif du refus.`);
        this.terminerAction();
      },
      error: (e) => this.echec(e),
    });
  }

  avancementEnregistre(message: string): void {
    this.toast.success('Avancement', message);
    this.terminerAction();
  }

  /** Les pièces sont privées : téléchargées avec le jeton puis ouvertes dans un nouvel onglet. */
  ouvrirFichier(f: FichierProjet): void {
    const onglet = window.open('', '_blank');
    this.societeService.telechargerFichierProjet(this.projetId, f.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (onglet) onglet.location.href = url;
        else window.location.assign(url);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => {
        onglet?.close();
        this.toast.error('Pièce jointe', messageErreurApi(e, 'Ouverture impossible.'));
      },
    });
  }

  private terminerAction(): void {
    this.enCours.set(false);
    this.dialogue.set(null);
    this.charger();
  }

  private echec(e: unknown): void {
    this.enCours.set(false);
    this.dialogue.set(null);
    this.toast.error('Action refusée', messageErreurApi(e, 'Le traitement du projet a échoué.'));
  }
}
