/*
 * ECRAN "TABLEAU DE BORD"
 *
 * Vue d'ensemble du mois : total depense, graphique de repartition,
 * et une barre de progression par categorie.
 */

import { lazy, Suspense, useMemo } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { SelecteurMois } from '../composants/SelecteurMois.jsx';
import { LigneBudget } from '../composants/LigneBudget.jsx';
import { CarteChargement } from '../composants/CarteChargement.jsx';
import { formaterMontant } from '../utils/monnaie.js';
import { donneesDuCamembert, rythmeDuMois } from '../utils/calculs.js';
import {
  moisActuel,
  aujourdhui,
  nombreDeJoursDansLeMois,
  nomDuMoisAffichage,
} from '../utils/dates.js';

// React.lazy : le code du graphique (et la librairie Recharts, la plus lourde
// de l'application) n'est telecharge qu'au moment ou cet ecran s'affiche.
// Cela reduit fortement la duree du tout premier chargement.
const CamembertDepenses = lazy(() => import('../composants/CamembertDepenses.jsx'));

export function TableauDeBord({ surAjoutDepense }) {
  const { mois, definirMois, resume, devise, depenses } = useBudget();

  const donneesGraphique = useMemo(() => donneesDuCamembert(resume), [resume]);

  // Rythme de depense : uniquement pour le mois en cours (un mois passe est
  // termine, il n'y a plus rien a repartir sur les jours restants).
  const rythme = useMemo(() => {
    if (mois !== moisActuel()) {
      return { pertinent: false, disponibleParJour: 0, joursRestants: 0, moyenneParJour: 0 };
    }
    const jour = Number(aujourdhui().slice(8, 10));
    return rythmeDuMois(
      resume.totalDepense,
      resume.totalPlafond,
      jour,
      nombreDeJoursDansLeMois(mois)
    );
  }, [mois, resume.totalDepense, resume.totalPlafond]);

  const resteGlobal = resume.totalPlafond - resume.totalDepense;

  return (
    <div className="pile">
      <SelecteurMois mois={mois} surChangement={definirMois} />

      {/* --- Chiffres cles --- */}
      <section className="carte" aria-labelledby="titre-resume">
        <h2 id="titre-resume" className="sr-seulement">
          Résumé de {nomDuMoisAffichage(mois)}
        </h2>

        <p className="montant-secondaire" style={{ marginBottom: '0.15rem' }}>
          Total dépensé
        </p>
        <p className="montant-principal" style={{ marginBottom: '0.6rem' }}>
          {formaterMontant(resume.totalDepense, devise)}
        </p>

        <div className="grille-chiffres">
          <div className="chiffre-cle">
            <span className="etiquette">Budget du mois</span>
            <span className="valeur">
              {resume.totalPlafond > 0
                ? formaterMontant(resume.totalPlafond, devise)
                : 'non défini'}
            </span>
          </div>

          <div className="chiffre-cle">
            <span className="etiquette">
              {resteGlobal >= 0 ? 'Reste à dépenser' : 'Dépassement'}
            </span>
            <span
              className="valeur"
              style={{ color: resteGlobal >= 0 ? 'var(--ok)' : 'var(--depasse)' }}
            >
              {resume.totalPlafond > 0
                ? formaterMontant(Math.abs(resteGlobal), devise)
                : '—'}
            </span>
          </div>

          {/* Affiche seulement si le calcul a du sens : mois en cours, budget
              defini, et budget pas encore depasse. */}
          {rythme.pertinent && (
            <div className="chiffre-cle">
              <span className="etiquette">Disponible par jour</span>
              <span className="valeur">
                {formaterMontant(rythme.disponibleParJour, devise)}
              </span>
              <span className="detail">
                sur {rythme.joursRestants} jour{rythme.joursRestants > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Revenus et solde : affiches seulement si des rentrees d'argent
              ont ete saisies, pour ne pas encombrer l'ecran par defaut. */}
          {resume.nombreDeRevenus > 0 && (
            <>
              <div className="chiffre-cle">
                <span className="etiquette">Revenus du mois</span>
                <span className="valeur" style={{ color: 'var(--ok)' }}>
                  {formaterMontant(resume.totalRevenus, devise)}
                </span>
              </div>
              <div className="chiffre-cle">
                <span className="etiquette">Solde du mois</span>
                <span
                  className="valeur"
                  style={{ color: resume.solde >= 0 ? 'var(--ok)' : 'var(--depasse)' }}
                >
                  {resume.solde >= 0 ? '+' : '−'}
                  {formaterMontant(Math.abs(resume.solde), devise)}
                </span>
                <span className="detail">revenus moins dépenses</span>
              </div>
            </>
          )}

          <div className="chiffre-cle">
            <span className="etiquette">Lignes saisies</span>
            <span className="valeur">{depenses.length}</span>
          </div>
        </div>

        {/* Alerte globale, en texte : elle ne depend pas de la couleur. */}
        {resume.totalPlafond > 0 && resume.niveau === 'depasse' && (
          <p className="bandeau bandeau-erreur" style={{ marginTop: '0.9rem' }}>
            <span aria-hidden="true">⚠️</span>
            Vous avez dépassé votre budget global de{' '}
            {formaterMontant(-resteGlobal, devise)}.
          </p>
        )}
        {resume.totalPlafond > 0 &&
          (resume.niveau === 'attention' || resume.niveau === 'critique') && (
            <p className="bandeau bandeau-alerte" style={{ marginTop: '0.9rem' }}>
              <span aria-hidden="true">⚠️</span>
              {resume.pourcentage} % du budget du mois est déjà utilisé.
            </p>
          )}
      </section>

      {/* --- Graphique de repartition --- */}
      <section className="carte" aria-labelledby="titre-repartition">
        <div className="carte-titre">
          <h2 id="titre-repartition">Répartition</h2>
        </div>
        <Suspense fallback={<CarteChargement texte="Chargement du graphique…" />}>
          <CamembertDepenses
            donnees={donneesGraphique}
            devise={devise}
            total={resume.totalDepense}
          />
        </Suspense>
      </section>

      {/* --- Barres de progression par categorie --- */}
      <section className="carte" aria-labelledby="titre-categories">
        <div className="carte-titre">
          <h2 id="titre-categories">Par catégorie</h2>
        </div>
        {resume.lignes.length === 0 ? (
          <p className="centre-vide">Aucune catégorie pour l’instant.</p>
        ) : (
          resume.lignes.map((ligne) => (
            <LigneBudget key={ligne.categorie.id} ligne={ligne} devise={devise} />
          ))
        )}
      </section>

      {/* Bouton flottant "ajouter une depense" */}
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
