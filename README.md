# Budget — mes dépenses

Application de gestion de budget personnel qui fonctionne **entièrement sur votre
appareil**, hors-ligne, et dont **toutes les données sont chiffrées**. Aucun
compte, aucun serveur, aucune publicité, aucun mouchard.

**Les six phases du projet sont livrées.**

---

## 1. Ce que fait l'application

### Budget et dépenses
- Plafond mensuel par catégorie ; catégories personnalisables (nom, icône, couleur).
- Dépenses **et revenus** : ajout, modification, suppression, recherche, filtre.
- Chaque mois conserve les plafonds définis à l'époque : l'historique reste juste.

### Tableau de bord
- Total du mois, budget restant, montant encore disponible par jour.
- Graphique circulaire de répartition + une barre par catégorie :
  vert → **orange à 80 %** → **rouge à 95 %** → rouge foncé au-delà de 100 %.
- Le niveau est toujours écrit en toutes lettres à côté de la barre : la couleur
  n'est jamais la seule information.

### Sécurité
- **Code PIN de 4 à 6 chiffres**, obligatoire à chaque lancement.
- **Chiffrement AES-256-GCM** de tout le contenu de la base, clé dérivée par
  **PBKDF2-SHA256, 310 000 itérations**.
- **Biométrie** (empreinte, visage, Windows Hello) via WebAuthn — en option, avec
  le code PIN toujours utilisable en repli.
- **Verrouillage automatique** après 2 minutes d'inactivité.
- **Blocage de 5 minutes** après 3 codes erronés, compteur conservé même si
  l'application est fermée.
- **Phrase de récupération de 12 mots** (liste BIP39 standard) en cas d'oubli.

### Dépenses récurrentes
- Loyer, abonnements, salaire… Fréquences : chaque semaine, **deux fois par
  mois**, chaque mois, chaque année.
- **Aperçu de l'effet sur le budget avant de valider.**
- Suspension temporaire sans perdre la configuration.
- Rattrapage automatique des échéances manquées, sans jamais créer de doublon.
- Rappel 2 jours avant un prélèvement (voir la limite honnête au § 6).

### Sauvegarde
- Export **chiffré** par un mot de passe maître que vous choisissez.
- Import impossible sans ce mot de passe, avec aperçu du contenu avant de
  remplacer quoi que ce soit.
- Export **CSV** pour tableur, clairement signalé comme **non chiffré**.

### Scanner de reçus
- Photo ou import depuis la galerie, image compressée puis chiffrée.
- Reconnaissance de texte **locale** (Tesseract), chargée uniquement à l'usage.
- Montant, date et commerçant pré-remplis, avec un **indice de confiance**, et
  une **correction manuelle obligatoire** avant enregistrement.
- Historique des reçus, rattachés à leur dépense.

### Écran d'accueil
- Installable (PWA), fonctionne en mode avion dès l'installation.
- **Pastille** sur l'icône avec le pourcentage de budget consommé.
- **Raccourcis** par appui long : « Ajouter une dépense », « Scanner un reçu ».

### Qualité
- Accessibilité WCAG 2.1 AA : clavier, contrastes, cibles tactiles de 44 px,
  lecteurs d'écran, respect de « animations réduites ».
- Premier chargement : **environ 87 ko compressés** (HTML + CSS + JavaScript).
- **179 tests automatisés**.

---

## 2. Installer et lancer le projet

### Prérequis

Un seul outil : **Node.js version 20.19 ou plus récente**. Pour vérifier :

```bash
node --version
```

Si la commande échoue, téléchargez Node.js sur <https://nodejs.org> (version
« LTS »), installez-le, puis fermez et rouvrez le terminal.

### Les commandes

```bash
npm install
```

Télécharge les librairies utilisées (React, Recharts, idb, Tesseract). À lancer
une seule fois.

```bash
npm run preparer
```

Fabrique les icônes **et** installe le moteur de reconnaissance de texte dans
`public/ocr/` (environ 6 Mo, dont un dictionnaire français téléchargé une fois).
À relancer après chaque `npm install`.

