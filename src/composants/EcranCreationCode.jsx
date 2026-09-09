/*
 * PREMIER LANCEMENT : CHOIX DU CODE
 *
 * Trois etapes volontairement separees :
 *   1. on explique a quoi sert le code (et ce qu'on perd en l'oubliant) ;
 *   2. on le saisit ;
 *   3. on le saisit une seconde fois pour eviter la faute de frappe.
 *
 * Une faute de frappe ici rendrait les donnees inaccessibles des le
 * lendemain : la double saisie n'est pas une formalite.
 */

import { useState } from 'react';
import { useCoffre } from '../contexte/ContexteCoffre.jsx';
import { ClavierPin } from './ClavierPin.jsx';
import { LONGUEUR_CODE_MIN } from '../securite/coffre.js';

/** Codes trop faciles a deviner : on refuse de les enregistrer. */
const CODES_INTERDITS = [
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '1230',
  '000000', '111111', '123456', '654321', '121212', '112233',
];

export function EcranCreationCode() {
  const { creerLeCode, donneesAReprendre } = useCoffre();

  const [etape, definirEtape] = useState('explication');
  const [premierCode, definirPremierCode] = useState('');
  const [code, definirCode] = useState('');
  const [message, definirMessage] = useState('');
  const [enCours, definirEnCours] = useState(false);

  function validerPremiereSaisie(saisi) {
    if (CODES_INTERDITS.includes(saisi)) {
      definirMessage(
        'Ce code est trop facile à deviner. Évitez les suites (1234) et les répétitions (0000).'
      );
      definirCode('');
      return;
    }
    definirPremierCode(saisi);
    definirCode('');
    definirMessage('');
    definirEtape('confirmation');
  }

  async function validerConfirmation(saisi) {
    if (saisi !== premierCode) {
      definirMessage('Les deux codes ne correspondent pas. Recommencez.');
      definirCode('');
      definirPremierCode('');
      definirEtape('saisie');
      return;
    }

    definirEnCours(true);
    try {
      await creerLeCode(saisi);
    } catch (probleme) {
      definirMessage(probleme.message ?? 'La création du code a échoué.');
      definirEnCours(false);
    }
  }

  return (
    <main className="ecran-verrouillage">
      <div className="verrouillage-contenu">
        {etape === 'explication' && (
          <>
            <div className="verrouillage-logo" aria-hidden="true">🔐</div>
            <h1>Protégez vos données</h1>

            <div className="carte" style={{ textAlign: 'left' }}>
              <p>
                Vos dépenses ne quittent jamais cet appareil. Pour qu’elles
                restent illisibles si quelqu’un d’autre prend votre téléphone,
                elles sont <strong>chiffrées</strong> avec une clé calculée à
                partir d’un code que vous seul connaissez.
              </p>

              <p className="bandeau bandeau-alerte">
                <span aria-hidden="true">⚠️</span>
                <span>
                  <strong>Ce code ne peut pas être réinitialisé.</strong> Si vous
                  l’oubliez, vos données sont définitivement perdues — sauf si
                  vous créez ensuite une phrase de récupération, ce que
                  l’application vous proposera juste après.
                </span>
              </p>

              <p className="champ-aide">
                Un code à 6 chiffres est nettement plus sûr qu’un code à 4.
                Évitez votre date de naissance.
              </p>

              {donneesAReprendre > 0 && (
                <p className="bandeau bandeau-info">
                  <span aria-hidden="true">📦</span>
                  <span>
                    Vos {donneesAReprendre} enregistrement
                    {donneesAReprendre > 1 ? 's' : ''} existant
                    {donneesAReprendre > 1 ? 's' : ''} seront conservé
                    {donneesAReprendre > 1 ? 's' : ''} et chiffré
                    {donneesAReprendre > 1 ? 's' : ''} automatiquement.
                  </span>
                </p>
              )}
            </div>

            <button
              type="button"
              className="bouton bouton-principal"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => definirEtape('saisie')}
            >
              Choisir mon code
            </button>
          </>
        )}

        {etape === 'saisie' && (
          <>
            <h1>Votre code</h1>
            <p className="montant-secondaire">
              {LONGUEUR_CODE_MIN} à 6 chiffres. Appuyez sur « Continuer » quand
              vous avez terminé.
            </p>
            <ClavierPin
              valeur={code}
              surChangement={definirCode}
              surValidation={validerPremiereSaisie}
              libelleValidation="Continuer"
            />
            {message && (
              <p className="bandeau bandeau-erreur" role="alert" style={{ marginTop: '0.75rem' }}>
                <span aria-hidden="true">⚠️</span>
                {message}
              </p>
            )}
          </>
        )}

        {etape === 'confirmation' && (
          <>
            <h1>Confirmez</h1>
            <p className="montant-secondaire">Saisissez à nouveau le même code.</p>
            <ClavierPin
              valeur={code}
              surChangement={definirCode}
              surValidation={validerConfirmation}
              desactive={enCours}
              longueurAttendue={premierCode.length}
              libelleValidation={enCours ? 'Création…' : 'Confirmer'}
            />
            {message && (
              <p className="bandeau bandeau-erreur" role="alert" style={{ marginTop: '0.75rem' }}>
                <span aria-hidden="true">⚠️</span>
                {message}
              </p>
            )}
            <button
              type="button"
              className="bouton bouton-discret"
              style={{ width: '100%', marginTop: '0.75rem' }}
              onClick={() => {
                definirEtape('saisie');
                definirCode('');
                definirPremierCode('');
                definirMessage('');
              }}
              disabled={enCours}
            >
              Recommencer
            </button>
          </>
        )}
      </div>
    </main>
  );
}
