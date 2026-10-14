import { ChangeDetectionStrategy, Component, HostListener, input, linkedSignal, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { AgentCollaborateur } from '../../../core/models/societe.models';

/** Choix d'un agent actif pour prendre en charge un dossier (réservation, visite…). */
@Component({
  selector: 'app-attribution-agent-dialog',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn" role="dialog" aria-modal="true" (click)="annuler()">
        <div class="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card" (click)="$event.stopPropagation()">
          <div class="flex items-start gap-3.5 border-b border-gray-100 px-6 py-5">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-primary">
              <mat-icon>assignment_ind</mat-icon>
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-bold text-brand-secondary">{{ titre() }}</h3>
              @if (contexte()) {
                <p class="mt-1 text-xs leading-relaxed text-gray-500">{{ contexte() }}</p>
              }
            </div>
          </div>

          <div class="flex-1 space-y-2 overflow-y-auto px-6 py-4">
            @for (agent of agents(); track agent.id) {
              @let choisi = agent.id === selection();
              <button
                type="button"
                (click)="selection.set(agent.id)"
                class="flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all"
                [class]="choisi ? 'border-brand-primary bg-orange-50/60 ring-2 ring-brand-primary/15' : 'border-gray-200 hover:border-gray-300 hover:bg-brand-bg/60'"
              >
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white">{{ agent.initiales }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold text-brand-secondary">
                    {{ agent.prenom }} {{ agent.nom }}
                    @if (agent.id === agentActuelId()) {
                      <span class="ml-1 rounded-full bg-gray-100 px-2 py-px text-[10px] font-bold text-gray-500">actuel</span>
                    }
                  </span>
                  <span class="block truncate text-[11px] text-gray-500">{{ agent.fonctionDeleguee || 'Agent commercial' }} · {{ agent.telephone }}</span>
                </span>
                <span class="shrink-0 text-right text-[10px] font-semibold leading-tight text-gray-500">
                  {{ agent.reservationsCount }} rés.<br />{{ agent.rdvVisitesCount }} RDV
                </span>
                <mat-icon class="shrink-0" [class]="choisi ? 'text-brand-primary' : 'text-gray-300'">{{ choisi ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
              </button>
            } @empty {
              <div class="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
                <mat-icon class="text-gray-300">person_off</mat-icon>
                <p class="mt-1 text-xs font-semibold text-gray-500">Aucun agent actif dans votre société.</p>
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-2.5 border-t border-gray-100 px-6 py-4">
            <button type="button" (click)="annuler()" class="cursor-pointer rounded-xl px-4 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100">Annuler</button>
            <button
              type="button"
              [disabled]="selection() === null || enCours()"
              (click)="valider.emit(selection()!)"
              class="cursor-pointer rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ enCours() ? 'Attribution…' : libelleConfirmation() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AttributionAgentDialogComponent {
  readonly isOpen = input<boolean>(false);
  readonly titre = input<string>('Attribuer à un agent');
  readonly contexte = input<string>('');
  /** Agents sélectionnables (actifs uniquement). */
  readonly agents = input.required<AgentCollaborateur[]>();
  readonly agentActuelId = input<number | null>(null);
  readonly libelleConfirmation = input<string>('Attribuer');
  readonly enCours = input<boolean>(false);

  readonly valider = output<number>();
  readonly annule = output<void>();

  /** Présélectionne l'agent actuel s'il est toujours actif, sinon le premier. */
  readonly selection = linkedSignal<number | null>(() => {
    if (!this.isOpen()) return null;
    const actuel = this.agentActuelId();
    const agents = this.agents();
    return agents.some((a) => a.id === actuel) ? actuel : (agents[0]?.id ?? null);
  });

  @HostListener('document:keydown.escape')
  surEchap(): void {
    if (this.isOpen()) this.annuler();
  }

  annuler(): void {
    if (!this.enCours()) this.annule.emit();
  }
}
