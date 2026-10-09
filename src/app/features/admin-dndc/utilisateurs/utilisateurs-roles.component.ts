import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { UtilisateurBackend } from '../../../core/models/backend.models';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

type UserFilter = 'TOUS' | 'PROSPECTS' | 'PROMOTEURS' | 'AGENTS' | 'ADMINS';

@Component({
  selector: 'app-utilisateurs-roles',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    MatIconModule, 
    MatButtonModule, 
    MatRippleModule,
    PaginationComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './utilisateurs-roles.component.html',
  styleUrl: './utilisateurs-roles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UtilisateursRolesComponent implements OnInit {
  private readonly superAdminService = inject(SuperAdminService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly currentFilter = signal<UserFilter>('TOUS');
  readonly statutFilter = signal<'TOUS' | 'ACTIFS' | 'SUSPENDUS'>('TOUS');
  readonly searchQuery = signal<string>('');
  readonly currentPage = signal<number>(1);
  readonly pageSize = 8;

  // Gestion de la modale de suspension / réactivation
  readonly userToToggle = signal<UtilisateurBackend | null>(null);

  // Gestion de la modale de création d'administrateur
  readonly isCreateAdminModalOpen = signal<boolean>(false);
  readonly isSubmittingAdmin = signal<boolean>(false);

  readonly adminForm = this.fb.nonNullable.group({
    prenom: ['', [Validators.required, Validators.minLength(2)]],
    nom: ['', [Validators.required, Validators.minLength(2)]],
    telephone: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{8,20}$/)]],
    motDePasse: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly utilisateurs = this.superAdminService.utilisateurs;
  readonly isLoading = this.superAdminService.isLoading;

  /**
   * Filtrage dynamique des utilisateurs par catégorie, statut et recherche textuelle
   */
  readonly filteredUtilisateurs = computed(() => {
    let list = this.utilisateurs();
    const filter = this.currentFilter();
    const statut = this.statutFilter();
    const q = this.searchQuery().toLowerCase().trim();

    // Filtre par catégorie de profil
    if (filter === 'PROSPECTS') {
      list = list.filter(u => {
        const t = (u.typeUtilisateur || '').toUpperCase();
        return t === 'ACQUEREUR' || t === 'PROSPECT' || t.includes('CLIENT');
      });
    } else if (filter === 'PROMOTEURS') {
      list = list.filter(u => {
        const t = (u.typeUtilisateur || '').toUpperCase();
        return t === 'PROMOTEUR' || t === 'ROLE_PROMOTEUR' || t === 'AGENT_PROMOTEUR';
      });
    } else if (filter === 'AGENTS') {
      list = list.filter(u => {
        const t = (u.typeUtilisateur || '').toUpperCase();
        return t === 'AGENT' || t === 'ROLE_AGENT';
      });
    } else if (filter === 'ADMINS') {
      list = list.filter(u => {
        const t = (u.typeUtilisateur || '').toUpperCase();
        return t.includes('ADMIN') || t.includes('SUPER');
      });
    }

    // Filtre par statut de compte
    if (statut === 'ACTIFS') {
      list = list.filter(u => u.statut === 'ACTIF');
    } else if (statut === 'SUSPENDUS') {
      list = list.filter(u => u.statut === 'SUSPENDU' || u.statut === 'DESACTIVE');
    }

    // Filtre textuel multi-critères
    if (q) {
      list = list.filter(u => 
        (u.nom && u.nom.toLowerCase().includes(q)) ||
        (u.prenom && u.prenom.toLowerCase().includes(q)) ||
        (u.telephone && u.telephone.includes(q)) ||
        (u.entiteRattachee && u.entiteRattachee.toLowerCase().includes(q))
      );
    }

    return list;
  });

  /**
   * Découpage pour pagination réelle
   */
  readonly paginatedUtilisateurs = computed(() => {
    const list = this.filteredUtilisateurs();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  // Compteurs dynamiques calculés depuis la vraie base de données
  readonly countTous = computed(() => this.utilisateurs().length);

  readonly countProspects = computed(() => {
    return this.utilisateurs().filter(u => {
      const t = (u.typeUtilisateur || '').toUpperCase();
      return t === 'ACQUEREUR' || t === 'PROSPECT' || t.includes('CLIENT');
    }).length;
  });

  readonly countPromoteurs = computed(() => {
    return this.utilisateurs().filter(u => {
      const t = (u.typeUtilisateur || '').toUpperCase();
      return t === 'PROMOTEUR' || t === 'ROLE_PROMOTEUR' || t === 'AGENT_PROMOTEUR';
    }).length;
  });

  readonly countAgents = computed(() => {
    return this.utilisateurs().filter(u => {
      const t = (u.typeUtilisateur || '').toUpperCase();
      return t === 'AGENT' || t === 'ROLE_AGENT';
    }).length;
  });

  readonly countAdmins = computed(() => {
    return this.utilisateurs().filter(u => {
      const t = (u.typeUtilisateur || '').toUpperCase();
      return t.includes('ADMIN') || t.includes('SUPER');
    }).length;
  });

  ngOnInit(): void {
    this.superAdminService.loadUtilisateurs().subscribe();
  }

  setFilter(f: UserFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  getUserInitials(u: UtilisateurBackend): string {
    const p = (u.prenom || '').trim()[0] || '';
    const n = (u.nom || '').trim()[0] || '';
    return (p + n).toUpperCase() || 'U';
  }

  // --- ACTIONS DE BASCULE DE STATUT ---
  demanderToggleStatut(u: UtilisateurBackend): void {
    this.userToToggle.set(u);
  }

  confirmerToggleStatut(): void {
    const u = this.userToToggle();
    if (!u) return;

    const action = u.statut === 'ACTIF' ? 'suspendu' : 'activé';
    this.superAdminService.toggleStatutUtilisateur(u.id).subscribe({
      next: (updated) => {
        this.toast.success(
          'Compte mis à jour', 
          `Le compte de ${u.prenom} ${u.nom} a été ${action} avec succès.`
        );
        this.userToToggle.set(null);
      },
      error: (err) => {
        console.error('Erreur bascule statut utilisateur:', err);
        this.toast.error('Erreur', 'Impossible de modifier le statut du compte.');
        this.userToToggle.set(null);
      }
    });
  }

  annulerToggleStatut(): void {
    this.userToToggle.set(null);
  }

  // --- CRÉATION DE COMPTE ADMINISTRATEUR ---
  ouvrirModalCreateAdmin(): void {
    this.adminForm.reset({
      prenom: '',
      nom: '',
      telephone: '',
      motDePasse: ''
    });
    this.isCreateAdminModalOpen.set(true);
  }

  fermerModalCreateAdmin(): void {
    this.isCreateAdminModalOpen.set(false);
  }

  soumettreCreateAdmin(): void {
    if (this.adminForm.invalid) {
      this.adminForm.markAllAsTouched();
      this.toast.warning('Formulaire incomplet', 'Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    const val = this.adminForm.getRawValue();
    this.isSubmittingAdmin.set(true);

    this.superAdminService.creerAdministrateur({
      nom: val.nom.trim(),
      prenom: val.prenom.trim(),
      telephone: val.telephone.replace(/[\s-]+/g, ''),
      motDePasse: val.motDePasse,
      statut: 'ACTIF'
    }).subscribe({
      next: () => {
        this.isSubmittingAdmin.set(false);
        this.isCreateAdminModalOpen.set(false);
        this.toast.success('Admin créé', `Le compte administrateur pour ${val.prenom} ${val.nom} est actif.`);
      },
      error: (err) => {
        this.isSubmittingAdmin.set(false);
        console.error('Erreur création admin:', err);
        this.toast.error('Erreur', err?.error?.message || 'Impossible de créer le compte administrateur.');
      }
    });
  }

  // --- EXPORT CSV DES UTILISATEURS ---
  exporterCsv(): void {
    const list = this.filteredUtilisateurs();
    if (list.length === 0) {
      this.toast.info('Export impossible', 'Aucun utilisateur à exporter pour le filtre courant.');
      return;
    }

    const headers = ['ID', 'Nom', 'Prenom', 'Telephone', 'Role', 'Entite', 'Statut'];
    const rows = list.map(u => [
      u.id,
      `"${(u.nom || '').replace(/"/g, '""')}"`,
      `"${(u.prenom || '').replace(/"/g, '""')}"`,
      `"${u.telephone}"`,
      `"${u.roleLibelle || u.typeUtilisateur}"`,
      `"${(u.entiteRattachee || '').replace(/"/g, '""')}"`,
      u.statut
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `utilisateurs_foncierplus_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toast.success('Export terminé', `${list.length} utilisateurs exportés en CSV avec succès.`);
  }
}
