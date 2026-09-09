/*
 * CALCUL DES DATES DES DEPENSES RECURRENTES
 *
 * Ce fichier ne contient que des fonctions « pures » : elles calculent des
 * dates, sans rien enregistrer ni afficher. C'est ce qui permet de les tester
 * automatiquement, y compris sur les cas piegeux (31 du mois, annees
 * bissextiles, changement d'annee).
 *
 * LES QUATRE FREQUENCES
 * ---------------------
 *   hebdomadaire : chaque semaine, le meme jour (tous les lundis...)
 *   bimensuelle  : DEUX FOIS PAR MOIS, a deux jours choisis (le 1 et le 15)
 *   mensuelle    : chaque mois, le meme jour
 *   annuelle     : chaque annee, le meme jour du meme mois
 *
 * Le mot « bimensuel » est ambigu dans le langage courant. Ici il signifie
 * bien deux fois par mois — l'interface l'ecrit d'ailleurs en toutes lettres
 * pour eviter tout malentendu.
 *
 * LE CAS DU 31
 * ------------
 * Une echeance fixee au 31 de chaque mois n'existe pas en fevrier. Plutot que
 * de la sauter (ce qui ferait disparaitre un loyer), on la ramene au dernier
 * jour du mois : le 28 ou le 29 fevrier, le 30 avril, etc.
 */

import {
  nombreDeJoursDansLeMois,
  estUneDateValide,
  ajouterJoursALaDate,
  jourDeLaSemaine,
} from './dates.js';

// Ces deux outils viennent de utils/dates.js ; on les reexpose ici pour que
// tout ce qui concerne les recurrences reste accessible depuis un seul import.
export { ajouterJoursALaDate as ajouterJours, jourDeLaSemaine };

/** Garde-fou : on ne genere jamais plus d'occurrences que cela d'un coup. */
const MAXIMUM_OCCURRENCES = 500;

export const FREQUENCES = [
  {
    cle: 'hebdomadaire',
    libelle: 'Chaque semaine',
    description: 'Tous les 7 jours, le même jour de la semaine.',
  },
  {
    cle: 'bimensuelle',
    libelle: 'Deux fois par mois',
    description: 'À deux dates fixes dans le mois (par exemple le 1 et le 15).',
  },
  { cle: 'mensuelle', libelle: 'Chaque mois', description: 'Une fois par mois, à date fixe.' },
  { cle: 'annuelle', libelle: 'Chaque année', description: 'Une fois par an, à date fixe.' },
];

export const JOURS_DE_LA_SEMAINE = [
  { valeur: 1, libelle: 'lundi' },
  { valeur: 2, libelle: 'mardi' },
  { valeur: 3, libelle: 'mercredi' },
  { valeur: 4, libelle: 'jeudi' },
  { valeur: 5, libelle: 'vendredi' },
  { valeur: 6, libelle: 'samedi' },
  { valeur: 0, libelle: 'dimanche' },
];

// ---------------------------------------------------------------------------
// Petits outils de dates
// ---------------------------------------------------------------------------


/**
 * Construit une date en ramenant le jour au dernier jour du mois s'il
 * n'existe pas (le 31 février devient le 28 ou le 29).
 */
