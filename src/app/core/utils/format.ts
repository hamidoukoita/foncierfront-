const FORMAT_ENTIER = new Intl.NumberFormat('fr-FR');

/** 12 500 000 → « 12 500 000 FCFA ». */
export function formaterFcfa(montant: number): string {
  return `${FORMAT_ENTIER.format(montant)} FCFA`;
}

/** Montant abrégé pour les indicateurs : 45 200 000 → « 45,2 M ». */
export function formaterMontantCompact(montant: number): string {
  if (montant >= 1e9) return `${(montant / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md`;
  if (montant >= 1e6) return `${(montant / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  return FORMAT_ENTIER.format(montant);
}

/** « Awa Sangaré » → « AS ». */
export function initiales(nomComplet: string | undefined): string {
  return (nomComplet ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('');
}

/** Recherche insensible à la casse et aux accents. */
export function normaliser(texte: string | undefined | null): string {
  return (texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Durée en heures lisible : 48 → « 48 h », 120 → « 5 jours ». */
export function formaterDuree(heures: number): string {
  return heures > 72 && heures % 24 === 0 ? `${heures / 24} jours` : `${heures} h`;
}
