import { ChangeDetectionStrategy, Component, HostListener, computed, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PanoramaAffichable } from '../../../core/services/apercu-medias.service';
import { PanoramaViewerComponent } from '../panorama-viewer/panorama-viewer.component';
import { Direction } from '../panorama-viewer/panorama-geometrie';
import { pointsDuPanorama, vueArrivee } from '../panorama-viewer/visite-virtuelle';
import { LienPanorama } from '../../../core/models/media.models';

/**
 * Visualisation 360° plein écran, avec choix de la vue quand il y en a plusieurs.
 * Avec des points de passage (visite virtuelle d'une maison), on passe d'une pièce à l'autre depuis l'image.
 */
@Component({
  selector: 'app-panorama-modal',
  standalone: true,
  imports: [MatIcon, PanoramaViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" (click)="closed.emit()">
      <section
        role="dialog"
        aria-modal="true"
        class="flex h-full max-h-[760px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-brand-secondary shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between gap-4 px-5 py-4 text-white">
          <div class="min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F29A43]">Visualisation 360°</p>
            <h2 class="truncate text-base font-bold">{{ titre() }}</h2>
          </div>
          <button type="button" (click)="closed.emit()" aria-label="Fermer" class="rounded-full bg-white/10 p-2 hover:bg-white/20">
            <mat-icon>close</mat-icon>
          </button>
        </header>
        <div class="relative flex-1 bg-black">
          <!-- Clé = id : la visionneuse est recréée à chaque changement de vue. -->
          @for (p of vueCourante(); track p.id) {
            <div class="absolute inset-0 p-2">
              <app-panorama-viewer
                [src]="p.url"
                [titre]="p.titre"
                [points]="points()"
                [vueInitiale]="arrivee()"
                (pointChoisi)="suivre($event)"
              />
            </div>
          }
        </div>
        @if (panoramas().length > 1) {
          <nav class="flex gap-2 overflow-x-auto px-5 py-3">
            @for (p of panoramas(); track p.id; let i = $index) {
              <button
                type="button"
                (click)="aller(i)"
                class="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors"
                [class]="i === index() ? 'bg-brand-primary text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'"
              >
                {{ p.titre }}
              </button>
            }
          </nav>
        }
      </section>
    </div>
  `,
})
export class PanoramaModalComponent {
  readonly titre = input.required<string>();
  readonly panoramas = input.required<PanoramaAffichable[]>();
  /** Points de passage de la visite virtuelle (maisons clés en main). */
  readonly liens = input<LienPanorama[]>([]);
  readonly closed = output<void>();

  readonly index = signal(0);
  readonly arrivee = signal<Direction | null>(null);
  readonly vueCourante = computed(() => {
    const p = this.panoramas()[this.index()];
    return p ? [p] : [];
  });
  readonly points = computed(() => {
    const courant = this.panoramas()[this.index()];
    return courant ? pointsDuPanorama(this.liens(), courant.id) : [];
  });

  aller(index: number): void {
    this.arrivee.set(null);
    this.index.set(index);
  }

  /** Passe dans la pièce visée par le point, dos à la porte d'entrée. */
  suivre(lienId: number): void {
    const lien = this.liens().find((l) => l.id === lienId);
    const cible = lien ? this.panoramas().findIndex((p) => p.id === lien.cibleId) : -1;
    if (!lien || cible < 0) return;
    this.arrivee.set(vueArrivee(this.liens(), lien.sourceId, lien.cibleId));
    this.index.set(cible);
  }

  @HostListener('document:keydown.escape')
  fermer(): void {
    this.closed.emit();
  }
}
