import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { VisiteRendezVous } from '../../../core/models/societe.models';
import { initiales } from '../../../core/utils/format';
import { InfoLigneComponent } from '../../../shared/components/info-ligne/info-ligne.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { dateVisite } from '../visite-agenda';

export const LIBELLES_STATUT_VISITE: Record<VisiteRendezVous['statut'], string> = {
  EN_ATTENTE: 'À confirmer',
  CONFIRME: 'Confirmé',
  EFFECTUE: 'Effectué',
  ANNULE: 'Annulé',
};

export const MODALITES_VISITE: Record<VisiteRendezVous['typeVisite'], { libelle: string; icone: string }> = {
  SIEGE: { libelle: 'Au siège', icone: 'apartment' },
  CHANTIER: { libelle: 'Sur chantier', icone: 'construction' },
};

/** Contenu du panneau de détail d'un rendez-vous. */
@Component({
  selector: 'app-visite-detail',
  standalone: true,
  imports: [MatIcon, InfoLigneComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-5' },
  template: `
    @let v = visite();
    <!-- Créneau -->
    <section class="flex items-center gap-4 rounded-2xl bg-brand-secondary p-5 text-white">
      <div class="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/10 leading-tight">
        <span class="text-[10px] font-extrabold uppercase tracking-wider text-brand-primary">{{ v.jourSemaine }}</span>
        <span class="text-2xl font-extrabold">{{ v.jourMois }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">{{ dateLongue() }}</p>
        <p class="mt-0.5 text-xl font-extrabold">{{ v.heureDebut }}@if (v.heureFin) { – {{ v.heureFin }} }</p>
        <p class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-white/80">
          <mat-icon class="!h-4 !w-4 !text-[16px]">{{ modalite().icone }}</mat-icon>{{ modalite().libelle }}
        </p>
      </div>
      <app-status-badge [status]="v.statut" [label]="libelleStatut()" />
    </section>

    <section>
      <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Visiteur</h3>
      <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
        <app-info-ligne icone="person" libelle="Acquéreur" [valeur]="v.prospectNom" />
        <app-info-ligne icone="call" libelle="Téléphone">
          <a [href]="'tel:' + v.prospectTelephone" class="text-brand-primary hover:underline">{{ v.prospectTelephone }}</a>
        </app-info-ligne>
      </div>
    </section>

    <section>
      <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Objet de la visite</h3>
      <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
        <app-info-ligne icone="holiday_village" libelle="Programme" [valeur]="v.programmeNom" />
        <app-info-ligne icone="crop_square" libelle="Bien" [valeur]="v.bienCible" />
        @if (v.lieu) {
          <app-info-ligne icone="place" libelle="Lieu de rendez-vous" [valeur]="v.lieu" />
        }
      </div>
    </section>

    <section>
      <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Agent accompagnateur</h3>
      @if (v.agentAssignNom) {
        <div class="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">{{ initialesAgent() }}</span>
          <p class="text-sm font-bold text-brand-secondary">{{ v.agentAssignNom }}</p>
        </div>
      } @else {
        <div class="flex items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3">
          <mat-icon class="text-brand-warning">person_search</mat-icon>
          <p class="text-xs font-semibold text-gray-600">Aucun agent. L’attribution confirme le rendez-vous auprès de l’acquéreur.</p>
        </div>
      }
    </section>

    @if (v.compteRendu) {
      <section class="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <p class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-success">
          <mat-icon class="!h-3.5 !w-3.5 !text-[14px]">description</mat-icon> Compte-rendu de l’agent
        </p>
        <p class="mt-1 whitespace-pre-line text-sm text-gray-700">{{ v.compteRendu }}</p>
      </section>
    } @else if (v.statut === 'EFFECTUE') {
      <p class="rounded-2xl bg-brand-bg px-4 py-3 text-xs text-gray-500">Compte-rendu non encore saisi par l’agent.</p>
    }

    @if (v.motifRefus) {
      <section class="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3">
        <p class="text-[10px] font-bold uppercase tracking-wider text-brand-danger">Motif d’annulation</p>
        <p class="mt-1 text-sm text-gray-700">{{ v.motifRefus }}</p>
      </section>
    }
  `,
})
export class VisiteDetailComponent {
  readonly visite = input.required<VisiteRendezVous>();

  readonly modalite = computed(() => MODALITES_VISITE[this.visite().typeVisite] ?? MODALITES_VISITE.SIEGE);
  readonly libelleStatut = computed(() => LIBELLES_STATUT_VISITE[this.visite().statut]);
  readonly initialesAgent = computed(() => initiales(this.visite().agentAssignNom));
  readonly dateLongue = computed(
    () => dateVisite(this.visite())?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) ?? '',
  );
}
