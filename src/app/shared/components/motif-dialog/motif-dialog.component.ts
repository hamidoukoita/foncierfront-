import { ChangeDetectionStrategy, Component, computed, HostListener, input, linkedSignal, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Dialogue de refus / d'annulation demandant un motif communiqué à l'acquéreur. */
@Component({
  selector: 'app-motif-dialog',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn" role="dialog" aria-modal="true" (click)="annuler()">
        <div class="w-full max-w-md space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-card" (click)="$event.stopPropagation()">
          <div class="flex items-start gap-3.5">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-brand-danger">
              <mat-icon>block</mat-icon>
            </div>
            <div>
              <h3 class="text-sm font-bold text-brand-secondary">{{ titre() }}</h3>
              <p class="mt-1 text-xs leading-relaxed text-gray-500">{{ message() }}</p>
            </div>
          </div>

          <label class="block">
            <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Motif</span>
            <textarea
              rows="3"
              maxlength="500"
              [value]="motif()"
              (input)="motif.set($any($event.target).value)"
              [placeholder]="placeholder()"
              class="mt-1.5 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            ></textarea>
          </label>
          <div class="flex flex-wrap gap-1.5">
            @for (s of suggestions(); track s) {
              <button type="button" (click)="motif.set(s)" class="cursor-pointer rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-brand-primary hover:text-brand-primary">{{ s }}</button>
            }
          </div>

          <div class="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
            <button type="button" (click)="annuler()" class="bouton bouton-discret">Retour</button>
            <button
              type="button"
              [disabled]="!valide() || enCours()"
              (click)="valider.emit(motif().trim())"
              class="bouton bouton-danger-plein"
            >
              {{ enCours() ? 'Envoi…' : libelleConfirmation() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MotifDialogComponent {
  readonly isOpen = input<boolean>(false);
  readonly titre = input.required<string>();
  readonly message = input<string>('Ce motif sera communiqué à l’acquéreur.');
  readonly libelleConfirmation = input<string>('Refuser');
  readonly placeholder = input<string>('Expliquez brièvement la raison…');
  readonly suggestions = input<string[]>([]);
  readonly enCours = input<boolean>(false);

  readonly valider = output<string>();
  readonly annule = output<void>();

  /** Repart d'un champ vide à chaque ouverture. */
  readonly motif = linkedSignal<boolean, string>({ source: this.isOpen, computation: () => '' });
  readonly valide = computed(() => this.motif().trim().length >= 5);

  @HostListener('document:keydown.escape')
  surEchap(): void {
    if (this.isOpen()) this.annuler();
  }

  annuler(): void {
    if (!this.enCours()) this.annule.emit();
  }
}
