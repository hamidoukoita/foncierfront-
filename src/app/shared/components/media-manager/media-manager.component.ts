import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MEDIA_TAILLE_MAX_OCTETS, MEDIA_TYPES_ACCEPTES, MediaCible, MediaFoncier, TypeMedia } from '../../../core/models/media.models';
import { MediaService } from '../../../core/services/media.service';
import { ToastService } from '../../../core/services/toast.service';
import { PanoramaViewerComponent } from '../panorama-viewer/panorama-viewer.component';

type Filtre = 'TOUS' | TypeMedia;

/**
 * Fenêtre de gestion des médias d'un programme ou d'un bien :
 * photos, panoramas 360° (visionneuse interactive) et visites virtuelles (lien https intégré).
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
  private readonly sanitizer = inject(DomSanitizer);
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
  readonly formLien = signal<string>('');
  readonly fichier = signal<File | null>(null);
  readonly fichierAlerte = signal<string | null>(null);
  readonly formErreur = signal<string | null>(null);
  readonly progression = signal<number | null>(null);
  readonly isSending = signal<boolean>(false);

  readonly filtres: { id: Filtre; label: string }[] = [
    { id: 'TOUS', label: 'Tous' },
    { id: 'PHOTO', label: 'Photos' },
    { id: 'PANORAMA_360', label: 'Panoramas 360°' },
    { id: 'VISITE_VIRTUELLE', label: 'Visites virtuelles' },
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
  /** Le lien est validé en https côté formulaire et côté backend avant d'arriver ici. */
  readonly urlVisite = computed<SafeResourceUrl | null>(() => {
    const m = this.selectionne();
    return m && m.type === 'VISITE_VIRTUELLE' ? this.sanitizer.bypassSecurityTrustResourceUrl(m.url) : null;
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
    return type === 'PHOTO' ? 'Photo' : type === 'PANORAMA_360' ? 'Panorama 360°' : 'Visite virtuelle';
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
    this.formErreur.set(null);
  }

  choisirFichier(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.fichier.set(null);
    this.fichierAlerte.set(null);
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
    this.fichier.set(f);

    // Un vrai panorama équirectangulaire a un ratio 2:1 : on prévient sans bloquer.
    if (this.formType() === 'PANORAMA_360') {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (Math.abs(ratio - 2) > 0.15) {
          this.fichierAlerte.set(`Ce n'est pas une image 2:1 (${img.naturalWidth}×${img.naturalHeight}). L'affichage 360° sera déformé.`);
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    }
  }

  peutAjouter(): boolean {
    if (this.isSending()) return false;
    return this.formType() === 'VISITE_VIRTUELLE' ? this.formLien().trim().length > 0 : this.fichier() !== null;
  }

  ajouter(): void {
    this.formErreur.set(null);
    const titre = this.formTitre();

    if (this.formType() === 'VISITE_VIRTUELLE') {
      const lien = this.formLien().trim();
      if (!this.lienHttpsValide(lien)) {
        this.formErreur.set('Saisissez un lien complet commençant par https://');
        return;
      }
      this.isSending.set(true);
      this.mediaService.ajouterLien(this.cible(), lien, titre).subscribe({
        next: (m) => this.apresAjout(m, 'Visite virtuelle ajoutée'),
        error: (err) => this.echecAjout(err),
      });
      return;
    }

    const f = this.fichier();
    if (!f) return;
    this.isSending.set(true);
    this.progression.set(0);
    const type = this.formType() as Exclude<TypeMedia, 'VISITE_VIRTUELLE'>;
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
    this.formLien.set('');
    this.fichier.set(null);
    this.fichierAlerte.set(null);
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

  private lienHttpsValide(lien: string): boolean {
    try {
      const u = new URL(lien);
      return u.protocol === 'https:' && !!u.hostname;
    } catch {
      return false;
    }
  }

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