> Si le téléchargement du dictionnaire échoue (pas de connexion), la
> construction se poursuit : le scanner proposera simplement la saisie manuelle.

```bash
npm run dev
```

Aperçu pendant le développement, à l'adresse affichée **suivie de `/Budget/`** —
par exemple <http://localhost:5173/Budget/>.

```bash
npm test
```

Lance les 179 tests automatisés. **Tout doit être vert avant de publier.**

```bash
npm run build      # fabrique le dossier dist/
npm run preview    # affiche la version finale, mode hors-ligne actif
```

---

## 3. Publier sur GitHub Pages, étape par étape

### Étape 1 — Vérifier le nom du dépôt

Ouvrez `vite.config.js`. Tout en haut se trouve **la seule ligne à adapter** :

```js
const NOM_DU_DEPOT = 'Budget';
```

Remplacez `Budget` par le nom exact de votre dépôt GitHub, majuscules comprises.

> **Pourquoi c'est important** : sur GitHub Pages, le site est servi à l'adresse
> `https://votre-pseudo.github.io/NOM-DU-DEPOT/`. Si ce nom est faux, la page
> restera blanche et les icônes seront introuvables.

### Étape 2 — Envoyer le code sur GitHub

```bash
git add .
git commit -m "Application budget complète"
git push
```

### Étape 3 — Activer GitHub Pages (une seule fois)

1. Sur GitHub, ouvrez votre dépôt.
2. Onglet **Settings** (Paramètres) → menu de gauche **Pages**.
3. À la ligne **Source**, choisissez **GitHub Actions** (et non « Deploy from a
   branch »).

### Étape 4 — Attendre la publication

`.github/workflows/deploiement.yml` fait tout le reste : installation, icônes,
moteur OCR, tests, construction, mise en ligne. Suivez l'avancement dans
l'onglet **Actions**. Comptez 3 à 4 minutes.

Votre application est alors à l'adresse :

```
https://VOTRE-PSEUDO.github.io/NOM-DU-DEPOT/
```

> Si un test échoue, la publication est **volontairement bloquée** : cela évite
> de mettre en ligne une version qui calcule mal un budget.

### Étape 5 — Installer sur le téléphone

1. Ouvrez l'adresse ci-dessus dans **Chrome** sur Android.
2. Menu **⋮** → **Installer l'application**.
3. L'icône apparaît sur l'écran d'accueil.

Sur iPhone : bouton **Partager** → **Sur l'écran d'accueil**.

> ⚠️ **HTTPS est indispensable** pour la biométrie et le mode hors-ligne.
> GitHub Pages fournit HTTPS automatiquement — rien à faire.

---

## 4. Vérifier que tout marche sur le téléphone

Procédure de test complète, sans terme technique.

### A. Premier lancement et code

1. Ouvrez l'application. Un écran **« Protégez vos données »** apparaît.
2. Appuyez sur **Choisir mon code**, tapez un code à **6 chiffres**, puis
   retapez-le. L'application s'ouvre.
3. Vérifiez le refus des codes trop simples : recommencez avec `123456`, un
   message doit l'interdire.

### B. Dépenses

4. Bouton bleu **+** → montant `12,50`, catégorie « Alimentation » →
   **Ajouter la dépense**. Le total passe à 12,50 €.
5. Ajoutez 400 € en Alimentation : la barre devient rouge et affiche
   **« Budget dépassé »**.
6. Ajoutez une ligne en choisissant **Revenu** : elle s'affiche en vert avec un
   « + » et n'entre dans aucun plafond.
7. Onglet **Dépenses** → appuyez sur une ligne, changez le montant, enregistrez.
   Puis rouvrez-la et supprimez-la.

### C. Récurrences

8. Onglet **Dépenses** → bouton **🔁 Récurrentes** → **+ Ajouter**.
9. Nom « Loyer », 700 €, catégorie Logement, chaque mois le 5, première
   échéance **le mois dernier**.
