/*
 * ECRAN « REÇUS SCANNES »
 *
 * L'historique des tickets photographies. Chaque reçu est rattache a la
 * depense qu'il a servi a creer : on peut donc retrouver la preuve d'un achat
 * des mois plus tard.
 *
 * Les images sont chiffrees comme le reste des donnees : elles ne sont
 * dechiffrees qu'au moment ou on les affiche, et l'aperçu est libere des que
 * la fenetre se ferme.
 */

import { useEffect, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { Modale } from '../composants/Modale.jsx';
import { Confirmation } from '../composants/Confirmation.jsx';
import { ScannerRecu } from '../composants/ScannerRecu.jsx';
import { lireImage, tailleDesImages } from '../donnees/basededonnees.js';
import { creerApercu, libererApercu, formaterTaille } from '../ocr/image.js';
import { formaterMontant } from '../utils/monnaie.js';
import { formaterDateCourte } from '../utils/dates.js';

export function PageRecus({ surMessage }) {
  const { recus, devise, supprimerRecu } = useBudget();

  const [scannerOuvert, definirScannerOuvert] = useState(false);
  const [recuAffiche, definirRecuAffiche] = useState(null);
  const [apercu, definirApercu] = useState(null);
  const [chargementImage, definirChargementImage] = useState(false);
  const [aSupprimer, definirASupprimer] = useState(null);
  const [placeOccupee, definirPlaceOccupee] = useState(0);

  useEffect(() => {
    tailleDesImages().then(definirPlaceOccupee).catch(() => definirPlaceOccupee(0));
  }, [recus]);

  /** Ouvre un reçu : on ne dechiffre l'image qu'a ce moment-la. */
  async function ouvrirLeRecu(recu) {
    definirRecuAffiche(recu);
    definirChargementImage(true);
    try {
      const image = await lireImage(recu.imageId);
      if (image) definirApercu(creerApercu(image.octets, image.typeMime));
    } catch (probleme) {
      console.error('Image illisible', probleme);
    } finally {
      definirChargementImage(false);
    }
  }

  function fermerLeRecu() {
    libererApercu(apercu);
    definirApercu(null);
    definirRecuAffiche(null);
  }

  return (
    <div className="pile">
      <section className="carte">
        <div className="carte-titre">
          <h2>Reçus scannés</h2>
          <button
            type="button"
            className="bouton bouton-principal"
            onClick={() => definirScannerOuvert(true)}
          >
            <span aria-hidden="true">📷</span> Scanner
          </button>
        </div>

        {recus.length === 0 ? (
          <p className="centre-vide">
            Aucun reçu pour l’instant. Photographiez un ticket : le montant, la
            date et le commerçant seront pré-remplis, et vous n’aurez qu’à les
            vérifier.
          </p>
        ) : (
          <>
            <p className="champ-aide">
              {recus.length} reçu{recus.length > 1 ? 's' : ''} ·{' '}
              {formaterTaille(placeOccupee)} utilisés sur cet appareil
            </p>
            <ul className="liste-reglages">
              {recus.map((recu) => (
                <li key={recu.id}>
                  <button
                    type="button"
                    className="ligne-cliquable"
                    onClick={() => ouvrirLeRecu(recu)}
                    aria-label={`Voir le reçu ${recu.commercant || 'sans nom'} du ${formaterDateCourte(recu.date)}`}
                  >
                    <span className="depense-pastille" style={{ background: 'var(--accent)' }} aria-hidden="true">
                      🧾
                    </span>
                    <span className="principal">
                      <span className="titre">{recu.commercant || 'Reçu sans nom'}</span>
                      <span className="detail">{formaterDateCourte(recu.date)}</span>
                    </span>
                    <span className="depense-montant">
                      {formaterMontant(recu.montantCentimes, devise)}
                    </span>
                    <span aria-hidden="true" style={{ color: 'var(--texte-doux)' }}>›</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="champ-aide" style={{ textAlign: 'center' }}>
        Les photos sont compressées puis chiffrées, comme le reste de vos
        données. Elles ne quittent jamais cet appareil.
      </p>

      {/* --- Scanner --- */}
      {scannerOuvert && (
        <Modale titre="Scanner un reçu" surFermeture={() => definirScannerOuvert(false)}>
          <ScannerRecu
            surAnnulation={() => definirScannerOuvert(false)}
            surTermine={() => definirScannerOuvert(false)}
            surMessage={surMessage}
          />
        </Modale>
      )}

      {/* --- Consultation d'un reçu --- */}
      {recuAffiche && (
        <Modale titre={recuAffiche.commercant || 'Reçu'} surFermeture={fermerLeRecu}>
          {chargementImage ? (
            <p className="centre-vide" role="status">Déchiffrement de l’image…</p>
          ) : apercu ? (
            <img src={apercu} alt="Photo du reçu" className="apercu-recu" />
          ) : (
            <p className="bandeau bandeau-alerte">
              <span aria-hidden="true">⚠️</span>
              L’image de ce reçu est introuvable.
            </p>
          )}

          <ul className="liste-reglages">
            <li>
              <span className="principal">
                <span className="titre">Montant</span>
                <span className="detail">
                  {formaterMontant(recuAffiche.montantCentimes, devise)}
                </span>
              </span>
            </li>
            <li>
              <span className="principal">
                <span className="titre">Date</span>
                <span className="detail">{formaterDateCourte(recuAffiche.date)}</span>
              </span>
            </li>
            {recuAffiche.detectionAutomatique && (
              <li>
                <span className="principal">
                  <span className="titre">Lecture automatique</span>
                  <span className="detail">
                    montant : {recuAffiche.detectionAutomatique.montant} · date :{' '}
                    {recuAffiche.detectionAutomatique.date} · commerçant :{' '}
                    {recuAffiche.detectionAutomatique.commercant}
                  </span>
                </span>
              </li>
            )}
          </ul>

          <div className="rangee-boutons">
            <button type="button" className="bouton bouton-discret" onClick={fermerLeRecu}>
              Fermer
            </button>
            <button
              type="button"
              className="bouton bouton-danger"
              onClick={() => {
                definirASupprimer(recuAffiche);
                fermerLeRecu();
              }}
            >
              Supprimer
            </button>
          </div>
        </Modale>
      )}

      {aSupprimer && (
        <Confirmation
          titre="Supprimer ce reçu ?"
          message="La photo sera définitivement effacée. La dépense correspondante, elle, sera conservée dans votre historique."
          surAnnulation={() => definirASupprimer(null)}
          surConfirmation={async () => {
            await supprimerRecu(aSupprimer.id);
            definirASupprimer(null);
            surMessage('Reçu supprimé');
          }}
        />
      )}
    </div>
  );
}
