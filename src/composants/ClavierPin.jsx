/*
 * CLAVIER NUMERIQUE DU CODE PIN
 *
 * On n'utilise pas un champ de saisie ordinaire : sur telephone, il ferait
 * apparaitre le clavier du systeme, qui masque la moitie de l'ecran et
 * propose parfois de « retenir » ce qui est tape.
 *
 * Ce clavier dessine lui-meme ses touches. Il reste utilisable au clavier
 * physique (chiffres, Retour arriere, Entree) pour l'usage sur ordinateur et
 * pour les personnes qui n'utilisent pas l'ecran tactile.
 */

import { useEffect, useRef } from 'react';
import { LONGUEUR_CODE_MAX, LONGUEUR_CODE_MIN } from '../securite/coffre.js';

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'effacer'];

export function ClavierPin({
  valeur,
  surChangement,
  surValidation,
  desactive = false,
  longueurAttendue = null,
  libelleValidation = 'Valider',
}) {
  const zoneRef = useRef(null);
  const validationRef = useRef(surValidation);
  validationRef.current = surValidation;

  const assezLong = valeur.length >= LONGUEUR_CODE_MIN;

  function ajouterUnChiffre(chiffre) {
    if (desactive || valeur.length >= LONGUEUR_CODE_MAX) return;
    const suivant = valeur + chiffre;
    surChangement(suivant);

    // Quand la longueur du code est connue (deverrouillage), on valide tout
    // seul : un bouton de plus a appuyer n'apporterait rien.
    if (longueurAttendue && suivant.length === longueurAttendue) {
      setTimeout(() => validationRef.current(suivant), 80);
    }
  }

  function effacerUnChiffre() {
    if (desactive) return;
    surChangement(valeur.slice(0, -1));
  }

  // Clavier physique (ordinateur).
  useEffect(() => {
    const surTouche = (evenement) => {
      if (desactive) return;
      if (/^\d$/.test(evenement.key)) {
        evenement.preventDefault();
        ajouterUnChiffre(evenement.key);
      } else if (evenement.key === 'Backspace') {
        evenement.preventDefault();
        effacerUnChiffre();
      } else if (evenement.key === 'Enter' && assezLong) {
        evenement.preventDefault();
        validationRef.current(valeur);
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });

  return (
    <div className="clavier-pin" ref={zoneRef}>
      {/* Points indiquant le nombre de chiffres deja saisis. */}
      <div
        className="points-code"
        role="status"
        aria-live="polite"
        aria-label={`${valeur.length} chiffre${valeur.length > 1 ? 's' : ''} saisi${valeur.length > 1 ? 's' : ''}`}
      >
        {Array.from({ length: longueurAttendue ?? LONGUEUR_CODE_MAX }).map((_, index) => (
          <span
            key={index}
            className={`point-code ${index < valeur.length ? 'rempli' : ''} ${
              !longueurAttendue && index >= LONGUEUR_CODE_MIN ? 'facultatif' : ''
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="touches-pin">
        {TOUCHES.map((touche, index) => {
          if (touche === null) return <span key={`vide-${index}`} />;

          if (touche === 'effacer') {
            return (
              <button
                key="effacer"
                type="button"
                className="touche-pin touche-secondaire"
                onClick={effacerUnChiffre}
                disabled={desactive || valeur.length === 0}
                aria-label="Effacer le dernier chiffre"
              >
                <span aria-hidden="true">⌫</span>
              </button>
            );
          }

          return (
            <button
              key={touche}
              type="button"
              className="touche-pin"
              onClick={() => ajouterUnChiffre(touche)}
              disabled={desactive || valeur.length >= LONGUEUR_CODE_MAX}
            >
              {touche}
            </button>
          );
        })}
      </div>

      {/* Le bouton de validation reste affiche meme en saisie automatique :
          il sert pour les codes de 4 ou 5 chiffres. */}
      <button
        type="button"
        className="bouton bouton-principal"
        style={{ width: '100%', marginTop: '0.75rem' }}
        onClick={() => surValidation(valeur)}
        disabled={desactive || !assezLong}
      >
        {libelleValidation}
      </button>
    </div>
  );
}
