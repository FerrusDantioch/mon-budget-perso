/*
 * ACCES AUX DONNEES
 *
 * C'est le seul fichier qui parle a la base de donnees. Toute l'application
 * passe par lui : les ecrans ne savent meme pas que les donnees sont
 * chiffrees.
 *
 * COMMENT SONT RANGEES LES DONNEES
 * --------------------------------
 * Chaque enregistrement est stocke sous la forme :
 *
 *      { id: "9f1c-...", enveloppe: { iv, donnees } }
 *
 * L'identifiant reste en clair (c'est un numero tire au hasard, il ne dit
 * rien de la depense) et tout le reste — montant, date, categorie, note —
 * est chiffre. Quelqu'un qui inspecterait la base du navigateur ne verrait
 * que des suites d'octets.
 *
 * POURQUOI UN CACHE EN MEMOIRE
 * ----------------------------
 * Comme tout est chiffre, on ne peut plus demander a la base « donne-moi les
 * depenses de mars » : elle ne sait pas lire ce qu'elle stocke. On dechiffre
 * donc l'ensemble une seule fois a l'ouverture du coffre, et on garde le
 * resultat en memoire. Les recherches deviennent instantanees, et le cache
 * est efface des que l'application se verrouille.
 *
 * Pour un budget personnel (quelques milliers de lignes au bout de plusieurs
 * annees), cela represente quelques centaines de kilo-octets : sans commune
 * mesure avec le gain de confidentialite.
 */

import { ouvrirBase } from './connexion.js';
import * as coffre from '../securite/coffre.js';
import { nouvelIdentifiant } from '../utils/identifiant.js';
import { moisDeLaDate } from '../utils/dates.js';
import { CATEGORIES_PAR_DEFAUT } from './categoriesParDefaut.js';

// Les reglages d'affichage et la fermeture de la base restent geres par
// connexion.js : on les reexpose ici pour que le reste de l'application n'ait
// qu'un seul fichier a importer.
export { lireReglage, ecrireReglage, fermerBase } from './connexion.js';

// ---------------------------------------------------------------------------
// Cache en memoire
// ---------------------------------------------------------------------------

const MAGASINS_EN_CACHE = ['categories', 'depenses', 'budgets', 'recurrences', 'recus'];

// null tant que rien n'a ete charge ; efface a chaque verrouillage.
let cache = null;

// Les images des reçus ne sont PAS mises en cache : elles pesent lourd et ne
// servent qu'a l'affichage d'un reçu precis.

coffre.surVerrouillage(() => {
  cache = null;
});

/** Vide le cache a la main (tests, restauration de sauvegarde). */
export function viderCache() {
  cache = null;
}

/**
 * Charge et dechiffre tout le contenu de la base, une seule fois.
 * Les enregistrements illisibles (base corrompue) sont ignores avec un
 * avertissement plutot que de faire echouer tout le chargement.
 */
async function assurerCache() {
  if (cache) return cache;

  const base = await ouvrirBase();
  const nouveau = {};

  for (const magasin of MAGASINS_EN_CACHE) {
    const cleDuMagasin = magasin === 'budgets' ? 'mois' : 'id';
    const lignes = await base.getAll(magasin);
    const contenu = new Map();

    for (const ligne of lignes) {
      try {
        const objet = await coffre.dechiffrer(ligne.enveloppe);
        contenu.set(ligne[cleDuMagasin], objet);
      } catch (probleme) {
        console.warn(
          `Enregistrement illisible ignoré dans « ${magasin} » (${ligne[cleDuMagasin]})`,
          probleme
        );
      }
    }
    nouveau[magasin] = contenu;
  }

  cache = nouveau;
  return cache;
}

/** Ecrit un enregistrement : chiffrement + base + cache, dans cet ordre. */
async function enregistrer(magasin, valeur) {
  const cleDuMagasin = magasin === 'budgets' ? 'mois' : 'id';
  const identifiant = valeur[cleDuMagasin];

  const base = await ouvrirBase();
  await base.put(magasin, {
    [cleDuMagasin]: identifiant,
    enveloppe: await coffre.chiffrer(valeur),
  });

  const contenu = await assurerCache();
  contenu[magasin].set(identifiant, valeur);
  return valeur;
}

/** Supprime un enregistrement de la base et du cache. */
async function retirer(magasin, identifiant) {
  const base = await ouvrirBase();
  await base.delete(magasin, identifiant);
  const contenu = await assurerCache();
  contenu[magasin].delete(identifiant);
}