10. Avant de valider, vérifiez l'encadré **« Effet sur … »** : il annonce le
    nombre d'échéances et le pourcentage de la catégorie après ajout.
11. Validez. Les échéances passées apparaissent dans l'historique, et un bandeau
    signale les lignes créées automatiquement.
12. Appuyez sur **⏸️** : la récurrence est suspendue sans être perdue.

### D. Reçus

13. Onglet **Dépenses** → **📷 Reçus** → **Scanner** → **Prendre une photo**.
14. Photographiez un ticket de caisse bien à plat, sous une bonne lumière.
15. La première lecture télécharge le moteur (≈ 3,5 Mo) : comptez 20 à 40
    secondes. Les suivantes sont immédiates.
16. **Vérifiez et corrigez** le montant, la date et le commerçant, choisissez une
    catégorie, puis enregistrez.

> L'OCR se trompe régulièrement : c'est normal et prévu. L'étape de correction
> ne peut pas être sautée.

### E. Sauvegarde

17. **Réglages** → **Sauvegarde**. Saisissez deux fois un mot de passe, cochez la
    case d'avertissement, puis **Télécharger la sauvegarde chiffrée**.
18. **Notez ce mot de passe sur papier.** Sans lui, le fichier est perdu.
19. Dans « Restaurer », choisissez le fichier et tapez un **mauvais** mot de
    passe : un message d'erreur doit apparaître, sans rien modifier.
20. Retapez le bon : un résumé du contenu s'affiche avant tout remplacement.

### F. Sécurité

21. **Réglages** → **Sécurité** → **Créer ma phrase de récupération**.
    Recopiez les 12 mots **sur papier**, puis confirmez les mots demandés.
22. **Activer la biométrie** : si votre téléphone le permet, un déverrouillage
    par empreinte est proposé au lancement suivant. Sinon un message l'explique —
    le code continue de fonctionner.
23. Verrouillez avec le cadenas 🔒 en haut, puis **Code oublié ?** → saisissez
    vos 12 mots : l'application se rouvre.
24. **Test du blocage** : tapez 3 fois un mauvais code. Un compte à rebours de
    5 minutes doit apparaître. Fermez et rouvrez l'application : le blocage doit
    tenir.
25. **Test du verrouillage automatique** : laissez l'application ouverte sans y
    toucher pendant 2 minutes, ou passez sur une autre application 2 minutes.
    Au retour, le code doit être redemandé.

### G. Le test décisif — le mode avion

26. Fermez complètement l'application.
27. Activez le **mode avion** du téléphone.
28. Rouvrez l'application depuis l'écran d'accueil.

Elle doit s'ouvrir normalement, demander le code, et afficher toutes vos
dépenses. En haut, la pastille indique **« Hors-ligne »** en orange. Ajoutez une
dépense : elle doit s'enregistrer sans problème.

> Si cette étape échoue, rouvrez l'application une fois **avec** connexion,
> attendez une dizaine de secondes, puis recommencez : la mise en cache n'était
> pas terminée.

### H. Finitions

29. **Appui long sur l'icône** de l'écran d'accueil : les raccourcis
    « Ajouter une dépense » et « Scanner un reçu » doivent apparaître.
30. **Réglages** → cochez la pastille sur l'icône : un nombre apparaît sur
    l'icône de l'application (Android ; pas sur iPhone).
31. Icône 🌗 en haut à droite : thème automatique → clair → sombre.
32. Tournez le téléphone : rien ne doit être coupé ni déborder.

---

## 5. Structure du projet

