/*
 * CALCULS DU BUDGET
 *
 * Ce fichier ne contient que des fonctions "pures" : elles prennent des
 * donnees en entree et renvoient un resultat, sans rien modifier ailleurs.
 * C'est ce qui les rend faciles a tester automatiquement (voir tests/).
 *
 * Tous les montants sont en centimes (voir utils/monnaie.js).
 */

// ---------------------------------------------------------------------------
// Les seuils d'alerte, definis une seule fois pour toute l'application.
// ---------------------------------------------------------------------------
export const SEUIL_ATTENTION = 80; // a partir de 80 % du plafond : orange
export const SEUIL_CRITIQUE = 95; // a partir de 95 % du plafond : rouge

/** Additionne le montant d'une liste de depenses. */
export function totalDesDepenses(depenses) {
  return depenses.reduce((somme, depense) => somme + (depense.montantCentimes || 0), 0);
}

/**
 * Separe les vraies depenses des rentrees d'argent.
 *
 * Une ligne de type "revenu" (un salaire, un remboursement) ne doit jamais
 * entrer dans les totaux de categories : sinon elle viendrait "remplir" un
 * plafond de depenses, ce qui n'aurait aucun sens. Elle est comptee a part.
 */
export function separerDepensesEtRevenus(lignes) {
  const depenses = [];
  const revenus = [];
  for (const ligne of lignes) {
    if (ligne.type === 'revenu') revenus.push(ligne);
    else depenses.push(ligne);
  }
  return { depenses, revenus };
}

/**
 * Regroupe les depenses par categorie.
 * @returns {Object} un objet du type { "id-alimentation": 4500, "id-transport": 1200 }
 */
export function totalParCategorie(depenses) {
  const totaux = {};
  for (const depense of depenses) {
    const cle = depense.categorieId || 'sans-categorie';
    totaux[cle] = (totaux[cle] || 0) + (depense.montantCentimes || 0);
  }
  return totaux;
}

/**
 * Determine l'etat d'une categorie par rapport a son plafond.
 *
 * @param {number} depense  ce qui a deja ete depense, en centimes
 * @param {number} plafond  la limite fixee, en centimes (0 = pas de limite)
 * @returns {{pourcentage:number, niveau:string, libelle:string, reste:number, depassement:number}}
 *
 * Les niveaux possibles :
 *   "sans-plafond" : aucune limite definie
 *   "ok"           : moins de 80 % du plafond      (vert)
 *   "attention"    : entre 80 % et 95 %            (orange)
 *   "critique"     : entre 95 % et 100 %           (rouge)
 *   "depasse"      : plus de 100 %                 (rouge fonce)
 */
export function etatDeLaCategorie(depense, plafond) {
  const montantDepense = Math.max(0, depense || 0);

  if (!plafond || plafond <= 0) {
    return {
      pourcentage: 0,
      niveau: 'sans-plafond',
      libelle: 'Sans plafond',
      reste: 0,
      depassement: 0,
    };
  }

  // On arrondit a l'entier le plus proche pour l'affichage.
  const pourcentage = Math.round((montantDepense / plafond) * 100);
  const reste = plafond - montantDepense;

  let niveau = 'ok';
  let libelle = 'Dans le budget';
  if (montantDepense > plafond) {
    niveau = 'depasse';
    libelle = 'Budget dépassé';
  } else if (pourcentage >= SEUIL_CRITIQUE) {
    niveau = 'critique';
    libelle = 'Limite presque atteinte';
  } else if (pourcentage >= SEUIL_ATTENTION) {
    niveau = 'attention';
    libelle = 'Attention';
  }

  return {
    pourcentage,
    niveau,
    libelle,
    reste: Math.max(0, reste),
    depassement: Math.max(0, -reste),
  };
}

/**
 * Construit le resume complet d'un mois : une ligne par categorie + les totaux.
 *
 * @param {Array} categories  la liste des categories (avec leur couleur)
 * @param {Array} lignesDuMois  les depenses ET les revenus du mois
 * @param {Object} plafonds   { categorieId: plafondEnCentimes } pour ce mois
 */
