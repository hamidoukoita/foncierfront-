import { computed, DestroyRef, inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { SocieteService } from './societe.service';

const RAFRAICHISSEMENT_MS = 60_000;

/** Nombre de notifications non lues de la société connectée, rafraîchi chaque minute. */
@Injectable({ providedIn: 'root' })
export class CompteurNotificationsService {
  private readonly societeService = inject(SocieteService);
  private readonly authService = inject(AuthService);
  private minuterie: ReturnType<typeof setInterval> | null = null;

  readonly nonLues = computed(() => this.societeService.notifications().filter((n) => n.nonLu).length);

  /** Lance le suivi (une seule fois) ; l'arrête quand le composant appelant est détruit. */
  suivre(destroyRef: DestroyRef): void {
    if (this.minuterie || this.authService.isPlatformAdmin()) return;
    const charger = () => this.societeService.getNotifications().subscribe({ error: () => undefined });
    charger();
    this.minuterie = setInterval(charger, RAFRAICHISSEMENT_MS);
    destroyRef.onDestroy(() => {
      if (this.minuterie) clearInterval(this.minuterie);
      this.minuterie = null;
    });
  }
}
