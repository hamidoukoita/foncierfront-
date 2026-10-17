import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Reservation } from '../../../core/models/societe.models';
import { formaterDuree, formaterFcfa, initiales } from '../../../core/utils/format';
import { InfoLigneComponent } from '../../../shared/components/info-ligne/info-ligne.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { DecompteReservation } from '../reservation-delai';
import { DelaiChipComponent } from '../delai-chip/delai-chip.component';
import { LIBELLES_STATUT, TON_STATUT } from '../reservation-statut';

interface EtapeSuivi {
  libelle: string;
  detail: string;
  etat: 'fait' | 'courant' | 'a_venir' | 'echec';
}

function dateHeure(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Contenu du panneau de détail d'une réservation : bien, paiement, acquéreur, agent et suivi. */
@Component({
  selector: 'app-reservation-detail',
  standalone: true,
  imports: [MatIcon, InfoLigneComponent, StatusBadgeComponent, DelaiChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-5' },
  template: `
    @let r = reservation();
    <!-- Bien et décompte -->
    <section class="rounded-2xl bg-brand-secondary p-5 text-white">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">{{ r.programmeNom }}</p>
          <p class="mt-1 truncate text-base font-bold">{{ r.lotDesignation }}</p>
        </div>
        <app-status-badge [status]="ton()" [label]="libelleStatut()" />
      </div>
      <p class="mt-4 text-[10px] font-bold uppercase tracking-wider text-white/60">Prix de vente du bien</p>
      <p class="text-2xl font-extrabold tracking-tight">{{ prixBien() }}</p>
      @if (decompte(); as d) {
        <div class="mt-4">
          <div class="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/70">
            <span>Réservation de {{ duree(d.totalHeures) }}</span>
            <app-delai-chip [delai]="d" />
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div class="h-full rounded-full" [class]="d.niveau === 'normal' ? 'bg-brand-primary' : 'bg-red-400'" [style.width.%]="d.progression * 100"></div>
          </div>
        </div>
      }
    </section>

    <!-- Paiement -->
    <section>
      <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Paiement de la réservation</h3>
      <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
        @if (r.montantReservationFcfa > 0) {
          <app-info-ligne icone="payments" libelle="Montant payé" [valeur]="montantReservation()" />
          <app-info-ligne icone="smartphone" libelle="Moyen" valeur="Orange Money (simulé)" />
          <app-info-ligne icone="receipt_long" libelle="Référence" [valeur]="r.referencePaiement || '—'" />
          <app-info-ligne icone="schedule" libelle="Payé le" [valeur]="date(r.datePaiementIso) || r.dateReservation" />
          <app-info-ligne
            icone="currency_exchange"
            libelle="Remboursement"
            [valeur]="r.rembourse ? 'Remboursée (bien vendu à un autre acquéreur)' : 'Non remboursable'"
          />
        } @else {
          <app-info-ligne icone="redeem" libelle="Montant" valeur="Réservation gratuite" />
        }
      </div>
    </section>

    <!-- Acquéreur -->
    <section>
      <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Acquéreur</h3>
      <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
        <app-info-ligne icone="person" libelle="Nom" [valeur]="r.prospectNom" />
        <app-info-ligne icone="call" libelle="Téléphone">
          <a [href]="'tel:' + r.prospectTelephone" class="text-brand-primary hover:underline">{{ r.prospectTelephone }}</a>
        </app-info-ligne>
        <app-info-ligne icone="event" libelle="Réservé le" [valeur]="r.dateReservation" />
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
            <p class="text-[11px] text-gray-500">Démarre le décompte et suit le dossier depuis l'application mobile</p>
          </div>
        </div>
      } @else if (r.statut === 'EN_ATTENTE') {
        <div class="flex items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3">
          <mat-icon class="text-brand-warning">person_search</mat-icon>
          <p class="text-xs font-semibold text-gray-600">Aucun agent attribué. Le bien reste bloqué tant que le dossier n'est pas pris en charge.</p>
        </div>
      } @else {
        <p class="text-xs text-gray-500">Aucun agent n'a suivi ce dossier.</p>
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

    @if (r.motifAnnulation && (r.statut === 'ANNULEE' || r.statut === 'EXPIREE')) {
      <section class="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3">
        <p class="text-[10px] font-bold uppercase tracking-wider text-brand-danger">{{ r.statut === 'EXPIREE' ? 'Expiration' : 'Annulation' }}</p>
        <p class="mt-1 text-sm text-gray-700">{{ r.motifAnnulation }}</p>
      </section>
    }
  `,
})
export class ReservationDetailComponent {
  readonly reservation = input.required<Reservation>();
  readonly decompte = input<DecompteReservation | null>(null);

  readonly prixBien = computed(() => formaterFcfa(this.reservation().montantFcfa));
  readonly montantReservation = computed(() => formaterFcfa(this.reservation().montantReservationFcfa));
  readonly initialesAgent = computed(() => initiales(this.reservation().agentAssignNom));
  readonly libelleStatut = computed(() => LIBELLES_STATUT[this.reservation().statut]);
  readonly ton = computed(() => TON_STATUT[this.reservation().statut]);

  readonly etapes = computed<EtapeSuivi[]>(() => {
    const r = this.reservation();
    const demarre = !!r.dateDebutDecompteIso;
    const terminee = r.statut === 'VENDUE' || r.statut === 'EXPIREE' || r.statut === 'ANNULEE';
    const issue: EtapeSuivi =
      r.statut === 'VENDUE'
        ? { libelle: 'Vente conclue', detail: dateHeure(r.dateConclusionIso), etat: 'fait' }
        : r.statut === 'EXPIREE'
          ? { libelle: 'Réservation expirée', detail: 'Délai écoulé sans vente : le bien est de nouveau disponible', etat: 'echec' }
          : r.statut === 'ANNULEE'
            ? { libelle: 'Réservation annulée', detail: r.rembourse ? 'Remboursée : bien vendu à un autre acquéreur' : 'Par l’acquéreur, sans remboursement', etat: 'echec' }
            : { libelle: 'Vente', detail: 'À conclure avant l’échéance', etat: demarre ? 'courant' : 'a_venir' };
    return [
      {
        libelle: r.montantReservationFcfa > 0 ? 'Réservation payée' : 'Réservation enregistrée',
        detail: dateHeure(r.datePaiementIso ?? r.dateReservationIso) || r.dateReservation,
        etat: 'fait',
      },
      {
        libelle: 'Agent attribué',
        detail: r.agentAssignNom ?? (terminee ? 'Aucun' : 'En attente d’attribution'),
        etat: r.agentAssignNom ? 'fait' : terminee ? 'echec' : 'courant',
      },
      {
        libelle: 'Décompte démarré',
        detail: demarre
          ? `${dateHeure(r.dateDebutDecompteIso)} · échéance ${dateHeure(r.dateExpirationIso)}`
          : 'Par l’agent, quand il prend contact avec l’acquéreur',
        etat: demarre ? 'fait' : terminee ? 'echec' : r.agentAssignNom ? 'courant' : 'a_venir',
      },
      issue,
    ];
  });

  duree(heures: number): string {
    return formaterDuree(heures);
  }

  date(iso?: string): string {
    return dateHeure(iso);
  }

  pastille(e: EtapeSuivi): string {
    switch (e.etat) {
      case 'fait': return 'bg-brand-success';
      case 'courant': return 'bg-brand-primary animate-pulse';
      case 'echec': return 'bg-brand-danger';
      default: return 'bg-gray-200';
    }
  }
}
