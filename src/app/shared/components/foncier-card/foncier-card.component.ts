import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/**
 * Carte commune aux programmes et aux parcelles.
 *
 * - Couverture : photo choisie (ou icône s'il n'y en a pas), avec accès direct
 *   au choix de la couverture et à la galerie.
 * - Corps : titre, localisation, outils à droite ([carte-outils]), contenu libre.
 * - Pied : deux actions de même taille ([carte-actions]).
 * - [carte-statut] : pastille de statut posée sur la couverture.
 */
@Component({
  selector: 'app-foncier-card',
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <article
      class="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[var(--shadow-card-hover)]"
    >
      <!-- Couverture -->
      <div class="relative h-52 shrink-0 overflow-hidden bg-brand-secondary">
        @if (aUneCouverture()) {
          <img
            [src]="couvertureUrl()"
            [alt]="titre()"
            loading="lazy"
            (error)="imageEnErreur.set(true)"
            class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20"></div>

          <!-- Actions de couverture, révélées au survol -->
          <div
            class="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-brand-secondary/45 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100"
          >
            <button type="button" (click)="couverture.emit()" class="cover-pill">
              <mat-icon>photo_camera</mat-icon> Changer la couverture
            </button>
            <button type="button" (click)="galerie.emit()" class="cover-pill" title="Galerie photos et 360°" aria-label="Galerie photos et 360°">
              <mat-icon>collections</mat-icon>
            </button>
          </div>
        } @else {
          <!-- Pas de photo : l'icône et une invitation claire à en ajouter -->
          <div class="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2A3D5C] to-[#1A2B4C]">
            <mat-icon class="!h-10 !w-10 !text-[40px] text-white/20">{{ icone() }}</mat-icon>
            <div class="relative z-10 flex items-center gap-2">
              <button type="button" (click)="couverture.emit()" class="cover-pill">
                <mat-icon>add_photo_alternate</mat-icon> Ajouter une couverture
              </button>
              <button type="button" (click)="galerie.emit()" class="cover-pill" title="Galerie photos et 360°" aria-label="Galerie photos et 360°">
                <mat-icon>collections</mat-icon>
              </button>
            </div>
          </div>
        }

        <div class="pointer-events-none absolute left-3 top-3"><ng-content select="[carte-statut]" /></div>
        @if (nombrePanoramas() > 0) {
          <span class="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <mat-icon class="!h-3.5 !w-3.5 !text-[14px]">360</mat-icon>
            {{ nombrePanoramas() }} vue{{ nombrePanoramas() > 1 ? 's' : '' }}
          </span>
        }
        @if (reference() && aUneCouverture()) {
          <div class="pointer-events-none absolute bottom-3 left-4 right-4 text-white">
            <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">{{ surTitre() }}</p>
            <p class="truncate font-mono text-xs font-bold">{{ reference() }}</p>
          </div>
        }
      </div>

      <!-- Corps -->
      <div class="flex flex-1 flex-col gap-3.5 px-[18px] pt-4 pb-3.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-base font-bold leading-snug text-brand-secondary">{{ titre() }}</h2>
            @if (sousTitre()) {
              <p class="mt-1 flex items-center gap-1 truncate text-xs text-gray-500">
                <mat-icon class="!h-3.5 !w-3.5 shrink-0 !text-[14px] text-brand-primary">place</mat-icon>
                {{ sousTitre() }}
              </p>
            }
            @if (reference() && !aUneCouverture()) {
              <p class="mt-1 truncate font-mono text-[11px] text-gray-400">{{ surTitre() }} · {{ reference() }}</p>
            }
          </div>
          <div class="-mr-1 flex shrink-0 items-center gap-0.5"><ng-content select="[carte-outils]" /></div>
        </div>
        <ng-content />
      </div>

      <!-- Pied : deux actions de même taille -->
      <div class="grid grid-cols-2 gap-2 px-[18px] pb-[18px]"><ng-content select="[carte-actions]" /></div>
    </article>
  `,
  styles: `
    .cover-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 13px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.96);
      color: var(--foncier-secondary);
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
      cursor: pointer;
      transition: transform 0.15s, background 0.15s;
    }
    .cover-pill:hover { transform: translateY(-1px); background: #fff; }
    .cover-pill:focus-visible { outline: 2px solid var(--foncier-primary); outline-offset: 2px; }
    .cover-pill mat-icon { width: 16px; height: 16px; font-size: 16px; color: var(--foncier-primary); }
  `,
})
export class FoncierCardComponent {
  readonly titre = input.required<string>();
  readonly sousTitre = input<string>('');
  readonly couvertureUrl = input<string | null>(null);
  /** Icône Material affichée uniquement en l'absence de photo de couverture. */
  readonly icone = input<string>('holiday_village');
  readonly surTitre = input<string>('');
  readonly reference = input<string>('');
  readonly nombrePanoramas = input<number>(0);

  /** Ouvre le choix de la photo de couverture. */
  readonly couverture = output<void>();
  /** Ouvre la galerie complète (photos, panoramas 360°, visites). */
  readonly galerie = output<void>();

  readonly imageEnErreur = signal(false);

  aUneCouverture(): boolean {
    return !!this.couvertureUrl() && !this.imageEnErreur();
  }
}
