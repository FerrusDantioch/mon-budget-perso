/*
 * FABRICATION D'IDENTIFIANTS UNIQUES
 *
 * Chaque depense et chaque categorie recoit un identifiant unique, qui permet
 * de la retrouver, la modifier ou la supprimer sans confusion.
 */

/**
 * Renvoie un identifiant unique, du style "9f1c2a4e-....".
 * On utilise la fonction native du navigateur quand elle existe (c'est le cas
 * sur tous les navigateurs recents en HTTPS), sinon on fabrique un identifiant
 * equivalent a partir de nombres aleatoires.
 */
export function nouvelIdentifiant() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Repli : 16 octets aleatoires ecrits au format UUID version 4.
  const octets = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(octets);
  } else {
    for (let i = 0; i < 16; i++) octets[i] = Math.floor(Math.random() * 256);
  }
  octets[6] = (octets[6] & 0x0f) | 0x40; // version 4
  octets[8] = (octets[8] & 0x3f) | 0x80; // variante standard

  const hex = [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
