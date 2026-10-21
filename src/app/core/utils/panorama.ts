/** Rapport largeur / hauteur d'un panorama équirectangulaire (360° × 180°). */
export const RATIO_PANORAMA_360 = 2;
const TOLERANCE_RATIO = 0.15;
/** Côté maximal d'une texture affichée par la visionneuse : inutile d'envoyer plus grand. */
const LARGEUR_MAX = 8192;

/** Ce qu'il faut faire d'une image choisie comme panorama 360°. */
export type DiagnosticPanorama =
  | { cas: 'conforme' }
  /** Panorama de téléphone (plus large que 2:1) : on complète le haut et le bas. */
  | { cas: 'a-completer'; largeur: number; hauteur: number }
  /** Image trop haute pour être un panorama (photo classique). */
  | { cas: 'trop-etroite' };

export function diagnostiquerPanorama(largeur: number, hauteur: number): DiagnosticPanorama {
  const ratio = largeur / hauteur;
  if (Math.abs(ratio - RATIO_PANORAMA_360) <= TOLERANCE_RATIO) return { cas: 'conforme' };
  if (ratio < RATIO_PANORAMA_360) return { cas: 'trop-etroite' };
  const l = Math.min(largeur, LARGEUR_MAX);
  return { cas: 'a-completer', largeur: l, hauteur: Math.round(l / RATIO_PANORAMA_360) };
}

/**
 * Ramène un panorama plus large que 2:1 au format équirectangulaire : l'image est centrée
 * verticalement et les bandes du haut et du bas sont remplies par un flou de ses bords,
 * pour que la visionneuse 360° (web et mobile) l'affiche sans déformation.
 */
export async function completerPanorama(fichier: File, largeur: number, hauteur: number): Promise<File> {
  const image = await createImageBitmap(fichier);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');

    const hauteurImage = Math.round((image.height * largeur) / image.width);
    const y = Math.round((hauteur - hauteurImage) / 2);
    // Fond : l'image étirée sur toute la hauteur et floutée, prolonge ciel et sol en douceur.
    ctx.filter = `blur(${Math.max(8, Math.round(largeur / 80))}px)`;
    ctx.drawImage(image, 0, 0, largeur, hauteur);
    ctx.filter = 'none';
    ctx.drawImage(image, 0, y, largeur, hauteurImage);

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Conversion de l’image impossible');
    const nom = fichier.name.replace(/\.[^.]+$/, '') + '-360.jpg';
    return new File([blob], nom, { type: 'image/jpeg' });
  } finally {
    image.close();
  }
}
