import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfilSociete } from '../../../core/models/societe.models';
import { messageErreurApi } from '../../../core/utils/api-error';

/** Coordonnées modifiables par la société (raison sociale, siège, contacts, présentation). */
@Component({
  selector: 'app-identite-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './identite-form.component.html',
})
export class IdentiteFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly profil = input.required<ProfilSociete>();
  readonly isSaving = signal(false);

  readonly form = this.fb.nonNullable.group({
    raisonSociale: ['', [Validators.required, Validators.maxLength(150)]],
    siegeSocial: ['', [Validators.required]],
    telephoneFixe: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{8,20}$/)]],
    emailOfficiel: ['', [Validators.email]],
    siteWeb: [''],
    description: ['', [Validators.maxLength(500)]],
  });

  private readonly etat = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  private readonly valeurs = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Le bouton n'est actif que si quelque chose a réellement changé. */
  readonly modifie = computed(() => {
    this.valeurs();
    return this.form.dirty;
  });
  readonly valide = computed(() => this.etat() === 'VALID');

  readonly initiales = computed(() => {
    const mots = (this.valeurs().raisonSociale ?? '').trim().split(/\s+/).filter(Boolean);
    return (mots.slice(0, 2).map((m) => m[0]).join('') || 'SP').toUpperCase();
  });

  constructor() {
    effect(() => this.reinitialiser(this.profil()));
  }

  reinitialiser(p: ProfilSociete = this.profil()): void {
    this.form.reset({
      raisonSociale: p.raisonSociale,
      siegeSocial: p.siegeSocial,
      telephoneFixe: p.telephoneFixe,
      emailOfficiel: p.emailOfficiel,
      siteWeb: p.siteWeb,
      description: p.description ?? '',
    });
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.isSaving.set(true);
    this.societeService
      .updateProfilSociete({
        raisonSociale: v.raisonSociale.trim(),
        siegeSocial: v.siegeSocial.trim(),
        telephoneFixe: v.telephoneFixe.trim(),
        emailOfficiel: v.emailOfficiel.trim(),
        siteWeb: v.siteWeb.trim(),
        description: v.description.trim(),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.form.markAsPristine();
          this.toast.success('Profil mis à jour', 'Les coordonnées de la société ont été enregistrées.');
        },
        error: (e) => {
          this.isSaving.set(false);
          this.toast.error('Enregistrement impossible', messageErreurApi(e, 'Vérifiez les informations saisies.'));
        },
      });
  }

  invalide(champ: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[champ];
    return c.invalid && c.touched;
  }
}
