import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule, LogoComponent],
  templateUrl: './access-denied.component.html',
  styleUrl: './access-denied.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly currentUser = this.authService.currentUser;

  readonly requiredRole = computed(() => {
    return this.route.snapshot.queryParams['roleRequis'] || null;
  });

  readonly userRoleLabel = computed(() => {
    const user = this.currentUser();
    if (!user) return 'Non identifié';
    if (this.authService.isPlatformAdmin()) return 'Administrateur Plateforme DNDC';
    if (this.authService.isResponsableSociete()) return 'Promoteur Responsable Direction';
    return String(user.role);
  });

  goToAuthorizedDashboard(): void {
    const route = this.authService.getAuthorizedDashboardRoute();
    this.router.navigate([route]);
  }

  logout(): void {
    this.authService.logout();
  }
}
