/*
 * DEVERROUILLAGE PAR BIOMETRIE (empreinte, visage, Windows Hello)
 *
 * On utilise WebAuthn, la norme qui permet a un site web de demander au
 * telephone de verifier l'identite de son proprietaire.
 *
 * POINT IMPORTANT ET SOUVENT MAL COMPRIS
 * --------------------------------------
 * WebAuthn repond normalement par « oui, c'est bien la bonne personne ». Si
 * l'application se contentait de cette reponse pour ouvrir le coffre, elle
 * devrait garder la cle de dechiffrement quelque part en clair : n'importe
 * qui pourrait alors la recuperer sans jamais poser le doigt sur le capteur.
 * Ce serait une securite de facade.
 *
 * On exige donc l'extension « PRF » de WebAuthn. Elle demande a la puce
 * securisee du telephone de fabriquer un secret, toujours le meme pour notre
 * application, mais impossible a obtenir sans une verification biometrique
 * reussie. C'est ce secret qui protege la cle du coffre : la biometrie
 * devient une vraie protection cryptographique, pas un simple portail.
 *
 * Consequence assumee : si l'appareil ne gere pas PRF, on n'active PAS la
 * biometrie et on l'explique clairement, plutot que de faire semblant.
 * Le code PIN reste de toute facon toujours utilisable.
 */

import { octetsAleatoires, texteVersOctets } from './crypto.js';

/**
 * Valeur fixe fournie a la puce securisee pour fabriquer le secret.
 * Elle n'est pas confidentielle : c'est juste une etiquette qui garantit
 * qu'on obtient toujours le meme secret pour cette application.
 */
const ETIQUETTE_PRF = texteVersOctets('budget-perso/coffre/v1');

/** Erreur levee quand l'appareil ne sait pas fabriquer de secret (PRF). */
export class ErreurBiometrieNonSupportee extends Error {
  constructor(message) {
    super(
      message ??
        'Cet appareil ne permet pas un déverrouillage biométrique sécurisé. Le code PIN reste utilisé.'
    );
    this.name = 'ErreurBiometrieNonSupportee';
  }
}

/** Erreur levee quand l'utilisateur annule ou echoue la verification. */
export class ErreurBiometrieRefusee extends Error {
  constructor(message) {
    super(message ?? 'Vérification biométrique annulée ou non reconnue.');
    this.name = 'ErreurBiometrieRefusee';
  }
}

/**
 * Y a-t-il un capteur biometrique utilisable sur cet appareil ?
 * Ne dit pas encore si PRF fonctionne : cela ne se sait qu'a l'inscription.
 */
export async function capteurDisponible() {
  try {
    if (typeof window === 'undefined') return false;
    if (!window.PublicKeyCredential) return false;
    if (!window.isSecureContext) return false; // WebAuthn exige HTTPS
    if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (probleme) {
    return false;
  }
}

/**
 * Inscrit l'appareil et renvoie de quoi proteger la cle du coffre.
 *
 * @returns {Promise<{identifiant: Uint8Array, secret: Uint8Array}>}
 *   "identifiant" est a conserver (il n'est pas secret) ; "secret" sert
 *   immediatement a emballer la cle du coffre, puis est oublie.
 */
export async function inscrireAppareil() {
  if (!(await capteurDisponible())) {
    throw new ErreurBiometrieNonSupportee(
      'Aucun capteur biométrique disponible sur cet appareil.'
    );
  }

  let identifiants;
  try {
    identifiants = await navigator.credentials.create({
      publicKey: {
        challenge: octetsAleatoires(32),
        rp: { name: 'Omni-Budget' },
        user: {
          // Aucune donnee personnelle : l'application n'a pas de comptes.
          id: octetsAleatoires(16),
          name: 'budget-local',
          displayName: 'Omni-Budget',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          // "platform" = le capteur integre a l'appareil, pas une cle USB.
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
        extensions: { prf: {} },
      },
    });
  } catch (probleme) {
    throw new ErreurBiometrieRefusee(
      'L’enregistrement biométrique a été annulé ou refusé par l’appareil.'
    );
  }

  if (!identifiants) throw new ErreurBiometrieRefusee();

  // L'appareil declare-t-il savoir fabriquer un secret ?
  const extensions = identifiants.getClientExtensionResults?.() ?? {};
  if (!extensions.prf?.enabled) {
    throw new ErreurBiometrieNonSupportee();
  }

  const identifiant = new Uint8Array(identifiants.rawId);

  // On demande le secret tout de suite : certains appareils ne le fournissent
  // qu'a la premiere verification, jamais a l'inscription.
  const secret = await obtenirSecret(identifiant);

  return { identifiant, secret };
}

/**
 * Demande la verification biometrique et recupere le secret de l'appareil.
 * @param {Uint8Array} identifiant celui renvoye par inscrireAppareil
 * @returns {Promise<Uint8Array>} 32 octets, toujours identiques sur cet appareil
 */
export async function obtenirSecret(identifiant) {
  let assertion;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge: octetsAleatoires(32),
        allowCredentials: [{ type: 'public-key', id: identifiant }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: ETIQUETTE_PRF } } },
      },
    });
  } catch (probleme) {
    throw new ErreurBiometrieRefusee();
  }

  if (!assertion) throw new ErreurBiometrieRefusee();

  const resultats = assertion.getClientExtensionResults?.() ?? {};
  const premier = resultats.prf?.results?.first;
  if (!premier) {
    throw new ErreurBiometrieNonSupportee();
  }

  return new Uint8Array(premier);
}
