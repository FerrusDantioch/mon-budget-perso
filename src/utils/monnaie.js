/*
 * GESTION DE L'ARGENT
 *
 * Regle d'or : on ne stocke JAMAIS un montant avec une virgule (12.50).
 * Les ordinateurs font des erreurs d'arrondi avec les nombres a virgule
 * (0.1 + 0.2 donne 0.30000000000000004 en JavaScript !).
 *
 * On stocke donc tout en CENTIMES, avec des nombres entiers :
 *   12,50 EUR  ->  1250 centimes
 * Et on ne remet la virgule qu'au moment de l'affichage.
 */

/**
 * Transforme ce que l'utilisateur a tape en centimes.
 * Accepte "12,50", "12.50", "12", " 12,5 ", "1 250,00".
 *
 * @param {string|number} saisie
 * @returns {number|null} le montant en centimes, ou null si la saisie est invalide
 */
export function versCentimes(saisie) {
  if (typeof saisie === 'number') {
    if (!Number.isFinite(saisie) || saisie < 0) return null;
    return Math.round(saisie * 100);
  }
  if (typeof saisie !== 'string') return null;

  // On enleve les espaces (y compris les espaces insecables des milliers)
  // et on remplace la virgule francaise par un point.
  const nettoye = saisie
    .replace(/ | /g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[€]/g, '');

  if (nettoye === '') return null;
  // Un seul point decimal autorise, pas de signe negatif.
  if (!/^\d+(\.\d{0,2})?$/.test(nettoye)) return null;

  const nombre = Number.parseFloat(nettoye);
  if (!Number.isFinite(nombre)) return null;

  return Math.round(nombre * 100);
}

/**
 * Affiche un montant en centimes sous forme lisible : 1250 -> "12,50 €".
 * @param {number} centimes
 * @param {string} devise code de la monnaie (EUR, CHF, CAD...)
 */
export function formaterMontant(centimes, devise = 'EUR') {
  const valeur = (Number.isFinite(centimes) ? centimes : 0) / 100;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: devise,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valeur);
  } catch (erreur) {
    // Si le code de devise est inconnu du navigateur, on affiche sans symbole.
    return valeur.toFixed(2).replace('.', ',');
  }
}

/**
 * Version compacte pour les petits espaces (graphiques) : 125000 -> "1 250 €".
 * Les centimes sont masques quand le montant est rond.
 */
export function formaterMontantCourt(centimes, devise = 'EUR') {
  const valeur = (Number.isFinite(centimes) ? centimes : 0) / 100;
  const sansCentimes = centimes % 100 === 0;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: devise,
      minimumFractionDigits: sansCentimes ? 0 : 2,
      maximumFractionDigits: sansCentimes ? 0 : 2,
    }).format(valeur);
  } catch (erreur) {
    return valeur.toFixed(sansCentimes ? 0 : 2).replace('.', ',');
  }
}

/**
 * Transforme des centimes en texte editable dans un champ de saisie :
 * 1250 -> "12,50". Utilise quand on modifie une depense existante.
 */
export function centimesVersTexte(centimes) {
  if (!Number.isFinite(centimes)) return '';
  return (centimes / 100).toFixed(2).replace('.', ',');
}
