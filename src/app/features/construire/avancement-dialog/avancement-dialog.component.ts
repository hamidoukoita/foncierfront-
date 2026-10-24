import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModelMaison, ProjetConstruction } from '../../../core/models/societe.models';
import { SocieteService } from '../../../core/services/societe.service';
import { messageErreurApi } from '../../../core/utils/api-error';
import { ChoixOptionsComponent, OptionChoix } from '../../../shared/components/choix-options/choix-options.component';

export const ETAPES_AVANCEMENT = [
  'Dossier reçu',
  'Étude technique',
  'Devis transmis',
  'Validation acquéreur',
  'Préparation chantier',
  'Travaux en cours',
  'Réception',
] as const;

/** Mise à jour de l'avancement d'un projet accepté (progression, étape, modèle, commentaire). */
@Component({
  selector: 'app-avancement-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ChoixOptionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = projet();
    @let champ = 'w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-primary focus:outline-none shadow-card';
    <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" (click)="fermer()">
      <div role="dialog" aria-modal="true" class="bg-white rounded-2xl w-full max-w-md overflow-hidden border border-gray-100 shadow-card" (click)="$event.stopPropagation()">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-base font-bold text-brand-secondary">Avancement — {{ p.numeroDossier || ('#' + p.id) }}</h3>
          <button type="button" (click)="fermer()" class="text-gray-400 hover:text-gray-600 text-lg cursor-pointer" aria-label="Fermer">✕</button>
        </div>
        <form [formGroup]="form" (ngSubmit)="enregistrer()" class="p-6 space-y-4">
          <div class="rounded-xl bg-brand-bg p-3">
            <p class="text-xs font-bold text-brand-secondary">{{ p.prospectNom }}</p>
            <p class="text-[11px] text-gray-500">{{ p.surfaceTerrainM2 }} m² · {{ p.localisationTerrain }}</p>
          </div>
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-500 font-semibold">Progression</span>
              <strong class="text-brand-primary">{{ form.controls.progression.value }}%</strong>
            </div>
            <input type="range" min="0" max="100" step="5" formControlName="progression" class="w-full accent-[var(--foncier-primary)]" />
          </div>
          <div>
            <p class="block text-xs font-semibold text-gray-700 uppercase mb-1">Étape</p>
            <app-choix-options formControlName="etapeAvancement" [options]="etapes" [effacable]="false" libelle="Étape" />
          </div>
          @if (compatibles().length) {
            <div>
              <p class="block text-xs font-semibold text-gray-700 uppercase mb-1">Modèle compatible</p>
              <app-choix-options formControlName="modelMaisonId" [options]="compatibles()" libelle="Modèle compatible" />
              <p class="mt-1 text-[11px] text-gray-500">Sans choix, le modèle actuel est conservé.</p>
            </div>
          }
          <div>
            <label class="block text-xs font-semibold text-gray-700 uppercase mb-1" for="av-commentaire">Commentaire (acquéreur)</label>
            <textarea id="av-commentaire" formControlName="commentaireAvancement" rows="3" [class]="champ" placeholder="Ex. Fondations coulées…"></textarea>
          </div>
          @if (erreur(); as e) {
            <p class="text-xs font-semibold text-brand-danger" role="alert">{{ e }}</p>
          }
          <div class="flex justify-end gap-2">
            <button type="button" (click)="fermer()" class="bouton bouton-contour">Annuler</button>
            <button type="submit" [disabled]="enCours()" class="bouton bouton-primaire">
              {{ enCours() ? '…' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class AvancementDialogComponent implements OnInit {
  readonly projet = input.required<ProjetConstruction>();
  /** Catalogue de la société, proposé si aucun modèle compatible n'est trouvé. */
  readonly modeles = input<ModelMaison[]>([]);
  readonly termine = output<string>();
  readonly annule = output<void>();

  private readonly societeService = inject(SocieteService);
  private readonly fb = inject(FormBuilder);

  readonly etapes: OptionChoix<string>[] = ETAPES_AVANCEMENT.map((e) => ({ valeur: e, libelle: e }));
  readonly compatibles = signal<OptionChoix<number>[]>([]);
  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    progression: [0, [Validators.min(0), Validators.max(100)]],
    etapeAvancement: ['Dossier reçu'],
    commentaireAvancement: [''],
    modelMaisonId: [null as number | null],
  });

  ngOnInit(): void {
    const p = this.projet();
    this.form.reset({
      progression: p.progression ?? 0,
      etapeAvancement: p.etapeAvancement ?? 'Dossier reçu',
      commentaireAvancement: p.commentaireAvancement ?? '',
      modelMaisonId: p.modeleMaisonId ?? null,
    });
    this.societeService.getModelesMaisonCompatibles(p.surfaceTerrainM2, p.typeTerrain).subscribe({
      next: (items) => this.compatibles.set(this.versOptions(items.length ? items : this.modeles())),
      error: () => this.compatibles.set(this.versOptions(this.modeles())),
    });
  }

  private versOptions(modeles: ModelMaison[]): OptionChoix<number>[] {
    return modeles.map((m) => ({ valeur: m.id, libelle: m.libeller }));
  }

  @HostListener('document:keydown.escape')
  fermer(): void {
    if (!this.enCours()) this.annule.emit();
  }

  enregistrer(): void {
    const projet = this.projet();
    const v = this.form.getRawValue();
    this.enCours.set(true);
    this.erreur.set(null);
    this.societeService
      .updateProjetAvancement(projet.id, {
        progression: Math.min(100, Math.max(0, Number(v.progression) || 0)),
        etapeAvancement: v.etapeAvancement.trim() || 'Avancement en cours',
        commentaireAvancement: v.commentaireAvancement.trim() || undefined,
      })
      .subscribe({
        next: () => {
          const modelId = v.modelMaisonId;
          if (!modelId || modelId === projet.modeleMaisonId) {
            this.termine.emit('Avancement mis à jour.');
            return;
          }
          this.societeService.changerModeleProjet(projet.id, modelId).subscribe({
            next: () => this.termine.emit('Avancement et modèle mis à jour.'),
            error: (e) => this.echec(e),
          });
        },
        error: (e) => this.echec(e),
      });
  }

  private echec(e: unknown): void {
    this.enCours.set(false);
    this.erreur.set(messageErreurApi(e, 'Enregistrement impossible.'));
  }
}
