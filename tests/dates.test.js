/*
 * TESTS — manipulation des dates et des mois
 * Les pieges classiques (passage d'annee, mois de fevrier, annee bissextile)
 * sont verifies ici.
 */

import { describe, it, expect } from 'vitest';
import {
  moisDeLaDate,
  decalerMois,
  moisPrecedent,
  moisSuivant,
  nomDuMoisAffichage,
  nombreDeJoursDansLeMois,
  estUneDateValide,
} from '../src/utils/dates.js';

describe('moisDeLaDate', () => {
  it('extrait le mois d une date', () => {
    expect(moisDeLaDate('2026-03-15')).toBe('2026-03');
  });

  it('renvoie une chaine vide si la donnee est absente', () => {
    expect(moisDeLaDate(undefined)).toBe('');
    expect(moisDeLaDate('abc')).toBe('');
  });
});

describe('decalerMois', () => {
  it('avance et recule d un mois', () => {
    expect(moisSuivant('2026-03')).toBe('2026-04');
    expect(moisPrecedent('2026-03')).toBe('2026-02');
  });

  it('gere le passage d une annee a l autre', () => {
    expect(moisSuivant('2026-12')).toBe('2027-01');
    expect(moisPrecedent('2026-01')).toBe('2025-12');
  });

  it('gere un decalage de plusieurs mois', () => {
    expect(decalerMois('2026-01', 13)).toBe('2027-02');
    expect(decalerMois('2026-01', -13)).toBe('2024-12');
  });
});

describe('nomDuMoisAffichage', () => {
  it('donne un libelle lisible', () => {
    expect(nomDuMoisAffichage('2026-03')).toBe('mars 2026');
    expect(nomDuMoisAffichage('2026-08')).toBe('août 2026');
  });
});

describe('nombreDeJoursDansLeMois', () => {
  it('connait la longueur de chaque mois', () => {
    expect(nombreDeJoursDansLeMois('2026-01')).toBe(31);
    expect(nombreDeJoursDansLeMois('2026-04')).toBe(30);
    expect(nombreDeJoursDansLeMois('2026-02')).toBe(28);
  });

  it('gere les annees bissextiles', () => {
    expect(nombreDeJoursDansLeMois('2024-02')).toBe(29);
    expect(nombreDeJoursDansLeMois('2000-02')).toBe(29);
    expect(nombreDeJoursDansLeMois('1900-02')).toBe(28);
  });
});

describe('estUneDateValide', () => {
  it('accepte une date correcte', () => {
    expect(estUneDateValide('2026-03-15')).toBe(true);
    expect(estUneDateValide('2024-02-29')).toBe(true);
  });

  it('refuse une date impossible', () => {
    expect(estUneDateValide('2026-02-30')).toBe(false);
    expect(estUneDateValide('2026-13-01')).toBe(false);
    expect(estUneDateValide('2026-00-10')).toBe(false);
    expect(estUneDateValide('15/03/2026')).toBe(false);
    expect(estUneDateValide('')).toBe(false);
  });
});
