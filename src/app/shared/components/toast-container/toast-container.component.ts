import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastType } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  getToastBorderAndBg(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'border-brand-success/30 bg-emerald-50/90 text-emerald-900';
      case 'error':
        return 'border-brand-danger/30 bg-red-50/90 text-red-900';
      case 'warning':
        return 'border-brand-warning/30 bg-amber-50/90 text-amber-900';
      case 'info':
      default:
        return 'border-brand-secondary/20 bg-slate-50/90 text-slate-900';
    }
  }

  getIconClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'bg-brand-success text-white';
      case 'error':
        return 'bg-brand-danger text-white';
      case 'warning':
        return 'bg-brand-warning text-white';
      case 'info':
      default:
        return 'bg-brand-secondary text-white';
    }
  }
}
