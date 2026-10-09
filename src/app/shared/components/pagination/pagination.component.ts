import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly currentPage = input<number>(1);
  readonly pageSize = input<number>(5);
  readonly totalItems = input<number>(0);
  readonly pageChange = output<number>();

  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems() / this.pageSize()));
  }

  pages(): number[] {
    const total = this.totalPages();
    const result: number[] = [];
    for (let i = 1; i <= Math.min(total, 5); i++) {
      result.push(i);
    }
    return result;
  }

  startItem(): number {
    if (this.totalItems() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  endItem(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.totalItems());
  }
}
