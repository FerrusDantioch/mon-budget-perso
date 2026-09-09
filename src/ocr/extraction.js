/*
 * LECTURE D'UN TICKET DE CAISSE
 *
 * Le moteur de reconnaissance (Tesseract) renvoie du texte brut, souvent
 * approximatif : lignes tordues, caracteres confondus, colonnes melangees.
 * Ce fichier essaie d'y retrouver trois informations : le montant total, la
 * date, et le nom du commercant.
 *
 * REGLE ABSOLUE DE CE MODULE
 * --------------------------
 * Rien de ce qui est trouve ici n'est jamais enregistre directement. Les
 * valeurs sont pre-remplies dans un formulaire que l'utilisateur DOIT relire
 * et valider. Un OCR se trompe : sur un ticket froisse ou mal eclaire, un
 * « 8 » devient un « 3 » sans prevenir. Chaque resultat est donc accompagne
 * d'un indice de confiance affiche a l'ecran.
 *
 * Ces fonctions sont pures (texte en entree, resultat en sortie) : elles sont
 * couvertes par les tests automatises.
 */

import { estUneDateValide } from '../utils/dates.js';

// Mots qui, sur un ticket, precedent presque toujours le montant a payer.
const MOTS_DU_TOTAL = [
  'total ttc',
  'montant total',
  'net a payer',
  'total a payer',
  'a payer',
  'total',
  'montant du',
  'montant',
  'somme due',
];

// Debuts de ligne a ignorer quand on cherche le nom du commercant.
const LIGNES_NON_SIGNIFICATIVES =
  /^(ticket|facture|recu|note|caisse|siret|siren|tva|no\b|tel|www|http|merci|bienvenue|a bientot|au revoir|client|vendeur|date|heure|carte|cb|especes?|monnaie|rendu)/;

const MOIS_EN_LETTRES = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
};

/*
 * Separateurs de milliers acceptes : espace ordinaire, espace insecable
 * ( ), espace insecable fine ( ) et point. Les imprimantes de
 * tickets les utilisent indifferemment.
 * On ecrit les caracteres invisibles sous forme de codes : ils resteraient
 * sinon impossibles a distinguer dans l'editeur de texte.
 */
const SEPARATEURS_DE_MILLIERS = '[ \\u00a0\\u202f.]';

/** Met en minuscules et retire les accents, pour comparer sans surprise. */
function simplifier(texte) {
  return (
    String(texte)
      .toLowerCase()
      // NFD separe chaque lettre accentuee en « lettre + accent »...
      .normalize('NFD')
      // ...et on supprime ensuite les accents ainsi isoles.
      .replace(/[̀-ͯ]/g, '')
  );
}

// ---------------------------------------------------------------------------
// MONTANTS
// ---------------------------------------------------------------------------

/**
 * Repere tous les montants presents dans une ligne de texte.
 * Accepte « 12,50 », « 12.50 », « 1 234,56 », « 12,50 EUR ».
 * @returns {number[]} les montants, en centimes
 */
export function montantsDeLaLigne(ligne) {
  const montants = [];

  // Un nombre suivi d'exactement deux decimales, avec ou sans separateur de
  // milliers. Le (?!\d) final evite d'attraper « 12,505 ».
  const motif = new RegExp(
    `(\\d{1,3}(?:${SEPARATEURS_DE_MILLIERS}\\d{3})+|\\d+)[.,](\\d{2})(?!\\d)`,
    'g'
  );
  const nettoyage = new RegExp(SEPARATEURS_DE_MILLIERS, 'g');

  let trouve;
  while ((trouve = motif.exec(String(ligne))) !== null) {
    const partieEntiere = trouve[1].replace(nettoyage, '');
    const centimes = Number(partieEntiere) * 100 + Number(trouve[2]);
    if (Number.isFinite(centimes) && centimes > 0 && centimes < 100000000) {
      montants.push(centimes);
    }
  }
  return montants;
}

/**
 * Cherche le montant total du ticket.
 *
 * Strategie, du plus fiable au moins fiable :
 *   1. une ligne contenant « TOTAL », « NET A PAYER »... et un montant ;
 *   2. a defaut, le plus gros montant du ticket (sur un ticket de caisse,
 *      le total est presque toujours superieur a chaque article).
 *
 * @returns {{centimes: number|null, confiance: 'bonne'|'moyenne'|'aucune', ligne: string|null}}
 */
export function extraireMontant(texte) {
  const lignes = String(texte).split(/\r?\n/);

  // On parcourt de bas en haut : sur un ticket, le total est en bas et les
  // sous-totaux intermediaires sont au-dessus.
  for (let i = lignes.length - 1; i >= 0; i--) {
    const ligne = lignes[i];
    const simplifiee = simplifier(ligne);

    if (!MOTS_DU_TOTAL.some((mot) => simplifiee.includes(mot))) continue;

    // On ecarte les lignes de TVA et de total hors taxes : ce n'est pas ce
    // que l'utilisateur a reellement paye.
    if (/\btva\b/.test(simplifiee) && !simplifiee.includes('ttc')) continue;
    if (/\bht\b/.test(simplifiee) && !simplifiee.includes('ttc')) continue;

    let montants = montantsDeLaLigne(ligne);

    // Certains tickets impriment le montant sur la ligne suivante.
    if (montants.length === 0 && i + 1 < lignes.length) {
      montants = montantsDeLaLigne(lignes[i + 1]);
    }

    if (montants.length > 0) {
      // Sur une ligne « TOTAL 3 art. 24,90 », on retient le plus grand.
      return { centimes: Math.max(...montants), confiance: 'bonne', ligne: ligne.trim() };
    }
  }

  // Repli : le plus gros montant trouve sur l'ensemble du ticket.
  const tous = lignes.flatMap((ligne) => montantsDeLaLigne(ligne));
  if (tous.length > 0) {
    return { centimes: Math.max(...tous), confiance: 'moyenne', ligne: null };
  }

  return { centimes: null, confiance: 'aucune', ligne: null };
}

