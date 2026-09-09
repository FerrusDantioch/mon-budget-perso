/*
 * CONTEXTE DE SECURITE
 *
 * Il pilote les quatre etats possibles de l'application :
 *
 *   « chargement »  on regarde si un code a deja ete defini
 *   « creation »    premier lancement : il faut choisir un code
 *   « verrouille »  le code est demande
 *   « ouvert »      les donnees sont accessibles
 *
 * Aucun ecran de l'application n'est affiche tant que l'etat n'est pas
 * « ouvert » : ce n'est pas seulement un masque visuel, la cle de
 * dechiffrement n'existe tout simplement pas avant.
 *
 * Il gere aussi le verrouillage automatique apres deux minutes sans activite.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as coffre from '../securite/coffre.js';
import { capteurDisponible } from '../securite/biometrie.js';
import { chiffrerLesDonneesEnClair, compterDonneesEnClair } from '../donnees/migration.js';
import { eteindreMoteur } from '../ocr/moteurOcr.js';

const ContexteCoffre = createContext(null);

/** Duree d'inactivite avant verrouillage automatique. */
export const DELAI_VERROUILLAGE = 2 * 60 * 1000;

/** Evenements consideres comme une activite de l'utilisateur. */
const EVENEMENTS_ACTIVITE = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

