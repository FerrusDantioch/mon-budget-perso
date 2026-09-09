/*
 * TESTS — depenses recurrentes
 *
 * Les pieges verifies ici sont ceux qui font perdre ou dupliquer de l'argent :
 *   - le 31 d'un mois qui n'existe pas (fevrier, avril...) ;
 *   - le passage d'une annee a l'autre ;
 *   - le rattrapage apres plusieurs semaines sans ouvrir l'application ;
 *   - l'absence de doublon quand on ouvre l'application dix fois par jour.
 */

import { describe, it, expect } from 'vitest';

import {
  decrireRecurrence,
  impactSurLeMois,
  occurrencesEnRetard,
  occurrencesEntre,
  prochaineOccurrence,
} from '../src/utils/recurrences.js';

const LOYER = {
  libelle: 'Loyer',
  frequence: 'mensuelle',
  jour: 5,
  montantCentimes: 70000,
  dateDebut: '2026-01-01',
};

describe('frequence mensuelle', () => {
  it('tombe le meme jour chaque mois', () => {
    expect(occurrencesEntre(LOYER, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  it('ramene le 31 au dernier jour des mois plus courts', () => {
    const le31 = { ...LOYER, jour: 31 };
    expect(occurrencesEntre(le31, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28', // 2026 n'est pas bissextile
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('gere le 29 fevrier d’une annee bissextile', () => {
    const le29 = { ...LOYER, jour: 29, dateDebut: '2024-01-01' };
    expect(occurrencesEntre(le29, '2024-02-01', '2024-02-29')).toEqual(['2024-02-29']);
  });

  it('ne commence pas avant la date de debut', () => {
    const aPartirDeMars = { ...LOYER, dateDebut: '2026-03-10' };
    // Le 5 mars precede la date de debut : la premiere echeance est en avril.
    expect(occurrencesEntre(aPartirDeMars, '2026-01-01', '2026-05-31')).toEqual([
      '2026-04-05',
      '2026-05-05',
    ]);
  });

  it('s’arrete a la date de fin', () => {
    const termine = { ...LOYER, dateFin: '2026-03-31' };
    expect(occurrencesEntre(termine, '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
    ]);
  });

  it('traverse le changement d’annee', () => {
    expect(occurrencesEntre(LOYER, '2026-11-01', '2027-02-28')).toEqual([
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
      '2027-02-05',
    ]);
  });
});

describe('frequence bimensuelle (deux fois par mois)', () => {
  const salaire = {
    frequence: 'bimensuelle',
    jour: 1,
    jour2: 15,
    montantCentimes: 50000,
    dateDebut: '2026-01-01',
  };

  it('tombe deux fois par mois, dans l’ordre', () => {
    expect(occurrencesEntre(salaire, '2026-01-01', '2026-02-28')).toEqual([
      '2026-01-01',
      '2026-01-15',
      '2026-02-01',
      '2026-02-15',
    ]);
  });

  it('ramene aussi les jours trop grands au dernier jour du mois', () => {
    const bizarre = { ...salaire, jour: 15, jour2: 31 };
    expect(occurrencesEntre(bizarre, '2026-02-01', '2026-02-28')).toEqual([
      '2026-02-15',
      '2026-02-28',
    ]);
  });
});

describe('frequence hebdomadaire', () => {
  const courses = {
    frequence: 'hebdomadaire',
    jourSemaine: 6, // samedi
    montantCentimes: 6000,
    dateDebut: '2026-03-01',
  };

  it('tombe chaque semaine le bon jour', () => {
    const dates = occurrencesEntre(courses, '2026-03-01', '2026-03-31');
    // Le 7 mars 2026 est un samedi.
    expect(dates).toEqual(['2026-03-07', '2026-03-14', '2026-03-21', '2026-03-28']);
  });

  it('commence au premier bon jour apres la date de debut', () => {
    const dates = occurrencesEntre({ ...courses, dateDebut: '2026-03-08' }, '2026-03-01', '2026-03-20');
    expect(dates[0]).toBe('2026-03-14');
  });
});

describe('frequence annuelle', () => {
  const assurance = {
    frequence: 'annuelle',
    jour: 15,
    moisDeLAnnee: 6,
    montantCentimes: 25000,
    dateDebut: '2025-01-01',
  };

  it('tombe une fois par an', () => {
    expect(occurrencesEntre(assurance, '2025-01-01', '2027-12-31')).toEqual([
      '2025-06-15',
      '2026-06-15',
      '2027-06-15',
    ]);
  });

  it('ne renvoie rien si le mois vise est hors de la periode', () => {
    expect(occurrencesEntre(assurance, '2026-01-01', '2026-05-31')).toEqual([]);
  });
});

describe('prochaineOccurrence', () => {
  it('trouve la prochaine echeance', () => {
    expect(prochaineOccurrence(LOYER, '2026-03-06')).toBe('2026-04-05');
    expect(prochaineOccurrence(LOYER, '2026-03-05')).toBe('2026-03-05');
  });

  it('ne renvoie rien pour une recurrence suspendue', () => {
    expect(prochaineOccurrence({ ...LOYER, suspendue: true }, '2026-03-01')).toBeNull();
  });

  it('ne renvoie rien pour une recurrence terminee', () => {
    expect(prochaineOccurrence({ ...LOYER, dateFin: '2026-02-28' }, '2026-03-01')).toBeNull();
  });

  it('trouve une echeance annuelle meme loin dans l’annee', () => {
    const assurance = {
      frequence: 'annuelle',
      jour: 15,
      moisDeLAnnee: 6,
      dateDebut: '2025-01-01',
    };
    expect(prochaineOccurrence(assurance, '2026-07-01')).toBe('2027-06-15');
  });
});

describe('occurrencesEnRetard — le rattrapage', () => {
  it('renvoie toutes les echeances manquees', () => {
    // L'application n'a pas ete ouverte depuis janvier.
    const enRetard = { ...LOYER, derniereGeneration: '2026-01-05' };
    expect(occurrencesEnRetard(enRetard, '2026-04-10')).toEqual([
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  it('ne cree jamais deux fois la meme echeance', () => {
    const aJour = { ...LOYER, derniereGeneration: '2026-04-05' };
    expect(occurrencesEnRetard(aJour, '2026-04-05')).toEqual([]);
    expect(occurrencesEnRetard(aJour, '2026-04-30')).toEqual([]);
  });

  it('part de la date de debut la toute premiere fois', () => {
    expect(occurrencesEnRetard(LOYER, '2026-02-10')).toEqual(['2026-01-05', '2026-02-05']);
  });

  it('ne genere rien pour une recurrence suspendue', () => {
    const suspendue = { ...LOYER, suspendue: true, derniereGeneration: '2026-01-05' };
    expect(occurrencesEnRetard(suspendue, '2026-06-01')).toEqual([]);
  });

  it('ne genere rien avant la premiere echeance', () => {
    const future = { ...LOYER, dateDebut: '2027-01-01' };
    expect(occurrencesEnRetard(future, '2026-06-01')).toEqual([]);
  });
});

describe('impactSurLeMois', () => {
  it('compte les echeances et leur total', () => {
    const impact = impactSurLeMois(LOYER, '2026-03');
    expect(impact.nombre).toBe(1);
    expect(impact.total).toBe(70000);
  });

  it('additionne les deux echeances d’une recurrence bimensuelle', () => {
    const impact = impactSurLeMois(
      { frequence: 'bimensuelle', jour: 1, jour2: 15, montantCentimes: 50000, dateDebut: '2026-01-01' },
      '2026-03'
    );
    expect(impact.nombre).toBe(2);
    expect(impact.total).toBe(100000);
  });

  it('compte les quatre ou cinq echeances d’une recurrence hebdomadaire', () => {
    const impact = impactSurLeMois(
      { frequence: 'hebdomadaire', jourSemaine: 1, montantCentimes: 6000, dateDebut: '2026-01-01' },
      '2026-03'
    );
    // Mars 2026 contient cinq lundis (2, 9, 16, 23, 30).
    expect(impact.nombre).toBe(5);
    expect(impact.total).toBe(30000);
  });

  it('renvoie zero quand aucune echeance ne tombe dans le mois', () => {
    const impact = impactSurLeMois(
      { frequence: 'annuelle', jour: 15, moisDeLAnnee: 6, dateDebut: '2026-01-01' },
      '2026-03'
    );
    expect(impact.nombre).toBe(0);
    expect(impact.total).toBe(0);
  });
});

describe('decrireRecurrence', () => {
  it('decrit chaque frequence en francais', () => {
    expect(decrireRecurrence(LOYER)).toBe('Chaque mois, le 5');
    expect(decrireRecurrence({ frequence: 'hebdomadaire', jourSemaine: 6 })).toBe(
      'Chaque semaine, le samedi'
    );
    expect(decrireRecurrence({ frequence: 'bimensuelle', jour: 1, jour2: 15 })).toBe(
      'Deux fois par mois, le 1 et le 15'
    );
    expect(decrireRecurrence({ frequence: 'annuelle', jour: 15, moisDeLAnnee: 6 })).toBe(
      'Chaque année, le 15 juin'
    );
  });
});
