/*
 * TESTS — sauvegarde chiffree, restauration et export tableur
 *
 * Le point le plus important : un mauvais mot de passe doit ECHOUER
 * proprement, jamais renvoyer des donnees fantaisistes.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import * as bdd from '../src/donnees/basededonnees.js';
import {
  ErreurFichierInvalide,
  ErreurMotDePasse,
  creerExportCsv,
  creerSauvegardeChiffree,
  evaluerMotDePasse,
  lireSauvegarde,
  nomDeFichier,
  restaurerSauvegarde,
} from '../src/donnees/sauvegarde.js';
import { ouvrirCoffreDeTest } from './aide.js';

const MOT_DE_PASSE = 'phrase-de-passe-solide-2026';

beforeAll(async () => {
  await ouvrirCoffreDeTest();
});

beforeEach(async () => {
  await bdd.effacerTout({ garderReglages: false });
});

/** Cree un petit jeu de donnees representatif. */
async function remplirLaBase() {
  const categorie = await bdd.ajouterCategorie({
    nom: 'Alimentation',
    couleur: '#2563eb',
    emoji: '🛒',
    plafondCentimes: 40000,
  });

  await bdd.ajouterDepense({
    date: '2026-03-05',
    montantCentimes: 3520,
    categorieId: categorie.id,
    note: 'Courses « bio »',
  });
  await bdd.ajouterDepense({
    date: '2026-04-01',
    montantCentimes: 180000,
    categorieId: null,
    note: 'Salaire',
    type: 'revenu',
  });

  await bdd.enregistrerPlafondsDuMois('2026-03', { [categorie.id]: 40000 });
  await bdd.ajouterRecurrence({
    libelle: 'Loyer',
    montantCentimes: 70000,
    categorieId: categorie.id,
    frequence: 'mensuelle',
    jour: 5,
    dateDebut: '2026-01-01',
  });
  await bdd.ecrireReglage('devise', 'EUR');

  return categorie;
}

describe('solidite du mot de passe', () => {
  it('refuse un mot de passe trop court', () => {
    const resultat = evaluerMotDePasse('abc');
    expect(resultat.acceptable).toBe(false);
    expect(resultat.niveau).toBe('faible');
  });

  it('accepte une phrase longue', () => {
    expect(evaluerMotDePasse('mon chat dort sur le radiateur').niveau).toBe('bon');
  });

  it('juge correct un mot de passe moyen', () => {
    expect(evaluerMotDePasse('Chat2026!').acceptable).toBe(true);
  });
});

describe('sauvegarde chiffree', () => {
  it('produit un fichier dont le contenu est illisible', async () => {
    await remplirLaBase();
    const fichier = await creerSauvegardeChiffree(MOT_DE_PASSE);

    // Le fichier est un JSON lisible, mais rien de personnel n'y apparait.
    expect(fichier).toContain('budget-perso-sauvegarde');
    expect(fichier).not.toContain('Alimentation');
    expect(fichier).not.toContain('Courses');
    expect(fichier).not.toContain('Salaire');
    expect(fichier).not.toContain(MOT_DE_PASSE);

    // L'avertissement est inscrit dans le fichier lui-meme.
    expect(fichier).toContain('irrécupérable');
  });

  it('se relit avec le bon mot de passe', async () => {
    await remplirLaBase();
    const fichier = await creerSauvegardeChiffree(MOT_DE_PASSE);
    const lecture = await lireSauvegarde(fichier, MOT_DE_PASSE);

    expect(lecture.resume.categories).toBe(1);
    expect(lecture.resume.depenses).toBe(2);
    expect(lecture.resume.recurrences).toBe(1);
    expect(lecture.resume.premierMois).toBe('2026-03');
    expect(lecture.resume.dernierMois).toBe('2026-04');
  });

  it('refuse un mauvais mot de passe', async () => {
    await remplirLaBase();
    const fichier = await creerSauvegardeChiffree(MOT_DE_PASSE);

    await expect(lireSauvegarde(fichier, 'mauvais-mot-de-passe')).rejects.toBeInstanceOf(
      ErreurMotDePasse
    );
  });

  it('refuse un fichier modifie', async () => {
    await remplirLaBase();
    const fichier = JSON.parse(await creerSauvegardeChiffree(MOT_DE_PASSE));

    // On altere un caractere du contenu chiffre.
    const donnees = fichier.donnees.split('');
    donnees[10] = donnees[10] === 'A' ? 'B' : 'A';
    fichier.donnees = donnees.join('');

    await expect(lireSauvegarde(JSON.stringify(fichier), MOT_DE_PASSE)).rejects.toBeInstanceOf(
      ErreurMotDePasse
    );
  });

  it('refuse un fichier qui n’est pas une sauvegarde', async () => {
    await expect(lireSauvegarde('{"autre":"chose"}', MOT_DE_PASSE)).rejects.toBeInstanceOf(
      ErreurFichierInvalide
    );
    await expect(lireSauvegarde('pas du json', MOT_DE_PASSE)).rejects.toBeInstanceOf(
      ErreurFichierInvalide
    );
  });

  it('refuse une sauvegarde venant d’une version plus recente', async () => {
    await remplirLaBase();
    const fichier = JSON.parse(await creerSauvegardeChiffree(MOT_DE_PASSE));
    fichier.version = 99;

    await expect(lireSauvegarde(JSON.stringify(fichier), MOT_DE_PASSE)).rejects.toBeInstanceOf(
      ErreurFichierInvalide
    );
  });
});

