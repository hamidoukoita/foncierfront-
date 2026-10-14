import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { MatIcon } from '@angular/material/icon';
import { MediaService } from '../../../core/services/media.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MEDIA_TAILLE_MAX_OCTETS,
  MEDIA_TYPES_ACCEPTES,
  MediaCible,
  MediaFoncier,
} from '../../../core/models/media.models';
import { messageErreurApi } from '../../../core/utils/api-error';

/**
 * Choix de la photo de couverture d'une cité ou d'une parcelle :
 * importer une nouvelle photo, ou choisir parmi celles de la galerie.
 */
@Component({
  selector: 'app-couverture-dialog',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './couverture-dialog.component.html',
})
export class CouvertureDialogComponent implements OnInit {
  private readonly mediaService = inject(MediaService);
  private readonly toast = inject(ToastService);

  readonly cible = input.required<MediaCible>();
  /** Émis à la fermeture ; `true` si la couverture a changé. */
  readonly closed = output<boolean>();

  readonly photos = signal<MediaFoncier[]>([]);
  readonly chargement = signal(true);
  readonly envoiEnCours = signal(false);
  readonly progression = signal(0);
  readonly enCoursId = signal<number | null>(null);
  readonly survolDepot = signal(false);
  private modifie = false;

  readonly couverture = computed(() => this.photos()[0] ?? null);

  ngOnInit(): void {
    this.charger();
  }

  url(media: MediaFoncier): string {
    return this.mediaService.urlAbsolue(media);
  }

  private charger(): void {
    this.mediaService.list(this.cible()).subscribe({
      next: (liste) => {
        this.photos.set(liste.filter((m) => m.type === 'PHOTO').sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)));
        this.chargement.set(false);
      },
      error: (e) => {
        this.chargement.set(false);
        this.toast.error('Galerie indisponible', messageErreurApi(e, 'Impossible de charger les photos.'));
      },
    });
  }

  choisir(media: MediaFoncier): void {
    if (media.id === this.couverture()?.id || this.enCoursId()) return;
    this.enCoursId.set(media.id);
    this.mediaService.definirCouverture(media.id).subscribe({
      next: () => {
        this.modifie = true;
        this.enCoursId.set(null);
        this.photos.update((l) => [media, ...l.filter((m) => m.id !== media.id)]);
        this.toast.success('Couverture mise à jour', 'Elle s’affiche désormais sur la carte.');
      },
      error: (e) => {
        this.enCoursId.set(null);
        this.toast.error('Modification impossible', messageErreurApi(e, 'Réessayez.'));
      },
    });
  }

  deposer(event: DragEvent): void {
    event.preventDefault();
    this.survolDepot.set(false);
    const fichier = event.dataTransfer?.files?.[0];
    if (fichier) this.envoyer(fichier);
  }

  selectionner(event: Event): void {
    const champ = event.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (fichier) this.envoyer(fichier);
  }

  /** Envoie la photo puis en fait directement la couverture. */
  private envoyer(fichier: File): void {
    if (!MEDIA_TYPES_ACCEPTES.includes(fichier.type)) {
      this.toast.warning('Format non supporté', 'Choisissez une image JPEG, PNG ou WebP.');
      return;
    }
    if (fichier.size > MEDIA_TAILLE_MAX_OCTETS) {
      this.toast.warning('Fichier trop lourd', 'La photo ne doit pas dépasser 25 Mo.');
      return;
    }
    this.envoiEnCours.set(true);
    this.progression.set(0);
    this.mediaService.envoyerFichier(this.cible(), fichier, 'PHOTO', 'Couverture').subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progression.set(Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response && event.body?.data) {
          const media = event.body.data;
          this.envoiEnCours.set(false);
          this.photos.update((l) => [...l, media]);
          this.choisir(media);
        }
      },
      error: (e) => {
        this.envoiEnCours.set(false);
        this.toast.error('Envoi impossible', messageErreurApi(e, 'La photo n’a pas pu être envoyée.'));
      },
    });
  }

  @HostListener('document:keydown.escape')
  fermer(): void {
    if (!this.envoiEnCours()) this.closed.emit(this.modifie);
  }
}
