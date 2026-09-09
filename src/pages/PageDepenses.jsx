/*
 * ECRAN "DEPENSES"
 *
 * La liste complete du mois, avec recherche par texte et filtre par categorie.
 * Un appui sur une ligne ouvre la fenetre de modification.
 */

import { useMemo, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { SelecteurMois } from '../composants/SelecteurMois.jsx';
import { ListeDepenses } from '../composants/ListeDepenses.jsx';
import { formaterMontant } from '../utils/monnaie.js';
import { totalDesDepenses } from '../utils/calculs.js';

export function PageDepenses({ surAjoutDepense, surModificationDepense, allerVers }) {
  const { mois, definirMois, depenses, categories, devise, recurrences, recus } = useBudget();

  const [recherche, definirRecherche] = useState('');
  const [filtreCategorie, definirFiltreCategorie] = useState('toutes');

  // On applique les deux filtres l'un apres l'autre.
  const depensesAffichees = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    return depenses.filter((depense) => {
      if (filtreCategorie !== 'toutes' && depense.categorieId !== filtreCategorie) {
        return false;
      }
      if (texte === '') return true;

      const categorie = categories.find((c) => c.id === depense.categorieId);
      const contenu = `${depense.note} ${categorie?.nom ?? ''}`.toLowerCase();
      return contenu.includes(texte);
    });
  }, [depenses, categories, recherche, filtreCategorie]);

  const total = totalDesDepenses(depensesAffichees);
  const filtreActif = recherche.trim() !== '' || filtreCategorie !== 'toutes';

  return (
    <div className="pile">
      <SelecteurMois mois={mois} surChangement={definirMois} />

      {/* Acces aux deux sous-ecrans lies aux depenses. */}
      <div className="rangee-boutons">
        <button type="button" className="bouton" onClick={() => allerVers('recurrences')}>
          <span aria-hidden="true">🔁</span> Récurrentes
          {recurrences.length > 0 && (
            <span className="etiquette-niveau">{recurrences.length}</span>
          )}
        </button>
        <button type="button" className="bouton" onClick={() => allerVers('recus')}>
          <span aria-hidden="true">📷</span> Reçus
          {recus.length > 0 && <span className="etiquette-niveau">{recus.length}</span>}
        </button>
      </div>

      <section className="carte">
        <div className="champ" style={{ marginBottom: '0.6rem' }}>
          <label className="champ-etiquette" htmlFor="champ-recherche">
            Rechercher
          </label>
          <input
            id="champ-recherche"
            type="text"
            placeholder="Un mot de la note ou une catégorie…"
            value={recherche}
            onChange={(e) => definirRecherche(e.target.value)}
          />
        </div>

        <div className="champ" style={{ marginBottom: 0 }}>
          <label className="champ-etiquette" htmlFor="champ-filtre-categorie">
            Catégorie
          </label>
          <select
            id="champ-filtre-categorie"
            value={filtreCategorie}
            onChange={(e) => definirFiltreCategorie(e.target.value)}
          >
            <option value="toutes">Toutes les catégories</option>
            {categories.map((categorie) => (
              <option key={categorie.id} value={categorie.id}>
                {categorie.nom}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="carte" aria-labelledby="titre-liste-depenses">
        <div className="carte-titre">
          <h2 id="titre-liste-depenses">
            {filtreActif ? 'Résultats' : 'Toutes les dépenses'}
          </h2>
          {/* aria-live : le total est relu quand un filtre change. */}
          <span className="montant-secondaire" aria-live="polite">
            {depensesAffichees.length} · {formaterMontant(total, devise)}
          </span>
        </div>

        <ListeDepenses
          depenses={depensesAffichees}
          categories={categories}
          devise={devise}
          surSelection={surModificationDepense}
        />
      </section>

      <button
        type="button"
        className="bouton-flottant"
        onClick={surAjoutDepense}
        aria-label="Ajouter une dépense"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
