import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { SocietePromotriceBackend } from '../../../core/models/backend.models';
import { StatsCardComponent } from '../../../shared/components/stats-card/stats-card.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { SocieteQuickViewModalComponent } from '../../../shared/components/societe-quick-view-modal/societe-quick-view-modal.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-super-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatRippleModule,
    StatsCardComponent,
    LoadingSkeletonComponent,
    SocieteQuickViewModalComponent,
  ],
  templateUrl: './super-dashboard.component.html',
  styleUrl: './super-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperDashboardComponent implements OnInit {
  readonly superAdminService = inject(SuperAdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = this.superAdminService.isLoading;
  readonly societes = this.superAdminService.societes;
  readonly programmes = this.superAdminService.programmes;
  readonly parcelles = this.superAdminService.parcelles;
  readonly utilisateurs = this.superAdminService.utilisateurs;

  // Filtres et recherche rapide
  readonly searchQuery = signal<string>('');
  readonly statutFilter = signal<'TOUS' | 'EN_ATTENTE' | 'VERIFIER' | 'REFUSER'>('TOUS');

  // Gestion du Quick View Modal
  readonly selectedSocieteForView = signal<SocietePromotriceBackend | null>(null);
  readonly isQuickViewModalOpen = signal<boolean>(false);

  // Compteurs dynamiques issus de la vraie base de données
  readonly countEnAttente = this.superAdminService.countSocietesEnAttente;
  readonly countHomologues = this.superAdminService.countSocietesValidees;
  readonly countRefusees = this.superAdminService.countSocietesRefusees;
  readonly tauxHomologation = this.superAdminService.tauxHomologation;

  readonly countProgrammesDispo = computed(() => {
    return this.programmes().filter(p => p.statut === 'DISPONIBLE').length;
  });

  /**
   * Liste des dossiers filtrés par recherche et statut
   */
  readonly filteredSocietes = computed(() => {
    let list = this.societes();
    const filter = this.statutFilter();
    const q = this.searchQuery().toLowerCase().trim();

    if (filter !== 'TOUS') {
      list = list.filter(s => s.statutAgrement === filter);
    }

    if (q) {
      list = list.filter(s => 
        (s.nom && s.nom.toLowerCase().includes(q)) ||
        (s.numeroAgrement && s.numeroAgrement.toLowerCase().includes(q)) ||
        (s.nif && s.nif.toLowerCase().includes(q)) ||
        (s.telephone && s.telephone.includes(q))
      );
    }

    return list;
  });

  /**
   * Les 7 dossiers les plus récents correspondant aux critères
   */
  readonly dernieresSocietes = computed(() => {
    return this.filteredSocietes().slice(0, 7);
  });

  ngOnInit(): void {
    this.superAdminService.loadSocietes().subscribe();
    this.superAdminService.loadProgrammes().subscribe();
    this.superAdminService.loadParcelles().subscribe();
    this.superAdminService.loadUtilisateurs().subscribe();
  }

  readonly router = inject(Router);

  // --- ACTIONS QUICK VIEW ---
  ouvrirQuickView(soc: SocietePromotriceBackend): void {
    this.selectedSocieteForView.set(soc);
    this.isQuickViewModalOpen.set(true);
  }

  fermerQuickView(): void {
    this.isQuickViewModalOpen.set(false);
    this.selectedSocieteForView.set(null);
  }

  naviguerVersInstruction(societeId: number): void {
    this.router.navigate(['/admin/inscriptions-societes'], {
      queryParams: { focusSocieteId: societeId }
    });
  }
}
