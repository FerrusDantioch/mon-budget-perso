/*
 * LE COFFRE
 *
 * C'est lui qui detient la cle de chiffrement pendant que l'application est
 * ouverte, et qui la met a l'abri quand elle se verrouille.
 *
 * PRINCIPE GENERAL
 * ----------------
 * Une seule cle chiffre reellement les donnees : la « cle du coffre ». Elle
 * est tiree entierement au hasard, elle n'est jamais stockee en clair, et
 * elle n'existe en memoire que pendant que l'application est deverrouillee.
 *
 * On en conserve jusqu'a trois copies, chacune enfermee derriere un moyen
 * different :
 *
 *      code PIN  ──PBKDF2──▶ cle A ──chiffre──▶ [copie 1 de la cle du coffre]
 *     biometrie  ──HKDF────▶ cle B ──chiffre──▶ [copie 2 de la cle du coffre]
 *   phrase 12 mots ─HKDF──▶ cle C ──chiffre──▶ [copie 3 de la cle du coffre]
 *
 * Consequences pratiques :
 *   - changer de code PIN ne rechiffre que 32 octets, pas toutes les depenses ;
 *   - perdre le code n'est pas fatal si la phrase de recuperation existe ;
 *   - desactiver la biometrie n'efface que la copie 2.
 *
 * LIMITE ASSUMEE ET IMPORTANTE
 * ----------------------------
 * Un code a 4 chiffres n'offre que 10 000 possibilites. Quelqu'un qui
 * copierait la base de donnees sur un ordinateur puissant finirait par les
 * essayer toutes. Les 310 000 repetitions de PBKDF2 ralentissent enormement
 * cette recherche, et le blocage de 5 minutes apres 3 erreurs la rend
 * impossible depuis l'application elle-meme — mais le code PIN protege
 * surtout contre quelqu'un qui prend le telephone en main, pas contre une
 * analyse en laboratoire. Un code a 6 chiffres est nettement plus solide.
 */

import {
  ITERATIONS_PAR_DEFAUT,
  chiffrerOctets,
  chiffrerValeur,
  dechiffrerOctets,
  dechiffrerValeur,
  deballerCleCoffre,
  deriverCle,
  deriverCleDepuisSecret,
  emballerCleCoffre,
  genererCleCoffre,
  octetsAleatoires,
} from './crypto.js';
import { entropieVersPhrase, verifierPhrase } from './bip39.js';
import { inscrireAppareil, obtenirSecret } from './biometrie.js';
import { lireSecurite, ecrireSecurite } from '../donnees/connexion.js';

const CLE_CONFIGURATION = 'coffre';
const CLE_TENTATIVES = 'tentatives';

/** Nombre d'essais avant blocage temporaire. */
export const ESSAIS_AVANT_BLOCAGE = 3;

/** Duree du blocage, en millisecondes (5 minutes). */
export const DUREE_BLOCAGE = 5 * 60 * 1000;

/** Longueurs de code acceptees. */
export const LONGUEUR_CODE_MIN = 4;
export const LONGUEUR_CODE_MAX = 6;

// La cle du coffre, uniquement en memoire vive. Elle disparait au
// verrouillage, a la fermeture de l'onglet et a l'extinction du telephone.
let cleDuCoffre = null;

// Fonctions prevenues quand le coffre se verrouille (pour vider les caches).
const abonnesAuVerrouillage = new Set();

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export class ErreurCodeIncorrect extends Error {
  constructor() {
    super('Code incorrect.');
    this.name = 'ErreurCodeIncorrect';
  }
}

export class ErreurCoffreFerme extends Error {
  constructor() {
    super('Le coffre est verrouillé : impossible de lire ou d’écrire des données.');
    this.name = 'ErreurCoffreFerme';
  }
}

export class ErreurBlocage extends Error {
  constructor(secondesRestantes) {
    super(`Trop d’essais. Réessayez dans ${Math.ceil(secondesRestantes / 60)} minute(s).`);
    this.name = 'ErreurBlocage';
    this.secondesRestantes = secondesRestantes;
  }
}

// ---------------------------------------------------------------------------
// Etat du coffre
// ---------------------------------------------------------------------------

