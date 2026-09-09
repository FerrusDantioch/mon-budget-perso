/*
 * TESTS — conversion et affichage des montants
 * Ce sont les calculs les plus sensibles : une erreur ici fausserait
 * l'integralite du budget.
 */

import { describe, it, expect } from 'vitest';
import {
  versCentimes,
  formaterMontant,
  centimesVersTexte,
} from '../src/utils/monnaie.js';

describe('versCentimes', () => {
  it('accepte la virgule francaise et le point', () => {
    expect(versCentimes('12,50')).toBe(1250);
    expect(versCentimes('12.50')).toBe(1250);
  });

  it('accepte un nombre entier', () => {
    expect(versCentimes('12')).toBe(1200);
    expect(versCentimes('0')).toBe(0);
  });

  it('ignore les espaces et le symbole euro', () => {
    expect(versCentimes(' 1 250,00 ')).toBe(125000);
    expect(versCentimes('12,50 €')).toBe(1250);
  });

  it('evite les erreurs d arrondi des nombres a virgule', () => {
    // 0,1 + 0,2 en centimes doit donner exactement 30.
    expect(versCentimes('0,10') + versCentimes('0,20')).toBe(30);
    expect(versCentimes('19,99')).toBe(1999);
    expect(versCentimes('1234,56')).toBe(123456);
  });

  it('refuse les saisies invalides', () => {
    expect(versCentimes('')).toBeNull();
    expect(versCentimes('abc')).toBeNull();
    expect(versCentimes('-5')).toBeNull();
    expect(versCentimes('1,234')).toBeNull(); // trois decimales
    expect(versCentimes(null)).toBeNull();
  });

  it('accepte aussi un nombre deja numerique', () => {
    expect(versCentimes(12.5)).toBe(1250);
    expect(versCentimes(-3)).toBeNull();
  });
});

describe('formaterMontant', () => {
  it('affiche un montant en euros', () => {
    const resultat = formaterMontant(1250, 'EUR');
    // Le separateur d'espace varie selon les systemes : on verifie l'essentiel.
    expect(resultat).toContain('12,50');
    expect(resultat).toContain('€');
  });

  it('affiche zero correctement', () => {
    expect(formaterMontant(0, 'EUR')).toContain('0,00');
  });

  it('ne plante pas avec une valeur absente', () => {
    expect(formaterMontant(undefined, 'EUR')).toContain('0,00');
  });
});

describe('centimesVersTexte', () => {
  it('prepare un montant pour un champ de saisie', () => {
    expect(centimesVersTexte(1250)).toBe('12,50');
    expect(centimesVersTexte(0)).toBe('0,00');
  });

  it('fait l aller-retour sans perte', () => {
    expect(versCentimes(centimesVersTexte(98765))).toBe(98765);
  });
});
