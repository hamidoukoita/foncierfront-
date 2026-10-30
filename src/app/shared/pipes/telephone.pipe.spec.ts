import { formaterTelephone, lienAppel } from './telephone.pipe';

describe('formaterTelephone', () => {
  it('affiche les numéros maliens sans indicatif, par paires', () => {
    expect(formaterTelephone('+22376123456')).toBe('76 12 34 56');
    expect(formaterTelephone('76123456')).toBe('76 12 34 56');
    expect(formaterTelephone('+22376123456', true)).toBe('+223 76 12 34 56');
  });

  it('affiche les numéros étrangers au format international', () => {
    expect(formaterTelephone('+33612345678')).toBe('+33 6 12 34 56 78');
    expect(formaterTelephone('+12025550143')).toBe('+1 202 555 0143');
  });

  it('reste neutre sur les valeurs vides ou illisibles', () => {
    expect(formaterTelephone(null)).toBe('');
    expect(formaterTelephone('abc')).toBe('abc');
  });

  it('donne un lien d’appel international', () => {
    expect(lienAppel('76123456')).toBe('tel:+22376123456');
    expect(lienAppel('+33612345678')).toBe('tel:+33612345678');
  });
});