/** Un code a-t-il deja ete defini sur cet appareil ? */
export async function coffreConfigure() {
  return (await lireSecurite(CLE_CONFIGURATION)) !== null;
}

/** Le coffre est-il ouvert (donnees accessibles) ? */
export function coffreOuvert() {
  return cleDuCoffre !== null;
}

/** Ferme le coffre : la cle est oubliee, les donnees redeviennent illisibles. */
export function verrouiller() {
  cleDuCoffre = null;
  for (const prevenir of abonnesAuVerrouillage) {
    try {
      prevenir();
    } catch (probleme) {
      console.error('Erreur pendant le verrouillage', probleme);
    }
  }
}

/** Permet a d'autres modules (le cache des donnees) de reagir au verrouillage. */
export function surVerrouillage(fonction) {
  abonnesAuVerrouillage.add(fonction);
  return () => abonnesAuVerrouillage.delete(fonction);
}

/** Resume de la configuration, pour l'ecran des reglages. */
export async function etatDuCoffre() {
  const configuration = await lireSecurite(CLE_CONFIGURATION);
  return {
    configure: configuration !== null,
    ouvert: coffreOuvert(),
    biometrieActive: Boolean(configuration?.emballageBiometrie),
    phraseActive: Boolean(configuration?.emballagePhrase),
    longueurCode: configuration?.longueurCode ?? null,
  };
}

// ---------------------------------------------------------------------------
// Compteur d'essais et blocage temporaire
// ---------------------------------------------------------------------------

/**
 * Etat du blocage apres des codes errones.
 * Le compteur est enregistre dans la base (et non en memoire) : recharger la
 * page ou fermer l'application ne le remet pas a zero.
 */
export async function etatBlocage() {
  const tentatives = (await lireSecurite(CLE_TENTATIVES)) ?? { echecs: 0, bloqueJusqua: 0 };
  const maintenant = Date.now();

  if (tentatives.bloqueJusqua > maintenant) {
    return {
      bloque: true,
      secondesRestantes: Math.ceil((tentatives.bloqueJusqua - maintenant) / 1000),
      essaisRestants: 0,
    };
  }

  return {
    bloque: false,
    secondesRestantes: 0,
    essaisRestants: Math.max(0, ESSAIS_AVANT_BLOCAGE - tentatives.echecs),
  };
}

async function enregistrerEchec() {
  const tentatives = (await lireSecurite(CLE_TENTATIVES)) ?? { echecs: 0, bloqueJusqua: 0 };
  const echecs = tentatives.echecs + 1;

  if (echecs >= ESSAIS_AVANT_BLOCAGE) {
    // Blocage, et remise du compteur a zero : apres les 5 minutes,
    // l'utilisateur repart avec trois essais.
    await ecrireSecurite(CLE_TENTATIVES, { echecs: 0, bloqueJusqua: Date.now() + DUREE_BLOCAGE });
  } else {
    await ecrireSecurite(CLE_TENTATIVES, { echecs, bloqueJusqua: 0 });
  }
}

async function reinitialiserEchecs() {
  await ecrireSecurite(CLE_TENTATIVES, { echecs: 0, bloqueJusqua: 0 });
}

/** Verifie qu'on a le droit d'essayer un code maintenant. */
async function verifierQueLesEssaisSontPermis() {
  const blocage = await etatBlocage();
  if (blocage.bloque) throw new ErreurBlocage(blocage.secondesRestantes);
}

// ---------------------------------------------------------------------------
// Creation et ouverture
// ---------------------------------------------------------------------------

/** Verifie qu'un code est acceptable avant de l'enregistrer. */
export function codeValide(code) {
  return (
    typeof code === 'string' &&
    new RegExp(`^\\d{${LONGUEUR_CODE_MIN},${LONGUEUR_CODE_MAX}}$`).test(code)
  );
}

/**
 * Cree le coffre au tout premier lancement et l'ouvre immediatement.
 * @param {string} code 4 a 6 chiffres
 */
