import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SocieteService } from '../../core/services/societe.service';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-profil-societe',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIcon],
  templateUrl: './profil-societe.component.html',
  styleUrl: './profil-societe.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilSocieteComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);

  readonly profil = this.societeService.profilSociete;
  readonly isSavedSuccess = signal<boolean>(false);

  readonly profilForm = this.fb.nonNullable.group({
    raisonSociale: [this.profil()?.raisonSociale || '', [Validators.required]],
    siegeSocial: [this.profil()?.siegeSocial || '', [Validators.required]],
    telephoneFixe: [this.profil()?.telephoneFixe || '', [Validators.required]],
    emailOfficiel: [this.profil()?.emailOfficiel || '', [Validators.required, Validators.email]],
    siteWeb: [this.profil()?.siteWeb || '', [Validators.required]]
  });

  ngOnInit(): void {
    this.societeService.getProfilSociete().subscribe(p => {
      if (p) {
        this.profilForm.patchValue({
          raisonSociale: p.raisonSociale,
          siegeSocial: p.siegeSocial,
          telephoneFixe: p.telephoneFixe,
          emailOfficiel: p.emailOfficiel,
          siteWeb: p.siteWeb
        });
      }
    });
  }

  submitSave(): void {
    if (this.profilForm.invalid) {
      this.profilForm.markAllAsTouched();
      return;
    }

    this.societeService.updateProfilSociete(this.profilForm.getRawValue()).subscribe({
      next: () => {
        this.isSavedSuccess.set(true);
        setTimeout(() => this.isSavedSuccess.set(false), 3000);
      },
      error: (err) => {
        console.error('Erreur mise à jour profil société:', err);
      }
    });
  }
}
