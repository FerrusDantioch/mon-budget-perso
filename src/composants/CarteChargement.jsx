/*
 * Bloc affiche pendant qu'un element se charge (par exemple le graphique,
 * telecharge seulement au moment ou l'on en a besoin).
 */

export function CarteChargement({ hauteur = 240, texte = 'Chargement…' }) {
  return (
    <div
      style={{
        height: hauteur,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--texte-doux)',
      }}
      role="status"
    >
      {texte}
    </div>
  );
}