```
Budget/
├── .github/workflows/deploiement.yml   Publication automatique
├── public/
│   ├── icones/                Icônes générées (npm run icones)
│   ├── ocr/                   Moteur Tesseract (npm run ocr)
│   ├── manifest.webmanifest   Carte d'identité + raccourcis
│   └── sw.js                  Service worker : mode hors-ligne
├── scripts/
│   ├── generer-icones.mjs     Dessine les PNG sans aucune librairie
│   └── preparer-ocr.mjs       Installe le moteur de reconnaissance
├── src/
│   ├── securite/
│   │   ├── crypto.js          AES-256-GCM, PBKDF2, HKDF (Web Crypto natif)
│   │   ├── coffre.js          LA pièce centrale : la clé et ses 3 protections
│   │   ├── biometrie.js       WebAuthn avec l'extension PRF
│   │   ├── bip39.js           Phrase de récupération de 12 mots
│   │   └── motsBip39.js       Les 2048 mots de la norme (fichier généré)
│   ├── donnees/
│   │   ├── connexion.js       Ouverture d'IndexedDB et structure
│   │   ├── basededonnees.js   TOUS les accès aux données passent par ici
│   │   ├── generationRecurrences.js   Échéances automatiques
│   │   ├── sauvegarde.js      Export/import chiffré et CSV
│   │   ├── migration.js       Reprise des données de la version 1
│   │   └── reinitialisation.js
│   ├── ocr/
│   │   ├── moteurOcr.js       Chargement différé de Tesseract
│   │   ├── extraction.js      Lecture du montant, de la date, du commerçant
│   │   └── image.js           Compression des photos
│   ├── contexte/              Thème, coffre, budget (état partagé)
│   ├── composants/            Éléments d'interface réutilisables
│   ├── pages/                 Les neuf écrans
│   ├── hooks/                 Connexion, routeur, notifications, badge…
│   ├── utils/                 Calculs, dates, monnaie (tout est testé)
│   ├── styles/                base.css, composants.css, securite.css
│   ├── App.jsx                Assemblage
│   └── main.jsx               Point de départ
├── tests/                     179 tests automatisés
├── index.html
├── package.json
└── vite.config.js             Configuration + CSP + service worker
```

---

## 6. Choix techniques, et leurs limites assumées

### Comment le chiffrement est organisé

Une seule clé chiffre réellement les données : la **clé du coffre**, tirée au
hasard. On en garde jusqu'à trois copies, chacune enfermée derrière un moyen
différent :

```
  code PIN     ──PBKDF2──▶ clé A ──chiffre──▶ [copie 1 de la clé du coffre]
  biométrie    ──HKDF────▶ clé B ──chiffre──▶ [copie 2 de la clé du coffre]
  12 mots      ──HKDF────▶ clé C ──chiffre──▶ [copie 3 de la clé du coffre]
```

Conséquences : changer de code ne rechiffre que 32 octets au lieu de toutes vos
dépenses ; oublier le code n'est pas fatal si la phrase existe ; désactiver la
biométrie n'efface que la copie 2.

**Limite honnête.** Un code à 4 chiffres n'offre que 10 000 possibilités.
Quelqu'un qui copierait la base sur un ordinateur puissant finirait par les
essayer toutes. Les 310 000 répétitions de PBKDF2 ralentissent énormément cette
recherche, et le blocage de 5 minutes la rend impossible depuis l'application —
mais le code protège surtout contre quelqu'un qui prend le téléphone en main.
**Un code à 6 chiffres est nettement plus solide.**

### La biométrie n'est pas un simple portail

WebAuthn répond normalement « oui, c'est la bonne personne ». S'en contenter
obligerait à garder la clé en clair quelque part : n'importe qui pourrait la
récupérer sans jamais poser le doigt sur le capteur. L'application exige donc
l'extension **PRF**, qui fait fabriquer un secret par la puce sécurisée du
téléphone. **Si l'appareil ne la gère pas, la biométrie n'est pas proposée** —
plutôt que de faire semblant.

### Pourquoi il n'y a pas de vrai widget d'écran d'accueil

Un widget qui affiche des chiffres et se met à jour tout seul est une fonction du
système (AppWidgetProvider sur Android, WidgetKit sur iOS). **Aucune application
web n'y a accès**, quelle que soit la technique employée. Il faudrait empaqueter
le projet en application native (Capacitor + Trusted Web Activity), ce qui sort
du cadre. La **pastille sur l'icône** et les **raccourcis par appui long** sont
ce qu'une application web peut faire de plus proche.

