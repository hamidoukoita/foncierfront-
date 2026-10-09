import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly icon = input<string>('📂');
  readonly title = input<string>('Aucune donnée trouvée');
  readonly message = input<string>('Aucun élément ne correspond aux critères de recherche actuels.');
}
