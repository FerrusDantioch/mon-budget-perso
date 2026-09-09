/*
 * TESTS — calculs du budget
 * Verifie surtout les seuils d'alerte (80 % orange, 95 % rouge, > 100 % depasse),
 * qui sont le coeur de l'application.
 */

import { describe, it, expect } from 'vitest';
import {
  totalDesDepenses,
  totalParCategorie,
  etatDeLaCategorie,
  resumeDuMois,
  donneesDuCamembert,
  rythmeDuMois,
} from '../src/utils/calculs.js';

const categories = [
  { id: 'alim', nom: 'Alimentation', couleur: '#2563eb', emoji: '🛒', plafondCentimes: 40000 },
  { id: 'transp', nom: 'Transport', couleur: '#0891b2', emoji: '🚌', plafondCentimes: 10000 },
  { id: 'loisirs', nom: 'Loisirs', couleur: '#db2777', emoji: '🎬', plafondCentimes: 0 },
];

const depenses = [
  { id: '1', date: '2026-03-02', mois: '2026-03', montantCentimes: 3500, categorieId: 'alim' },
  { id: '2', date: '2026-03-05', mois: '2026-03', montantCentimes: 1500, categorieId: 'alim' },
  { id: '3', date: '2026-03-07', mois: '2026-03', montantCentimes: 2000, categorieId: 'transp' },
];

describe('totalDesDepenses', () => {
  it('additionne les montants', () => {
    expect(totalDesDepenses(depenses)).toBe(7000);
  });

  it('renvoie zero pour une liste vide', () => {
    expect(totalDesDepenses([])).toBe(0);
  });
});

describe('totalParCategorie', () => {
  it('regroupe par categorie', () => {
    expect(totalParCategorie(depenses)).toEqual({ alim: 5000, transp: 2000 });
  });

  it('regroupe les depenses sans categorie', () => {
    const resultat = totalParCategorie([
      { montantCentimes: 500, categorieId: undefined },
    ]);
    expect(resultat['sans-categorie']).toBe(500);
  });
});

describe('etatDeLaCategorie — les seuils d alerte', () => {
  it('reste vert en dessous de 80 %', () => {
    const etat = etatDeLaCategorie(7900, 10000);
    expect(etat.pourcentage).toBe(79);
    expect(etat.niveau).toBe('ok');
  });

  it('passe en orange a exactement 80 %', () => {
    expect(etatDeLaCategorie(8000, 10000).niveau).toBe('attention');
  });

  it('reste orange jusqu a 94 %', () => {
    expect(etatDeLaCategorie(9400, 10000).niveau).toBe('attention');
  });

  it('reste coherent avec le pourcentage affiche', () => {
    // 94,99 % s'affiche "95 %" apres arrondi : le niveau doit donc etre
    // "critique", sinon l'utilisateur verrait "95 % — Attention".
    const etat = etatDeLaCategorie(9499, 10000);
    expect(etat.pourcentage).toBe(95);
    expect(etat.niveau).toBe('critique');
  });

  it('passe en rouge a exactement 95 %', () => {
    expect(etatDeLaCategorie(9500, 10000).niveau).toBe('critique');
  });

  it('reste critique a 100 % pile', () => {
    const etat = etatDeLaCategorie(10000, 10000);
    expect(etat.niveau).toBe('critique');
    expect(etat.reste).toBe(0);
    expect(etat.depassement).toBe(0);
  });

  it('signale le depassement au-dela de 100 %', () => {
    const etat = etatDeLaCategorie(12000, 10000);
    expect(etat.niveau).toBe('depasse');
    expect(etat.pourcentage).toBe(120);
    expect(etat.depassement).toBe(2000);
    expect(etat.reste).toBe(0);
  });

  it('calcule le reste a depenser', () => {
    expect(etatDeLaCategorie(3000, 10000).reste).toBe(7000);
  });

  it('gere l absence de plafond', () => {
    const etat = etatDeLaCategorie(5000, 0);
    expect(etat.niveau).toBe('sans-plafond');
    expect(etat.pourcentage).toBe(0);
  });
});

