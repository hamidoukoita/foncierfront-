import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PanoramaAffichable } from '../../../core/services/apercu-medias.service';
import { PanoramaViewerComponent, PointPanorama } from '../panorama-viewer/panorama-viewer.component';
import { Direction } from '../panorama-viewer/panorama-geometrie';
import { indexDepart, pointsDuPanorama, prechargerPanoramas, vueArrivee } from '../panorama-viewer/visite-virtuelle';
import { LienPanorama } from '../../../core/models/media.models';

/**
 * Visualisation 360° plein écran.
 * Sans points de passage : choix libre de la vue. Avec des points (visite virtuelle d'une maison) :
 * la visite part de la pièce de départ et l'on change de pièce uniquement par les portes,
 * avec un fondu ; le bouton « Pièces » tourne la vue vers les portes de la pièce.
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
            <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F29A43]">
              {{ enVisite() ? 'Visite virtuelle' : 'Visualisation 360°' }}
            </p>
            <h2 class="truncate text-base font-bold">
              {{ titre() }}
              @if (enVisite() && courant(); as p) {
                <span class="font-semibold text-white/70"> · {{ p.titre }}</span>
              }
            </h2>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            @if (enVisite()) {
              <div class="relative">
                <button
                  type="button"
                  (click)="menuPieces.set(!menuPieces())"
                  [attr.aria-expanded]="menuPieces()"
                  class="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-bold hover:bg-white/20"
                >
                  <mat-icon class="!h-4 !w-4 !text-[16px]">door_front</mat-icon> Pièces
                </button>
                @if (menuPieces()) {
                  <div class="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl bg-white p-2 text-brand-secondary shadow-2xl">
                    <p class="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Vous êtes dans : {{ courant()?.titre }}
                    </p>
                    @for (porte of points(); track porte.id) {
                      <button
                        type="button"
                        (click)="regarderPorte(porte)"
                        class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-brand-primary/10"
                      >
                        <mat-icon class="!h-4 !w-4 !text-[16px] text-brand-primary">near_me</mat-icon>
                        Porte vers {{ porte.libelle }}
                      </button>
                    } @empty {
                      <p class="px-2 py-2 text-xs text-gray-500">Aucune porte dans cette pièce.</p>
                    }
                  </div>
                }
              </div>
            }
            <button type="button" (click)="closed.emit()" aria-label="Fermer" class="rounded-full bg-white/10 p-2 hover:bg-white/20">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </header>
        <div class="relative flex-1 bg-black">
          @if (courant(); as p) {
            <div class="absolute inset-0 p-2">
              <!-- Une seule visionneuse : le changement de pièce se fait en fondu. -->
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
        @if (!enVisite() && panoramas().length > 1) {
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
export class PanoramaModalComponent implements OnInit {
  readonly titre = input.required<string>();
  readonly panoramas = input.required<PanoramaAffichable[]>();
  /** Points de passage de la visite virtuelle (maisons clés en main). */
  readonly liens = input<LienPanorama[]>([]);
  /** Pièce par laquelle commence la visite (null : la première). */
  readonly departId = input<number | null>(null);
  readonly closed = output<void>();

  private readonly viewer = viewChild(PanoramaViewerComponent);

  readonly index = signal(0);
  readonly arrivee = signal<Direction | null>(null);
  readonly menuPieces = signal(false);
  readonly enVisite = computed(() => this.liens().length > 0);
  readonly courant = computed(() => this.panoramas()[this.index()] ?? null);
  readonly points = computed(() => {
    const courant = this.courant();
    return courant ? pointsDuPanorama(this.liens(), courant.id, this.panoramas()) : [];
  });

  constructor() {
    // Les pièces accessibles depuis celle-ci sont chargées d'avance.
    effect(() => {
      const courant = this.courant();
      const cibles = new Set(this.liens().filter((l) => l.sourceId === courant?.id).map((l) => l.cibleId));
      prechargerPanoramas(this.panoramas().filter((p) => cibles.has(p.id)).map((p) => p.url));
    });
  }

  ngOnInit(): void {
    if (this.enVisite()) this.index.set(indexDepart(this.panoramas(), this.departId()));
  }

  aller(index: number): void {
    this.arrivee.set(null);
    this.index.set(index);
  }

  /** Passe dans la pièce visée par le point, orienté selon la vue d'arrivée. */
  suivre(lienId: number): void {
    const lien = this.liens().find((l) => l.id === lienId);
    const cible = lien ? this.panoramas().findIndex((p) => p.id === lien.cibleId) : -1;
    if (!lien || cible < 0) return;
    this.menuPieces.set(false);
    this.arrivee.set(vueArrivee(this.liens(), lien));
    this.index.set(cible);
  }

  regarderPorte(porte: PointPanorama): void {
    this.menuPieces.set(false);
    this.viewer()?.orienterVers({ azimut: porte.azimut, elevation: porte.elevation });
  }

  @HostListener('document:keydown.escape')
  fermer(): void {
    if (this.menuPieces()) this.menuPieces.set(false);
    else this.closed.emit();
  }
}
