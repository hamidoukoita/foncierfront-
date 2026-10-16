import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { DecompteReservation } from '../reservation-delai';

/** Pastille du temps restant d'une réservation dont le décompte est démarré. */
@Component({
  selector: 'app-delai-chip',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" [class]="classes()">
      <mat-icon class="!h-3.5 !w-3.5 !text-[14px]">{{ delai().niveau === 'depasse' ? 'timer_off' : 'timer' }}</mat-icon>
      {{ delai().libelle }}
    </span>
  `,
})
export class DelaiChipComponent {
  readonly delai = input.required<DecompteReservation>();

  readonly classes = computed(() => {
    switch (this.delai().niveau) {
      case 'depasse': return 'bg-gray-100 text-gray-500';
      case 'urgent': return 'bg-red-50 text-brand-danger';
      default: return 'bg-amber-50 text-brand-warning';
    }
  });
}
