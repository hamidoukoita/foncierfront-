import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { AgentCollaborateur } from '../../core/models/societe.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatIcon } from '@angular/material/icon';

type AgentFilter = 'TOUS' | 'ACTIFS' | 'SUSPENDUS';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    StatusBadgeComponent,
    PaginationComponent,
    ConfirmDialogComponent,
    MatIcon
],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(false);
  readonly currentFilter = signal<AgentFilter>('TOUS');
  readonly isAddModalOpen = signal<boolean>(false);
  readonly currentPage = signal<number>(1);

  // Dialogue de suspension d'accès
  readonly agentToToggle = signal<AgentCollaborateur | null>(null);

  readonly agents = this.societeService.agents;

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.isLoading.set(true);
    this.societeService.getAgents().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
  }

  readonly filteredAgents = computed(() => {
    const list = this.agents();
    const filter = this.currentFilter();
    if (filter === 'ACTIFS') return list.filter(a => a.statut === 'ACTIF');
    if (filter === 'SUSPENDUS') return list.filter(a => a.statut === 'SUSPENDU');
    return list;
  });

  readonly countTous = computed(() => this.agents().length);
  readonly countActifs = computed(() => this.agents().filter(a => a.statut === 'ACTIF').length);
  readonly countSuspendus = computed(() => this.agents().filter(a => a.statut === 'SUSPENDU').length);

  readonly agentForm = this.fb.nonNullable.group({
    prenom: ['', [Validators.required]],
    nom: ['', [Validators.required]],
    telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,12}$/)]],
    fonctionDeleguee: ['Commercial Terrains', [Validators.required]],
    motDePasse: ['agent1234', [Validators.required, Validators.minLength(4)]]
  });

  setFilter(f: AgentFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  openAddModal(): void {
    this.agentForm.reset({
      prenom: '',
      nom: '',
      telephone: '',
      fonctionDeleguee: 'Commercial Terrains',
      motDePasse: 'agent1234'
    });
    this.isAddModalOpen.set(true);
  }

  submitAddAgent(): void {
    if (this.agentForm.invalid) {
      this.agentForm.markAllAsTouched();
      this.toast.warning('Formulaire invalide', 'Veuillez vérifier les champs du collaborateur.');
      return;
    }

    const val = this.agentForm.getRawValue();
    this.isLoading.set(true);
    this.societeService.createAgent({
      prenom: val.prenom,
      nom: val.nom,
      telephone: val.telephone,
      fonctionDeleguee: val.fonctionDeleguee,
      motDePasse: val.motDePasse
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isAddModalOpen.set(false);
        this.toast.success('Agent créé', `Le compte de ${val.prenom} ${val.nom} est actif (+223 ${val.telephone}).`);
      },
      error: (err) => {
        console.error('Erreur création agent:', err);
        this.isLoading.set(false);
        this.isAddModalOpen.set(false);
        this.toast.error('Erreur', 'Impossible de créer le compte collaborateur.');
      }
    });
  }

  requestToggleAgentStatut(agent: AgentCollaborateur): void {
    this.agentToToggle.set(agent);
  }

  confirmToggleAgentStatut(): void {
    const ag = this.agentToToggle();
    if (!ag) return;

    const next = ag.statut === 'ACTIF' ? 'SUSPENDU' : 'ACTIF';
    this.societeService.agents.update(list => list.map(a => a.id === ag.id ? { ...a, statut: next } : a));

    if (next === 'SUSPENDU') {
      this.toast.warning('Accès suspendu', `L'agent ${ag.prenom} ${ag.nom} ne peut plus se connecter.`);
    } else {
      this.toast.success('Compte réactivé', `L'accès de ${ag.prenom} ${ag.nom} a été rétabli.`);
    }

    this.agentToToggle.set(null);
  }

  cancelToggleAgentStatut(): void {
    this.agentToToggle.set(null);
  }
}
