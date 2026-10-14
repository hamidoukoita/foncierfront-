import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/**
 * Panneau de détail glissant depuis la droite.
 * - Corps : contenu libre (défilant).
 * - [panneau-actions] : barre d'actions fixée en bas.
 */
@Component({
  selector: 'app-panneau-lateral',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ouvert()) {
      <div class="fixed inset-0 z-[1500] flex justify-end" role="dialog" aria-modal="true" [attr.aria-label]="titre()">
        <div class="absolute inset-0 bg-brand-secondary/40 backdrop-blur-[2px] animate-fadeIn" (click)="fermer.emit()"></div>

        <aside class="panneau relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
          <header class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div class="min-w-0">
              @if (surTitre()) {
                <p class="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand-primary">{{ surTitre() }}</p>
              }
              <h2 class="mt-0.5 truncate text-lg font-bold text-brand-secondary">{{ titre() }}</h2>
            </div>
            <button
              type="button"
              (click)="fermer.emit()"
              class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-brand-bg hover:text-brand-secondary"
              aria-label="Fermer"
            >
              <mat-icon class="!h-5 !w-5 !text-[20px]">close</mat-icon>
            </button>
          </header>

          <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5"><ng-content /></div>

          <footer class="border-t border-gray-100 bg-brand-bg/60 px-6 py-4 empty:hidden"><ng-content select="[panneau-actions]" /></footer>
        </aside>
      </div>
    }
  `,
  styles: `
    .panneau { animation: glisser 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes glisser { from { transform: translateX(100%); } to { transform: translateX(0); } }
  `,
})
export class PanneauLateralComponent {
  readonly ouvert = input<boolean>(false);
  readonly titre = input.required<string>();
  readonly surTitre = input<string>('');
  readonly fermer = output<void>();

  @HostListener('document:keydown.escape')
  surEchap(): void {
    if (this.ouvert()) this.fermer.emit();
  }
}
