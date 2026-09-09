/*
 * INSTALLATION SUR L'ECRAN D'ACCUEIL
 *
 * Sur Android (Chrome/Edge), le navigateur previent l'application quand elle
 * peut etre installee : on peut alors afficher notre propre bouton.
 * Sur iPhone (Safari), cet evenement n'existe pas : il faut expliquer la
 * manipulation a la main ("Partager" puis "Sur l'ecran d'accueil").
 */

import { useEffect, useState } from 'react';

export function useInstallation() {
  const [propositionInstallation, definirProposition] = useState(null);
  const [dejaInstallee, definirDejaInstallee] = useState(false);

  useEffect(() => {
    // L'application tourne-t-elle deja en mode "installe" ?
    const verifier = () =>
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    definirDejaInstallee(Boolean(verifier()));

    const surProposition = (evenement) => {
      // On empeche la banniere automatique du navigateur pour proposer
      // l'installation au moment choisi par l'utilisateur.
      evenement.preventDefault();
      definirProposition(evenement);
    };
    const surInstallation = () => {
      definirDejaInstallee(true);
      definirProposition(null);
    };

    window.addEventListener('beforeinstallprompt', surProposition);
    window.addEventListener('appinstalled', surInstallation);
    return () => {
      window.removeEventListener('beforeinstallprompt', surProposition);
      window.removeEventListener('appinstalled', surInstallation);
    };
  }, []);

  /** Ouvre la boite de dialogue d'installation du navigateur. */
  async function installer() {
    if (!propositionInstallation) return false;
    propositionInstallation.prompt();
    const { outcome } = await propositionInstallation.userChoice;
    definirProposition(null);
    return outcome === 'accepted';
  }

  return { peutInstaller: propositionInstallation !== null, dejaInstallee, installer };
}
