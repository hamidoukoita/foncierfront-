import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Ligne « icône · libellé · valeur » des fiches de détail. La valeur peut être projetée. */
@Component({
  selector: 'app-info-ligne',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-start gap-3 py-2.5' },
  template: `
    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-bg text-gray-500">
      <mat-icon class="!h-[18px] !w-[18px] !text-[18px]">{{ icone() }}</mat-icon>
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">{{ libelle() }}</span>
      <span class="mt-0.5 block break-words text-sm font-semibold text-brand-secondary">
        {{ valeur() }}<ng-content />
      </span>
    </span>
  `,
})
export class InfoLigneComponent {
  readonly icone = input.required<string>();
  readonly libelle = input.required<string>();
  readonly valeur = input<string>('');
}
