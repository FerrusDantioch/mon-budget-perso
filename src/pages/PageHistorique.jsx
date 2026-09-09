/*
 * ECRAN "HISTORIQUE"
 *
 * L'archive de tous les mois ou une depense a ete enregistree.
 * Chaque ligne montre le total du mois et une petite barre comparative.
 * Un appui ouvre le mois choisi dans le tableau de bord.
 */

import { useEffect, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { totauxParMois } from '../donnees/basededonnees.js';
import { formaterMontant } from '../utils/monnaie.js';
import { nomDuMoisAffichage, moisActuel } from '../utils/dates.js';

export function PageHistorique({ surOuvertureMois }) {
  const { definirMois, devise, depenses } = useBudget();
  const [lignes, definirLignes] = useState([]);
  const [chargement, definirChargement] = useState(true);

  // On recharge l'historique quand les depenses du mois courant changent :
  // ainsi le total affiche ici reste juste apres un ajout ou une suppression.
  useEffect(() => {
    let annule = false;
    definirChargement(true);
    totauxParMois()
      .then((resultat) => {
        if (!annule) {
          definirLignes(resultat);
          definirChargement(false);
        }
      })
      .catch((probleme) => {
        console.error('Historique indisponible', probleme);
        if (!annule) definirChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [depenses]);

  // Le mois le plus depensier sert d'echelle pour les barres comparatives.
  const maximum = lignes.reduce((max, ligne) => Math.max(max, ligne.total), 0);
  const totalGeneral = lignes.reduce((somme, ligne) => somme + ligne.total, 0);
  const moyenne = lignes.length > 0 ? Math.round(totalGeneral / lignes.length) : 0;

  function ouvrir(mois) {
    definirMois(mois);
    surOuvertureMois();
  }

  return (
    <div className="pile">
      <section className="carte" aria-labelledby="titre-historique">
        <div className="carte-titre">
          <h2 id="titre-historique">Historique</h2>
        </div>

        {chargement ? (
          <p className="centre-vide" role="status">Chargement…</p>
        ) : lignes.length === 0 ? (
          <p className="centre-vide">
            Aucun mois archivé pour l’instant. Enregistrez une première dépense.
          </p>
        ) : (
          <>
            <div className="grille-chiffres" style={{ marginBottom: '1rem' }}>
              <div className="chiffre-cle">
                <span className="etiquette">Mois enregistrés</span>
                <span className="valeur">{lignes.length}</span>
              </div>
              <div className="chiffre-cle">
                <span className="etiquette">Moyenne par mois</span>
                <span className="valeur">{formaterMontant(moyenne, devise)}</span>
              </div>
              <div className="chiffre-cle">
                <span className="etiquette">Total cumulé</span>
                <span className="valeur">{formaterMontant(totalGeneral, devise)}</span>
              </div>
            </div>

            <ul className="liste-reglages">
              {lignes.map((ligne) => {
                const proportion = maximum > 0 ? Math.round((ligne.total / maximum) * 100) : 0;
                const estLeMoisEnCours = ligne.mois === moisActuel();
                return (
                  <li key={ligne.mois}>
                    <button
                      type="button"
                      onClick={() => ouvrir(ligne.mois)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.7rem',
                        width: '100%',
                        minHeight: '56px',
                        background: 'none',
                        border: 'none',
                        font: 'inherit',
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        padding: '0.3rem 0',
                      }}
                      aria-label={`Ouvrir ${nomDuMoisAffichage(ligne.mois)} : ${formaterMontant(
                        ligne.total,
                        devise
                      )} sur ${ligne.nombre} dépenses`}
                    >
                      <span className="principal">
                        <span className="titre">
                          {/* La majuscule est ajoutee par le style uniquement
                              sur le nom du mois, pas sur l'etiquette qui suit. */}
                          <span style={{ textTransform: 'capitalize' }}>
                            {nomDuMoisAffichage(ligne.mois)}
                          </span>
                          {estLeMoisEnCours && (
                            <span className="etiquette-niveau" style={{ marginLeft: '0.4rem' }}>
                              en cours
                            </span>
                          )}
                        </span>
                        <span className="detail">
                          {ligne.nombre} dépense{ligne.nombre > 1 ? 's' : ''}
                        </span>
                        {/* Barre comparative : purement visuelle, l'information
                            chiffree est juste a cote. */}
                        <span
                          className="barre-progression"
                          style={{ marginTop: '0.35rem', height: '6px' }}
                          aria-hidden="true"
                        >
                          <span
                            className="barre-progression-remplissage"
                            style={{
                              display: 'block',
                              width: `${proportion}%`,
                              background: 'var(--accent)',
                            }}
                          />
                        </span>
                      </span>
                      <span className="depense-montant">
                        {formaterMontant(ligne.total, devise)}
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--texte-doux)' }}>›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <p className="champ-aide" style={{ textAlign: 'center' }}>
        Les mois passés gardent les plafonds qui étaient définis à l’époque.
      </p>
    </div>
  );
}
