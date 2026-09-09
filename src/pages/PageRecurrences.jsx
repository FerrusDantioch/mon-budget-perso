/*
 * ECRAN « DEPENSES RECURRENTES »
 *
 * Liste des prelevements et revenus automatiques : loyer, abonnements,
 * salaire... Chacun peut etre modifie, suspendu (sans etre perdu) ou supprime.
 *
 * Les echeances passees ont deja ete enregistrees au demarrage de
 * l'application (voir donnees/generationRecurrences.js) : cet ecran sert a les
 * configurer, pas a les declencher.
 */

import { useMemo, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { Modale } from '../composants/Modale.jsx';
import { FormulaireRecurrence } from '../composants/FormulaireRecurrence.jsx';
import { formaterMontant } from '../utils/monnaie.js';
import {
  aujourdhui,
  formaterDateCourte,
  moisActuel,
  nomDuMoisAffichage,
} from '../utils/dates.js';
import { decrireRecurrence, prochaineOccurrence, impactSurLeMois } from '../utils/recurrences.js';
import { useNotifications, JOURS_AVANT_RAPPEL } from '../hooks/useNotifications.js';

export function PageRecurrences({ surMessage }) {
  const {
    recurrences,
    categories,
    devise,
    resume,
    plafonds,
    ajouterRecurrence,
    modifierRecurrence,
    supprimerRecurrence,
  } = useBudget();

  const notifications = useNotifications();

  const [enEdition, definirEnEdition] = useState(null); // 'nouvelle' | objet
  const [aSupprimer, definirASupprimer] = useState(null);
  const [messageNotification, definirMessageNotification] = useState('');

  const dateDuJour = aujourdhui();
  const mois = moisActuel();

  /** Liste enrichie : prochaine echeance et poids sur le mois en cours. */
  const lignes = useMemo(
    () =>
      recurrences.map((recurrence) => ({
        recurrence,
        prochaine: prochaineOccurrence(recurrence, dateDuJour),
        impact: impactSurLeMois(recurrence, mois),
        categorie: categories.find((c) => c.id === recurrence.categorieId) ?? null,
      })),
    [recurrences, categories, dateDuJour, mois]
  );

  // Totaux mensuels, utiles pour se faire une idee du « socle » de depenses.
  const totaux = useMemo(() => {
    let depenses = 0;
    let revenus = 0;
    for (const ligne of lignes) {
      if (ligne.recurrence.suspendue) continue;
      if (ligne.recurrence.type === 'revenu') revenus += ligne.impact.total;
      else depenses += ligne.impact.total;
    }
    return { depenses, revenus };
  }, [lignes]);

  async function basculerLaSuspension(recurrence) {
    await modifierRecurrence(recurrence.id, { suspendue: !recurrence.suspendue });
    surMessage(recurrence.suspendue ? 'Récurrence réactivée' : 'Récurrence suspendue');
  }

  return (
    <div className="pile">
      {/* --- Resume --- */}
      <section className="carte">
        <div className="carte-titre">
          <h2>Vos récurrences</h2>
          <button
            type="button"
            className="bouton bouton-discret"
            onClick={() => definirEnEdition('nouvelle')}
          >
            + Ajouter
          </button>
        </div>

        {recurrences.length === 0 ? (
          <p className="centre-vide">
            Aucune récurrence. Ajoutez votre loyer ou vos abonnements : ils
            seront enregistrés automatiquement chaque mois.
          </p>
        ) : (
          <div className="grille-chiffres">
            <div className="chiffre-cle">
              <span className="etiquette">Dépenses sur {nomDuMoisAffichage(mois)}</span>
              <span className="valeur">{formaterMontant(totaux.depenses, devise)}</span>
            </div>
            {totaux.revenus > 0 && (
              <div className="chiffre-cle">
                <span className="etiquette">Revenus sur {nomDuMoisAffichage(mois)}</span>
                <span className="valeur" style={{ color: 'var(--ok)' }}>
                  {formaterMontant(totaux.revenus, devise)}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- Liste --- */}
      {lignes.length > 0 && (
        <section className="carte">
          <ul className="liste-reglages">
            {lignes.map(({ recurrence, prochaine, impact, categorie }) => (
              <li key={recurrence.id} className={recurrence.suspendue ? 'suspendue' : ''}>
                <span
                  className="depense-pastille"
                  style={{
                    background:
                      recurrence.type === 'revenu'
                        ? 'var(--ok)'
                        : (categorie?.couleur ?? '#94a3b8'),
                  }}
                  aria-hidden="true"
                >
                  {recurrence.type === 'revenu' ? '💰' : (categorie?.emoji ?? '🔁')}
                </span>

                <span className="principal">
                  <span className="titre">
                    {recurrence.libelle}
                    {recurrence.suspendue && (
                      <span className="etiquette-niveau" style={{ marginLeft: '0.4rem' }}>
                        suspendue
                      </span>
                    )}
                  </span>
                  <span className="detail">
                    {decrireRecurrence(recurrence)}
                    {' · '}
                    {formaterMontant(recurrence.montantCentimes, devise)}
                  </span>
                  <span className="detail">
                    {recurrence.suspendue
                      ? 'Aucune échéance tant qu’elle est suspendue'
                      : prochaine
                        ? `Prochaine : ${formaterDateCourte(prochaine)}`
                        : 'Terminée'}
                    {impact.nombre > 1 && !recurrence.suspendue
                      ? ` · ${impact.nombre}× ce mois-ci`
                      : ''}
                  </span>
                </span>

                <span style={{ display: 'flex', gap: '0.25rem', flex: 'none' }}>
                  <button
                    type="button"
                    className="bouton-icone"
                    onClick={() => basculerLaSuspension(recurrence)}
                    aria-label={
                      recurrence.suspendue
                        ? `Réactiver ${recurrence.libelle}`
                        : `Suspendre ${recurrence.libelle}`
                    }
                    title={recurrence.suspendue ? 'Réactiver' : 'Suspendre'}
                  >
                    <span aria-hidden="true">{recurrence.suspendue ? '▶️' : '⏸️'}</span>
                  </button>
                  <button
                    type="button"
                    className="bouton bouton-discret"
                    onClick={() => definirEnEdition(recurrence)}
                    aria-label={`Modifier ${recurrence.libelle}`}
                  >
                    Modifier
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Rappels --- */}
      <section className="carte" aria-labelledby="titre-rappels">
        <div className="carte-titre">
          <h2 id="titre-rappels">Rappels</h2>
        </div>

        <p>
          L’application peut vous prévenir <strong>{JOURS_AVANT_RAPPEL} jours avant</strong>{' '}
          chaque prélèvement automatique.
        </p>

        <p className="bandeau bandeau-info">
          <span aria-hidden="true">ℹ️</span>
          <span>
            À savoir : les rappels sont vérifiés <strong>à l’ouverture de
            l’application</strong>. Une vraie notification programmée exigerait
            un serveur qui envoie le message — donc vos données sortiraient de
            l’appareil. Ce projet fait le choix inverse.
          </span>
        </p>

        {!notifications.supportees ? (
          <p className="champ-aide">
            Ce navigateur ne gère pas les notifications.
          </p>
        ) : notifications.permission === 'denied' ? (
          <p className="bandeau bandeau-alerte">
            <span aria-hidden="true">🔕</span>
            Les notifications sont bloquées pour ce site. Vous pouvez les
            réautoriser dans les réglages de votre navigateur.
          </p>
        ) : notifications.activees ? (
          <>
            <p className="bandeau bandeau-info">
              <span aria-hidden="true">🔔</span>
              Rappels activés.
            </p>
            <button
              type="button"
              className="bouton bouton-discret"
              onClick={async () => {
                await notifications.desactiver();
                surMessage('Rappels désactivés');
              }}
            >
              Désactiver les rappels
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="bouton bouton-principal"
              onClick={async () => {
                const resultat = await notifications.activer();
                if (resultat.active) surMessage('Rappels activés');
                else definirMessageNotification(resultat.raison);
              }}
            >
              Activer les rappels
            </button>
            {messageNotification && (
              <p className="champ-erreur" role="alert">{messageNotification}</p>
            )}
          </>
        )}
      </section>

      {/* --- Fenetres --- */}
      {enEdition && (
        <Modale
          titre={enEdition === 'nouvelle' ? 'Nouvelle récurrence' : 'Modifier la récurrence'}
          surFermeture={() => definirEnEdition(null)}
        >
          <FormulaireRecurrence
            recurrence={enEdition === 'nouvelle' ? null : enEdition}
            categories={categories}
            devise={devise}
            resume={resume}
            plafonds={plafonds}
            surAnnulation={() => definirEnEdition(null)}
            surEnregistrement={async (donnees) => {
              if (enEdition === 'nouvelle') {
                await ajouterRecurrence(donnees);
                surMessage('Récurrence créée');
              } else {
                await modifierRecurrence(enEdition.id, donnees);
                surMessage('Récurrence modifiée');
              }
              definirEnEdition(null);
            }}
            surSuppression={
              enEdition === 'nouvelle'
                ? null
                : () => {
                    definirASupprimer(enEdition);
                    definirEnEdition(null);
                  }
            }
          />
        </Modale>
      )}

      {aSupprimer && (
        <Modale titre="Supprimer la récurrence ?" surFermeture={() => definirASupprimer(null)}>
          <p>
            « {aSupprimer.libelle} » ne générera plus d’échéance. Que faire des
            dépenses déjà enregistrées par cette récurrence ?
          </p>
          <div className="pile-serree">
            <button
              type="button"
              className="bouton bouton-principal"
              style={{ width: '100%' }}
              onClick={async () => {
                await supprimerRecurrence(aSupprimer.id, false);
                definirASupprimer(null);
                surMessage('Récurrence supprimée, dépenses conservées');
              }}
            >
              Les conserver dans l’historique
            </button>
            <button
              type="button"
              className="bouton bouton-danger"
              style={{ width: '100%' }}
              onClick={async () => {
                await supprimerRecurrence(aSupprimer.id, true);
                definirASupprimer(null);
                surMessage('Récurrence et dépenses supprimées');
              }}
            >
              Les supprimer aussi
            </button>
            <button
              type="button"
              className="bouton bouton-discret"
              style={{ width: '100%' }}
              onClick={() => definirASupprimer(null)}
            >
              Annuler
            </button>
          </div>
        </Modale>
      )}
    </div>
  );
}
