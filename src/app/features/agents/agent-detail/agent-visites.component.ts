import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { VisiteAgent } from '../../../core/models/agent-statistiques.models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

interface EtatVisite {
  libelle: string;
  ton: string;
}

/** Rendez-vous de visite attribués à l'agent sur la période. */
@Component({
  selector: 'app-agent-visites',
  standalone: true,
  imports: [DatePipe, MatIcon, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (visites().length === 0) {
      <p class="flex items-center gap-2 py-6 text-xs text-gray-500">
        <mat-icon class="text-gray-300">event_busy</mat-icon>
        Aucun rendez-vous sur cette période.
      </p>
    } @else {
      <ul class="divide-y divide-gray-100">
        @for (v of visites(); track v.id) {
          @let etat = etatDe(v);
          <li class="flex items-center gap-4 py-3">
            <div class="w-14 shrink-0 rounded-xl bg-brand-bg py-1.5 text-center">
              <p class="text-sm font-extrabold leading-none text-brand-secondary">{{ v.dateRendezVous | date: 'dd' }}</p>
              <p class="text-[10px] font-bold uppercase text-gray-500">{{ v.dateRendezVous | date: 'MMM' }}</p>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-brand-secondary">
                {{ v.bienDesignation || v.programmeNom || 'Visite' }}
              </p>
              <p class="truncate text-[11px] text-gray-500">
                {{ v.acquereurNom || 'Acquéreur' }} · {{ v.dateRendezVous | date: 'HH:mm' }}
                @if (v.lieu) {
                  · {{ v.lieu }}
                }
              </p>
            </div>
            <app-status-badge [status]="etat.ton" [label]="etat.libelle" />
          </li>
        }
      </ul>
    }
  `,
})
export class AgentVisitesComponent {
  readonly visites = input.required<VisiteAgent[]>();

  /** Une visite acceptée est « prévue » avant sa date, « effectuée » après. */
  etatDe(v: VisiteAgent): EtatVisite {
    if (v.statut === 'REFUSER') return { libelle: 'Refusée', ton: 'ANNULE' };
    if (v.statut === 'EN_ATTENTE') return { libelle: 'À confirmer', ton: 'EN_ATTENTE' };
    return new Date(v.dateRendezVous).getTime() < Date.now()
      ? { libelle: 'Effectuée', ton: 'CONFIRME' }
      : { libelle: 'Prévue', ton: 'RESERVE' };
  }
}
