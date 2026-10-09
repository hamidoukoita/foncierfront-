import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocietePromotriceBackend } from '../../../core/models/backend.models';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-societe-quick-view-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatRippleModule
  ],
  templateUrl: './societe-quick-view-modal.component.html',
  styleUrl: './societe-quick-view-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocieteQuickViewModalComponent {
  
  societe = input<SocietePromotriceBackend | null>(null);
  isOpen = input<boolean>(false);
  
  closeModal = output<void>();
  openFullAudit = output<number>();

  onClose(): void {
    this.closeModal.emit();
  }

  onOpenAudit(): void {
    const soc = this.societe();
    if (soc) {
      this.openFullAudit.emit(soc.id);
    }
  }
}
