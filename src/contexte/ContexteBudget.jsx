/*
 * CONTEXTE BUDGET — le « cerveau » de l'application
 *
 * Il centralise :
 *   - les donnees affichees (categories, depenses du mois, plafonds,
 *     recurrences, reçus) ;
 *   - le mois actuellement consulte ;
 *   - toutes les actions possibles (ajouter, modifier, supprimer...).
 *
 * Les composants d'affichage n'appellent jamais la base de donnees
 * directement : ils demandent une action a ce contexte. La logique est donc a
 * un seul endroit, et l'affichage se met a jour tout seul partout.
 *
 * Ce fournisseur n'est monte que lorsque le coffre est ouvert : il peut donc
 * lire et ecrire sans jamais se demander si le chiffrement est disponible.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as bdd from '../donnees/basededonnees.js';
import { genererLesEcheances } from '../donnees/generationRecurrences.js';
import { moisActuel } from '../utils/dates.js';
import { resumeDuMois } from '../utils/calculs.js';

const ContexteBudget = createContext(null);

export function FournisseurBudget({ children }) {
  // --- Etat partage -------------------------------------------------------
  const [pret, definirPret] = useState(false);
  const [erreur, definirErreur] = useState(null);
  const [mois, definirMois] = useState(moisActuel);
  const [categories, definirCategories] = useState([]);
  const [depenses, definirDepenses] = useState([]);
  const [recurrences, definirRecurrences] = useState([]);
  const [recus, definirRecus] = useState([]);
  const [plafondsEnregistres, definirPlafondsEnregistres] = useState(null);
  const [moisDisponibles, definirMoisDisponibles] = useState([]);
  const [devise, definirDeviseEtat] = useState('EUR');
  // Echeances creees automatiquement au demarrage, signalees a l'utilisateur.
  const [echeancesCreees, definirEcheancesCreees] = useState([]);

  // --- Chargement ---------------------------------------------------------

  const rechargerLeGeneral = useCallback(async () => {
    const [listeCategories, listeMois, deviseEnregistree, listeRecurrences, listeRecus] =
      await Promise.all([
        bdd.listerCategories(),
        bdd.moisAvecDonnees(),
        bdd.lireReglage('devise', 'EUR'),
        bdd.listerRecurrences(),
        bdd.listerRecus(),
      ]);
    definirCategories(listeCategories);
    definirMoisDisponibles(listeMois);
    definirDeviseEtat(deviseEnregistree);
    definirRecurrences(listeRecurrences);
    definirRecus(listeRecus);
  }, []);

  const rechargerLeMois = useCallback(async (moisACharger) => {
    const [listeDepenses, plafonds] = await Promise.all([
      bdd.listerDepensesDuMois(moisACharger),
      bdd.lirePlafondsDuMois(moisACharger),
    ]);
    definirDepenses(listeDepenses);
    definirPlafondsEnregistres(plafonds);
  }, []);

  // Chargement initial, une seule fois, apres l'ouverture du coffre.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        await bdd.preparerLesDonneesInitiales();

        // Les depenses recurrentes en retard sont enregistrees AVANT le
        // chargement des ecrans : le tableau de bord affiche donc des
        // chiffres deja a jour.
        const generation = await genererLesEcheances();
        if (!annule && generation.creees > 0) {
          definirEcheancesCreees(generation.details);
        }

        if (annule) return;
        await rechargerLeGeneral();
        await rechargerLeMois(mois);
        if (!annule) definirPret(true);
      } catch (probleme) {
        console.error('Impossible de charger les données', probleme);
        if (!annule) {
          definirErreur(
            'Impossible de lire vos données sur cet appareil. ' +
              'Rechargez la page ; si le problème persiste, restaurez une sauvegarde.'
          );
          definirPret(true);
        }
      }
    })();
    return () => {
      annule = true;
    };
    // Volontairement vide : ce chargement n'a lieu qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A chaque changement de mois, on recharge les depenses correspondantes.
  useEffect(() => {
    if (!pret) return;
    rechargerLeMois(mois).catch((probleme) =>
      console.error('Chargement du mois impossible', probleme)
    );
  }, [mois, pret, rechargerLeMois]);

  /** Rafraichit tout apres une operation de grande ampleur (restauration). */
  const rechargerTout = useCallback(async () => {
    await rechargerLeGeneral();
    await rechargerLeMois(mois);
  }, [mois, rechargerLeGeneral, rechargerLeMois]);

  // --- Depenses -----------------------------------------------------------

  const ajouterDepense = useCallback(
    async (donnees) => {
      const creee = await bdd.ajouterDepense(donnees);
      await rechargerLeMois(mois);
      definirMoisDisponibles(await bdd.moisAvecDonnees());
      return creee;
    },
    [mois, rechargerLeMois]
  );

  const modifierDepense = useCallback(
    async (id, changements) => {
      await bdd.modifierDepense(id, changements);
      await rechargerLeMois(mois);
      definirMoisDisponibles(await bdd.moisAvecDonnees());
    },
    [mois, rechargerLeMois]
  );

  const supprimerDepense = useCallback(
    async (id) => {
      await bdd.supprimerDepense(id);
      await rechargerLeMois(mois);
      definirMoisDisponibles(await bdd.moisAvecDonnees());
      definirRecus(await bdd.listerRecus());
    },
    [mois, rechargerLeMois]
  );

  // --- Categories ---------------------------------------------------------

  const ajouterCategorie = useCallback(async (donnees) => {
    const creee = await bdd.ajouterCategorie(donnees);
    definirCategories(await bdd.listerCategories());
    return creee;
  }, []);

  const modifierCategorie = useCallback(async (id, changements) => {
    await bdd.modifierCategorie(id, changements);
    definirCategories(await bdd.listerCategories());
  }, []);

  const supprimerCategorie = useCallback(
    async (id) => {
      await bdd.supprimerCategorie(id);
      definirCategories(await bdd.listerCategories());
      // Les depenses orphelines doivent reapparaitre en « Sans catégorie ».
      await rechargerLeMois(mois);
    },
    [mois, rechargerLeMois]
  );

  // --- Plafonds -----------------------------------------------------------

  const enregistrerPlafonds = useCallback(
    async (nouveauxPlafonds, appliquerAuxMoisSuivants = true) => {
      await bdd.enregistrerPlafondsDuMois(mois, nouveauxPlafonds);

      if (appliquerAuxMoisSuivants) {
        for (const [categorieId, centimes] of Object.entries(nouveauxPlafonds)) {
          await bdd.modifierCategorie(categorieId, { plafondCentimes: centimes });
        }
        definirCategories(await bdd.listerCategories());
      }

      definirPlafondsEnregistres(await bdd.lirePlafondsDuMois(mois));
      definirMoisDisponibles(await bdd.moisAvecDonnees());
    },
    [mois]
  );

  // --- Depenses recurrentes -----------------------------------------------

  const ajouterRecurrence = useCallback(
    async (donnees) => {
      const creee = await bdd.ajouterRecurrence(donnees);
      // Une recurrence dont la date de debut est deja passee produit ses
      // echeances immediatement.
      const generation = await genererLesEcheances();
      definirRecurrences(await bdd.listerRecurrences());
      if (generation.creees > 0) {
        await rechargerLeMois(mois);
        definirMoisDisponibles(await bdd.moisAvecDonnees());
      }
      return creee;
    },
    [mois, rechargerLeMois]
  );

  const modifierRecurrence = useCallback(
    async (id, changements) => {
      await bdd.modifierRecurrence(id, changements);
      const generation = await genererLesEcheances();
      definirRecurrences(await bdd.listerRecurrences());
      if (generation.creees > 0) {
        await rechargerLeMois(mois);
        definirMoisDisponibles(await bdd.moisAvecDonnees());
      }
    },
    [mois, rechargerLeMois]
  );

  const supprimerRecurrence = useCallback(
    async (id, supprimerAussiLesDepenses = false) => {
      if (supprimerAussiLesDepenses) {
        await bdd.supprimerRecurrenceEtSesDepenses(id);
        await rechargerLeMois(mois);
        definirMoisDisponibles(await bdd.moisAvecDonnees());
      } else {
        await bdd.supprimerRecurrence(id);
      }
      definirRecurrences(await bdd.listerRecurrences());
    },
    [mois, rechargerLeMois]
  );

  // --- Reçus scannes ------------------------------------------------------

  const ajouterRecu = useCallback(async (donnees) => {
    const creee = await bdd.ajouterRecu(donnees);
    definirRecus(await bdd.listerRecus());
    return creee;
  }, []);

  const supprimerRecu = useCallback(
    async (id) => {
      await bdd.supprimerRecu(id);
      definirRecus(await bdd.listerRecus());
      await rechargerLeMois(mois);
    },
    [mois, rechargerLeMois]
  );

  // --- Reglages -----------------------------------------------------------

  const definirDevise = useCallback(async (nouvelleDevise) => {
    await bdd.ecrireReglage('devise', nouvelleDevise);
    definirDeviseEtat(nouvelleDevise);
  }, []);

  const toutEffacer = useCallback(async () => {
    await bdd.effacerTout();
    await bdd.preparerLesDonneesInitiales();
    definirMois(moisActuel());
    await rechargerLeGeneral();
    await rechargerLeMois(moisActuel());
  }, [rechargerLeGeneral, rechargerLeMois]);

  // --- Valeurs calculees --------------------------------------------------

  const plafonds = useMemo(
    () => bdd.plafondsApplicables(categories, plafondsEnregistres),
    [categories, plafondsEnregistres]
  );

  const resume = useMemo(
    () => resumeDuMois(categories, depenses, plafonds),
    [categories, depenses, plafonds]
  );

  const valeur = useMemo(
    () => ({
      pret,
      erreur,
      mois,
      definirMois,
      moisDisponibles,
      categories,
      depenses,
      recurrences,
      recus,
      plafonds,
      resume,
      devise,
      echeancesCreees,
      oublierEcheancesCreees: () => definirEcheancesCreees([]),
      definirDevise,
      ajouterDepense,
      modifierDepense,
      supprimerDepense,
      ajouterCategorie,
      modifierCategorie,
      supprimerCategorie,
      enregistrerPlafonds,
      ajouterRecurrence,
      modifierRecurrence,
      supprimerRecurrence,
      ajouterRecu,
      supprimerRecu,
      rechargerTout,
      toutEffacer,
    }),
    [
      pret, erreur, mois, moisDisponibles, categories, depenses, recurrences,
      recus, plafonds, resume, devise, echeancesCreees, definirDevise,
      ajouterDepense, modifierDepense, supprimerDepense, ajouterCategorie,
      modifierCategorie, supprimerCategorie, enregistrerPlafonds,
      ajouterRecurrence, modifierRecurrence, supprimerRecurrence, ajouterRecu,
      supprimerRecu, rechargerTout, toutEffacer,
    ]
  );

  return <ContexteBudget.Provider value={valeur}>{children}</ContexteBudget.Provider>;
}

export function useBudget() {
  const contexte = useContext(ContexteBudget);
  if (!contexte) {
    throw new Error('useBudget doit etre utilise a l’interieur de <FournisseurBudget>');
  }
  return contexte;
}