// ---------------------------------------------------------------------------
// DATE
// ---------------------------------------------------------------------------

/** Complete une annee sur deux chiffres : 26 -> 2026, 99 -> 1999. */
function completerAnnee(annee) {
  if (annee >= 100) return annee;
  return annee > 70 ? 1900 + annee : 2000 + annee;
}

/**
 * Cherche la date du ticket.
 * Formats reconnus : 15/03/2026, 15-03-26, 15.03.2026, « 15 mars 2026 ».
 *
 * @param {string} texte
 * @param {string} [dateMaximum] date du jour : toute date posterieure est
 *   ignoree, un ticket ne pouvant pas venir du futur.
 * @returns {{date: string|null, confiance: 'bonne'|'moyenne'|'aucune'}}
 */
export function extraireDate(texte, dateMaximum = null) {
  const candidates = [];
  const simplifie = simplifier(texte);

  // Format chiffre : 15/03/2026, 15-03-26, 15.03.2026
  const motifChiffre = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/g;
  let trouve;
  while ((trouve = motifChiffre.exec(String(texte))) !== null) {
    candidates.push({
      jour: Number(trouve[1]),
      mois: Number(trouve[2]),
      annee: completerAnnee(Number(trouve[3])),
    });
  }

  // Format en lettres : « 15 mars 2026 »
  const motifLettres = /(\d{1,2})\s+([a-z]{3,10})\.?\s+(\d{2,4})/g;
  while ((trouve = motifLettres.exec(simplifie)) !== null) {
    const mois = MOIS_EN_LETTRES[trouve[2]];
    if (!mois) continue;
    candidates.push({
      jour: Number(trouve[1]),
      mois,
      annee: completerAnnee(Number(trouve[3])),
    });
  }

  for (const candidate of candidates) {
    const date =
      `${String(candidate.annee).padStart(4, '0')}-` +
      `${String(candidate.mois).padStart(2, '0')}-` +
      `${String(candidate.jour).padStart(2, '0')}`;

    if (!estUneDateValide(date)) continue;
    // Une date anterieure a 2000 sur un ticket de caisse est forcement une
    // erreur de lecture.
    if (candidate.annee < 2000) continue;
    if (dateMaximum && date > dateMaximum) continue;

    return { date, confiance: 'bonne' };
  }

  return { date: null, confiance: 'aucune' };
}

// ---------------------------------------------------------------------------
// COMMERCANT
// ---------------------------------------------------------------------------

/**
 * Cherche le nom du commercant, generalement imprime en haut du ticket.
 * @returns {{nom: string|null, confiance: 'bonne'|'moyenne'|'aucune'}}
 */
export function extraireCommercant(texte) {
  const lignes = String(texte)
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter(Boolean);

  // On ne regarde que le haut du ticket.
  for (let i = 0; i < Math.min(lignes.length, 6); i++) {
    const ligne = lignes[i];
    const simplifiee = simplifier(ligne);

    if (LIGNES_NON_SIGNIFICATIVES.test(simplifiee)) continue;

    // Il faut au moins trois lettres : on ecarte les codes et les numeros.
    const nombreDeLettres = simplifiee.replace(/[^a-z]/g, '').length;
    if (nombreDeLettres < 3) continue;

    // Une ligne majoritairement chiffree est une adresse ou un numero de
    // SIRET, pas un nom d'enseigne.
    const nombreDeChiffres = ligne.replace(/\D/g, '').length;
    if (nombreDeChiffres > nombreDeLettres) continue;

    return {
      nom: ligne.replace(/\s+/g, ' ').slice(0, 40).trim(),
      confiance: i === 0 ? 'bonne' : 'moyenne',
    };
  }

  return { nom: null, confiance: 'aucune' };
}

// ---------------------------------------------------------------------------
// ANALYSE COMPLETE
// ---------------------------------------------------------------------------

/**
 * Analyse le texte d'un ticket et renvoie les trois informations d'un coup.
 *
 * @param {string} texte        le texte brut renvoye par l'OCR
 * @param {string} [dateDuJour] pour ecarter les dates futures
 */
export function analyserTicket(texte, dateDuJour = null) {
  const montant = extraireMontant(texte);
  const date = extraireDate(texte, dateDuJour);
  const commercant = extraireCommercant(texte);

  // Nombre d'informations trouvees avec une bonne confiance : sert a choisir
  // le message affiche a l'utilisateur.
  const bonnes = [montant, date, commercant].filter((r) => r.confiance === 'bonne').length;

  return {
    montantCentimes: montant.centimes,
    confianceMontant: montant.confiance,
    ligneDuMontant: montant.ligne,
    date: date.date,
    confianceDate: date.confiance,
    commercant: commercant.nom,
    confianceCommercant: commercant.confiance,
    qualiteGlobale: bonnes >= 2 ? 'bonne' : bonnes === 1 ? 'partielle' : 'faible',
  };
}
