/*
 * FORMULAIRE D'AJOUT ET DE MODIFICATION D'UNE DEPENSE
 *
 * Le meme formulaire sert dans les deux cas : s'il recoit une depense
 * existante, il la pre-remplit et propose un bouton "Supprimer".
 */

import { useMemo, useRef, useState } from 'react';
import { versCentimes, centimesVersTexte } from '../utils/monnaie.js';
import { aujourdhui, estUneDateValide } from '../utils/dates.js';

export function FormulaireDepense({
  depense = null,
  categories,
  surEnregistrement,
  surAnnulation,
  surSuppression = null,
}) {
  const modification = depense !== null;

  // --- Contenu des champs -------------------------------------------------
  const [montant, definirMontant] = useState(() =>
    depense ? centimesVersTexte(depense.montantCentimes) : ''
  );
  const [date, definirDate] = useState(() => depense?.date ?? aujourdhui());
  const [categorieId, definirCategorieId] = useState(
    () => depense?.categorieId ?? categories[0]?.id ?? ''
  );
  const [note, definirNote] = useState(() => depense?.note ?? '');
  // "depense" ou "revenu" : un revenu (salaire, remboursement) est compte a
  // part et ne remplit aucun plafond de categorie.
  const [type, definirType] = useState(() => depense?.type ?? 'depense');
  const [erreurs, definirErreurs] = useState({});
  const [enregistrementEnCours, definirEnregistrementEnCours] = useState(false);

  const champMontantRef = useRef(null);
  const champDateRef = useRef(null);

  // Les categories archivees ne sont plus proposees, sauf si la depense
  // modifiee en utilise une (sinon elle disparaitrait de la liste).
  const categoriesProposees = useMemo(
    () => categories.filter((c) => !c.archivee || c.id === categorieId),
    [categories, categorieId]
  );

  /** Verifie la saisie. Renvoie un objet vide si tout va bien. */
  function verifier() {
    const problemes = {};

    const centimes = versCentimes(montant);
    if (centimes === null) {
      problemes.montant = 'Indiquez un montant, par exemple 12,50.';
    } else if (centimes === 0) {
      problemes.montant = 'Le montant doit être supérieur à zéro.';
    } else if (centimes > 100000000) {
      problemes.montant = 'Ce montant semble trop élevé (maximum 1 000 000 €).';
    }

    if (!estUneDateValide(date)) {
      problemes.date = 'Choisissez une date valide.';
    }

    // Un revenu n'appartient a aucune categorie de depense.
    if (type === 'depense' && !categorieId) {
      problemes.categorie = 'Choisissez une catégorie.';
    }

    return problemes;
  }

  async function envoyer(evenement) {
    evenement.preventDefault();
    const problemes = verifier();
    definirErreurs(problemes);

    if (Object.keys(problemes).length > 0) {
      // On envoie le focus sur le premier champ en erreur : indispensable
      // pour les personnes qui n'utilisent pas la souris (WCAG 3.3.1).
      if (problemes.montant) champMontantRef.current?.focus();
      else if (problemes.date) champDateRef.current?.focus();
      return;
    }

    definirEnregistrementEnCours(true);
    try {
      await surEnregistrement({
        date,
        montantCentimes: versCentimes(montant),
        categorieId: type === 'revenu' ? null : categorieId,
        note,
        type,
      });
    } finally {
      definirEnregistrementEnCours(false);
    }
  }

  return (
    <form onSubmit={envoyer} noValidate>
      {/* --- Depense ou revenu --- */}
      <fieldset className="groupe-choix" style={{ marginBottom: '0.9rem' }}>
        <legend className="champ-etiquette">Nature</legend>
        {[
          { valeur: 'depense', libelle: 'Dépense' },
          { valeur: 'revenu', libelle: 'Revenu' },
        ].map((option) => (
          <label key={option.valeur} className={type === option.valeur ? 'selectionne' : ''}>
            <input
              type="radio"
              name="type-depense"
              value={option.valeur}
              checked={type === option.valeur}
              onChange={() => definirType(option.valeur)}
            />
            {option.libelle}
          </label>
        ))}
      </fieldset>

      {/* --- Montant --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="champ-montant">
          Montant
        </label>
        <div className="champ-montant">
          <input
            id="champ-montant"
            ref={champMontantRef}
            type="text"
            /* inputMode="decimal" fait apparaitre le pave numerique du
               telephone avec la virgule, sans bloquer la saisie au clavier. */
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={montant}
            onChange={(e) => definirMontant(e.target.value)}
            aria-invalid={erreurs.montant ? 'true' : undefined}
            aria-describedby={erreurs.montant ? 'erreur-montant' : undefined}
            required
          />
          <span className="devise" aria-hidden="true">€</span>
        </div>
        {erreurs.montant && (
          <span className="champ-erreur" id="erreur-montant" role="alert">
            {erreurs.montant}
          </span>
        )}
      </div>

      {/* --- Categorie (uniquement pour les depenses) --- */}
      <fieldset className="choix-categories" hidden={type === 'revenu'}>
        <legend>Catégorie</legend>
        {categoriesProposees.length === 0 && (
          <p className="champ-aide">
            Aucune catégorie : créez-en une depuis l’écran « Budgets ».
          </p>
        )}
        {categoriesProposees.map((categorie) => {
          const selectionnee = categorie.id === categorieId;
          return (
            <label
              key={categorie.id}
              className={`pastille-categorie ${selectionnee ? 'selectionnee' : ''}`}
            >
              <input
                type="radio"
                name="categorie"
                value={categorie.id}
                checked={selectionnee}
                onChange={() => definirCategorieId(categorie.id)}
              />
              <span
                className="point"
                style={{ background: categorie.couleur }}
                aria-hidden="true"
              />
              <span aria-hidden="true">{categorie.emoji}</span>
              <span>{categorie.nom}</span>
            </label>
          );
        })}
        {erreurs.categorie && (
          <span className="champ-erreur" role="alert">
            {erreurs.categorie}
          </span>
        )}
      </fieldset>

      {/* --- Date --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="champ-date">
          Date
        </label>
        <input
          id="champ-date"
          ref={champDateRef}
          type="date"
          value={date}
          onChange={(e) => definirDate(e.target.value)}
          aria-invalid={erreurs.date ? 'true' : undefined}
          aria-describedby={erreurs.date ? 'erreur-date' : undefined}
          required
        />
        {erreurs.date && (
          <span className="champ-erreur" id="erreur-date" role="alert">
            {erreurs.date}
          </span>
        )}
      </div>

      {/* --- Note --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="champ-note">
          Note <span className="champ-aide" style={{ display: 'inline' }}>(facultatif)</span>
        </label>
        <input
          id="champ-note"
          type="text"
          maxLength={120}
          placeholder="Courses au marché, essence…"
          value={note}
          onChange={(e) => definirNote(e.target.value)}
        />
      </div>

      <div className="rangee-boutons">
        <button type="button" className="bouton bouton-discret" onClick={surAnnulation}>
          Annuler
        </button>
        <button
          type="submit"
          className="bouton bouton-principal"
          disabled={enregistrementEnCours}
        >
          {modification
            ? 'Enregistrer'
            : type === 'revenu'
              ? 'Ajouter le revenu'
              : 'Ajouter la dépense'}
        </button>
      </div>

      {modification && surSuppression && (
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="bouton bouton-danger"
            style={{ width: '100%' }}
            onClick={surSuppression}
          >
            {type === 'revenu' ? 'Supprimer ce revenu' : 'Supprimer cette dépense'}
          </button>
        </div>
      )}
    </form>
  );
}
