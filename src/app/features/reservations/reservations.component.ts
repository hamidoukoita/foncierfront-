import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { Reservation, StatutReservation } from '../../core/models/societe.models';
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
  readonly selectedAgentNom = signal<string>('');

  readonly reservations = this.societeService.reservations;
  readonly agents = this.societeService.agents;

  ngOnInit(): void {
    this.isLoading.set(true);
    this.societeService.getReservations().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
    this.societeService.getAgents().subscribe();
  }

  readonly filteredReservations = computed(() => {
    let list = this.reservations();
    const filter = this.currentFilter();
    const agent = this.selectedAgentFilter();

    if (filter === 'EN_ATTENTE') list = list.filter(r => r.statut === 'EN_ATTENTE');
    if (filter === 'CONFIRMEES') list = list.filter(r => r.statut === 'CONFIRMEE');
    if (filter === 'ANNULEES') list = list.filter(r => r.statut === 'ANNULEE');

    if (agent !== 'TOUS') {
      list = list.filter(r => r.agentAssignNom?.toLowerCase().includes(agent.toLowerCase()));
    }

    return list;
  });

  readonly countToutes = computed(() => this.reservations().length);
  readonly countEnAttente = computed(() => this.reservations().filter(r => r.statut === 'EN_ATTENTE').length);
  readonly countConfirmees = computed(() => this.reservations().filter(r => r.statut === 'CONFIRMEE').length);
  readonly countAnnulees = computed(() => this.reservations().filter(r => r.statut === 'ANNULEE').length);

  setFilter(f: ReservationFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  formatPrice(montant: number): string {
    return new Intl.NumberFormat('fr-FR').format(montant);
  }

  openAssignModal(reservation: Reservation): void {
    this.activeReservation.set(reservation);
    this.selectedAgentNom.set(reservation.agentAssignNom || (this.agents()[0]?.prenom + ' ' + this.agents()[0]?.nom[0] + '.') || '');
    this.isAssignModalOpen.set(true);
  }

  confirmAssign(): void {
    const res = this.activeReservation();
    if (res && this.selectedAgentNom()) {
      this.societeService.assignAgentToReservation(res.id, this.selectedAgentNom());
      this.toast.success(
        'Dossier assigné', 
        `Le suivi de ${res.lotDesignation} pour ${res.prospectNom} est confié à ${this.selectedAgentNom()}.`
      );
    }
    this.isAssignModalOpen.set(false);
  }

  validerCompromis(res: Reservation): void {
    res.statut = 'CONFIRMEE';
    res.delaiGel72h = 'Compromis notarié';
    this.toast.success('Dossier validé', `La réservation sur ${res.lotDesignation} est confirmée suite à signature physique.`);
    this.isAssignModalOpen.set(false);
  }
}
