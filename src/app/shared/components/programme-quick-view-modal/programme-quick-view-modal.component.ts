import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

// Reusing the interface from the parent component or recreating a compatible one
export interface BienSupervisionItem {
  id: number;
  designation: string;
  societeNom: string;
  localisation: string;
  titreFoncier: string;
  typologie: 'PROGRAMME' | 'PARCELLE';
  iconEmoji: string;
  statut: string;
  totalLots?: number;
  superficie?: number;
  prix?: number;
  eauSomapep?: boolean;
  electriciteEdm?: boolean;
  voirieBitumee?: boolean;
  dateCreation?: string;
  realId?: number;
}

@Component({
  selector: 'app-programme-quick-view-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatRippleModule
  ],
  templateUrl: './programme-quick-view-modal.component.html',
  styleUrl: './programme-quick-view-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgrammeQuickViewModalComponent {
  
  bien = input<BienSupervisionItem | null>(null);
  isOpen = input<boolean>(false);
  
  closeModal = output<void>();
  openFullAudit = output<number>();

  onClose(): void {
    this.closeModal.emit();
  }

  onOpenAudit(): void {
    const current = this.bien();
    if (current && current.realId) {
      this.openFullAudit.emit(current.realId);
    }
  }
}
