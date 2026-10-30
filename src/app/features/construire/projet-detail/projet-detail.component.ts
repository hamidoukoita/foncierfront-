import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { environment } from '../../../../environments/environment';
import { FichierProjet, ProjetConstruction } from '../../../core/models/societe.models';
import { formaterFcfa } from '../../../core/utils/format';
import { InfoLigneComponent } from '../../../shared/components/info-ligne/info-ligne.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { DescriptionMaisonComponent } from '../description-maison/description-maison.component';
import { CartePropositionComponent } from '../fil-projet/carte-proposition.component';
import { TelephonePipe } from '../../../shared/pipes/telephone.pipe';

export const LIBELLES_STATUT_PROJET: Record<string, string> = {
  EN_ETUDE: 'En étude',
  EN_DISCUSSION: 'En discussion',
  ACCEPTER: 'Accepté',
  REFUSER: 'Refusé',
};

const TYPES_FICHIER: Record<FichierProjet['type'], { libelle: string; icone: string }> = {
  TITRE_FONCIER: { libelle: 'Titre Foncier', icone: 'verified' },
  PLAN: { libelle: 'Plan', icone: 'architecture' },
  PHOTO: { libelle: 'Photo', icone: 'image' },
};

/** Dossier complet d'un projet de construction : accord, acquéreur, terrain, maison souhaitée, pièces, suivi. */
@Component({
  selector: 'app-projet-detail',
  standalone: true,
  imports: [TelephonePipe, 
    DatePipe,
    MatIcon,
    InfoLigneComponent,
    StatusBadgeComponent,
    DescriptionMaisonComponent,
    CartePropositionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = projet();
    <div class="space-y-6">
      <!-- Synthèse -->
      <section class="overflow-hidden rounded-2xl bg-brand-secondary text-white">
        @if (imageModele(); as img) {
          @if (imageEnErreur() !== img) {
            <img [src]="url(img)" alt="" (error)="imageEnErreur.set(img)" class="h-40 w-full bg-white/5 object-cover" />
          } @else {
            <!-- Image introuvable : illustration neutre plutôt qu'un lien cassé. -->
            <div class="flex h-28 w-full items-center justify-center bg-white/5" aria-hidden="true">
              <mat-icon class="!h-12 !w-12 !text-[48px] text-white/25">{{ p.maisonReferenceTitre ? 'home_work' : 'cottage' }}</mat-icon>
            </div>
          }
        }
        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                {{ p.modelePersonnalise ? 'Modèle proposé par l’acquéreur' : p.maisonReferenceTitre ? 'Comme votre maison clé en main' : 'Modèle du catalogue' }}
              </p>
              <p class="mt-1 truncate text-base font-bold">{{ p.modeleVilla }}</p>
            </div>
            <app-status-badge [status]="p.etatEtude" [label]="libelleStatut()" />
          </div>
          @if (p.dateDemande) {
            <p class="mt-3 text-xs text-white/70">Demande reçue le {{ p.dateDemande | date: 'd MMMM y' }}</p>
          }
          @if (p.etatEtude === 'ACCEPTER') {
            <div class="mt-4">
              <div class="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/70">
                <span>{{ p.etapeAvancement || 'Avancement' }}</span>
                <span class="font-bold text-white">{{ p.progression }} %</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div class="h-full rounded-full bg-brand-primary" [style.width.%]="p.progression"></div>
              </div>
            </div>
          }
        </div>
      </section>

      @if (p.propositionRetenue; as accord) {
        <section>
          <h3 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Accord conclu</h3>
          <app-carte-proposition [proposition]="accord" (ouvrirFichier)="ouvrirFichier.emit($event)" />
        </section>
      }

      @if (p.etatEtude === 'REFUSER' && p.motifRefus) {
        <section class="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p class="text-[10px] font-bold uppercase tracking-wider text-brand-danger">Motif du refus</p>
          <p class="mt-1 text-sm text-gray-800">{{ p.motifRefus }}</p>
        </section>
      }

      <!-- Acquéreur -->
      <section>
        <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Acquéreur</h3>
        <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
          <app-info-ligne icone="person" libelle="Nom" [valeur]="p.prospectNom" />
          @if (p.prospectTelephone) {
            <app-info-ligne icone="call" libelle="Téléphone">
              <a [href]="'tel:' + p.prospectTelephone" class="text-brand-primary hover:underline">{{ p.prospectTelephone | telephone }}</a>
            </app-info-ligne>
          }
        </div>
      </section>

      <!-- Terrain -->
      <section>
        <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Terrain</h3>
        <div class="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
          <app-info-ligne icone="verified" libelle="Titre Foncier" [valeur]="p.titreFoncierNumero || '—'" />
          <app-info-ligne icone="square_foot" libelle="Superficie" [valeur]="p.surfaceTerrainM2 + ' m²'" />
          @if (p.localisationTerrain) {
            <app-info-ligne icone="place" libelle="Localisation" [valeur]="p.localisationTerrain" />
          }
          @if (p.typeTerrain) {
            <app-info-ligne icone="crop_free" libelle="Forme du terrain" [valeur]="p.typeTerrain" />
          }
          @if (p.devisMontantFcfa) {
            <app-info-ligne icone="payments" libelle="Budget de l’acquéreur" [valeur]="budget()" />
          }
        </div>
      </section>

      <!-- Maison souhaitée -->
      <section>
        <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Maison souhaitée</h3>
        <div class="rounded-2xl border border-gray-100 px-4">
          @if (p.modelePersonnalise) {
            <div class="py-3">
              <app-description-maison [description]="p.maisonSouhaitee" />
            </div>
          } @else {
            <app-info-ligne
              [icone]="p.maisonReferenceTitre ? 'home_work' : 'home'"
              [libelle]="p.maisonReferenceTitre ? 'Maison clé en main de référence' : 'Modèle'"
              [valeur]="p.modeleVilla"
            />
            @if (p.modeleMaisonPlanUrl) {
              <app-info-ligne icone="architecture" libelle="Plan du modèle">
                <a [href]="url(p.modeleMaisonPlanUrl)" target="_blank" rel="noopener" class="text-brand-primary hover:underline">Ouvrir le plan</a>
              </app-info-ligne>
            }
          }
        </div>
      </section>

      <!-- Pièces jointes -->
      <section>
        <h3 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Pièces jointes ({{ p.fichiers.length }})
        </h3>
        @if (p.fichiers.length === 0) {
          <p class="rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-center text-xs text-gray-500">
            Aucune pièce jointe. Demandez une copie du Titre Foncier à l’acquéreur.
          </p>
        } @else {
          <ul class="space-y-2">
            @for (f of p.fichiers; track f.id) {
              <li>
                <button
                  type="button"
                  (click)="ouvrirFichier.emit(f)"
                  class="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-gray-100 px-3.5 py-2.5 text-left transition-colors hover:border-brand-primary/40 hover:bg-brand-bg"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                    <mat-icon class="!h-[18px] !w-[18px] !text-[18px]">{{ typeFichier(f).icone }}</mat-icon>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">{{ typeFichier(f).libelle }}</span>
                    <span class="block truncate text-sm font-semibold text-brand-secondary">{{ f.nomOriginal }}</span>
                  </span>
                  <mat-icon class="text-gray-400">open_in_new</mat-icon>
                </button>
              </li>
            }
          </ul>
        }
      </section>

      @if (p.description) {
        <section>
          <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Ce que l’acquéreur a ajouté</h3>
          <p class="whitespace-pre-line rounded-2xl bg-brand-bg p-4 text-sm leading-relaxed text-gray-700">{{ p.description }}</p>
        </section>
      }

      @if (p.etatEtude === 'ACCEPTER' && p.commentaireAvancement) {
        <section>
          <h3 class="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Dernier point communiqué</h3>
          <p class="rounded-2xl border border-gray-100 p-4 text-sm text-gray-700">{{ p.commentaireAvancement }}</p>
        </section>
      }
    </div>
  `,
})
export class ProjetDetailComponent {
  readonly projet = input.required<ProjetConstruction>();
  readonly ouvrirFichier = output<FichierProjet>();

  readonly libelleStatut = computed(() => LIBELLES_STATUT_PROJET[this.projet().etatEtude] ?? this.projet().etatEtude);
  /** Photo du modèle du catalogue ou de la maison clé en main prise comme référence. */
  readonly imageModele = computed(() => {
    const p = this.projet();
    if (p.modelePersonnalise) return null;
    return p.maisonReferenceImageUrl ?? p.modeleMaisonImageUrl ?? null;
  });
  /** Adresse d'image qui n'a pas pu être chargée (fichier supprimé, lien externe mort). */
  readonly imageEnErreur = signal<string | null>(null);
  readonly budget = computed(() => formaterFcfa(this.projet().devisMontantFcfa ?? 0));

  typeFichier(f: FichierProjet) {
    return TYPES_FICHIER[f.type];
  }

  /** Fichiers publics du catalogue (images et plans des modèles). */
  url(chemin: string): string {
    if (/^(https?:|data:)/.test(chemin)) return chemin;
    return environment.apiUrl.replace(/\/api$/, '') + chemin;
  }
}
