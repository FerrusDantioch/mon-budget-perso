/*
 * Petite pastille "En ligne" / "Hors-ligne" affichee dans l'en-tete.
 *
 * Important : l'application fonctionne exactement pareil dans les deux cas.
 * L'indicateur sert a rassurer : hors-ligne, les depenses continuent d'etre
 * enregistrees normalement sur le telephone.
 */

import { useConnexion } from '../hooks/useConnexion.js';

export function IndicateurConnexion() {
  const enLigne = useConnexion();

  return (
    <span
      className={`indicateur-connexion ${enLigne ? 'en-ligne' : 'hors-ligne'}`}
      /* role="status" + aria-live : le lecteur d'ecran annonce le changement
         d'etat sans interrompre ce que la personne est en train de faire. */
      role="status"
      aria-live="polite"
      title={
        enLigne
          ? 'Connexion Internet disponible (elle n’est pas nécessaire).'
          : 'Aucune connexion : l’application fonctionne normalement, vos données sont sur cet appareil.'
      }
    >
      <span className="pastille" aria-hidden="true" />
      {enLigne ? 'En ligne' : 'Hors-ligne'}
    </span>
  );
}