function dateDansLeMois(annee, mois, jourSouhaite) {
  const cleDuMois = `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}`;
  const jour = Math.min(jourSouhaite, nombreDeJoursDansLeMois(cleDuMois));
  return `${cleDuMois}-${String(jour).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Calcul des echeances
// ---------------------------------------------------------------------------

/**
 * Toutes les echeances d'une recurrence entre deux dates incluses.
 *
 * @param {object} recurrence  { frequence, jour, jour2, jourSemaine,
 *                               moisDeLAnnee, dateDebut, dateFin }
 * @param {string} debut       date ISO de depart (incluse)
 * @param {string} fin         date ISO de fin (incluse)
 * @returns {string[]} les dates, dans l'ordre chronologique
 */
export function occurrencesEntre(recurrence, debut, fin) {
  if (!estUneDateValide(debut) || !estUneDateValide(fin)) return [];
  if (debut > fin) return [];

  // La recurrence ne produit rien avant son debut ni apres sa fin.
  const borneBasse = recurrence.dateDebut && recurrence.dateDebut > debut ? recurrence.dateDebut : debut;
  const borneHaute = recurrence.dateFin && recurrence.dateFin < fin ? recurrence.dateFin : fin;
  if (borneBasse > borneHaute) return [];

  const dates = [];

  switch (recurrence.frequence) {
    case 'hebdomadaire': {
      const jourVise = Number(recurrence.jourSemaine ?? 1);
      // On avance jour par jour (7 fois maximum) jusqu'au bon jour de semaine.
      let courante = borneBasse;
      for (let i = 0; i < 7 && jourDeLaSemaine(courante) !== jourVise; i++) {
        courante = ajouterJoursALaDate(courante, 1);
      }
      while (courante <= borneHaute && dates.length < MAXIMUM_OCCURRENCES) {
        dates.push(courante);
        courante = ajouterJoursALaDate(courante, 7);
      }
      break;
    }

    case 'bimensuelle':
    case 'mensuelle': {
      const jours =
        recurrence.frequence === 'bimensuelle'
          ? [Number(recurrence.jour ?? 1), Number(recurrence.jour2 ?? 15)]
          : [Number(recurrence.jour ?? 1)];

      const [anneeDebut, moisDebut] = borneBasse.split('-').map(Number);
      const [anneeFin, moisFin] = borneHaute.split('-').map(Number);
      const premierMois = anneeDebut * 12 + (moisDebut - 1);
      const dernierMois = anneeFin * 12 + (moisFin - 1);

      for (let m = premierMois; m <= dernierMois; m++) {
        const annee = Math.floor(m / 12);
        const mois = (m % 12) + 1;
        for (const jour of jours) {
          const date = dateDansLeMois(annee, mois, jour);
          if (date >= borneBasse && date <= borneHaute) dates.push(date);
        }
      }
      dates.sort();
      break;
    }

    case 'annuelle': {
      const moisVise = Number(recurrence.moisDeLAnnee ?? 1);
      const jourVise = Number(recurrence.jour ?? 1);
      const anneeDebut = Number(borneBasse.slice(0, 4));
      const anneeFin = Number(borneHaute.slice(0, 4));

      for (let annee = anneeDebut; annee <= anneeFin; annee++) {
        const date = dateDansLeMois(annee, moisVise, jourVise);
        if (date >= borneBasse && date <= borneHaute) dates.push(date);
      }
      break;
    }

    default:
      return [];
  }

  return dates.slice(0, MAXIMUM_OCCURRENCES);
}

/**
 * La prochaine echeance a partir d'une date donnee (incluse).
 * @returns {string|null} null si la recurrence est terminee
 */
export function prochaineOccurrence(recurrence, aPartirDe) {
  if (recurrence.suspendue) return null;

  // On cherche dans une fenetre de 400 jours : cela couvre meme une
  // recurrence annuelle, quelle que soit la date de depart.
  const debut =
    recurrence.dateDebut && recurrence.dateDebut > aPartirDe ? recurrence.dateDebut : aPartirDe;
  const dates = occurrencesEntre(recurrence, debut, ajouterJoursALaDate(debut, 400));
  return dates.length > 0 ? dates[0] : null;
}

/**
 * Les echeances qui auraient deja du etre enregistrees et ne l'ont pas ete.
 *
 * C'est cette fonction qui rattrape le retard : si l'application n'a pas ete
 * ouverte pendant deux mois, elle renvoie toutes les echeances passees, sans
 * jamais en creer deux fois la meme (grace a "derniereGeneration").
 *
 * @param {object} recurrence
 * @param {string} aujourdhuiIso
 * @returns {string[]}
 */
export function occurrencesEnRetard(recurrence, aujourdhuiIso) {
  if (recurrence.suspendue) return [];

  // On repart du lendemain de la derniere echeance deja enregistree ;
  // a defaut, de la date de debut de la recurrence.
  const debut = recurrence.derniereGeneration
    ? ajouterJoursALaDate(recurrence.derniereGeneration, 1)
    : recurrence.dateDebut;

  if (!debut || debut > aujourdhuiIso) return [];

  return occurrencesEntre(recurrence, debut, aujourdhuiIso);
}

/**
 * Description en une phrase, affichee dans la liste des recurrences.
 * Exemple : « Chaque mois, le 5 ».
 */
export function decrireRecurrence(recurrence) {
  const nomDuJour =
    JOURS_DE_LA_SEMAINE.find((j) => j.valeur === Number(recurrence.jourSemaine))?.libelle ??
    'lundi';

  const nomsDesMois = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  switch (recurrence.frequence) {
    case 'hebdomadaire':
      return `Chaque semaine, le ${nomDuJour}`;
    case 'bimensuelle':
      return `Deux fois par mois, le ${recurrence.jour} et le ${recurrence.jour2}`;
    case 'mensuelle':
      return `Chaque mois, le ${recurrence.jour}`;
    case 'annuelle':
      return `Chaque année, le ${recurrence.jour} ${nomsDesMois[Number(recurrence.moisDeLAnnee) - 1] ?? ''}`;
    default:
      return 'Fréquence inconnue';
  }
}

/**
 * Combien cette recurrence represente-t-elle sur un mois donne ?
 * Sert a l'apercu affiche avant de valider une nouvelle recurrence.
 *
 * @param {object} recurrence
 * @param {string} mois  "2026-03"
 * @returns {{nombre: number, total: number, dates: string[]}}
 */
export function impactSurLeMois(recurrence, mois) {
  const dernierJour = nombreDeJoursDansLeMois(mois);
  const dates = occurrencesEntre(
    { ...recurrence, suspendue: false },
    `${mois}-01`,
    `${mois}-${String(dernierJour).padStart(2, '0')}`
  );

  return {
    nombre: dates.length,
    total: dates.length * (recurrence.montantCentimes || 0),
    dates,
  };
}
