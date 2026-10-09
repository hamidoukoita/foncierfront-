import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParcelleLot } from '../../../core/models/societe.models';

@Component({
  selector: 'app-plan-masse',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-masse.component.html',
  styleUrl: './plan-masse.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanMasseComponent {
  readonly lots = input.required<ParcelleLot[]>();
  readonly selectedLotId = input<number | null>(null);

  readonly lotSelected = output<ParcelleLot>();
  readonly actionLot = output<{ lot: ParcelleLot; action: 'RESERVER' | 'TOGGLE_LITIGE' | 'VOIR' }>();

  readonly activeFilter = signal<'ALL' | 'DISPONIBLE' | 'RESERVE' | 'VENDU' | 'INDISPONIBLE_LITIGE'>('ALL');
  private readonly _activeLot = signal<ParcelleLot | null>(null);
  readonly activeLot = this._activeLot.asReadonly();

  readonly filteredLots = computed(() => {
    const f = this.activeFilter();
    const all = this.lots();
    if (f === 'ALL') return all;
    return all.filter(l => l.statut === f);
  });

  countByStatus(status: 'DISPONIBLE' | 'RESERVE' | 'VENDU' | 'INDISPONIBLE_LITIGE'): number {
    return this.lots().filter(l => l.statut === status).length;
  }

  setFilter(f: 'ALL' | 'DISPONIBLE' | 'RESERVE' | 'VENDU' | 'INDISPONIBLE_LITIGE'): void {
    this.activeFilter.set(f);
  }

  onLotClick(lot: ParcelleLot): void {
    this._activeLot.set(lot);
    this.lotSelected.emit(lot);
  }

  getLotCardClass(lot: ParcelleLot): string {
    switch (lot.statut) {
      case 'DISPONIBLE':
        return 'bg-white border-emerald-200/80 hover:border-emerald-500 shadow-2xs';
      case 'RESERVE':
        return 'bg-amber-50/60 border-amber-300 hover:border-amber-500 shadow-2xs';
      case 'VENDU':
        return 'bg-rose-50/50 border-rose-200 opacity-80 hover:opacity-100 shadow-2xs';
      case 'INDISPONIBLE_LITIGE':
        return 'bg-gray-100 border-gray-400 text-gray-900 shadow-2xs';
      default:
        return 'bg-white border-gray-200';
    }
  }

  getLotDotClass(statut: string): string {
    switch (statut) {
      case 'DISPONIBLE': return 'bg-brand-success ring-2 ring-emerald-200';
      case 'RESERVE': return 'bg-brand-warning ring-2 ring-amber-200 animate-pulse';
      case 'VENDU': return 'bg-brand-danger ring-2 ring-rose-200';
      case 'INDISPONIBLE_LITIGE': return 'bg-brand-litige ring-2 ring-gray-300';
      default: return 'bg-gray-400';
    }
  }

  getLotBadgeClass(statut: string): string {
    switch (statut) {
      case 'DISPONIBLE': return 'bg-emerald-100 text-brand-success';
      case 'RESERVE': return 'bg-amber-100 text-brand-warning';
      case 'VENDU': return 'bg-rose-100 text-brand-danger';
      case 'INDISPONIBLE_LITIGE': return 'bg-gray-800 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  formatPrice(montant: number): string {
    return new Intl.NumberFormat('fr-FR').format(montant) + ' F';
  }
}