### Pourquoi les rappels ne sont pas de vraies notifications programmées

Une notification qui arrive alors que l'application n'a pas été ouverte depuis
huit jours exige un serveur qui l'envoie. Ce projet n'a volontairement aucun
serveur : ce serait le seul moyen de faire sortir vos données de l'appareil. Les
rappels sont donc vérifiés **à l'ouverture de l'application**. C'est un compromis
assumé en faveur de la confidentialité, et l'interface le dit.

### Les montants sont stockés en centimes

`0.1 + 0.2` ne donne pas exactement `0.3` en informatique. Additionner des
montants à virgule finirait par fausser les totaux. Tout est donc stocké en
nombres entiers de centimes ; la virgule n'apparaît qu'à l'affichage.

### Pourquoi les données sont déchiffrées en mémoire

Comme tout est chiffré, la base ne peut plus répondre à « donne-moi les dépenses
de mars » : elle ne sait pas lire ce qu'elle stocke. L'ensemble est donc
déchiffré une fois à l'ouverture du coffre et gardé en mémoire — quelques
centaines de kilo-octets — puis **effacé au verrouillage**. En échange, ni la
date, ni le montant, ni la catégorie d'une dépense n'apparaissent dans la base.

### Le moteur OCR n'est pas préchargé

Tesseract pèse 6 Mo. Le précharger multiplierait par dix la durée
d'installation, pour une fonction que beaucoup n'utiliseront jamais. Il est mis
en cache seulement au premier scan, puis reste disponible hors-ligne.

### Navigation avec un dièse

GitHub Pages ne sait pas rediriger une adresse inconnue vers la page d'accueil.
Avec `#/depenses`, le serveur ne voit jamais que la page d'accueil : aucune
erreur 404 possible, et le bouton « retour » d'Android fonctionne.

### La CSP est dans une balise `<meta>`

GitHub Pages ne permet pas d'ajouter d'en-têtes HTTP personnalisés. La règle
`script-src` autorise `'wasm-unsafe-eval'` — nécessaire au moteur OCR — mais ni
`eval()` ni les scripts en ligne.

---

## 7. Confidentialité

- Aucune requête vers un serveur tiers, aucun compte, aucune analyse d'audience,
  aucun cookie de suivi.
- Tout est chiffré dans le navigateur de l'appareil (IndexedDB).
- Seules exceptions volontairement en clair, car nécessaires **avant** le
  déverrouillage : la configuration du verrouillage (où la clé figure justement
  sous forme chiffrée) et deux préférences d'affichage (thème, devise).
- Désinstaller l'application ou effacer les données du navigateur supprime tout
  définitivement. **Faites une sauvegarde chiffrée.**

---

## 8. Ce qui a été livré, phase par phase

| Phase | Contenu | État |
|-------|---------|------|
| 1 | Budgets, dépenses, tableau de bord, historique, PWA hors-ligne | ✅ |
| 2 | Code PIN, biométrie WebAuthn, verrouillage auto, blocage, chiffrement d'IndexedDB | ✅ |
| 3 | Dépenses récurrentes, aperçu d'impact, suspension, rappels | ✅ |
| 4 | Export/import chiffré, phrase BIP39, export CSV signalé non chiffré | ✅ |
| 5 | Scanner de reçus, OCR local différé, correction obligatoire, historique | ✅ |
| 6 | Badging API, raccourcis du manifest, limites du widget documentées | ✅ |

---

## Licence

Distribué sous licence **[PolyForm Noncommercial 1.0.0](LICENSE)** (texte
officiel en anglais, suivi d'une traduction française à titre indicatif).

Vous pouvez utiliser, modifier et partager ce code librement, à condition que
ce ne soit pas dans un but commercial et que le fichier de licence accompagne
toujours le code. Toute utilisation commerciale nécessite l'accord de
l'auteur. Le logiciel est fourni « en l'état », sans aucune garantie.

Les bibliothèques tierces utilisées par ce projet (voir `package.json`)
restent soumises à leurs propres licences.

© 2026 FerrusDantioch
