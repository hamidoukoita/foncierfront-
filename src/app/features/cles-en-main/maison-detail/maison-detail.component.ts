import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MaisonCleEnMain } from '../../../core/models/maison.models';
import { formaterFcfa } from '../../../core/utils/format';
import { InfoLigneComponent } from '../../../shared/components/info-ligne/info-ligne.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { libelleStatutMaison } from '../maison-statut';

/** Fiche complète d'une maison clé en main (panneau latéral). */
@Component({
  selector: 'app-maison-detail',
  standalone: true,
  imports: [MatIcon, InfoLigneComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = maison();
    <div class="space-y-6">
      <section class="rounded-2xl bg-brand-secondary p-5 text-white">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Maison clé en main</p>
            <p class="mt-1 text-base font-bold">{{ m.titre }}</p>
          </div>
          <app-status-badge [status]="m.statut" [label]="libelleStatut()" />
        </div>
        <p class="mt-4 text-[10px] font-bold uppercase tracking-wider text-white/60">Prix</p>
        <p class="text-2xl font-extrabold tracking-tight">{{ prix() }}</p>
      </section>

      <div class="grid grid-cols-3 gap-2 text-center">
        @for (c of caracteristiques(); track c.libelle) {
          <div class="rounded-xl bg-brand-bg px-2 py-3">
            <mat-icon class="!h-5 !w-5 !text-[20px] text-brand-primary">{{ c.icone }}</mat-icon>
            <p class="text-base font-extrabold text-brand-secondary">{{ c.valeur }}</p>
            <p class="text-[10px] font-semibold text-gray-500">{{ c.libelle }}</p>
          </div>
        }
      </div>

      @if (m.description) {
        <section>
          <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Description</h3>
          <p class="whitespace-pre-line text-sm leading-relaxed text-gray-700">{{ m.description }}</p>
        </section>
      }

      @if (m.equipements.length) {
        <section>
          <h3 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Équipements</h3>
          <div class="flex flex-wrap gap-2">
            @for (eq of m.equipements; track eq) {
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-success">
                <mat-icon class="!h-4 !w-4 !text-[16px]">check</mat-icon>{{ eq }}
              </span>
            }
          </div>
        </section>
      }

      <section>
        <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Terrain et localisation</h3>
        <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
          <app-info-ligne icone="square_foot" libelle="Superficie du terrain" [valeur]="m.superficie + ' m²'" />
          <app-info-ligne icone="place" libelle="Adresse" [valeur]="m.adresse || 'Non renseignée'" />
          <app-info-ligne icone="my_location" libelle="Coordonnées GPS" [valeur]="gps()" />
          <app-info-ligne icone="verified" libelle="Titre Foncier" [valeur]="m.numeroTitreFoncier || 'Non renseigné'" />
          <app-info-ligne icone="tag" libelle="Référence" [valeur]="m.reference" />
        </div>
      </section>

      <section>
        <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Visibilité acquéreurs</h3>
        <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
          <app-info-ligne icone="photo_library" libelle="Couverture" [valeur]="m.imageUrl ? 'Photo définie' : 'Aucune photo : ajoutez-en depuis la galerie'" />
          <app-info-ligne icone="360" libelle="Visite 360°" [valeur]="(m.nombrePanoramas ?? 0) + ' panorama(s)'" />
          <app-info-ligne icone="storefront" libelle="Commodités rattachées" [valeur]="m.commodites.length + ' commodité(s)'" />
        </div>
      </section>
    </div>
  `,
})
export class MaisonDetailComponent {
  readonly maison = input.required<MaisonCleEnMain>();

  readonly libelleStatut = computed(() => libelleStatutMaison(this.maison().statut));
  readonly prix = computed(() => formaterFcfa(this.maison().prix));
  readonly gps = computed(() => {
    const m = this.maison();
    return m.latitude != null && m.longitude != null ? `${m.latitude}, ${m.longitude}` : 'Non renseignées : la carte ne pourra pas la situer';
  });
  readonly caracteristiques = computed(() => {
    const m = this.maison();
    return [
      { icone: 'bed', libelle: 'Chambres', valeur: m.nombreChambres ?? '—' },
      { icone: 'bathtub', libelle: 'Salles de bain', valeur: m.nombreSallesBain ?? '—' },
      { icone: 'home', libelle: 'm² habitables', valeur: m.surfaceHabitable ?? '—' },
    ];
  });
}
