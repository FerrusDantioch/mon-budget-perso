/*
 * REPRISE DES DONNEES DE LA VERSION PRECEDENTE
 *
 * La toute premiere version de l'application enregistrait les depenses en
 * clair dans la base. Depuis l'ajout du code PIN, tout est chiffre.
 *
 * Ce fichier assure la transition : au moment ou l'utilisateur choisit son
 * code pour la premiere fois, les anciennes lignes sont relues, chiffrees,
 * puis reecrites. Rien n'est perdu, et l'operation n'a lieu qu'une fois.
 *
 * On reconnait une ancienne ligne au fait qu'elle n'a pas de champ
 * "enveloppe" : les nouvelles lignes n'ont que { id, enveloppe }.
 */

import { ouvrirBase } from './connexion.js';
import * as coffre from '../securite/coffre.js';
import { viderCache } from './basededonnees.js';

const MAGASINS_A_REPRENDRE = [
  { nom: 'categories', cle: 'id' },
  { nom: 'depenses', cle: 'id' },
  { nom: 'budgets', cle: 'mois' },
];

/**
 * Y a-t-il des donnees en clair a reprendre ?
 * @returns {Promise<number>} le nombre de lignes concernees
 */
export async function compterDonneesEnClair() {
  const base = await ouvrirBase();
  let total = 0;

  for (const { nom } of MAGASINS_A_REPRENDRE) {
    if (!base.objectStoreNames.contains(nom)) continue;
    const lignes = await base.getAll(nom);
    total += lignes.filter((ligne) => ligne && ligne.enveloppe === undefined).length;
  }
  return total;
}

/**
 * Chiffre les donnees restees en clair. Le coffre doit etre ouvert.
 * @returns {Promise<number>} le nombre de lignes reprises
 */
export async function chiffrerLesDonneesEnClair() {
  if (!coffre.coffreOuvert()) {
    throw new Error('Le coffre doit être ouvert pour reprendre les anciennes données.');
  }

  const base = await ouvrirBase();
  let reprises = 0;

  for (const { nom, cle } of MAGASINS_A_REPRENDRE) {
    if (!base.objectStoreNames.contains(nom)) continue;

    const lignes = await base.getAll(nom);
    for (const ligne of lignes) {
      if (!ligne || ligne.enveloppe !== undefined) continue;

      // La ligne d'origine EST l'objet metier : on la chiffre telle quelle.
      const identifiant = ligne[cle];
      await base.put(nom, {
        [cle]: identifiant,
        enveloppe: await coffre.chiffrer(ligne),
      });
      reprises += 1;
    }
  }

  // Le cache a peut-etre ete rempli avant la reprise : on le refait.
  if (reprises > 0) viderCache();

  return reprises;
}
