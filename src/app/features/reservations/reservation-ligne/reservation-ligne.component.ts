import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Reservation } from '../../../core/models/societe.models';
import { formaterFcfa, initiales } from '../../../core/utils/format';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { DecompteReservation } from '../reservation-delai';
import { DelaiChipComponent } from '../delai-chip/delai-chip.component';
import { LIBELLES_STATUT, TON_STATUT } from '../reservation-statut';

/** Une réservation dans la liste : bien, acquéreur, paiement, agent ou décompte, statut et action. */
@Component({
  selector: 'app-reservation-ligne',
  standalone: true,
  imports: [MatIcon, StatusBadgeComponent, DelaiChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let r = reservation();
    @let d = decompte();
    <article
      (click)="ouvrir.emit()"
      class="group flex cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-primary/40"
      [class]="d?.niveau === 'urgent' ? 'border-red-200' : 'border-gray-100'"
    >
      <span class="w-1 shrink-0" [class]="accent()"></span>

      <div class="grid flex-1 grid-cols-2 items-center gap-x-5 gap-y-3 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_13rem]">
        <!-- Bien -->
        <div class="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-secondary">
            <mat-icon>{{ icone() }}</mat-icon>
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-brand-secondary">{{ r.lotDesignation }}</p>
            <p class="truncate text-[11px] text-gray-500">{{ r.programmeNom }}</p>
            <p class="mt-0.5 truncate font-mono text-[10px] text-gray-400">{{ r.numeroDossier || '#' + r.id }} · {{ r.dateReservation }}</p>
          </div>
        </div>

        <!-- Acquéreur -->
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Acquéreur</p>
          <p class="truncate text-xs font-semibold text-gray-800">{{ r.prospectNom }}</p>
          <p class="truncate font-mono text-[11px] text-gray-500">{{ r.prospectTelephone }}</p>
        </div>

        <!-- Paiement -->
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Réservation</p>
          <p class="truncate text-xs font-extrabold text-brand-secondary">{{ paiement() }}</p>
          @if (r.rembourse) {
            <p class="text-[10px] font-semibold text-brand-success">Remboursée</p>
          }
        </div>

        <!-- Agent et décompte -->
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Agent</p>
          @if (r.agentAssignNom) {
            <span class="mt-0.5 inline-flex max-w-full items-center gap-2">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[9px] font-bold text-white">{{ initialesAgent() }}</span>
              <span class="truncate text-xs font-semibold text-gray-800">{{ r.agentAssignNom }}</span>
            </span>
          } @else {
            <p class="text-xs font-semibold" [class]="r.statut === 'EN_ATTENTE' ? 'text-brand-warning' : 'text-gray-400'">
              {{ r.statut === 'EN_ATTENTE' ? 'À attribuer' : '—' }}
            </p>
          }
          @if (d) {
            <div class="mt-1"><app-delai-chip [delai]="d" /></div>
          }
        </div>

        <!-- Statut et action -->
        <div class="col-span-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 lg:col-span-1 lg:justify-end lg:border-0 lg:pt-0">
          <app-status-badge [status]="ton()" [label]="libelleStatut()" />
          @if (actionPossible()) {
            <button
              type="button"
              (click)="$event.stopPropagation(); action.emit()"
              class="bouton bouton-sm"
              [class]="r.statut === 'EN_COURS' ? 'bouton-succes' : 'bouton-primaire'"
            >
              <mat-icon>{{ r.statut === 'EN_COURS' ? 'sell' : 'person_add' }}</mat-icon>
              {{ r.statut === 'EN_COURS' ? 'Vendu' : 'Attribuer' }}
            </button>
          } @else {
            <mat-icon class="text-gray-300 transition-colors group-hover:text-brand-primary">chevron_right</mat-icon>
          }
        </div>
      </div>
    </article>
  `,
})
export class ReservationLigneComponent {
  readonly reservation = input.required<Reservation>();
  readonly decompte = input<DecompteReservation | null>(null);

  readonly ouvrir = output<void>();
  /** Action principale de l'étape : attribuer un agent, ou conclure la vente. */
  readonly action = output<void>();

  readonly libelleStatut = computed(() => LIBELLES_STATUT[this.reservation().statut]);
  readonly ton = computed(() => TON_STATUT[this.reservation().statut]);

  readonly icone = computed(() => {
    switch (this.reservation().typeBien) {
      case 'MAISON_CLE_EN_MAIN': return 'home_work';
      case 'PARCELLE_INDIVIDUELLE': return 'landscape';
      default: return 'holiday_village';
    }
  });

  readonly paiement = computed(() => {
    const montant = this.reservation().montantReservationFcfa;
    return montant > 0 ? formaterFcfa(montant) : 'Gratuite';
  });

  readonly initialesAgent = computed(() => initiales(this.reservation().agentAssignNom));

  readonly actionPossible = computed(() => {
    const r = this.reservation();
    return (r.statut === 'EN_ATTENTE' && !r.agentAssignId)
      || (r.statut === 'EN_COURS' && this.decompte()?.niveau !== 'depasse');
  });

  /** Liseré de couleur selon l'état du dossier. */
  readonly accent = computed(() => {
    switch (this.reservation().statut) {
      case 'VENDUE': return 'bg-brand-success';
      case 'EXPIREE':
      case 'ANNULEE': return 'bg-gray-300';
      case 'EN_COURS': return this.decompte()?.niveau === 'normal' ? 'bg-brand-primary' : 'bg-brand-danger';
      default: return this.reservation().agentAssignId ? 'bg-brand-secondary' : 'bg-brand-warning';
    }
  });
}
