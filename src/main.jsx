/*
 * POINT DE DEPART DE L'APPLICATION
 *
 * Ce fichier est le premier a s'executer. Il ne fait que trois choses :
 *   1. charger les feuilles de style ;
 *   2. brancher React sur la balise <div id="racine"> de index.html ;
 *   3. envelopper l'application dans ses fournisseurs.
 *
 * L'ORDRE DES FOURNISSEURS N'EST PAS ARBITRAIRE
 *
 *   GardeErreur         attrape toute erreur imprevue (pas d'ecran blanc)
 *     FournisseurTheme  les couleurs, disponibles des l'ecran de verrouillage
 *       FournisseurCoffre  la cle de chiffrement et l'etat du verrouillage
 *         App              qui ne monte les donnees qu'une fois deverrouille
 *
 * Le theme est place AVANT le coffre pour que l'ecran de saisie du code
 * s'affiche deja dans les bonnes couleurs. Le fournisseur de donnees, lui,
 * est monte a l'interieur de App, uniquement quand le coffre est ouvert.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/base.css';
import './styles/composants.css';
import './styles/securite.css';

import { App } from './App.jsx';
import { GardeErreur } from './composants/GardeErreur.jsx';
import { FournisseurTheme } from './contexte/ContexteTheme.jsx';
import { FournisseurCoffre } from './contexte/ContexteCoffre.jsx';

const racine = document.getElementById('racine');

createRoot(racine).render(
  // StrictMode est une aide au developpement : il signale les erreurs
  // courantes dans la console. Il n'a aucun effet sur la version publiee.
  <StrictMode>
    <GardeErreur>
      <FournisseurTheme>
        <FournisseurCoffre>
          <App />
        </FournisseurCoffre>
      </FournisseurTheme>
    </GardeErreur>
  </StrictMode>
);
