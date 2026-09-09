/*
 * NAVIGATION ENTRE LES ECRANS
 *
 * Plutot que d'installer une librairie de routage, on utilise l'adresse
 * « avec un diese » : .../Budget/#/depenses
 *
 * Deux avantages decisifs :
 *   1. GitHub Pages ne sait pas rediriger les adresses inconnues vers la page
 *      d'accueil ; avec un diese, le serveur ne voit que la page d'accueil,
 *      donc aucune erreur 404 possible ;
 *   2. le bouton « retour » d'Android fonctionne naturellement.
 *
 * DEUX NIVEAUX D'ECRANS
 *   - les cinq ecrans principaux, presents dans la barre de navigation ;
 *   - des sous-ecrans (recurrences, reçus, sauvegarde, securite), atteints
 *     depuis un ecran principal et munis d'une fleche de retour.
 */

import { useCallback, useEffect, useState } from 'react';

export const ECRANS = [
  {
    cle: 'tableau',
    chemin: '#/',
    titre: 'Tableau de bord',
    titreCourt: 'Accueil',
    icone: '📊',
    dansLaNavigation: true,
  },
  {
    cle: 'depenses',
    chemin: '#/depenses',
    titre: 'Dépenses',
    titreCourt: 'Dépenses',
    icone: '🧾',
    dansLaNavigation: true,
  },
  {
    cle: 'budgets',
    chemin: '#/budgets',
    titre: 'Budgets',
    titreCourt: 'Budgets',
    icone: '🎯',
    dansLaNavigation: true,
  },
  {
    cle: 'historique',
    chemin: '#/historique',
    titre: 'Historique',
    titreCourt: 'Historique',
    icone: '🗓️',
    dansLaNavigation: true,
  },
  {
    cle: 'reglages',
    chemin: '#/reglages',
    titre: 'Réglages',
    titreCourt: 'Réglages',
    icone: '⚙️',
    dansLaNavigation: true,
  },

  // --- Sous-ecrans -------------------------------------------------------
  {
    cle: 'recurrences',
    chemin: '#/recurrences',
    titre: 'Dépenses récurrentes',
    icone: '🔁',
    dansLaNavigation: false,
    parent: 'depenses',
  },
  {
    cle: 'recus',
    chemin: '#/recus',
    titre: 'Reçus scannés',
    icone: '📷',
    dansLaNavigation: false,
    parent: 'depenses',
  },
  {
    cle: 'sauvegarde',
    chemin: '#/sauvegarde',
    titre: 'Sauvegarde',
    icone: '💾',
    dansLaNavigation: false,
    parent: 'reglages',
  },
  {
    cle: 'securite',
    chemin: '#/securite',
    titre: 'Sécurité',
    icone: '🔒',
    dansLaNavigation: false,
    parent: 'reglages',
  },
];

/** Les ecrans affiches dans la barre de navigation. */
export const ECRANS_DE_NAVIGATION = ECRANS.filter((ecran) => ecran.dansLaNavigation);

/**
 * Adresse speciale du raccourci « Ajouter une dépense », accessible par un
 * appui long sur l'icone de l'application (voir manifest.webmanifest).
 * Elle n'affiche pas un ecran : elle demande une action.
 */
const CHEMIN_AJOUT_RAPIDE = '#/ajouter';

function lireAdresse() {
  const adresse = window.location.hash || '#/';

  if (adresse === CHEMIN_AJOUT_RAPIDE) {
    return { ecran: 'tableau', action: 'ajouter' };
  }

  const trouve = ECRANS.find((ecran) => ecran.chemin === adresse);
  return { ecran: trouve ? trouve.cle : 'tableau', action: null };
}

export function useRouteur() {
  const [position, definirPosition] = useState(lireAdresse);

  useEffect(() => {
    // "hashchange" se declenche aussi quand on appuie sur le bouton retour,
    // et quand le systeme ouvre l'application par un raccourci.
    const reagir = () => definirPosition(lireAdresse());
    window.addEventListener('hashchange', reagir);
    return () => window.removeEventListener('hashchange', reagir);
  }, []);

  const allerVers = useCallback((cle) => {
    const cible = ECRANS.find((e) => e.cle === cle) ?? ECRANS[0];
    if (window.location.hash !== cible.chemin) {
      window.location.hash = cible.chemin;
    }
    definirPosition({ ecran: cible.cle, action: null });
    // On remonte en haut : sinon on arrive au milieu du nouvel ecran.
    window.scrollTo({ top: 0 });
  }, []);

  /** Revient a l'ecran principal dont depend le sous-ecran affiche. */
  const retour = useCallback(() => {
    const courant = ECRANS.find((e) => e.cle === position.ecran);
    allerVers(courant?.parent ?? 'tableau');
  }, [position.ecran, allerVers]);

  /** Efface la demande d'action une fois qu'elle a ete traitee. */
  const effacerAction = useCallback(() => {
    definirPosition((precedent) => ({ ...precedent, action: null }));
    if (window.location.hash === CHEMIN_AJOUT_RAPIDE) {
      // history.replaceState evite d'ajouter une etape inutile : le bouton
      // retour ne doit pas rouvrir le formulaire d'ajout.
      window.history.replaceState(null, '', `${window.location.pathname}#/`);
    }
  }, []);

  const ecranCourant = ECRANS.find((e) => e.cle === position.ecran) ?? ECRANS[0];

  return {
    ecran: position.ecran,
    titre: ecranCourant.titre,
    estUnSousEcran: !ecranCourant.dansLaNavigation,
    action: position.action,
    allerVers,
    retour,
    effacerAction,
  };
}
