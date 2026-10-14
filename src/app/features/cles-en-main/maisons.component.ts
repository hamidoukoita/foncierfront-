import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MaisonCleEnMain } from '../../core/models/maison.models';
import { MediaCible } from '../../core/models/media.models';
import { ApercuMediasService, PanoramaAffichable } from '../../core/services/apercu-medias.service';
import { MaisonsService } from '../../core/services/maisons.service';
import { ToastService } from '../../core/services/toast.service';
import { messageErreurApi } from '../../core/utils/api-error';
import { formaterFcfa, formaterMontantCompact, normaliser } from '../../core/utils/format';
import { CarteActionComponent } from '../../shared/components/carte-action/carte-action.component';
import { ChampRechercheComponent } from '../../shared/components/champ-recherche/champ-recherche.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { CouvertureDialogComponent } from '../../shared/components/couverture-dialog/couverture-dialog.component';
import { FiltreOngletsComponent, OngletFiltre } from '../../shared/components/filtre-onglets/filtre-onglets.component';
import { FoncierCardComponent } from '../../shared/components/foncier-card/foncier-card.component';
import { MediaManagerComponent } from '../../shared/components/media-manager/media-manager.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { PanneauLateralComponent } from '../../shared/components/panneau-lateral/panneau-lateral.component';
import { PanoramaModalComponent } from '../../shared/components/panorama-modal/panorama-modal.component';
import { StatsCardComponent } from '../../shared/components/stats-card/stats-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { libelleStatutMaison } from './maison-statut';
import { MaisonDetailComponent } from './maison-detail/maison-detail.component';
import { MaisonFormComponent } from './maison-form/maison-form.component';

type Filtre = 'TOUTES' | 'DISPONIBLE' | 'RESERVER' | 'VENDUE' | 'AUTRES';

const TAILLE_PAGE = 6;