// ---------------------------------------------------------------------------
// PREMIER LANCEMENT
// ---------------------------------------------------------------------------

/**
 * Cree les categories de depart si la base est vide.
 * @returns {Promise<boolean>} vrai si des categories ont ete creees
 */
export async function preparerLesDonneesInitiales() {
  const contenu = await assurerCache();
  if (contenu.categories.size > 0) return false;

  let position = 0;
  for (const modele of CATEGORIES_PAR_DEFAUT) {
    await enregistrer('categories', {
      id: nouvelIdentifiant(),
      nom: modele.nom,
      couleur: modele.couleur,
      emoji: modele.emoji,
      plafondCentimes: modele.plafondCentimes,
      ordre: position,
      archivee: false,
    });
    position += 1;
  }
  return true;
}

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------

export async function listerCategories() {
  const contenu = await assurerCache();
  return [...contenu.categories.values()].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

export async function ajouterCategorie({ nom, couleur, emoji, plafondCentimes = 0 }) {
  const contenu = await assurerCache();
  return enregistrer('categories', {
    id: nouvelIdentifiant(),
    nom: String(nom).trim(),
    couleur,
    emoji: emoji || '📦',
    plafondCentimes,
    ordre: contenu.categories.size,
    archivee: false,
  });
}

export async function modifierCategorie(id, changements) {
  const contenu = await assurerCache();
  const existante = contenu.categories.get(id);
  if (!existante) return null;
  return enregistrer('categories', { ...existante, ...changements, id });
}

/**
 * Supprime une categorie.
 * Les depenses rattachees ne sont PAS effacees : elles apparaissent ensuite
 * dans la ligne « Sans catégorie ». On ne fait jamais disparaitre de l'argent
 * deja saisi par l'utilisateur.
 */
export async function supprimerCategorie(id) {
  await retirer('categories', id);
}

// ---------------------------------------------------------------------------
// DEPENSES
// ---------------------------------------------------------------------------

/** Toutes les depenses, de la plus recente a la plus ancienne. */
export async function listerToutesLesDepenses() {
  const contenu = await assurerCache();
  return [...contenu.depenses.values()].sort(trierParDateDecroissante);
}

function trierParDateDecroissante(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.creeLe || 0) - (a.creeLe || 0);
}

/** Les depenses d'un mois donne ("2026-03"). */
export async function listerDepensesDuMois(mois) {
  const contenu = await assurerCache();
  return [...contenu.depenses.values()]
    .filter((depense) => depense.mois === mois)
    .sort(trierParDateDecroissante);
}

/** Une depense precise, ou null. */
export async function lireDepense(id) {
  const contenu = await assurerCache();
  return contenu.depenses.get(id) ?? null;
}

export async function ajouterDepense({
  date,
  montantCentimes,
  categorieId,
  note = '',
  type = 'depense',
  recurrenceId = null,
  recuId = null,
}) {
  const maintenant = Date.now();
  return enregistrer('depenses', {
    id: nouvelIdentifiant(),
    date,
    mois: moisDeLaDate(date),
    montantCentimes,
    categorieId,
    note: String(note).trim(),
    // "depense" ou "revenu" : un revenu (salaire, remboursement) n'entre pas
    // dans les totaux de categories, il apparait a part.
    type,
    // Renseigne quand la ligne a ete creee automatiquement par une recurrence.
    recurrenceId,
    // Renseigne quand un reçu scanne est rattache a cette depense.
    recuId,
    creeLe: maintenant,
    modifieLe: maintenant,
  });
}

export async function modifierDepense(id, changements) {
  const contenu = await assurerCache();
  const existante = contenu.depenses.get(id);
  if (!existante) return null;

  const misAJour = { ...existante, ...changements, id, modifieLe: Date.now() };
  if (changements.date) misAJour.mois = moisDeLaDate(changements.date);
  if (typeof misAJour.note === 'string') misAJour.note = misAJour.note.trim();

  return enregistrer('depenses', misAJour);
}

export async function supprimerDepense(id) {
  await retirer('depenses', id);
}

/** Nombre total de depenses enregistrees. */
export async function compterDepenses() {
  const contenu = await assurerCache();
  return contenu.depenses.size;
}

// ---------------------------------------------------------------------------
// BUDGETS (plafonds mois par mois)
// ---------------------------------------------------------------------------

