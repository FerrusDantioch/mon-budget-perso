/*
 * MOTEUR DE RECONNAISSANCE DE TEXTE (Tesseract)
 *
 * CHARGEMENT DIFFERE — le point le plus important de ce fichier
 * ------------------------------------------------------------
 * Le moteur pese environ 3,5 Mo (le programme) plus 0,6 Mo (le dictionnaire
 * francais). Si on le chargeait au demarrage, l'application mettrait plusieurs
 * secondes a s'ouvrir, pour une fonction que la plupart des gens n'utilisent
 * jamais.
 *
 * Il est donc charge uniquement au moment ou l'on scanne un premier reçu :
 *   - la librairie elle-meme par un import() a l'interieur d'une fonction,
 *     ce qui indique a l'outil de construction d'en faire un fichier separe ;
 *   - le programme et le dictionnaire sont telecharges depuis notre propre
 *     site, JAMAIS depuis un serveur exterieur (voir scripts/preparer-ocr.mjs).
 *
 * Le service worker ne les met PAS dans le cache initial : ils ne sont
 * enregistres pour l'usage hors-ligne qu'apres le premier scan reussi.
 *
 * Tout se passe sur l'appareil : aucune image, aucun texte ne sort du
 * telephone.
 */

/** Dossier ou se trouvent les fichiers du moteur (voir vite.config.js). */
const DOSSIER_OCR = `${import.meta.env.BASE_URL}ocr/`;

// Resultat de la verification de disponibilite, garde en memoire pour ne pas
// interroger le reseau a chaque ouverture de l'ecran.
let disponibiliteConnue = null;

// Le worker est conserve entre deux scans : le rallumer coute plusieurs
// secondes. Il est eteint au verrouillage de l'application.
let workerPartage = null;
let chargementEnCours = null;

/**
 * Le processeur gere-t-il les instructions vectorielles (SIMD) ?
 * Elles accelerent la reconnaissance d'environ 30 %. On le verifie en
 * demandant au navigateur de valider un tout petit programme WebAssembly qui
 * en contient une : s'il l'accepte, le support est la.
 */
function processeurRapide() {
  try {
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0,
        65, 0, 253, 15, 253, 98, 11,
      ])
    );
  } catch (probleme) {
    return false;
  }
}

/** Le fichier du moteur adapte a cet appareil. */
function fichierDuMoteur() {
  return processeurRapide()
    ? `${DOSSIER_OCR}tesseract-core-simd-lstm.js`
    : `${DOSSIER_OCR}tesseract-core-lstm.js`;
}

/**
 * Le moteur est-il installe et utilisable ?
 *
 * Il peut manquer dans deux cas :
 *   - la commande « npm run ocr » n'a pas ete lancee avant la construction ;
 *   - l'application est hors-ligne et le moteur n'a jamais ete telecharge.
 *
 * Dans les deux cas, le scanner reste utilisable : il propose simplement la
 * saisie manuelle a partir de la photo.
 *
 * @returns {Promise<{disponible: boolean, raison?: string}>}
 */
export async function verifierDisponibilite() {
  if (disponibiliteConnue) return disponibiliteConnue;

  try {
    // Une requete « HEAD » demande seulement si le fichier existe, sans le
    // telecharger : c'est instantane et cela ne consomme pas de donnees.
    const reponse = await fetch(`${DOSSIER_OCR}fra.traineddata.gz`, { method: 'HEAD' });

    if (reponse.ok) {
      disponibiliteConnue = { disponible: true };
    } else {
      disponibiliteConnue = {
        disponible: false,
        raison:
          'Le dictionnaire de reconnaissance n’est pas installé sur ce site. ' +
          'Vous pouvez saisir le reçu à la main.',
      };
    }
  } catch (probleme) {
    disponibiliteConnue = {
      disponible: false,
      raison: navigator.onLine
        ? 'Le moteur de reconnaissance est introuvable. Vous pouvez saisir le reçu à la main.'
        : 'Sans connexion, la reconnaissance automatique n’est possible que si elle a déjà été utilisée une fois. Vous pouvez saisir le reçu à la main.',
    };
  }

  return disponibiliteConnue;
}

/**
 * Prepare le moteur (telechargement + demarrage). Long la premiere fois.
 * @param {(etape: {libelle: string, avancement: number}) => void} surProgression
 */
async function obtenirWorker(surProgression) {
  if (workerPartage) return workerPartage;
  // Si un chargement est deja en cours, on attend le meme plutot que d'en
  // lancer un second.
  if (chargementEnCours) return chargementEnCours;

  chargementEnCours = (async () => {
    // C'est CET import() qui differe le telechargement de la librairie.
    const { createWorker } = await import('tesseract.js');

    const libelles = {
      'loading tesseract core': 'Chargement du moteur…',
      'loading language traineddata': 'Chargement du dictionnaire français…',
      'initializing tesseract': 'Préparation…',
      'initializing api': 'Préparation…',
      'recognizing text': 'Lecture du reçu…',
    };

    const worker = await createWorker('fra', 1, {
      workerPath: `${DOSSIER_OCR}worker.min.js`,
      corePath: fichierDuMoteur(),
      langPath: DOSSIER_OCR,
      gzip: true,
      // On charge le worker directement depuis notre site plutot que par une
      // adresse « blob: », que la politique de securite (CSP) interdit.
      workerBlobURL: false,
      logger: (message) => {
        if (!surProgression) return;
        surProgression({
          libelle: libelles[message.status] ?? 'Traitement…',
          avancement: Math.round((message.progress ?? 0) * 100),
        });
      },
    });

    workerPartage = worker;
    return worker;
  })();

  try {
    return await chargementEnCours;
  } finally {
    chargementEnCours = null;
  }
}

/**
 * Lit le texte d'une image.
 *
 * @param {Blob|File|string} image
 * @param {(etape: {libelle: string, avancement: number}) => void} [surProgression]
 * @returns {Promise<{texte: string, confiance: number}>}
 */
export async function reconnaitreTexte(image, surProgression) {
  const worker = await obtenirWorker(surProgression);
  const resultat = await worker.recognize(image);

  return {
    texte: resultat?.data?.text ?? '',
    // Confiance moyenne renvoyee par Tesseract, de 0 a 100.
    confiance: Math.round(resultat?.data?.confidence ?? 0),
  };
}

/**
 * Eteint le moteur et libere la memoire.
 * Appele au verrouillage de l'application et a la fermeture du scanner.
 */
export async function eteindreMoteur() {
  if (!workerPartage) return;
  const worker = workerPartage;
  workerPartage = null;
  try {
    await worker.terminate();
  } catch (probleme) {
    // Le worker etait deja arrete : sans consequence.
  }
}

/** Remet a zero la verification de disponibilite (apres un retour en ligne). */
export function oublierDisponibilite() {
  disponibiliteConnue = null;
}
