/*
 * FORMULAIRE D'UNE DEPENSE (OU D'UN REVENU) RECURRENT
 *
 * Loyer, abonnements, salaire... Le formulaire s'adapte a la frequence
 * choisie : on ne demande le jour de la semaine que pour une recurrence
 * hebdomadaire, le mois que pour une recurrence annuelle, etc.
 *
 * Avant de valider, un encadre montre l'effet concret sur le budget du mois :
 * combien de fois la depense tombera, combien elle representera au total, et
 * ou cela place la categorie par rapport a son plafond.
 */

import { useMemo, useRef, useState } from 'react';

import { FREQUENCES, JOURS_DE_LA_SEMAINE, impactSurLeMois } from '../utils/recurrences.js';
import { versCentimes, centimesVersTexte, formaterMontant } from '../utils/monnaie.js';
import { aujourdhui, estUneDateValide, nomDuMoisAffichage, moisActuel } from '../utils/dates.js';
import { etatDeLaCategorie } from '../utils/calculs.js';

const NOMS_DES_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function FormulaireRecurrence({
  recurrence = null,
  categories,
  devise,
  resume,
  plafonds,
  surEnregistrement,
  surAnnulation,
  surSuppression = null,
}) {
  const modification = recurrence !== null;

  const [libelle, definirLibelle] = useState(() => recurrence?.libelle ?? '');
  const [type, definirType] = useState(() => recurrence?.type ?? 'depense');
  const [montant, definirMontant] = useState(() =>
    recurrence ? centimesVersTexte(recurrence.montantCentimes) : ''
  );
  const [categorieId, definirCategorieId] = useState(
    () => recurrence?.categorieId ?? categories[0]?.id ?? ''
  );
  const [frequence, definirFrequence] = useState(() => recurrence?.frequence ?? 'mensuelle');
  const [jour, definirJour] = useState(() => String(recurrence?.jour ?? 1));
  const [jour2, definirJour2] = useState(() => String(recurrence?.jour2 ?? 15));
  const [jourSemaine, definirJourSemaine] = useState(() => String(recurrence?.jourSemaine ?? 1));
  const [moisDeLAnnee, definirMoisDeLAnnee] = useState(() =>
    String(recurrence?.moisDeLAnnee ?? 1)
  );
  const [dateDebut, definirDateDebut] = useState(() => recurrence?.dateDebut ?? aujourdhui());
  const [dateFin, definirDateFin] = useState(() => recurrence?.dateFin ?? '');
  const [erreurs, definirErreurs] = useState({});
  const [enCours, definirEnCours] = useState(false);

  const champLibelleRef = useRef(null);
  const champMontantRef = useRef(null);

  /** L'objet tel qu'il sera enregistre, reconstruit a chaque frappe. */
  const brouillon = useMemo(
    () => ({
      libelle: libelle.trim(),
      type,
      montantCentimes: versCentimes(montant) ?? 0,
      categorieId: type === 'revenu' ? null : categorieId,
      frequence,
      jour: Number(jour),
      jour2: Number(jour2),
      jourSemaine: Number(jourSemaine),
      moisDeLAnnee: Number(moisDeLAnnee),
      dateDebut,
      dateFin: dateFin || null,
    }),
    [libelle, type, montant, categorieId, frequence, jour, jour2, jourSemaine, moisDeLAnnee, dateDebut, dateFin]
  );

  // --- Apercu de l'impact sur le mois en cours ----------------------------
  const apercu = useMemo(() => {
    if (!brouillon.montantCentimes) return null;

    const mois = moisActuel();
    const impact = impactSurLeMois(brouillon, mois);
    if (impact.nombre === 0) return { mois, impact, ligne: null, apres: null };

    if (type === 'revenu') return { mois, impact, ligne: null, apres: null };

    // Ou se retrouvera la categorie une fois cette recurrence prise en compte ?
    const ligne = resume?.lignes?.find((l) => l.categorie.id === categorieId) ?? null;
    const plafond = plafonds?.[categorieId] ?? 0;

    // En modification, la depense actuelle contient deja les echeances de
    // cette recurrence : on ne les compte donc pas une seconde fois.
    const dejaCompte = modification ? impact.total : 0;
    const totalApres = (ligne?.depense ?? 0) - dejaCompte + impact.total;

    return {
      mois,
      impact,
      ligne,
      apres: { total: totalApres, plafond, ...etatDeLaCategorie(totalApres, plafond) },
    };
  }, [brouillon, type, categorieId, resume, plafonds, modification]);

  function verifier() {
    const problemes = {};
    if (brouillon.libelle.length === 0) problemes.libelle = 'Donnez un nom (par exemple « Loyer »).';

    const centimes = versCentimes(montant);
    if (centimes === null) problemes.montant = 'Indiquez un montant, par exemple 750.';
    else if (centimes === 0) problemes.montant = 'Le montant doit être supérieur à zéro.';

    if (!estUneDateValide(dateDebut)) problemes.dateDebut = 'Choisissez une date de début valide.';
    if (dateFin && !estUneDateValide(dateFin)) problemes.dateFin = 'Date de fin invalide.';
    if (dateFin && dateFin < dateDebut) problemes.dateFin = 'La fin doit suivre le début.';

    if (frequence === 'bimensuelle' && Number(jour) === Number(jour2)) {
      problemes.jour2 = 'Les deux jours doivent être différents.';
    }
    if (type !== 'revenu' && !categorieId) problemes.categorie = 'Choisissez une catégorie.';

    return problemes;
  }

  async function envoyer(evenement) {
    evenement.preventDefault();
    const problemes = verifier();
    definirErreurs(problemes);
    if (Object.keys(problemes).length > 0) {
      if (problemes.libelle) champLibelleRef.current?.focus();
      else if (problemes.montant) champMontantRef.current?.focus();
      return;
    }

    definirEnCours(true);
    try {
      await surEnregistrement(brouillon);
    } finally {
      definirEnCours(false);
    }
  }

  return (
    <form onSubmit={envoyer} noValidate>
      {/* --- Nom --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="champ-libelle">Nom</label>
        <input
          id="champ-libelle"
          ref={champLibelleRef}
          type="text"
          maxLength={50}
          value={libelle}
          onChange={(e) => definirLibelle(e.target.value)}
          placeholder="Loyer, Abonnement musique, Salaire…"
          aria-invalid={erreurs.libelle ? 'true' : undefined}
          required
        />
        {erreurs.libelle && <span className="champ-erreur" role="alert">{erreurs.libelle}</span>}
      </div>

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
              name="type-recurrence"
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
        <label className="champ-etiquette" htmlFor="champ-montant-recurrence">Montant</label>
        <div className="champ-montant">
          <input
            id="champ-montant-recurrence"
            ref={champMontantRef}
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={montant}
            onChange={(e) => definirMontant(e.target.value)}
            aria-invalid={erreurs.montant ? 'true' : undefined}
            required
          />
          <span className="devise" aria-hidden="true">€</span>
        </div>
        {erreurs.montant && <span className="champ-erreur" role="alert">{erreurs.montant}</span>}
      </div>

      {/* --- Categorie (depenses uniquement) --- */}
      {type === 'depense' && (
        <fieldset className="choix-categories">
          <legend>Catégorie</legend>
          {categories.map((categorie) => (
            <label
              key={categorie.id}
              className={`pastille-categorie ${categorie.id === categorieId ? 'selectionnee' : ''}`}
            >
              <input
                type="radio"
                name="categorie-recurrence"
                value={categorie.id}
                checked={categorie.id === categorieId}
                onChange={() => definirCategorieId(categorie.id)}
              />
              <span className="point" style={{ background: categorie.couleur }} aria-hidden="true" />
              <span aria-hidden="true">{categorie.emoji}</span>
              <span>{categorie.nom}</span>
            </label>
          ))}
          {erreurs.categorie && <span className="champ-erreur" role="alert">{erreurs.categorie}</span>}
        </fieldset>
      )}

      {/* --- Frequence --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="champ-frequence">Fréquence</label>
        <select
          id="champ-frequence"
          value={frequence}
          onChange={(e) => definirFrequence(e.target.value)}
          aria-describedby="aide-frequence"
        >
          {FREQUENCES.map((option) => (
            <option key={option.cle} value={option.cle}>{option.libelle}</option>
          ))}
        </select>
        <span className="champ-aide" id="aide-frequence">
          {FREQUENCES.find((f) => f.cle === frequence)?.description}
        </span>
      </div>

      {/* --- Reglages propres a chaque frequence --- */}
      {frequence === 'hebdomadaire' && (
        <div className="champ">
          <label className="champ-etiquette" htmlFor="champ-jour-semaine">Jour de la semaine</label>
          <select
            id="champ-jour-semaine"
            value={jourSemaine}
            onChange={(e) => definirJourSemaine(e.target.value)}
          >
            {JOURS_DE_LA_SEMAINE.map((option) => (
              <option key={option.valeur} value={option.valeur}>{option.libelle}</option>
            ))}
          </select>
        </div>
      )}

      {(frequence === 'mensuelle' || frequence === 'bimensuelle' || frequence === 'annuelle') && (
        <div className="ligne-champs">
          <div className="champ">
            <label className="champ-etiquette" htmlFor="champ-jour">
              {frequence === 'bimensuelle' ? 'Premier jour' : 'Jour du mois'}
            </label>
            <select id="champ-jour" value={jour} onChange={(e) => definirJour(e.target.value)}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {frequence === 'bimensuelle' && (
            <div className="champ">
              <label className="champ-etiquette" htmlFor="champ-jour2">Second jour</label>
              <select id="champ-jour2" value={jour2} onChange={(e) => definirJour2(e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              {erreurs.jour2 && <span className="champ-erreur" role="alert">{erreurs.jour2}</span>}
            </div>
          )}

          {frequence === 'annuelle' && (
            <div className="champ">
              <label className="champ-etiquette" htmlFor="champ-mois-annee">Mois</label>
              <select
                id="champ-mois-annee"
                value={moisDeLAnnee}
                onChange={(e) => definirMoisDeLAnnee(e.target.value)}
              >
                {NOMS_DES_MOIS.map((nom, index) => (
                  <option key={nom} value={index + 1}>{nom}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {Number(jour) > 28 && frequence !== 'hebdomadaire' && (
        <p className="champ-aide" style={{ marginTop: '-0.4rem', marginBottom: '0.9rem' }}>
          Les mois plus courts (février notamment) utiliseront leur dernier jour.
        </p>
      )}

      {/* --- Periode --- */}
      <div className="ligne-champs">
        <div className="champ">
          <label className="champ-etiquette" htmlFor="champ-date-debut">Première échéance</label>
          <input
            id="champ-date-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => definirDateDebut(e.target.value)}
            aria-invalid={erreurs.dateDebut ? 'true' : undefined}
          />
          {erreurs.dateDebut && <span className="champ-erreur" role="alert">{erreurs.dateDebut}</span>}
        </div>
        <div className="champ">
          <label className="champ-etiquette" htmlFor="champ-date-fin">
            Fin <span className="champ-aide" style={{ display: 'inline' }}>(facultatif)</span>
          </label>
          <input
            id="champ-date-fin"
            type="date"
            value={dateFin}
            onChange={(e) => definirDateFin(e.target.value)}
            aria-invalid={erreurs.dateFin ? 'true' : undefined}
          />
          {erreurs.dateFin && <span className="champ-erreur" role="alert">{erreurs.dateFin}</span>}
        </div>
      </div>

      {/* --- APERCU DE L'IMPACT (exige avant confirmation) --- */}
      {apercu && (
        <section className="carte apercu-impact" aria-live="polite">
          <h3>Effet sur {nomDuMoisAffichage(apercu.mois)}</h3>

          {apercu.impact.nombre === 0 ? (
            <p className="champ-aide">
              Aucune échéance ce mois-ci : la première tombera plus tard.
            </p>
          ) : (
            <>
              <p>
                <strong>{apercu.impact.nombre}</strong> échéance
                {apercu.impact.nombre > 1 ? 's' : ''} de{' '}
                <strong>{formaterMontant(brouillon.montantCentimes, devise)}</strong>, soit{' '}
                <strong>{formaterMontant(apercu.impact.total, devise)}</strong>{' '}
                {type === 'revenu' ? 'de revenus' : 'de dépenses'} sur le mois.
              </p>

              {apercu.apres && apercu.apres.plafond > 0 && (
                <div className={`niveau-${apercu.apres.niveau}`}>
                  <div className="ligne-budget-entete">
                    <span className="ligne-budget-nom">
                      <span className="texte">{apercu.ligne?.categorie.nom}</span>
                    </span>
                    <span className="ligne-budget-montants">
                      <strong>{formaterMontant(apercu.apres.total, devise)}</strong> /{' '}
                      {formaterMontant(apercu.apres.plafond, devise)}
                    </span>
                  </div>
                  <div className="barre-progression">
                    <div
                      className="barre-progression-remplissage"
                      style={{ width: `${Math.min(100, apercu.apres.pourcentage)}%` }}
                    />
                  </div>
                  <div className="ligne-budget-pied">
                    <span className="etiquette-niveau">
                      {apercu.apres.pourcentage} % — {apercu.apres.libelle}
                    </span>
                  </div>
                </div>
              )}

              {apercu.apres && apercu.apres.niveau === 'depasse' && (
                <p className="bandeau bandeau-alerte" style={{ marginTop: '0.6rem' }}>
                  <span aria-hidden="true">⚠️</span>
                  Cette récurrence fait dépasser le plafond de la catégorie.
                  Vous pouvez quand même l’enregistrer.
                </p>
              )}
            </>
          )}
        </section>
      )}

      <div className="rangee-boutons" style={{ marginTop: '0.9rem' }}>
        <button type="button" className="bouton bouton-discret" onClick={surAnnulation}>
          Annuler
        </button>
        <button type="submit" className="bouton bouton-principal" disabled={enCours}>
          {modification ? 'Enregistrer' : 'Créer la récurrence'}
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
            Supprimer cette récurrence
          </button>
        </div>
      )}
    </form>
  );
}
