import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SocieteService } from '../../core/services/societe.service';
import { NotificationItem } from '../../core/models/societe.models';
import { ToastService } from '../../core/services/toast.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { MatIcon } from '@angular/material/icon';

type NotifFilter = 'TOUTES' | 'NON_LUES' | 'RESERVATIONS' | 'VISITES' | 'CONSTRUCTION';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, PaginationComponent, MatIcon],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly pageSize = 5;

  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly isMarkingAll = signal(false);
  readonly actingNotificationId = signal<number | null>(null);
  readonly currentFilter = signal<NotifFilter>('TOUTES');
  readonly currentPage = signal(1);
  readonly notifications = this.societeService.notifications;

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.societeService.getNotifications().subscribe({
      next: () => this.isLoading.set(false),
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.hasError.set(true);
        this.toast.error('Notifications indisponibles', this.errorMessage(error));
      },
    });
  }

  readonly filteredNotifications = computed(() => {
    const list = this.notifications();
    switch (this.currentFilter()) {
      case 'NON_LUES': return list.filter(item => item.nonLu);
      case 'RESERVATIONS': return list.filter(item => item.type === 'RESERVATION' || item.type === 'PAIEMENT');
      case 'VISITES': return list.filter(item => item.type === 'VISITE');
      case 'CONSTRUCTION': return list.filter(item => item.type === 'CONSTRUCTION');
      default: return list;
    }
  });

  readonly paginatedNotifications = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredNotifications().slice(start, start + this.pageSize);
  });

  readonly countToutes = computed(() => this.notifications().length);
  readonly countNonLues = computed(() => this.notifications().filter(item => item.nonLu).length);
  readonly countReservations = computed(() => this.notifications().filter(item => item.type === 'RESERVATION' || item.type === 'PAIEMENT').length);
  readonly countVisites = computed(() => this.notifications().filter(item => item.type === 'VISITE').length);
  readonly countConstruction = computed(() => this.notifications().filter(item => item.type === 'CONSTRUCTION').length);

  setFilter(filter: NotifFilter): void {
    this.currentFilter.set(filter);
    this.currentPage.set(1);
  }

  markAllAsRead(): void {
    if (this.isMarkingAll()) return;
    if (this.countNonLues() === 0) {
      this.toast.info('Tout est à jour', 'Aucune notification non lue.');
      return;
    }

    this.isMarkingAll.set(true);
    this.societeService.markAllNotificationsAsRead().subscribe({
      next: () => {
        this.isMarkingAll.set(false);
        this.toast.success('Notifications mises à jour', 'Toutes les notifications ont été marquées comme lues.');
      },
      error: (error: unknown) => {
        this.isMarkingAll.set(false);
        this.toast.error('Mise à jour impossible', this.errorMessage(error));
      },
    });
  }

  handleAction(item: NotificationItem): void {
    if (this.actingNotificationId() !== null) return;
    const navigateToItem = () => {
      const route = item.actionRoute?.startsWith('/societe/') ? item.actionRoute : '/societe/dashboard';
      void this.router.navigateByUrl(route);
    };

    if (!item.nonLu) {
      navigateToItem();
      return;
    }

    this.actingNotificationId.set(item.id);
    this.societeService.markNotificationAsRead(item.id).subscribe({
      next: () => {
        this.actingNotificationId.set(null);
        navigateToItem();
      },
      error: (error: unknown) => {
        this.actingNotificationId.set(null);
        this.toast.error('Notification non marquée comme lue', this.errorMessage(error));
        // L'utilisateur peut tout de même consulter la ressource liée.
        navigateToItem();
      },
    });
  }

  iconForType(type: NotificationItem['type']): string {
    switch (type) {
      case 'RESERVATION': return 'event_available';
      case 'PAIEMENT': return 'payments';
      case 'VISITE': return 'calendar_month';
      case 'CONSTRUCTION': return 'construction';
      default: return 'notifications';
    }
  }

  typeLabel(type: NotificationItem['type']): string {
    switch (type) {
      case 'RESERVATION': return 'Réservation';
      case 'PAIEMENT': return 'Paiement';
      case 'VISITE': return 'Visite';
      case 'CONSTRUCTION': return 'Construction';
      default: return 'Information';
    }
  }

  private errorMessage(error: unknown): string {
    const err = error as { error?: { message?: string; detail?: string }; message?: string };
    return err?.error?.message || err?.error?.detail || err?.message || 'Une erreur inattendue est survenue. Réessayez.';
  }
}
