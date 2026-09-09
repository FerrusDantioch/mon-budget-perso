/*
 * ECRAN « SAUVEGARDE »
 *
 * Trois operations distinctes, volontairement bien separees a l'ecran :
 *   - creer une sauvegarde chiffree (fichier .json) ;
 *   - restaurer une sauvegarde (remplace tout) ;
 *   - exporter vers un tableur (fichier .csv, NON chiffre).
 *
 * L'avertissement sur la perte du mot de passe n'est pas une simple phrase
 * en petits caracteres : il faut cocher une case pour pouvoir continuer.
 */

import { useRef, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { Confirmation } from '../composants/Confirmation.jsx';
import {
  LONGUEUR_MOT_DE_PASSE_MIN,
  creerExportCsv,
  creerSauvegardeChiffree,
  evaluerMotDePasse,
  lireSauvegarde,
  nomDeFichier,
  restaurerSauvegarde,
  telechargerFichier,
} from '../donnees/sauvegarde.js';
import { listerToutesLesDepenses } from '../donnees/basededonnees.js';
import { nomDuMoisAffichage } from '../utils/dates.js';

export function PageSauvegarde({ surMessage }) {
  const { categories, devise, rechargerTout } = useBudget();

  // --- Export chiffre -----------------------------------------------------
  const [motDePasse, definirMotDePasse] = useState('');
  const [confirmation, definirConfirmation] = useState('');
  const [avertissementLu, definirAvertissementLu] = useState(false);
  const [exportEnCours, definirExportEnCours] = useState(false);
  const [erreurExport, definirErreurExport] = useState('');

  // --- Restauration -------------------------------------------------------
  const [fichierChoisi, definirFichierChoisi] = useState(null);
  const [motDePasseImport, definirMotDePasseImport] = useState('');
  const [apercuSauvegarde, definirApercuSauvegarde] = useState(null);
  const [erreurImport, definirErreurImport] = useState('');
  const [importEnCours, definirImportEnCours] = useState(false);
  const [confirmationRestauration, definirConfirmationRestauration] = useState(false);
  const entreeFichierRef = useRef(null);

  // --- Export CSV ---------------------------------------------------------
  const [confirmationCsv, definirConfirmationCsv] = useState(false);

  const solidite = motDePasse ? evaluerMotDePasse(motDePasse) : null;
  const motsDePasseIdentiques = motDePasse.length > 0 && motDePasse === confirmation;
  const exportPossible =
    motsDePasseIdentiques && solidite?.acceptable && avertissementLu && !exportEnCours;

  async function creerLaSauvegarde(evenement) {
    evenement.preventDefault();
    definirErreurExport('');
    definirExportEnCours(true);
    try {
      const contenu = await creerSauvegardeChiffree(motDePasse);
      telechargerFichier(
        nomDeFichier('budget-sauvegarde', 'json'),
        contenu,
        'application/json'
      );
      definirMotDePasse('');
      definirConfirmation('');
      definirAvertissementLu(false);
      surMessage('Sauvegarde créée');
    } catch (probleme) {
      console.error('Sauvegarde impossible', probleme);
      definirErreurExport('La sauvegarde a échoué. Réessayez.');
    } finally {
      definirExportEnCours(false);
    }
  }

  async function analyserLeFichier(evenement) {
    evenement.preventDefault();
    definirErreurImport('');
    definirApercuSauvegarde(null);

    if (!fichierChoisi) {
      definirErreurImport('Choisissez d’abord un fichier de sauvegarde.');
      return;
    }

    definirImportEnCours(true);
    try {
      const texte = await fichierChoisi.text();
      const resultat = await lireSauvegarde(texte, motDePasseImport);
      definirApercuSauvegarde(resultat);
    } catch (probleme) {
      definirErreurImport(probleme.message);
    } finally {
      definirImportEnCours(false);
    }
  }

  async function exporterEnCsv() {
    const toutesLesDepenses = await listerToutesLesDepenses();
    telechargerFichier(
      nomDeFichier('budget-depenses', 'csv'),
      creerExportCsv(toutesLesDepenses, categories, devise),
      'text/csv;charset=utf-8'
    );
    definirConfirmationCsv(false);
    surMessage('Export tableur créé');
  }

  return (
    <div className="pile">
      {/* ================= SAUVEGARDE CHIFFREE ================= */}
      <section className="carte" aria-labelledby="titre-export">
        <div className="carte-titre">
          <h2 id="titre-export">Créer une sauvegarde</h2>
        </div>

        <p>
          Un fichier unique, <strong>chiffré</strong>, contenant vos dépenses,
          catégories, budgets, récurrences et reçus. Rangez-le où vous voulez :
          sans le mot de passe, il est illisible.
        </p>

        <form onSubmit={creerLaSauvegarde} noValidate>
          <div className="champ">
            <label className="champ-etiquette" htmlFor="champ-mdp">Mot de passe maître</label>
            <input
              id="champ-mdp"
              type="password"
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => definirMotDePasse(e.target.value)}
              placeholder={`${LONGUEUR_MOT_DE_PASSE_MIN} caractères minimum`}
            />
            {solidite && (
              <span
                className="champ-aide"
                style={{
                  color:
                    solidite.niveau === 'bon'
                      ? 'var(--ok)'
                      : solidite.niveau === 'moyen'
                        ? 'var(--attention)'
                        : 'var(--critique)',
                  fontWeight: 600,
                }}
              >
                {solidite.message}
              </span>
            )}
          </div>

          <div className="champ">
            <label className="champ-etiquette" htmlFor="champ-mdp-2">Confirmez le mot de passe</label>
            <input
              id="champ-mdp-2"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => definirConfirmation(e.target.value)}
              aria-invalid={confirmation.length > 0 && !motsDePasseIdentiques ? 'true' : undefined}
            />
            {confirmation.length > 0 && !motsDePasseIdentiques && (
              <span className="champ-erreur" role="alert">
                Les deux mots de passe ne correspondent pas.
              </span>
            )}
          </div>

          {/* AVERTISSEMENT IMPOSSIBLE A MANQUER */}
          <div className="avertissement-majeur">
            <p className="avertissement-titre">
              <span aria-hidden="true">⚠️</span> Sans ce mot de passe, les
              données sont irrécupérables
            </p>
            <p>
              Il n’est enregistré nulle part : ni dans l’application, ni dans le
              fichier de sauvegarde. Personne ne peut le retrouver ni le
              réinitialiser — ni vous, ni l’auteur de l’application.
              Notez-le dans un endroit sûr.
            </p>
            <label className="champ-case">
              <input
                type="checkbox"
                checked={avertissementLu}
                onChange={(e) => definirAvertissementLu(e.target.checked)}
              />
              <span>
                J’ai compris que si je perds ce mot de passe, cette sauvegarde
                sera définitivement inutilisable.
              </span>
            </label>
          </div>

          {erreurExport && (
            <p className="champ-erreur" role="alert">{erreurExport}</p>
          )}

          <button
            type="submit"
            className="bouton bouton-principal"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={!exportPossible}
          >
            {exportEnCours ? 'Chiffrement…' : 'Télécharger la sauvegarde chiffrée'}
          </button>
        </form>
      </section>

      {/* ================= RESTAURATION ================= */}
      <section className="carte" aria-labelledby="titre-import">
        <div className="carte-titre">
          <h2 id="titre-import">Restaurer une sauvegarde</h2>
        </div>

        <p className="bandeau bandeau-alerte">
          <span aria-hidden="true">⚠️</span>
          <span>
            La restauration <strong>remplace tout</strong> ce qui se trouve
            actuellement sur cet appareil.
          </span>
        </p>

        <form onSubmit={analyserLeFichier} noValidate>
          <div className="champ">
            <label className="champ-etiquette" htmlFor="champ-fichier">
              Fichier de sauvegarde (.json)
            </label>
            <input
              id="champ-fichier"
              ref={entreeFichierRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                definirFichierChoisi(e.target.files?.[0] ?? null);
                definirApercuSauvegarde(null);
                definirErreurImport('');
              }}
            />
          </div>

          <div className="champ">
            <label className="champ-etiquette" htmlFor="champ-mdp-import">
              Mot de passe de cette sauvegarde
            </label>
            <input
              id="champ-mdp-import"
              type="password"
              autoComplete="current-password"
              value={motDePasseImport}
              onChange={(e) => definirMotDePasseImport(e.target.value)}
            />
          </div>

          {erreurImport && (
            <p className="bandeau bandeau-erreur" role="alert">
              <span aria-hidden="true">⚠️</span>
              {erreurImport}
            </p>
          )}

          <button
            type="submit"
            className="bouton"
            style={{ width: '100%' }}
            disabled={!fichierChoisi || motDePasseImport.length === 0 || importEnCours}
          >
            {importEnCours ? 'Vérification…' : 'Vérifier le fichier'}
          </button>
        </form>

        {/* Apercu avant remplacement : on montre ce que contient le fichier
            AVANT de toucher aux donnees existantes. */}
        {apercuSauvegarde && (
          <div className="carte" style={{ marginTop: '0.9rem' }}>
            <h3>Contenu de la sauvegarde</h3>
            <ul className="liste-reglages">
              <li>
                <span className="principal">
                  <span className="titre">Créée le</span>
                  <span className="detail">
                    {new Date(apercuSauvegarde.creeLe).toLocaleString('fr-FR')}
                  </span>
                </span>
              </li>
              <li>
                <span className="principal">
                  <span className="titre">Dépenses</span>
                  <span className="detail">
                    {apercuSauvegarde.resume.depenses}
                    {apercuSauvegarde.resume.premierMois &&
                      ` · de ${nomDuMoisAffichage(apercuSauvegarde.resume.premierMois)} à ${nomDuMoisAffichage(apercuSauvegarde.resume.dernierMois)}`}
                  </span>
                </span>
              </li>
              <li>
                <span className="principal">
                  <span className="titre">Catégories · récurrences · reçus</span>
                  <span className="detail">
                    {apercuSauvegarde.resume.categories} ·{' '}
                    {apercuSauvegarde.resume.recurrences} · {apercuSauvegarde.resume.recus}
                  </span>
                </span>
              </li>
            </ul>

            <button
              type="button"
              className="bouton bouton-danger"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => definirConfirmationRestauration(true)}
            >
              Remplacer mes données par cette sauvegarde
            </button>
          </div>
        )}
      </section>

      {/* ================= EXPORT TABLEUR ================= */}
      <section className="carte" aria-labelledby="titre-csv">
        <div className="carte-titre">
          <h2 id="titre-csv">Export tableur</h2>
        </div>

        <p>
          Un fichier .csv ouvrable dans Excel ou LibreOffice, avec une ligne par
          dépense.
        </p>

        <p className="bandeau bandeau-erreur">
          <span aria-hidden="true">🔓</span>
          <span>
            <strong>Ce fichier n’est pas chiffré.</strong> Toute personne qui y
            a accès peut lire l’intégralité de vos dépenses. Ne l’envoyez pas
            par messagerie et supprimez-le après usage.
          </span>
        </p>

        <button
          type="button"
          className="bouton"
          style={{ width: '100%' }}
          onClick={() => definirConfirmationCsv(true)}
        >
          Exporter en CSV (non chiffré)
        </button>
      </section>

      {/* ================= CONFIRMATIONS ================= */}
      {confirmationRestauration && (
        <Confirmation
          titre="Remplacer toutes vos données ?"
          message="Vos dépenses, catégories, budgets, récurrences et reçus actuels seront définitivement effacés et remplacés par le contenu de la sauvegarde. Cette action est irréversible."
          libelleConfirmation="Remplacer"
          surAnnulation={() => definirConfirmationRestauration(false)}
          surConfirmation={async () => {
            try {
              await restaurerSauvegarde(apercuSauvegarde.contenu);
              await rechargerTout();
              definirConfirmationRestauration(false);
              definirApercuSauvegarde(null);
              definirMotDePasseImport('');
              definirFichierChoisi(null);
              if (entreeFichierRef.current) entreeFichierRef.current.value = '';
              surMessage('Sauvegarde restaurée');
            } catch (probleme) {
              console.error('Restauration impossible', probleme);
              definirConfirmationRestauration(false);
              definirErreurImport('La restauration a échoué.');
            }
          }}
        />
      )}

      {confirmationCsv && (
        <Confirmation
          titre="Exporter en clair ?"
          message="Le fichier CSV n’est protégé par aucun mot de passe. N’importe qui pourra lire toutes vos dépenses, montants et notes."
          libelleConfirmation="J’ai compris, exporter"
          surAnnulation={() => definirConfirmationCsv(false)}
          surConfirmation={exporterEnCsv}
        />
      )}
    </div>
  );
}
