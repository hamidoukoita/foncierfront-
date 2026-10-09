import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmText = input<string>('Confirmer');
  readonly cancelText = input<string>('Annuler');
  readonly variant = input<'danger' | 'warning' | 'primary'>('primary');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.cancelled.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    this.cancelled.emit();
  }
}
