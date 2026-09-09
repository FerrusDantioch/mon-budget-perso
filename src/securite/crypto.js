/*
 * BOITE A OUTILS DE CHIFFREMENT
 *
 * Tout passe par la « Web Crypto API », le module de cryptographie integre au
 * navigateur. Aucune librairie exterieure n'est utilisee : le code de
 * chiffrement est celui du navigateur lui-meme, audite et mis a jour avec lui.
 *
 * Deux briques seulement :
 *
 *   AES-256-GCM  — l'algorithme qui rend les donnees illisibles.
 *                  « GCM » ajoute une signature : si un octet du fichier
 *                  chiffre est modifie, le dechiffrement echoue au lieu de
 *                  renvoyer n'importe quoi. C'est ce qui permet de detecter
 *                  un mauvais mot de passe de facon fiable.
 *
 *   PBKDF2       — transforme un mot de passe (ou un code PIN) en cle de
 *                  chiffrement. Il repete volontairement le calcul des
 *                  centaines de milliers de fois : c'est imperceptible pour
 *                  une personne qui tape son code, mais cela rend un essai
 *                  systematique de tous les codes extremement lent.
 */

// Nombre de repetitions de PBKDF2. La recommandation OWASP pour PBKDF2-SHA256
// est de 600 000 ; on retient 310 000, qui reste tres au-dessus du minimum de
// 100 000 tout en gardant un deverrouillage rapide sur un telephone d'entree
// de gamme (environ un tiers de seconde).
export const ITERATIONS_PAR_DEFAUT = 310000;

// Taille du vecteur d'initialisation d'AES-GCM : 12 octets, la valeur
// recommandee. Il est tire au hasard a CHAQUE chiffrement et stocke a cote du
// resultat — ce n'est pas un secret, mais il ne doit jamais etre reutilise
// deux fois avec la meme cle.
const TAILLE_IV = 12;

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/** Renvoie n octets tires au hasard par le generateur securise du navigateur. */
export function octetsAleatoires(n) {
  const octets = new Uint8Array(n);
  crypto.getRandomValues(octets);
  return octets;
}

/** Texte -> octets (UTF-8). */
export function texteVersOctets(texte) {
  return new TextEncoder().encode(texte);
}

/** Octets -> texte (UTF-8). */
export function octetsVersTexte(octets) {
  return new TextDecoder().decode(octets);
}

/**
 * Octets -> base64. Le base64 represente des donnees binaires avec des
 * caracteres ordinaires : indispensable pour les ecrire dans un fichier JSON.
 */
export function octetsVersBase64(octets) {
  const tableau = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  // On decoupe en tranches : passer un tableau de plusieurs millions d'octets
  // d'un seul coup a String.fromCharCode ferait planter le navigateur.
  let binaire = '';
  const tranche = 0x8000;
  for (let i = 0; i < tableau.length; i += tranche) {
    binaire += String.fromCharCode.apply(null, tableau.subarray(i, i + tranche));
  }
  return btoa(binaire);
}

