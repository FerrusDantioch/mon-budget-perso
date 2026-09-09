/*
 * FORMULAIRE DE CREATION / MODIFICATION D'UNE CATEGORIE
 * (nom, emoji, couleur, plafond mensuel habituel)
 */

import { useRef, useState } from 'react';
import { PALETTE_COULEURS, EMOJIS_SUGGERES } from '../donnees/categoriesParDefaut.js';
import { versCentimes, centimesVersTexte } from '../utils/monnaie.js';

export function FormulaireCategorie({
  categorie = null,
  surEnregistrement,
  surAnnulation,
  surSuppression = null,
}) {
  const modification = categorie !== null;

  const [nom, definirNom] = useState(() => categorie?.nom ?? '');
  const [emoji, definirEmoji] = useState(() => categorie?.emoji ?? '📦');
  const [couleur, definirCouleur] = useState(() => categorie?.couleur ?? PALETTE_COULEURS[0]);
  const [plafond, definirPlafond] = useState(() =>
    categorie ? centimesVersTexte(categorie.plafondCentimes ?? 0) : ''
  );
  const [erreurs, definirErreurs] = useState({});
  const champNomRef = useRef(null);

  async function envoyer(evenement) {
    evenement.preventDefault();

    const problemes = {};
    if (nom.trim().length === 0) problemes.nom = 'Donnez un nom à cette catégorie.';
    if (nom.trim().length > 40) problemes.nom = 'Le nom est trop long (40 caractères maximum).';

    // Un plafond vide signifie "pas de limite" : c'est autorise.
    const centimes = plafond.trim() === '' ? 0 : versCentimes(plafond);
    if (centimes === null) problemes.plafond = 'Indiquez un montant, par exemple 250.';

    definirErreurs(problemes);
    if (Object.keys(problemes).length > 0) {
      if (problemes.nom) champNomRef.current?.focus();
      return;
    }

    await surEnregistrement({
      nom: nom.trim(),
      emoji,
      couleur,
      plafondCentimes: centimes,
    });
  }

  return (
    <form onSubmit={envoyer} noValidate>
      <div className="champ">
        <label className="champ-etiquette" htmlFor="champ-nom-categorie">
          Nom
        </label>
        <input
          id="champ-nom-categorie"
          ref={champNomRef}
          type="text"
          maxLength={40}
          value={nom}
          onChange={(e) => definirNom(e.target.value)}
          placeholder="Alimentation, Transport…"
          aria-invalid={erreurs.nom ? 'true' : undefined}
          required
        />
        {erreurs.nom && (
          <span className="champ-erreur" role="alert">{erreurs.nom}</span>
        )}
      </div>

      <fieldset className="grille-emojis">
        <legend>Icône</legend>
        {EMOJIS_SUGGERES.map((choix) => (
          <label
            key={choix}
            className={`puce-emoji ${choix === emoji ? 'selectionnee' : ''}`}
          >
            <input
              type="radio"
              name="emoji"
              value={choix}
              checked={choix === emoji}
              onChange={() => definirEmoji(choix)}
            />
            <span aria-hidden="true">{choix}</span>
            <span className="sr-seulement">Icône {choix}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="grille-couleurs">
        <legend>Couleur</legend>
        {PALETTE_COULEURS.map((choix, index) => (
          <label
            key={choix}
            className={`puce-couleur ${choix === couleur ? 'selectionnee' : ''}`}
            style={{ background: choix }}
          >
            <input
              type="radio"
              name="couleur"
              value={choix}
              checked={choix === couleur}
              onChange={() => definirCouleur(choix)}
            />
            {/* La coche confirme le choix sans dependre de la couleur seule. */}
            {choix === couleur && <span aria-hidden="true" style={{ color: '#fff' }}>✓</span>}
            <span className="sr-seulement">Couleur {index + 1}</span>
          </label>
        ))}
      </fieldset>

      <div className="champ">
        <label className="champ-etiquette" htmlFor="champ-plafond-categorie">
          Plafond mensuel habituel
        </label>
        <div className="champ-montant">
          <input
            id="champ-plafond-categorie"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={plafond}
            onChange={(e) => definirPlafond(e.target.value)}
            aria-invalid={erreurs.plafond ? 'true' : undefined}
            aria-describedby="aide-plafond-categorie"
          />
          <span className="devise" aria-hidden="true">€</span>
        </div>
        <span className="champ-aide" id="aide-plafond-categorie">
          Laissez vide pour ne fixer aucune limite. Ce montant sert de point de
          départ pour chaque nouveau mois.
        </span>
        {erreurs.plafond && (
          <span className="champ-erreur" role="alert">{erreurs.plafond}</span>
        )}
      </div>

      <div className="rangee-boutons">
        <button type="button" className="bouton bouton-discret" onClick={surAnnulation}>
          Annuler
        </button>
        <button type="submit" className="bouton bouton-principal">
          {modification ? 'Enregistrer' : 'Créer la catégorie'}
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
            Supprimer cette catégorie
          </button>
        </div>
      )}
    </form>
  );
}