export function resumeDuMois(categories, lignesDuMois, plafonds = {}) {
  // Les rentrees d'argent sont mises de cote des le depart : elles ne
  // participent ni aux plafonds, ni au camembert.
  const { depenses, revenus } = separerDepensesEtRevenus(lignesDuMois);
  const totaux = totalParCategorie(depenses);

  const lignes = categories
    .filter((categorie) => !categorie.archivee)
    .map((categorie) => {
      const depense = totaux[categorie.id] || 0;
      const plafond = plafonds[categorie.id] ?? 0;
      return {
        categorie,
        depense,
        plafond,
        nombreDeDepenses: depenses.filter((d) => d.categorieId === categorie.id).length,
        ...etatDeLaCategorie(depense, plafond),
      };
    });

  // Les depenses dont la categorie a ete supprimee ne doivent pas disparaitre
  // des totaux : on les regroupe dans une ligne "Sans categorie".
  const idsConnus = new Set(categories.map((c) => c.id));
  const orphelines = Object.entries(totaux).filter(([id]) => !idsConnus.has(id));
  if (orphelines.length > 0) {
    const depense = orphelines.reduce((somme, [, montant]) => somme + montant, 0);
    lignes.push({
      categorie: { id: 'sans-categorie', nom: 'Sans catégorie', couleur: '#94a3b8' },
      depense,
      plafond: 0,
      nombreDeDepenses: depenses.filter((d) => !idsConnus.has(d.categorieId)).length,
      ...etatDeLaCategorie(depense, 0),
    });
  }

  const totalDepense = totalDesDepenses(depenses);
  const totalRevenus = totalDesDepenses(revenus);
  const totalPlafond = lignes.reduce((somme, ligne) => somme + ligne.plafond, 0);

  return {
    lignes,
    totalDepense,
    totalRevenus,
    // Solde reel du mois : ce qui est rentre moins ce qui est sorti.
    // Peut etre negatif ; n'a de sens que si des revenus ont ete saisis.
    solde: totalRevenus - totalDepense,
    nombreDeRevenus: revenus.length,
    totalPlafond,
    ...etatDeLaCategorie(totalDepense, totalPlafond),
  };
}

/**
 * Prepare les donnees du graphique circulaire.
 * On ne garde que les categories ou de l'argent a reellement ete depense :
 * afficher des parts de 0 % rendrait le camembert illisible.
 */
export function donneesDuCamembert(resume) {
  return resume.lignes
    .filter((ligne) => ligne.depense > 0)
    .sort((a, b) => b.depense - a.depense)
    .map((ligne) => ({
      id: ligne.categorie.id,
      nom: ligne.categorie.nom,
      couleur: ligne.categorie.couleur,
      valeur: ligne.depense,
      // Part en pourcentage du total du mois (utile pour la legende).
      part:
        resume.totalDepense > 0
          ? Math.round((ligne.depense / resume.totalDepense) * 100)
          : 0,
    }));
}

/**
 * Rythme de depense du mois en cours.
 *
 * On ne calcule volontairement PAS de "projection de fin de mois" en
 * multipliant la moyenne quotidienne : une grosse depense ponctuelle (le
 * loyer, par exemple) fausserait completement le resultat et afficherait un
 * chiffre alarmant sans aucun sens.
 *
 * On repond plutot a une question concrete :
 *   "combien puis-je encore depenser chaque jour jusqu'a la fin du mois ?"
 *
 * @param {number} totalDepense    depenses cumulees du mois, en centimes
 * @param {number} plafondTotal    budget du mois, en centimes (0 = non defini)
 * @param {number} jourEnCours     numero du jour (1 a 31)
 * @param {number} joursDansLeMois nombre total de jours du mois
 * @returns {{moyenneParJour:number, disponibleParJour:number,
 *            joursRestants:number, pertinent:boolean}}
 *   "pertinent" vaut faux quand le calcul n'a pas de sens (mois termine,
 *   aucun budget defini, ou budget deja depasse) : dans ce cas l'interface
 *   n'affiche rien plutot qu'un chiffre trompeur.
 */
export function rythmeDuMois(totalDepense, plafondTotal, jourEnCours, joursDansLeMois) {
  const vide = {
    moyenneParJour: 0,
    disponibleParJour: 0,
    joursRestants: 0,
    pertinent: false,
  };

  if (!jourEnCours || jourEnCours <= 0 || joursDansLeMois <= 0) return vide;
  if (jourEnCours > joursDansLeMois) return vide;

  const moyenneParJour = Math.round(totalDepense / jourEnCours);

  // Le jour en cours compte : on peut encore depenser aujourd'hui.
  const joursRestants = joursDansLeMois - jourEnCours + 1;
  const reste = plafondTotal - totalDepense;

  if (plafondTotal <= 0 || reste <= 0) {
    return { ...vide, moyenneParJour, joursRestants };
  }

  return {
    moyenneParJour,
    disponibleParJour: Math.floor(reste / joursRestants),
    joursRestants,
    pertinent: true,
  };
}
