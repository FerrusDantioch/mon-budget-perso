/*
 * COMPOSANT PRINCIPAL
 *
 * Il assemble l'application et decide de ce qui s'affiche selon l'etat du
 * coffre :
 *
 *   chargement -> ecran d'attente
 *   creation   -> choix du premier code
 *   verrouille -> demande du code
 *   ouvert     -> l'application proprement dite
 *
 * Quand le coffre n'est pas ouvert, le fournisseur de donnees n'est meme pas
 * monte : rien ne peut etre lu, puisque la cle de dechiffrement n'existe pas.
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { useCoffre } from './contexte/ContexteCoffre.jsx';
import { FournisseurBudget, useBudget } from './contexte/ContexteBudget.jsx';
import { useRouteur } from './hooks/useRouteur.js';
import { useServiceWorker } from './hooks/useServiceWorker.js';
import { useBadge } from './hooks/useBadge.js';
import { verifierLesEcheancesProches } from './hooks/useNotifications.js';
import { lireReglage } from './donnees/basededonnees.js';

import { Entete } from './composants/Entete.jsx';
import { Navigation } from './composants/Navigation.jsx';
import { Modale } from './composants/Modale.jsx';
import { Confirmation } from './composants/Confirmation.jsx';
import { FormulaireDepense } from './composants/FormulaireDepense.jsx';
import { EcranVerrouillage } from './composants/EcranVerrouillage.jsx';
import { EcranCreationCode } from './composants/EcranCreationCode.jsx';

import { TableauDeBord } from './pages/TableauDeBord.jsx';
import { PageDepenses } from './pages/PageDepenses.jsx';
import { PageBudgets } from './pages/PageBudgets.jsx';
import { PageHistorique } from './pages/PageHistorique.jsx';
import { PageReglages } from './pages/PageReglages.jsx';
// Les quatre sous-ecrans sont charges a la demande : ils ne servent pas au
// quotidien, et les sortir du fichier principal accelere le demarrage.
const PageRecurrences = lazy(() =>
  import('./pages/PageRecurrences.jsx').then((m) => ({ default: m.PageRecurrences }))
);
const PageRecus = lazy(() =>
  import('./pages/PageRecus.jsx').then((m) => ({ default: m.PageRecus }))
);
const PageSauvegarde = lazy(() =>
  import('./pages/PageSauvegarde.jsx').then((m) => ({ default: m.PageSauvegarde }))
);
const PageSecurite = lazy(() =>
  import('./pages/PageSecurite.jsx').then((m) => ({ default: m.PageSecurite }))
);

import { formaterMontant } from './utils/monnaie.js';
import { formaterDateCourte } from './utils/dates.js';

/**
 * Aiguillage principal. Il ne monte <FournisseurBudget> que lorsque le coffre
 * est ouvert : c'est ce qui garantit qu'aucune donnee n'est lue avant.
 */
export function App() {
  const { etat, erreurDemarrage } = useCoffre();

  if (erreurDemarrage) {
    return (
      <main className="contenu">
        <div className="carte">
          <h1>Problème de démarrage</h1>
          <p className="bandeau bandeau-erreur">{erreurDemarrage}</p>
        </div>
      </main>
    );
  }

  if (etat === 'chargement') {
    return (
      <div className="chargement-initial" role="status">
        <p>Chargement…</p>
      </div>
    );
  }

  if (etat === 'creation') return <EcranCreationCode />;
  if (etat === 'verrouille') return <EcranVerrouillage />;

  return (
    <FournisseurBudget>
      <ApplicationDeverrouillee />
    </FournisseurBudget>
  );
}

