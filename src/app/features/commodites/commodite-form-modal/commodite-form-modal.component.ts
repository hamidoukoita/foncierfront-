import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommoditeService } from '../../../core/services/commodite.service';
import { ToastService } from '../../../core/services/toast.service';
import { Commodite, TypeCommodite } from '../../../core/models/commodite.models';
import { messageErreurApi } from '../../../core/utils/api-error';

/** Création / modification d'une commodité de la société (type + GPS facultatif). */
@Component({
  selector: 'app-commodite-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './commodite-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommoditeFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly commoditeService = inject(CommoditeService);
  private readonly toast = inject(ToastService);

  readonly commodite = input<Commodite | null>(null);
  readonly types = input.required<TypeCommodite[]>();
  readonly closed = output<void>();

  readonly isSubmitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    typeCommoditeId: this.fb.control<number | null>(null, Validators.required),
    description: ['', [Validators.maxLength(255)]],
    latitude: this.fb.control<number | null>(null, [Validators.min(-90), Validators.max(90)]),
    longitude: this.fb.control<number | null>(null, [Validators.min(-180), Validators.max(180)]),
  });

  constructor() {
    effect(() => {
      const c = this.commodite();
      this.form.reset({
        nom: c?.nom ?? '',
        typeCommoditeId: c?.typeCommoditeId ?? null,
        description: c?.description ?? '',
        latitude: c?.latitude ?? null,
        longitude: c?.longitude ?? null,
      });
    });
  }

  fermer(): void {
    if (!this.isSubmitting()) this.closed.emit();
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const enEdition = this.commodite();
    this.isSubmitting.set(true);
    this.commoditeService
      .saveCommodite(
        {
          nom: v.nom.trim(),
          typeCommoditeId: v.typeCommoditeId!,
          description: v.description.trim(),
          latitude: v.latitude,
          longitude: v.longitude,
        },
        enEdition?.id,
      )
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.toast.success(enEdition ? 'Commodité modifiée' : 'Commodité ajoutée', v.nom);
          this.closed.emit();
        },
        error: (e) => {
          this.isSubmitting.set(false);
          this.toast.error('Enregistrement impossible', messageErreurApi(e, 'Vérifiez les informations saisies.'));
        },
      });
  }
}
