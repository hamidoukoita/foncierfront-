import { inject, Injectable, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MediaCible, MediaFoncier } from '../models/media.models';
import { MediaService } from './media.service';

/** Panorama prêt à afficher dans la visionneuse 360°. */
export interface PanoramaAffichable {
  id: number;
  titre: string;
  url: string;
}

/**
 * Aperçu des médias d'une liste de cartes (programmes ou parcelles) :
 * photo de couverture et panoramas 360°. À fournir au niveau du composant.
 */
@Injectable()
export class ApercuMediasService {
  private readonly mediaService = inject(MediaService);
  private readonly medias = signal<Record<number, MediaFoncier[]>>({});

  /** Charge les médias de chaque cible ; une erreur sur une cible n'empêche pas les autres. */
  charger(cibles: MediaCible[]): void {
    if (cibles.length === 0) return;
    forkJoin(
      cibles.map((c) => this.mediaService.list(c).pipe(catchError(() => of([] as MediaFoncier[])))),
    ).subscribe((listes) => {
      const parId: Record<number, MediaFoncier[]> = {};
      cibles.forEach((c, i) => (parId[c.id] = listes[i]));
      this.medias.update((actuel) => ({ ...actuel, ...parId }));
    });
  }

  /** Recharge une seule cible (après ajout ou suppression d'un média). */
  rafraichir(cible: MediaCible): void {
    this.charger([cible]);
  }

  private trier(id: number, type: MediaFoncier['type']): MediaFoncier[] {
    return (this.medias()[id] ?? [])
      .filter((m) => m.type === type)
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }

  /** Première photo (selon l'ordre), sinon null : la carte affiche alors son icône. */
  couverture(id: number): string | null {
    const photo = this.trier(id, 'PHOTO')[0];
    return photo ? this.mediaService.urlAbsolue(photo) : null;
  }

  panoramas(id: number): PanoramaAffichable[] {
    return this.trier(id, 'PANORAMA_360').map((m, i) => ({
      id: m.id,
      titre: m.titre || `Vue 360° n°${i + 1}`,
      url: this.mediaService.urlAbsolue(m),
    }));
  }

  nombrePhotos(id: number): number {
    return this.trier(id, 'PHOTO').length;
  }
}
