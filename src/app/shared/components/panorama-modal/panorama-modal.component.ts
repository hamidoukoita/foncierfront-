import { ChangeDetectionStrategy, Component, HostListener, computed, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PanoramaAffichable } from '../../../core/services/apercu-medias.service';
import { PanoramaViewerComponent } from '../panorama-viewer/panorama-viewer.component';

/** Visualisation 360° plein écran, avec choix de la vue quand il y en a plusieurs. */
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
            <div class="absolute inset-0 p-2"><app-panorama-viewer [src]="p.url" [titre]="p.titre" /></div>
          }
        </div>
        @if (panoramas().length > 1) {
          <nav class="flex gap-2 overflow-x-auto px-5 py-3">
            @for (p of panoramas(); track p.id; let i = $index) {
              <button
                type="button"
                (click)="index.set(i)"
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
  readonly closed = output<void>();

  readonly index = signal(0);
  readonly vueCourante = computed(() => {
    const p = this.panoramas()[this.index()];
    return p ? [p] : [];
  });

  @HostListener('document:keydown.escape')
  fermer(): void {
    this.closed.emit();
  }
}
