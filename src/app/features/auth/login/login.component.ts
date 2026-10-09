import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { AuthService } from '../../../core/services/auth.service';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconButton,
    MatIconModule,
    MatCheckboxModule,
    MatRippleModule,
    LogoComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

  readonly showPassword = signal<boolean>(false);

  // Formulaire réactif avec validation stricte
  readonly loginForm = this.fb.nonNullable.group({
    telephone: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{8,20}$/)]],
    motDePasse: ['', [Validators.required, Validators.minLength(4)]],
    rememberMe: [true]
  });

  readonly isLoading = this.authService.isLoading;
  readonly authError = this.authService.authError;

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    let { telephone, motDePasse } = this.loginForm.getRawValue();
    // Normaliser le numéro : retirer les espaces, tirets et préfixe +223 si présent
    telephone = telephone.replace(/[\s-]+/g, '');
    if (telephone.startsWith('+223')) {
      telephone = telephone.substring(4);
    } else if (telephone.startsWith('00223')) {
      telephone = telephone.substring(5);
    }

    this.authService.login({ telephone, motDePasse }).subscribe({
      error: () => {
        // L'erreur est gérée et exposée par le signal authError
      }
    });
  }
}
