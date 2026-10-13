import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommoditeService } from '../../../core/services/commodite.service';
import { ToastService } from '../../../core/services/toast.service';
import { Commodite, ProximiteCommodite } from '../../../core/models/commodite.models';
import { ParcelleLot, Programme } from '../../../core/models/societe.models';
import { messageErreurApi } from '../../../core/utils/api-error';

export type CibleRattachement = 'CITE' | 'PARCELLE';

/** Rattache une commodité à une cité ou à une parcelle, avec sa distance en km. */
@Component({
  selector: 'app-rattachement-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './rattachement-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RattachementFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly commoditeService = inject(CommoditeService);
  private readonly toast = inject(ToastService);

  /** Rattachement existant : seule la distance est modifiable. */
  readonly proximite = input<ProximiteCommodite | null>(null);
  readonly commodites = input.required<Commodite[]>();
  readonly programmes = input.required<Programme[]>();
  readonly parcelles = input.required<ParcelleLot[]>();
  readonly closed = output<void>();

  readonly isSubmitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    cible: ['CITE' as CibleRattachement],
    programmeId: this.fb.control<number | null>(null),
    bienId: this.fb.control<number | null>(null),
    commoditeId: this.fb.control<number | null>(null, Validators.required),
    distanceKm: this.fb.control<number | null>(null, [Validators.min(0)]),
  });

  constructor() {
    effect(() => {
      const p = this.proximite();
      this.form.reset({
        cible: p?.bienId ? 'PARCELLE' : 'CITE',
        programmeId: p?.programmeId ?? null,
        bienId: p?.bienId ?? null,
        commoditeId: p?.commodite.id ?? null,
        distanceKm: p?.distanceKm ?? null,
      });
    });
  }

  get cible(): CibleRattachement {
    return this.form.controls.cible.value;
  }

  get cibleRenseignee(): boolean {
    const v = this.form.getRawValue();
    return this.cible === 'CITE' ? v.programmeId !== null : v.bienId !== null;
  }

  fermer(): void {
    if (!this.isSubmitting()) this.closed.emit();
  }

  enregistrer(): void {
    if (this.form.invalid || !this.cibleRenseignee) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const enEdition = this.proximite();
    this.isSubmitting.set(true);
    this.commoditeService
      .saveProximite(
        {
          commoditeId: v.commoditeId!,
          programmeId: v.cible === 'CITE' ? v.programmeId : null,
          bienId: v.cible === 'PARCELLE' ? v.bienId : null,
          distanceKm: v.distanceKm,
        },
        enEdition?.id,
      )
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.toast.success(enEdition ? 'Distance mise à jour' : 'Commodité rattachée');
          this.closed.emit();
        },
        error: (e) => {
          this.isSubmitting.set(false);
          this.toast.error('Rattachement impossible', messageErreurApi(e, 'Vérifiez la cible et la commodité.'));
        },
      });
  }
}
