import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSkeletonComponent {
  readonly rows = input<number>(4);

  rowsArray(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }
}
