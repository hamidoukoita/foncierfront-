import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { CommoditeService } from '../../core/services/commodite.service';
import { SocieteService } from '../../core/services/societe.service';
import { ToastService } from '../../core/services/toast.service';
import { Commodite, ProximiteCommodite } from '../../core/models/commodite.models';
import { messageErreurApi } from '../../core/utils/api-error';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { CommoditeFormModalComponent } from './commodite-form-modal/commodite-form-modal.component';
import { RattachementFormModalComponent } from './rattachement-form-modal/rattachement-form-modal.component';

/**
 * Commodités de proximité de la société : référencement (type + GPS)
 * et rattachement aux cités / parcelles avec la distance.
 * Les équipements internes d'une cité se dessinent dans le studio de plan de masse.
 */
@Component({
  selector: 'app-commodites',
  standalone: true,
  imports: [DecimalPipe, MatIcon, ConfirmDialogComponent, CommoditeFormModalComponent, RattachementFormModalComponent],
  templateUrl: './commodites.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommoditesComponent implements OnInit {
  private readonly commoditeService = inject(CommoditeService);
  private readonly societeService = inject(SocieteService);
  private readonly toast = inject(ToastService);

  readonly types = this.commoditeService.types;
  readonly commodites = this.commoditeService.commodites;
  readonly proximites = this.commoditeService.proximites;
  readonly programmes = this.societeService.programmes;
  readonly parcelles = this.societeService.parcelles;

  readonly isLoading = signal(false);

  // Modales : undefined = fermée, null = création, objet = modification
  readonly commoditeEnEdition = signal<Commodite | null | undefined>(undefined);
  readonly proximiteEnEdition = signal<ProximiteCommodite | null | undefined>(undefined);

  readonly commoditeASupprimer = signal<Commodite | null>(null);
  readonly proximiteASupprimer = signal<ProximiteCommodite | null>(null);

  /** Nombre de rattachements par commodité. */
  readonly usages = computed(() => {
    const compte = new Map<number, number>();
    for (const p of this.proximites()) {
      compte.set(p.commodite.id, (compte.get(p.commodite.id) ?? 0) + 1);
    }
    return compte;
  });

  ngOnInit(): void {
    this.isLoading.set(true);
    forkJoin([
      this.commoditeService.loadTypes(),
      this.commoditeService.loadCommodites(),
      this.commoditeService.loadProximites(),
      this.societeService.getProgrammes(),
      this.societeService.getParcelles(),
    ]).subscribe({
      next: () => this.isLoading.set(false),
      error: (e) => {
        this.isLoading.set(false);
        this.toast.error('Chargement impossible', messageErreurApi(e, 'Commodités indisponibles.'));
      },
    });
  }

  ajouterRattachement(): void {
    if (this.commodites().length === 0) {
      this.toast.warning('Aucune commodité', 'Référencez d\'abord une commodité de proximité.');
      return;
    }
    this.proximiteEnEdition.set(null);
  }

  aGps(c: Commodite): boolean {
    return c.latitude != null && c.longitude != null;
  }

  confirmerSuppressionCommodite(): void {
    const c = this.commoditeASupprimer();
    if (!c) return;
    this.commoditeASupprimer.set(null);
    this.commoditeService.deleteCommodite(c.id).subscribe({
      next: () => this.toast.success('Commodité supprimée', c.nom),
      error: (e) => this.toast.error('Suppression impossible', messageErreurApi(e, 'Réessayez plus tard.')),
    });
  }

  confirmerSuppressionRattachement(): void {
    const p = this.proximiteASupprimer();
    if (!p) return;
    this.proximiteASupprimer.set(null);
    this.commoditeService.deleteProximite(p.id).subscribe({
      next: () => this.toast.success('Rattachement supprimé', p.commodite.nom),
      error: (e) => this.toast.error('Suppression impossible', messageErreurApi(e, 'Réessayez plus tard.')),
    });
  }
}
