import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { ToastContainerComponent } from '../../shared/components/toast-container/toast-container.component';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    ToastContainerComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  readonly layoutService = inject(LayoutService);

  onLinkNavigated(): void {
    // Sur écran mobile, fermer la sidebar après clic sur un lien
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.layoutService.closeSidebar();
    }
  }
}