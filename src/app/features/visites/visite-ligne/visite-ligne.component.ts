import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { VisiteRendezVous } from '../../../core/models/societe.models';
import { initiales } from '../../../core/utils/format';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LIBELLES_STATUT_VISITE, MODALITES_VISITE } from '../visite-detail/visite-detail.component';

/** Un rendez-vous dans le planning : créneau, acquéreur, bien, agent, statut et action. */
@Component({
  selector: 'app-visite-ligne',
  standalone: true,
  imports: [MatIcon, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let v = visite();
    <article
      (click)="ouvrir.emit()"
      class="group flex cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-primary/40"
      [class.opacity-60]="v.statut === 'ANNULE'"
    >
      <span class="w-1 shrink-0" [class]="accent()"></span>

      <div class="grid flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
        <!-- Créneau -->
        <div class="flex h-14 w-16 flex-col items-center justify-center rounded-xl bg-brand-secondary text-white">
          <span class="text-sm font-extrabold leading-none">{{ v.heureDebut }}</span>
          @if (v.heureFin) {
            <span class="mt-1 text-[10px] text-white/60">{{ v.heureFin }}</span>
          }
        </div>

        <!-- Acquéreur et modalité -->
        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-brand-secondary">{{ v.prospectNom }}</p>
          <p class="truncate font-mono text-[11px] text-gray-500">{{ v.prospectTelephone }}</p>
          <span
            class="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            [class]="v.typeVisite === 'CHANTIER' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-brand-secondary'"
          >
            <mat-icon class="!h-3 !w-3 !text-[12px]">{{ modalite().icone }}</mat-icon>
            {{ modalite().libelle }}
          </span>
        </div>

        <!-- Bien -->
        <div class="col-span-2 min-w-0 lg:col-span-1">
          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bien visité</p>
          <p class="truncate text-xs font-semibold text-gray-800">{{ v.bienCible }}</p>
          <p class="truncate text-[11px] text-gray-500">{{ v.programmeNom }}</p>
        </div>

        <!-- Agent -->
        <div class="col-span-2 min-w-0 lg:col-span-1">
          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Agent</p>
          @if (v.agentAssignNom) {
            <span class="mt-0.5 inline-flex max-w-full items-center gap-2">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[9px] font-bold text-white">{{ initialesAgent() }}</span>
              <span class="truncate text-xs font-semibold text-gray-800">{{ v.agentAssignNom }}</span>
            </span>
          } @else {
            <p class="text-xs font-semibold text-brand-warning">À attribuer</p>
          }
        </div>

        <!-- Statut et action -->
        <div class="col-span-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 lg:col-span-1 lg:justify-end lg:border-0 lg:pt-0">
          <app-status-badge [status]="v.statut" [label]="libelleStatut()" />
          @if (v.statut === 'EN_ATTENTE') {
            <button
              type="button"
              (click)="$event.stopPropagation(); action.emit()"
              class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-brand-primary px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-brand-primary-hover"
            >
              <mat-icon class="!h-3.5 !w-3.5 !text-[14px]">{{ v.agentAssignId ? 'event_available' : 'person_add' }}</mat-icon>
              {{ v.agentAssignId ? 'Confirmer' : 'Attribuer' }}
            </button>
          } @else {
            <mat-icon class="text-gray-300 transition-colors group-hover:text-brand-primary">chevron_right</mat-icon>
          }
        </div>
      </div>
    </article>
  `,
})
export class VisiteLigneComponent {
  readonly visite = input.required<VisiteRendezVous>();

  readonly ouvrir = output<void>();
  /** Action principale : attribuer (ce qui confirme) ou confirmer. */
  readonly action = output<void>();

  readonly modalite = computed(() => MODALITES_VISITE[this.visite().typeVisite]);
  readonly libelleStatut = computed(() => LIBELLES_STATUT_VISITE[this.visite().statut]);
  readonly initialesAgent = computed(() => initiales(this.visite().agentAssignNom));

  readonly accent = computed(() => {
    switch (this.visite().statut) {
      case 'CONFIRME': return 'bg-brand-success';
      case 'EFFECTUE': return 'bg-brand-secondary';
      case 'ANNULE': return 'bg-gray-300';
      default: return 'bg-brand-primary';
    }
  });
}
