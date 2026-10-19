import { FormControl } from '@angular/forms';
import { chiffresTelephone, nomPersonne, telephoneMali, texteRequis, aujourdhuiIso, datePasseeOuJour } from './validateurs';

const erreurs = (validateur: typeof texteRequis, valeur: string) => validateur(new FormControl(valeur));

describe('validateurs', () => {
  it('texteRequis refuse le vide, les espaces et la ponctuation seule', () => {
    expect(erreurs(texteRequis, '')).toEqual({ required: true });
    expect(erreurs(texteRequis, '    ')).toEqual({ required: true });
    expect(erreurs(texteRequis, '---')).toEqual({ texteVide: true });
    expect(erreurs(texteRequis, 'SEMA SA')).toBeNull();
  });

  it('nomPersonne accepte les lettres accentuées, tirets et apostrophes, refuse les chiffres', () => {
    expect(erreurs(nomPersonne, 'Aïssata')).toBeNull();
    expect(erreurs(nomPersonne, "N'Diaye-Traoré")).toBeNull();
    expect(erreurs(nomPersonne, 'Moussa2')).toEqual({ nomPersonne: true });
  });

  it('datePasseeOuJour accepte aujourd’hui et le passé, refuse demain', () => {
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(datePasseeOuJour(new FormControl(aujourdhuiIso()))).toBeNull();
    expect(datePasseeOuJour(new FormControl('2020-01-15'))).toBeNull();
    expect(datePasseeOuJour(new FormControl(iso(demain)))).toEqual({ dateFuture: true });
  });

  it('telephoneMali exige 8 chiffres maliens, espaces tolérés', () => {
    expect(erreurs(telephoneMali, '76 12 34 56')).toBeNull();
    expect(erreurs(telephoneMali, '+223 76123456')).toBeNull();
    expect(erreurs(telephoneMali, '11111111')).toEqual({ telephoneMali: true });
    expect(erreurs(telephoneMali, '7612345')).toEqual({ telephoneMali: true });
    expect(chiffresTelephone('76 12 34 56')).toBe('76123456');
  });
});
