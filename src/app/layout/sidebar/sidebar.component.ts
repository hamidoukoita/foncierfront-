import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { AuthService } from '../../core/services/auth.service';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
}

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

  // 1. Menus Administration Plateforme
  private readonly superAdminNav = computed<NavItem[]>(() => {
    const attente = this.superAdminService.countSocietesEnAttente();
    return [
      {
        label: 'Vue d\'ensemble',
        route: '/admin/dashboard',
        icon: 'dashboard',
      },
      {
        label: 'Inscriptions Promoteurs',
        route: '/admin/inscriptions-societes',
        badge: attente > 0 ? attente : undefined,
        icon: 'domain',
      },
      {
        label: 'Utilisateurs & Privilèges',
        route: '/admin/utilisateurs-roles',
        icon: 'people',
      },
      {
        label: 'Programmes & Cités',
        route: '/admin/controle-programmes',
        icon: 'holiday_village',
      },
    ];
  });

  // 2. Menus Société Promotrice Agréée
  private readonly societeNav: NavItem[] = [
    {
      label: 'Tableau de bord',
      route: '/societe/dashboard',
      icon: 'dashboard',
    },
    {
      label: 'Programmes',
      route: '/societe/programmes',
      icon: 'holiday_village',
    },
    {
      label: 'Parcelles',
      route: '/societe/parcelles',
      icon: 'grid_view',
    },
    {
      label: 'Réservations',
      route: '/societe/reservations',
      icon: 'assignment',
    },
    {
      label: 'Rendez-vous',
      route: '/societe/visites',
      icon: 'event',
    },
    {
      label: 'Gestion des Agents',
      route: '/societe/agents',
      icon: 'badge',
    },
    {
      label: 'Projets construction',
      route: '/societe/projets-construction',
      icon: 'engineering',
    },
    {
      label: 'Notifications',
      route: '/societe/notifications',
      icon: 'notifications',
    },
    {
      label: 'Profil Société',
      route: '/societe/profil',
      icon: 'apartment',
    },
  ];

  readonly currentNavItems = computed(() => {
    return this.authService.isPlatformAdmin() ? this.superAdminNav() : this.societeNav;
  });

  onLogout(): void {
    this.authService.logout();
  }
}
