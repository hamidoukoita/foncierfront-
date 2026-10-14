import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MaisonCleEnMain, MaisonCleEnMainRequest, StatutBien } from '../../../core/models/maison.models';
import { MaisonsService } from '../../../core/services/maisons.service';
import { ToastService } from '../../../core/services/toast.service';
import { messageErreurApi } from '../../../core/utils/api-error';
import { EQUIPEMENTS_SUGGERES, STATUTS_MAISON } from '../maison-statut';

/** Création / modification d'une maison clé en main. */
@Component({
  selector: 'app-maison-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maison-form.component.html',
})
export class MaisonFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly maisonsService = inject(MaisonsService);
  private readonly toast = inject(ToastService);

  /** null : création. */
  readonly maison = input<MaisonCleEnMain | null>(null);
  readonly fermer = output<void>();

  readonly enCours = signal(false);
  readonly equipements = signal<string[]>([]);
  readonly statuts = STATUTS_MAISON;
  readonly suggestions = EQUIPEMENTS_SUGGERES;

  readonly form = this.fb.group({
    titre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    reference: this.fb.nonNullable.control('', [Validators.maxLength(100)]),
    prix: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    superficie: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    surfaceHabitable: this.fb.control<number | null>(null, [Validators.min(0)]),
    nombreChambres: this.fb.control<number | null>(null, [Validators.min(0)]),
    nombreSallesBain: this.fb.control<number | null>(null, [Validators.min(0)]),
    nombreNiveaux: this.fb.control<number | null>(null, [Validators.min(0)]),
    numeroTitreFoncier: this.fb.nonNullable.control('', [Validators.maxLength(100)]),
    adresse: this.fb.nonNullable.control('', [Validators.maxLength(255)]),
    latitude: this.fb.control<number | null>(null),
    longitude: this.fb.control<number | null>(null),
    statut: this.fb.nonNullable.control<StatutBien>('DISPONIBLE'),
    description: this.fb.nonNullable.control('', [Validators.maxLength(5000)]),
  });

  constructor() {
    effect(() => {
      const m = this.maison();
      this.form.reset({
        titre: m?.titre ?? '',
        reference: m?.reference ?? '',
        prix: m?.prix ?? null,
        superficie: m?.superficie ?? null,
        surfaceHabitable: m?.surfaceHabitable ?? null,
        nombreChambres: m?.nombreChambres ?? null,
        nombreSallesBain: m?.nombreSallesBain ?? null,
        nombreNiveaux: m?.nombreNiveaux ?? null,
        numeroTitreFoncier: m?.numeroTitreFoncier ?? '',
        adresse: m?.adresse ?? '',
        latitude: m?.latitude ?? null,
        longitude: m?.longitude ?? null,
        statut: m?.statut ?? 'DISPONIBLE',
        description: m?.description ?? '',
      });
      this.equipements.set([...(m?.equipements ?? [])]);
    });
  }

  basculerEquipement(nom: string): void {
    this.equipements.update((l) => (l.includes(nom) ? l.filter((e) => e !== nom) : [...l, nom]));
  }

  ajouterEquipement(champ: HTMLInputElement): void {
    const nom = champ.value.trim();
    if (nom && !this.equipements().includes(nom)) this.equipements.update((l) => [...l, nom]);
    champ.value = '';
  }

  fermerSiLibre(): void {
    if (!this.enCours()) this.fermer.emit();
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Champs incomplets', 'Renseignez au moins le titre, le prix et la superficie du terrain.');
      return;
    }
    const v = this.form.getRawValue();
    const requete: MaisonCleEnMainRequest = {
      titre: v.titre.trim(),
      reference: v.reference.trim(),
      prix: v.prix!,
      superficie: v.superficie!,
      surfaceHabitable: v.surfaceHabitable ?? undefined,
      nombreChambres: v.nombreChambres ?? undefined,
      nombreSallesBain: v.nombreSallesBain ?? undefined,
      nombreNiveaux: v.nombreNiveaux ?? undefined,
      numeroTitreFoncier: v.numeroTitreFoncier.trim() || undefined,
      adresse: v.adresse.trim() || undefined,
      latitude: v.latitude ?? undefined,
      longitude: v.longitude ?? undefined,
      statut: v.statut,
      description: v.description.trim() || undefined,
      equipements: this.equipements(),
    };
    const existante = this.maison();
    this.enCours.set(true);
    const action$ = existante
      ? this.maisonsService.modifier(existante.id, requete)
      : this.maisonsService.creer(requete);
    action$.subscribe({
      next: () => {
        this.enCours.set(false);
        this.toast.success(existante ? 'Maison modifiée' : 'Maison publiée', `${requete.titre} est enregistrée.`);
        this.fermer.emit();
      },
      error: (e) => {
        this.enCours.set(false);
        this.toast.error('Enregistrement impossible', messageErreurApi(e, 'Le serveur n’a pas pu enregistrer la maison.'));
      },
    });
  }
}
