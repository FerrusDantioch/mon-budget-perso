/*
 * RAPPELS AVANT UN PRELEVEMENT AUTOMATIQUE
 *
 * Deux jours avant l'echeance d'une depense recurrente, l'application peut
 * afficher une notification.
 *
 * UNE LIMITE A CONNAITRE, ET QUE L'INTERFACE ANNONCE CLAIREMENT
 * ------------------------------------------------------------
 * Les vraies notifications programmees (celles qui arrivent meme si
 * l'application n'a pas ete ouverte depuis huit jours) exigent un serveur qui
 * les envoie. Ce projet n'a volontairement aucun serveur : ce serait le seul
 * moyen de faire sortir vos donnees de l'appareil.
 *
 * Les rappels sont donc verifies A L'OUVERTURE de l'application. Concretement :
 * si vous l'ouvrez au moins une fois tous les deux jours, vous serez prevenu ;
 * sinon, le rappel s'affichera au prochain lancement, avec la mention du
 * retard. C'est un compromis assume en faveur de la confidentialite.
 *
 * DETAIL TECHNIQUE IMPORTANT
 * --------------------------
 * Sur Android, « new Notification(...) » est interdit et provoque une erreur.
 * Il faut passer par le service worker. On essaie donc d'abord cette voie, et
 * on se rabat sur la methode classique (ordinateurs) si elle echoue.
 */

import { useCallback, useEffect, useState } from 'react';
import * as bdd from '../donnees/basededonnees.js';
import { prochaineOccurrence } from '../utils/recurrences.js';
import { aujourdhui, ajouterJoursALaDate } from '../utils/dates.js';
import { formaterMontant } from '../utils/monnaie.js';

/** Nombre de jours d'avance du rappel. */
export const JOURS_AVANT_RAPPEL = 2;

const CLE_ACTIVATION = 'notificationsActives';
const CLE_DEJA_ENVOYEES = 'notificationsEnvoyees';

/** L'appareil sait-il afficher des notifications ? */
export function notificationsSupportees() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Affiche une notification, par le service worker en priorite. */
async function afficher(titre, corps, etiquette) {
  const options = {
    body: corps,
    tag: etiquette, // deux rappels identiques ne s'empilent pas
    icon: `${import.meta.env.BASE_URL}icones/icone-192.png`,
    badge: `${import.meta.env.BASE_URL}icones/icone-192.png`,
    lang: 'fr',
    requireInteraction: false,
  };

  try {
    if ('serviceWorker' in navigator) {
      const enregistrement = await navigator.serviceWorker.getRegistration();
      if (enregistrement) {
        await enregistrement.showNotification(titre, options);
        return true;
      }
    }
  } catch (probleme) {
    // On tente la methode classique ci-dessous.
  }

  try {
    // Fonctionne sur ordinateur ; leve une erreur sur Android.
    new Notification(titre, options);
    return true;
  } catch (probleme) {
    console.warn('Notification impossible', probleme);
    return false;
  }
}

export function useNotifications() {
  const [permission, definirPermission] = useState(() =>
    notificationsSupportees() ? Notification.permission : 'unsupported'
  );
  const [activees, definirActivees] = useState(false);

  useEffect(() => {
    bdd
      .lireReglage(CLE_ACTIVATION, false)
      .then(definirActivees)
      .catch(() => definirActivees(false));
  }, []);

  /** Demande l'autorisation au navigateur, puis enregistre le choix. */
  const activer = useCallback(async () => {
    if (!notificationsSupportees()) return { active: false, raison: 'non supportées' };

    let reponse = Notification.permission;
    if (reponse === 'default') {
      reponse = await Notification.requestPermission();
    }
    definirPermission(reponse);

    if (reponse !== 'granted') {
      return {
        active: false,
        raison:
          reponse === 'denied'
            ? 'Les notifications ont été refusées. Vous pouvez les réautoriser dans les réglages du navigateur.'
            : 'Autorisation non accordée.',
      };
    }

    await bdd.ecrireReglage(CLE_ACTIVATION, true);
    definirActivees(true);
    return { active: true };
  }, []);

  const desactiver = useCallback(async () => {
    await bdd.ecrireReglage(CLE_ACTIVATION, false);
    definirActivees(false);
  }, []);

  return { permission, activees, activer, desactiver, supportees: notificationsSupportees() };
}

/**
 * Cherche les echeances proches et affiche un rappel pour chacune.
 * Appelee une fois au demarrage, apres le chargement des donnees.
 *
 * @param {Array} recurrences
 * @param {string} [dateDuJour]
 * @returns {Promise<{envoyees: number, aVenir: Array}>}
 */
export async function verifierLesEcheancesProches(recurrences, dateDuJour = aujourdhui()) {
  const limite = ajouterJoursALaDate(dateDuJour, JOURS_AVANT_RAPPEL);
  const aVenir = [];

  for (const recurrence of recurrences) {
    if (recurrence.suspendue) continue;
    const prochaine = prochaineOccurrence(recurrence, dateDuJour);
    if (prochaine && prochaine <= limite) {
      aVenir.push({ recurrence, date: prochaine });
    }
  }

  const actives = await bdd.lireReglage(CLE_ACTIVATION, false);
  if (!actives || !notificationsSupportees() || Notification.permission !== 'granted') {
    return { envoyees: 0, aVenir };
  }

  // On retient ce qui a deja ete annonce pour ne pas repeter le meme rappel a
  // chaque ouverture de l'application.
  const dejaEnvoyees = new Set(await bdd.lireReglage(CLE_DEJA_ENVOYEES, []));
  let envoyees = 0;

  for (const { recurrence, date } of aVenir) {
    const etiquette = `${recurrence.id}|${date}`;
    if (dejaEnvoyees.has(etiquette)) continue;

    const succes = await afficher(
      'Prélèvement à venir',
      `${recurrence.libelle} — ${formaterMontant(recurrence.montantCentimes)} le ${date.split('-').reverse().join('/')}`,
      etiquette
    );
    if (succes) {
      dejaEnvoyees.add(etiquette);
      envoyees += 1;
    }
  }

  // On ne garde que les 60 derniers rappels : inutile de conserver l'historique
  // complet, et cela evite que ce reglage grossisse indefiniment.
  await bdd.ecrireReglage(CLE_DEJA_ENVOYEES, [...dejaEnvoyees].slice(-60));

  return { envoyees, aVenir };
}
