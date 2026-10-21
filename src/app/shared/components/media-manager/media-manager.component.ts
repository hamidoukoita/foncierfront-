import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { MEDIA_TAILLE_MAX_OCTETS, MEDIA_TYPES_ACCEPTES, MediaCible, MediaFoncier, TypeMedia } from '../../../core/models/media.models';
import { MediaService } from '../../../core/services/media.service';
import { ToastService } from '../../../core/services/toast.service';
import { completerPanorama, diagnostiquerPanorama } from '../../../core/utils/panorama';
import { PanoramaViewerComponent } from '../panorama-viewer/panorama-viewer.component';

type Filtre = 'TOUS' | TypeMedia;

/**
 * Fenêtre de gestion des médias d'un programme ou d'un bien :
 * photos et panoramas 360° (visionneuse interactive).
 */
@Component({
  selector: 'app-media-manager',
  standalone: true,
  imports: [PanoramaViewerComponent],
  templateUrl: './media-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaManagerComponent implements OnInit, OnDestroy {
  readonly cible = input.required<MediaCible>();
  readonly closed = output<void>();

  private readonly mediaService = inject(MediaService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly medias = signal<MediaFoncier[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly loadError = signal<string | null>(null);
  readonly selectedId = signal<number | null>(null);
  readonly filtre = signal<Filtre>('TOUS');
  readonly confirmDeleteId = signal<number | null>(null);

  // Formulaire d'ajout
  readonly formType = signal<TypeMedia>('PANORAMA_360');
  readonly formTitre = signal<string>('');
  readonly fichier = signal<File | null>(null);
  readonly fichierAlerte = signal<string | null>(null);
  readonly fichierInfo = signal<string | null>(null);
  /** Adaptation d'un panorama en cours, avant l'envoi. */
  readonly isPreparing = signal<boolean>(false);
  readonly formErreur = signal<string | null>(null);
  readonly progression = signal<number | null>(null);
  readonly isSending = signal<boolean>(false);

  readonly filtres: { id: Filtre; label: string }[] = [
    { id: 'TOUS', label: 'Tous' },
    { id: 'PHOTO', label: 'Photos' },
    { id: 'PANORAMA_360', label: 'Panoramas 360°' },
  ];

  readonly visibles = computed(() => {
    const f = this.filtre();
    return f === 'TOUS' ? this.medias() : this.medias().filter((m) => m.type === f);
  });
  readonly selectionne = computed(() => {
    const liste = this.visibles();
    return liste.find((m) => m.id === this.selectedId()) ?? liste[0] ?? null;
  });
  readonly urlSelection = computed(() => {
    const m = this.selectionne();
    return m ? this.mediaService.urlAbsolue(m) : '';
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isSending()) this.closed.emit();
  }

  ngOnInit(): void {
    // La fenêtre est rattachée au <body> : elle passe ainsi au-dessus de l'en-tête et de la navigation,
    // quel que soit le contexte d'empilement de la page qui l'ouvre.
    document.body.appendChild(this.host.nativeElement);
    this.charger();
  }

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
  }

  compte(f: Filtre): number {
    return f === 'TOUS' ? this.medias().length : this.medias().filter((m) => m.type === f).length;
  }

  libelleType(type: TypeMedia): string {
    return type === 'PHOTO' ? 'Photo' : 'Panorama 360°';
  }

  url(m: MediaFoncier): string {
    return this.mediaService.urlAbsolue(m);
  }

  charger(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.mediaService.list(this.cible()).subscribe({
      next: (liste) => {
        this.medias.set(liste);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.loadError.set(this.messageErreur(err, 'Impossible de charger les médias.'));
      },
    });
  }

  selectionner(m: MediaFoncier): void {
    this.selectedId.set(m.id);
    this.confirmDeleteId.set(null);
  }

  changerFiltre(f: Filtre): void {
    this.filtre.set(f);
    this.selectedId.set(null);
    this.confirmDeleteId.set(null);
  }

  // ------------------------------------------------------------------ Formulaire

  changerType(valeur: string): void {
    this.formType.set(valeur as TypeMedia);
    this.fichier.set(null);
    this.fichierAlerte.set(null);
    this.fichierInfo.set(null);
    this.formErreur.set(null);
  }

  choisirFichier(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.fichier.set(null);
    this.fichierAlerte.set(null);
    this.fichierInfo.set(null);
    this.formErreur.set(null);
    if (!f) return;

    if (!MEDIA_TYPES_ACCEPTES.includes(f.type)) {
      this.formErreur.set('Format non supporté : choisissez une image JPEG, PNG ou WebP.');
      input.value = '';
      return;
    }
    if (f.size > MEDIA_TAILLE_MAX_OCTETS) {
      this.formErreur.set('Le fichier dépasse 25 Mo.');
      input.value = '';
      return;
    }
    if (this.formType() === 'PANORAMA_360') void this.preparerPanorama(f);
    else this.fichier.set(f);
  }

  /**
   * Un panorama 360° doit être au format 2:1. Un panorama de téléphone, plus large, est complété
   * automatiquement en haut et en bas ; une photo classique est acceptée avec un avertissement.
   */
  private async preparerPanorama(f: File): Promise<void> {
    this.isPreparing.set(true);
    try {
      const image = await createImageBitmap(f);
      const { width, height } = image;
      image.close();
      const diagnostic = diagnostiquerPanorama(width, height);
      if (diagnostic.cas === 'a-completer') {
        const adapte = await completerPanorama(f, diagnostic.largeur, diagnostic.hauteur);
        this.fichier.set(adapte.size <= MEDIA_TAILLE_MAX_OCTETS ? adapte : f);
        this.fichierInfo.set(
          `Panorama adapté au format 360° (${width}×${height} → ${diagnostic.largeur}×${diagnostic.hauteur}) : ` +
            'le haut et le bas sont complétés pour un affichage sans déformation.',
        );
        return;
      }
      this.fichier.set(f);
      if (diagnostic.cas === 'trop-etroite') {
        this.fichierAlerte.set(
          `Cette image (${width}×${height}) ressemble à une photo classique, pas à un panorama. ` +
            'Choisissez le type « Photo », ou prenez la vue en mode panorama de votre téléphone.',
        );
      }
    } catch {
      // Image illisible par le navigateur : envoyée telle quelle, le serveur la validera.
      this.fichier.set(f);
    } finally {
      this.isPreparing.set(false);
    }
  }

  peutAjouter(): boolean {
    if (this.isSending() || this.isPreparing()) return false;
    return this.fichier() !== null;
  }

  ajouter(): void {
    this.formErreur.set(null);
    const titre = this.formTitre();

    const f = this.fichier();
    if (!f) return;
    this.isSending.set(true);
    this.progression.set(0);
    const type = this.formType();
    this.mediaService.envoyerFichier(this.cible(), f, type, titre).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progression.set(Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.apresAjout(event.body.data, type === 'PANORAMA_360' ? 'Panorama ajouté' : 'Photo ajoutée');
        }
      },
      error: (err) => this.echecAjout(err),
    });
  }

  private apresAjout(media: MediaFoncier, titreToast: string): void {
    this.isSending.set(false);
    this.progression.set(null);
    this.medias.update((l) => [...l, media]);
    this.filtre.set('TOUS');
    this.selectedId.set(media.id);
    this.formTitre.set('');
    this.fichier.set(null);
    this.fichierAlerte.set(null);
    this.fichierInfo.set(null);
    this.toast.success(titreToast, `« ${media.titre || this.libelleType(media.type)} » est enregistré.`);
  }

  private echecAjout(err: unknown): void {
    this.isSending.set(false);
    this.progression.set(null);
    const message = this.messageErreur(err, "L'ajout a échoué. Réessayez.");
    this.formErreur.set(message);
    this.toast.error('Ajout impossible', message);
  }

  // ------------------------------------------------------------------ Suppression

  demanderSuppression(m: MediaFoncier): void {
    this.confirmDeleteId.set(m.id);
  }

  annulerSuppression(): void {
    this.confirmDeleteId.set(null);
  }

  supprimer(m: MediaFoncier): void {
    this.mediaService.supprimer(m.id).subscribe({
      next: () => {
        this.medias.update((l) => l.filter((x) => x.id !== m.id));
        this.confirmDeleteId.set(null);
        this.selectedId.set(null);
        this.toast.success('Média supprimé', `« ${m.titre || this.libelleType(m.type)} » a été retiré.`);
      },
      error: (err) => {
        this.confirmDeleteId.set(null);
        this.toast.error('Suppression impossible', this.messageErreur(err, 'La suppression a échoué.'));
      },
    });
  }

  // ------------------------------------------------------------------ Outils

  private messageErreur(err: unknown, defaut: string): string {
    if (err instanceof HttpErrorResponse) {
      const corps = err.error as { message?: string } | null;
      if (corps?.message) return corps.message;
      if (err.status === 0) return 'Serveur injoignable.';
      if (err.status === 413) return 'Le fichier est trop volumineux.';
    }
    return defaut;
  }
}
