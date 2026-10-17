import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Petite bulle de compteur posée en haut à droite d'une icône (notifications non lues…).
 * L'élément parent doit être positionné (class « relative »). Rien n'est affiché à zéro.
 */
@Component({
  selector: 'app-pastille-compteur',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (valeur() > 0) {
      <span
        class="pointer-events-none absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
        [attr.aria-label]="libelle()"
      >
        {{ texte() }}
      </span>
    }
  `,
})
export class PastilleCompteurComponent {
  readonly valeur = input(0);
  readonly libelle = input('');

  /** Au-delà de 99, la bulle affiche « 99+ ». */
  readonly texte = computed(() => (this.valeur() > 99 ? '99+' : String(this.valeur())));
}
