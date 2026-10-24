import { FormControl } from '@angular/forms';
import { referenceTitreFoncier, titreFoncierComplet, titreFoncierValide } from './titre-foncier';

describe('titre-foncier', () => {
  it('ajoute le préfixe TF- sans le doubler', () => {
    expect(titreFoncierComplet('1024/Kati')).toBe('TF-1024/Kati');
    expect(titreFoncierComplet('tf 1024 / Kati')).toBe('TF-1024 / Kati');
    expect(titreFoncierComplet('TF-BKO-10294')).toBe('TF-BKO-10294');
    expect(titreFoncierComplet('T.F. n°1024')).toBe('TF-1024');
    expect(titreFoncierComplet('  ')).toBe('');
  });

  it('extrait la référence d’un numéro enregistré', () => {
    expect(referenceTitreFoncier('TF-15420-BK')).toBe('15420-BK');
  });

  it('refuse une référence sans lettre ni chiffre au début', () => {
    expect(titreFoncierValide(new FormControl('TF-/12'))).toEqual({ titreFoncier: true });
    expect(titreFoncierValide(new FormControl('TF-12'))).toBeNull();
    expect(titreFoncierValide(new FormControl(''))).toBeNull();
  });
});
