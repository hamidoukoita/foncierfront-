import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { DossierAgent } from '../../../core/models/agent-statistiques.models';
import { TypeBienBackend } from '../../../core/models/backend.models';
import { formaterFcfa } from '../../../core/utils/format';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LIBELLES_STATUT, TON_STATUT } from '../../reservations/reservation-statut';

const LIBELLES_TYPE: Record<TypeBienBackend, string> = {
  LOT_PROGRAMME: 'Lot',
  PARCELLE_INDIVIDUELLE: 'Parcelle',
  MAISON_CLE_EN_MAIN: 'Maison clé en main',
  BIEN_FONCIER: 'Bien',
};

/** Réservations suivies par l'agent sur la période. */
@Component({
  selector: 'app-agent-dossiers',
  standalone: true,
  imports: [DatePipe, MatIcon, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (dossiers().length === 0) {
      <p class="flex items-center gap-2 py-6 text-xs text-gray-500">
        <mat-icon class="text-gray-300">folder_off</mat-icon>
        Aucun dossier de réservation sur cette période.
      </p>
    } @else {
      <ul class="divide-y divide-gray-100">
        @for (d of dossiers(); track d.id) {
          <li class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-brand-secondary">
                {{ typeBien(d) }} {{ d.bienDesignation || '—' }}
                @if (d.programmeNom) {
                  <span class="font-medium text-gray-400">· {{ d.programmeNom }}</span>
                }
              </p>
              <p class="truncate text-[11px] text-gray-500">
                {{ d.acquereurNom || 'Acquéreur' }} · Dossier {{ d.numeroDossier }} ·
                {{ d.dateAttribution || d.dateReservation | date: 'dd/MM/yyyy' }}
              </p>
            </div>
            @if (d.statut === 'VENDUE' && d.montant) {
              <p class="text-xs font-bold text-brand-success">{{ fcfa(d.montant) }}</p>
            }
            <app-status-badge [status]="tons[d.statut]" [label]="libelles[d.statut]" />
          </li>
        }
      </ul>
    }
  `,
})
export class AgentDossiersComponent {
  readonly dossiers = input.required<DossierAgent[]>();

  protected readonly tons = TON_STATUT;
  protected readonly libelles = LIBELLES_STATUT;

  typeBien(d: DossierAgent): string {
    return d.typeBien ? LIBELLES_TYPE[d.typeBien] : '';
  }

  fcfa(montant: number): string {
    return formaterFcfa(montant);
  }
}
