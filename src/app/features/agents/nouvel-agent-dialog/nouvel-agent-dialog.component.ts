import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { SocieteService } from '../../../core/services/societe.service';
import { ToastService } from '../../../core/services/toast.service';
import { messageErreurApi } from '../../../core/utils/api-error';

const MOT_DE_PASSE_TEMPORAIRE = 'agent1234';

/** Création du compte d'un collaborateur (connexion sur l'application mobile par téléphone). */
import { chiffresTelephone, messageErreur, nomPersonne, telephoneMali, texteRequis } from '../../../core/utils/validateurs';

@Component({
  selector: 'app-nouvel-agent-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nouvel-agent-titre"
        (click)="fermerSiLibre()"
      >
        <div class="w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <mat-icon>person_add</mat-icon>
              </span>
              <div>
                <h3 id="nouvel-agent-titre" class="text-base font-bold text-brand-secondary">Nouveau collaborateur</h3>
                <p class="mt-0.5 text-[11px] text-gray-500">Il se connectera à l’application mobile avec son téléphone.</p>
              </div>
            </div>
            <button type="button" (click)="fermerSiLibre()" aria-label="Fermer" class="cursor-pointer rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <mat-icon class="!h-5 !w-5 !text-[20px]">close</mat-icon>
            </button>
          </div>

          <form [formGroup]="form" (ngSubmit)="creer()" class="space-y-4 p-6">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Prénom *</span>
                <input type="text" formControlName="prenom" maxlength="50" placeholder="Ex. Moussa" class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15" />
                @if (erreur('prenom', 'Le prénom'); as message) {
                  <span class="mt-1 block text-[10px] text-brand-danger">{{ message }}</span>
                }
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Nom *</span>
                <input type="text" formControlName="nom" maxlength="50" placeholder="Ex. DIARRA" class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 uppercase" />
                @if (erreur('nom', 'Le nom'); as message) {
                  <span class="mt-1 block text-[10px] text-brand-danger">{{ message }}</span>
                }
              </label>
            </div>

            <label class="block">
              <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Téléphone (identifiant) *</span>
              <input type="tel" formControlName="telephone" placeholder="76 12 34 56" class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 font-mono" />
              <span class="mt-1 block text-[10px]" [class]="erreur('telephone', 'Le téléphone') ? 'text-brand-danger' : 'text-gray-400'">
                {{ erreur('telephone', 'Le téléphone') ?? 'Numéro malien à 8 chiffres, sans indicatif.' }}
              </span>
            </label>

            <label class="block">
              <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Mot de passe temporaire *</span>
              <input type="text" formControlName="motDePasse" class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 font-mono" />
              <span class="mt-1 block text-[10px]" [class]="erreur('motDePasse', 'Le mot de passe') ? 'text-brand-danger' : 'text-gray-400'">
                {{ erreur('motDePasse', 'Le mot de passe') ?? 'À communiquer à l’agent (6 caractères minimum), qui pourra le changer depuis son profil.' }}
              </span>
            </label>

            <div class="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button type="button" (click)="fermerSiLibre()" class="bouton bouton-discret">Annuler</button>
              <button
                type="submit"
                [disabled]="form.invalid || enCours()"
                class="bouton bouton-primaire"
              >
                {{ enCours() ? 'Création…' : 'Créer le compte' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class NouvelAgentDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly isOpen = input<boolean>(false);
  readonly fermer = output<void>();
  readonly enCours = signal(false);

  readonly form = this.fb.nonNullable.group({
    prenom: ['', [texteRequis, nomPersonne, Validators.minLength(2), Validators.maxLength(50)]],
    nom: ['', [texteRequis, nomPersonne, Validators.minLength(2), Validators.maxLength(50)]],
    telephone: ['', [Validators.required, telephoneMali]],
    motDePasse: [MOT_DE_PASSE_TEMPORAIRE, [texteRequis, Validators.minLength(6)]],
  });

  constructor() {
    // Formulaire vierge à chaque ouverture.
    effect(() => {
      if (this.isOpen()) {
        this.form.reset({ prenom: '', nom: '', telephone: '', motDePasse: MOT_DE_PASSE_TEMPORAIRE });
      }
    });
  }

  erreur(champ: 'prenom' | 'nom' | 'telephone' | 'motDePasse', libelle: string): string | null {
    return messageErreur(this.form.controls[champ], libelle);
  }

  fermerSiLibre(): void {
    if (!this.enCours()) this.fermer.emit();
  }

  creer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.getRawValue();
    this.enCours.set(true);
    this.societeService
      .createAgent({ prenom: val.prenom.trim(), nom: val.nom.trim(), telephone: chiffresTelephone(val.telephone), motDePasse: val.motDePasse.trim() })
      .subscribe({
        next: () => {
          this.enCours.set(false);
          this.toast.success('Collaborateur créé', `${val.prenom} ${val.nom} peut se connecter avec le téléphone ${val.telephone}.`);
          this.fermer.emit();
        },
        error: (err) => {
          this.enCours.set(false);
          this.toast.error('Création impossible', messageErreurApi(err, 'Impossible de créer le compte collaborateur.'));
        },
      });
  }
}
