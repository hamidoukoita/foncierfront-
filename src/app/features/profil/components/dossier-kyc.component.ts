import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { DocumentKycResponse, TypeDocumentKyc } from '../../../core/models/kyc.models';

/** Pièces KYC déposées par la société (agrément, NIF, RCCM…). */
@Component({
  selector: 'app-dossier-kyc',
  standalone: true,
  imports: [DatePipe, RouterLink, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-white rounded-2xl p-6 border border-gray-100/90 shadow-card space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-brand-secondary">Dossier KYC</h2>
          <p class="text-xs text-gray-500 mt-0.5">Pièces transmises pour l’homologation de votre agrément.</p>
        </div>
        <a routerLink="/societe/kyc-attente" class="text-[11px] font-bold text-brand-primary hover:underline shrink-0">
          Gérer le dossier
        </a>
      </div>

      @if (chargement()) {
        <p class="text-xs text-gray-400">Chargement des pièces…</p>
      } @else if (documents().length === 0) {
        <div class="p-4 rounded-xl border border-dashed border-gray-200 text-center">
          <mat-icon class="text-gray-300">upload_file</mat-icon>
          <p class="text-xs text-gray-500 mt-1">Aucune pièce déposée pour le moment.</p>
        </div>
      } @else {
        <ul class="space-y-2">
          @for (doc of documents(); track doc.id) {
            <li class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-brand-bg">
              <div class="w-10 h-10 rounded-lg bg-red-100 text-brand-danger font-extrabold text-[10px] flex items-center justify-center shrink-0">
                PDF
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-gray-900 truncate">{{ libelleType(doc.typeDocument) }}</p>
                <p class="text-[11px] text-gray-500 truncate">
                  {{ doc.nomOriginal }} · {{ taille(doc.tailleFichier) }} · {{ doc.dateAjout | date: 'dd/MM/yyyy' }}
                </p>
              </div>
              <mat-icon class="!text-base text-brand-success shrink-0">check_circle</mat-icon>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DossierKycComponent {
  readonly documents = input.required<DocumentKycResponse[]>();
  readonly chargement = input(false);

  private static readonly libelles: Record<TypeDocumentKyc, string> = {
    [TypeDocumentKyc.AGREMENT_MINISTERIEL]: 'Arrêté d’agrément ministériel',
    [TypeDocumentKyc.NIF]: 'Immatriculation fiscale (NIF)',
    [TypeDocumentKyc.RCCM]: 'Extrait RCCM',
    [TypeDocumentKyc.ATTESTATION_FISCALE]: 'Attestation fiscale',
  };

  libelleType(type: TypeDocumentKyc): string {
    return DossierKycComponent.libelles[type] ?? 'Document';
  }

  taille(octets: number): string {
    if (!octets) return '—';
    return octets >= 1_048_576 ? `${(octets / 1_048_576).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;
  }
}
