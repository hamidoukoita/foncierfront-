import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import {
  LIBELLES_STATUT_PROPOSITION,
  PropositionProjet,
} from '../../../core/models/projet-echange.models';
import { FichierProjet } from '../../../core/models/societe.models';
import { formaterFcfa } from '../../../core/utils/format';
import { DescriptionMaisonComponent } from '../description-maison/description-maison.component';

const TONS: Record<PropositionProjet['statut'], string> = {
  EN_ATTENTE: 'bg-amber-50 text-brand-warning',
  ACCEPTEE: 'bg-emerald-50 text-brand-success',
  REFUSEE: 'bg-rose-50 text-brand-danger',
  CADUQUE: 'bg-gray-100 text-gray-500',
};

/** Proposition de la société telle que l'acquéreur la reçoit, avec sa réponse. */
@Component({
  selector: 'app-carte-proposition',
  standalone: true,
  imports: [DatePipe, MatIcon, DescriptionMaisonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = proposition();
    <article
      class="overflow-hidden rounded-2xl border bg-white shadow-card"
      [class]="p.statut === 'ACCEPTEE' ? 'border-brand-success/50' : 'border-gray-100'"
    >
      <header class="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-primary">
            Proposition n°{{ p.numero }}
          </p>
          <h4 class="truncate text-sm font-bold text-brand-secondary">{{ p.titre }}</h4>
        </div>
        <span class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" [class]="ton()">
          {{ libelleStatut() }}
        </span>
      </header>

      <div class="space-y-3 px-4 py-3">
        @if (p.modelMaisonLibeller) {
          <p class="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <mat-icon class="!h-4 !w-4 !text-[16px] text-brand-primary">home</mat-icon>
            Modèle du catalogue : {{ p.modelMaisonLibeller }}
          </p>
        }
        @if (p.maison) {
          <app-description-maison [description]="p.maison" />
        }
        @if (p.prixEstime || p.delaiMois) {
          <div class="grid grid-cols-2 gap-2">
            @if (p.prixEstime) {
              <div class="rounded-xl bg-brand-bg px-3 py-2">
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Prix estimé</p>
                <p class="text-sm font-extrabold text-brand-secondary">{{ prix() }}</p>
              </div>
            }
            @if (p.delaiMois) {
              <div class="rounded-xl bg-brand-bg px-3 py-2">
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Délai estimé</p>
                <p class="text-sm font-extrabold text-brand-secondary">{{ p.delaiMois }} mois</p>
              </div>
            }
          </div>
        }
        @if (p.commentaire) {
          <p class="whitespace-pre-line rounded-xl border-l-2 border-brand-primary/50 bg-brand-bg/60 px-3 py-2 text-sm text-gray-700">
            {{ p.commentaire }}
          </p>
        }
        @for (f of p.plans; track f.id) {
          <button
            type="button"
            (click)="ouvrirFichier.emit(f)"
            class="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-left text-xs font-semibold text-brand-secondary hover:border-brand-primary/40 hover:bg-brand-bg"
          >
            <mat-icon class="!h-4 !w-4 !text-[16px] text-brand-primary">architecture</mat-icon>
            <span class="min-w-0 flex-1 truncate">{{ f.nomOriginal }}</span>
            <mat-icon class="!h-4 !w-4 !text-[16px] text-gray-400">open_in_new</mat-icon>
          </button>
        }
        @if (p.statut === 'REFUSEE' && p.reponseAcquereur) {
          <p class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-gray-700">
            <span class="font-bold text-brand-danger">Réponse de l’acquéreur :</span> {{ p.reponseAcquereur }}
          </p>
        }
      </div>

      <footer class="px-4 pb-3 text-[11px] text-gray-400">
        Envoyée le {{ p.dateProposition | date: 'd MMM y à HH:mm' }}
        @if (p.auteurNom) {
          par {{ p.auteurNom }}
        }
        @if (p.dateReponse && p.statut !== 'CADUQUE') {
          · réponse le {{ p.dateReponse | date: 'd MMM y' }}
        }
      </footer>
    </article>
  `,
})
export class CartePropositionComponent {
  readonly proposition = input.required<PropositionProjet>();
  readonly ouvrirFichier = output<FichierProjet>();

  readonly libelleStatut = computed(() => LIBELLES_STATUT_PROPOSITION[this.proposition().statut]);
  readonly ton = computed(() => TONS[this.proposition().statut]);
  readonly prix = computed(() => formaterFcfa(this.proposition().prixEstime ?? 0));
}
