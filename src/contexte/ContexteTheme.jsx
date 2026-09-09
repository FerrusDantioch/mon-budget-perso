/*
 * THEME CLAIR / SOMBRE
 *
 * Un "contexte" React est une valeur partagee que n'importe quel composant de
 * l'application peut lire, sans avoir a la faire passer de parent en enfant.
 *
 * Ici, le contexte retient le theme choisi et l'ecrit sur la balise <html>
 * sous la forme d'un attribut (data-theme="sombre"). Le fichier CSS s'occupe
 * ensuite de changer toutes les couleurs d'un coup.
 *
 * Trois choix possibles :
 *   "auto"   : on suit le reglage du telephone (par defaut)
 *   "clair"  : toujours clair
 *   "sombre" : toujours sombre
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ContexteTheme = createContext(null);

// Le theme est stocke dans localStorage et non dans IndexedDB : il doit etre
// lu instantanement au demarrage, avant meme l'ouverture de la base, sinon
// l'ecran clignoterait en blanc avant de passer en sombre.
const CLE_STOCKAGE = 'budget-theme';

/** Lit le theme enregistre, en se protegeant des navigateurs qui bloquent le stockage. */
function lireThemeEnregistre() {
  try {
    const valeur = localStorage.getItem(CLE_STOCKAGE);
    if (valeur === 'clair' || valeur === 'sombre' || valeur === 'auto') return valeur;
  } catch (erreur) {
    // Navigation privee très restrictive : on ignore et on reste en "auto".
  }
  return 'auto';
}

export function FournisseurTheme({ children }) {
  const [theme, definirTheme] = useState(lireThemeEnregistre);

  // "systemeEnSombre" suit le reglage du telephone en temps reel : si
  // l'utilisateur bascule son telephone en mode sombre, l'application suit.
  const [systemeEnSombre, definirSystemeEnSombre] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const reagir = (evenement) => definirSystemeEnSombre(evenement.matches);
    media.addEventListener('change', reagir);
    return () => media.removeEventListener('change', reagir);
  }, []);

  // Le theme reellement affiche : "clair" ou "sombre".
  const themeApplique = theme === 'auto' ? (systemeEnSombre ? 'sombre' : 'clair') : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeApplique);

    // On met aussi a jour la couleur de la barre systeme du telephone.
    const couleur = themeApplique === 'sombre' ? '#12151a' : '#f7f8fa';
    for (const balise of document.querySelectorAll('meta[name="theme-color"]')) {
      balise.setAttribute('content', couleur);
    }
  }, [themeApplique]);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, theme);
    } catch (erreur) {
      // Stockage indisponible : le choix ne sera pas retenu au prochain lancement.
    }
  }, [theme]);

  const valeur = useMemo(
    () => ({ theme, themeApplique, definirTheme }),
    [theme, themeApplique]
  );

  return <ContexteTheme.Provider value={valeur}>{children}</ContexteTheme.Provider>;
}

/** Raccourci utilise dans les composants : const { theme } = useTheme(); */
export function useTheme() {
  const contexte = useContext(ContexteTheme);
  if (!contexte) {
    throw new Error('useTheme doit etre utilise a l’interieur de <FournisseurTheme>');
  }
  return contexte;
}
