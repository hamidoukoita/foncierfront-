import { VisiteRendezVous } from '../../core/models/societe.models';

export interface JourAgenda {
  cle: string;
  libelle: string;
  estAujourdhui: boolean;
  visites: VisiteRendezVous[];
}

const JOUR_MS = 86_400_000;

export function dateVisite(v: VisiteRendezVous): Date | null {
  if (!v.dateIso) return null;
  const d = new Date(v.dateIso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function debutDuJour(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function cleJour(d: Date | null): string {
  return d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : 'sans-date';
}

function libelleJour(d: Date | null, maintenant: Date): string {
  if (!d) return 'Date non renseignée';
  const ecart = Math.round((debutDuJour(d) - debutDuJour(maintenant)) / JOUR_MS);
  if (ecart === 0) return 'Aujourd’hui';
  if (ecart === 1) return 'Demain';
  if (ecart === -1) return 'Hier';
  const texte = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Visite à venir (aujourd'hui inclus) ou passée. */
export function estAVenir(v: VisiteRendezVous, maintenant: Date): boolean {
  const d = dateVisite(v);
  return !!d && debutDuJour(d) >= debutDuJour(maintenant);
}

/** Planning : prochaines visites dans l'ordre chronologique, puis l'historique du plus récent au plus ancien. */
export function trierPourAgenda(liste: VisiteRendezVous[], maintenant: Date): VisiteRendezVous[] {
  const temps = (v: VisiteRendezVous) => dateVisite(v)?.getTime() ?? 0;
  const aVenir = liste.filter((v) => estAVenir(v, maintenant)).sort((a, b) => temps(a) - temps(b));
  const passees = liste.filter((v) => !estAVenir(v, maintenant)).sort((a, b) => temps(b) - temps(a));
  return [...aVenir, ...passees];
}

/** Regroupe une liste déjà triée par journée, en conservant l'ordre. */
export function grouperParJour(liste: VisiteRendezVous[], maintenant: Date): JourAgenda[] {
  const jours: JourAgenda[] = [];
  for (const v of liste) {
    const d = dateVisite(v);
    const cle = cleJour(d);
    let jour = jours.at(-1);
    if (jour?.cle !== cle) {
      jour = { cle, libelle: libelleJour(d, maintenant), estAujourdhui: cle === cleJour(maintenant), visites: [] };
      jours.push(jour);
    }
    jour.visites.push(v);
  }
  return jours;
}

/** Nombre de visites prévues entre aujourd'hui et les `jours` suivants. */
export function compterProchainsJours(liste: VisiteRendezVous[], maintenant: Date, jours: number): number {
  const debut = debutDuJour(maintenant);
  const fin = debut + jours * JOUR_MS;
  return liste.filter((v) => {
    const d = dateVisite(v);
    return !!d && d.getTime() >= debut && d.getTime() < fin;
  }).length;
}
