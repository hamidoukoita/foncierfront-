import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { CommoditeService } from '../../../core/services/commodite.service';
import { ToastService } from '../../../core/services/toast.service';
import { TypeCommodite } from '../../../core/models/commodite.models';
import { messageErreurApi } from '../../../core/utils/api-error';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** Référentiel des types de commodités, géré par l'administrateur plateforme. */
@Component({
  selector: 'app-types-commodites',
  standalone: true,
  imports: [ReactiveFormsModule, MatIcon, ConfirmDialogComponent],
  templateUrl: './types-commodites.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypesCommoditesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly commoditeService = inject(CommoditeService);
  private readonly toast = inject(ToastService);

  readonly types = this.commoditeService.types;
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly isModalOpen = signal(false);
  readonly typeEnEdition = signal<TypeCommodite | null>(null);
  readonly typeASupprimer = signal<TypeCommodite | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.isLoading.set(true);
    this.commoditeService.loadTypes().subscribe({
      next: () => this.isLoading.set(false),
      error: (e) => {
        this.isLoading.set(false);
        this.toast.error('Chargement impossible', messageErreurApi(e, 'Types de commodités indisponibles.'));
      },
    });
  }

  ouvrir(type?: TypeCommodite): void {
    this.typeEnEdition.set(type ?? null);
    this.form.reset({ libelle: type?.libelle ?? '', description: type?.description ?? '' });
    this.isModalOpen.set(true);
  }

  fermer(): void {
    if (!this.isSubmitting()) this.isModalOpen.set(false);
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const enEdition = this.typeEnEdition();
    this.isSubmitting.set(true);
    this.commoditeService
      .saveType({ libelle: value.libelle.trim(), description: value.description.trim() }, enEdition?.id)
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isModalOpen.set(false);
          this.toast.success(enEdition ? 'Type modifié' : 'Type créé', value.libelle);
        },
        error: (e) => {
          this.isSubmitting.set(false);
          this.toast.error('Enregistrement impossible', messageErreurApi(e, 'Vérifiez le libellé.'));
        },
      });
  }

  confirmerSuppression(): void {
    const type = this.typeASupprimer();
    if (!type) return;
    this.typeASupprimer.set(null);
    this.commoditeService.deleteType(type.id).subscribe({
      next: () => this.toast.success('Type supprimé', type.libelle),
      error: (e) =>
        this.toast.error('Suppression impossible', messageErreurApi(e, 'Ce type est peut-être utilisé par des commodités.')),
    });
  }
}
