import { StatutBien } from '../../core/models/maison.models';

export const STATUTS_MAISON: { valeur: StatutBien; libelle: string }[] = [
  { valeur: 'DISPONIBLE', libelle: 'Disponible' },
  { valeur: 'RESERVER', libelle: 'Réservée' },
  { valeur: 'VENDUE', libelle: 'Vendue' },
  { valeur: 'INDISPONIBLE', libelle: 'Indisponible' },
  { valeur: 'EN_LITIGE', libelle: 'En litige' },
];

export function libelleStatutMaison(statut: StatutBien): string {
  return STATUTS_MAISON.find((s) => s.valeur === statut)?.libelle ?? statut;
}

/** Équipements proposés en un clic dans le formulaire. */
export const EQUIPEMENTS_SUGGERES = [
  'Garage',
  'Jardin',
  'Cuisine équipée',
  'Climatisation',
  'Forage',
  'Panneaux solaires',
  'Terrasse',
  'Clôture',
] as const;
