/*
 * ECRAN DE VERROUILLAGE
 *
 * Premier ecran a chaque ouverture de l'application. Tant que le bon code
 * (ou la biometrie, ou la phrase de recuperation) n'a pas ete fourni, les
 * donnees restent chiffrees : il n'y a litteralement rien a afficher.
 */

import { useEffect, useRef, useState } from 'react';
import { useCoffre } from '../contexte/ContexteCoffre.jsx';
import { ClavierPin } from './ClavierPin.jsx';
import { Modale } from './Modale.jsx';
import { Confirmation } from './Confirmation.jsx';

export function EcranVerrouillage() {
  const {
    blocage,
    configuration,
    deverrouillerAvecCode,
    deverrouillerAvecBiometrie,
    deverrouillerAvecPhrase,
    toutEffacerEtRecommencer,
  } = useCoffre();

  const [code, definirCode] = useState('');
  const [message, definirMessage] = useState('');
  const [verificationEnCours, definirVerificationEnCours] = useState(false);
  const [ecranPhrase, definirEcranPhrase] = useState(false);
  const [phrase, definirPhrase] = useState('');
  const [messagePhrase, definirMessagePhrase] = useState('');
  const [confirmationEffacement, definirConfirmationEffacement] = useState(false);

  // Evite de relancer la biometrie en boucle si l'utilisateur l'annule.
  const biometrieDejaProposee = useRef(false);

  const biometrieDisponible = configuration?.biometrieActive;

  async function essayerLaBiometrie() {
    if (verificationEnCours) return;
    definirVerificationEnCours(true);
    definirMessage('');
    const resultat = await deverrouillerAvecBiometrie();
    if (!resultat.ouvert) {
      definirMessage(`${resultat.message} Utilisez votre code.`);
    }
    definirVerificationEnCours(false);
  }

  // Proposition automatique de la biometrie a l'ouverture : c'est le geste
  // attendu sur telephone. En cas d'echec, le code prend le relais.
  useEffect(() => {
    if (!biometrieDisponible || blocage.bloque || biometrieDejaProposee.current) return;
    biometrieDejaProposee.current = true;
    essayerLaBiometrie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometrieDisponible, blocage.bloque]);

  async function validerLeCode(codeSaisi) {
    if (verificationEnCours || blocage.bloque) return;
    definirVerificationEnCours(true);
    definirMessage('');

    const resultat = await deverrouillerAvecCode(codeSaisi);
    if (!resultat.ouvert) {
      definirCode('');
      definirMessage(resultat.message);
    }
    definirVerificationEnCours(false);
  }

  async function validerLaPhrase(evenement) {
    evenement.preventDefault();
    definirMessagePhrase('');
    const resultat = await deverrouillerAvecPhrase(phrase);
    if (!resultat.ouvert) definirMessagePhrase(resultat.message);
  }

  return (
    <main className="ecran-verrouillage">
      <div className="verrouillage-contenu">
        <div className="verrouillage-logo" aria-hidden="true">🔒</div>
        <h1>Omni-Budget</h1>
        <p className="montant-secondaire">
          {blocage.bloque
            ? 'Déverrouillage temporairement bloqué'
            : 'Saisissez votre code pour accéder à vos données'}
        </p>

        {blocage.bloque ? (
          <div className="carte" style={{ marginTop: '1rem' }}>
            <p className="bandeau bandeau-alerte">
              <span aria-hidden="true">⏳</span>
              <span>
                Trop d’essais incorrects. Réessayez dans{' '}
                <strong>
                  {Math.floor(blocage.secondesRestantes / 60)} min{' '}
                  {String(blocage.secondesRestantes % 60).padStart(2, '0')} s
                </strong>
                .
              </span>
            </p>
            <p className="champ-aide">
              Ce délai protège vos données : il rend impossible d’essayer les
              codes un par un.
            </p>
          </div>
        ) : (
          <>
            <ClavierPin
              valeur={code}
              surChangement={definirCode}
              surValidation={validerLeCode}
              desactive={verificationEnCours}
              longueurAttendue={configuration?.longueurCode ?? null}
              libelleValidation={verificationEnCours ? 'Vérification…' : 'Déverrouiller'}
            />

            {message && (
              <p className="bandeau bandeau-erreur" role="alert" style={{ marginTop: '0.75rem' }}>
                <span aria-hidden="true">⚠️</span>
                {message}
              </p>
            )}

            {biometriePossible(configuration) && (
              <button
                type="button"
                className="bouton bouton-discret"
                style={{ width: '100%', marginTop: '0.75rem' }}
                onClick={essayerLaBiometrie}
                disabled={verificationEnCours}
              >
                <span aria-hidden="true">👆</span> Utiliser la biométrie
              </button>
            )}
          </>
        )}

        <div className="rangee-boutons" style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            className="bouton bouton-discret"
            onClick={() => definirEcranPhrase(true)}
          >
            Code oublié ?
          </button>
        </div>
      </div>

      {ecranPhrase && (
        <Modale titre="Code oublié" surFermeture={() => definirEcranPhrase(false)}>
          {configuration?.phraseActive ? (
            <form onSubmit={validerLaPhrase} noValidate>
              <p>
                Saisissez les 12 mots de votre phrase de récupération, séparés
                par des espaces, dans l’ordre.
              </p>
              <div className="champ">
                <label className="champ-etiquette" htmlFor="champ-phrase">
                  Phrase de récupération
                </label>
                <textarea
                  id="champ-phrase"
                  value={phrase}
                  onChange={(e) => definirPhrase(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  rows={4}
                  placeholder="abandon ability able about…"
                />
              </div>
              {messagePhrase && (
                <p className="champ-erreur" role="alert">{messagePhrase}</p>
              )}
              <div className="rangee-boutons">
                <button
                  type="button"
                  className="bouton bouton-discret"
                  onClick={() => definirEcranPhrase(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="bouton bouton-principal">
                  Déverrouiller
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="bandeau bandeau-erreur">
                <span aria-hidden="true">⚠️</span>
                <span>
                  Aucune phrase de récupération n’a été créée sur cet appareil.
                </span>
              </p>
              <p>
                Vos données sont chiffrées avec une clé dérivée de votre code.
                Sans ce code et sans phrase de récupération, elles sont
                <strong> définitivement illisibles</strong> — y compris pour
                l’auteur de l’application.
              </p>
              <p>
                La seule action encore possible est de tout effacer et de
                repartir de zéro.
              </p>
              <div className="rangee-boutons">
                <button
                  type="button"
                  className="bouton bouton-discret"
                  onClick={() => definirEcranPhrase(false)}
                >
                  Revenir au code
                </button>
                <button
                  type="button"
                  className="bouton bouton-danger"
                  onClick={() => {
                    definirEcranPhrase(false);
                    definirConfirmationEffacement(true);
                  }}
                >
                  Tout effacer
                </button>
              </div>
            </>
          )}
        </Modale>
      )}

      {confirmationEffacement && (
        <Confirmation
          titre="Effacer toutes les données ?"
          message="Toutes vos dépenses, catégories et budgets seront définitivement supprimés de cet appareil, et un nouveau code vous sera demandé. Cette action est irréversible."
          libelleConfirmation="Effacer définitivement"
          surAnnulation={() => definirConfirmationEffacement(false)}
          surConfirmation={toutEffacerEtRecommencer}
        />
      )}
    </main>
  );
}

/** La biometrie est-elle proposable sur cet ecran ? */
function biometriePossible(configuration) {
  return Boolean(configuration?.biometrieActive);
}
