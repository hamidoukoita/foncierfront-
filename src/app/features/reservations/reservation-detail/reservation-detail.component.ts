import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Reservation } from '../../../core/models/societe.models';
import { formaterFcfa, initiales } from '../../../core/utils/format';
import { InfoLigneComponent } from '../../../shared/components/info-ligne/info-ligne.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { DelaiAttribution } from '../reservation-delai';
import { DelaiChipComponent } from '../delai-chip/delai-chip.component';

interface EtapeSuivi {
  libelle: string;
  detail: string;
  etat: 'fait' | 'courant' | 'a_venir' | 'echec';
}

/** Contenu du panneau de détail d'une réservation : bien, acquéreur, suivi du dossier. */
@Component({
  selector: 'app-reservation-detail',
  standalone: true,
  imports: [MatIcon, InfoLigneComponent, StatusBadgeComponent, DelaiChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-5' },
  template: `
    @let r = reservation();
    <!-- Bien et montant -->
    <section class="rounded-2xl bg-brand-secondary p-5 text-white">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">{{ r.programmeNom }}</p>
          <p class="mt-1 truncate text-base font-bold">{{ r.lotDesignation }}</p>
        </div>
        <app-status-badge [status]="r.statut" [label]="libelleStatut()" />
      </div>
      <p class="mt-4 text-[10px] font-bold uppercase tracking-wider text-white/60">Valeur du bien</p>
      <p class="text-2xl font-extrabold tracking-tight">{{ montant() }}</p>
      @if (delai(); as d) {
        <div class="mt-4">
          <div class="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/70">
            <span>Délai d'attribution ({{ d.totalHeures }} h)</span>
            <app-delai-chip [delai]="d" />
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div class="h-full rounded-full" [class]="d.niveau === 'normal' ? 'bg-brand-primary' : 'bg-red-400'" [style.width.%]="d.progression * 100"></div>
          </div>
        </div>
      }
    </section>

    <!-- Acquéreur -->
    <section>
      <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Acquéreur</h3>
      <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
        <app-info-ligne icone="person" libelle="Nom" [valeur]="r.prospectNom" />
        <app-info-ligne icone="call" libelle="Téléphone">
          <a [href]="'tel:' + r.prospectTelephone" class="text-brand-primary hover:underline">{{ r.prospectTelephone }}</a>
        </app-info-ligne>
        <app-info-ligne icone="event" libelle="Demande reçue le" [valeur]="r.dateReservation" />
      </div>
    </section>

    <!-- Agent -->
    <section>
      <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Agent en charge</h3>
      @if (r.agentAssignNom) {
        <div class="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">{{ initialesAgent() }}</span>
          <div>
            <p class="text-sm font-bold text-brand-secondary">{{ r.agentAssignNom }}</p>
            <p class="text-[11px] text-gray-500">Suit le dossier depuis l'application mobile</p>
          </div>
        </div>
      } @else {
        <div class="flex items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3">
          <mat-icon class="text-brand-warning">person_search</mat-icon>
          <p class="text-xs font-semibold text-gray-600">Aucun agent attribué. La confirmation nécessite un agent en charge.</p>
        </div>
      }
    </section>

    <!-- Suivi -->
    <section>
      <h3 class="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Suivi du dossier</h3>
      <ol class="relative space-y-4 border-l-2 border-gray-100 pl-5">
        @for (e of etapes(); track e.libelle) {
          <li class="relative">
            <span class="absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white" [class]="pastille(e)"></span>
            <p class="text-xs font-bold" [class]="e.etat === 'a_venir' ? 'text-gray-400' : 'text-brand-secondary'">{{ e.libelle }}</p>
            <p class="text-[11px] text-gray-500">{{ e.detail }}</p>
          </li>
        }
      </ol>
    </section>

    @if (r.motifRefus) {
      <section class="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3">
        <p class="text-[10px] font-bold uppercase tracking-wider text-brand-danger">Motif d'annulation</p>
        <p class="mt-1 text-sm text-gray-700">{{ r.motifRefus }}</p>
      </section>
    }
  `,
})
export class ReservationDetailComponent {
  readonly reservation = input.required<Reservation>();
  readonly delai = input<DelaiAttribution | null>(null);

  readonly montant = computed(() => formaterFcfa(this.reservation().montantFcfa));
  readonly initialesAgent = computed(() => initiales(this.reservation().agentAssignNom));
  readonly libelleStatut = computed(() => LIBELLES_STATUT[this.reservation().statut]);

  readonly etapes = computed<EtapeSuivi[]>(() => {
    const r = this.reservation();
    const annulee = r.statut === 'ANNULEE';
    const confirmee = r.statut === 'CONFIRMEE';
    return [
      { libelle: 'Demande reçue', detail: r.dateReservation, etat: 'fait' },
      {
        libelle: 'Agent attribué',
        detail: r.agentAssignNom ?? 'En attente d’attribution',
        etat: r.agentAssignNom ? 'fait' : annulee ? 'echec' : 'courant',
      },
      {
        libelle: annulee ? 'Demande annulée' : 'Réservation confirmée',
        detail: annulee ? 'Le bien est de nouveau proposé' : confirmee ? 'Le bien est réservé à l’acquéreur' : 'Après vérification par l’agent',
        etat: annulee ? 'echec' : confirmee ? 'fait' : r.agentAssignNom ? 'courant' : 'a_venir',
      },
    ];
  });

  pastille(e: EtapeSuivi): string {
    switch (e.etat) {
      case 'fait': return 'bg-brand-success';
      case 'courant': return 'bg-brand-primary animate-pulse';
      case 'echec': return 'bg-brand-danger';
      default: return 'bg-gray-200';
    }
  }
}

export const LIBELLES_STATUT: Record<Reservation['statut'], string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  ANNULEE: 'Annulée',
};
