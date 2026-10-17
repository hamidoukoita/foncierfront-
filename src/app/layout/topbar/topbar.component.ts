import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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
import { NavItem, navAdministration, navSociete } from '../navigation';
import { CompteurNotificationsService } from '../../core/services/compteur-notifications.service';
import { PastilleCompteurComponent } from '../../shared/components/pastille-compteur/pastille-compteur.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';


@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    RouterLinkActive,
    LogoComponent,
    PastilleCompteurComponent,
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

  constructor() {
    inject(CompteurNotificationsService).suivre(inject(DestroyRef));
  }
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

  private readonly superAdminNav = computed<NavItem[]>(() =>
    navAdministration(this.superAdminService.countSocietesEnAttente()),
  );

  private readonly compteurNotifications = inject(CompteurNotificationsService);
  private readonly societeNav = computed(() => navSociete(this.compteurNotifications.nonLues()));

  readonly currentNavItems = computed(() => {
    return this.authService.isPlatformAdmin() ? this.superAdminNav() : this.societeNav();
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
