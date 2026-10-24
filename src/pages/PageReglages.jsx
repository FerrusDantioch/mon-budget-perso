/*
 * ECRAN « REGLAGES »
 *
 * Sert aussi de sommaire : c'est d'ici qu'on atteint la sauvegarde et les
 * options de securite.
 */

import { useEffect, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { useCoffre } from '../contexte/ContexteCoffre.jsx';
import { useTheme } from '../contexte/ContexteTheme.jsx';
import { useInstallation } from '../hooks/useInstallation.js';
import { badgeSupporte, definirBadge } from '../hooks/useBadge.js';
import { Confirmation } from '../composants/Confirmation.jsx';
import { compterDepenses, lireReglage, ecrireReglage } from '../donnees/basededonnees.js';

const DEVISES = [
  { code: 'EUR', libelle: 'Euro (€)' },
  { code: 'CHF', libelle: 'Franc suisse (CHF)' },
  { code: 'CAD', libelle: 'Dollar canadien ($ CA)' },
  { code: 'USD', libelle: 'Dollar américain ($ US)' },
  { code: 'GBP', libelle: 'Livre sterling (£)' },
];

const THEMES = [
  { valeur: 'auto', libelle: 'Automatique' },
  { valeur: 'clair', libelle: 'Clair' },
  { valeur: 'sombre', libelle: 'Sombre' },
];

export function PageReglages({ surMessage, modeHorsLignePret, allerVers }) {
  const { devise, definirDevise, categories, recurrences, recus, toutEffacer } = useBudget();
  const { configuration, verrouiller } = useCoffre();
  const { theme, definirTheme } = useTheme();
  const { peutInstaller, dejaInstallee, installer } = useInstallation();

  const [nombreDepenses, definirNombreDepenses] = useState(null);
  const [badgeActif, definirBadgeActif] = useState(false);
  const [confirmationEffacement, definirConfirmationEffacement] = useState(false);

  useEffect(() => {
    compterDepenses()
      .then(definirNombreDepenses)
      .catch(() => definirNombreDepenses(null));
    lireReglage('badgeActif', false)
      .then(definirBadgeActif)
      .catch(() => definirBadgeActif(false));
  }, []);

  async function basculerLeBadge(actif) {
    definirBadgeActif(actif);
    await ecrireReglage('badgeActif', actif);
    if (!actif) await definirBadge(null);
    surMessage(actif ? 'Pastille activée' : 'Pastille désactivée');
  }

  return (
    <div className="pile">
      {/* ================= SECURITE ET SAUVEGARDE ================= */}
      <section className="carte" aria-labelledby="titre-acces">
        <div className="carte-titre">
          <h2 id="titre-acces">Sécurité et sauvegarde</h2>
        </div>
        <ul className="liste-reglages">
          <li>
            <button
              type="button"
              className="ligne-cliquable"
              onClick={() => allerVers('securite')}
            >
              <span className="depense-pastille" style={{ background: 'var(--accent)' }} aria-hidden="true">
                🔒
              </span>
              <span className="principal">
                <span className="titre">Sécurité</span>
                <span className="detail">
                  Code {configuration?.longueurCode ?? 4} chiffres ·{' '}
                  {configuration?.biometrieActive ? 'biométrie activée' : 'sans biométrie'} ·{' '}
                  {configuration?.phraseActive
                    ? 'phrase de récupération créée'
                    : 'aucune phrase de récupération'}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--texte-doux)' }}>›</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="ligne-cliquable"
              onClick={() => allerVers('sauvegarde')}
            >
              <span className="depense-pastille" style={{ background: 'var(--accent)' }} aria-hidden="true">
                💾
              </span>
              <span className="principal">
                <span className="titre">Sauvegarde</span>
                <span className="detail">
                  Exporter, restaurer, ou sortir vos dépenses vers un tableur
                </span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--texte-doux)' }}>›</span>
            </button>
          </li>
        </ul>

        <button
          type="button"
          className="bouton"
          style={{ width: '100%', marginTop: '0.6rem' }}
          onClick={verrouiller}
        >
          <span aria-hidden="true">🔒</span> Verrouiller maintenant
        </button>
      </section>

      {/* ================= APPARENCE ================= */}
      <section className="carte" aria-labelledby="titre-apparence">
        <div className="carte-titre">
          <h2 id="titre-apparence">Apparence</h2>
        </div>
        <fieldset className="groupe-choix">
          <legend className="sr-seulement">Thème de l’application</legend>
          {THEMES.map((choix) => (
            <label key={choix.valeur} className={theme === choix.valeur ? 'selectionne' : ''}>
              <input
                type="radio"
                name="theme"
                value={choix.valeur}
                checked={theme === choix.valeur}
                onChange={() => definirTheme(choix.valeur)}
              />
              {choix.libelle}
            </label>
          ))}
        </fieldset>
        <p className="champ-aide" style={{ marginTop: '0.5rem' }}>
          « Automatique » suit le réglage clair/sombre de votre téléphone.
        </p>
      </section>

      {/* ================= MONNAIE ================= */}
      <section className="carte" aria-labelledby="titre-monnaie">
        <div className="carte-titre">
          <h2 id="titre-monnaie">Monnaie</h2>
        </div>
        <div className="champ" style={{ marginBottom: 0 }}>
          <label className="champ-etiquette" htmlFor="champ-devise">Devise affichée</label>
          <select
            id="champ-devise"
            value={devise}
            onChange={async (e) => {
              await definirDevise(e.target.value);
              surMessage('Devise modifiée');
            }}
          >
            {DEVISES.map((option) => (
              <option key={option.code} value={option.code}>{option.libelle}</option>
            ))}
          </select>
          <span className="champ-aide">
            Change uniquement l’affichage : aucun taux de change n’est appliqué.
          </span>
        </div>
      </section>

      {/* ================= ECRAN D'ACCUEIL ================= */}
      <section className="carte" aria-labelledby="titre-accueil">
        <div className="carte-titre">
          <h2 id="titre-accueil">Écran d’accueil</h2>
        </div>

        {dejaInstallee ? (
          <p className="bandeau bandeau-info">
            <span aria-hidden="true">✅</span>
            L’application est installée sur cet appareil.
          </p>
        ) : peutInstaller ? (
          <>
            <p>
              Installez l’application pour la lancer depuis votre écran
              d’accueil, en plein écran et sans connexion.
            </p>
            <button
              type="button"
              className="bouton bouton-principal"
              onClick={async () => {
                const acceptee = await installer();
                if (acceptee) surMessage('Application installée');
              }}
            >
              Ajouter à l’écran d’accueil
            </button>
          </>
        ) : (
          <p className="champ-aide">
            Pour installer : sur Android, menu ⋮ du navigateur puis « Installer
            l’application ». Sur iPhone, bouton « Partager » puis « Sur l’écran
            d’accueil ».
          </p>
        )}

        {/* --- Pastille sur l'icone --- */}
        <label className="champ-case" style={{ marginTop: '0.9rem' }}>
          <input
            type="checkbox"
            checked={badgeActif}
            disabled={!badgeSupporte()}
            onChange={(e) => basculerLeBadge(e.target.checked)}
          />
          <span>
            Afficher le pourcentage de budget consommé sur l’icône
            <span className="champ-aide">
              {badgeSupporte()
                ? 'Une pastille chiffrée apparaît sur l’icône, une fois l’application installée.'
                : 'Non disponible sur ce navigateur (notamment Safari sur iPhone).'}
            </span>
          </span>
        </label>

        <details style={{ marginTop: '0.6rem' }}>
          <summary className="champ-aide" style={{ cursor: 'pointer' }}>
            Pourquoi pas un vrai widget sur l’écran d’accueil ?
          </summary>
          <p className="champ-aide" style={{ marginTop: '0.4rem' }}>
            Un widget qui affiche des chiffres et se met à jour tout seul est une
            fonction du système Android ou iOS. Aucune application web n’y a
            accès, quelle que soit la technique employée. Il faudrait
            transformer ce projet en application native installée depuis un
            magasin d’applications. La pastille sur l’icône et le raccourci
            « Ajouter une dépense » (appui long sur l’icône) sont ce qu’une
            application web peut faire de plus proche.
          </p>
        </details>

        <p
          className={`bandeau ${modeHorsLignePret ? 'bandeau-info' : 'bandeau-alerte'}`}
          style={{ marginTop: '0.75rem' }}
        >
          <span aria-hidden="true">{modeHorsLignePret ? '📴' : '⏳'}</span>
          {modeHorsLignePret
            ? 'Mode hors-ligne actif : l’application fonctionne sans connexion.'
            : 'Mode hors-ligne en cours de préparation (ou indisponible en navigation privée).'}
        </p>
      </section>

      {/* ================= DONNEES ================= */}
      <section className="carte" aria-labelledby="titre-confidentialite">
        <div className="carte-titre">
          <h2 id="titre-confidentialite">Vos données</h2>
        </div>
        <ul className="liste-reglages">
          <li>
            <span className="principal">
              <span className="titre">Catégories</span>
              <span className="detail">{categories.length} enregistrées</span>
            </span>
          </li>
          <li>
            <span className="principal">
              <span className="titre">Dépenses et revenus</span>
              <span className="detail">
                {nombreDepenses === null ? '…' : `${nombreDepenses} enregistrés`}
              </span>
            </span>
          </li>
          <li>
            <span className="principal">
              <span className="titre">Récurrences · reçus</span>
              <span className="detail">
                {recurrences.length} · {recus.length}
              </span>
            </span>
          </li>
        </ul>

        <p className="bandeau bandeau-info" style={{ marginTop: '0.75rem' }}>
          <span aria-hidden="true">🔒</span>
          Tout est chiffré et stocké uniquement sur cet appareil. Aucune donnée
          n’est envoyée sur Internet, et l’application ne contient ni publicité
          ni mouchard.
        </p>

        <div className="rangee-boutons" style={{ marginTop: '0.9rem' }}>
          <button
            type="button"
            className="bouton bouton-danger"
            onClick={() => definirConfirmationEffacement(true)}
          >
            Effacer toutes mes données
          </button>
        </div>
        <p className="champ-aide">
          Pensez à créer une sauvegarde chiffrée avant d’effacer quoi que ce soit.
        </p>
      </section>

      {/* ================= A PROPOS ================= */}
      {/* Le lien s'ouvre dans un nouvel onglet, pour ne pas quitter l'application. */}
      <section className="carte" aria-labelledby="titre-a-propos">
        <div className="carte-titre">
          <h2 id="titre-a-propos">À propos</h2>
        </div>
        <p>
          Cette application a été conçue et développée par Ferrus Dantioch, avec
          l'aide de Claude (une intelligence artificielle d'Anthropic).
        </p>
        <p className="champ-aide">
          Voir d'autres projets :{' '}
          <a
            className="lien-discret"
            href="https://ferrusdantioch.github.io/omni-systeme/"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://ferrusdantioch.github.io/omni-systeme/
          </a>
        </p>
        {/* Retours : une adresse-alias (Proton) créée pour ça. Le lien ouvre seulement
            l'application de messagerie, adresse et sujet déjà remplis : rien ne part tout seul. */}
        <p className="champ-aide">
          Une idée, une remarque, un souci ? Vos retours sont les bienvenus :{' '}
          <a
            className="lien-discret"
            href="mailto:omni-systeme.choking513@passmail.net?subject=Retour%20sur%20Omni-Budget"
          >
            omni-systeme.choking513@passmail.net
          </a>
        </p>
        {/* Note d'installation : Chrome Android n'installe qu'une seule
            application par adresse de site, et toutes les applications de
            ferrusdantioch.github.io partagent la même. Masquée une fois
            l'application installée (règle .note-installation de la feuille de style). */}
        <p className="champ-aide note-installation">
          <strong>Installation sur Android&nbsp;:</strong> si Chrome indique «&nbsp;Cette appli est déjà installée&nbsp;» alors qu'elle ne l'est pas, c'est une limite de Chrome quand une autre application de ce site est déjà installée. Utilisez un autre navigateur (Brave, par exemple), ou choisissez «&nbsp;Créer un raccourci&nbsp;».
        </p>
      </section>

      <p className="champ-aide" style={{ textAlign: 'center' }}>
        Omni-Budget — version 2.0
      </p>

      {confirmationEffacement && (
        <Confirmation
          titre="Tout effacer ?"
          message="Toutes vos dépenses, catégories, budgets, récurrences et reçus seront définitivement supprimés de cet appareil. Votre code d’accès, lui, est conservé. Cette action est irréversible."
          libelleConfirmation="Tout effacer"
          surAnnulation={() => definirConfirmationEffacement(false)}
          surConfirmation={async () => {
            await toutEffacer();
            definirConfirmationEffacement(false);
            definirNombreDepenses(0);
            surMessage('Toutes les données ont été effacées');
          }}
        />
      )}
    </div>
  );
}
