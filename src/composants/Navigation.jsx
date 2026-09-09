/*
 * BARRE DE NAVIGATION
 * En bas de l'ecran sur telephone, sous l'en-tete sur ordinateur (voir le CSS).
 *
 * Elle ne montre que les cinq ecrans principaux. Les sous-ecrans
 * (recurrences, reçus, sauvegarde, securite) s'atteignent depuis eux, et
 * mettent en evidence l'onglet parent pendant leur affichage.
 */

import { ECRANS, ECRANS_DE_NAVIGATION } from '../hooks/useRouteur.js';

export function Navigation({ ecranCourant, allerVers }) {
  // Quand on est sur un sous-ecran, c'est son onglet parent qui reste allume.
  const definition = ECRANS.find((e) => e.cle === ecranCourant);
  const ongletActif = definition?.dansLaNavigation ? definition.cle : definition?.parent;

  return (
    <nav className="navigation" aria-label="Navigation principale">
      <ul className="navigation-liste">
        {ECRANS_DE_NAVIGATION.map((ecran) => {
          const actif = ecran.cle === ongletActif;
          return (
            <li key={ecran.cle}>
              <button
                type="button"
                className="navigation-bouton"
                onClick={() => allerVers(ecran.cle)}
                /* aria-current="page" indique aux lecteurs d'ecran quel
                   onglet est ouvert ; le CSS s'en sert aussi pour le style. */
                aria-current={actif ? 'page' : undefined}
                /* Le nom complet est donne aux lecteurs d'ecran, meme quand
                   l'etiquette visible est abregee faute de place. */
                aria-label={ecran.titre}
              >
                <span className="icone" aria-hidden="true">{ecran.icone}</span>
                <span aria-hidden="true">{ecran.titreCourt}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
