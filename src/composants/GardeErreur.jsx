/*
 * FILET DE SECURITE
 *
 * Si une erreur imprevue survient quelque part dans l'application, React
 * efface normalement tout l'ecran : l'utilisateur se retrouve devant une page
 * blanche, sans explication ni moyen de s'en sortir.
 *
 * Ce composant intercepte l'erreur et affiche un message clair avec un bouton
 * pour recharger. Les donnees, elles, restent intactes dans la base locale.
 *
 * C'est la seule classe de l'application : React n'offre pas encore
 * d'equivalent avec les fonctions.
 */

import { Component } from 'react';

export class GardeErreur extends Component {
  constructor(proprietes) {
    super(proprietes);
    this.state = { erreur: null };
  }

  /** Appelee automatiquement par React quand un composant enfant plante. */
  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, informations) {
    // Trace visible uniquement dans la console du navigateur : rien n'est
    // envoye sur Internet (aucune telemetrie).
    console.error('Erreur dans l’application :', erreur, informations);
  }

  render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <main className="contenu">
        <div className="carte">
          <h1>Une erreur est survenue</h1>
          <p>
            L’application a rencontré un problème inattendu. Vos dépenses sont
            toujours enregistrées sur cet appareil : elles n’ont pas été perdues.
          </p>
          <div className="rangee-boutons">
            <button
              type="button"
              className="bouton bouton-principal"
              onClick={() => window.location.reload()}
            >
              Recharger l’application
            </button>
          </div>
          <p className="champ-aide" style={{ marginTop: '0.9rem' }}>
            Détail technique : {String(this.state.erreur?.message ?? this.state.erreur)}
          </p>
        </div>
      </main>
    );
  }
}
