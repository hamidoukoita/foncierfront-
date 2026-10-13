import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SocieteService } from '../../core/services/societe.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AgentCollaborateur } from '../../core/models/societe.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

type AgentFilter = 'TOUS' | 'ACTIFS' | 'SUSPENDUS';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatIconModule,
    StatusBadgeComponent,
    PaginationComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.css'
})
export class AgentsComponent implements OnInit {
  private readonly societeService = inject(SocieteService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly agents = this.societeService.agents;
  readonly currentFilter = signal<AgentFilter>('TOUS');
  readonly currentPage = signal(1);
  readonly searchQuery = signal('');
  readonly isLoading = signal(false);
  readonly isToggling = signal(false);
  readonly isAddModalOpen = signal(false);
  readonly agentToToggle = signal<AgentCollaborateur | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly filteredAgents = computed(() => {
    let list = this.agents();
    const filter = this.currentFilter();
    if (filter === 'ACTIFS') list = list.filter(a => a.statut === 'ACTIF');
    if (filter === 'SUSPENDUS') list = list.filter(a => a.statut === 'SUSPENDU');

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(a =>
        `${a.prenom} ${a.nom}`.toLowerCase().includes(q) ||
        (a.telephone || '').includes(q) ||
        (a.matricule || '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  readonly pagedAgents = computed(() => {
    const page = this.currentPage();
    const size = 8;
    const start = (page - 1) * size;
    return this.filteredAgents().slice(start, start + size);
  });

  readonly countTous = computed(() => this.agents().length);
  readonly countActifs = computed(() => this.agents().filter(a => a.statut === 'ACTIF').length);
  readonly countSuspendus = computed(() => this.agents().filter(a => a.statut === 'SUSPENDU').length);

  readonly agentForm = this.fb.nonNullable.group({
    prenom: ['', [Validators.required, Validators.minLength(2)]],
    nom: ['', [Validators.required, Validators.minLength(2)]],
    telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,12}$/)]],
    motDePasse: ['agent1234', [Validators.required, Validators.minLength(4)]]
  });

  ngOnInit(): void {
    this.isLoading.set(true);
    this.societeService.getAgents().subscribe({
      next: () => this.isLoading.set(false),
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Erreur', 'Impossible de charger les agents.');
      }
    });
  }

  setFilter(f: AgentFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  openAddModal(): void {
    this.agentForm.reset({
      prenom: '',
      nom: '',
      telephone: '',
      motDePasse: 'agent1234'
    });
    this.isAddModalOpen.set(true);
  }

  submitAddAgent(): void {
    if (this.agentForm.invalid) {
      this.agentForm.markAllAsTouched();
      this.toast.warning('Formulaire invalide', 'Vérifiez le prénom, le nom, le téléphone et le mot de passe.');
      return;
    }

    const val = this.agentForm.getRawValue();
    this.isLoading.set(true);
    this.societeService.createAgent({
      prenom: val.prenom.trim(),
      nom: val.nom.trim(),
      telephone: val.telephone.trim(),
      motDePasse: val.motDePasse
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isAddModalOpen.set(false);
        this.toast.success(
          'Collaborateur créé',
          `${val.prenom} ${val.nom} peut se connecter avec le téléphone ${val.telephone}.`
        );
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'Impossible de créer le compte collaborateur.';
        this.toast.error('Création impossible', msg);
      }
    });
  }

  requestToggleAgentStatut(agent: AgentCollaborateur): void {
    if (agent.estResponsableSociete) {
      this.toast.warning('Action interdite', 'Le responsable de la société ne peut pas être suspendu ici.');
      return;
    }
    if (this.currentUserId() != null && agent.id === this.currentUserId()) {
      this.toast.warning('Action interdite', 'Vous ne pouvez pas suspendre votre propre compte.');
      return;
    }
    this.agentToToggle.set(agent);
  }

  confirmToggleAgentStatut(): void {
    const ag = this.agentToToggle();
    if (!ag) return;

    const next: 'ACTIF' | 'SUSPENDU' = ag.statut === 'ACTIF' ? 'SUSPENDU' : 'ACTIF';
    this.isToggling.set(true);

    this.societeService.updateAgentStatut(ag.id, next).subscribe({
      next: () => {
        this.isToggling.set(false);
        this.agentToToggle.set(null);
        if (next === 'SUSPENDU') {
          this.toast.warning(
            'Accès suspendu',
            `${ag.prenom} ${ag.nom} ne peut plus se connecter. Sa session sera invalidée.`
          );
        } else {
          this.toast.success(
            'Compte réactivé',
            `${ag.prenom} ${ag.nom} peut à nouveau se connecter.`
          );
        }
      },
      error: (err) => {
        this.isToggling.set(false);
        const msg = err?.error?.message || err?.message || 'Le changement de statut a échoué.';
        this.toast.error('Erreur', msg);
      }
    });
  }

  cancelToggleAgentStatut(): void {
    this.agentToToggle.set(null);
  }

  canToggle(agent: AgentCollaborateur): boolean {
    if (agent.estResponsableSociete) return false;
    if (this.currentUserId() != null && agent.id === this.currentUserId()) return false;
    return true;
  }

  formatPhone(tel: string | undefined): string {
    if (!tel) return '—';
    const clean = tel.replace(/\s+/g, '');
    if (clean.startsWith('+')) return clean;
    return `+223 ${clean}`;
  }
}