/** L'application une fois le coffre ouvert. */
function ApplicationDeverrouillee() {
  const {
    pret,
    erreur,
    categories,
    resume,
    devise,
    recurrences,
    echeancesCreees,
    oublierEcheancesCreees,
    ajouterDepense,
    modifierDepense,
    supprimerDepense,
  } = useBudget();

  const { verrouiller } = useCoffre();
  const { ecran, titre, estUnSousEcran, action, allerVers, retour, effacerAction } = useRouteur();
  const { miseAJourDisponible, appliquerLaMiseAJour, installe } = useServiceWorker();

  const [depenseEnEdition, definirDepenseEnEdition] = useState(null);
  const [depenseASupprimer, definirDepenseASupprimer] = useState(null);
  const [message, definirMessage] = useState('');
  const [badgeActif, definirBadgeActif] = useState(false);
  const [rappels, definirRappels] = useState([]);

  const afficherMessage = useCallback((texte) => definirMessage(texte), []);

  useEffect(() => {
    if (!message) return undefined;
    const minuterie = setTimeout(() => definirMessage(''), 2600);
    return () => clearTimeout(minuterie);
  }, [message]);

  // Le titre de l'onglet suit l'ecran affiche.
  useEffect(() => {
    document.title = `${titre} — Budget`;
  }, [titre]);

  // Raccourci « Ajouter une dépense » (appui long sur l'icone).
  useEffect(() => {
    if (action === 'ajouter') {
      definirDepenseEnEdition('nouvelle');
      effacerAction();
    }
  }, [action, effacerAction]);

  // Pastille sur l'icone de l'application.
  useEffect(() => {
    lireReglage('badgeActif', false)
      .then(definirBadgeActif)
      .catch(() => definirBadgeActif(false));
  }, []);
  useBadge(resume.totalPlafond > 0 ? resume.pourcentage : 0, badgeActif);

  // Rappels des prelevements a venir, une seule fois par ouverture.
  useEffect(() => {
    if (!pret || recurrences.length === 0) return;
    verifierLesEcheancesProches(recurrences)
      .then((resultat) => definirRappels(resultat.aVenir))
      .catch((probleme) => console.warn('Rappels indisponibles', probleme));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  if (!pret) {
    return (
      <div className="chargement-initial" role="status">
        <p>Déchiffrement de vos données…</p>
      </div>
    );
  }

  if (erreur) {
    return (
      <main className="contenu">
        <div className="carte">
          <h1>Problème de lecture</h1>
          <p className="bandeau bandeau-erreur">{erreur}</p>
        </div>
      </main>
    );
  }

  function afficherEcran() {
    switch (ecran) {
      case 'depenses':
        return (
          <PageDepenses
            allerVers={allerVers}
            surAjoutDepense={() => definirDepenseEnEdition('nouvelle')}
            surModificationDepense={(depense) => definirDepenseEnEdition(depense)}
          />
        );
      case 'budgets':
        return <PageBudgets surMessage={afficherMessage} />;
      case 'historique':
        return <PageHistorique surOuvertureMois={() => allerVers('tableau')} />;
      case 'recurrences':
        return <PageRecurrences surMessage={afficherMessage} />;
      case 'recus':
        return <PageRecus surMessage={afficherMessage} />;
      case 'sauvegarde':
        return <PageSauvegarde surMessage={afficherMessage} />;
      case 'securite':
        return <PageSecurite surMessage={afficherMessage} />;
      case 'reglages':
        return (
          <PageReglages
            surMessage={afficherMessage}
            modeHorsLignePret={installe}
            allerVers={allerVers}
          />
        );
      case 'tableau':
      default:
        return <TableauDeBord surAjoutDepense={() => definirDepenseEnEdition('nouvelle')} />;
    }
  }

  const enModification = depenseEnEdition && depenseEnEdition !== 'nouvelle';

  return (
    <div className="appli">
      <Entete
        titre={titre}
        estUnSousEcran={estUnSousEcran}
        surRetour={retour}
        surVerrouillage={verrouiller}
      />
      <Navigation ecranCourant={ecran} allerVers={allerVers} />

      {/* --- Bandeaux d'information, en haut du contenu --- */}
      {(miseAJourDisponible || echeancesCreees.length > 0 || rappels.length > 0) && (
        <div className="contenu" style={{ paddingBottom: 0 }}>
          {miseAJourDisponible && (
            <div className="bandeau bandeau-info" style={{ marginBottom: '0.6rem' }}>
              <span aria-hidden="true">🔄</span>
              <span style={{ flex: 1 }}>Une nouvelle version est disponible.</span>
              <button type="button" className="bouton bouton-principal" onClick={appliquerLaMiseAJour}>
                Mettre à jour
              </button>
            </div>
          )}

          {/* Depenses recurrentes enregistrees automatiquement au demarrage :
              l'utilisateur doit savoir d'ou viennent ces nouvelles lignes. */}
          {echeancesCreees.length > 0 && (
            <div className="bandeau bandeau-info" style={{ marginBottom: '0.6rem' }}>
              <span aria-hidden="true">🔁</span>
              <span style={{ flex: 1 }}>
                {echeancesCreees.length} dépense{echeancesCreees.length > 1 ? 's' : ''} récurrente
                {echeancesCreees.length > 1 ? 's' : ''} enregistrée
                {echeancesCreees.length > 1 ? 's' : ''} automatiquement :{' '}
                {echeancesCreees
                  .slice(0, 3)
                  .map((e) => `${e.libelle} (${formaterMontant(e.montantCentimes, devise)})`)
                  .join(', ')}
                {echeancesCreees.length > 3 ? '…' : ''}
              </span>
              <button type="button" className="bouton" onClick={oublierEcheancesCreees}>
                J’ai vu
              </button>
            </div>
          )}

          {/* Prelevements a venir dans les deux prochains jours. */}
          {rappels.length > 0 && (
            <div className="bandeau bandeau-alerte" style={{ marginBottom: '0.6rem' }}>
              <span aria-hidden="true">📅</span>
              <span style={{ flex: 1 }}>
                À venir :{' '}
                {rappels
                  .slice(0, 2)
                  .map(
                    (r) =>
                      `${r.recurrence.libelle} le ${formaterDateCourte(r.date)} (${formaterMontant(r.recurrence.montantCentimes, devise)})`
                  )
                  .join(', ')}
              </span>
              <button type="button" className="bouton" onClick={() => definirRappels([])}>
                J’ai vu
              </button>
            </div>
          )}
        </div>
      )}

      {/* tabIndex={-1} permet au lien « Aller au contenu principal » d'y poser le focus. */}
      <main className="contenu" id="contenu-principal" tabIndex={-1}>
        {/* Suspense affiche un message pendant le telechargement d'un
            sous-ecran charge a la demande (quelques dizaines de kilo-octets,
            instantane une fois en cache). */}
        <Suspense
          fallback={
            <p className="centre-vide" role="status">
              Chargement de l’écran…
            </p>
          }
        >
          {afficherEcran()}
        </Suspense>
      </main>

      {/* --- Ajout / modification d'une depense --- */}
      {depenseEnEdition && (
        <Modale
          titre={enModification ? 'Modifier la ligne' : 'Nouvelle ligne'}
          surFermeture={() => definirDepenseEnEdition(null)}
        >
          <FormulaireDepense
            depense={enModification ? depenseEnEdition : null}
            categories={categories}
            surAnnulation={() => definirDepenseEnEdition(null)}
            surEnregistrement={async (donnees) => {
              if (enModification) {
                await modifierDepense(depenseEnEdition.id, donnees);
                afficherMessage('Modification enregistrée');
              } else {
                await ajouterDepense(donnees);
                afficherMessage(donnees.type === 'revenu' ? 'Revenu ajouté' : 'Dépense ajoutée');
              }
              definirDepenseEnEdition(null);
            }}
            surSuppression={
              enModification
                ? () => {
                    definirDepenseASupprimer(depenseEnEdition);
                    definirDepenseEnEdition(null);
                  }
                : null
            }
          />
        </Modale>
      )}

      {depenseASupprimer && (
        <Confirmation
          titre="Supprimer cette ligne ?"
          message={
            depenseASupprimer.recurrenceId
              ? 'Cette ligne a été créée par une dépense récurrente. La supprimer ne désactive pas la récurrence : elle sera de nouveau enregistrée à la prochaine échéance.'
              : 'Cette ligne sera définitivement supprimée de cet appareil.'
          }
          surAnnulation={() => definirDepenseASupprimer(null)}
          surConfirmation={async () => {
            await supprimerDepense(depenseASupprimer.id);
            definirDepenseASupprimer(null);
            afficherMessage('Ligne supprimée');
          }}
        />
      )}

      {message && (
        <div className="message-confirmation" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
