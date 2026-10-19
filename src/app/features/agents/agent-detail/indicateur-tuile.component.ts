import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type TonIndicateur = 'primaire' | 'succes' | 'alerte' | 'neutre';

const CLASSES_ICONE: Record<TonIndicateur, string> = {
  primaire: 'bg-brand-primary/10 text-brand-primary',
  succes: 'bg-brand-success/10 text-brand-success',
  alerte: 'bg-red-50 text-brand-danger',
  neutre: 'bg-gray-100 text-gray-500',
};

/** Tuile d'un indicateur : icône, valeur mise en avant et précision. */
@Component({
  selector: 'app-indicateur-tuile',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex h-full items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" [class]="classesIcone[ton()]">
        <mat-icon class="!h-[18px] !w-[18px] !text-[18px]">{{ icone() }}</mat-icon>
      </span>
      <div class="min-w-0">
        <p class="truncate text-xl font-extrabold leading-tight tracking-tight text-brand-secondary">{{ valeur() }}</p>
        <p class="text-[11px] font-semibold text-gray-600">{{ libelle() }}</p>
        @if (detail()) {
          <p class="mt-0.5 text-[10px] text-gray-400">{{ detail() }}</p>
        }
      </div>
    </div>
  `,
})
export class IndicateurTuileComponent {
  readonly icone = input.required<string>();
  readonly libelle = input.required<string>();
  readonly valeur = input.required<string | number>();
  readonly detail = input<string>('');
  readonly ton = input<TonIndicateur>('primaire');

  protected readonly classesIcone = CLASSES_ICONE;
}
