import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { Reservation } from '../../core/models/societe.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { MatIcon } from '@angular/material/icon';

type ReservationFilter = 'TOUTES' | 'EN_ATTENTE' | 'CONFIRMEES' | 'ANNULEES';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, PaginationComponent, MatIcon],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(false);
  readonly currentFilter = signal<ReservationFilter>('TOUTES');
  readonly selectedAgentFilter = signal<string>('TOUS');
  readonly currentPage = signal<number>(1);

  readonly isAssignModalOpen = signal<boolean>(false);
  readonly activeReservation = signal<Reservation | null>(null);
  readonly selectedAgentId = signal<number | null>(null);
  readonly isAssigning = signal<boolean>(false);

  readonly reservations = this.societeService.reservations;
  readonly agents = this.societeService.agents;

  ngOnInit(): void {
    this.isLoading.set(true);
    this.societeService.getReservations().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false),
    });
    this.societeService.getAgents().subscribe();
  }

  readonly filteredReservations = computed(() => {
    let list = this.reservations();
    const filter = this.currentFilter();
    const agent = this.selectedAgentFilter();

    if (filter === 'EN_ATTENTE') list = list.filter((r) => r.statut === 'EN_ATTENTE');
    if (filter === 'CONFIRMEES') list = list.filter((r) => r.statut === 'CONFIRMEE');
    if (filter === 'ANNULEES') list = list.filter((r) => r.statut === 'ANNULEE');

    if (agent !== 'TOUS') {
      list = list.filter((r) => r.agentAssignNom?.toLowerCase().includes(agent.toLowerCase()));
    }

    return list;
  });

  readonly countToutes = computed(() => this.reservations().length);
  readonly countEnAttente = computed(
    () => this.reservations().filter((r) => r.statut === 'EN_ATTENTE').length,
  );
  readonly countConfirmees = computed(
    () => this.reservations().filter((r) => r.statut === 'CONFIRMEE').length,
  );
  readonly countAnnulees = computed(
    () => this.reservations().filter((r) => r.statut === 'ANNULEE').length,
  );

  setFilter(f: ReservationFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  formatPrice(montant: number): string {
    return new Intl.NumberFormat('fr-FR').format(montant);
  }

  openAssignModal(reservation: Reservation): void {
    this.activeReservation.set(reservation);
    this.selectedAgentId.set(reservation.agentAssignId ?? this.agents()[0]?.id ?? null);
    this.isAssignModalOpen.set(true);
  }

  closeAssignModal(): void {
    if (this.isAssigning()) return;
    this.isAssignModalOpen.set(false);
  }

  confirmAssign(): void {
    const res = this.activeReservation();
    const agentId = this.selectedAgentId();
    if (!res || agentId == null) {
      this.toast.error('Attribution', 'Sélectionnez un agent actif.');
      return;
    }

    const agent = this.agents().find((a) => a.id === agentId);
    const agentLabel = agent ? `${agent.prenom} ${agent.nom}` : `Agent #${agentId}`;

    this.isAssigning.set(true);
    this.societeService.assignAgentToReservation(res.id, agentId).subscribe({
      next: () => {
        this.isAssigning.set(false);
        this.isAssignModalOpen.set(false);
        this.toast.success(
          'Dossier attribué',
          `La demande sur ${res.lotDesignation} (${res.prospectNom}) est confiée à ${agentLabel}.`,
        );
      },
      error: (err) => {
        this.isAssigning.set(false);
        const msg =
          err?.error?.message ||
          err?.message ||
          "Impossible d'attribuer cet agent (délai 72 h dépassé, ou agent hors société).";
        this.toast.error('Attribution refusée', msg);
      },
    });
  }

  confirmerReservation(res: Reservation): void {
    this.societeService.confirmerReservation(res.id).subscribe({
      next: () => {
        this.toast.success('Confirmée', `La réservation sur ${res.lotDesignation} est confirmée.`);
        this.isAssignModalOpen.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Confirmation impossible.';
        this.toast.error('Erreur', msg);
      },
    });
  }
}
