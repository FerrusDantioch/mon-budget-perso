/*
 * REMISE A ZERO COMPLETE
 *
 * Supprime la base de donnees entiere : depenses, categories, budgets,
 * recurrences, reçus, et la configuration du code PIN.
 *
 * C'est la seule issue quand le code est oublie et qu'aucune phrase de
 * recuperation n'a ete creee : les donnees etant chiffrees avec une cle
 * derivee du code, personne — pas meme le developpeur de l'application — ne
 * peut les recuperer.
 *
 * Cette operation est evidemment irreversible et n'est jamais declenchee sans
 * une confirmation explicite de l'utilisateur.
 */

import { fermerBase } from './connexion.js';

export async function supprimerLaBase() {
  // On ferme d'abord la connexion, sinon la suppression reste en attente.
  await fermerBase();

  await new Promise((resoudre) => {
    const demande = indexedDB.deleteDatabase('budget-perso');
    demande.onsuccess = resoudre;
    demande.onerror = resoudre;
    // "blocked" survient si un autre onglet garde la base ouverte : on
    // n'attend pas indefiniment, le rechargement de la page reglera le cas.
    demande.onblocked = resoudre;
  });

  // Tesseract range le dictionnaire francais dans sa propre base : on la
  // supprime aussi pour ne rien laisser derriere.
  try {
    indexedDB.deleteDatabase('keyval-store');
  } catch (probleme) {
    // Sans consequence si elle n'existe pas.
  }
}