export async function lirePlafondsDuMois(mois) {
  const contenu = await assurerCache();
  const enregistrement = contenu.budgets.get(mois);
  return enregistrement ? enregistrement.plafonds : null;
}

export async function enregistrerPlafondsDuMois(mois, plafonds) {
  return enregistrer('budgets', { mois, plafonds, modifieLe: Date.now() });
}

/**
 * Plafonds reellement applicables a un mois :
 *   - ceux enregistres pour ce mois s'il y en a ;
 *   - sinon le plafond habituel de chaque categorie.
 * Cela permet de consulter un mois passe avec les objectifs de l'epoque.
 */
export function plafondsApplicables(categories, plafondsEnregistres) {
  const resultat = {};
  for (const categorie of categories) {
    resultat[categorie.id] =
      plafondsEnregistres && plafondsEnregistres[categorie.id] !== undefined
        ? plafondsEnregistres[categorie.id]
        : (categorie.plafondCentimes ?? 0);
  }
  return resultat;
}

/** Tous les mois contenant une depense ou un budget, du plus recent au plus ancien. */
export async function moisAvecDonnees() {
  const contenu = await assurerCache();
  const mois = new Set();
  for (const cle of contenu.budgets.keys()) mois.add(cle);
  for (const depense of contenu.depenses.values()) mois.add(depense.mois);
  return [...mois].sort().reverse();
}

/** Total depense pour chaque mois (les revenus sont comptes a part). */
export async function totauxParMois() {
  const contenu = await assurerCache();
  const parMois = new Map();

  for (const depense of contenu.depenses.values()) {
    const actuel = parMois.get(depense.mois) ?? { total: 0, revenus: 0, nombre: 0 };
    if (depense.type === 'revenu') {
      actuel.revenus += depense.montantCentimes || 0;
    } else {
      actuel.total += depense.montantCentimes || 0;
    }
    actuel.nombre += 1;
    parMois.set(depense.mois, actuel);
  }

  return [...parMois.entries()]
    .map(([mois, valeurs]) => ({ mois, ...valeurs }))
    .sort((a, b) => (a.mois < b.mois ? 1 : -1));
}

// ---------------------------------------------------------------------------
// DEPENSES RECURRENTES
// ---------------------------------------------------------------------------

export async function listerRecurrences() {
  const contenu = await assurerCache();
  return [...contenu.recurrences.values()].sort((a, b) =>
    a.libelle.localeCompare(b.libelle, 'fr')
  );
}

export async function ajouterRecurrence(donnees) {
  return enregistrer('recurrences', {
    id: nouvelIdentifiant(),
    suspendue: false,
    derniereGeneration: null,
    creeLe: Date.now(),
    ...donnees,
  });
}

export async function modifierRecurrence(id, changements) {
  const contenu = await assurerCache();
  const existante = contenu.recurrences.get(id);
  if (!existante) return null;
  return enregistrer('recurrences', { ...existante, ...changements, id });
}

export async function supprimerRecurrence(id) {
  await retirer('recurrences', id);
}

/**
 * Supprime une recurrence ET les depenses qu'elle a generees.
 * Utilise uniquement quand l'utilisateur le demande explicitement.
 */
export async function supprimerRecurrenceEtSesDepenses(id) {
  const contenu = await assurerCache();
  const aSupprimer = [...contenu.depenses.values()].filter((d) => d.recurrenceId === id);
  for (const depense of aSupprimer) await retirer('depenses', depense.id);
  await retirer('recurrences', id);
  return aSupprimer.length;
}

// ---------------------------------------------------------------------------
// REÇUS SCANNES
// ---------------------------------------------------------------------------

export async function listerRecus() {
  const contenu = await assurerCache();
  return [...contenu.recus.values()].sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
}

export async function lireRecu(id) {
  const contenu = await assurerCache();
  return contenu.recus.get(id) ?? null;
}

export async function ajouterRecu(donnees) {
  return enregistrer('recus', {
    id: nouvelIdentifiant(),
    creeLe: Date.now(),
    ...donnees,
  });
}

export async function modifierRecu(id, changements) {
  const contenu = await assurerCache();
  const existant = contenu.recus.get(id);
  if (!existant) return null;
  return enregistrer('recus', { ...existant, ...changements, id });
}

