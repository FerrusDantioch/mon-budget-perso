/*
 * UNE LIGNE DE BUDGET : nom de la categorie + barre de progression.
 *
 * Code couleur (defini dans src/styles/composants.css) :
 *   vert    : moins de 80 % du plafond consomme
 *   orange  : a partir de 80 %
 *   rouge   : a partir de 95 %
 *   rouge fonce : plafond depasse
 *
 * La couleur n'est jamais la seule information : le pourcentage et un texte
 * ("Attention", "Budget dépassé"...) sont toujours affiches a cote (WCAG 1.4.1).
 */

import { formaterMontant } from '../utils/monnaie.js';

export function LigneBudget({ ligne, devise }) {
  const { categorie, depense, plafond, pourcentage, niveau, libelle, reste, depassement } = ligne;

  // La barre ne depasse jamais 100 % de largeur, meme si le budget est explose.
  const largeur = Math.min(100, pourcentage);

  return (
    <div className={`ligne-budget niveau-${niveau}`}>
      <div className="ligne-budget-entete">
        <span className="ligne-budget-nom">
          <span aria-hidden="true">{categorie.emoji ?? '•'}</span>
          <span className="texte">{categorie.nom}</span>
        </span>
        <span className="ligne-budget-montants">
          <strong>{formaterMontant(depense, devise)}</strong>
          {plafond > 0 && <> / {formaterMontant(plafond, devise)}</>}
        </span>
      </div>

      {/* role="progressbar" : les lecteurs d'ecran annoncent "62 pour cent". */}
      <div
        className="barre-progression"
        role="progressbar"
        aria-valuenow={plafond > 0 ? pourcentage : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${categorie.nom} : ${plafond > 0 ? `${pourcentage} % du budget utilisé` : 'aucun plafond défini'}`}
      >
        <div
          className="barre-progression-remplissage"
          style={{ width: `${plafond > 0 ? largeur : 0}%` }}
        />
      </div>

      <div className="ligne-budget-pied">
        <span className="etiquette-niveau">
          {plafond > 0 ? `${pourcentage} % — ${libelle}` : libelle}
        </span>
        <span>
          {plafond <= 0
            ? ''
            : depassement > 0
              ? `Dépassement de ${formaterMontant(depassement, devise)}`
              : `Reste ${formaterMontant(reste, devise)}`}
        </span>
      </div>
    </div>
  );
}
