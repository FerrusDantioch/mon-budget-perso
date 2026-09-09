/*
 * PASTILLE SUR L'ICONE DE L'APPLICATION (Badging API)
 *
 * Affiche le pourcentage de budget consomme directement sur l'icone, sur
 * l'ecran d'accueil : un coup d'oeil suffit, sans ouvrir l'application.
 *
 * CE QUE CETTE FONCTION N'EST PAS
 * -------------------------------
 * Ce n'est pas un widget. Un vrai widget d'ecran d'accueil, qui affiche des
 * chiffres et se met a jour tout seul, est une fonction du systeme
 * (AppWidgetProvider sur Android, WidgetKit sur iOS) : aucune application web
 * n'y a acces, quelle que soit la technique employee. Il faudrait empaqueter
 * l'application en application native, ce qui sort du cadre de ce projet.
 *
 * La pastille est la seule chose qu'une application web peut afficher hors de
 * ses propres ecrans.
 *
 * OU CELA FONCTIONNE
 *   Android : Chrome et Edge, application installee sur l'ecran d'accueil.
 *   Windows / macOS : Chrome et Edge, application installee.
 *   iPhone : pas supporte par Safari. L'interface le precise.
 *
 * La pastille n'apparait que si l'application est INSTALLEE : dans un simple
 * onglet de navigateur, l'appel reussit mais rien ne s'affiche.
 */

import { useEffect } from 'react';

/** L'appareil sait-il afficher une pastille ? */
export function badgeSupporte() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

/**
 * Met a jour la pastille.
 * @param {number|null} valeur nombre a afficher, ou null pour l'effacer
 */
export async function definirBadge(valeur) {
  if (!badgeSupporte()) return false;
  try {
    if (valeur === null || valeur <= 0) {
      await navigator.clearAppBadge();
    } else {
      // Au-dela de 99, le systeme affiche generalement "99+".
      await navigator.setAppBadge(Math.min(999, Math.round(valeur)));
    }
    return true;
  } catch (probleme) {
    // Certaines plateformes refusent l'appel hors application installee :
    // ce n'est pas une erreur, simplement une fonction indisponible.
    return false;
  }
}

/**
 * Tient la pastille a jour en fonction du budget consomme.
 *
 * @param {number} pourcentage  part du budget deja utilisee
 * @param {boolean} active      reglage choisi par l'utilisateur
 */
export function useBadge(pourcentage, active) {
  useEffect(() => {
    if (!active) {
      definirBadge(null);
      return;
    }
    definirBadge(pourcentage);
  }, [pourcentage, active]);
}
