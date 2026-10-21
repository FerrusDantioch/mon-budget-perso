/*
 * INSTALLATION ET MISE A JOUR DU SERVICE WORKER
 *
 * Le service worker (public/sw.js) est ce qui permet a l'application de
 * fonctionner sans connexion. Ce fichier s'occupe de :
 *   1. l'enregistrer aupres du navigateur au demarrage ;
 *   2. detecter qu'une nouvelle version a ete publiee ;
 *   3. proposer a l'utilisateur de l'installer (bandeau "Mettre a jour").
 *
 * Il n'est actif qu'en production : pendant le developpement, un service
 * worker garderait en cache l'ancienne version du code et masquerait les
 * modifications en cours.
 */

import { useCallback, useEffect, useState } from 'react';

export function useServiceWorker() {
  const [miseAJourDisponible, definirMiseAJourDisponible] = useState(false);
  const [enAttente, definirEnAttente] = useState(null);
  const [installe, definirInstalle] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    let annule = false;

    // BASE_URL vaut "/NOM-DU-DEPOT/" : le service worker doit etre enregistre
    // a cette adresse pour pouvoir couvrir toute l'application.
    const adresseDuServiceWorker = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(adresseDuServiceWorker, { scope: import.meta.env.BASE_URL })
      .then((enregistrement) => {
        if (annule) return;
        definirInstalle(true);

        // Une version plus recente attend deja son tour ?
        if (enregistrement.waiting) {
          definirEnAttente(enregistrement.waiting);
          definirMiseAJourDisponible(true);
        }

        // Une nouvelle version vient d'etre telechargee.
        enregistrement.addEventListener('updatefound', () => {
          const nouveau = enregistrement.installing;
          if (!nouveau) return;
          nouveau.addEventListener('statechange', () => {
            if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
              definirEnAttente(nouveau);
              definirMiseAJourDisponible(true);
            }
          });
        });
      })
      .catch((probleme) => {
        // Echec possible en navigation privee : l'application marche quand
        // meme, simplement sans mode hors-ligne.
        console.warn('Mode hors-ligne indisponible :', probleme);
      });

    // STOCKAGE PERSISTANT
    // Par defaut, le navigateur peut effacer de lui-meme la copie hors-ligne
    // (et les donnees du budget) s'il manque de place ou si l'application est
    // peu utilisee : elle ne s'ouvrirait alors plus sans reseau. persist() lui
    // demande de les garder. Certains navigateurs (Firefox) affichent alors
    // une fenetre d'autorisation : pour ne jamais en faire surgir une au
    // demarrage, on ne demande que si le navigateur a deja repondu « accorde »
    // (Chrome, pour une application installee, sans rien afficher). Sinon, on
    // renonce en silence.
    if (navigator.storage && navigator.storage.persist && navigator.permissions) {
      navigator.storage
        .persisted()
        .then((dejaPersistant) => {
          if (dejaPersistant) return undefined;
          return navigator.permissions
            .query({ name: 'persistent-storage' })
            .then((etat) => (etat.state === 'granted' ? navigator.storage.persist() : undefined));
        })
        .catch(() => {});
    }

    // Quand la nouvelle version prend la main, on recharge la page une fois.
    let dejaRecharge = false;
    const surChangement = () => {
      if (dejaRecharge) return;
      dejaRecharge = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', surChangement);

    return () => {
      annule = true;
      navigator.serviceWorker.removeEventListener('controllerchange', surChangement);
    };
  }, []);

  /** Appelee quand l'utilisateur appuie sur "Mettre a jour". */
  const appliquerLaMiseAJour = useCallback(() => {
    if (enAttente) {
      enAttente.postMessage('PASSER_EN_ACTIF');
      definirMiseAJourDisponible(false);
    }
  }, [enAttente]);

  return { miseAJourDisponible, appliquerLaMiseAJour, installe };
}
