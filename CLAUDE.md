# Mon Budget Perso — notes pour Claude

PWA de gestion de budget en **React + Vite**. Contrairement aux autres PWA de
l'utilisateur, ce projet passe par une **étape de compilation** : les sources
ne s'exécutent pas telles quelles.

```bash
npm install
npm run dev      # développement
npm run build    # produit dist/
npm test         # vitest
```

## Version du service worker : automatique, ne rien incrémenter à la main

Le service worker source est `public/sw.js`. Il contient trois marqueurs
(`"__VERSION_CACHE__"`, `"__FICHIERS_A_PRECHARGER__"`, `"__BASE__"`) **remplacés
au moment du build** par le greffon `budget-service-worker` défini dans
`vite.config.js`. La version est une empreinte SHA-256 des fichiers de `dist`,
donc elle change d'elle-même dès qu'un fichier change. **Ne jamais modifier ces
marqueurs à la main.**

Nuance utile : l'empreinte est calculée sur les **noms et tailles** des fichiers,
pas sur leur contenu. Vite ajoutant un hachage au nom des fichiers compilés, un
changement de code produit toujours un nouveau nom, donc une nouvelle empreinte.
Mais une retouche d'un fichier de `public/` qui conserverait **exactement la même
taille en octets** passerait inaperçue. Dans ce cas rare, forcer le changement
(un espace en plus, par exemple) ou vérifier après déploiement.

## Chemin de base figé

`vite.config.js` fixe en dur :

```js
const NOM_DU_DEPOT = 'mon-budget-perso';
const BASE = `/${NOM_DU_DEPOT}/`;
```

C'est nécessaire parce que GitHub Pages sert le site depuis un sous-dossier. En
conséquence, **une copie compilée ne fonctionne pas ailleurs qu'à cette adresse**
(ni à la racine d'un serveur local, ni depuis un dossier quelconque). Pour
produire une version utilisable ailleurs, il faut adapter cette valeur — et
vérifier que la balise CSP injectée au build reste cohérente.

## À savoir

- Le moteur de reconnaissance de texte (`ocr/`, ~6 Mo) est **volontairement
  exclu du préchargement** : il n'est mis en cache qu'au premier scan.
- Déploiement automatique par GitHub Actions
  (`.github/workflows/deploiement.yml`) à chaque envoi sur `main` →
  https://ferrusdantioch.github.io/mon-budget-perso/
- Code et commentaires en français, rédigés pour un développeur débutant :
  conserver ce niveau d'explication.

## Champ `id` du manifeste : nom du dossier, jamais `./`

`public/manifest.webmanifest` contient `"id": "/mon-budget-perso/"`. Chrome résout `id` par rapport à
la **racine du domaine** (`https://ferrusdantioch.github.io/`), pas par
rapport au dossier de l'application : `"id": "./"` (ou `"."`) donnait donc
l'identité de la racine du site, la même pour toutes les applications qui
l'utilisaient. C'est une exception voulue à la règle des chemins relatifs.

Ne plus changer cette valeur : pour Chrome, une application déjà installée
dont l'`id` change devient une autre application (il faut la désinstaller
puis la réinstaller pour qu'elle reprenne les mises à jour).

## ⚠️ Plusieurs applications sur `ferrusdantioch.github.io` : limite de Chrome Android

Toutes les applications du portfolio partagent la même adresse d'origine
(`ferrusdantioch.github.io`). Constaté en octobre 2026 sur le téléphone de
l'utilisateur : **Chrome Android n'accepte d'installer qu'une seule de ces
applications**. Dès qu'une est installée, les autres affichent « Cette appli
est déjà installée », même avec des `id` et des `scope` tous différents
(corriger l'`id`, ci-dessus, n'a pas suffi). **Brave installe toutes les
applications sans problème** : ce n'est pas un défaut des applications.

Contournements : installer depuis Brave, ou choisir « Créer un raccourci »
dans Chrome (l'application s'ouvre alors dans un onglet Chrome). Solution
durable si l'application doit être distribuée : une adresse (origine)
distincte par application (Cloudflare Pages, Netlify, sous-domaine d'un nom
de domaine, organisation GitHub…). À savoir aussi : une même origine
signifie stockage (IndexedDB, localStorage) et autorisations (micro,
notifications) partagés entre toutes ces applications.
