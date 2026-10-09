import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { StatutVisite, VisiteRendezVous } from '../../core/models/societe.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { MatIcon } from '@angular/material/icon';

type VisiteFilter = 'TOUS' | 'EN_ATTENTE' | 'CONFIRMEES' | 'EFFECTUEES';
type TypeVisiteFilter = 'TOUS' | 'CHANTIER' | 'SIEGE';

@Component({
  selector: 'app-visites',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, PaginationComponent, MatIcon],
  templateUrl: './visites.component.html',
  styleUrl: './visites.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitesComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(false);
  readonly currentFilter = signal<VisiteFilter>('TOUS');
  readonly selectedTypeVisite = signal<TypeVisiteFilter>('TOUS');
  readonly selectedPeriode = signal<string>('cette_semaine');
  readonly currentPage = signal<number>(1);

  readonly isAssignModalOpen = signal<boolean>(false);
  readonly activeVisite = signal<VisiteRendezVous | null>(null);
  readonly selectedAgentNom = signal<string>('');

  readonly visites = this.societeService.visites;
  readonly agents = this.societeService.agents;

  ngOnInit(): void {
    this.isLoading.set(true);
    this.societeService.getVisites().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
    this.societeService.getAgents().subscribe();
  }

  readonly filteredVisites = computed(() => {
    let list = this.visites();
    const filter = this.currentFilter();
    const typeF = this.selectedTypeVisite();

    // Filtre statut
    if (filter === 'EN_ATTENTE') list = list.filter(v => v.statut === 'EN_ATTENTE');
    else if (filter === 'CONFIRMEES') list = list.filter(v => v.statut === 'CONFIRME');
    else if (filter === 'EFFECTUEES') list = list.filter(v => v.statut === 'EFFECTUE');

    // Filtre bimodal (Siège vs Chantier)
    if (typeF !== 'TOUS') {
      list = list.filter(v => v.typeVisite === typeF);
    }

    return list;
  });

  readonly countTous = computed(() => this.visites().length);
  readonly countEnAttente = computed(() => this.visites().filter(v => v.statut === 'EN_ATTENTE').length);
  readonly countConfirmees = computed(() => this.visites().filter(v => v.statut === 'CONFIRME').length);
  readonly countEffectuees = computed(() => this.visites().filter(v => v.statut === 'EFFECTUE').length);

  readonly countChantier = computed(() => this.visites().filter(v => v.typeVisite === 'CHANTIER').length);
  readonly countSiege = computed(() => this.visites().filter(v => v.typeVisite === 'SIEGE').length);

  setFilter(f: VisiteFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  setTypeFilter(tf: TypeVisiteFilter): void {
    this.selectedTypeVisite.set(tf);
    this.currentPage.set(1);
  }

  openAssignModal(visite: VisiteRendezVous): void {
    this.activeVisite.set(visite);
    this.selectedAgentNom.set(visite.agentAssignNom || (this.agents()[0]?.prenom + ' ' + this.agents()[0]?.nom[0] + '.') || '');
    this.isAssignModalOpen.set(true);
  }

  confirmAssign(): void {
    const v = this.activeVisite();
    if (v && this.selectedAgentNom()) {
      this.societeService.assignAgentToVisite(v.id, this.selectedAgentNom());
      this.toast.success(
        'Agent affecté avec succès', 
        `${this.selectedAgentNom()} prend en charge le RDV (${v.typeVisite === 'SIEGE' ? 'Au Siège' : 'Sur Chantier'}) de ${v.prospectNom}.`
      );
    }
    this.isAssignModalOpen.set(false);
  }
}
