import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { AuthUser } from '../../../core/models/auth.models';

/** Personne physique qui engage la société : l'agent promoteur responsable connecté. */
@Component({
  selector: 'app-responsable-legal',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white rounded-2xl p-6 border border-gray-100/90 shadow-card">
      <h2 class="text-sm font-bold text-brand-secondary">Responsable légal</h2>
      <p class="text-xs text-gray-500 mt-0.5">Titulaire du compte, signataire auprès des acquéreurs.</p>

      <div class="mt-4 flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-full bg-brand-secondary text-white text-sm font-extrabold flex items-center justify-center shrink-0">
          {{ initiales() }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-bold text-gray-900 truncate">{{ nomComplet() }}</p>
          <p class="text-[11px] font-semibold text-brand-primary">Agent promoteur responsable</p>
        </div>
      </div>

      @if (user()?.telephone) {
        <div class="mt-4 flex items-center gap-2 text-xs text-gray-700">
          <mat-icon class="!text-base !w-5 !h-5 text-gray-400">call</mat-icon>
          <span class="font-mono">+223 {{ user()?.telephone }}</span>
        </div>
      }
    </section>
  `,
})
export class ResponsableLegalComponent {
  readonly user = input<AuthUser | null>(null);

  readonly nomComplet = computed(() => {
    const u = this.user();
    return u ? `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || 'Responsable' : 'Responsable';
  });

  readonly initiales = computed(() => {
    const u = this.user();
    return `${u?.prenom?.[0] ?? ''}${u?.nom?.[0] ?? ''}`.toUpperCase() || 'R';
  });
}
