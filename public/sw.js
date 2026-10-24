/*
 * SERVICE WORKER — le "gardien hors-ligne" de l'application.
 *
 * Un service worker est un petit programme que le navigateur garde en memoire,
 * meme quand l'application est fermee. Il se place entre l'application et le
 * reseau : quand une page ou une image est demandee, c'est lui qui repond.
 *
 * Grace a lui, l'application fonctionne sans connexion Internet : tous les
 * fichiers ont ete copies dans une "armoire" locale (le cache) au moment de
 * l'installation.
 *
 * ATTENTION : les trois valeurs ci-dessous entre guillemets sont des marqueurs.
 * Elles sont remplacees automatiquement par les vraies valeurs pendant
 * "npm run build" (voir vite.config.js). Ne les modifiez pas a la main.
 */

const VERSION_CACHE = "__VERSION_CACHE__";
const FICHIERS_A_PRECHARGER = "__FICHIERS_A_PRECHARGER__";
const BASE = "__BASE__";

// Nom de l'armoire de stockage. Il change a chaque nouvelle version de
// l'application, ce qui permet de faire le menage automatiquement.
const NOM_DU_CACHE = `omni-budget-${VERSION_CACHE}`;

// La page d'accueil : c'est elle qu'on renvoie pour toute navigation.
const PAGE_ACCUEIL = `${BASE}index.html`;

// ---------------------------------------------------------------------------
// 1. INSTALLATION — on copie tous les fichiers dans le cache
// ---------------------------------------------------------------------------
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    (async () => {
      const cache = await caches.open(NOM_DU_CACHE);
      // addAll telecharge tous les fichiers d'un coup et les range dans le cache.
      // { cache: 'reload' } oblige a les reprendre sur le serveur, sans passer
      // par le petit cache du navigateur (GitHub Pages le garde 10 minutes).
      // C'est surtout vital pour index.html, dont le nom ne change jamais :
      // une ancienne copie pointerait vers des fichiers .js qui n'existent
      // plus sur le serveur, et l'application s'ouvrirait sur une page blanche.
      await cache.addAll(
        FICHIERS_A_PRECHARGER.map((fichier) => new Request(fichier, { cache: 'reload' }))
      );
    })()
  );
});

// ---------------------------------------------------------------------------
// 2. ACTIVATION — on supprime les anciennes versions du cache
// ---------------------------------------------------------------------------
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms
          // « budget- » : début du nom des caches quand l'application s'appelait « Budget ».
          .filter((nom) => (nom.startsWith('omni-budget-') || nom.startsWith('budget-')) && nom !== NOM_DU_CACHE)
          .map((nom) => caches.delete(nom))
      );
      // On prend le controle des onglets deja ouverts, sans attendre un rechargement.
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// 3. INTERCEPTION DES REQUETES — strategie "cache d'abord"
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;

  // On ne s'occupe que des lectures (GET) provenant de notre propre site.
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // Cas 1 : l'utilisateur ouvre ou recharge l'application.
  // On renvoie toujours la page d'accueil stockee dans le cache : l'application
  // demarre donc instantanement, meme en mode avion.
  if (requete.mode === 'navigate') {
    evenement.respondWith(
      (async () => {
        const cache = await caches.open(NOM_DU_CACHE);
        const enCache = await cache.match(PAGE_ACCUEIL);
        if (enCache) return enCache;
        try {
          return await fetch(requete);
        } catch (erreur) {
          // Vraiment aucun recours : on affiche un message minimal.
          return new Response(
            '<h1>Application indisponible</h1><p>Reconnectez-vous une fois pour terminer l\u2019installation.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          );
        }
      })()
    );
    return;
  }

  // Cas 2 : un fichier (script, style, image, police...).
  // On regarde d'abord dans le cache ; si absent, on va le chercher sur le
  // reseau et on en garde une copie pour la prochaine fois.
  evenement.respondWith(
    (async () => {
      const cache = await caches.open(NOM_DU_CACHE);
      const enCache = await cache.match(requete);
      if (enCache) return enCache;

      try {
        const reponse = await fetch(requete);
        // On ne met en cache que les reponses valides de notre site.
        if (reponse && reponse.status === 200 && reponse.type === 'basic') {
          cache.put(requete, reponse.clone());
        }
        return reponse;
      } catch (erreur) {
        // Hors-ligne et fichier inconnu : on echoue proprement.
        return new Response('', { status: 504, statusText: 'Hors-ligne' });
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// 4. MISE A JOUR IMMEDIATE
// ---------------------------------------------------------------------------
// Quand l'utilisateur appuie sur "Mettre a jour" dans l'application, celle-ci
// envoie ce message : le nouveau service worker prend alors la main tout de suite.
self.addEventListener('message', (evenement) => {
  if (evenement.data === 'PASSER_EN_ACTIF') {
    self.skipWaiting();
  }
});
