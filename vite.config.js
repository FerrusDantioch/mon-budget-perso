// Configuration de Vite (l'outil qui transforme le code source en site web optimise).
// Vite fait deux choses : il lance un serveur local pendant le developpement (npm run dev)
// et il fabrique le dossier "dist" a publier en ligne (npm run build).

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// NOM DU DEPOT GITHUB — LA SEULE LIGNE A MODIFIER POUR LE DEPLOIEMENT
// ---------------------------------------------------------------------------
// Sur GitHub Pages, un site de projet est servi a l'adresse :
//     https://VOTRE-PSEUDO.github.io/NOM-DU-DEPOT/
// Le navigateur doit donc chercher les fichiers dans le sous-dossier /NOM-DU-DEPOT/.
// Si cette valeur est fausse, la page s'affichera blanche et les icones seront cassees.
// Remplacez "omni-budget" par le nom exact de votre depot GitHub (respectez les majuscules).
const NOM_DU_DEPOT = 'omni-budget';
const BASE = `/${NOM_DU_DEPOT}/`;

// ---------------------------------------------------------------------------
// Politique de securite du contenu (CSP)
// ---------------------------------------------------------------------------
// La CSP dit au navigateur : "n'autorise que ces sources de code/images/reseau".
// GitHub Pages ne permet pas d'ajouter des en-tetes HTTP personnalises : on passe
// donc par une balise <meta> inseree dans le HTML au moment du build.
//
// Note : on ne l'insere PAS pendant le developpement, car le serveur de Vite a besoin
// de scripts en ligne (rechargement a chaud) que la CSP bloquerait.
const REGLES_CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' autorise l'execution de WebAssembly : c'est ce qui
  // permet au moteur de reconnaissance de texte (Tesseract) de fonctionner.
  // Cela n'autorise PAS eval() ni les scripts en ligne.
  "script-src 'self' 'wasm-unsafe-eval'",
  // Recharts (les graphiques) applique des styles directement sur les elements SVG :
  // 'unsafe-inline' est donc necessaire pour le style, mais pas pour les scripts.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // 'self' suffit : l'application ne contacte aucun serveur externe.
  "connect-src 'self'",
  "manifest-src 'self'",
  // blob: est necessaire au moteur de reconnaissance de texte, qui cree
  // certains de ses fils d'execution a partir de donnees locales.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  // Remarque : "frame-ancestors" est volontairement absent. Cette regle est
  // ignoree lorsque la CSP passe par une balise <meta> (elle exige un vrai
  // en-tete HTTP, impossible sur GitHub Pages) et ne ferait qu'ajouter un
  // avertissement dans la console du navigateur.
  'upgrade-insecure-requests',
].join('; ');

/** Insere la balise CSP dans index.html, uniquement lors du build de production. */
function pluginCsp() {
  return {
    name: 'budget-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: REGLES_CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

/** Liste recursivement tous les fichiers d'un dossier (chemins relatifs, style "a/b.js"). */
function listerFichiers(dossier, prefixe = '') {
  const resultat = [];
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const relatif = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.isDirectory()) {
      resultat.push(...listerFichiers(path.join(dossier, entree.name), relatif));
    } else {
      resultat.push(relatif);
    }
  }
  return resultat;
}

/**
 * Complete le service worker apres le build.
 *
 * Le service worker doit connaitre la liste exacte des fichiers a mettre en cache
 * pour que l'application fonctionne hors-ligne. Or Vite ajoute une empreinte au nom
 * des fichiers (ex : index-a1b2c3d4.js) : cette liste ne peut donc etre connue
 * qu'une fois le build termine. Ce plugin remplace les deux marqueurs laisses
 * dans public/sw.js par les vraies valeurs.
 */
function pluginServiceWorker() {
  return {
    name: 'budget-service-worker',
    apply: 'build',
    closeBundle() {
      const dossierSortie = path.resolve('dist');
      const cheminSw = path.join(dossierSortie, 'sw.js');
      if (!fs.existsSync(cheminSw)) return;

      // Tout ce qui se trouve dans dist est mis en cache, sauf le service worker
      // lui-meme (il est gere separement par le navigateur) et les cartes de debug.
      // Le moteur de reconnaissance de texte (dossier ocr/) pese environ
      // 6 Mo : le precharger multiplierait par dix le temps d'installation,
      // pour une fonction que beaucoup n'utiliseront jamais. Il est donc mis
      // en cache seulement au premier scan, par la strategie "cache d'abord"
      // du service worker.
      // licences-tierces.txt (textes de licence des bibliotheques) ne sert pas
      // au fonctionnement : inutile de le telecharger a l'installation.
      const fichiers = listerFichiers(dossierSortie)
        .filter(
          (f) =>
            f !== 'sw.js' &&
            !f.endsWith('.map') &&
            !f.startsWith('ocr/') &&
            f !== 'licences-tierces.txt'
        )
        .sort();

      const aPrecharger = fichiers.map((f) => BASE + f);

      // Le numero de version du cache change des qu'un fichier change : c'est ce qui
      // declenche la mise a jour automatique de l'application chez les utilisateurs.
      const empreinte = crypto
        .createHash('sha256')
        .update(
          fichiers
            .map((f) => f + ':' + fs.statSync(path.join(dossierSortie, f)).size)
            .join('|')
        )
        .digest('hex')
        .slice(0, 12);

      const contenu = fs
        .readFileSync(cheminSw, 'utf8')
        .replace('"__VERSION_CACHE__"', JSON.stringify(empreinte))
        .replace('"__FICHIERS_A_PRECHARGER__"', JSON.stringify(aPrecharger, null, 2))
        .replace('"__BASE__"', JSON.stringify(BASE));

      fs.writeFileSync(cheminSw, contenu);
      console.log(
        `\n  [PWA] service worker pret : ${aPrecharger.length} fichiers en cache (version ${empreinte})\n`
      );
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), pluginCsp(), pluginServiceWorker()],

  build: {
    // "esnext" produirait du code trop recent pour certains telephones : on vise
    // large tout en gardant des fichiers legers.
    target: 'es2020',
    sourcemap: false,

    // On laisse Vite decouper le code automatiquement. Comme le graphique est
    // charge par import() (voir src/pages/TableauDeBord.jsx), la librairie
    // Recharts se retrouve seule dans un fichier separe, telecharge uniquement
    // au moment ou le tableau de bord s'affiche : le demarrage reste leger.
    // Le fichier depasse 500 ko, d'ou le reglage ci-dessous qui evite un
    // avertissement inutile pendant le build.
    chunkSizeWarningLimit: 700,
  },

  // Configuration des tests automatises (npm test).
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/preparation.js'],
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
