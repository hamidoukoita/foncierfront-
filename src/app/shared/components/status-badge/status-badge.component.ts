import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusVariant = 
  | 'publie' 
  | 'brouillon' 
  | 'disponible' 
  | 'reserve' 
  | 'vendu' 
  | 'confirme' 
  | 'en_attente' 
  | 'annule' 
  | 'effectue' 
  | 'en_etude' 
  | 'devis_transmis' 
  | 'en_chantier' 
  | 'litige' 
  | 'actif' 
  | 'suspendu'
  | 'valide';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly label = input<string>('');

  private readonly normalized = computed(() => {
    return this.status().toLowerCase().replace(/[\s\-_()]/g, '');
  });

  readonly badgeClasses = computed(() => {
    const s = this.normalized();
    
    // Vert Émeraude var(--foncier-success) / Succès / Disponible / Publié / Validé
    if (s.includes('publie') || s.includes('disponible') || s.includes('confirme') || s.includes('valide') || s.includes('accepter') || s.includes('actif') || s.includes('btp')) {
      return 'bg-emerald-50 text-brand-success border border-emerald-200/60';
    }
    // Ambre var(--foncier-warning) / Réservé / En attente / Brouillon / En étude
    if (s.includes('brouillon') || s.includes('reserve') || s.includes('attente') || s.includes('etude')) {
      return 'bg-amber-50 text-brand-warning border border-amber-200/60';
    }
    // Rouge var(--foncier-danger) / Vendu / Annulé / Refusé / Suspendu
    if (s.includes('vendu') || s.includes('annule') || s.includes('refuse') || s.includes('refuser') || s.includes('suspendu') || s.includes('rejete')) {
      return 'bg-rose-50 text-brand-danger border border-rose-200/60';
    }
    // Bleu Marine var(--foncier-secondary) / Devis transmis / Chantier / Effectué
    if (s.includes('devis') || s.includes('chantier') || s.includes('effectue')) {
      return 'bg-slate-100 text-brand-secondary border border-slate-200';
    }
    // Noir Anthracite var(--foncier-litige) / Litige / Indisponible
    if (s.includes('litige') || s.includes('indisponible')) {
      return 'bg-brand-litige text-white border border-black shadow-xs';
    }

    return 'bg-gray-100 text-gray-800 border border-gray-200';
  });

  readonly dotClass = computed(() => {
    const s = this.normalized();
    if (s.includes('publie') || s.includes('disponible') || s.includes('confirme') || s.includes('valide') || s.includes('accepter') || s.includes('actif') || s.includes('btp')) {
      return 'bg-brand-success animate-pulse';
    }
    if (s.includes('brouillon') || s.includes('reserve') || s.includes('attente') || s.includes('etude')) {
      return 'bg-brand-primary animate-pulse';
    }
    if (s.includes('vendu') || s.includes('annule') || s.includes('refuse') || s.includes('refuser') || s.includes('suspendu') || s.includes('rejete')) {
      return 'bg-brand-danger';
    }
    if (s.includes('litige') || s.includes('indisponible')) {
      return 'bg-amber-400 animate-pulse';
    }
    return 'bg-slate-400';
  });

  readonly iconType = computed(() => {
    const s = this.normalized();
    if (s.includes('disponible') || s.includes('confirme') || s.includes('valide') || s.includes('actif')) return '✓';
    if (s.includes('reserve') || s.includes('attente')) return '⏳';
    if (s.includes('litige') || s.includes('indisponible')) return '⚠️';
    if (s.includes('vendu') || s.includes('annule') || s.includes('refuse')) return '✕';
    return '';
  });

  readonly defaultLabel = computed(() => {
    return this.status();
  });
}
