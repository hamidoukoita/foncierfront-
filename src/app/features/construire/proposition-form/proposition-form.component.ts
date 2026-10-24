import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import {
  DescriptionMaison,
  EquipementMaison,
  LIBELLES_CUISINE,
  LIBELLES_EQUIPEMENT,
  LIBELLES_STYLE,
  PRESENTATION_STYLE,
  PropositionProjetRequest,
  StyleMaison,
  TypeCuisine,
} from '../../../core/models/projet-echange.models';
import { ModelMaison, ProjetConstruction } from '../../../core/models/societe.models';
import { ChoixOptionsComponent, OptionChoix } from '../../../shared/components/choix-options/choix-options.component';
import { MontantDirective } from '../../../shared/directives/montant.directive';

export interface PropositionSaisie {
  request: PropositionProjetRequest;
  plan: File | null;
}

const PLAN_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const PLAN_TAILLE_MAX = 15 * 1024 * 1024;

/**
 * Proposition de la société à l'acquéreur : un modèle du catalogue et/ou une maison décrite
 * pièce par pièce, avec prix et délai estimés. Pré-remplie avec les souhaits de l'acquéreur.
 */
@Component({
  selector: 'app-proposition-form',
  standalone: true,
  imports: [MontantDirective, ReactiveFormsModule, MatIcon, ChoixOptionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proposition-form.component.html',
})
export class PropositionFormComponent implements OnInit {
  readonly projet = input.required<ProjetConstruction>();
  readonly modeles = input<ModelMaison[]>([]);
  readonly enCours = input(false);
  readonly valider = output<PropositionSaisie>();
  readonly annule = output<void>();

  private readonly fb = inject(FormBuilder);

  readonly styles: OptionChoix<StyleMaison>[] = (Object.keys(LIBELLES_STYLE) as StyleMaison[]).map((s) => ({
    valeur: s,
    libelle: LIBELLES_STYLE[s],
    ...PRESENTATION_STYLE[s],
  }));
  readonly cuisines: OptionChoix<TypeCuisine>[] = (Object.keys(LIBELLES_CUISINE) as TypeCuisine[]).map((c) => ({
    valeur: c,
    libelle: LIBELLES_CUISINE[c],
  }));
  readonly equipementsDisponibles = Object.entries(LIBELLES_EQUIPEMENT) as [EquipementMaison, string][];
  readonly niveaux: OptionChoix<number>[] = [
    { valeur: 1, libelle: 'Plain-pied' },
    { valeur: 2, libelle: 'R+1' },
    { valeur: 3, libelle: 'R+2' },
  ];
  readonly optionsModeles = computed<OptionChoix<number>[]>(() =>
    this.modeles().map((m) => ({ valeur: m.id, libelle: m.libeller })),
  );

  readonly plan = signal<File | null>(null);
  readonly erreurPlan = signal<string | null>(null);
  readonly erreur = signal<string | null>(null);

  readonly form = this.fb.group({
    titre: ['', [Validators.required, Validators.maxLength(150)]],
    modelMaisonId: [null as number | null],
    nombreNiveaux: [null as number | null],
    style: [null as StyleMaison | null],
    nombreChambres: [null as number | null, [Validators.min(0), Validators.max(30)]],
    nombreSuites: [null as number | null, [Validators.min(0), Validators.max(30)]],
    nombreSallesBain: [null as number | null, [Validators.min(0), Validators.max(30)]],
    nombreSalons: [null as number | null, [Validators.min(0), Validators.max(10)]],
    salleAManger: [false],
    toilettesVisiteurs: [false],
    magasin: [false],
    cuisine: [null as TypeCuisine | null],
    placesGarage: [null as number | null, [Validators.min(0), Validators.max(10)]],
    equipements: [[] as EquipementMaison[]],
    surfaceHabitable: [null as number | null, [Validators.min(1)]],
    precisions: ['', [Validators.maxLength(3000)]],
    prixEstime: [null as number | null, [Validators.min(1)]],
    delaiMois: [null as number | null, [Validators.min(1), Validators.max(120)]],
    commentaire: ['', [Validators.maxLength(3000)]],
  });

  constructor() {
    this.form.controls.modelMaisonId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.appliquerModele(id));
  }

  ngOnInit(): void {
    this.reprendreSouhaits();
  }

  @HostListener('document:keydown.escape')
  fermer(): void {
    if (!this.enCours()) this.annule.emit();
  }

  /** Point de départ : ce que l'acquéreur a demandé, que la société ajuste. */
  reprendreSouhaits(): void {
    const s = this.projet().maisonSouhaitee;
    if (!s) return;
    this.form.patchValue({
      nombreNiveaux: s.nombreNiveaux ?? null,
      style: s.style ?? null,
      nombreChambres: s.nombreChambres ?? null,
      nombreSuites: s.nombreSuites ?? null,
      nombreSallesBain: s.nombreSallesBain ?? null,
      nombreSalons: s.nombreSalons ?? null,
      salleAManger: !!s.salleAManger,
      toilettesVisiteurs: !!s.toilettesVisiteurs,
      magasin: !!s.magasin,
      cuisine: s.cuisine ?? null,
      placesGarage: s.placesGarage ?? null,
      equipements: [...(s.equipements ?? [])],
    });
  }

  /** Un modèle du catalogue pré-remplit ses caractéristiques connues. */
  private appliquerModele(id: number | null): void {
    const m = this.modeles().find((x) => x.id === id);
    if (!m) return;
    this.form.patchValue({
      nombreChambres: m.nombreChambres ?? this.form.controls.nombreChambres.value,
      nombreSallesBain: m.nombreSallesBain ?? this.form.controls.nombreSallesBain.value,
      surfaceHabitable: m.surfaceConstruite ?? this.form.controls.surfaceHabitable.value,
    });
    if (!this.form.controls.titre.value?.trim()) this.form.controls.titre.setValue(m.libeller);
  }

  basculerEquipement(e: EquipementMaison): void {
    const actuels = this.form.controls.equipements.value ?? [];
    this.form.controls.equipements.setValue(
      actuels.includes(e) ? actuels.filter((x) => x !== e) : [...actuels, e],
    );
  }

  aEquipement(e: EquipementMaison): boolean {
    return (this.form.controls.equipements.value ?? []).includes(e);
  }

  choisirPlan(event: Event): void {
    const champ = event.target as HTMLInputElement;
    const f = champ.files?.[0] ?? null;
    this.erreurPlan.set(null);
    if (f && !PLAN_TYPES.includes(f.type)) {
      this.erreurPlan.set('Format non supporté : PDF, JPG, PNG ou WEBP.');
      champ.value = '';
      return;
    }
    if (f && f.size > PLAN_TAILLE_MAX) {
      this.erreurPlan.set('Le plan dépasse 15 Mo.');
      champ.value = '';
      return;
    }
    this.plan.set(f);
  }

  envoyer(): void {
    this.erreur.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.erreur.set('Vérifiez les champs en rouge.');
      return;
    }
    const v = this.form.getRawValue();
    const maison: DescriptionMaison = {
      nombreNiveaux: v.nombreNiveaux,
      style: v.style,
      nombreChambres: v.nombreChambres,
      nombreSuites: v.nombreSuites,
      nombreSallesBain: v.nombreSallesBain,
      nombreSalons: v.nombreSalons,
      salleAManger: v.salleAManger,
      toilettesVisiteurs: v.toilettesVisiteurs,
      magasin: v.magasin,
      cuisine: v.cuisine,
      placesGarage: v.placesGarage,
      equipements: v.equipements ?? [],
      surfaceHabitable: v.surfaceHabitable,
      precisions: v.precisions?.trim() || null,
    };
    const decrite = maison.nombreNiveaux != null || maison.nombreChambres != null || !!maison.precisions;
    if (!v.modelMaisonId && !decrite) {
      this.erreur.set('Choisissez un modèle du catalogue ou décrivez la maison (niveaux, chambres…).');
      return;
    }
    if (v.nombreChambres != null && v.nombreSuites != null && v.nombreSuites > v.nombreChambres) {
      this.erreur.set('Les chambres avec salle de bain sont comprises dans le nombre de chambres.');
      return;
    }
    this.valider.emit({
      request: {
        titre: (v.titre ?? '').trim(),
        modelMaisonId: v.modelMaisonId ?? undefined,
        maison: decrite ? maison : undefined,
        prixEstime: v.prixEstime ?? undefined,
        delaiMois: v.delaiMois ?? undefined,
        commentaire: v.commentaire?.trim() || undefined,
      },
      plan: this.plan(),
    });
  }

  invalide(nom: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[nom];
    return c.invalid && c.touched;
  }
}
