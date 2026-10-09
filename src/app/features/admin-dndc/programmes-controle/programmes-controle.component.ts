import { ProgrammeQuickViewModalComponent } from '../../../shared/components/programme-quick-view-modal/programme-quick-view-modal.component';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

export interface BienSupervisionItem {
  id: number;
  designation: string;
  societeNom: string;
  localisation: string;
  titreFoncier: string;
  typologie: 'PROGRAMME' | 'PARCELLE';
  iconEmoji: string;
  statut: string;
  totalLots?: number;
  superficie?: number;
  prix?: number;
  eauSomapep?: boolean;
  electriciteEdm?: boolean;
  voirieBitumee?: boolean;
  dateCreation?: string;
  realId: number; // to keep original id for navigation
}

type SupervisionFilter = 'TOUS' | 'PROGRAMMES' | 'PARCELLES';


@Component({
  selector: 'app-programmes-controle',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    PaginationComponent,
    MatIconModule,
    MatButtonModule,
    MatRippleModule,
    ProgrammeQuickViewModalComponent
  ],
  templateUrl: './programmes-controle.component.html',
  styleUrl: './programmes-controle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgrammesControleComponent implements OnInit {
  private readonly superAdminService = inject(SuperAdminService);
  private readonly toast = inject(ToastService);

  readonly currentFilter = signal<SupervisionFilter>('TOUS');
  readonly selectedZone = signal<string>('TOUTES');
  readonly selectedPromoteur = signal<string>('TOUS');
  readonly searchTerm = signal<string>('');
  readonly currentPage = signal<number>(1);
  readonly pageSize = 7;

  // Modale Quick View
  readonly isQuickViewOpen = signal<boolean>(false);
  readonly selectedBienView = signal<BienSupervisionItem | null>(null);

  readonly programmes = this.superAdminService.programmes;
  readonly parcelles = this.superAdminService.parcelles;
  readonly societes = this.superAdminService.societes;

  /**
   * Consolidation de tous les biens sous supervision
   */
  readonly allBiens = computed<BienSupervisionItem[]>(() => {
    const listProg: BienSupervisionItem[] = this.programmes().map(p => ({
      id: p.id, // For track by
      realId: p.id,
      designation: p.nom,
      societeNom: p.societeNom || 'Société Promotrice',
      localisation: p.lieu || 'Bamako',
      titreFoncier: p.numeroTitreMere || 'TF Référencé',
      typologie: 'PROGRAMME',
      iconEmoji: '🏡',
      statut: p.statut || 'DISPONIBLE',
      totalLots: p.totalLots,
      superficie: p.superficieTotale,
      eauSomapep: p.eauSomapep,
      electriciteEdm: p.electriciteEdm,
      voirieBitumee: p.voirieBitumee,
      dateCreation: p.dateCreation
    }));

    const listParc: BienSupervisionItem[] = this.parcelles().map(p => ({
      id: p.id + 10000,
      realId: p.id,
      designation: `${p.reference || 'Lot'}`,
      societeNom: p.societeNom || 'Stock Diffus',
      localisation: 'Bamako & Environs',
      titreFoncier: p.numeroTitreFoncier || 'TF Certifié',
      typologie: 'PARCELLE',
      iconEmoji: '📐',
      statut: p.statut || 'DISPONIBLE',
      superficie: p.superficie,
      prix: p.prix,
      eauSomapep: p.eauSomapep,
      electriciteEdm: p.electriciteEdm,
      voirieBitumee: p.voieBitumee
    }));

    return [...listProg, ...listParc];
  });

  /**
   * Liste des promoteurs disponibles dynamiquement pour le filtre
   */
  readonly promoteursDisponibles = computed(() => {
    const noms = new Set<string>();
    this.allBiens().forEach(b => {
      if (b.societeNom) noms.add(b.societeNom);
    });
    return Array.from(noms).sort();
  });

  /**
   * Filtrage multi-critères
   */
  readonly filteredBiens = computed(() => {
    let list = this.allBiens();
    const filter = this.currentFilter();
    const promoteur = this.selectedPromoteur();
    const search = this.searchTerm().toLowerCase().trim();

    if (filter === 'PROGRAMMES') list = list.filter(b => b.typologie === 'PROGRAMME');
    if (filter === 'PARCELLES') list = list.filter(b => b.typologie === 'PARCELLE');

    if (promoteur !== 'TOUS') {
      list = list.filter(b => b.societeNom.toLowerCase() === promoteur.toLowerCase());
    }

    if (search) {
      list = list.filter(b => 
        (b.designation && b.designation.toLowerCase().includes(search)) || 
        (b.societeNom && b.societeNom.toLowerCase().includes(search)) ||
        (b.titreFoncier && b.titreFoncier.toLowerCase().includes(search)) ||
        (b.localisation && b.localisation.toLowerCase().includes(search))
      );
    }

    return list;
  });

  /**
   * Pagination réelle
   */
  readonly paginatedBiens = computed(() => {
    const list = this.filteredBiens();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  readonly countTous = computed(() => this.allBiens().length);
  readonly countProgrammes = computed(() => this.allBiens().filter(b => b.typologie === 'PROGRAMME').length);
  readonly countParcelles = computed(() => this.allBiens().filter(b => b.typologie === 'PARCELLE').length);

  ngOnInit(): void {
    this.superAdminService.loadProgrammes().subscribe();
    this.superAdminService.loadParcelles().subscribe();
    this.superAdminService.loadSocietes().subscribe();
  }

  setFilter(f: SupervisionFilter): void {
    this.currentFilter.set(f);
    this.currentPage.set(1);
  }

  genererRapportPdf(): void {
    const count = this.filteredBiens().length;
    this.toast.info('Génération en cours', `Synthèse cadastrale de ${count} biens générée avec succès.`);
  }

  voirDetailBien(b: BienSupervisionItem): void {
    this.selectedBienView.set(b);
    this.isQuickViewOpen.set(true);
  }

  fermerQuickView(): void {
    this.isQuickViewOpen.set(false);
    this.selectedBienView.set(null);
  }

  voirDetailBienComplet(id: number): void {
    this.fermerQuickView();
    // TODO: Implémenter la navigation vers la page de détails du bien (ex: /admin/programmes/:id)
    this.toast.info('Navigation', `Ouverture du dossier complet (ID: ${id}) en cours de développement...`);
  }
}
