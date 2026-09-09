/*
 * PHRASE DE RECUPERATION (norme BIP39)
 *
 * Une phrase de recuperation est une suite de 12 mots qui represente un
 * secret de 128 bits. Elle sert de deuxieme cle du coffre : si le code PIN
 * est oublie, la phrase permet de rouvrir les donnees.
 *
 * Pourquoi des mots plutot qu'une longue suite de caracteres ? Parce qu'une
 * personne peut les recopier sur une feuille de papier sans se tromper, et
 * les relire des mois plus tard. C'est la norme utilisee par les
 * portefeuilles de cryptomonnaies depuis 2013.
 *
 * COMMENT CA MARCHE (en resume)
 *   1. on tire 16 octets au hasard = 128 bits ;
 *   2. on calcule leur empreinte SHA-256 et on ajoute les 4 premiers bits de
 *      cette empreinte a la fin -> 132 bits ;
 *   3. on decoupe ces 132 bits en 12 morceaux de 11 bits ;
 *   4. chaque morceau (une valeur de 0 a 2047) designe un mot de la liste.
 *
 * Les 4 bits ajoutes forment une « somme de controle » : si l'utilisateur se
 * trompe d'un mot en recopiant sa phrase, le calcul ne retombe pas juste et
 * on peut le prevenir immediatement, avant meme d'essayer de dechiffrer.
 */

import { MOTS_BIP39 } from './motsBip39.js';
import { octetsAleatoires } from './crypto.js';

const NOMBRE_DE_MOTS = 12;
const OCTETS_ENTROPIE = 16; // 128 bits

/** Transforme des octets en une chaine de bits ("01001010..."). */
function octetsVersBits(octets) {
  return Array.from(octets)
    .map((octet) => octet.toString(2).padStart(8, '0'))
    .join('');
}

/** Calcule l'empreinte SHA-256 d'une suite d'octets. */
async function empreinte(octets) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', octets));
}

/**
 * Nettoie une phrase saisie par l'utilisateur :
 * minuscules, espaces multiples et retours a la ligne ramenes a un seul
 * espace, espaces en trop supprimes.
 */
export function normaliserPhrase(phrase) {
  return String(phrase)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * Transforme 16 octets d'entropie en une phrase de 12 mots.
 * @param {Uint8Array} entropie
 * @returns {Promise<string>}
 */
export async function entropieVersPhrase(entropie) {
  if (entropie.length !== OCTETS_ENTROPIE) {
    throw new Error(`L’entropie doit faire ${OCTETS_ENTROPIE} octets.`);
  }

  const bitsEntropie = octetsVersBits(entropie);
  // 128 bits d'entropie -> 4 bits de controle (128 / 32).
  const nbBitsControle = (entropie.length * 8) / 32;
  const bitsControle = octetsVersBits(await empreinte(entropie)).slice(0, nbBitsControle);

  const tousLesBits = bitsEntropie + bitsControle;

  const mots = [];
  for (let i = 0; i < NOMBRE_DE_MOTS; i++) {
    const morceau = tousLesBits.slice(i * 11, (i + 1) * 11);
    mots.push(MOTS_BIP39[parseInt(morceau, 2)]);
  }
  return mots.join(' ');
}

/** Tire une nouvelle phrase de recuperation au hasard. */
export async function genererPhrase() {
  return entropieVersPhrase(octetsAleatoires(OCTETS_ENTROPIE));
}

/**
 * Verifie une phrase et en extrait le secret de 128 bits.
 *
 * @returns {Promise<{valide: boolean, raison?: string, entropie?: Uint8Array}>}
 *   "raison" contient un message directement affichable a l'utilisateur.
 */
export async function verifierPhrase(phrase) {
  const mots = normaliserPhrase(phrase).split(' ').filter(Boolean);

  if (mots.length !== NOMBRE_DE_MOTS) {
    return {
      valide: false,
      raison: `La phrase doit contenir exactement ${NOMBRE_DE_MOTS} mots (${mots.length} saisi${mots.length > 1 ? 's' : ''}).`,
    };
  }

  const inconnus = mots.filter((mot) => !MOTS_BIP39.includes(mot));
  if (inconnus.length > 0) {
    return {
      valide: false,
      raison: `Mot inconnu : « ${inconnus[0]} ». Vérifiez l’orthographe.`,
    };
  }

  // On reconstruit la suite de bits a partir des indices des mots.
  const bits = mots
    .map((mot) => MOTS_BIP39.indexOf(mot).toString(2).padStart(11, '0'))
    .join('');

  const nbBitsControle = bits.length / 33; // 132 / 33 = 4
  const bitsEntropie = bits.slice(0, bits.length - nbBitsControle);
  const bitsControle = bits.slice(bits.length - nbBitsControle);

  const entropie = new Uint8Array(bitsEntropie.length / 8);
  for (let i = 0; i < entropie.length; i++) {
    entropie[i] = parseInt(bitsEntropie.slice(i * 8, i * 8 + 8), 2);
  }

  const controleAttendu = octetsVersBits(await empreinte(entropie)).slice(0, nbBitsControle);
  if (controleAttendu !== bitsControle) {
    return {
      valide: false,
      raison:
        'Cette phrase n’est pas valide : un mot est probablement mal recopié ou dans le mauvais ordre.',
    };
  }

  return { valide: true, entropie };
}

/**
 * Propose des mots commencant par ce que l'utilisateur a tape.
 * Utile pour la saisie sur telephone, ou une faute de frappe est vite arrivee.
 */
export function suggererMots(debut, maximum = 5) {
  const prefixe = normaliserPhrase(debut);
  if (prefixe.length < 2) return [];
  return MOTS_BIP39.filter((mot) => mot.startsWith(prefixe)).slice(0, maximum);
}