/** base64 -> octets. */
export function base64VersOctets(base64) {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/**
 * Compare deux suites d'octets en temps constant.
 * Une comparaison ordinaire s'arrete au premier octet different : le temps de
 * reponse renseignerait alors un attaquant sur le nombre d'octets corrects.
 */
export function comparerOctets(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

// ---------------------------------------------------------------------------
// Cles
// ---------------------------------------------------------------------------

/**
 * Fabrique une cle AES-256 a partir d'un mot de passe ou d'un code PIN.
 *
 * @param {string|Uint8Array} secret   ce que connait l'utilisateur
 * @param {Uint8Array} sel             valeur aleatoire propre a cet appareil,
 *   stockee en clair. Elle empeche l'usage de tables de correspondance
 *   pre-calculees : le meme code PIN donne une cle differente sur chaque
 *   appareil.
 * @param {number} iterations
 */
export async function deriverCle(secret, sel, iterations = ITERATIONS_PAR_DEFAUT) {
  const matiere = typeof secret === 'string' ? texteVersOctets(secret) : secret;

  const cleDeBase = await crypto.subtle.importKey('raw', matiere, 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' },
    cleDeBase,
    { name: 'AES-GCM', length: 256 },
    false, // la cle derivee n'a pas besoin d'etre extractible
    ['encrypt', 'decrypt']
  );
}

/**
 * Cree une cle AES-256 entierement aleatoire : c'est la « cle du coffre »,
 * celle qui chiffre reellement les donnees.
 * Elle est marquee extractible car elle doit pouvoir etre emballee (chiffree)
 * par le code PIN, la biometrie ou la phrase de recuperation.
 */
export function genererCleCoffre() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/** Transforme une cle en octets bruts (32 octets pour l'AES-256). */
export async function exporterCle(cle) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', cle));
}

/** Reconstruit une cle a partir de ses octets bruts. */
export function importerCle(octets, extractible = true) {
  return crypto.subtle.importKey('raw', octets, { name: 'AES-GCM', length: 256 }, extractible, [
    'encrypt',
    'decrypt',
  ]);
}

// ---------------------------------------------------------------------------
// Chiffrement / dechiffrement
// ---------------------------------------------------------------------------

/**
 * Chiffre des octets.
 * @returns {{iv: Uint8Array, donnees: Uint8Array}} l'« enveloppe » a stocker
 */
export async function chiffrerOctets(cle, octets) {
  const iv = octetsAleatoires(TAILLE_IV);
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, octets);
  return { iv, donnees: new Uint8Array(chiffre) };
}

/**
 * Dechiffre une enveloppe.
 * @throws {Error} si la cle est fausse ou si les donnees ont ete modifiees
 */
export async function dechiffrerOctets(cle, enveloppe) {
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: enveloppe.iv },
    cle,
    enveloppe.donnees
  );
  return new Uint8Array(clair);
}

/** Chiffre n'importe quelle valeur JavaScript (objet, tableau, nombre...). */
export async function chiffrerValeur(cle, valeur) {
  return chiffrerOctets(cle, texteVersOctets(JSON.stringify(valeur)));
}

/** Dechiffre une valeur produite par chiffrerValeur. */
export async function dechiffrerValeur(cle, enveloppe) {
  const octets = await dechiffrerOctets(cle, enveloppe);
  return JSON.parse(octetsVersTexte(octets));
}

/**
 * « Emballe » la cle du coffre avec une autre cle (celle derivee du code PIN,
 * de la biometrie ou de la phrase de recuperation).
 *
 * C'est le point central de toute la securite de l'application : les donnees
 * sont chiffrees UNE SEULE FOIS, avec la cle du coffre. On garde ensuite
 * plusieurs copies de cette cle, chacune protegee par un moyen different.
 * Changer de code PIN ne demande donc pas de rechiffrer toutes les depenses,
 * et la phrase de recuperation permet de rouvrir le coffre sans le code.
 */
export async function emballerCleCoffre(cleCoffre, cleEmballage) {
  const brut = await exporterCle(cleCoffre);
  return chiffrerOctets(cleEmballage, brut);
}

/** Operation inverse : retrouve la cle du coffre a partir d'une enveloppe. */
export async function deballerCleCoffre(enveloppe, cleEmballage) {
  const brut = await dechiffrerOctets(cleEmballage, enveloppe);
  return importerCle(brut, true);
}

/**
 * Derive une cle a partir d'un secret DEJA aleatoire (celui fourni par la
 * puce biometrique, ou une entropie de phrase de recuperation).
 *
 * On utilise HKDF et non PBKDF2 : PBKDF2 sert a ralentir la recherche
 * exhaustive d'un secret devinable (un code a 4 chiffres, un mot de passe).
 * Ici le secret fait deja 128 a 256 bits tires au hasard : il est hors de
 * portee d'une recherche exhaustive, et le ralentir n'apporterait rien
 * d'autre qu'une attente inutile a chaque deverrouillage.
 *
 * @param {Uint8Array} secret
 * @param {Uint8Array} sel
 * @param {string} usage  etiquette qui distingue deux cles derivees du meme
 *                        secret (« biometrie », « phrase »...)
 */
export async function deriverCleDepuisSecret(secret, sel, usage) {
  const matiere = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: sel, info: texteVersOctets(usage) },
    matiere,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
