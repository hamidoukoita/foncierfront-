import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { ProfilSociete } from '../../../core/models/societe.models';

interface PresentationStatut {
  icone: string;
  titre: string;
  message: string;
  libelle: string;
  ton: 'succes' | 'attente' | 'rejet';
}

/** Bandeau du statut d'agrément réel de la société (et non un statut figé). */
@Component({
  selector: 'app-statut-agrement-banner',
  standalone: true,
  imports: [RouterLink, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = statut();
    <div
      class="bg-white rounded-2xl p-5 border border-gray-100 border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card"
      [class.border-l-brand-success]="s.ton === 'succes'"
      [class.border-l-brand-warning]="s.ton === 'attente'"
      [class.border-l-brand-danger]="s.ton === 'rejet'"
    >
      <div class="flex items-center gap-3.5">
        <div
          class="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          [class]="s.ton === 'succes' ? 'bg-emerald-50 text-brand-success' : s.ton === 'attente' ? 'bg-amber-50 text-brand-warning' : 'bg-red-50 text-brand-danger'"
        >
          <mat-icon>{{ s.icone }}</mat-icon>
        </div>
        <div>
          <h3 class="text-sm font-bold text-brand-secondary">{{ s.titre }}</h3>
          <p class="text-xs text-gray-500 mt-0.5">{{ s.message }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <span
          class="inline-flex items-center px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
          [class]="s.ton === 'succes' ? 'text-brand-success bg-emerald-100' : s.ton === 'attente' ? 'text-brand-warning bg-amber-100' : 'text-brand-danger bg-red-100'"
        >
          {{ s.libelle }}
        </span>
        @if (s.ton !== 'succes') {
          <a
            routerLink="/societe/kyc-attente"
            class="px-3.5 py-1.5 rounded-full text-[11px] font-bold text-white bg-brand-primary hover:bg-brand-primary-hover transition-colors"
          >
            Voir mon dossier
          </a>
        }
      </div>
    </div>
  `,
})
export class StatutAgrementBannerComponent {
  readonly agrementStatut = input.required<ProfilSociete['agrementStatut']>();

  readonly statut = computed<PresentationStatut>(() => {
    switch (this.agrementStatut()) {
      case 'VALIDE_MINISTERE':
        return {
          icone: 'verified',
          titre: 'Promoteur agréé & vérifié',
          message: 'Votre agrément ministériel est validé : vous pouvez publier vos programmes et parcelles.',
          libelle: 'Agrément validé',
          ton: 'succes',
        };
      case 'REJETE':
        return {
          icone: 'gpp_bad',
          titre: 'Dossier d’agrément rejeté',
          message: 'Corrigez votre dossier KYC selon le motif indiqué par l’administration, puis soumettez-le à nouveau.',
          libelle: 'Rejeté',
          ton: 'rejet',
        };
      default:
        return {
          icone: 'hourglass_top',
          titre: 'Dossier en cours d’instruction',
          message: 'L’administration Foncier+ vérifie votre agrément. La publication sera possible après validation.',
          libelle: 'En attente',
          ton: 'attente',
        };
    }
  });
}