export function FournisseurCoffre({ children }) {
  const [etat, definirEtat] = useState('chargement');
  const [blocage, definirBlocage] = useState({ bloque: false, secondesRestantes: 0 });
  const [biometriePossible, definirBiometriePossible] = useState(false);
  const [configuration, definirConfiguration] = useState(null);
  const [donneesAReprendre, definirDonneesAReprendre] = useState(0);
  const [erreurDemarrage, definirErreurDemarrage] = useState(null);

  // Horodatage de la derniere action de l'utilisateur.
  const derniereActivite = useRef(Date.now());

  /** Relit la configuration du coffre depuis la base. */
  const rafraichirConfiguration = useCallback(async () => {
    const etatDuCoffre = await coffre.etatDuCoffre();
    definirConfiguration(etatDuCoffre);
    return etatDuCoffre;
  }, []);

  // --- Demarrage ----------------------------------------------------------
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const etatDuCoffre = await coffre.etatDuCoffre();
        const capteur = await capteurDisponible();
        // Y a-t-il des donnees de l'ancienne version, encore en clair ?
        const enClair = etatDuCoffre.configure ? 0 : await compterDonneesEnClair();

        if (annule) return;
        definirConfiguration(etatDuCoffre);
        definirBiometriePossible(capteur);
        definirDonneesAReprendre(enClair);
        definirBlocage(await coffre.etatBlocage());
        definirEtat(etatDuCoffre.configure ? 'verrouille' : 'creation');
      } catch (probleme) {
        console.error('Impossible de lire la configuration de sécurité', probleme);
        if (!annule) {
          definirErreurDemarrage(
            'Impossible d’accéder au stockage de cet appareil. ' +
              'Vérifiez que la navigation privée est désactivée, puis rechargez la page.'
          );
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  // --- Compte a rebours du blocage ---------------------------------------
  useEffect(() => {
    if (!blocage.bloque) return undefined;
    const minuterie = setInterval(async () => {
      definirBlocage(await coffre.etatBlocage());
    }, 1000);
    return () => clearInterval(minuterie);
  }, [blocage.bloque]);

  // --- Verrouillage --------------------------------------------------------
  const verrouiller = useCallback(() => {
    coffre.verrouiller();
    // Le moteur OCR garde des megaoctets en memoire : on l'eteint aussi.
    eteindreMoteur();
    definirEtat('verrouille');
  }, []);

  /** A appeler pendant une operation longue pour repousser le verrouillage. */
  const signalerActivite = useCallback(() => {
    derniereActivite.current = Date.now();
  }, []);

  // --- Verrouillage automatique -------------------------------------------
  useEffect(() => {
    if (etat !== 'ouvert') return undefined;

    derniereActivite.current = Date.now();

    const marquer = () => {
      derniereActivite.current = Date.now();
    };

    const verifier = () => {
      if (Date.now() - derniereActivite.current >= DELAI_VERROUILLAGE) verrouiller();
    };

    for (const evenement of EVENEMENTS_ACTIVITE) {
      window.addEventListener(evenement, marquer, { passive: true, capture: true });
    }

    const surChangementDeVisibilite = () => {
      if (document.visibilityState === 'visible') {
        // Au retour, on compare avec l'heure de depart : les minuteries sont
        // ralenties, voire suspendues, quand l'application passe en arriere-plan.
        // C'est ce controle-la qui verrouille reellement le telephone rangé
        // dans une poche.
        verifier();
      } else {
        marquer();
      }
    };
    document.addEventListener('visibilitychange', surChangementDeVisibilite);

    // Verification reguliere pour le cas ou l'application reste ouverte a
    // l'ecran sans que personne n'y touche.
    const minuterie = setInterval(verifier, 5000);

    return () => {
      for (const evenement of EVENEMENTS_ACTIVITE) {
        window.removeEventListener(evenement, marquer, { capture: true });
      }
      document.removeEventListener('visibilitychange', surChangementDeVisibilite);
      clearInterval(minuterie);
    };
  }, [etat, verrouiller]);

  // --- Actions -------------------------------------------------------------

  /** Etapes communes a toute ouverture reussie du coffre. */
  const finaliserOuverture = useCallback(async () => {
    // Reprise des eventuelles donnees restees en clair (ancienne version).
    try {
      const reprises = await chiffrerLesDonneesEnClair();
      if (reprises > 0) {
        console.info(`${reprises} enregistrement(s) de l’ancienne version ont été chiffrés.`);
      }
    } catch (probleme) {
      console.error('Reprise des anciennes données impossible', probleme);
    }

    definirDonneesAReprendre(0);
    await rafraichirConfiguration();
    definirBlocage(await coffre.etatBlocage());
    derniereActivite.current = Date.now();
    definirEtat('ouvert');
  }, [rafraichirConfiguration]);

  const creerLeCode = useCallback(
    async (code) => {
      await coffre.creerCoffre(code);
      await finaliserOuverture();
    },
    [finaliserOuverture]
  );

  const deverrouillerAvecCode = useCallback(
    async (code) => {
      try {
        await coffre.ouvrirAvecCode(code);
        await finaliserOuverture();
        return { ouvert: true };
      } catch (probleme) {
        definirBlocage(await coffre.etatBlocage());

        if (probleme instanceof coffre.ErreurBlocage) {
          return { ouvert: false, message: probleme.message };
        }
        if (probleme instanceof coffre.ErreurCodeIncorrect) {
          const suivant = await coffre.etatBlocage();
          return {
            ouvert: false,
            message: suivant.bloque
              ? `Trop d’essais. Réessayez dans ${Math.ceil(suivant.secondesRestantes / 60)} minutes.`
              : `Code incorrect. ${suivant.essaisRestants} essai${suivant.essaisRestants > 1 ? 's' : ''} restant${suivant.essaisRestants > 1 ? 's' : ''}.`,
          };
        }
        return { ouvert: false, message: 'Le déverrouillage a échoué.' };
      }
    },
    [finaliserOuverture]
  );

  const deverrouillerAvecBiometrie = useCallback(async () => {
    try {
      await coffre.ouvrirAvecBiometrie();
      await finaliserOuverture();
      return { ouvert: true };
    } catch (probleme) {
      // Quelle que soit la cause (capteur indisponible, doigt non reconnu,
      // annulation), on retombe simplement sur le code PIN.
      return { ouvert: false, message: probleme.message };
    }
  }, [finaliserOuverture]);

  const deverrouillerAvecPhrase = useCallback(
    async (phrase) => {
      const resultat = await coffre.ouvrirAvecPhrase(phrase);
      if (resultat.ouvert) await finaliserOuverture();
      return { ouvert: resultat.ouvert, message: resultat.raison };
    },
    [finaliserOuverture]
  );

  /**
   * Efface tout et repart de zero.
   * Seule issue quand le code est oublie et qu'aucune phrase de recuperation
   * n'a ete creee. L'ecran de verrouillage l'annonce sans ambiguite.
   */
  const toutEffacerEtRecommencer = useCallback(async () => {
    const { supprimerLaBase } = await import('../donnees/reinitialisation.js');
    await supprimerLaBase();
    window.location.reload();
  }, []);

  const valeur = useMemo(
    () => ({
      etat,
      erreurDemarrage,
      blocage,
      configuration,
      biometriePossible,
      donneesAReprendre,
      creerLeCode,
      deverrouillerAvecCode,
      deverrouillerAvecBiometrie,
      deverrouillerAvecPhrase,
      verrouiller,
      signalerActivite,
      rafraichirConfiguration,
      toutEffacerEtRecommencer,
    }),
    [
      etat, erreurDemarrage, blocage, configuration, biometriePossible,
      donneesAReprendre, creerLeCode, deverrouillerAvecCode,
      deverrouillerAvecBiometrie, deverrouillerAvecPhrase, verrouiller,
      signalerActivite, rafraichirConfiguration, toutEffacerEtRecommencer,
    ]
  );

  return <ContexteCoffre.Provider value={valeur}>{children}</ContexteCoffre.Provider>;
}

export function useCoffre() {
  const contexte = useContext(ContexteCoffre);
  if (!contexte) {
    throw new Error('useCoffre doit etre utilise a l’interieur de <FournisseurCoffre>');
  }
  return contexte;
}
