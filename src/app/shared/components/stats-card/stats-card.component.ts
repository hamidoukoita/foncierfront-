import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CardAccentColor = 'blue' | 'green' | 'orange' | 'gray';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  templateUrl: './stats-card.component.html',
  styleUrl: './stats-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly subtext = input<string>('');
  readonly subtextBadge = input<boolean>(false);
  readonly accent = input<CardAccentColor>('blue');

  readonly borderAccentClass = computed(() => {
    switch (this.accent()) {
      case 'green': return 'border-l-4 border-l-[var(--foncier-success)]';
      case 'orange': return 'border-l-4 border-l-[var(--foncier-primary)]';
      case 'gray': return 'border-l-4 border-l-[#64748B]';
      case 'blue':
      default: return 'border-l-4 border-l-[var(--foncier-secondary)]';
    }
  });

  readonly dotColorClass = computed(() => {
    switch (this.accent()) {
      case 'green': return 'bg-brand-success';
      case 'orange': return 'bg-brand-primary';
      case 'gray': return 'bg-slate-500';
      default: return 'bg-brand-success';
    }
  });
}
