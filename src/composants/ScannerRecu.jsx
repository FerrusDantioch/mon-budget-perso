/*
 * SCANNER DE REÇUS
 *
 * Enchainement : photo -> compression -> lecture automatique -> CORRECTION
 * MANUELLE -> enregistrement.
 *
 * L'etape de correction n'est pas facultative et ne peut pas etre sautee.
 * Un OCR se trompe regulierement sur les chiffres d'un ticket froisse ; une
 * depense fausse enregistree sans relecture serait pire que pas de scanner
 * du tout. Les valeurs trouvees sont donc presentees comme des propositions,
 * accompagnees de leur indice de confiance.
 *
 * Si le moteur de reconnaissance n'est pas disponible (non installe, ou
 * premiere utilisation sans connexion), tout le reste continue de
 * fonctionner : la photo est conservee et les champs sont saisis a la main.
 */

import { useEffect, useRef, useState } from 'react';

import { useBudget } from '../contexte/ContexteBudget.jsx';
import { useCoffre } from '../contexte/ContexteCoffre.jsx';
import { compresserImage, creerApercu, libererApercu, formaterTaille } from '../ocr/image.js';
import { verifierDisponibilite, reconnaitreTexte } from '../ocr/moteurOcr.js';
import { analyserTicket } from '../ocr/extraction.js';
import { enregistrerImage } from '../donnees/basededonnees.js';
import { versCentimes, centimesVersTexte, formaterMontant } from '../utils/monnaie.js';
import { aujourdhui, estUneDateValide } from '../utils/dates.js';

/** Petite pastille « bonne / moyenne / aucune » a cote d'un champ pre-rempli. */
function IndiceConfiance({ niveau }) {
  const textes = {
    bonne: { libelle: 'Détecté — à vérifier', classe: 'niveau-ok' },
    moyenne: { libelle: 'Incertain — à corriger', classe: 'niveau-attention' },
    aucune: { libelle: 'Non détecté — à saisir', classe: 'niveau-depasse' },
  };
  const info = textes[niveau] ?? textes.aucune;
  return (
    <span className={info.classe}>
      <span className="etiquette-niveau">{info.libelle}</span>
    </span>
  );
}