describe('restauration', () => {
  it('retrouve exactement les donnees d’origine', async () => {
    const categorie = await remplirLaBase();
    const fichier = await creerSauvegardeChiffree(MOT_DE_PASSE);

    // On efface tout, comme sur un nouveau telephone.
    await bdd.effacerTout({ garderReglages: false });
    expect(await bdd.compterDepenses()).toBe(0);

    const lecture = await lireSauvegarde(fichier, MOT_DE_PASSE);
    await restaurerSauvegarde(lecture.contenu);

    const categories = await bdd.listerCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0].nom).toBe('Alimentation');
    expect(categories[0].id).toBe(categorie.id);

    const depenses = await bdd.listerDepensesDuMois('2026-03');
    expect(depenses).toHaveLength(1);
    expect(depenses[0].montantCentimes).toBe(3520);
    expect(depenses[0].note).toBe('Courses « bio »');

    expect(await bdd.lirePlafondsDuMois('2026-03')).toEqual({ [categorie.id]: 40000 });
    expect(await bdd.listerRecurrences()).toHaveLength(1);
    expect(await bdd.lireReglage('devise')).toBe('EUR');
  });

  it('remplace les donnees existantes au lieu de les cumuler', async () => {
    await remplirLaBase();
    const fichier = await creerSauvegardeChiffree(MOT_DE_PASSE);

    // On ajoute une depense qui ne figure pas dans la sauvegarde.
    await bdd.ajouterDepense({
      date: '2026-05-01',
      montantCentimes: 999,
      categorieId: null,
      note: 'Après la sauvegarde',
    });
    expect(await bdd.compterDepenses()).toBe(3);

    const lecture = await lireSauvegarde(fichier, MOT_DE_PASSE);
    await restaurerSauvegarde(lecture.contenu);

    // La depense posterieure a disparu : c'est bien un remplacement.
    expect(await bdd.compterDepenses()).toBe(2);
    expect(await bdd.listerDepensesDuMois('2026-05')).toHaveLength(0);
  });

  it('conserve une image de reçu a l’identique', async () => {
    const octets = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);
    const imageId = await bdd.enregistrerImage(octets, 'image/jpeg');
    await bdd.ajouterRecu({ imageId, commercant: 'Test', montantCentimes: 500, date: '2026-03-01' });

    const fichier = await creerSauvegardeChiffree(MOT_DE_PASSE);
    await bdd.effacerTout({ garderReglages: false });

    const lecture = await lireSauvegarde(fichier, MOT_DE_PASSE);
    await restaurerSauvegarde(lecture.contenu);

    const image = await bdd.lireImage(imageId);
    expect(image).not.toBeNull();
    expect([...image.octets]).toEqual([...octets]);
  });
});

describe('export tableur (CSV)', () => {
  const categories = [{ id: 'a', nom: 'Alimentation' }];

  it('produit un en-tete et une ligne par depense', () => {
    const csv = creerExportCsv(
      [
        { date: '2026-03-05', montantCentimes: 3520, categorieId: 'a', note: 'Courses' },
        { date: '2026-03-01', montantCentimes: 70000, categorieId: 'a', note: 'Loyer', recurrenceId: 'r1' },
      ],
      categories
    );

    const lignes = csv.trim().split('\r\n');
    expect(lignes).toHaveLength(3);
    expect(lignes[0]).toContain('Date;Type;Catégorie;Montant');
    // Les lignes sont triees par date croissante.
    expect(lignes[1]).toContain('2026-03-01');
    expect(lignes[2]).toContain('2026-03-05');
  });

  it('utilise la virgule decimale et le point-virgule comme separateur', () => {
    const csv = creerExportCsv(
      [{ date: '2026-03-05', montantCentimes: 3520, categorieId: 'a', note: '' }],
      categories
    );
    expect(csv).toContain(';35,20;');
  });

  it('commence par la marque UTF-8 attendue par Excel', () => {
    const csv = creerExportCsv([], categories);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('protege les valeurs contenant un point-virgule ou un guillemet', () => {
    const csv = creerExportCsv(
      [{ date: '2026-03-05', montantCentimes: 100, categorieId: 'a', note: 'Pain; beurre "frais"' }],
      categories
    );
    expect(csv).toContain('"Pain; beurre ""frais"""');
  });

  it('distingue les revenus des depenses', () => {
    const csv = creerExportCsv(
      [
        { date: '2026-03-01', montantCentimes: 180000, categorieId: null, note: 'Paie', type: 'revenu' },
      ],
      categories
    );
    expect(csv).toContain(';Revenu;');
    expect(csv).toContain('Sans catégorie');
  });

  it('indique l’origine de chaque ligne', () => {
    const csv = creerExportCsv(
      [
        { date: '2026-03-01', montantCentimes: 100, categorieId: 'a', note: '', recurrenceId: 'r1' },
        { date: '2026-03-02', montantCentimes: 100, categorieId: 'a', note: '', recuId: 'x1' },
        { date: '2026-03-03', montantCentimes: 100, categorieId: 'a', note: '' },
      ],
      categories
    );
    expect(csv).toContain('Récurrente');
    expect(csv).toContain('Reçu scanné');
    expect(csv).toContain('Saisie manuelle');
  });
});

describe('nom de fichier', () => {
  it('contient la date du jour', () => {
    const nom = nomDeFichier('budget-sauvegarde', 'json');
    expect(nom).toMatch(/^budget-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
