/*
 * CATEGORIES PROPOSEES AU PREMIER DEMARRAGE
 *
 * Elles servent uniquement de point de depart : l'utilisateur peut les
 * renommer, changer leur couleur, en ajouter ou les supprimer.
 *
 * Les couleurs ont ete choisies pour rester lisibles en theme clair ET sombre,
 * et pour se distinguer les unes des autres (y compris pour les personnes
 * daltoniennes : on ne s'appuie jamais sur la couleur seule dans l'interface).
 */

export const CATEGORIES_PAR_DEFAUT = [
  { nom: 'Alimentation', couleur: '#2563eb', emoji: '🛒', plafondCentimes: 40000 },
  { nom: 'Transport', couleur: '#0891b2', emoji: '🚌', plafondCentimes: 10000 },
  { nom: 'Logement', couleur: '#7c3aed', emoji: '🏠', plafondCentimes: 70000 },
  { nom: 'Factures', couleur: '#c2410c', emoji: '📄', plafondCentimes: 15000 },
  { nom: 'Santé', couleur: '#059669', emoji: '💊', plafondCentimes: 5000 },
  { nom: 'Loisirs', couleur: '#db2777', emoji: '🎬', plafondCentimes: 12000 },
  { nom: 'Divers', couleur: '#64748b', emoji: '📦', plafondCentimes: 5000 },
];

/**
 * Palette proposee quand l'utilisateur cree ou modifie une categorie.
 * Toutes ces couleurs offrent un contraste suffisant avec du texte blanc.
 */
export const PALETTE_COULEURS = [
  '#2563eb', // bleu
  '#0891b2', // cyan
  '#059669', // vert
  '#65a30d', // vert olive
  '#ca8a04', // jaune fonce
  '#ea580c', // orange
  '#dc2626', // rouge
  '#db2777', // rose
  '#7c3aed', // violet
  '#4f46e5', // indigo
  '#0f766e', // turquoise
  '#64748b', // gris
];

/** Quelques emojis pratiques, proposes dans le formulaire de categorie. */
export const EMOJIS_SUGGERES = [
  '🛒', '🍽️', '🚌', '⛽', '🏠', '💡', '📄', '💊', '🎬', '🎮',
  '👕', '✈️', '📚', '🐾', '🎁', '💇', '🏋️', '☕', '📱', '📦',
];