export async function creerCoffre(code) {
  if (!codeValide(code)) {
    throw new Error(
      `Le code doit contenir entre ${LONGUEUR_CODE_MIN} et ${LONGUEUR_CODE_MAX} chiffres.`
    );
  }

  const cle = await genererCleCoffre();
  const sel = octetsAleatoires(16);
  const cleDuCode = await deriverCle(code, sel, ITERATIONS_PAR_DEFAUT);

  await ecrireSecurite(CLE_CONFIGURATION, {
    version: 1,
    sel,
    iterations: ITERATIONS_PAR_DEFAUT,
    longueurCode: code.length,
    emballagePin: await emballerCleCoffre(cle, cleDuCode),
    emballageBiometrie: null,
    emballagePhrase: null,
    creeLe: Date.now(),
  });

  await reinitialiserEchecs();
  cleDuCoffre = cle;
}

/**
 * Ouvre le coffre avec le code PIN.
 * @throws {ErreurBlocage} si trop d'essais ont deja echoue
 * @throws {ErreurCodeIncorrect} si le code est faux
 */
export async function ouvrirAvecCode(code) {
  await verifierQueLesEssaisSontPermis();

  const configuration = await lireSecurite(CLE_CONFIGURATION);
  if (!configuration) throw new Error('Aucun code n’a été défini sur cet appareil.');

  const cleDuCode = await deriverCle(code, configuration.sel, configuration.iterations);

  try {
    // Si le code est faux, la cle derivee est fausse : AES-GCM detecte la
    // signature invalide et leve une exception. C'est ce qui rend la
    // verification fiable sans jamais stocker le code lui-meme.
    cleDuCoffre = await deballerCleCoffre(configuration.emballagePin, cleDuCode);
  } catch (probleme) {
    await enregistrerEchec();
    throw new ErreurCodeIncorrect();
  }

  await reinitialiserEchecs();
}

/**
 * Ouvre le coffre avec la biometrie.
 * Toute erreur (capteur indisponible, doigt non reconnu, annulation) est
 * remontee telle quelle : l'appelant se rabat alors sur le code PIN.
 */
export async function ouvrirAvecBiometrie() {
  const configuration = await lireSecurite(CLE_CONFIGURATION);
  if (!configuration?.emballageBiometrie) {
    throw new Error('La biométrie n’est pas activée sur cet appareil.');
  }

  const { identifiant, sel, enveloppe } = configuration.emballageBiometrie;
  const secret = await obtenirSecret(identifiant);
  const cleBiometrie = await deriverCleDepuisSecret(secret, sel, 'biometrie');

  cleDuCoffre = await deballerCleCoffre(enveloppe, cleBiometrie);
  await reinitialiserEchecs();
}

/**
 * Ouvre le coffre avec la phrase de recuperation de 12 mots.
 * @returns {Promise<{ouvert: boolean, raison?: string}>}
 */
export async function ouvrirAvecPhrase(phrase) {
  const configuration = await lireSecurite(CLE_CONFIGURATION);
  if (!configuration?.emballagePhrase) {
    return {
      ouvert: false,
      raison: 'Aucune phrase de récupération n’a été créée sur cet appareil.',
    };
  }

  const verification = await verifierPhrase(phrase);
  if (!verification.valide) return { ouvert: false, raison: verification.raison };

  const { sel, enveloppe } = configuration.emballagePhrase;
  const clePhrase = await deriverCleDepuisSecret(verification.entropie, sel, 'phrase');

  try {
    cleDuCoffre = await deballerCleCoffre(enveloppe, clePhrase);
  } catch (probleme) {
    return {
      ouvert: false,
      raison: 'Cette phrase ne correspond pas à celle enregistrée sur cet appareil.',
    };
  }

  await reinitialiserEchecs();
  return { ouvert: true };
}

// ---------------------------------------------------------------------------
// Modification de la configuration (coffre ouvert obligatoire)
// ---------------------------------------------------------------------------

function exigerCoffreOuvert() {
  if (!cleDuCoffre) throw new ErreurCoffreFerme();
}

