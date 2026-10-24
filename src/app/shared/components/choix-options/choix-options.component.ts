import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';

export interface OptionChoix<T> {
  valeur: T;
  libelle: string;
  icone?: string;
  description?: string;
}

/**
 * Choix unique en boutons, à la place d'une liste déroulante native (plus lisible et toujours cliquable).
 * « pastilles » : boutons en ligne ; « tuiles » : cartes avec icône et explication.
 * Un second clic sur l'option choisie la retire si [effacable] est vrai.
 */
@Component({
  selector: 'app-choix-options',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChoixOptionsComponent), multi: true }],
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="libelle()"
      [class]="presentation() === 'tuiles' ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'flex flex-wrap gap-2'"
    >
      @for (o of options(); track $index) {
        @let choisi = estChoisi(o.valeur);
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="choisi"
          [disabled]="desactive()"
          (click)="choisir(o.valeur)"
          class="cursor-pointer border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          [class]="
            (presentation() === 'tuiles' ? 'flex flex-col gap-1 rounded-xl p-3 ' : 'rounded-full px-3.5 py-2 text-xs font-semibold ') +
            (choisi
              ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
              : 'border-gray-200 bg-white text-gray-700 hover:border-brand-primary/40 hover:bg-brand-bg')
          "
        >
          @if (presentation() === 'tuiles') {
            <span class="flex items-center justify-between">
              <mat-icon class="!h-7 !w-7 !text-[28px]" [class]="choisi ? 'text-brand-primary' : 'text-brand-secondary'">{{ o.icone }}</mat-icon>
              @if (choisi) {
                <mat-icon class="!h-[18px] !w-[18px] !text-[18px] text-brand-primary">check_circle</mat-icon>
              }
            </span>
            <span class="text-sm font-bold text-brand-secondary">{{ o.libelle }}</span>
            @if (o.description) {
              <span class="text-[11px] leading-snug text-gray-500">{{ o.description }}</span>
            }
          } @else {
            {{ o.libelle }}
          }
        </button>
      }
    </div>
  `,
})
export class ChoixOptionsComponent<T> implements ControlValueAccessor {
  readonly options = input.required<OptionChoix<T>[]>();
  readonly presentation = input<'pastilles' | 'tuiles'>('pastilles');
  readonly effacable = input(true);
  readonly libelle = input<string | null>(null);

  readonly valeur = signal<T | null>(null);
  readonly desactive = signal(false);

  private changement: (v: T | null) => void = () => undefined;
  private touche: () => void = () => undefined;

  estChoisi(v: T): boolean {
    return this.valeur() === v;
  }

  choisir(v: T): void {
    const nouvelle = this.estChoisi(v) && this.effacable() ? null : v;
    this.valeur.set(nouvelle);
    this.changement(nouvelle);
    this.touche();
  }

  writeValue(v: T | null): void {
    this.valeur.set(v ?? null);
  }

  registerOnChange(fn: (v: T | null) => void): void {
    this.changement = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touche = fn;
  }

  setDisabledState(desactive: boolean): void {
    this.desactive.set(desactive);
  }
}
