/*
 * LISTE DES DEPENSES D'UN MOIS
 *
 * Les depenses sont regroupees par jour, du plus recent au plus ancien.
 * Chaque ligne est un bouton : appuyer dessus ouvre la modification.
 */

import { formaterMontant } from '../utils/monnaie.js';
import { formaterDateCourte } from '../utils/dates.js';

/** Regroupe les depenses par date : [{ date, depenses: [...] }, ...] */
function grouperParJour(depenses) {
  const groupes = new Map();
  for (const depense of depenses) {
    if (!groupes.has(depense.date)) groupes.set(depense.date, []);
    groupes.get(depense.date).push(depense);
  }
  // Les depenses arrivent deja triees : l'ordre des groupes est donc correct.
  return [...groupes.entries()].map(([date, liste]) => ({ date, depenses: liste }));
}

export function ListeDepenses({ depenses, categories, devise, surSelection }) {
  if (depenses.length === 0) {
    return (
      <p className="centre-vide">
        Aucune dépense enregistrée pour ce mois.
      </p>
    );
  }

  // Petit dictionnaire pour retrouver une categorie par son identifiant
  // sans reparcourir la liste a chaque ligne.
  const parIdentifiant = new Map(categories.map((c) => [c.id, c]));
  const groupes = grouperParJour(depenses);

  return (
    <div>
      {groupes.map((groupe) => {
        // Les revenus se soustraient du total du jour plutot que de s y ajouter.
        const totalDuJour = groupe.depenses.reduce(
          (somme, d) => somme + (d.type === 'revenu' ? -d.montantCentimes : d.montantCentimes),
          0
        );
        return (
          <section key={groupe.date}>
            <h3 className="groupe-jour">
              {formaterDateCourte(groupe.date)}
              <span className="sr-seulement">
                , total {formaterMontant(totalDuJour, devise)}
              </span>
            </h3>
            <ul className="liste-depenses">
              {groupe.depenses.map((depense) => {
                const estUnRevenu = depense.type === 'revenu';
                const categorie = parIdentifiant.get(depense.categorieId);
                const nomCategorie = estUnRevenu
                  ? 'Revenu'
                  : categorie
                    ? categorie.nom
                    : 'Sans catégorie';
                return (
                  <li key={depense.id}>
                    <button
                      type="button"
                      className="depense"
                      onClick={() => surSelection(depense)}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid var(--bordure)',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                      aria-label={`Modifier : ${estUnRevenu ? 'revenu' : nomCategorie}, ${formaterMontant(
                        depense.montantCentimes,
                        devise
                      )}${depense.note ? `, ${depense.note}` : ''}, le ${formaterDateCourte(
                        depense.date
                      )}`}
                    >
                      <span
                        className="depense-pastille"
                        style={{
                          background: estUnRevenu
                            ? 'var(--ok)'
                            : (categorie?.couleur ?? '#94a3b8'),
                        }}
                        aria-hidden="true"
                      >
                        {estUnRevenu ? '💰' : (categorie?.emoji ?? '•')}
                      </span>
                      <span className="depense-details">
                        <span className="depense-titre">
                          {depense.note || nomCategorie}
                        </span>
                        <span className="depense-sous-titre">
                          {depense.note ? nomCategorie : formaterDateCourte(depense.date)}
                        </span>
                      </span>
                      <span
                        className="depense-montant"
                        style={estUnRevenu ? { color: 'var(--ok)' } : undefined}
                      >
                        {estUnRevenu ? '+ ' : ''}
                        {formaterMontant(depense.montantCentimes, devise)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
