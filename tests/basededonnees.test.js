/*
 * TESTS — enregistrement et relecture des donnees
 *
 * Ces tests utilisent « fake-indexeddb » : une base de donnees en memoire qui
 * se comporte comme celle du navigateur, mais disparait a la fin des tests.
 *
 * Le coffre est ouvert une fois pour toutes avec une cle tiree au hasard
 * (voir tests/aide.js) : tout ce qui est ecrit ici est donc reellement
 * chiffre, comme dans l'application.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import * as bdd from '../src/donnees/basededonnees.js';
import { ouvrirBase } from '../src/donnees/connexion.js';
import { genererLesEcheances } from '../src/donnees/generationRecurrences.js';
import { chiffrerLesDonneesEnClair, compterDonneesEnClair } from '../src/donnees/migration.js';
import { ouvrirCoffreDeTest } from './aide.js';

beforeAll(async () => {
  await ouvrirCoffreDeTest();
});

beforeEach(async () => {
  await bdd.effacerTout({ garderReglages: false });
});

describe('le contenu de la base est bien chiffre', () => {
  it('ne laisse apparaitre aucune donnee lisible dans le magasin', async () => {
    await bdd.ajouterDepense({
      date: '2026-03-10',
      montantCentimes: 4242,
      categorieId: 'x',
      note: 'Restaurant japonais',
    });

    // On lit la base « a la main », comme le ferait quelqu'un qui inspecte
    // le navigateur avec les outils de developpement.
    const base = await ouvrirBase();
    const lignes = await base.getAll('depenses');

    expect(lignes).toHaveLength(1);
    // Seul l'identifiant est en clair ; il ne dit rien de la depense.
    expect(Object.keys(lignes[0]).sort()).toEqual(['enveloppe', 'id']);
    expect(JSON.stringify(lignes[0])).not.toContain('Restaurant');
    expect(JSON.stringify(lignes[0])).not.toContain('4242');
  });
});

describe('premier lancement', () => {
  it('cree les categories de depart quand la base est vide', async () => {
    expect(await bdd.preparerLesDonneesInitiales()).toBe(true);

    const categories = await bdd.listerCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].nom).toBe('Alimentation');
  });

  it('ne recree pas les categories au lancement suivant', async () => {
    await bdd.preparerLesDonneesInitiales();
    const avant = (await bdd.listerCategories()).length;

    expect(await bdd.preparerLesDonneesInitiales()).toBe(false);
    expect((await bdd.listerCategories()).length).toBe(avant);
  });
});

describe('categories', () => {
  it('ajoute, modifie et supprime une categorie', async () => {
    const creee = await bdd.ajouterCategorie({
      nom: 'Animaux',
      couleur: '#059669',
      emoji: '🐾',
      plafondCentimes: 5000,
    });
    expect(creee.id).toBeTruthy();

    await bdd.modifierCategorie(creee.id, { nom: 'Chat', plafondCentimes: 6000 });
    const apres = (await bdd.listerCategories())[0];
    expect(apres.nom).toBe('Chat');
    expect(apres.plafondCentimes).toBe(6000);
    // Les champs non modifies sont conserves.
    expect(apres.emoji).toBe('🐾');

    await bdd.supprimerCategorie(creee.id);
    expect(await bdd.listerCategories()).toHaveLength(0);
  });

  it('conserve les depenses quand la categorie est supprimee', async () => {
    const categorie = await bdd.ajouterCategorie({ nom: 'Test', couleur: '#000', emoji: '❓' });
    await bdd.ajouterDepense({
      date: '2026-03-10',
      montantCentimes: 1000,
      categorieId: categorie.id,
    });

    await bdd.supprimerCategorie(categorie.id);

    const depenses = await bdd.listerDepensesDuMois('2026-03');
    expect(depenses).toHaveLength(1);
    expect(depenses[0].montantCentimes).toBe(1000);
  });
});

describe('depenses', () => {
  it('range automatiquement la depense dans le bon mois', async () => {
    await bdd.ajouterDepense({
      date: '2026-03-10',
      montantCentimes: 2500,
      categorieId: 'x',
      note: '  Marché  ',
    });

    const mars = await bdd.listerDepensesDuMois('2026-03');
    expect(mars).toHaveLength(1);
    expect(mars[0].mois).toBe('2026-03');
    expect(mars[0].note).toBe('Marché');
    expect(mars[0].type).toBe('depense');

    expect(await bdd.listerDepensesDuMois('2026-04')).toHaveLength(0);
  });

  it('change le mois de rattachement quand la date est modifiee', async () => {
    const creee = await bdd.ajouterDepense({
      date: '2026-03-31',
      montantCentimes: 1000,
      categorieId: 'x',
    });

    await bdd.modifierDepense(creee.id, { date: '2026-04-01' });

    expect(await bdd.listerDepensesDuMois('2026-03')).toHaveLength(0);
    expect(await bdd.listerDepensesDuMois('2026-04')).toHaveLength(1);
  });

  it('trie les depenses de la plus recente a la plus ancienne', async () => {
    await bdd.ajouterDepense({ date: '2026-03-01', montantCentimes: 100, categorieId: 'x' });
    await bdd.ajouterDepense({ date: '2026-03-20', montantCentimes: 200, categorieId: 'x' });
    await bdd.ajouterDepense({ date: '2026-03-10', montantCentimes: 300, categorieId: 'x' });

    const liste = await bdd.listerDepensesDuMois('2026-03');
    expect(liste.map((d) => d.date)).toEqual(['2026-03-20', '2026-03-10', '2026-03-01']);
  });

  it('enregistre un revenu', async () => {
    await bdd.ajouterDepense({
      date: '2026-03-01',
      montantCentimes: 180000,
      categorieId: null,
      note: 'Salaire',
      type: 'revenu',
    });
    const liste = await bdd.listerDepensesDuMois('2026-03');
    expect(liste[0].type).toBe('revenu');
  });

  it('supprime une depense', async () => {
    const creee = await bdd.ajouterDepense({
      date: '2026-03-10',
      montantCentimes: 1000,
      categorieId: 'x',
    });
    await bdd.supprimerDepense(creee.id);
    expect(await bdd.listerDepensesDuMois('2026-03')).toHaveLength(0);
  });
});

describe('budgets mensuels', () => {
  it('enregistre et relit les plafonds d’un mois', async () => {
    await bdd.enregistrerPlafondsDuMois('2026-03', { alim: 40000 });
    expect(await bdd.lirePlafondsDuMois('2026-03')).toEqual({ alim: 40000 });
    expect(await bdd.lirePlafondsDuMois('2026-04')).toBeNull();
  });

  it('utilise le plafond habituel de la categorie si le mois n’en a pas', () => {
    const categories = [
      { id: 'a', plafondCentimes: 10000 },
      { id: 'b', plafondCentimes: 20000 },
    ];

    expect(bdd.plafondsApplicables(categories, null)).toEqual({ a: 10000, b: 20000 });
    expect(bdd.plafondsApplicables(categories, { a: 50000 })).toEqual({ a: 50000, b: 20000 });
    // Un plafond mis volontairement a zero doit rester a zero.
    expect(bdd.plafondsApplicables(categories, { a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
});

describe('archive et historique', () => {
  it('liste les mois contenant des donnees, du plus recent au plus ancien', async () => {
    await bdd.ajouterDepense({ date: '2026-01-15', montantCentimes: 100, categorieId: 'x' });
    await bdd.ajouterDepense({ date: '2026-03-15', montantCentimes: 200, categorieId: 'x' });
    await bdd.enregistrerPlafondsDuMois('2026-05', { x: 1000 });

    expect(await bdd.moisAvecDonnees()).toEqual(['2026-05', '2026-03', '2026-01']);
  });

  it('separe les depenses des revenus dans les totaux mensuels', async () => {
    await bdd.ajouterDepense({ date: '2026-03-01', montantCentimes: 1000, categorieId: 'x' });
    await bdd.ajouterDepense({ date: '2026-03-15', montantCentimes: 2500, categorieId: 'y' });
    await bdd.ajouterDepense({
      date: '2026-03-02',
      montantCentimes: 180000,
      categorieId: null,
      type: 'revenu',
    });
    await bdd.ajouterDepense({ date: '2026-04-02', montantCentimes: 700, categorieId: 'x' });

    const totaux = await bdd.totauxParMois();
    expect(totaux).toEqual([
      { mois: '2026-04', total: 700, revenus: 0, nombre: 1 },
      { mois: '2026-03', total: 3500, revenus: 180000, nombre: 3 },
    ]);
  });
});

describe('depenses recurrentes', () => {
  it('enregistre une recurrence et genere ses echeances passees', async () => {
    const categorie = await bdd.ajouterCategorie({ nom: 'Logement', couleur: '#7c3aed', emoji: '🏠' });
    await bdd.ajouterRecurrence({
      libelle: 'Loyer',
      montantCentimes: 70000,
      categorieId: categorie.id,
      frequence: 'mensuelle',
      jour: 5,
      dateDebut: '2026-01-01',
    });

    const resultat = await genererLesEcheances('2026-03-10');
    expect(resultat.creees).toBe(3); // janvier, fevrier, mars

    const mars = await bdd.listerDepensesDuMois('2026-03');
    expect(mars).toHaveLength(1);
    expect(mars[0].note).toBe('Loyer');
    expect(mars[0].recurrenceId).toBeTruthy();
  });

  it('ne cree jamais de doublon, meme appelee plusieurs fois', async () => {
    await bdd.ajouterRecurrence({
      libelle: 'Abonnement',
      montantCentimes: 1299,
      categorieId: 'x',
      frequence: 'mensuelle',
      jour: 1,
      dateDebut: '2026-01-01',
    });

    await genererLesEcheances('2026-03-10');
    await genererLesEcheances('2026-03-10');
    await genererLesEcheances('2026-03-10');

    expect(await bdd.compterDepenses()).toBe(3);
  });

  it('ne genere rien pour une recurrence suspendue', async () => {
    const creee = await bdd.ajouterRecurrence({
      libelle: 'Salle de sport',
      montantCentimes: 3000,
      categorieId: 'x',
      frequence: 'mensuelle',
      jour: 1,
      dateDebut: '2026-01-01',
    });
    await bdd.modifierRecurrence(creee.id, { suspendue: true });

    expect((await genererLesEcheances('2026-06-01')).creees).toBe(0);
    expect(await bdd.compterDepenses()).toBe(0);
  });

  it('reprend la generation la ou elle s’etait arretee apres une suspension', async () => {
    const creee = await bdd.ajouterRecurrence({
      libelle: 'Loyer',
      montantCentimes: 70000,
      categorieId: 'x',
      frequence: 'mensuelle',
      jour: 5,
      dateDebut: '2026-01-01',
    });

    await genererLesEcheances('2026-02-10'); // janvier + fevrier
    await bdd.modifierRecurrence(creee.id, { suspendue: true });
    await genererLesEcheances('2026-05-10'); // rien
    expect(await bdd.compterDepenses()).toBe(2);

    await bdd.modifierRecurrence(creee.id, { suspendue: false });
    await genererLesEcheances('2026-05-10'); // mars, avril, mai
    expect(await bdd.compterDepenses()).toBe(5);
  });

  it('genere un revenu recurrent avec le bon type', async () => {
    await bdd.ajouterRecurrence({
      libelle: 'Salaire',
      montantCentimes: 200000,
      categorieId: null,
      type: 'revenu',
      frequence: 'mensuelle',
      jour: 28,
      dateDebut: '2026-01-01',
    });

    await genererLesEcheances('2026-01-31');
    const janvier = await bdd.listerDepensesDuMois('2026-01');
    expect(janvier[0].type).toBe('revenu');
  });

  it('supprime une recurrence sans toucher aux depenses deja creees', async () => {
    const creee = await bdd.ajouterRecurrence({
      libelle: 'Loyer',
      montantCentimes: 70000,
      categorieId: 'x',
      frequence: 'mensuelle',
      jour: 5,
      dateDebut: '2026-01-01',
    });
    await genererLesEcheances('2026-02-10');

    await bdd.supprimerRecurrence(creee.id);
    expect(await bdd.listerRecurrences()).toHaveLength(0);
    expect(await bdd.compterDepenses()).toBe(2);
  });

  it('supprime aussi les depenses quand on le demande', async () => {
    const creee = await bdd.ajouterRecurrence({
      libelle: 'Loyer',
      montantCentimes: 70000,
      categorieId: 'x',
      frequence: 'mensuelle',
      jour: 5,
      dateDebut: '2026-01-01',
    });
    // Une depense saisie a la main, qui ne doit PAS disparaitre.
    await bdd.ajouterDepense({ date: '2026-01-20', montantCentimes: 500, categorieId: 'x' });
    await genererLesEcheances('2026-02-10');

    const supprimees = await bdd.supprimerRecurrenceEtSesDepenses(creee.id);
    expect(supprimees).toBe(2);
    expect(await bdd.compterDepenses()).toBe(1);
  });
});

describe('reçus et images', () => {
  it('enregistre une image chiffree et la relit', async () => {
    const octets = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const id = await bdd.enregistrerImage(octets, 'image/jpeg');

    const relue = await bdd.lireImage(id);
    expect([...relue.octets]).toEqual([...octets]);
    expect(relue.typeMime).toBe('image/jpeg');

    // Verification directe : l'image stockee ne ressemble pas a l'originale.
    const base = await ouvrirBase();
    const ligne = await base.get('images', id);
    expect(ligne.enveloppe.iv).toBeDefined();
    // AES-GCM ajoute 16 octets de signature au contenu chiffre.
    expect(ligne.enveloppe.donnees.length).toBe(octets.length + 16);
    expect([...ligne.enveloppe.donnees].slice(0, 8)).not.toEqual([...octets]);
  });

  it('supprime l’image en meme temps que le reçu', async () => {
    const imageId = await bdd.enregistrerImage(new Uint8Array([9, 9, 9]), 'image/jpeg');
    const recu = await bdd.ajouterRecu({
      imageId,
      commercant: 'Boulangerie',
      montantCentimes: 320,
      date: '2026-03-01',
    });

    await bdd.supprimerRecu(recu.id);
    expect(await bdd.listerRecus()).toHaveLength(0);
    expect(await bdd.lireImage(imageId)).toBeNull();
  });

  it('mesure la place occupee par les images', async () => {
    expect(await bdd.tailleDesImages()).toBe(0);
    await bdd.enregistrerImage(new Uint8Array(1000), 'image/jpeg');
    expect(await bdd.tailleDesImages()).toBeGreaterThan(900);
  });
});

describe('reprise des donnees de l’ancienne version', () => {
  it('chiffre les enregistrements restes en clair', async () => {
    const base = await ouvrirBase();

    // On imite une ligne ecrite par la version 1 : l'objet metier lui-meme,
    // sans enveloppe.
    await base.put('depenses', {
      id: 'ancienne-1',
      date: '2026-02-14',
      mois: '2026-02',
      montantCentimes: 4500,
      categorieId: 'ancienne-categorie',
      note: 'Restaurant',
      creeLe: 1770000000000,
    });
    bdd.viderCache();

    expect(await compterDonneesEnClair()).toBe(1);

    const reprises = await chiffrerLesDonneesEnClair();
    expect(reprises).toBe(1);
    expect(await compterDonneesEnClair()).toBe(0);

    // La depense est toujours la, et desormais chiffree.
    const fevrier = await bdd.listerDepensesDuMois('2026-02');
    expect(fevrier).toHaveLength(1);
    expect(fevrier[0].note).toBe('Restaurant');
    expect(fevrier[0].montantCentimes).toBe(4500);

    const ligne = await base.get('depenses', 'ancienne-1');
    expect(ligne.enveloppe).toBeDefined();
    expect(JSON.stringify(ligne)).not.toContain('Restaurant');
  });

  it('ne fait rien quand tout est deja chiffre', async () => {
    await bdd.ajouterDepense({ date: '2026-03-01', montantCentimes: 100, categorieId: 'x' });
    expect(await compterDonneesEnClair()).toBe(0);
    expect(await chiffrerLesDonneesEnClair()).toBe(0);
  });
});

describe('reglages et effacement', () => {
  it('enregistre une preference', async () => {
    expect(await bdd.lireReglage('devise', 'EUR')).toBe('EUR');
    await bdd.ecrireReglage('devise', 'CHF');
    expect(await bdd.lireReglage('devise')).toBe('CHF');
  });

  it('efface toutes les donnees', async () => {
    await bdd.preparerLesDonneesInitiales();
    await bdd.ajouterDepense({ date: '2026-03-01', montantCentimes: 100, categorieId: 'x' });
    await bdd.enregistrerImage(new Uint8Array([1, 2, 3]), 'image/jpeg');

    await bdd.effacerTout();

    expect(await bdd.listerCategories()).toHaveLength(0);
    expect(await bdd.compterDepenses()).toBe(0);
    expect(await bdd.moisAvecDonnees()).toHaveLength(0);
    expect(await bdd.tailleDesImages()).toBe(0);
  });

  it('conserve les reglages d’affichage par defaut', async () => {
    await bdd.ecrireReglage('devise', 'CHF');
    await bdd.effacerTout(); // garderReglages vaut true par defaut
    expect(await bdd.lireReglage('devise')).toBe('CHF');
  });
});
