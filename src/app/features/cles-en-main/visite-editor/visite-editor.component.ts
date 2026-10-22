import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { LienPanorama } from '../../../core/models/media.models';
import { MaisonCleEnMain } from '../../../core/models/maison.models';
import { PanoramaAffichable } from '../../../core/services/apercu-medias.service';
import { MediaService } from '../../../core/services/media.service';
import { ToastService } from '../../../core/services/toast.service';
import { messageErreurApi } from '../../../core/utils/api-error';
import { PanoramaModalComponent } from '../../../shared/components/panorama-modal/panorama-modal.component';
import { PanoramaViewerComponent } from '../../../shared/components/panorama-viewer/panorama-viewer.component';
import { Direction } from '../../../shared/components/panorama-viewer/panorama-geometrie';
import { indexDepart, libellePorte, pointsDuPanorama, vueArrivee } from '../../../shared/components/panorama-viewer/visite-virtuelle';

/** vue : navigation ; placement / deplacement : clic dans l'image ; arrivee : réglage de la vue d'arrivée. */
type Mode = 'vue' | 'placement' | 'deplacement' | 'arrivee';

interface Brouillon {
  direction: Direction;
  cibleId: number | null;
  libelle: string;
  retour: boolean;
}

/**
 * Éditeur de la visite virtuelle d'une maison clé en main : dans chaque panorama (pièce),
 * la société pose des points de passage vers les autres pièces (« Salon → Chambre »),
 * choisit la pièce de départ, règle la vue d'arrivée de chaque point et teste la visite.
 */
