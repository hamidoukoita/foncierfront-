import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Déclinaisons du logo officiel, servies depuis public/images. */
const LOGOS = {
  /** Emblème au-dessus du mot « Foncier + » : pages d'accès (connexion, inscription…). */
  complet: 'images/logo-foncier.svg',
  /** Emblème et mot côte à côte : barres de navigation. */
  horizontal: 'images/logo-horizontal.svg',
  /** Emblème seul. */
  embleme: 'images/logo-embleme.svg',
} as const;

export type VarianteLogo = keyof typeof LOGOS;

const HAUTEURS: Record<VarianteLogo, Record<'sm' | 'md' | 'lg', string>> = {
  complet: { sm: 'h-12', md: 'h-16', lg: 'h-24' },
  horizontal: { sm: 'h-7', md: 'h-9', lg: 'h-11' },
  embleme: { sm: 'h-7', md: 'h-9', lg: 'h-12' },
};

@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './logo.component.html',
  styleUrl: './logo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly variante = input<VarianteLogo>('horizontal');
  /** false : emblème seul, quelle que soit la variante. */
  readonly showText = input<boolean>(true);
  readonly subtitle = input<string>('');
  readonly isSuperAdmin = input<boolean>(false);
  readonly clickable = input<boolean>(false);
  readonly darkTheme = input<boolean>(false);

  private readonly varianteAffichee = computed<VarianteLogo>(() =>
    this.showText() ? this.variante() : 'embleme',
  );

  readonly src = computed(() => LOGOS[this.varianteAffichee()]);
  readonly hauteurClass = computed(() => HAUTEURS[this.varianteAffichee()][this.size()]);
  readonly centre = computed(() => this.varianteAffichee() === 'complet');
}
