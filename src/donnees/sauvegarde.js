/*
 * SAUVEGARDE ET RESTAURATION
 *
 * Deux formats de sortie, tres differents :
 *
 *   1. LA SAUVEGARDE (.json) — CHIFFREE.
 *      C'est la copie complete de vos donnees, protegee par un mot de passe
 *      maitre que vous choisissez. Ce mot de passe n'est stocke NULLE PART :
 *      ni dans l'application, ni dans le fichier. Sans lui, le fichier est
 *      definitivement illisible, y compris pour nous.
 *
 *   2. L'EXPORT TABLEUR (.csv) — EN CLAIR.
 *      Pour ouvrir vos depenses dans Excel ou LibreOffice. Ce fichier n'est
 *      PAS protege : n'importe qui peut le lire. L'interface le rappelle
 *      explicitement avant chaque export.
 *
 * A quoi ressemble une sauvegarde ouverte dans un editeur de texte :
 *
 *   {
 *     "format": "budget-perso-sauvegarde",
 *     "version": 1,
 *     "chiffrement": { "sel": "...", "iv": "...", "iterations": 310000 },
 *     "donnees": "8Kd2mQ..."     <- illisible sans le mot de passe
 *   }
 *
 * Le sel et le vecteur d'initialisation ne sont pas des secrets : ils sont
 * indispensables pour refaire le calcul au moment de la restauration.
 */

import {
  ITERATIONS_PAR_DEFAUT,
  base64VersOctets,
  chiffrerOctets,
  dechiffrerOctets,
  deriverCle,
  octetsAleatoires,
  octetsVersBase64,
  octetsVersTexte,
  texteVersOctets,
} from '../securite/crypto.js';
import { exporterTout, remplacerTout } from './basededonnees.js';
import { formaterMontant } from '../utils/monnaie.js';

const FORMAT = 'budget-perso-sauvegarde';
const VERSION_FORMAT = 1;

/** Longueur minimale exigee pour le mot de passe maitre. */
export const LONGUEUR_MOT_DE_PASSE_MIN = 8;

export class ErreurMotDePasse extends Error {
  constructor() {
    super(
      'Mot de passe incorrect, ou fichier de sauvegarde endommagé. ' +
        'Aucune donnée n’a été modifiée.'
    );
    this.name = 'ErreurMotDePasse';
  }
}

export class ErreurFichierInvalide extends Error {
  constructor(details) {
    super(`Ce fichier n’est pas une sauvegarde Budget valide${details ? ` (${details})` : ''}.`);
    this.name = 'ErreurFichierInvalide';
  }
}

/**
 * Evalue la solidite d'un mot de passe, pour guider l'utilisateur.
 * @returns {{niveau: 'faible'|'moyen'|'bon', message: string, acceptable: boolean}}
 */
export function evaluerMotDePasse(motDePasse) {
  const longueur = motDePasse.length;

  if (longueur < LONGUEUR_MOT_DE_PASSE_MIN) {
    return {
      niveau: 'faible',
      acceptable: false,
      message: `Trop court : ${LONGUEUR_MOT_DE_PASSE_MIN} caractères minimum.`,
    };
  }

  // On compte les familles de caracteres utilisees plutot que d'imposer des
  // regles arbitraires : une phrase longue vaut mieux qu'un « P@ssw0rd ».
  const familles = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) => r.test(motDePasse)).length;

  if (longueur >= 16 || (longueur >= 12 && familles >= 3)) {
    return { niveau: 'bon', acceptable: true, message: 'Mot de passe solide.' };
  }
  if (longueur >= 10 || familles >= 3) {
    return {
      niveau: 'moyen',
      acceptable: true,
      message: 'Correct. Une phrase de plusieurs mots serait encore plus sûre.',
    };
  }
  return {
    niveau: 'faible',
    acceptable: true,
    message: 'Peu solide. Préférez une phrase de plusieurs mots.',
  };
}

// ---------------------------------------------------------------------------
// EXPORT CHIFFRE
// ---------------------------------------------------------------------------

/**
 * Fabrique le contenu du fichier de sauvegarde chiffre.
 * @param {string} motDePasse le mot de passe maitre choisi par l'utilisateur
 * @returns {Promise<string>} le texte JSON a enregistrer
 */
export async function creerSauvegardeChiffree(motDePasse) {
  const tout = await exporterTout();

  // Les images sont binaires : on les convertit en texte (base64) pour
  // pouvoir les ranger dans le JSON.
  const contenu = {
    ...tout,
    images: tout.images.map((image) => ({
      id: image.id,
      typeMime: image.typeMime,
      base64: octetsVersBase64(image.octets),
    })),
  };

  const sel = octetsAleatoires(16);
  const cle = await deriverCle(motDePasse, sel, ITERATIONS_PAR_DEFAUT);
  const enveloppe = await chiffrerOctets(cle, texteVersOctets(JSON.stringify(contenu)));

  const fichier = {
    format: FORMAT,
    version: VERSION_FORMAT,
    creeLe: new Date().toISOString(),
    avertissement:
      'Ce fichier est chiffré. Sans le mot de passe maître utilisé pour le créer, son contenu est définitivement irrécupérable.',
    chiffrement: {
      algorithme: 'AES-256-GCM',
      derivation: 'PBKDF2-SHA256',
      iterations: ITERATIONS_PAR_DEFAUT,
      sel: octetsVersBase64(sel),
      iv: octetsVersBase64(enveloppe.iv),
    },
    donnees: octetsVersBase64(enveloppe.donnees),
  };

  return JSON.stringify(fichier, null, 2);
}

