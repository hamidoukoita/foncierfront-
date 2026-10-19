import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { SocieteService } from './societe.service';

/** Rubriques du menu qui signalent leurs nouveautés par une bulle. */
export type Rubrique = 'reservations' | 'visites' | 'projets';

const ROUTES: Record<Rubrique, string> = {
  reservations: '/societe/reservations',
  visites: '/societe/visites',
  projets: '/societe/projets-construction',
};
const RAFRAICHISSEMENT_MS = 60_000;

/**
 * Nouveautés non vues par rubrique (nouvelles réservations, demandes de visite, projets) :
 * on retient, par navigateur et par utilisateur, le plus grand identifiant déjà vu ;
 * ouvrir la page d'une rubrique la marque comme vue et efface sa bulle.
 */
@Injectable({ providedIn: 'root' })
export class CompteurNouveautesService {
  private readonly societeService = inject(SocieteService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly url = signal(this.router.url);
  private readonly derniersVus = signal<Partial<Record<Rubrique, number>>>({});
  private minuterie: ReturnType<typeof setInterval> | null = null;

  private readonly identifiants = computed<Record<Rubrique, number[]>>(() => ({
    reservations: this.societeService.reservations().map((r) => r.id),
    visites: this.societeService.visites().map((v) => v.id),
    projets: this.societeService.projetsConstruction().map((p) => p.id),
  }));

  /** Nombre de nouveautés par route de menu. */
  readonly parRoute = computed<Record<string, number>>(() => {
    const ids = this.identifiants();
    const vus = this.derniersVus();
    const compte = (r: Rubrique) => {
      const vu = vus[r];
      return vu === undefined ? 0 : ids[r].filter((id) => id > vu).length;
    };
    return Object.fromEntries((Object.keys(ROUTES) as Rubrique[]).map((r) => [ROUTES[r], compte(r)]));
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.url.set(e.urlAfterRedirects));

    // Première fois : tout ce qui existe est considéré comme vu. Sur la page d'une rubrique : tout est vu.
    effect(() => {
      const ids = this.identifiants();
      const url = this.url();
      const vus = this.derniersVus();
      for (const r of Object.keys(ROUTES) as Rubrique[]) {
        const max = Math.max(0, ...ids[r]);
        const surLaPage = url.startsWith(ROUTES[r]);
        if ((vus[r] === undefined && ids[r].length > 0) || (surLaPage && (vus[r] ?? -1) < max)) {
          this.memoriser(r, max);
        }
      }
    });
  }

  /** Charge les compteurs mémorisés puis rafraîchit les données chaque minute. */
  suivre(destroyRef: DestroyRef): void {
    if (this.minuterie || this.authService.isPlatformAdmin()) return;
    this.derniersVus.set(this.lire());
    const charger = () => {
      this.societeService.getReservations().subscribe({ error: () => undefined });
      this.societeService.getVisites().subscribe({ error: () => undefined });
      this.societeService.getProjetsConstruction().subscribe({ error: () => undefined });
    };
    charger();
    this.minuterie = setInterval(charger, RAFRAICHISSEMENT_MS);
    destroyRef.onDestroy(() => {
      if (this.minuterie) clearInterval(this.minuterie);
      this.minuterie = null;
    });
  }

  private cle(): string {
    return `foncier.nouveautes.${this.authService.currentUser()?.id ?? 'anonyme'}`;
  }

  private lire(): Partial<Record<Rubrique, number>> {
    try {
      return JSON.parse(localStorage.getItem(this.cle()) ?? '{}');
    } catch {
      return {};
    }
  }

  private memoriser(rubrique: Rubrique, id: number): void {
    this.derniersVus.update((vus) => ({ ...vus, [rubrique]: id }));
    try {
      localStorage.setItem(this.cle(), JSON.stringify(this.derniersVus()));
    } catch {
      // Stockage indisponible (navigation privée) : les bulles restent valables pour la session.
    }
  }
}
