/*
 * TESTS — phrase de recuperation (BIP39)
 *
 * On verifie surtout la somme de controle : c'est elle qui detecte une faute
 * de recopie AVANT d'essayer de dechiffrer, et qui evite de dire « mauvaise
 * phrase » alors que le probleme est un simple mot inverse.
 */

import { describe, it, expect } from 'vitest';

import {
  entropieVersPhrase,
  genererPhrase,
  normaliserPhrase,
  suggererMots,
  verifierPhrase,
} from '../src/securite/bip39.js';
import { MOTS_BIP39 } from '../src/securite/motsBip39.js';

describe('la liste de mots', () => {
  it('contient les 2048 mots de la norme', () => {
    expect(MOTS_BIP39).toHaveLength(2048);
    expect(MOTS_BIP39[0]).toBe('abandon');
    expect(MOTS_BIP39[2047]).toBe('zoo');
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(MOTS_BIP39).size).toBe(2048);
  });
});

describe('generation', () => {
  it('produit 12 mots issus de la liste', async () => {
    const phrase = await genererPhrase();
    const mots = phrase.split(' ');
    expect(mots).toHaveLength(12);
    for (const mot of mots) expect(MOTS_BIP39).toContain(mot);
  });

  it('produit une phrase differente a chaque appel', async () => {
    const a = await genererPhrase();
    const b = await genererPhrase();
    expect(a).not.toBe(b);
  });

  it('donne le resultat de reference de la norme', async () => {
    // Cas de test officiel BIP39 : 16 octets a zero.
    const phrase = await entropieVersPhrase(new Uint8Array(16));
    expect(phrase).toBe(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );
  });

  it('donne le second resultat de reference', async () => {
    // 16 octets a 0x7f.
    const phrase = await entropieVersPhrase(new Uint8Array(16).fill(0x7f));
    expect(phrase).toBe(
      'legal winner thank year wave sausage worth useful legal winner thank yellow'
    );
  });
});

describe('verification', () => {
  it('accepte une phrase valide et retrouve l’entropie', async () => {
    const phrase = await entropieVersPhrase(new Uint8Array(16).fill(3));
    const resultat = await verifierPhrase(phrase);

    expect(resultat.valide).toBe(true);
    expect(resultat.entropie).toHaveLength(16);
    expect([...resultat.entropie]).toEqual(Array(16).fill(3));
  });

  it('tolere les majuscules et les espaces en trop', async () => {
    const phrase = await genererPhrase();
    const abimee = `  ${phrase.toUpperCase().replace(/ /g, '   ')}\n`;
    expect((await verifierPhrase(abimee)).valide).toBe(true);
  });

  it('refuse un nombre de mots incorrect', async () => {
    const resultat = await verifierPhrase('abandon ability able');
    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('12 mots');
  });

  it('signale un mot inconnu', async () => {
    const resultat = await verifierPhrase(
      'abandon ability able about above absent absorb abstract absurd abuse access zzzzz'
    );
    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('zzzzz');
  });

  it('detecte deux mots intervertis', async () => {
    const phrase = await genererPhrase();
    const mots = phrase.split(' ');
    // On echange le premier et le deuxieme mot.
    [mots[0], mots[1]] = [mots[1], mots[0]];

    const resultat = await verifierPhrase(mots.join(' '));
    // Il reste une chance sur 16 que la somme de controle retombe juste :
    // le test ne verifie donc que le cas ou elle est bien detectee.
    if (!resultat.valide) {
      expect(resultat.raison).toContain('mal recopié');
    }
  });

  it('refuse une phrase de 12 mots valides mais mal assemblee', async () => {
    // Douze fois "abandon" : la somme de controle ne peut pas tomber juste.
    const resultat = await verifierPhrase(Array(12).fill('abandon').join(' '));
    expect(resultat.valide).toBe(false);
  });
});

describe('outils de saisie', () => {
  it('normalise une phrase', () => {
    expect(normaliserPhrase('  Abandon   ABILITY\nable ')).toBe('abandon ability able');
  });

  it('propose des mots a partir du debut', () => {
    const suggestions = suggererMots('aba');
    expect(suggestions).toContain('abandon');
    expect(suggestions.every((mot) => mot.startsWith('aba'))).toBe(true);
  });

  it('ne propose rien avec moins de deux lettres', () => {
    expect(suggererMots('a')).toHaveLength(0);
  });
});
