/*
 * DETECTION "EN LIGNE / HORS-LIGNE"
 *
 * Le navigateur previent quand la connexion est perdue ou retrouvee.
 * L'application n'a pas besoin d'Internet pour fonctionner : cet indicateur
 * sert uniquement a rassurer l'utilisateur ("mes donnees sont bien la").
 */

import { useEffect, useState } from 'react';

export function useConnexion() {
  const [enLigne, definirEnLigne] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );

  useEffect(() => {
    const passerEnLigne = () => definirEnLigne(true);
    const passerHorsLigne = () => definirEnLigne(false);

    window.addEventListener('online', passerEnLigne);
    window.addEventListener('offline', passerHorsLigne);

    // On resynchronise au cas ou l'etat aurait change pendant le chargement.
    definirEnLigne(navigator.onLine !== false);

    return () => {
      window.removeEventListener('online', passerEnLigne);
      window.removeEventListener('offline', passerHorsLigne);
    };
  }, []);

  return enLigne;
}
