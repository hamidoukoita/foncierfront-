import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  /**
   * Signal d'état d'ouverture de la barre latérale (Sidebar)
   * Accessible réactivement par la Topbar, la Sidebar et l'AdminLayout
   */
  readonly sidebarOpen = signal<boolean>(false);

  /**
   * Alterne l'affichage de la sidebar (Desktop collapse/expand & Mobile drawer)
   */
  toggleSidebar(): void {
    this.sidebarOpen.update(open => !open);
  }

  /**
   * Ferme la sidebar (notamment après un clic sur un lien en mobile)
   */
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /**
   * Ouvre la sidebar
   */
  openSidebar(): void {
    this.sidebarOpen.set(true);
  }
}
