import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SocieteService } from '../../core/services/societe.service';
import { NotificationItem } from '../../core/models/societe.models';
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

  readonly isLoading = signal<boolean>(false);
  readonly currentFilter = signal<NotifFilter>('TOUTES');
  readonly currentPage = signal<number>(1);

  readonly notifications = this.societeService.notifications;

  ngOnInit(): void {
    this.isLoading.set(true);
    this.societeService.getNotifications().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
  }

  readonly filteredNotifications = computed(() => {
    const list = this.notifications();
    const filter = this.currentFilter();

    switch (filter) {
      case 'NON_LUES': return list.filter(n => n.nonLu);
      case 'RESERVATIONS': return list.filter(n => n.type === 'RESERVATION');
      case 'VISITES': return list.filter(n => n.type === 'VISITE');
      case 'CONSTRUCTION': return list.filter(n => n.type === 'CONSTRUCTION');
      default: return list;
    }
  });

  readonly countToutes = computed(() => this.notifications().length);
  readonly countNonLues = computed(() => this.notifications().filter(n => n.nonLu).length);
  readonly countReservations = computed(() => this.notifications().filter(n => n.type === 'RESERVATION').length);
  readonly countVisites = computed(() => this.notifications().filter(n => n.type === 'VISITE').length);
  readonly countConstruction = computed(() => this.notifications().filter(n => n.type === 'CONSTRUCTION').length);


  setFilter(f: NotifFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  markAllAsRead(): void {
    this.societeService.markAllNotificationsAsRead();
  }

  handleAction(item: NotificationItem): void {
    item.nonLu = false;
    this.router.navigate([item.actionRoute]);
  }
}
