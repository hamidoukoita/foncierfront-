import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { AgentCollaborateur } from '../../../core/models/societe.models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TelephonePipe } from '../../../shared/pipes/telephone.pipe';

/** Carte d'un collaborateur : identité, contact, charge de travail et accès. */
@Component({
  selector: 'app-agent-carte',
  standalone: true,
  imports: [TelephonePipe, RouterLink, MatIcon, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    @let ag = agent();
    <article
      class="flex h-full flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-primary/40"
      [class.opacity-75]="ag.statut === 'SUSPENDU'"
    >
      <!-- Identité -->
      <div class="flex items-start gap-3">
        <div class="relative shrink-0">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-secondary text-sm font-extrabold text-white">
            {{ ag.initiales }}
          </span>
          <span
            class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
            [class]="ag.statut === 'ACTIF' ? 'bg-brand-success' : 'bg-gray-400'"
          ></span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold text-brand-secondary">{{ ag.prenom }} {{ ag.nom }}</p>
          <p class="truncate text-[11px] text-gray-500">{{ ag.estResponsableSociete ? 'Responsable de la société' : ag.fonctionDeleguee || 'Agent collaborateur' }}</p>
          <p class="mt-0.5 font-mono text-[10px] tracking-wider text-gray-400">{{ ag.matricule }}</p>
        </div>
        <app-status-badge [status]="ag.statut" />
      </div>

      <!-- Contact -->
      <a
        [href]="'tel:' + ag.telephone"
        class="flex items-center gap-3 rounded-xl bg-brand-bg px-3.5 py-2.5 transition-colors hover:bg-brand-primary/10"
      >
        <mat-icon class="!h-[18px] !w-[18px] !text-[18px] text-brand-primary">call</mat-icon>
        <span class="min-w-0">
          <span class="block font-mono text-xs font-semibold text-gray-800">{{ (ag.telephone | telephone: true) || '—' }}</span>
          <span class="block text-[10px] text-gray-400">Identifiant de connexion</span>
        </span>
      </a>

      <!-- Charge de travail -->
      <div>
        <div class="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <span>Charge de travail</span>
          <span class="text-brand-secondary">{{ total() }} dossier(s)</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div class="h-full rounded-full bg-brand-primary transition-all" [style.width.%]="charge()"></div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-gray-100 px-3 py-2">
            <p class="text-lg font-extrabold leading-tight text-brand-secondary">{{ ag.rdvVisitesCount }}</p>
            <p class="flex items-center gap-1 text-[11px] text-gray-500">
              <mat-icon class="!h-3.5 !w-3.5 !text-[14px] text-brand-primary">event</mat-icon> Rendez-vous
            </p>
          </div>
          <div class="rounded-xl border border-gray-100 px-3 py-2">
            <p class="text-lg font-extrabold leading-tight text-brand-secondary">{{ ag.reservationsCount }}</p>
            <p class="flex items-center gap-1 text-[11px] text-gray-500">
              <mat-icon class="!h-3.5 !w-3.5 !text-[14px] text-brand-primary">receipt_long</mat-icon> Réservations
            </p>
          </div>
        </div>
      </div>

      <!-- Activité et accès -->
      <div class="mt-auto space-y-2 border-t border-gray-100 pt-4">
        @if (!ag.estResponsableSociete) {
          <a [routerLink]="['/societe/agents', ag.id]" class="bouton bouton-sm bouton-contour w-full">
            <mat-icon>insights</mat-icon>
            Voir l’activité
          </a>
        }
        @if (modifiable()) {
          <button
            type="button"
            (click)="basculer.emit()"
            class="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors"
            [class]="ag.statut === 'ACTIF'
              ? 'border-red-200 text-brand-danger hover:bg-red-50'
              : 'border-brand-success bg-brand-success text-white hover:bg-emerald-700'"
          >
            <mat-icon class="!h-4 !w-4 !text-[16px]">{{ ag.statut === 'ACTIF' ? 'block' : 'lock_open' }}</mat-icon>
            {{ ag.statut === 'ACTIF' ? 'Suspendre l’accès' : 'Réactiver l’accès' }}
          </button>
        } @else {
          <p class="flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold text-gray-400">
            <mat-icon class="!h-4 !w-4 !text-[16px]">verified_user</mat-icon> Compte protégé
          </p>
        }
      </div>
    </article>
  `,
})
export class AgentCarteComponent {
  readonly agent = input.required<AgentCollaborateur>();
  /** Plus forte charge de l'équipe, pour comparer les agents entre eux. */
  readonly chargeMax = input<number>(0);
  /** Faux pour le responsable et pour son propre compte. */
  readonly modifiable = input<boolean>(true);

  readonly basculer = output<void>();

  readonly total = computed(() => this.agent().rdvVisitesCount + this.agent().reservationsCount);
  readonly charge = computed(() => (this.chargeMax() ? (this.total() / this.chargeMax()) * 100 : 0));
}
