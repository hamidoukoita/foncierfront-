import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './logo.component.html',
  styleUrl: './logo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showText = input<boolean>(true);
  readonly subtitle = input<string>('');
  readonly isSuperAdmin = input<boolean>(false);
  readonly clickable = input<boolean>(false);
  readonly darkTheme = input<boolean>(false);

  iconSizeClass(): string {
    switch (this.size()) {
      case 'sm': return 'w-8 h-8';
      case 'lg': return 'w-14 h-14';
      default: return 'w-10 h-10';
    }
  }

  textSizeClass(): string {
    switch (this.size()) {
      case 'sm': return 'text-lg';
      case 'lg': return 'text-2xl';
      default: return 'text-xl';
    }
  }
}
