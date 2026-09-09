/*
 * FABRICATION DES ICONES DE L'APPLICATION  (commande : npm run icones)
 *
 * Une application installee sur un telephone a besoin d'icones au format PNG.
 * Plutot que de stocker des images toutes faites, ce script les dessine.
 * Avantage : aucune librairie exterieure a installer, et l'icone se regenere
 * en une seconde si on change de couleur.
 *
 * Le script ecrit les fichiers dans public/icones/.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// PALETTE — modifiez ces couleurs pour changer l'apparence de l'icone
// ---------------------------------------------------------------------------
const COULEUR_HAUT = [37, 99, 235]; // bleu (haut du degrade)
const COULEUR_BAS = [29, 78, 216]; // bleu plus fonce (bas du degrade)
const COULEUR_MOTIF = [255, 255, 255]; // les barres du graphique

// ===========================================================================
// PARTIE 1 — ECRIRE UN FICHIER PNG "a la main"
// ===========================================================================
// Un PNG est une suite de blocs. On a besoin de trois blocs seulement :
// IHDR (dimensions), IDAT (les pixels compresses) et IEND (fin du fichier).

/** Table de calcul du CRC32, une signature qui protege chaque bloc du PNG. */
const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fabrique un bloc PNG : longueur + type + donnees + signature. */
function bloc(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length, 0);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const signature = Buffer.alloc(4);
  signature.writeUInt32BE(crc32(corps), 0);
  return Buffer.concat([longueur, corps, signature]);
}

/** Transforme un tableau de pixels (rouge, vert, bleu, opacite) en fichier PNG. */
function encoderPng(largeur, hauteur, pixels) {
  // Le PNG attend un octet "filtre" (ici 0 = aucun filtre) devant chaque ligne.
  const brut = Buffer.alloc((largeur * 4 + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const debutLigne = y * (largeur * 4 + 1);
    brut[debutLigne] = 0;
    pixels.copy(brut, debutLigne + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }

  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // 8 bits par couleur
  entete[9] = 6; // type 6 = couleur + transparence
  entete[10] = 0; // compression standard
  entete[11] = 0; // filtre standard
  entete[12] = 0; // pas d'entrelacement

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // signature PNG
    bloc('IHDR', entete),
    bloc('IDAT', zlib.deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

// ===========================================================================
// PARTIE 2 — DESSINER L'ICONE
// ===========================================================================

/** Vrai si le point (x, y) est a l'interieur d'un rectangle aux coins arrondis. */
function dansRectangleArrondi(x, y, gauche, haut, droite, bas, rayon) {
  if (x < gauche || x > droite || y < haut || y > bas) return false;
  // On mesure la distance au coin le plus proche pour arrondir les angles.
  const dx = Math.max(gauche + rayon - x, 0, x - (droite - rayon));
  const dy = Math.max(haut + rayon - y, 0, y - (bas - rayon));
  return dx * dx + dy * dy <= rayon * rayon;
}

/**
 * Dessine l'icone.
 * @param {number} taille     largeur = hauteur, en pixels
 * @param {boolean} maskable  vrai pour les icones Android "adaptatives" :
 *   le systeme peut les rogner en cercle, donc le fond remplit tout le carre
 *   et le motif reste bien au centre.
 */
function dessinerIcone(taille, maskable) {
  // On dessine 4 fois plus grand puis on reduit : cela lisse les bords
  // (sinon les coins arrondis seraient en escalier).
  const echelle = 4;
  const grand = taille * echelle;
  const pixels = Buffer.alloc(taille * taille * 4);

  // Geometrie, exprimee en proportion de la taille totale.
  const rayonFond = maskable ? 0 : 0.225;
  const tailleMotif = maskable ? 0.5 : 0.58;
  const debutMotif = (1 - tailleMotif) / 2;

  // Trois barres de hauteurs croissantes (un mini graphique).
  const barres = [
    { x: 0.0, hauteur: 0.45 },
    { x: 0.38, hauteur: 0.72 },
    { x: 0.76, hauteur: 1.0 },
  ];
  const largeurBarre = 0.24;
  const rayonBarre = 0.09;

  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      let r = 0;
      let v = 0;
      let b = 0;
      let nbColores = 0;

      // On teste "echelle x echelle" sous-points par pixel, puis on fait la moyenne.
      for (let sy = 0; sy < echelle; sy++) {
        for (let sx = 0; sx < echelle; sx++) {
          const px = (x * echelle + sx + 0.5) / grand; // position 0..1
          const py = (y * echelle + sy + 0.5) / grand;

          const dansFond = maskable
            ? true
            : dansRectangleArrondi(px, py, 0, 0, 1, 1, rayonFond);
          if (!dansFond) continue;

          // Couleur du fond : degrade vertical du haut vers le bas.
          let couleur = [
            COULEUR_HAUT[0] + (COULEUR_BAS[0] - COULEUR_HAUT[0]) * py,
            COULEUR_HAUT[1] + (COULEUR_BAS[1] - COULEUR_HAUT[1]) * py,
            COULEUR_HAUT[2] + (COULEUR_BAS[2] - COULEUR_HAUT[2]) * py,
          ];

          // Coordonnees du point dans le repere du motif (0..1).
          const mx = (px - debutMotif) / tailleMotif;
          const my = (py - debutMotif) / tailleMotif;
          if (mx >= 0 && mx <= 1 && my >= 0 && my <= 1) {
            for (const barre of barres) {
              const dedans = dansRectangleArrondi(
                mx,
                my,
                barre.x,
                1 - barre.hauteur,
                barre.x + largeurBarre,
                1,
                rayonBarre
              );
              if (dedans) {
                couleur = COULEUR_MOTIF;
                break;
              }
            }
          }

          r += couleur[0];
          v += couleur[1];
          b += couleur[2];
          nbColores++;
        }
      }

      const nbSousPoints = echelle * echelle;
      const i = (y * taille + x) * 4;
      if (nbColores > 0) {
        // Moyenne des couleurs des sous-points reellement dessines.
        pixels[i] = Math.round(r / nbColores);
        pixels[i + 1] = Math.round(v / nbColores);
        pixels[i + 2] = Math.round(b / nbColores);
        // Opacite : proportion du pixel reellement couverte par le dessin.
        pixels[i + 3] = Math.round((nbColores / nbSousPoints) * 255);
      }
    }
  }

  return encoderPng(taille, taille, pixels);
}

// ===========================================================================
// PARTIE 3 — ECRIRE LES FICHIERS
// ===========================================================================

const dossier = path.resolve('public/icones');
fs.mkdirSync(dossier, { recursive: true });

const aFabriquer = [
  { fichier: 'icone-32.png', taille: 32, maskable: false },
  { fichier: 'icone-180.png', taille: 180, maskable: false }, // iOS
  { fichier: 'icone-192.png', taille: 192, maskable: false },
  { fichier: 'icone-512.png', taille: 512, maskable: false },
  { fichier: 'icone-maskable-192.png', taille: 192, maskable: true }, // Android
  { fichier: 'icone-maskable-512.png', taille: 512, maskable: true },
];

for (const { fichier, taille, maskable } of aFabriquer) {
  const contenu = dessinerIcone(taille, maskable);
  fs.writeFileSync(path.join(dossier, fichier), contenu);
  console.log(`  icone creee : public/icones/${fichier} (${taille}x${taille}px)`);
}

console.log(`\n  ${aFabriquer.length} icones pretes.\n`);
