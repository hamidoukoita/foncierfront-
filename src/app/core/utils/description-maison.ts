import {
  DescriptionMaison,
  LIBELLES_CUISINE,
  LIBELLES_EQUIPEMENT,
  LIBELLES_STYLE,
} from '../models/projet-echange.models';

/** « Plain-pied », « R+1 », « R+2 ». */
export function libelleNiveaux(niveaux: number | null | undefined): string | null {
  if (niveaux == null) return null;
  return niveaux <= 1 ? 'Plain-pied' : `R+${niveaux - 1}`;
}

function pluriel(n: number, singulier: string, plurielForme = singulier + 's'): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}

/** Caractéristiques lisibles d'une maison, dans l'ordre où un promoteur les lit. */
export function caracteristiquesMaison(d: DescriptionMaison | null | undefined): string[] {
  if (!d) return [];
  const lignes: string[] = [];
  const structure = [libelleNiveaux(d.nombreNiveaux), d.style ? LIBELLES_STYLE[d.style] : null]
    .filter(Boolean)
    .join(' · ');
  if (structure) lignes.push(structure);
  if (d.nombreChambres != null) {
    const suites = d.nombreSuites ? ` dont ${d.nombreSuites} avec salle de bain` : '';
    lignes.push(pluriel(d.nombreChambres, 'chambre') + suites);
  }
  // « 0 salle de bain » n'apporte rien : seuls les nombres positifs sont affichés.
  if (d.nombreSallesBain) lignes.push(pluriel(d.nombreSallesBain, 'salle de bain', 'salles de bain'));
  if (d.nombreSalons) lignes.push(pluriel(d.nombreSalons, 'salon'));
  if (d.salleAManger) lignes.push('Salle à manger');
  if (d.cuisine) lignes.push(LIBELLES_CUISINE[d.cuisine]);
  if (d.toilettesVisiteurs) lignes.push('Toilettes visiteurs');
  if (d.magasin) lignes.push('Magasin / débarras');
  if (d.placesGarage) lignes.push(`Garage ${pluriel(d.placesGarage, 'véhicule')}`);
  for (const e of d.equipements ?? []) lignes.push(LIBELLES_EQUIPEMENT[e]);
  if (d.surfaceHabitable) lignes.push(`${d.surfaceHabitable} m² habitables`);
  return lignes;
}
