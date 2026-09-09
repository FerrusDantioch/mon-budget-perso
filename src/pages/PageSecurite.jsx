/*
 * ECRAN « SECURITE »
 *
 * Changement de code, biometrie, phrase de recuperation, et rappel du
 * fonctionnement du verrouillage automatique.
 */

import { useMemo, useState } from 'react';

import { useCoffre, DELAI_VERROUILLAGE } from '../contexte/ContexteCoffre.jsx';
import { Modale } from '../composants/Modale.jsx';
import { Confirmation } from '../composants/Confirmation.jsx';
import { ClavierPin } from '../composants/ClavierPin.jsx';
import * as coffre from '../securite/coffre.js';
import { ErreurBiometrieNonSupportee } from '../securite/biometrie.js';

export function PageSecurite({ surMessage }) {
  const { configuration, biometriePossible, rafraichirConfiguration } = useCoffre();

  const [changementOuvert, definirChangementOuvert] = useState(false);
  const [etapeCode, definirEtapeCode] = useState('ancien');
  const [ancienCode, definirAncienCode] = useState('');
  const [nouveauCode, definirNouveauCode] = useState('');
  const [saisie, definirSaisie] = useState('');
  const [messageCode, definirMessageCode] = useState('');

  const [phraseOuverte, definirPhraseOuverte] = useState(false);
  const [phrase, definirPhrase] = useState('');
  const [etapePhrase, definirEtapePhrase] = useState('avertissement');
  const [verificationMots, definirVerificationMots] = useState({});
  const [messagePhrase, definirMessagePhrase] = useState('');

  const [messageBiometrie, definirMessageBiometrie] = useState('');
  const [confirmationRetraitPhrase, definirConfirmationRetraitPhrase] = useState(false);

  const minutes = Math.round(DELAI_VERROUILLAGE / 60000);

  // Trois positions tirees au hasard, pour verifier que la phrase a bien ete notee.
  const positionsAVerifier = useMemo(() => {
    if (!phrase) return [];
    const positions = new Set();
    while (positions.size < 3) positions.add(Math.floor(Math.random() * 12));
    return [...positions].sort((a, b) => a - b);
  }, [phrase]);

  // --- Changement de code -------------------------------------------------

  function reinitialiserChangement() {
    definirChangementOuvert(false);
    definirEtapeCode('ancien');
    definirAncienCode('');
    definirNouveauCode('');
    definirSaisie('');
    definirMessageCode('');
  }

  async function validerEtapeCode(valeur) {
    definirMessageCode('');

    if (etapeCode === 'ancien') {
      definirAncienCode(valeur);
      definirSaisie('');
      definirEtapeCode('nouveau');
      return;
    }

    if (etapeCode === 'nouveau') {
      definirNouveauCode(valeur);
      definirSaisie('');
      definirEtapeCode('confirmation');
      return;
    }

    if (valeur !== nouveauCode) {
      definirMessageCode('Les deux nouveaux codes ne correspondent pas.');
      definirSaisie('');
      definirEtapeCode('nouveau');
      definirNouveauCode('');
      return;
    }

    try {
      await coffre.changerCode(ancienCode, valeur);
      await rafraichirConfiguration();
      reinitialiserChangement();
      surMessage('Code modifié');
    } catch (probleme) {
      definirMessageCode(
        probleme instanceof coffre.ErreurCodeIncorrect
          ? 'Votre ancien code est incorrect.'
          : (probleme.message ?? 'Le changement a échoué.')
      );
      definirSaisie('');
      definirEtapeCode('ancien');
      definirAncienCode('');
      definirNouveauCode('');
    }
  }

  // --- Biometrie ----------------------------------------------------------

  async function activerLaBiometrie() {
    definirMessageBiometrie('');
    try {
      await coffre.activerBiometrie();
      await rafraichirConfiguration();
      surMessage('Biométrie activée');
    } catch (probleme) {
      definirMessageBiometrie(
        probleme instanceof ErreurBiometrieNonSupportee
          ? probleme.message
          : (probleme.message ?? 'L’activation a échoué.')
      );
    }
  }

  async function desactiverLaBiometrie() {
    await coffre.desactiverBiometrie();
    await rafraichirConfiguration();
    surMessage('Biométrie désactivée');
  }

  // --- Phrase de recuperation ---------------------------------------------

  async function creerLaPhrase() {
    definirMessagePhrase('');
    const nouvellePhrase = await coffre.creerPhraseRecuperation();
    definirPhrase(nouvellePhrase);
    definirEtapePhrase('affichage');
    await rafraichirConfiguration();
  }

  function verifierLaPhrase(evenement) {
    evenement.preventDefault();
    const mots = phrase.split(' ');
    const toutesCorrectes = positionsAVerifier.every(
      (position) =>
        (verificationMots[position] ?? '').trim().toLowerCase() === mots[position]
    );

    if (!toutesCorrectes) {
      definirMessagePhrase('Un des mots ne correspond pas. Vérifiez votre copie.');
      return;
    }

    definirEtapePhrase('termine');
    definirMessagePhrase('');
    surMessage('Phrase de récupération enregistrée');
  }

  function fermerLaPhrase() {
    definirPhraseOuverte(false);
    definirPhrase('');
    definirEtapePhrase('avertissement');
    definirVerificationMots({});
    definirMessagePhrase('');
  }

  return (
    <div className="pile">
      {/* ================= CODE ================= */}
      <section className="carte" aria-labelledby="titre-code">
        <div className="carte-titre">
          <h2 id="titre-code">Code d’accès</h2>
        </div>
        <ul className="liste-reglages">
          <li>
            <span className="principal">
              <span className="titre">Code actuel</span>
              <span className="detail">
                {configuration?.longueurCode ?? 4} chiffres
                {(configuration?.longueurCode ?? 4) < 6 &&
                  ' — un code à 6 chiffres serait plus sûr'}
              </span>
            </span>
            <button
              type="button"
              className="bouton bouton-discret"
              onClick={() => definirChangementOuvert(true)}
            >
              Modifier
            </button>
          </li>
        </ul>
      </section>

      {/* ================= BIOMETRIE ================= */}
      <section className="carte" aria-labelledby="titre-biometrie">
        <div className="carte-titre">
          <h2 id="titre-biometrie">Biométrie</h2>
        </div>

        <p>
          Déverrouillez avec votre empreinte, votre visage ou Windows Hello.
          <strong> Le code reste toujours utilisable</strong> : si le capteur
          ne répond pas, l’écran du code s’affiche immédiatement.
        </p>

        {!biometriePossible ? (
          <p className="bandeau bandeau-alerte">
            <span aria-hidden="true">ℹ️</span>
            Aucun capteur biométrique n’est disponible sur cet appareil.
          </p>
        ) : configuration?.biometrieActive ? (
          <>
            <p className="bandeau bandeau-info">
              <span aria-hidden="true">✅</span>
              Biométrie activée sur cet appareil.
            </p>
            <button type="button" className="bouton bouton-discret" onClick={desactiverLaBiometrie}>
              Désactiver la biométrie
            </button>
          </>
        ) : (
          <button type="button" className="bouton bouton-principal" onClick={activerLaBiometrie}>
            Activer la biométrie
          </button>
        )}

        {messageBiometrie && (
          <p className="bandeau bandeau-alerte" role="alert" style={{ marginTop: '0.6rem' }}>
            <span aria-hidden="true">⚠️</span>
            {messageBiometrie}
          </p>
        )}

        <p className="champ-aide" style={{ marginTop: '0.6rem' }}>
          L’application exige que votre appareil sache fabriquer une clé
          protégée par le capteur. Sans cette garantie, la biométrie ne serait
          qu’un portail décoratif : elle n’est alors pas proposée.
        </p>
      </section>

      {/* ================= PHRASE DE RECUPERATION ================= */}
      <section className="carte" aria-labelledby="titre-phrase">
        <div className="carte-titre">
          <h2 id="titre-phrase">Phrase de récupération</h2>
        </div>

        <p>
          12 mots qui permettent de rouvrir vos données si vous oubliez votre
          code. <strong>C’est la seule protection contre un oubli.</strong>
        </p>

        {configuration?.phraseActive ? (
          <>
            <p className="bandeau bandeau-info">
              <span aria-hidden="true">✅</span>
              Une phrase de récupération existe pour cet appareil.
            </p>
            <p className="champ-aide">
              Elle ne peut plus être réaffichée : seule sa version chiffrée est
              conservée. Si vous l’avez perdue, créez-en une nouvelle (l’ancienne
              cessera alors de fonctionner).
            </p>
            <div className="rangee-boutons">
              <button
                type="button"
                className="bouton bouton-discret"
                onClick={() => definirPhraseOuverte(true)}
              >
                Créer une nouvelle phrase
              </button>
              <button
                type="button"
                className="bouton bouton-danger"
                onClick={() => definirConfirmationRetraitPhrase(true)}
              >
                Supprimer
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="bandeau bandeau-alerte">
              <span aria-hidden="true">⚠️</span>
              Aucune phrase de récupération. Si vous oubliez votre code, vos
              données seront définitivement perdues.
            </p>
            <button
              type="button"
              className="bouton bouton-principal"
              onClick={() => definirPhraseOuverte(true)}
            >
              Créer ma phrase de récupération
            </button>
          </>
        )}
      </section>

      {/* ================= VERROUILLAGE AUTOMATIQUE ================= */}
      <section className="carte" aria-labelledby="titre-verrouillage">
        <div className="carte-titre">
          <h2 id="titre-verrouillage">Verrouillage automatique</h2>
        </div>
        <ul className="liste-reglages">
          <li>
            <span className="principal">
              <span className="titre">Après {minutes} minutes d’inactivité</span>
              <span className="detail">
                La clé de déchiffrement est effacée de la mémoire : vos données
                redeviennent illisibles.
              </span>
            </span>
          </li>
          <li>
            <span className="principal">
              <span className="titre">Après {coffre.ESSAIS_AVANT_BLOCAGE} codes erronés</span>
              <span className="detail">
                Blocage de {Math.round(coffre.DUREE_BLOCAGE / 60000)} minutes. Le
                compteur survit à un redémarrage de l’application.
              </span>
            </span>
          </li>
        </ul>
      </section>

      {/* ================= FENETRES ================= */}
      {changementOuvert && (
        <Modale titre="Changer de code" surFermeture={reinitialiserChangement}>
          <p>
            {etapeCode === 'ancien' && 'Saisissez votre code actuel.'}
            {etapeCode === 'nouveau' && 'Choisissez votre nouveau code.'}
            {etapeCode === 'confirmation' && 'Confirmez le nouveau code.'}
          </p>
          <ClavierPin
            valeur={saisie}
            surChangement={definirSaisie}
            surValidation={validerEtapeCode}
            longueurAttendue={
              etapeCode === 'ancien'
                ? (configuration?.longueurCode ?? null)
                : etapeCode === 'confirmation'
                  ? nouveauCode.length
                  : null
            }
            libelleValidation={etapeCode === 'confirmation' ? 'Confirmer' : 'Continuer'}
          />
          {messageCode && (
            <p className="bandeau bandeau-erreur" role="alert" style={{ marginTop: '0.75rem' }}>
              <span aria-hidden="true">⚠️</span>
              {messageCode}
            </p>
          )}
        </Modale>
      )}

      {phraseOuverte && (
        <Modale titre="Phrase de récupération" surFermeture={fermerLaPhrase}>
          {etapePhrase === 'avertissement' && (
            <>
              <div className="avertissement-majeur">
                <p className="avertissement-titre">
                  <span aria-hidden="true">⚠️</span> À noter sur papier, pas dans
                  votre téléphone
                </p>
                <p>
                  Ces 12 mots donnent accès à toutes vos données. Quiconque les
                  possède peut ouvrir votre budget. Ne les photographiez pas, ne
                  les envoyez par aucune messagerie.
                </p>
                <p>
                  Ils ne seront affichés <strong>qu’une seule fois</strong>.
                </p>
              </div>
              <div className="rangee-boutons">
                <button type="button" className="bouton bouton-discret" onClick={fermerLaPhrase}>
                  Annuler
                </button>
                <button type="button" className="bouton bouton-principal" onClick={creerLaPhrase}>
                  J’ai de quoi noter
                </button>
              </div>
            </>
          )}

          {etapePhrase === 'affichage' && (
            <>
              <p>Recopiez ces 12 mots dans l’ordre, puis appuyez sur « Continuer ».</p>
              <ol className="grille-mots">
                {phrase.split(' ').map((mot, index) => (
                  <li key={`${mot}-${index}`}>
                    <span className="numero-mot">{index + 1}</span>
                    <span className="mot">{mot}</span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="bouton bouton-principal"
                style={{ width: '100%', marginTop: '0.75rem' }}
                onClick={() => definirEtapePhrase('verification')}
              >
                Continuer
              </button>
            </>
          )}

          {etapePhrase === 'verification' && (
            <form onSubmit={verifierLaPhrase} noValidate>
              <p>
                Pour être sûr que la copie est bonne, saisissez les mots
                demandés.
              </p>
              {positionsAVerifier.map((position) => (
                <div className="champ" key={position}>
                  <label className="champ-etiquette" htmlFor={`mot-${position}`}>
                    Mot n° {position + 1}
                  </label>
                  <input
                    id={`mot-${position}`}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={verificationMots[position] ?? ''}
                    onChange={(e) =>
                      definirVerificationMots((precedent) => ({
                        ...precedent,
                        [position]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              {messagePhrase && (
                <p className="champ-erreur" role="alert">{messagePhrase}</p>
              )}
              <div className="rangee-boutons">
                <button
                  type="button"
                  className="bouton bouton-discret"
                  onClick={() => definirEtapePhrase('affichage')}
                >
                  Revoir les mots
                </button>
                <button type="submit" className="bouton bouton-principal">
                  Vérifier
                </button>
              </div>
            </form>
          )}

          {etapePhrase === 'termine' && (
            <>
              <p className="bandeau bandeau-info">
                <span aria-hidden="true">✅</span>
                Votre phrase de récupération est active. Rangez le papier en
                lieu sûr.
              </p>
              <button
                type="button"
                className="bouton bouton-principal"
                style={{ width: '100%' }}
                onClick={fermerLaPhrase}
              >
                Terminer
              </button>
            </>
          )}
        </Modale>
      )}

      {confirmationRetraitPhrase && (
        <Confirmation
          titre="Supprimer la phrase ?"
          message="Sans phrase de récupération, oublier votre code signifiera perdre définitivement toutes vos données."
          libelleConfirmation="Supprimer quand même"
          surAnnulation={() => definirConfirmationRetraitPhrase(false)}
          surConfirmation={async () => {
            await coffre.supprimerPhraseRecuperation();
            await rafraichirConfiguration();
            definirConfirmationRetraitPhrase(false);
            surMessage('Phrase de récupération supprimée');
          }}
        />
      )}
    </div>
  );
}
