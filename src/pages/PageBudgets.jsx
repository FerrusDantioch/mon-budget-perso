/*
 * ECRAN "BUDGETS"
 *
 * Deux parties :
 *   1. les plafonds du mois affiche (modifiables) ;
 *   2. la gestion des categories (creer, modifier, supprimer).
 *
 * Chaque mois garde ses propres plafonds : consulter un mois passe montre donc
 * les objectifs de l'epoque, et non ceux d'aujourd'hui.
 */

import { useEffect, useMemo, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { SelecteurMois } from '../composants/SelecteurMois.jsx';
import { Modale } from '../composants/Modale.jsx';
import { Confirmation } from '../composants/Confirmation.jsx';
import { FormulaireCategorie } from '../composants/FormulaireCategorie.jsx';
import { formaterMontant, versCentimes, centimesVersTexte } from '../utils/monnaie.js';
import { nomDuMoisAffichage } from '../utils/dates.js';

export function PageBudgets({ surMessage }) {
  const {
    mois,
    definirMois,
    categories,
    plafonds,
    resume,
    devise,
    enregistrerPlafonds,
    ajouterCategorie,
    modifierCategorie,
    supprimerCategorie,
  } = useBudget();

  // Le contenu des champs de saisie, sous forme de texte ("250,00").
  const [saisies, definirSaisies] = useState({});
  const [appliquerAuxSuivants, definirAppliquerAuxSuivants] = useState(true);
  const [enregistrement, definirEnregistrement] = useState(false);

  const [categorieEnEdition, definirCategorieEnEdition] = useState(null); // objet ou "nouvelle"
  const [categorieASupprimer, definirCategorieASupprimer] = useState(null);

  // Quand on change de mois (ou que les plafonds changent), on remet les
  // champs a jour avec les valeurs enregistrees.
  useEffect(() => {
    const initial = {};
    for (const categorie of categories) {
      const valeur = plafonds[categorie.id] ?? 0;
      initial[categorie.id] = valeur > 0 ? centimesVersTexte(valeur) : '';
    }
    definirSaisies(initial);
  }, [categories, plafonds, mois]);

  // Total des plafonds en cours de saisie (recalcule a chaque frappe).
  const totalSaisi = useMemo(() => {
    return Object.values(saisies).reduce((somme, texte) => {
      const centimes = texte.trim() === '' ? 0 : versCentimes(texte);
      return somme + (centimes ?? 0);
    }, 0);
  }, [saisies]);

  const saisieInvalide = useMemo(
    () =>
      Object.values(saisies).some(
        (texte) => texte.trim() !== '' && versCentimes(texte) === null
      ),
    [saisies]
  );

  async function enregistrer(evenement) {
    evenement.preventDefault();
    if (saisieInvalide) return;

    const nouveaux = {};
    for (const categorie of categories) {
      const texte = saisies[categorie.id] ?? '';
      nouveaux[categorie.id] = texte.trim() === '' ? 0 : versCentimes(texte);
    }

    definirEnregistrement(true);
    try {
      await enregistrerPlafonds(nouveaux, appliquerAuxSuivants);
      surMessage('Budgets enregistrés');
    } finally {
      definirEnregistrement(false);
    }
  }

  return (
    <div className="pile">
      <SelecteurMois mois={mois} surChangement={definirMois} />

      {/* ================= PLAFONDS DU MOIS ================= */}
      <section className="carte" aria-labelledby="titre-plafonds">
        <div className="carte-titre">
          <h2 id="titre-plafonds">Budget de {nomDuMoisAffichage(mois)}</h2>
        </div>

        {categories.length === 0 ? (
          <p className="centre-vide">
            Créez d’abord une catégorie, plus bas dans cet écran.
          </p>
        ) : (
          <form onSubmit={enregistrer} noValidate>
            {categories.map((categorie) => {
              const depense =
                resume.lignes.find((l) => l.categorie.id === categorie.id)?.depense ?? 0;
              return (
                <div className="champ" key={categorie.id}>
                  <label
                    className="champ-etiquette"
                    htmlFor={`plafond-${categorie.id}`}
                  >
                    <span aria-hidden="true">{categorie.emoji} </span>
                    {categorie.nom}
                  </label>
                  <div className="champ-montant">
                    <input
                      id={`plafond-${categorie.id}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="Aucune limite"
                      value={saisies[categorie.id] ?? ''}
                      onChange={(e) =>
                        definirSaisies((precedent) => ({
                          ...precedent,
                          [categorie.id]: e.target.value,
                        }))
                      }
                      aria-describedby={`aide-plafond-${categorie.id}`}
                      aria-invalid={
                        (saisies[categorie.id] ?? '').trim() !== '' &&
                        versCentimes(saisies[categorie.id]) === null
                          ? 'true'
                          : undefined
                      }
                    />
                    <span className="devise" aria-hidden="true">€</span>
                  </div>
                  <span className="champ-aide" id={`aide-plafond-${categorie.id}`}>
                    Déjà dépensé ce mois-ci : {formaterMontant(depense, devise)}
                  </span>
                </div>
              );
            })}

            <div className="chiffre-cle" style={{ marginBottom: '0.9rem' }}>
              <span className="etiquette">Budget total du mois</span>
              <span className="valeur" aria-live="polite">
                {formaterMontant(totalSaisi, devise)}
              </span>
            </div>

            <label className="champ-case">
              <input
                type="checkbox"
                checked={appliquerAuxSuivants}
                onChange={(e) => definirAppliquerAuxSuivants(e.target.checked)}
              />
              <span>
                Utiliser aussi ces montants pour les mois suivants
                <span className="champ-aide">
                  Décochez pour ne modifier que {nomDuMoisAffichage(mois)}.
                </span>
              </span>
            </label>

            {saisieInvalide && (
              <p className="champ-erreur" role="alert">
                Un des montants n’est pas valide. Utilisez des chiffres, par
                exemple 250 ou 250,50.
              </p>
            )}

            <div className="rangee-boutons" style={{ marginTop: '0.9rem' }}>
              <button
                type="submit"
                className="bouton bouton-principal"
                disabled={enregistrement || saisieInvalide}
              >
                Enregistrer les budgets
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ================= CATEGORIES ================= */}
      <section className="carte" aria-labelledby="titre-categories-gestion">
        <div className="carte-titre">
          <h2 id="titre-categories-gestion">Catégories</h2>
          <button
            type="button"
            className="bouton bouton-discret"
            onClick={() => definirCategorieEnEdition('nouvelle')}
          >
            + Ajouter
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="centre-vide">Aucune catégorie.</p>
        ) : (
          <ul className="liste-reglages">
            {categories.map((categorie) => (
              <li key={categorie.id}>
                <span
                  className="depense-pastille"
                  style={{ background: categorie.couleur }}
                  aria-hidden="true"
                >
                  {categorie.emoji}
                </span>
                <span className="principal">
                  <span className="titre">{categorie.nom}</span>
                  <span className="detail">
                    {categorie.plafondCentimes > 0
                      ? `Plafond habituel : ${formaterMontant(categorie.plafondCentimes, devise)}`
                      : 'Aucun plafond habituel'}
                  </span>
                </span>
                <button
                  type="button"
                  className="bouton bouton-discret"
                  onClick={() => definirCategorieEnEdition(categorie)}
                  aria-label={`Modifier la catégorie ${categorie.nom}`}
                >
                  Modifier
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ================= FENETRES ================= */}
      {categorieEnEdition && (
        <Modale
          titre={
            categorieEnEdition === 'nouvelle'
              ? 'Nouvelle catégorie'
              : 'Modifier la catégorie'
          }
          surFermeture={() => definirCategorieEnEdition(null)}
        >
          <FormulaireCategorie
            categorie={categorieEnEdition === 'nouvelle' ? null : categorieEnEdition}
            surAnnulation={() => definirCategorieEnEdition(null)}
            surEnregistrement={async (donnees) => {
              if (categorieEnEdition === 'nouvelle') {
                await ajouterCategorie(donnees);
                surMessage('Catégorie créée');
              } else {
                await modifierCategorie(categorieEnEdition.id, donnees);
                surMessage('Catégorie modifiée');
              }
              definirCategorieEnEdition(null);
            }}
            surSuppression={
              categorieEnEdition === 'nouvelle'
                ? null
                : () => {
                    definirCategorieASupprimer(categorieEnEdition);
                    definirCategorieEnEdition(null);
                  }
            }
          />
        </Modale>
      )}

      {categorieASupprimer && (
        <Confirmation
          titre="Supprimer la catégorie ?"
          message={`« ${categorieASupprimer.nom} » sera supprimée. Vos dépenses déjà enregistrées ne sont pas effacées : elles seront regroupées sous « Sans catégorie ».`}
          surAnnulation={() => definirCategorieASupprimer(null)}
          surConfirmation={async () => {
            await supprimerCategorie(categorieASupprimer.id);
            definirCategorieASupprimer(null);
            surMessage('Catégorie supprimée');
          }}
        />
      )}
    </div>
  );
}