export function ScannerRecu({ surTermine, surAnnulation, surMessage }) {
  const { categories, devise, ajouterDepense, ajouterRecu } = useBudget();
  const { signalerActivite } = useCoffre();

  const [etape, definirEtape] = useState('choix'); // choix | traitement | correction
  const [image, definirImage] = useState(null);
  const [apercu, definirApercu] = useState(null);
  const [progression, definirProgression] = useState(null);
  const [moteur, definirMoteur] = useState(null);
  const [analyse, definirAnalyse] = useState(null);
  const [texteBrut, definirTexteBrut] = useState('');
  const [texteVisible, definirTexteVisible] = useState(false);
  const [erreur, definirErreur] = useState('');

  // Champs du formulaire de correction.
  const [montant, definirMontant] = useState('');
  const [date, definirDate] = useState(aujourdhui());
  const [commercant, definirCommercant] = useState('');
  const [categorieId, definirCategorieId] = useState(() => categories[0]?.id ?? '');
  const [erreursChamps, definirErreursChamps] = useState({});
  const [enregistrement, definirEnregistrement] = useState(false);

  const entreeCameraRef = useRef(null);
  const entreeGalerieRef = useRef(null);

  // Verification de la disponibilite du moteur des l'ouverture.
  useEffect(() => {
    verifierDisponibilite().then(definirMoteur);
  }, []);

  // Liberation de l'apercu quand le composant disparait.
  useEffect(() => () => libererApercu(apercu), [apercu]);

  /** Etape 1 : l'utilisateur a choisi une photo. */
  async function traiterLeFichier(fichier) {
    if (!fichier) return;
    definirErreur('');
    definirEtape('traitement');
    definirProgression({ libelle: 'Compression de l’image…', avancement: 0 });

    try {
      const compressee = await compresserImage(fichier);
      definirImage(compressee);
      definirApercu(creerApercu(compressee.octets, compressee.typeMime));
      signalerActivite();

      const etatMoteur = moteur ?? (await verifierDisponibilite());
      definirMoteur(etatMoteur);

      if (!etatMoteur.disponible) {
        // Pas d'OCR : on passe directement a la saisie manuelle.
        definirAnalyse(null);
        definirEtape('correction');
        return;
      }

      definirProgression({ libelle: 'Préparation du moteur…', avancement: 0 });

      const { texte } = await reconnaitreTexte(compressee.blob, (etat) => {
        definirProgression(etat);
        // La reconnaissance peut durer plusieurs dizaines de secondes :
        // on empeche le verrouillage automatique pendant ce temps.
        signalerActivite();
      });

      definirTexteBrut(texte);
      const resultat = analyserTicket(texte, aujourdhui());
      definirAnalyse(resultat);

      // Pre-remplissage : ce ne sont que des propositions.
      if (resultat.montantCentimes) definirMontant(centimesVersTexte(resultat.montantCentimes));
      if (resultat.date) definirDate(resultat.date);
      if (resultat.commercant) definirCommercant(resultat.commercant);

      definirEtape('correction');
    } catch (probleme) {
      console.error('Scan impossible', probleme);
      definirErreur(
        probleme.message ??
          'La lecture a échoué. Vous pouvez saisir les informations à la main.'
      );
      // Meme en cas d'echec, si l'image est prete on laisse saisir a la main.
      definirEtape(image ? 'correction' : 'choix');
    } finally {
      definirProgression(null);
    }
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();

    const problemes = {};
    const centimes = versCentimes(montant);
    if (centimes === null || centimes === 0) {
      problemes.montant = 'Indiquez le montant du reçu.';
    }
    if (!estUneDateValide(date)) problemes.date = 'Choisissez une date valide.';
    if (!categorieId) problemes.categorie = 'Choisissez une catégorie.';

    definirErreursChamps(problemes);
    if (Object.keys(problemes).length > 0) return;

    definirEnregistrement(true);
    try {
      // 1. l'image, chiffree comme le reste
      const imageId = await enregistrerImage(image.octets, image.typeMime);

      // 2. la depense
      const depense = await ajouterDepense({
        date,
        montantCentimes: centimes,
        categorieId,
        note: commercant.trim(),
      });

      // 3. le reçu, rattache a la depense
      await ajouterRecu({
        depenseId: depense.id,
        imageId,
        commercant: commercant.trim(),
        montantCentimes: centimes,
        date,
        // On conserve le texte lu : il permet de comprendre apres coup d'ou
        // venait une valeur erronee.
        texteBrut: texteBrut.slice(0, 4000),
        detectionAutomatique: analyse
          ? {
              montant: analyse.confianceMontant,
              date: analyse.confianceDate,
              commercant: analyse.confianceCommercant,
            }
          : null,
        tailleImage: image.octets.length,
      });

      surMessage('Reçu enregistré');
      surTermine();
    } catch (probleme) {
      console.error('Enregistrement du reçu impossible', probleme);
      definirErreur('L’enregistrement a échoué.');
      definirEnregistrement(false);
    }
  }

  // =========================================================================
  // ETAPE 1 — choix de la source
  // =========================================================================
  if (etape === 'choix') {
    return (
      <div className="pile-serree">
        <p>Prenez le ticket en photo, ou choisissez une image déjà enregistrée.</p>

        {moteur && !moteur.disponible && (
          <p className="bandeau bandeau-alerte">
            <span aria-hidden="true">ℹ️</span>
            {moteur.raison}
          </p>
        )}

        {moteur?.disponible && (
          <p className="champ-aide">
            La première lecture télécharge le moteur de reconnaissance
            (environ 3,5 Mo). Les suivantes sont immédiates, même sans connexion.
          </p>
        )}

        {/* Deux champs distincts : "capture" ouvre l'appareil photo, son
            absence ouvre la galerie. Sur ordinateur, les deux ouvrent le
            selecteur de fichiers, ce qui reste utilisable. */}
        <input
          ref={entreeCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-seulement"
          onChange={(e) => traiterLeFichier(e.target.files?.[0])}
        />
        <input
          ref={entreeGalerieRef}
          type="file"
          accept="image/*"
          className="sr-seulement"
          onChange={(e) => traiterLeFichier(e.target.files?.[0])}
        />

        <button
          type="button"
          className="bouton bouton-principal"
          style={{ width: '100%' }}
          onClick={() => entreeCameraRef.current?.click()}
        >
          <span aria-hidden="true">📷</span> Prendre une photo
        </button>
        <button
          type="button"
          className="bouton"
          style={{ width: '100%' }}
          onClick={() => entreeGalerieRef.current?.click()}
        >
          <span aria-hidden="true">🖼️</span> Choisir dans la galerie
        </button>
        <button
          type="button"
          className="bouton bouton-discret"
          style={{ width: '100%' }}
          onClick={surAnnulation}
        >
          Annuler
        </button>

        {erreur && (
          <p className="bandeau bandeau-erreur" role="alert">
            <span aria-hidden="true">⚠️</span>
            {erreur}
          </p>
        )}
      </div>
    );
  }

  // =========================================================================
  // ETAPE 2 — traitement
  // =========================================================================
  if (etape === 'traitement') {
    return (
      <div className="pile-serree" role="status" aria-live="polite">
        {apercu && <img src={apercu} alt="" className="apercu-recu" />}
        <p>{progression?.libelle ?? 'Traitement…'}</p>
        <div className="barre-progression">
          <div
            className="barre-progression-remplissage"
            style={{
              width: `${progression?.avancement ?? 0}%`,
              background: 'var(--accent)',
            }}
          />
        </div>
        <p className="champ-aide">
          Tout se passe sur votre appareil : l’image n’est envoyée nulle part.
        </p>
      </div>
    );
  }

  // =========================================================================
  // ETAPE 3 — correction obligatoire
  // =========================================================================
  return (
    <form onSubmit={enregistrer} noValidate>
      {apercu && <img src={apercu} alt="Aperçu du reçu photographié" className="apercu-recu" />}

      {image && (
        <p className="champ-aide" style={{ textAlign: 'center' }}>
          Image compressée : {formaterTaille(image.tailleOrigine)} →{' '}
          {formaterTaille(image.octets.length)}
        </p>
      )}

      <p className="bandeau bandeau-alerte">
        <span aria-hidden="true">✍️</span>
        <span>
          <strong>Vérifiez chaque valeur avant d’enregistrer.</strong>{' '}
          {analyse
            ? 'La lecture automatique se trompe régulièrement sur les chiffres.'
            : 'Aucune lecture automatique n’a été faite : saisissez les valeurs.'}
        </span>
      </p>

      {/* --- Montant --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="recu-montant">
          Montant{' '}
          {analyse && <IndiceConfiance niveau={analyse.confianceMontant} />}
        </label>
        <div className="champ-montant">
          <input
            id="recu-montant"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={montant}
            onChange={(e) => definirMontant(e.target.value)}
            aria-invalid={erreursChamps.montant ? 'true' : undefined}
            required
          />
          <span className="devise" aria-hidden="true">€</span>
        </div>
        {analyse?.ligneDuMontant && (
          <span className="champ-aide">Lu sur la ligne : « {analyse.ligneDuMontant} »</span>
        )}
        {erreursChamps.montant && (
          <span className="champ-erreur" role="alert">{erreursChamps.montant}</span>
        )}
      </div>

      {/* --- Date --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="recu-date">
          Date {analyse && <IndiceConfiance niveau={analyse.confianceDate} />}
        </label>
        <input
          id="recu-date"
          type="date"
          value={date}
          onChange={(e) => definirDate(e.target.value)}
          aria-invalid={erreursChamps.date ? 'true' : undefined}
          required
        />
        {erreursChamps.date && (
          <span className="champ-erreur" role="alert">{erreursChamps.date}</span>
        )}
      </div>

      {/* --- Commercant --- */}
      <div className="champ">
        <label className="champ-etiquette" htmlFor="recu-commercant">
          Commerçant {analyse && <IndiceConfiance niveau={analyse.confianceCommercant} />}
        </label>
        <input
          id="recu-commercant"
          type="text"
          maxLength={60}
          value={commercant}
          onChange={(e) => definirCommercant(e.target.value)}
          placeholder="Nom du magasin"
        />
      </div>

      {/* --- Categorie --- */}
      <fieldset className="choix-categories">
        <legend>Catégorie</legend>
        {categories.map((categorie) => (
          <label
            key={categorie.id}
            className={`pastille-categorie ${categorie.id === categorieId ? 'selectionnee' : ''}`}
          >
            <input
              type="radio"
              name="categorie-recu"
              value={categorie.id}
              checked={categorie.id === categorieId}
              onChange={() => definirCategorieId(categorie.id)}
            />
            <span className="point" style={{ background: categorie.couleur }} aria-hidden="true" />
            <span aria-hidden="true">{categorie.emoji}</span>
            <span>{categorie.nom}</span>
          </label>
        ))}
        {erreursChamps.categorie && (
          <span className="champ-erreur" role="alert">{erreursChamps.categorie}</span>
        )}
      </fieldset>

      {/* --- Texte brut, replie --- */}
      {texteBrut && (
        <div className="champ">
          <button
            type="button"
            className="bouton bouton-discret"
            style={{ width: '100%' }}
            onClick={() => definirTexteVisible((v) => !v)}
            aria-expanded={texteVisible}
          >
            {texteVisible ? 'Masquer' : 'Voir'} le texte lu sur le ticket
          </button>
          {texteVisible && <pre className="texte-ocr">{texteBrut}</pre>}
        </div>
      )}

      {erreur && (
        <p className="bandeau bandeau-erreur" role="alert">
          <span aria-hidden="true">⚠️</span>
          {erreur}
        </p>
      )}

      <div className="rangee-boutons">
        <button type="button" className="bouton bouton-discret" onClick={surAnnulation}>
          Annuler
        </button>
        <button type="submit" className="bouton bouton-principal" disabled={enregistrement}>
          {enregistrement
            ? 'Enregistrement…'
            : `Enregistrer ${versCentimes(montant) ? formaterMontant(versCentimes(montant), devise) : ''}`}
        </button>
      </div>
    </form>
  );
}
