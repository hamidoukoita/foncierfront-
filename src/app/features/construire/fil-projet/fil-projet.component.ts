import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { ElementFil } from '../../../core/models/projet-echange.models';
import { FichierProjet } from '../../../core/models/societe.models';
import { CartePropositionComponent } from './carte-proposition.component';

/**
 * Fil d'échange avec l'acquéreur, vu par la société : ses messages à droite, ceux de l'acquéreur
 * à gauche, les propositions en cartes. La zone d'écriture reste en bas.
 */
@Component({
  selector: 'app-fil-projet',
  standalone: true,
  imports: [DatePipe, MatIcon, CartePropositionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-col' },
  template: `
    <div #defilement class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
      @if (chargement() && elements().length === 0) {
        <p class="py-10 text-center text-xs text-gray-400">Chargement de la discussion…</p>
      } @else if (elements().length === 0) {
        <div class="flex flex-col items-center px-6 py-10 text-center">
          <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
            <mat-icon>forum</mat-icon>
          </span>
          <p class="text-sm font-bold text-brand-secondary">Aucun échange pour l’instant</p>
          <p class="mt-1 max-w-xs text-xs text-gray-500">
            Posez une question à l’acquéreur ou faites-lui une proposition : une chambre plus grande, un garage, un autre modèle…
          </p>
        </div>
      }
      @for (e of elements(); track $index) {
        @if (e.type === 'MESSAGE') {
          @let m = e.message;
          <div class="flex" [class.justify-end]="m.cote === 'SOCIETE'">
            <div
              class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-xs"
              [class]="m.cote === 'SOCIETE' ? 'rounded-br-md bg-brand-secondary text-white' : 'rounded-bl-md border border-gray-100 bg-white text-gray-800'"
            >
              <p class="whitespace-pre-line leading-relaxed">{{ m.texte }}</p>
              <p class="mt-1 text-[10px]" [class]="m.cote === 'SOCIETE' ? 'text-white/60' : 'text-gray-400'">
                {{ m.auteurNom }} · {{ m.dateEnvoi | date: 'd MMM, HH:mm' }}
              </p>
            </div>
          </div>
        } @else {
          <app-carte-proposition [proposition]="e.proposition" (ouvrirFichier)="ouvrirFichier.emit($event)" />
        }
      }
    </div>

    @if (peutEcrire()) {
      <form class="flex items-end gap-2 border-t border-gray-100 bg-white px-3 py-3" (submit)="$event.preventDefault(); envoyer()">
        <textarea
          rows="2"
          [value]="texte()"
          (input)="texte.set($any($event.target).value)"
          (keydown.control.enter)="envoyer()"
          maxlength="2000"
          placeholder="Écrire à l’acquéreur… (Ctrl + Entrée pour envoyer)"
          aria-label="Message à l’acquéreur"
          class="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
        ></textarea>
        <button type="submit" class="bouton bouton-primaire" [disabled]="envoi() || !texte().trim()" aria-label="Envoyer">
          <mat-icon>send</mat-icon>
        </button>
      </form>
    } @else {
      <p class="border-t border-gray-100 px-4 py-3 text-center text-xs text-gray-400">La discussion est close.</p>
    }
  `,
})
export class FilProjetComponent {
  readonly elements = input.required<ElementFil[]>();
  readonly chargement = input(false);
  readonly peutEcrire = input(true);
  readonly envoi = input(false);
  readonly message = output<string>();
  readonly ouvrirFichier = output<FichierProjet>();

  readonly texte = signal('');
  private readonly defilement = viewChild<ElementRef<HTMLElement>>('defilement');

  constructor() {
    // Le dernier échange reste visible quand le fil s'allonge.
    effect(() => {
      this.elements();
      const zone = this.defilement()?.nativeElement;
      if (zone) queueMicrotask(() => (zone.scrollTop = zone.scrollHeight));
    });
  }

  envoyer(): void {
    const t = this.texte().trim();
    if (!t || this.envoi()) return;
    this.message.emit(t);
  }

  /** Appelé par la page une fois le message enregistré. */
  vider(): void {
    this.texte.set('');
  }
}
