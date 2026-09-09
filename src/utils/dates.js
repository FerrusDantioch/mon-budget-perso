/*
 * GESTION DES DATES
 *
 * Deux formats seulement circulent dans l'application :
 *   - une DATE  : "2026-03-15"  (annee-mois-jour) — c'est le format des champs
 *     <input type="date">, il se trie tout seul dans l'ordre chronologique ;
 *   - un MOIS   : "2026-03"     — sert de cle pour regrouper et archiver.
 *
 * On evite volontairement l'objet Date de JavaScript pour les calculs : il
 * change de jour selon le fuseau horaire, ce qui provoque des bugs difficiles
 * a comprendre. On manipule donc directement le texte.
 */

/** Extrait le mois d'une date : "2026-03-15" -> "2026-03". */
export function moisDeLaDate(dateIso) {
  if (typeof dateIso !== 'string' || dateIso.length < 7) return '';
  return dateIso.slice(0, 7);
}

/** La date du jour au format "2026-03-15" (dans le fuseau horaire du telephone). */
export function aujourdhui() {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const jour = String(maintenant.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

/** Le mois en cours au format "2026-03". */
export function moisActuel() {
  return moisDeLaDate(aujourdhui());
}

/** Decale un mois de N mois (N peut etre negatif) : ("2026-01", -1) -> "2025-12". */
export function decalerMois(mois, nombreDeMois) {
  const [annee, numeroMois] = mois.split('-').map(Number);
  // On raisonne en "nombre total de mois depuis l'an 0" pour eviter les cas
  // particuliers de janvier et decembre.
  const total = annee * 12 + (numeroMois - 1) + nombreDeMois;
  const nouvelleAnnee = Math.floor(total / 12);
  const nouveauMois = (total % 12) + 1;
  return `${String(nouvelleAnnee).padStart(4, '0')}-${String(nouveauMois).padStart(2, '0')}`;
}

export const moisPrecedent = (mois) => decalerMois(mois, -1);
export const moisSuivant = (mois) => decalerMois(mois, 1);

/** Nom lisible d'un mois : "2026-03" -> "mars 2026". */
export function nomDuMois(mois) {
  const [annee, numeroMois] = mois.split('-').map(Number);
  const nomsDesMois = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
  ];
  const nom = nomsDesMois[numeroMois - 1] ?? '';
  return `${nom} ${annee}`;
}

/** Nom lisible avec accents, pour l'affichage a l'ecran. */
export function nomDuMoisAffichage(mois) {
  const [annee, numeroMois] = mois.split('-').map(Number);
  const nomsDesMois = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const nom = nomsDesMois[numeroMois - 1] ?? '';
  return `${nom} ${annee}`;
}

/** Date courte pour les listes : "2026-03-15" -> "dim. 15 mars". */
export function formaterDateCourte(dateIso) {
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  // On construit la date a midi : impossible alors de basculer d'un jour a
  // l'autre a cause du fuseau horaire.
  const date = new Date(annee, mois - 1, jour, 12, 0, 0);
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch (erreur) {
    return dateIso;
  }
}

/** Nombre de jours dans un mois donne : ("2026-02") -> 28. */
export function nombreDeJoursDansLeMois(mois) {
  const [annee, numeroMois] = mois.split('-').map(Number);
  // Le jour 0 du mois suivant = le dernier jour du mois demande.
  return new Date(annee, numeroMois, 0).getDate();
}

/** Vrai si la chaine ressemble bien a une date "AAAA-MM-JJ" valide. */
export function estUneDateValide(dateIso) {
  if (typeof dateIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  if (mois < 1 || mois > 12) return false;
  if (jour < 1) return false;
  return jour <= nombreDeJoursDansLeMois(`${annee}-${String(mois).padStart(2, '0')}`);
}

/**
 * Decale une date d'un nombre de jours (negatif pour reculer).
 * ("2026-02-28", 1) -> "2026-02-29" en annee bissextile, "2026-03-01" sinon.
 *
 * On construit la date a midi : impossible alors de changer de jour a cause
 * du fuseau horaire ou du passage a l'heure d'ete.
 */
export function ajouterJoursALaDate(dateIso, nombreDeJours) {
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  const date = new Date(annee, mois - 1, jour, 12, 0, 0);
  date.setDate(date.getDate() + nombreDeJours);

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Jour de la semaine d'une date : 0 = dimanche, 1 = lundi... */
export function jourDeLaSemaine(dateIso) {
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  return new Date(annee, mois - 1, jour, 12, 0, 0).getDay();
}
