/*
 * FENETRE MODALE (boite de dialogue)
 *
 * Une modale accessible doit respecter quatre regles :
 *   1. le focus part dans la fenetre a l'ouverture ;
 *   2. la touche Echap la ferme ;
 *   3. la tabulation tourne en boucle a l'interieur (on ne doit pas se
 *      retrouver "derriere" la fenetre sans le voir) ;
 *   4. a la fermeture, le focus revient sur le bouton qui l'avait ouverte.
 */

import { useEffect, useRef } from 'react';

export function Modale({ titre, children, surFermeture }) {
  const boiteRef = useRef(null);
  const elementPrecedentRef = useRef(null);

  useEffect(() => {
    // On memorise ou etait le focus avant l'ouverture.
    elementPrecedentRef.current = document.activeElement;

    // Empeche la page du dessous de defiler pendant que la modale est ouverte.
    const debordementInitial = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // On place le focus sur le premier element interactif de la fenetre.
    const boite = boiteRef.current;
    const focusables = boite?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables && focusables.length > 0) {
      focusables[0].focus();
    } else {
      boite?.focus();
    }

    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') {
        evenement.stopPropagation();
        surFermeture();
        return;
      }

      if (evenement.key !== 'Tab') return;

      // Piege a focus : on fait boucler la tabulation dans la fenetre.
      const liste = boiteRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!liste || liste.length === 0) return;
      const premier = liste[0];
      const dernier = liste[liste.length - 1];

      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener('keydown', surTouche, true);

    return () => {
      document.removeEventListener('keydown', surTouche, true);
      document.body.style.overflow = debordementInitial;
      // Retour du focus la ou il etait, si l'element existe toujours.
      if (elementPrecedentRef.current && elementPrecedentRef.current.focus) {
        elementPrecedentRef.current.focus();
      }
    };
  }, [surFermeture]);

  return (
    <div
      className="fond-modale"
      /* Un clic en dehors de la fenetre la ferme. */
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) surFermeture();
      }}
    >
      <div
        className="modale"
        ref={boiteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modale"
        tabIndex={-1}
      >
        <div className="modale-entete">
          <h2 id="titre-modale">{titre}</h2>
          <button
            type="button"
            className="bouton-icone"
            onClick={surFermeture}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