/** Supprime un reçu et l'image qui lui est rattachee. */
export async function supprimerRecu(id) {
  const recu = await lireRecu(id);
  if (recu?.imageId) await supprimerImage(recu.imageId);
  await retirer('recus', id);
}

// ---------------------------------------------------------------------------
// IMAGES DES REÇUS (hors cache : elles sont volumineuses)
// ---------------------------------------------------------------------------

/**
 * Range une image chiffree.
 * @param {Uint8Array} octets  l'image deja compressee
 * @param {string} typeMime    par exemple "image/jpeg"
 */
export async function enregistrerImage(octets, typeMime) {
  const base = await ouvrirBase();
  const id = nouvelIdentifiant();
  await base.put('images', {
    id,
    typeMime,
    enveloppe: await coffre.chiffrerBinaire(octets),
  });
  return id;
}

/**
 * Relit une image et la dechiffre.
 * @returns {Promise<{octets: Uint8Array, typeMime: string}|null>}
 */
export async function lireImage(id) {
  const base = await ouvrirBase();
  const ligne = await base.get('images', id);
  if (!ligne) return null;
  return {
    octets: await coffre.dechiffrerBinaire(ligne.enveloppe),
    typeMime: ligne.typeMime ?? 'image/jpeg',
  };
}

export async function supprimerImage(id) {
  const base = await ouvrirBase();
  await base.delete('images', id);
}

/** Place occupee par les images, en octets (approximatif). */
export async function tailleDesImages() {
  const base = await ouvrirBase();
  const lignes = await base.getAll('images');
  return lignes.reduce((somme, ligne) => somme + (ligne.enveloppe?.donnees?.byteLength ?? 0), 0);
}

// ---------------------------------------------------------------------------
// OUTILS GENERAUX
// ---------------------------------------------------------------------------

/**
 * Recupere l'integralite des donnees, dechiffrees.
 * Sert a la sauvegarde (qui les rechiffre ensuite avec le mot de passe maitre).
 */
export async function exporterTout() {
  const contenu = await assurerCache();
  const base = await ouvrirBase();

  // Les images sont relues une par une, puisqu'elles ne sont pas en cache.
  const images = [];
  for (const ligne of await base.getAll('images')) {
    try {
      images.push({
        id: ligne.id,
        typeMime: ligne.typeMime ?? 'image/jpeg',
        octets: await coffre.dechiffrerBinaire(ligne.enveloppe),
      });
    } catch (probleme) {
      console.warn('Image illisible ignorée pendant l’export', ligne.id);
    }
  }

  return {
    categories: [...contenu.categories.values()],
    depenses: [...contenu.depenses.values()],
    budgets: [...contenu.budgets.values()],
    recurrences: [...contenu.recurrences.values()],
    recus: [...contenu.recus.values()],
    images,
    reglages: await base.getAll('reglages'),
  };
}

/**
 * Remplace toutes les donnees par celles d'une sauvegarde.
 * Les donnees sont rechiffrees avec la cle du coffre de CET appareil : le
 * mot de passe de la sauvegarde ne sert qu'a ouvrir le fichier.
 */
export async function remplacerTout(donnees) {
  await effacerTout({ garderReglages: false });

  for (const categorie of donnees.categories ?? []) await enregistrer('categories', categorie);
  for (const depense of donnees.depenses ?? []) await enregistrer('depenses', depense);
  for (const budget of donnees.budgets ?? []) await enregistrer('budgets', budget);
  for (const recurrence of donnees.recurrences ?? []) await enregistrer('recurrences', recurrence);
  for (const recu of donnees.recus ?? []) await enregistrer('recus', recu);

  const base = await ouvrirBase();
  for (const image of donnees.images ?? []) {
    await base.put('images', {
      id: image.id,
      typeMime: image.typeMime,
      enveloppe: await coffre.chiffrerBinaire(image.octets),
    });
  }
  for (const reglage of donnees.reglages ?? []) {
    await base.put('reglages', reglage);
  }
}

/**
 * Efface toutes les donnees de l'application.
 * @param {{garderReglages?: boolean}} options
 */
export async function effacerTout({ garderReglages = true } = {}) {
  const base = await ouvrirBase();
  const magasins = [...MAGASINS_EN_CACHE, 'images'];
  if (!garderReglages) magasins.push('reglages');

  const transaction = base.transaction(magasins, 'readwrite');
  await Promise.all(magasins.map((magasin) => transaction.objectStore(magasin).clear()));
  await transaction.done;

  cache = null;
}
