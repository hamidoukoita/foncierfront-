/** Entrée de navigation partagée par la sidebar (mobile) et la topbar (desktop). */
export interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
}

/** Menus de l'administration plateforme. */
export function navAdministration(societesEnAttente: number): NavItem[] {
  return [
    { label: "Vue d'ensemble", route: '/admin/dashboard', icon: 'dashboard' },
    {
      label: 'Inscriptions Promoteurs',
      route: '/admin/inscriptions-societes',
      badge: societesEnAttente > 0 ? societesEnAttente : undefined,
      icon: 'domain',
    },
    { label: 'Utilisateurs & Privilèges', route: '/admin/utilisateurs-roles', icon: 'people' },
    { label: 'Programmes & Cités', route: '/admin/controle-programmes', icon: 'holiday_village' },
    { label: 'Types de commodités', route: '/admin/types-commodites', icon: 'category' },
  ];
}

/** Menus de la société promotrice agréée. */
export const NAV_SOCIETE: NavItem[] = [
  { label: 'Tableau de bord', route: '/societe/dashboard', icon: 'dashboard' },
  { label: 'Programmes', route: '/societe/programmes', icon: 'holiday_village' },
  { label: 'Parcelles', route: '/societe/parcelles', icon: 'grid_view' },
  { label: 'Commodités', route: '/societe/commodites', icon: 'storefront' },
  { label: 'Réservations', route: '/societe/reservations', icon: 'assignment' },
  { label: 'Rendez-vous', route: '/societe/visites', icon: 'event' },
  { label: 'Gestion des Agents', route: '/societe/agents', icon: 'badge' },
  { label: 'Projets construction', route: '/societe/projets-construction', icon: 'engineering' },
  { label: 'Profil Société', route: '/societe/profil', icon: 'apartment' },
];
