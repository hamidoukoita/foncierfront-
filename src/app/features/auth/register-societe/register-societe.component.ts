import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterSocieteRequest } from '../../../core/models/auth.models';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pass = control.get('motDePasse')?.value;
  const confirm = control.get('confirmerMotDePasse')?.value;
  if (!pass || !confirm) return null;
  return pass === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-societe',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule, 
    LogoComponent,
    MatIconModule,
    MatButtonModule,
    MatRippleModule
  ],
  templateUrl: './register-societe.component.html',
  styleUrl: './register-societe.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterSocieteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Étape courante (1 à 4 pour le formulaire, 5 pour l'écran de succès)
  readonly currentStep = signal<number>(1);
  readonly totalSteps = 4;

  // États UI
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly selectedFileName = signal<string | null>(null);
  readonly selectedFileSize = signal<string | null>(null);

  // Formulaire unifié avec validation stricte
  readonly form = this.fb.group({
    // Étape 1 : Société
    nomSociete: ['', [Validators.required, Validators.maxLength(150)]],
    formeJuridique: ['SARL', [Validators.required]],
    adresse: ['', [Validators.required, Validators.maxLength(255)]],
    telephoneSociete: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{8,20}$/)]],
    emailSociete: ['', [Validators.email]],
    siteWeb: [''],

    // Étape 2 : Agrément & Fiscalité
    numeroAgrement: ['', [Validators.required, Validators.maxLength(100)]],
    dateAgrement: ['', [Validators.required]],
    nif: ['', [Validators.required, Validators.maxLength(100)]],
    rccm: ['', [Validators.maxLength(100)]],
    description: [''],

    // Étape 3 : Responsable promoteur
    prenomResponsable: ['', [Validators.required, Validators.maxLength(100)]],
    nomResponsable: ['', [Validators.required, Validators.maxLength(100)]],
    telephoneResponsable: ['', [Validators.required, Validators.pattern(/^[0-9]{8,15}$/)]],
    emailResponsable: ['', [Validators.email]],
    motDePasse: ['', [Validators.required, Validators.minLength(6)]],
    confirmerMotDePasse: ['', [Validators.required]],

    // Étape 4 : KYC & Engagement
    documentKycNom: ['dossier_kyc_consolide.pdf'],
    engagementHonneur: [false, [Validators.requiredTrue]]
  }, { validators: passwordMatchValidator });

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  // Navigation entre les slides
  goToStep(step: number): void {
    if (step < 1 || step > this.totalSteps) return;
    
    // Si on avance, vérifier que les étapes précédentes sont valides
    if (step > this.currentStep()) {
      if (!this.validateCurrentStep()) {
        return;
      }
    }
    this.errorMessage.set(null);
    this.currentStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    if (!this.validateCurrentStep()) {
      return;
    }
    this.errorMessage.set(null);
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevStep(): void {
    this.errorMessage.set(null);
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Validation par slide
  validateCurrentStep(): boolean {
    const step = this.currentStep();
    let fieldsToValidate: string[] = [];

    switch (step) {
      case 1:
        fieldsToValidate = ['nomSociete', 'formeJuridique', 'adresse', 'telephoneSociete'];
        break;
      case 2:
        fieldsToValidate = ['numeroAgrement', 'dateAgrement', 'nif'];
        break;
      case 3:
        fieldsToValidate = ['prenomResponsable', 'nomResponsable', 'telephoneResponsable', 'motDePasse', 'confirmerMotDePasse'];
        break;
      case 4:
        fieldsToValidate = ['engagementHonneur'];
        break;
    }

    let isValid = true;
    for (const field of fieldsToValidate) {
      const control = this.form.get(field);
      if (control) {
        control.markAsTouched();
        if (control.invalid) {
          isValid = false;
        }
      }
    }

    if (step === 3 && this.form.hasError('passwordMismatch')) {
      this.form.get('confirmerMotDePasse')?.setErrors({ passwordMismatch: true });
      isValid = false;
    }

    if (!isValid) {
      this.errorMessage.set('Veuillez renseigner tous les champs obligatoires correctement avant de poursuivre.');
    } else {
      this.errorMessage.set(null);
    }

    return isValid;
  }

  // Gestion du fichier KYC consolidé (Agrément + RCCM + NIF + Pièce ID)
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const validTypes = ['application/pdf', 'application/x-pdf'];
      if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
        this.errorMessage.set('Seuls les documents au format PDF sont autorisés pour le dossier KYC.');
        input.value = '';
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        this.errorMessage.set('La taille du fichier PDF ne doit pas dépasser 25 Mo.');
        input.value = '';
        return;
      }

      this.selectedFileName.set(file.name);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      this.selectedFileSize.set(`${sizeMb} Mo`);
      this.form.patchValue({ documentKycNom: file.name });
      this.errorMessage.set(null);
    }
  }

  // Soumission finale du dossier d'agrément
  onSubmit(): void {
    if (!this.validateCurrentStep()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Veuillez vérifier les informations renseignées.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const val = this.form.getRawValue();
    const payload: RegisterSocieteRequest = {
      nomSociete: val.nomSociete!.trim(),
      adresse: val.adresse ? val.adresse.trim() : undefined,
      telephoneSociete: val.telephoneSociete!.trim(),
      emailSociete: val.emailSociete ? val.emailSociete.trim() : undefined,
      siteWeb: val.siteWeb ? val.siteWeb.trim() : undefined,
      description: val.description ? val.description.trim() : undefined,
      numeroAgrement: val.numeroAgrement!.trim(),
      dateAgrement: val.dateAgrement || undefined,
      nif: val.nif!.trim(),
      rccm: val.rccm ? val.rccm.trim() : undefined,
      nomResponsable: val.nomResponsable!.trim(),
      prenomResponsable: val.prenomResponsable!.trim(),
      telephoneResponsable: val.telephoneResponsable!.trim(),
      emailResponsable: val.emailResponsable ? val.emailResponsable.trim() : undefined,
      motDePasse: val.motDePasse!,
      documentKycNom: this.selectedFileName() || 'dossier_kyc_consolide.pdf'
    };

    this.authService.registerSociete(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        // Basculer vers l'écran de confirmation / succès (Slide 5)
        this.currentStep.set(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.message || "Une erreur est survenue lors de l'enregistrement de votre dossier.");
      }
    });
  }

  // Redirection vers le login
  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