/**
 * Lit un fichier de sauvegarde et renvoie son contenu dechiffre,
 * SANS rien modifier dans l'application.
 *
 * On separe volontairement la lecture de l'ecriture : l'utilisateur peut
 * ainsi voir ce que contient la sauvegarde (nombre de depenses, periode)
 * avant de decider de remplacer ses donnees actuelles.
 */
export async function lireSauvegarde(texteDuFichier, motDePasse) {
  let fichier;
  try {
    fichier = JSON.parse(texteDuFichier);
  } catch (probleme) {
    throw new ErreurFichierInvalide('ce n’est pas un fichier JSON');
  }

  if (fichier?.format !== FORMAT) {
    throw new ErreurFichierInvalide('format non reconnu');
  }
  if (fichier.version > VERSION_FORMAT) {
    throw new ErreurFichierInvalide(
      'elle a été créée par une version plus récente de l’application'
    );
  }
  if (!fichier.chiffrement?.sel || !fichier.chiffrement?.iv || !fichier.donnees) {
    throw new ErreurFichierInvalide('fichier incomplet');
  }

  const cle = await deriverCle(
    motDePasse,
    base64VersOctets(fichier.chiffrement.sel),
    fichier.chiffrement.iterations ?? ITERATIONS_PAR_DEFAUT
  );

  let clair;
  try {
    // AES-GCM verifie la signature : un mot de passe faux fait echouer ici,
    // au lieu de produire des donnees fantaisistes.
    clair = await dechiffrerOctets(cle, {
      iv: base64VersOctets(fichier.chiffrement.iv),
      donnees: base64VersOctets(fichier.donnees),
    });
  } catch (probleme) {
    throw new ErreurMotDePasse();
  }

  const contenu = JSON.parse(octetsVersTexte(clair));

  return {
    creeLe: fichier.creeLe,
    contenu,
    resume: {
      categories: contenu.categories?.length ?? 0,
      depenses: contenu.depenses?.length ?? 0,
      recurrences: contenu.recurrences?.length ?? 0,
      recus: contenu.recus?.length ?? 0,
      images: contenu.images?.length ?? 0,
      // Periode couverte, utile pour verifier qu'on restaure le bon fichier.
      premierMois: (contenu.depenses ?? []).map((d) => d.mois).sort()[0] ?? null,
      dernierMois: (contenu.depenses ?? []).map((d) => d.mois).sort().reverse()[0] ?? null,
    },
  };
}

/**
 * Remplace toutes les donnees de l'appareil par celles d'une sauvegarde
 * deja lue par lireSauvegarde().
 */
export async function restaurerSauvegarde(contenu) {
  await remplacerTout({
    ...contenu,
    images: (contenu.images ?? []).map((image) => ({
      id: image.id,
      typeMime: image.typeMime,
      octets: base64VersOctets(image.base64),
    })),
  });
}

// ---------------------------------------------------------------------------
// EXPORT TABLEUR (CSV) — NON CHIFFRE
// ---------------------------------------------------------------------------

/** Protege une valeur pour le format CSV (guillemets et points-virgules). */
function echapper(valeur) {
  const texte = String(valeur ?? '');
  if (/[";\n\r]/.test(texte)) return `"${texte.replace(/"/g, '""')}"`;
  return texte;
}

/**
 * Construit le contenu d'un fichier CSV lisible par Excel et LibreOffice.
 *
 * Deux details qui evitent bien des ennuis :
 *   - le separateur est le point-virgule, celui attendu par les versions
 *     francaises d'Excel (la virgule sert deja aux decimales) ;
 *   - le fichier commence par un « BOM », une marque invisible qui indique a
 *     Excel que le texte est en UTF-8 : sans elle, les accents s'affichent
 *     de travers.
 *
 * @param {Array} depenses
 * @param {Array} categories
 * @param {string} devise
 */
export function creerExportCsv(depenses, categories, devise = 'EUR') {
  const nomsDesCategories = new Map(categories.map((c) => [c.id, c.nom]));

  const entetes = [
    'Date',
    'Type',
    'Catégorie',
    'Montant',
    'Montant (texte)',
    'Note',
    'Origine',
  ];

  const lignes = [...depenses]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((depense) =>
      [
        depense.date,
        depense.type === 'revenu' ? 'Revenu' : 'Dépense',
        nomsDesCategories.get(depense.categorieId) ?? 'Sans catégorie',
        // Montant brut avec une virgule decimale : Excel francais le
        // reconnait directement comme un nombre.
        (depense.montantCentimes / 100).toFixed(2).replace('.', ','),
        formaterMontant(depense.montantCentimes, devise),
        depense.note ?? '',
        depense.recurrenceId ? 'Récurrente' : depense.recuId ? 'Reçu scanné' : 'Saisie manuelle',
      ]
        .map(echapper)
        .join(';')
    );

  return '﻿' + [entetes.join(';'), ...lignes].join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// TELECHARGEMENT
// ---------------------------------------------------------------------------

/**
 * Propose un fichier au telechargement.
 * On cree un lien invisible, on clique dessus par programme, puis on le
 * retire : c'est la seule facon d'enregistrer un fichier depuis une page web.
 */
export function telechargerFichier(nomDuFichier, contenu, typeMime) {
  const blob = new Blob([contenu], { type: typeMime });
  const adresse = URL.createObjectURL(blob);

  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nomDuFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);

  // On libere la memoire une fois le telechargement lance.
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
}

/** Nom de fichier horodate : "budget-sauvegarde-2026-09-08.json". */
export function nomDeFichier(prefixe, extension) {
  const maintenant = new Date();
  const jour = [
    maintenant.getFullYear(),
    String(maintenant.getMonth() + 1).padStart(2, '0'),
    String(maintenant.getDate()).padStart(2, '0'),
  ].join('-');
  return `${prefixe}-${jour}.${extension}`;
}
