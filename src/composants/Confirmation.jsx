/*
 * PETITE FENETRE DE CONFIRMATION
 * Utilisee avant toute action irreversible (supprimer une depense, une
 * categorie, ou toutes les donnees).
 */

import { Modale } from './Modale.jsx';

export function Confirmation({
  titre,
  message,
  libelleConfirmation = 'Supprimer',
  surConfirmation,
  surAnnulation,
}) {
  return (
    <Modale titre={titre} surFermeture={surAnnulation}>
      <p>{message}</p>
      <div className="rangee-boutons">
        <button type="button" className="bouton bouton-discret" onClick={surAnnulation}>
          Annuler
        </button>
        <button type="button" className="bouton bouton-danger" onClick={surConfirmation}>
          {libelleConfirmation}
        </button>
      </div>
    </Modale>
  );
}
