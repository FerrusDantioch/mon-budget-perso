/*
 * PREPARATION DU MOTEUR DE RECONNAISSANCE DE TEXTE  (commande : npm run ocr)
 *
 * Le scanner de reçus lit le texte d'une photo grace a Tesseract. Ce moteur a
 * besoin de trois choses :
 *   1. un "worker" (le programme qui travaille en arriere-plan) ;
 *   2. le moteur lui-meme, compile en WebAssembly (.wasm) ;
 *   3. le modele de langue francaise (fra.traineddata.gz).
 *
 * Par defaut, Tesseract va chercher tout cela sur un serveur exterieur (un
 * "CDN"). C'est impossible ici pour deux raisons :
 *   - l'application doit fonctionner SANS connexion ;
 *   - la politique de securite (CSP) interdit tout serveur exterieur.
 *
 * Ce script copie donc ces fichiers dans public/ocr/, d'ou ils seront servis
 * par notre propre site. Les fichiers ne sont PAS enregistres dans Git
 * (voir .gitignore) : ils sont regeneres a chaque construction.
 *
 * Si le telechargement du modele de langue echoue (pas de connexion), le
 * script n'interrompt pas la construction : l'application fonctionnera avec
 * la saisie manuelle des reçus, en affichant un message explicite.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const DOSSIER_SORTIE = path.resolve('public/ocr');

// Modele de langue francaise, version "fast" : 0,6 Mo au lieu de 6 Mo pour la
// version complete. Sur un telephone, c'est decisif — et la difference de
// precision est sans consequence ici, puisque l'utilisateur relit et corrige
// toujours les valeurs avant de valider.
const URL_MODELE = 'https://tessdata.projectnaptha.com/4.0.0_fast/fra.traineddata.gz';

/**
 * Les deux variantes du moteur que l'on embarque :
 *   - "simd"   : rapide, utilise les instructions vectorielles du processeur.
 *                Supporte par Chrome, Firefox, Safari et Edge recents.
 *   - standard : la solution de repli pour les appareils plus anciens.
 * On choisit la bonne au moment de l'execution (voir src/ocr/moteurOcr.js).
 * On prend les variantes "lstm" : elles ne contiennent que le moteur de
 * reconnaissance moderne, ce qui economise environ 600 Ko par fichier.
 */
const FICHIERS_MOTEUR = [
  'tesseract-core-simd-lstm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-lstm.js',
  'tesseract-core-lstm.wasm',
];

function formaterTaille(octets) {
  return octets > 1024 * 1024
    ? `${(octets / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.round(octets / 1024)} Ko`;
}

/** Localise un fichier a l'interieur d'un paquet installe dans node_modules. */
function cheminDansPaquet(paquet, fichier) {
  // require.resolve trouve le paquet meme s'il est range dans un sous-dossier.
  const racine = path.dirname(require.resolve(`${paquet}/package.json`));
  return path.join(racine, fichier);
}

async function main() {
  fs.mkdirSync(DOSSIER_SORTIE, { recursive: true });

  // --- 1. Le worker de Tesseract -----------------------------------------
  const worker = cheminDansPaquet('tesseract.js', 'dist/worker.min.js');
  fs.copyFileSync(worker, path.join(DOSSIER_SORTIE, 'worker.min.js'));
  console.log(
    `  copie : public/ocr/worker.min.js (${formaterTaille(fs.statSync(worker).size)})`
  );

  // --- 2. Le moteur WebAssembly ------------------------------------------
  for (const fichier of FICHIERS_MOTEUR) {
    const source = cheminDansPaquet('tesseract.js-core', fichier);
    fs.copyFileSync(source, path.join(DOSSIER_SORTIE, fichier));
    console.log(
      `  copie : public/ocr/${fichier} (${formaterTaille(fs.statSync(source).size)})`
    );
  }

  // --- 3. Le modele de langue francaise -----------------------------------
  const destinationModele = path.join(DOSSIER_SORTIE, 'fra.traineddata.gz');

  if (fs.existsSync(destinationModele) && fs.statSync(destinationModele).size > 300000) {
    console.log('  deja present : public/ocr/fra.traineddata.gz');
    return;
  }

  try {
    console.log(`  telechargement du modele francais…`);
    const reponse = await fetch(URL_MODELE, { signal: AbortSignal.timeout(120000) });
    if (!reponse.ok) throw new Error(`reponse ${reponse.status}`);

    const donnees = Buffer.from(await reponse.arrayBuffer());
    if (donnees.length < 300000) throw new Error('fichier trop petit, probablement invalide');

    fs.writeFileSync(destinationModele, donnees);
    console.log(
      `  telecharge : public/ocr/fra.traineddata.gz (${formaterTaille(donnees.length)})`
    );
  } catch (probleme) {
    console.warn(
      `\n  ATTENTION : le modele de langue n'a pas pu etre telecharge (${probleme.message}).`
    );
    console.warn(
      '  L\'application fonctionnera normalement, mais le scanner de reçus'
    );
    console.warn(
      '  proposera uniquement la saisie manuelle. Relancez "npm run ocr" plus tard.\n'
    );
  }
}

main().then(() => {
  console.log('\n  moteur OCR pret.\n');
});
