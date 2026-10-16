import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { messageErreurApi } from '../../../core/utils/api-error';
import { urlFichier } from '../../../core/utils/url-fichier';

const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];

/** Logo de la société : aperçu et envoi immédiat (affiché sur ses publications côté acquéreurs). */
@Component({
  selector: 'app-logo-societe',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div
        class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white"
        [class.border-dashed]="!apercu()"
        [class.border-gray-300]="!apercu()"
        [class.border-gray-100]="!!apercu()"
      >
        @if (apercu(); as src) {
          <img [src]="src" alt="Logo de la société" class="h-full w-full object-contain p-2" />
        } @else {
          <span class="text-2xl font-extrabold text-brand-secondary/40">{{ initiales() }}</span>
        }
      </div>

      <div class="min-w-0 flex-1 text-center sm:text-left">
        <p class="text-sm font-bold text-brand-secondary">{{ apercu() ? 'Logo de la société' : 'Aucun logo pour le moment' }}</p>
        <p class="mt-0.5 text-[11px] text-gray-500">JPEG, PNG ou WebP · 2 Mo maximum · format carré conseillé.</p>
        <label class="bouton bouton-contour mt-3" [class.pointer-events-none]="envoi()" [class.opacity-60]="envoi()">
          <mat-icon>{{ envoi() ? 'hourglass_top' : 'upload' }}</mat-icon>
          {{ envoi() ? 'Envoi…' : apercu() ? 'Changer le logo' : 'Choisir une image' }}
          <input type="file" class="sr-only" [accept]="typesAcceptes" (change)="choisir($event)" [disabled]="envoi()" />
        </label>
      </div>
    </div>
  `,
})
export class LogoSocieteComponent {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly logoUrl = input<string | null | undefined>(null);
  readonly nomSociete = input('');
  readonly envoye = output<void>();

  readonly envoi = signal(false);
  readonly typesAcceptes = TYPES_ACCEPTES.join(',');

  readonly apercu = computed(() => urlFichier(this.logoUrl()) || null);
  readonly initiales = computed(
    () =>
      this.nomSociete()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((mot) => mot[0]?.toUpperCase())
        .join('') || '?',
  );

  choisir(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      this.toast.error('Logo', 'Format non supporté : choisissez une image JPEG, PNG ou WebP.');
      return;
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      this.toast.error('Logo', 'L’image dépasse 2 Mo.');
      return;
    }
    this.envoi.set(true);
    this.societeService.updateLogo(fichier).subscribe({
      next: () => {
        this.envoi.set(false);
        this.toast.success('Logo enregistré', 'Il apparaît désormais sur vos publications.');
        this.envoye.emit();
      },
      error: (err) => {
        this.envoi.set(false);
        this.toast.error('Logo', messageErreurApi(err, 'Envoi impossible.'));
      },
    });
  }
}
