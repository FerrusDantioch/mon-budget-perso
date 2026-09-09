/*
 * PREPARATION DES PHOTOS DE REÇUS
 *
 * Une photo prise avec un telephone recent pese entre 2 et 8 Mo. En stocker
 * plusieurs centaines saturerait l'espace accorde au site par le navigateur.
 *
 * Chaque image est donc redimensionnee et recompressee avant d'etre rangee :
 *   - environ 1400 pixels de large, largement suffisant pour relire un
 *     ticket et pour que l'OCR fonctionne ;
 *   - au format JPEG avec une qualite de 0,72 ;
 *   - resultat : de 100 a 300 Ko par reçu, soit 20 a 50 fois moins.
 *
 * Le traitement se fait entierement dans le navigateur, sur un « canvas ».
 * La photo d'origine n'est jamais enregistree ni transmise.
 */

/** Largeur maximale conservee, en pixels. */
const LARGEUR_MAXIMALE = 1400;

/** Qualite JPEG, entre 0 et 1. */
const QUALITE_JPEG = 0.72;

/** Taille maximale acceptee en entree (25 Mo), pour eviter de bloquer le telephone. */
export const TAILLE_MAXIMALE_ENTREE = 25 * 1024 * 1024;

/**
 * Redimensionne et compresse une image.
 *
 * @param {File|Blob} fichier   la photo prise ou choisie par l'utilisateur
 * @param {{largeurMax?: number, qualite?: number}} options
 * @returns {Promise<{octets: Uint8Array, typeMime: string, largeur: number,
 *                    hauteur: number, tailleOrigine: number, blob: Blob}>}
 */
export async function compresserImage(fichier, options = {}) {
  const largeurMax = options.largeurMax ?? LARGEUR_MAXIMALE;
  const qualite = options.qualite ?? QUALITE_JPEG;

  if (!fichier || !fichier.type?.startsWith('image/')) {
    throw new Error('Ce fichier n’est pas une image.');
  }
  if (fichier.size > TAILLE_MAXIMALE_ENTREE) {
    throw new Error('Cette image est trop volumineuse (25 Mo maximum).');
  }

  const image = await chargerImage(fichier);

  // On ne fait que reduire : agrandir une petite photo n'apporte rien et
  // ferait grossir le fichier pour rien.
  const facteur = Math.min(1, largeurMax / image.width);
  const largeur = Math.round(image.width * facteur);
  const hauteur = Math.round(image.height * facteur);

  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;

  const contexte = toile.getContext('2d');
  // Fond blanc : un PNG transparent deviendrait noir une fois converti en JPEG.
  contexte.fillStyle = '#ffffff';
  contexte.fillRect(0, 0, largeur, hauteur);
  contexte.drawImage(image, 0, 0, largeur, hauteur);

  if (typeof image.close === 'function') image.close();

  const blob = await new Promise((resoudre, rejeter) => {
    toile.toBlob(
      (resultat) => (resultat ? resoudre(resultat) : rejeter(new Error('Compression impossible.'))),
      'image/jpeg',
      qualite
    );
  });

  return {
    octets: new Uint8Array(await blob.arrayBuffer()),
    typeMime: 'image/jpeg',
    largeur,
    hauteur,
    tailleOrigine: fichier.size,
    blob,
  };
}

/**
 * Charge une image en memoire.
 * createImageBitmap est la methode rapide et moderne ; « from-image » applique
 * l'orientation enregistree par l'appareil photo, sinon les photos prises a
 * la verticale apparaissent couchees. Sur les navigateurs plus anciens, on se
 * rabat sur la methode classique.
 */
async function chargerImage(fichier) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    } catch (probleme) {
      // Certains navigateurs refusent l'option : on reessaie sans.
      try {
        return await createImageBitmap(fichier);
      } catch (autreProbleme) {
        // On passe a la methode de repli ci-dessous.
      }
    }
  }

  return new Promise((resoudre, rejeter) => {
    const adresse = URL.createObjectURL(fichier);
    const element = new Image();
    element.onload = () => {
      URL.revokeObjectURL(adresse);
      resoudre(element);
    };
    element.onerror = () => {
      URL.revokeObjectURL(adresse);
      rejeter(new Error('Image illisible.'));
    };
    element.src = adresse;
  });
}

/**
 * Cree une adresse temporaire pour afficher des octets d'image a l'ecran.
 * Pensez a appeler libererApercu() ensuite pour rendre la memoire.
 */
export function creerApercu(octets, typeMime = 'image/jpeg') {
  return URL.createObjectURL(new Blob([octets], { type: typeMime }));
}

export function libererApercu(adresse) {
  if (adresse) URL.revokeObjectURL(adresse);
}

/** Taille lisible : 153600 -> "150 Ko". */
export function formaterTaille(octets) {
  if (!octets) return '0 Ko';
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}