describe('resumeDuMois', () => {
  const plafonds = { alim: 40000, transp: 10000, loisirs: 0 };
  const resume = resumeDuMois(categories, depenses, plafonds);

  it('produit une ligne par categorie', () => {
    expect(resume.lignes).toHaveLength(3);
  });

  it('calcule les totaux du mois', () => {
    expect(resume.totalDepense).toBe(7000);
    expect(resume.totalPlafond).toBe(50000);
  });

  it('rattache chaque depense a sa categorie', () => {
    const alimentation = resume.lignes.find((l) => l.categorie.id === 'alim');
    expect(alimentation.depense).toBe(5000);
    expect(alimentation.nombreDeDepenses).toBe(2);
  });

  it('ne perd pas les depenses dont la categorie a ete supprimee', () => {
    const avecOrpheline = resumeDuMois(categories, [
      ...depenses,
      { id: '9', montantCentimes: 1000, categorieId: 'categorie-effacee' },
    ]);
    const orpheline = avecOrpheline.lignes.find((l) => l.categorie.id === 'sans-categorie');
    expect(orpheline).toBeDefined();
    expect(orpheline.depense).toBe(1000);
    expect(avecOrpheline.totalDepense).toBe(8000);
  });

  it('utilise le plafond habituel des categories si le mois n en a pas', () => {
    const sansPlafondsDuMois = resumeDuMois(categories, depenses, {});
    expect(sansPlafondsDuMois.totalPlafond).toBe(0);
  });
});

describe('donneesDuCamembert', () => {
  const resume = resumeDuMois(categories, depenses, { alim: 40000, transp: 10000 });
  const parts = donneesDuCamembert(resume);

  it('ecarte les categories sans depense', () => {
    expect(parts).toHaveLength(2);
    expect(parts.map((p) => p.id)).not.toContain('loisirs');
  });

  it('trie de la plus grosse part a la plus petite', () => {
    expect(parts[0].id).toBe('alim');
    expect(parts[1].id).toBe('transp');
  });

  it('calcule le pourcentage de chaque part', () => {
    expect(parts[0].part).toBe(71); // 5000 / 7000
    expect(parts[1].part).toBe(29); // 2000 / 7000
  });

  it('renvoie une liste vide si rien n a ete depense', () => {
    expect(donneesDuCamembert(resumeDuMois(categories, [], {}))).toHaveLength(0);
  });
});

describe('rythmeDuMois', () => {
  it('repartit ce qui reste sur les jours restants', () => {
    // 100 € depenses sur un budget de 300 €, le 10 d un mois de 30 jours.
    // Il reste 200 € pour 21 jours (le jour en cours compte) -> 9,52 €/jour.
    const resultat = rythmeDuMois(10000, 30000, 10, 30);
    expect(resultat.pertinent).toBe(true);
    expect(resultat.joursRestants).toBe(21);
    expect(resultat.disponibleParJour).toBe(952);
    expect(resultat.moyenneParJour).toBe(1000);
  });

  it('arrondit vers le bas pour ne pas encourager le depassement', () => {
    // 10 € pour 3 jours = 3,33 € (et non 3,34 €).
    expect(rythmeDuMois(0, 1000, 28, 30).disponibleParJour).toBe(333);
  });

  it('n affiche rien si aucun budget n est defini', () => {
    expect(rythmeDuMois(10000, 0, 10, 30).pertinent).toBe(false);
  });

  it('n affiche rien si le budget est deja depasse', () => {
    expect(rythmeDuMois(35000, 30000, 10, 30).pertinent).toBe(false);
  });

  it('compte encore le dernier jour du mois', () => {
    const resultat = rythmeDuMois(10000, 30000, 30, 30);
    expect(resultat.joursRestants).toBe(1);
    expect(resultat.disponibleParJour).toBe(20000);
  });

  it('ne divise pas par zero', () => {
    expect(rythmeDuMois(5000, 30000, 0, 30).pertinent).toBe(false);
    expect(rythmeDuMois(5000, 30000, 31, 30).pertinent).toBe(false);
  });
});
