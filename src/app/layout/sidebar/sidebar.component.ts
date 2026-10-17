import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { AuthService } from '../../core/services/auth.service';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { NavItem, navAdministration, navSociete } from '../navigation';
import { CompteurNotificationsService } from '../../core/services/compteur-notifications.service';
import { PastilleCompteurComponent } from '../../shared/components/pastille-compteur/pastille-compteur.component';


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatRippleModule,
    LogoComponent,
    PastilleCompteurComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  private readonly superAdminService = inject(SuperAdminService);
  readonly linkClicked = output<void>();

  readonly navHeaderTitle = computed(() => {
    return this.authService.isPlatformAdmin()
      ? 'Console Admin'
      : 'Espace Société';
  });

  private readonly superAdminNav = computed<NavItem[]>(() =>
    navAdministration(this.superAdminService.countSocietesEnAttente()),
  );

  private readonly compteurNotifications = inject(CompteurNotificationsService);
  private readonly societeNav = computed(() => navSociete(this.compteurNotifications.nonLues()));

  readonly currentNavItems = computed(() => {
    return this.authService.isPlatformAdmin() ? this.superAdminNav() : this.societeNav();
  });

  onLogout(): void {
    this.authService.logout();
  }
}
