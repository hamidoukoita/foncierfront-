import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    RouterLinkActive,
    LogoComponent,
    MatIconModule,
    MatButtonModule,
    MatRippleModule
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  readonly authService = inject(AuthService);
  readonly layoutService = inject(LayoutService);
  private readonly superAdminService = inject(SuperAdminService);
  private readonly elementRef = inject(ElementRef);

  readonly currentUser = this.authService.currentUser;
  readonly isMenuOpen = signal<boolean>(false);

  readonly headerWorkspaceTitle = computed(() => {
    if (this.authService.isPlatformAdmin()) {
      return 'Console d’Administration Plateforme';
    }
    if (this.authService.isResponsableSociete()) {
      return `Direction • ${this.currentUser()?.societeNom || 'Société Promotrice'}`;
    }
    return `Espace Collaborateur • ${this.currentUser()?.societeNom || 'Commercial'}`;
  });

  // 1. Menus Administration Plateforme avec Badges Dynamiques
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

  readonly notificationRoute = computed(() => {
    if (this.authService.isPlatformAdmin()) return '/admin/dashboard';
    return '/societe/notifications';
  });

  toggleMenu(): void {
    this.isMenuOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const container = this.elementRef.nativeElement.querySelector(
      '.user-menu-container',
    );
    if (container && !container.contains(event.target as Node)) {
      this.isMenuOpen.set(false);
    }
  }

  onLogout(): void {
    this.isMenuOpen.set(false);
    this.authService.logout();
  }
}
