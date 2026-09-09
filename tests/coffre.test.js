/*
 * TESTS — chiffrement et coffre
 *
 * C'est la partie la plus critique de l'application : une erreur ici rendrait
 * les donnees illisibles, ou les laisserait en clair. Les tests verifient
 * autant ce qui doit marcher que ce qui doit ECHOUER (mauvais code, donnees
 * alterees, blocage apres trois essais).
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  base64VersOctets,
  chiffrerValeur,
  comparerOctets,
  dechiffrerValeur,
  deballerCleCoffre,
  deriverCle,
  emballerCleCoffre,
  exporterCle,
  genererCleCoffre,
  octetsAleatoires,
  octetsVersBase64,
} from '../src/securite/crypto.js';
import * as coffre from '../src/securite/coffre.js';
import { ouvrirBase } from '../src/donnees/connexion.js';

// Peu d'iterations dans les tests : on verifie la logique, pas la lenteur.
const SEL = new Uint8Array(16).fill(7);

/** Vide la zone "securite" pour repartir d'un appareil neuf. */
async function reinitialiserLaConfiguration() {
  const base = await ouvrirBase();
  await base.clear('securite');
  coffre.verrouiller();
}

describe('conversions', () => {
  it('fait l’aller-retour octets / base64 sans perte', () => {
    const original = octetsAleatoires(300);
    expect(comparerOctets(base64VersOctets(octetsVersBase64(original)), original)).toBe(true);
  });

  it('compare correctement deux suites d’octets', () => {
    expect(comparerOctets(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(comparerOctets(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(comparerOctets(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });
});

describe('chiffrement AES-256-GCM', () => {
  it('retrouve exactement la valeur d’origine', async () => {
    const cle = await genererCleCoffre();
    const objet = { montantCentimes: 1250, note: 'Café ☕', date: '2026-03-15' };

    const enveloppe = await chiffrerValeur(cle, objet);
    expect(await dechiffrerValeur(cle, enveloppe)).toEqual(objet);
  });

  it('produit un resultat different a chaque fois', async () => {
    const cle = await genererCleCoffre();
    const a = await chiffrerValeur(cle, { x: 1 });
    const b = await chiffrerValeur(cle, { x: 1 });

    // Le vecteur d'initialisation change a chaque chiffrement : deux
    // enregistrements identiques ne se ressemblent donc pas dans la base.
    expect(comparerOctets(a.iv, b.iv)).toBe(false);
    expect(comparerOctets(a.donnees, b.donnees)).toBe(false);
  });

  it('refuse une cle differente', async () => {
    const bonne = await genererCleCoffre();
    const mauvaise = await genererCleCoffre();
    const enveloppe = await chiffrerValeur(bonne, { secret: 42 });

    await expect(dechiffrerValeur(mauvaise, enveloppe)).rejects.toThrow();
  });

  it('detecte une donnee alteree', async () => {
    const cle = await genererCleCoffre();
    const enveloppe = await chiffrerValeur(cle, { secret: 42 });

    // On modifie un seul octet : la signature GCM ne correspond plus.
    enveloppe.donnees[0] = enveloppe.donnees[0] ^ 0xff;
    await expect(dechiffrerValeur(cle, enveloppe)).rejects.toThrow();
  });
});

describe('derivation de cle (PBKDF2)', () => {
  it('donne la meme cle pour le meme code et le meme sel', async () => {
    const a = await deriverCle('1234', SEL, 1000);
    const b = await deriverCle('1234', SEL, 1000);

    const cleCoffre = await genererCleCoffre();
    const enveloppe = await emballerCleCoffre(cleCoffre, a);
    const retrouvee = await deballerCleCoffre(enveloppe, b);

    expect(comparerOctets(await exporterCle(retrouvee), await exporterCle(cleCoffre))).toBe(true);
  });

  it('donne une cle differente avec un autre sel', async () => {
    const autreSel = new Uint8Array(16).fill(9);
    const a = await deriverCle('1234', SEL, 1000);
    const b = await deriverCle('1234', autreSel, 1000);

    const cleCoffre = await genererCleCoffre();
    const enveloppe = await emballerCleCoffre(cleCoffre, a);
    await expect(deballerCleCoffre(enveloppe, b)).rejects.toThrow();
  });
});

describe('le coffre', () => {
  beforeEach(reinitialiserLaConfiguration);

  it('refuse un code invalide', () => {
    expect(coffre.codeValide('1234')).toBe(true);
    expect(coffre.codeValide('123456')).toBe(true);
    expect(coffre.codeValide('123')).toBe(false);
    expect(coffre.codeValide('1234567')).toBe(false);
    expect(coffre.codeValide('12a4')).toBe(false);
    expect(coffre.codeValide('')).toBe(false);
  });

  it('se cree, se verrouille et se rouvre avec le bon code', async () => {
    await coffre.creerCoffre('147258');
    expect(coffre.coffreOuvert()).toBe(true);

    // Une donnee chiffree avant le verrouillage doit rester lisible apres.
    const enveloppe = await coffre.chiffrer({ montant: 999 });

    coffre.verrouiller();
    expect(coffre.coffreOuvert()).toBe(false);
    await expect(coffre.chiffrer({ x: 1 })).rejects.toThrow();

    await coffre.ouvrirAvecCode('147258');
    expect(coffre.coffreOuvert()).toBe(true);
    expect(await coffre.dechiffrer(enveloppe)).toEqual({ montant: 999 });
  }, 20000);

  it('refuse un mauvais code', async () => {
    await coffre.creerCoffre('147258');
    coffre.verrouiller();

    await expect(coffre.ouvrirAvecCode('000000')).rejects.toBeInstanceOf(
      coffre.ErreurCodeIncorrect
    );
    expect(coffre.coffreOuvert()).toBe(false);
  }, 20000);

  it('bloque temporairement apres trois codes errones', async () => {
    await coffre.creerCoffre('147258');
    coffre.verrouiller();

    for (let essai = 1; essai <= coffre.ESSAIS_AVANT_BLOCAGE; essai++) {
      await expect(coffre.ouvrirAvecCode('000000')).rejects.toThrow();
    }

    const blocage = await coffre.etatBlocage();
    expect(blocage.bloque).toBe(true);
    expect(blocage.secondesRestantes).toBeGreaterThan(0);

    // Meme le bon code est refuse pendant le blocage.
    await expect(coffre.ouvrirAvecCode('147258')).rejects.toBeInstanceOf(coffre.ErreurBlocage);
  }, 40000);

  it('remet le compteur a zero apres une ouverture reussie', async () => {
    await coffre.creerCoffre('147258');
    coffre.verrouiller();

    await expect(coffre.ouvrirAvecCode('000000')).rejects.toThrow();
    expect((await coffre.etatBlocage()).essaisRestants).toBe(coffre.ESSAIS_AVANT_BLOCAGE - 1);

    await coffre.ouvrirAvecCode('147258');
    expect((await coffre.etatBlocage()).essaisRestants).toBe(coffre.ESSAIS_AVANT_BLOCAGE);
  }, 30000);

  it('change de code sans rendre les anciennes donnees illisibles', async () => {
    await coffre.creerCoffre('147258');
    const enveloppe = await coffre.chiffrer({ depense: 'ancienne' });

    await coffre.changerCode('147258', '369852');
    coffre.verrouiller();

    await expect(coffre.ouvrirAvecCode('147258')).rejects.toThrow();
    await coffre.ouvrirAvecCode('369852');

    // Les donnees n'ont pas ete rechiffrees : c'est tout l'interet d'emballer
    // la cle du coffre plutot que de chiffrer directement avec le code.
    expect(await coffre.dechiffrer(enveloppe)).toEqual({ depense: 'ancienne' });
  }, 40000);

  it('refuse de changer le code si l’ancien est faux', async () => {
    await coffre.creerCoffre('147258');
    await expect(coffre.changerCode('000000', '369852')).rejects.toBeInstanceOf(
      coffre.ErreurCodeIncorrect
    );
  }, 30000);

  it('rouvre le coffre avec la phrase de recuperation', async () => {
    await coffre.creerCoffre('147258');
    const enveloppe = await coffre.chiffrer({ depense: 'importante' });

    const phrase = await coffre.creerPhraseRecuperation();
    expect(phrase.split(' ')).toHaveLength(12);

    coffre.verrouiller();

    const resultat = await coffre.ouvrirAvecPhrase(phrase);
    expect(resultat.ouvert).toBe(true);
    expect(await coffre.dechiffrer(enveloppe)).toEqual({ depense: 'importante' });
  }, 30000);

  it('refuse une phrase erronee', async () => {
    await coffre.creerCoffre('147258');
    await coffre.creerPhraseRecuperation();
    coffre.verrouiller();

    const mauvaise = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const resultat = await coffre.ouvrirAvecPhrase(mauvaise);
    expect(resultat.ouvert).toBe(false);
    expect(resultat.raison).toBeTruthy();
    expect(coffre.coffreOuvert()).toBe(false);
  }, 30000);

  it('decrit correctement son etat', async () => {
    expect((await coffre.etatDuCoffre()).configure).toBe(false);

    await coffre.creerCoffre('1234');
    const etat = await coffre.etatDuCoffre();
    expect(etat.configure).toBe(true);
    expect(etat.ouvert).toBe(true);
    expect(etat.longueurCode).toBe(4);
    expect(etat.phraseActive).toBe(false);
    expect(etat.biometrieActive).toBe(false);
  }, 20000);
});