/** Maisons clés en main de la société : publication, médias, disponibilité. */
@Component({
  selector: 'app-maisons',
  standalone: true,
  imports: [
    MatIcon,
    CarteActionComponent,
    ChampRechercheComponent,
    ConfirmDialogComponent,
    CouvertureDialogComponent,
    FiltreOngletsComponent,
    FoncierCardComponent,
    MediaManagerComponent,
    PaginationComponent,
    PanneauLateralComponent,
    PanoramaModalComponent,
    StatsCardComponent,
    StatusBadgeComponent,
    MaisonDetailComponent,
    MaisonFormComponent,
  ],
  providers: [ApercuMediasService],
  templateUrl: './maisons.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaisonsComponent implements OnInit {
  private readonly maisonsService = inject(MaisonsService);
  private readonly toast = inject(ToastService);
  readonly apercu = inject(ApercuMediasService);

  readonly maisons = this.maisonsService.maisons;
  readonly isLoading = signal(false);
  readonly filtre = signal<Filtre>('TOUTES');
  readonly recherche = signal('');
  readonly page = signal(1);
  readonly taillePage = TAILLE_PAGE;

  /** undefined : formulaire fermé ; null : création ; maison : modification. */
  readonly enEdition = signal<MaisonCleEnMain | null | undefined>(undefined);
  readonly selectionId = signal<number | null>(null);
  readonly selection = computed(() => this.maisons().find((m) => m.id === this.selectionId()) ?? null);
  readonly aSupprimer = signal<MaisonCleEnMain | null>(null);

  readonly mediaCible = signal<MediaCible | null>(null);
  readonly couvertureCible = signal<MediaCible | null>(null);
  readonly visite360 = signal<{ titre: string; panoramas: PanoramaAffichable[] } | null>(null);

  private readonly chargementApercus = effect(() => {
    const maisons = this.maisons();
    untracked(() => this.apercu.charger(maisons.map((m) => this.cible(m))));
  });

  ngOnInit(): void {
    this.actualiser();
  }

  actualiser(): void {
    this.isLoading.set(true);
    this.maisonsService.charger().subscribe({
      next: () => this.isLoading.set(false),
      error: (e) => {
        this.isLoading.set(false);
        this.toast.error('Clés en main', messageErreurApi(e, 'Chargement impossible.'));
      },
    });
  }

  // ---------- Indicateurs et filtres ----------

  readonly kpis = computed(() => {
    const l = this.maisons();
    const dispo = l.filter((m) => m.statut === 'DISPONIBLE');
    return {
      total: l.length,
      disponibles: dispo.length,
      reservees: l.filter((m) => m.statut === 'RESERVER').length,
      vendues: l.filter((m) => m.statut === 'VENDUE').length,
      valeur: formaterMontantCompact(dispo.reduce((s, m) => s + Number(m.prix ?? 0), 0)),
    };
  });

  readonly onglets = computed<OngletFiltre[]>(() => {
    const l = this.maisons();
    const n = (f: (m: MaisonCleEnMain) => boolean) => l.filter(f).length;
    return [
      { valeur: 'TOUTES', libelle: 'Toutes', icone: 'apps', compte: l.length },
      { valeur: 'DISPONIBLE', libelle: 'Disponibles', compte: n((m) => m.statut === 'DISPONIBLE') },
      { valeur: 'RESERVER', libelle: 'Réservées', compte: n((m) => m.statut === 'RESERVER') },
      { valeur: 'VENDUE', libelle: 'Vendues', compte: n((m) => m.statut === 'VENDUE') },
      { valeur: 'AUTRES', libelle: 'Indisponibles', compte: n((m) => m.statut === 'INDISPONIBLE' || m.statut === 'EN_LITIGE') },
    ];
  });

  readonly filtrees = computed(() => {
    const f = this.filtre();
    const q = normaliser(this.recherche().trim());
    return this.maisons()
      .filter((m) =>
        f === 'TOUTES' ? true : f === 'AUTRES' ? m.statut === 'INDISPONIBLE' || m.statut === 'EN_LITIGE' : m.statut === f,
      )
      .filter((m) => !q || [m.titre, m.reference, m.adresse, m.numeroTitreFoncier].some((v) => normaliser(v).includes(q)));
  });

  readonly pageCourante = computed(() => {
    const debut = (this.page() - 1) * TAILLE_PAGE;
    return this.filtrees().slice(debut, debut + TAILLE_PAGE);
  });

  changerFiltre(valeur: string): void {
    this.filtre.set(valeur as Filtre);
    this.page.set(1);
  }

  rechercher(terme: string): void {
    this.recherche.set(terme);
    this.page.set(1);
  }

  libelleStatut(m: MaisonCleEnMain): string {
    return libelleStatutMaison(m.statut);
  }

  prix(m: MaisonCleEnMain): string {
    return formaterFcfa(Number(m.prix ?? 0));
  }

  /** Échap ferme d'abord le formulaire ou la confirmation ouverts par-dessus la fiche. */
  fermerFiche(): void {
    if (!this.aSupprimer() && this.enEdition() === undefined && !this.mediaCible()) this.selectionId.set(null);
  }

  // ---------- Médias ----------

  private cible(m: MaisonCleEnMain): MediaCible {
    return { kind: 'bien', id: m.id, titre: m.titre };
  }

  ouvrirGalerie(m: MaisonCleEnMain): void {
    this.mediaCible.set(this.cible(m));
  }

  fermerGalerie(): void {
    const cible = this.mediaCible();
    if (cible) this.apercu.rafraichir(cible);
    this.mediaCible.set(null);
  }

  ouvrirCouverture(m: MaisonCleEnMain): void {
    this.couvertureCible.set(this.cible(m));
  }

  fermerCouverture(modifiee: boolean): void {
    const cible = this.couvertureCible();
    if (cible && modifiee) this.apercu.rafraichir(cible);
    this.couvertureCible.set(null);
  }

  /** Visite 360° ; sans panorama, ouvre la galerie pour en ajouter un. */
  ouvrir360(m: MaisonCleEnMain): void {
    const panoramas = this.apercu.panoramas(m.id);
    if (panoramas.length === 0) {
      this.toast.info('Aucune vue 360°', 'Ajoutez un panorama 360° pour proposer la visite virtuelle de la maison.');
      this.ouvrirGalerie(m);
      return;
    }
    this.visite360.set({ titre: m.titre, panoramas });
  }

  // ---------- Suppression ----------

  confirmerSuppression(): void {
    const m = this.aSupprimer();
    if (!m) return;
    this.maisonsService.supprimer(m.id).subscribe({
      next: () => {
        this.aSupprimer.set(null);
        this.selectionId.set(null);
        this.toast.success('Maison supprimée', `${m.titre} n’est plus proposée aux acquéreurs.`);
      },
      error: (e) => {
        this.aSupprimer.set(null);
        this.toast.error('Suppression impossible', messageErreurApi(e, 'Cette maison a peut-être des réservations.'));
      },
    });
  }
}