@Component({
  selector: 'app-visite-editor',
  standalone: true,
  imports: [FormsModule, MatIcon, PanoramaModalComponent, PanoramaViewerComponent],
  templateUrl: './visite-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisiteEditorComponent implements OnInit {
  private readonly mediaService = inject(MediaService);
  private readonly toast = inject(ToastService);

  readonly maison = input.required<MaisonCleEnMain>();
  readonly fermer = output<void>();

  private readonly viewer = viewChild(PanoramaViewerComponent);

  readonly chargement = signal(true);
  readonly enCours = signal(false);
  readonly panoramas = signal<PanoramaAffichable[]>([]);
  readonly liens = signal<LienPanorama[]>([]);
  readonly courantId = signal<number | null>(null);
  readonly arrivee = signal<Direction | null>(null);
  readonly mode = signal<Mode>('vue');
  readonly brouillon = signal<Brouillon | null>(null);
  readonly selectionId = signal<number | null>(null);
  readonly libelleSelection = signal('');
  readonly departId = signal<number | null>(null);
  /** Point dont on règle la vue d'arrivée (mode « arrivee »). */
  readonly lienArrivee = signal<LienPanorama | null>(null);
  readonly test = signal(false);

  readonly courant = computed(() => this.panoramas().find((p) => p.id === this.courantId()) ?? null);
  /** Pièce de départ effective : celle choisie, sinon la première. */
  readonly departEffectif = computed(() => this.panoramas()[indexDepart(this.panoramas(), this.departId())]?.id ?? null);
  readonly points = computed(() => {
    const id = this.courantId();
    return id == null ? [] : pointsDuPanorama(this.liens(), id, this.panoramas());
  });
  readonly autresPieces = computed(() => this.panoramas().filter((p) => p.id !== this.courantId()));
  readonly selection = computed(() => this.liens().find((l) => l.id === this.selectionId()) ?? null);

  ngOnInit(): void {
    const maison = this.maison();
    forkJoin({
      medias: this.mediaService.list({ kind: 'bien', id: maison.id, titre: maison.titre }),
      visite: this.mediaService.visite(maison.id),
    }).subscribe({
      next: ({ medias, visite }) => {
        const panoramas = medias
          .filter((m) => m.type === 'PANORAMA_360')
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
          .map((m, i) => ({ id: m.id, titre: m.titre || `Pièce ${i + 1}`, url: this.mediaService.urlAbsolue(m) }));
        this.panoramas.set(panoramas);
        this.liens.set(visite.liens);
        this.departId.set(visite.panoramaDepartId);
        this.courantId.set(panoramas[indexDepart(panoramas, visite.panoramaDepartId)]?.id ?? null);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.toast.error('Visite virtuelle', messageErreurApi(err, 'Chargement impossible.'));
      },
    });
  }

  @HostListener('document:keydown.escape')
  echap(): void {
    if (this.test()) this.test.set(false);
    else if (this.brouillon() || this.mode() !== 'vue') this.annuler();
    else if (!this.enCours()) this.fermer.emit();
  }

  nombrePoints(panoramaId: number): number {
    return this.liens().filter((l) => l.sourceId === panoramaId).length;
  }

  titrePiece(id: number): string {
    return this.panoramas().find((p) => p.id === id)?.titre ?? 'Pièce';
  }

  allerA(panoramaId: number, par?: LienPanorama): void {
    this.annuler();
    this.arrivee.set(par ? vueArrivee(this.liens(), par) : null);
    this.courantId.set(panoramaId);
  }

  definirDepart(): void {
    const panoramaId = this.courantId();
    if (panoramaId == null) return;
    this.enCours.set(true);
    this.mediaService.definirDepart(this.maison().id, panoramaId).subscribe({
      next: (visite) => {
        this.enCours.set(false);
        this.departId.set(visite.panoramaDepartId);
        this.toast.success('Pièce de départ', `La visite commencera par « ${this.titrePiece(panoramaId)} ».`);
      },
      error: (err) => this.echec(err),
    });
  }

  /** Ouvre la pièce cible du point : on tourne la vue vers ce que l'acquéreur doit voir en entrant. */
  reglerArrivee(): void {
    const lien = this.selection();
    if (!lien) return;
    this.allerA(lien.cibleId, lien);
    this.lienArrivee.set(lien);
    this.mode.set('arrivee');
  }

  /** Enregistre la vue actuelle, ou revient au calcul automatique ([automatique]). */
  validerArrivee(automatique = false): void {
    const lien = this.lienArrivee();
    const viewer = this.viewer();
    if (!lien || (!automatique && !viewer)) return;
    const vue = automatique ? null : viewer!.vueActuelle();
    this.enCours.set(true);
    this.mediaService.definirVueArrivee(lien.id, vue).subscribe({
      next: (maj) => {
        this.enCours.set(false);
        this.liens.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        this.annuler();
        this.toast.success(
          'Vue d’arrivée',
          automatique
            ? `En entrant dans « ${this.titrePiece(maj.cibleId)} », la vue sera calculée automatiquement.`
            : `En entrant dans « ${this.titrePiece(maj.cibleId)} », l’acquéreur verra cette vue.`,
        );
      },
      error: (err) => this.echec(err),
    });
  }

  commencerPlacement(): void {
    this.selectionId.set(null);
    this.brouillon.set(null);
    this.mode.set('placement');
  }

  annuler(): void {
    this.mode.set('vue');
    this.brouillon.set(null);
    this.selectionId.set(null);
    this.lienArrivee.set(null);
  }

  /** Clic dans l'image : nouveau point, ou nouvelle position du point sélectionné. */
  clicVue(direction: Direction): void {
    if (this.mode() === 'placement') {
      const cible = this.autresPieces()[0] ?? null;
      this.brouillon.set({ direction, cibleId: cible?.id ?? null, libelle: cible?.titre ?? '', retour: true });
      this.mode.set('vue');
    } else if (this.mode() === 'deplacement') {
      const lien = this.selection();
      if (lien) this.enregistrerPosition(lien, direction);
    }
  }

  choisirCible(cibleId: number): void {
    this.brouillon.update((b) => (b ? { ...b, cibleId, libelle: this.titrePiece(cibleId) } : b));
  }

  modifierBrouillon(champ: 'libelle' | 'retour', valeur: string | boolean): void {
    this.brouillon.update((b) => (b ? { ...b, [champ]: valeur } : b));
  }

  creer(): void {
    const b = this.brouillon();
    const source = this.courantId();
    if (!b || source == null || b.cibleId == null) return;
    this.enCours.set(true);
    this.mediaService
      .creerLien({ sourceId: source, cibleId: b.cibleId, ...b.direction, libelle: b.libelle.trim(), creerRetour: b.retour })
      .subscribe({
        next: (crees) => {
          this.enCours.set(false);
          this.liens.update((l) => [...l, ...crees]);
          this.brouillon.set(null);
          const retour = crees.length > 1;
          this.toast.success(
            'Point ajouté',
            retour
              ? `Un point retour a aussi été posé dans « ${this.titrePiece(b.cibleId!)} » : allez-y pour l’ajuster.`
              : `Il mène vers « ${this.titrePiece(b.cibleId!)} ».`,
          );
        },
        error: (err) => this.echec(err),
      });
  }

  choisirPoint(id: number): void {
    if (this.mode() !== 'vue') return;
    const lien = this.liens().find((l) => l.id === id);
    this.brouillon.set(null);
    this.selectionId.set(id);
    this.libelleSelection.set(lien ? libellePorte(lien, this.panoramas()) : '');
  }

  deplacer(): void {
    this.mode.set('deplacement');
  }

  renommer(): void {
    const lien = this.selection();
    const libelle = this.libelleSelection().trim();
    if (!lien || !libelle || libelle === lien.libelle) return;
    this.mettreAJour(lien, { azimut: lien.azimut, elevation: lien.elevation, libelle }, 'Point renommé');
  }

  supprimer(): void {
    const lien = this.selection();
    if (!lien) return;
    this.enCours.set(true);
    this.mediaService.supprimerLien(lien.id).subscribe({
      next: () => {
        this.enCours.set(false);
        this.liens.update((l) => l.filter((x) => x.id !== lien.id));
        this.selectionId.set(null);
        this.toast.success('Point supprimé', `Le point ne mène plus vers ${this.titrePiece(lien.cibleId)}.`);
      },
      error: (err) => this.echec(err),
    });
  }

  suivre(): void {
    const lien = this.selection();
    if (lien) this.allerA(lien.cibleId, lien);
  }

  private enregistrerPosition(lien: LienPanorama, direction: Direction): void {
    this.mettreAJour(lien, { ...direction, libelle: lien.libelle ?? undefined }, 'Point déplacé');
  }

  private mettreAJour(lien: LienPanorama, valeurs: { azimut: number; elevation: number; libelle?: string }, titre: string): void {
    this.enCours.set(true);
    this.mediaService.modifierLien(lien.id, valeurs).subscribe({
      next: (maj) => {
        this.enCours.set(false);
        this.mode.set('vue');
        this.liens.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        this.toast.success(titre, `« ${libellePorte(maj, this.panoramas())} »`);
      },
      error: (err) => this.echec(err),
    });
  }

  private echec(err: unknown): void {
    this.enCours.set(false);
    this.mode.set('vue');
    this.toast.error('Visite virtuelle', messageErreurApi(err, 'Enregistrement impossible.'));
  }
}