/** Change le code PIN. L'ancien est verifie au prealable. */
export async function changerCode(ancienCode, nouveauCode) {
  exigerCoffreOuvert();
  if (!codeValide(nouveauCode)) {
    throw new Error(
      `Le code doit contenir entre ${LONGUEUR_CODE_MIN} et ${LONGUEUR_CODE_MAX} chiffres.`
    );
  }

  const configuration = await lireSecurite(CLE_CONFIGURATION);
  const cleAncienne = await deriverCle(ancienCode, configuration.sel, configuration.iterations);
  try {
    await deballerCleCoffre(configuration.emballagePin, cleAncienne);
  } catch (probleme) {
    throw new ErreurCodeIncorrect();
  }

  // Nouveau sel a chaque changement de code.
  const sel = octetsAleatoires(16);
  const cleNouvelle = await deriverCle(nouveauCode, sel, ITERATIONS_PAR_DEFAUT);

  await ecrireSecurite(CLE_CONFIGURATION, {
    ...configuration,
    sel,
    iterations: ITERATIONS_PAR_DEFAUT,
    longueurCode: nouveauCode.length,
    emballagePin: await emballerCleCoffre(cleDuCoffre, cleNouvelle),
  });
}

/**
 * Active la biometrie : demande une verification, puis range une copie de la
 * cle du coffre protegee par le secret de la puce.
 */
export async function activerBiometrie() {
  exigerCoffreOuvert();

  const { identifiant, secret } = await inscrireAppareil();
  const sel = octetsAleatoires(16);
  const cleBiometrie = await deriverCleDepuisSecret(secret, sel, 'biometrie');

  const configuration = await lireSecurite(CLE_CONFIGURATION);
  await ecrireSecurite(CLE_CONFIGURATION, {
    ...configuration,
    emballageBiometrie: {
      identifiant,
      sel,
      enveloppe: await emballerCleCoffre(cleDuCoffre, cleBiometrie),
    },
  });
}

/** Desactive la biometrie : la copie de la cle qu'elle protegeait est effacee. */
export async function desactiverBiometrie() {
  const configuration = await lireSecurite(CLE_CONFIGURATION);
  if (!configuration) return;
  await ecrireSecurite(CLE_CONFIGURATION, { ...configuration, emballageBiometrie: null });
}

/**
 * Cree une phrase de recuperation de 12 mots et range une copie de la cle du
 * coffre protegee par cette phrase.
 *
 * @returns {Promise<string>} la phrase, a montrer UNE SEULE FOIS. Elle n'est
 *   jamais reaffichable ensuite : seule sa version chiffree est conservee.
 */
export async function creerPhraseRecuperation() {
  exigerCoffreOuvert();

  const entropie = octetsAleatoires(16);
  const phrase = await entropieVersPhrase(entropie);

  const sel = octetsAleatoires(16);
  const clePhrase = await deriverCleDepuisSecret(entropie, sel, 'phrase');

  const configuration = await lireSecurite(CLE_CONFIGURATION);
  await ecrireSecurite(CLE_CONFIGURATION, {
    ...configuration,
    emballagePhrase: {
      sel,
      enveloppe: await emballerCleCoffre(cleDuCoffre, clePhrase),
      creeeLe: Date.now(),
    },
  });

  return phrase;
}

/** Supprime la phrase de recuperation enregistree. */
export async function supprimerPhraseRecuperation() {
  const configuration = await lireSecurite(CLE_CONFIGURATION);
  if (!configuration) return;
  await ecrireSecurite(CLE_CONFIGURATION, { ...configuration, emballagePhrase: null });
}

// ---------------------------------------------------------------------------
// Chiffrement des donnees de l'application
// ---------------------------------------------------------------------------

/** Chiffre un objet (une depense, une categorie...) avec la cle du coffre. */
export async function chiffrer(valeur) {
  exigerCoffreOuvert();
  return chiffrerValeur(cleDuCoffre, valeur);
}

/** Dechiffre un objet range par chiffrer(). */
export async function dechiffrer(enveloppe) {
  exigerCoffreOuvert();
  return dechiffrerValeur(cleDuCoffre, enveloppe);
}

/** Chiffre des donnees binaires (la photo d'un reçu, par exemple). */
export async function chiffrerBinaire(octets) {
  exigerCoffreOuvert();
  return chiffrerOctets(cleDuCoffre, octets);
}

/** Dechiffre des donnees binaires. */
export async function dechiffrerBinaire(enveloppe) {
  exigerCoffreOuvert();
  return dechiffrerOctets(cleDuCoffre, enveloppe);
}

/**
 * Ouvre le coffre avec une cle deja connue.
 * Reserve a la restauration d'une sauvegarde et aux tests automatises.
 */
export function ouvrirAvecCleBrute(cle) {
  cleDuCoffre = cle;
}
