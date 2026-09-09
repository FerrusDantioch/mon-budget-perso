/*
 * ENREGISTREMENT AUTOMATIQUE DES DEPENSES RECURRENTES
 *
 * A chaque ouverture de l'application, on regarde quelles echeances auraient
 * du etre enregistrees depuis la derniere fois, et on les cree.
 *
 * DEUX GARANTIES IMPORTANTES
 * --------------------------
 *   1. Aucun doublon. Chaque recurrence retient la date de sa derniere
 *      echeance enregistree ; on ne repart jamais en arriere. Meme si
 *      l'application est ouverte dix fois dans la journee, le loyer n'est
 *      preleve qu'une fois.
 *   2. Aucun oubli. Si l'application n'a pas ete ouverte pendant deux mois,
 *      toutes les echeances de ces deux mois sont creees d'un coup, chacune
 *      a sa vraie date.
 *
 * Une recurrence suspendue ne genere rien, mais sa configuration reste
 * intacte : il suffit de la reactiver pour qu'elle reprenne.
 */

import * as bdd from './basededonnees.js';
import { occurrencesEnRetard } from '../utils/recurrences.js';
import { aujourdhui } from '../utils/dates.js';

/**
 * Cree les depenses correspondant aux echeances passees.
 *
 * @param {string} [dateDuJour] pour les tests ; par defaut, aujourd'hui
 * @returns {Promise<{creees: number, details: Array<{libelle: string, date: string, montantCentimes: number}>}>}
 */
export async function genererLesEcheances(dateDuJour = aujourdhui()) {
  const recurrences = await bdd.listerRecurrences();
  const details = [];

  for (const recurrence of recurrences) {
    const dates = occurrencesEnRetard(recurrence, dateDuJour);
    if (dates.length === 0) continue;

    for (const date of dates) {
      await bdd.ajouterDepense({
        date,
        montantCentimes: recurrence.montantCentimes,
        categorieId: recurrence.categorieId,
        note: recurrence.libelle,
        type: recurrence.type ?? 'depense',
        recurrenceId: recurrence.id,
      });

      details.push({
        libelle: recurrence.libelle,
        date,
        montantCentimes: recurrence.montantCentimes,
        type: recurrence.type ?? 'depense',
      });
    }

    // On note la derniere echeance traitee : c'est ce qui empeche les doublons.
    await bdd.modifierRecurrence(recurrence.id, {
      derniereGeneration: dates[dates.length - 1],
    });
  }

  return { creees: details.length, details };
}
