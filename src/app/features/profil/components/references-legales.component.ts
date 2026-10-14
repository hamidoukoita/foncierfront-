import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { ProfilSociete } from '../../../core/models/societe.models';

/** Identifiants légaux : lecture seule, gérés par l'administration Foncier+. */
@Component({
  selector: 'app-references-legales',
  standalone: true,
  imports: [DatePipe, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white rounded-2xl p-6 border border-gray-100/90 shadow-card space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-brand-secondary">Références légales</h2>
          <p class="text-xs text-gray-500 mt-0.5">Vérifiées par l’administration à partir de votre dossier KYC.</p>
        </div>
        <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <mat-icon class="!text-sm !w-4 !h-4">lock</mat-icon> Lecture seule
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        @for (ref of references(); track ref.libelle) {
          <div class="p-3.5 rounded-xl bg-brand-bg border border-gray-100 space-y-1">
            <span class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">{{ ref.libelle }}</span>
            @if (ref.valeur) {
              <p class="text-xs font-bold text-gray-900 font-mono">{{ ref.valeur }}</p>
            } @else {
              <p class="text-xs text-gray-400 italic">Non renseigné</p>
            }
          </div>
        }
        <div class="p-3.5 rounded-xl bg-brand-bg border border-gray-100 space-y-1">
          <span class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Date d’agrément</span>
          @if (profil().dateAgrement) {
            <p class="text-xs font-bold text-gray-900">{{ profil().dateAgrement | date: 'dd/MM/yyyy' }}</p>
          } @else {
            <p class="text-xs text-gray-400 italic">Non renseignée</p>
          }
        </div>
        <div class="p-3.5 rounded-xl bg-brand-bg border border-gray-100 space-y-1">
          <span class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Autorité de délivrance</span>
          <p class="text-xs font-bold text-gray-900">Ministère de l’Urbanisme et de l’Habitat</p>
        </div>
      </div>

      <p class="text-[11px] text-gray-500 flex items-start gap-1.5">
        <mat-icon class="!text-sm !w-4 !h-4 text-brand-primary shrink-0">info</mat-icon>
        Une erreur sur ces références ? Contactez l’administration Foncier+ : elles ne peuvent être modifiées qu’après vérification de vos pièces.
      </p>
    </section>
  `,
})
export class ReferencesLegalesComponent {
  readonly profil = input.required<ProfilSociete>();

  readonly references = computed(() => [
    { libelle: 'N° d’agrément ministériel', valeur: this.profil().numeroAgrement },
    { libelle: 'Numéro fiscal (NIF)', valeur: this.profil().nif },
  ]);
}
