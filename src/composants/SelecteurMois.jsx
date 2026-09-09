/*
 * Selecteur de mois : « < | mars 2026 | > »
 * Utilise sur le tableau de bord, les depenses, les budgets et l'historique.
 */

import { nomDuMoisAffichage, moisPrecedent, moisSuivant, moisActuel } from '../utils/dates.js';

export function SelecteurMois({ mois, surChangement }) {
  const estLeMoisEnCours = mois === moisActuel();

  return (
    <div className="selecteur-mois">
      <button
        type="button"
        className="bouton-icone"
        onClick={() => surChangement(moisPrecedent(mois))}
        aria-label="Mois précédent"
      >
        ‹
      </button>

      {/* aria-live : quand on change de mois, le nouveau mois est annonce. */}
      <span className="selecteur-mois-libelle" aria-live="polite">
        {nomDuMoisAffichage(mois)}
      </span>

      <button
        type="button"
        className="bouton-icone"
        onClick={() => surChangement(moisSuivant(mois))}
        aria-label="Mois suivant"
      >
        ›
      </button>

      {/* Raccourci pour revenir au mois en cours, affiche seulement si utile. */}
      {!estLeMoisEnCours && (
        <button
          type="button"
          className="bouton-icone"
          onClick={() => surChangement(moisActuel())}
          aria-label="Revenir au mois en cours"
          title="Revenir au mois en cours"
        >
          ⟲
        </button>
      )}
    </div>
  );
}
