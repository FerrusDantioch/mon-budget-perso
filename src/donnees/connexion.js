/*
 * OUVERTURE DE LA BASE DE DONNEES LOCALE
 *
 * Ce fichier ne fait qu'une chose : ouvrir IndexedDB et decrire sa structure.
 * Il est separe du reste pour eviter un cercle vicieux entre les fichiers :
 * le coffre (chiffrement) a besoin de la base pour y lire sa configuration,
 * et la base a besoin du coffre pour chiffrer les donnees. Les deux
 * s'appuient donc sur ce troisieme fichier, qui ne depend de personne.
 *
 * DEUX ZONES DANS LA BASE
 * -----------------------
 *   Zone en clair   : "securite" et "reglages".
 *     "securite" contient la configuration du verrouillage (le sel, la cle du
 *     coffre emballee, le compteur d'essais). Rien n'y est secret : la cle y
 *     est justement stockee sous forme chiffree. Cette zone doit rester
 *     lisible AVANT le deverrouillage, sinon on ne pourrait pas verifier
 *     le code PIN.
 *     "reglages" contient le theme et la devise : aucune information
 *     personnelle, et l'application doit pouvoir s'afficher correctement
 *     avant meme d'etre deverrouillee.
 *
 *   Zone chiffree   : "categories", "depenses", "budgets", "recurrences",
 *     "recus" et "images". Chaque enregistrement y est stocke sous la forme
 *     { id, enveloppe } ou "enveloppe" est le contenu chiffre. Meme quelqu'un
 *     qui lirait directement la base du navigateur ne verrait que du bruit.
 */

import { openDB } from 'idb';

const NOM_DE_LA_BASE = 'budget-perso';

// Version 2 : passage au stockage chiffre et ajout des recurrences et des recus.
const VERSION_DE_LA_BASE = 2;

/** Les magasins dont le contenu est chiffre. */
export const MAGASINS_CHIFFRES = [
  'categories',
  'depenses',
  'budgets',
  'recurrences',
  'recus',
  'images',
];

/** Tous les magasins, zone en clair comprise. */
export const TOUS_LES_MAGASINS = [...MAGASINS_CHIFFRES, 'reglages', 'securite'];

let connexion = null;

/**
 * Ouvre la base (et la cree ou la met a jour au besoin).
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export function ouvrirBase() {
  if (!connexion) {
    connexion = openDB(NOM_DE_LA_BASE, VERSION_DE_LA_BASE, {
      upgrade(base, ancienneVersion) {
        // --- Structure de depart (version 1) ---------------------------
        if (!base.objectStoreNames.contains('categories')) {
          base.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!base.objectStoreNames.contains('depenses')) {
          base.createObjectStore('depenses', { keyPath: 'id' });
        }
        if (!base.objectStoreNames.contains('budgets')) {
          base.createObjectStore('budgets', { keyPath: 'mois' });
        }
        if (!base.objectStoreNames.contains('reglages')) {
          base.createObjectStore('reglages', { keyPath: 'cle' });
        }

        // --- Nouveautes de la version 2 --------------------------------
        if (!base.objectStoreNames.contains('recurrences')) {
          base.createObjectStore('recurrences', { keyPath: 'id' });
        }
        if (!base.objectStoreNames.contains('recus')) {
          base.createObjectStore('recus', { keyPath: 'id' });
        }
        if (!base.objectStoreNames.contains('images')) {
          base.createObjectStore('images', { keyPath: 'id' });
        }
        if (!base.objectStoreNames.contains('securite')) {
          base.createObjectStore('securite', { keyPath: 'cle' });
        }

        // Les index de la version 1 (recherche par mois, par categorie) sont
        // supprimes : ils portaient sur des champs devenus chiffres, donc
        // inutilisables. Les recherches se font desormais en memoire, ce qui
        // est instantane pour un budget personnel et evite de laisser fuiter
        // la date ou la categorie de chaque depense.
        if (ancienneVersion === 1) {
          const depenses = base.transaction.objectStore('depenses');
          for (const nom of ['parMois', 'parCategorie', 'parDate']) {
            if (depenses.indexNames.contains(nom)) depenses.deleteIndex(nom);
          }
        }
      },

      blocked() {
        console.warn(
          'Un autre onglet utilise encore l’ancienne version de la base. ' +
            'Fermez les autres onglets de l’application.'
        );
      },
    });
  }
  return connexion;
}

/** Ferme la connexion (utilise par les tests automatises). */
export async function fermerBase() {
  if (connexion) {
    const base = await connexion;
    base.close();
    connexion = null;
  }
}

// ---------------------------------------------------------------------------
// Zone en clair : securite
// ---------------------------------------------------------------------------

export async function lireSecurite(cle, valeurParDefaut = null) {
  const base = await ouvrirBase();
  const enregistrement = await base.get('securite', cle);
  return enregistrement ? enregistrement.valeur : valeurParDefaut;
}

export async function ecrireSecurite(cle, valeur) {
  const base = await ouvrirBase();
  await base.put('securite', { cle, valeur });
}

export async function supprimerSecurite(cle) {
  const base = await ouvrirBase();
  await base.delete('securite', cle);
}

// ---------------------------------------------------------------------------
// Zone en clair : reglages d'affichage
// ---------------------------------------------------------------------------

export async function lireReglage(cle, valeurParDefaut = null) {
  const base = await ouvrirBase();
  const enregistrement = await base.get('reglages', cle);
  return enregistrement ? enregistrement.valeur : valeurParDefaut;
}

export async function ecrireReglage(cle, valeur) {
  const base = await ouvrirBase();
  await base.put('reglages', { cle, valeur });
}
