/*
 * OUTILS PARTAGES PAR LES TESTS
 */

import { genererCleCoffre } from '../src/securite/crypto.js';
import { ouvrirAvecCleBrute } from '../src/securite/coffre.js';

/**
 * Ouvre un coffre avec une cle tiree au hasard, sans passer par un code PIN.
 *
 * Pourquoi ce raccourci : deriver une cle a partir d'un code demande 310 000
 * repetitions de calcul, soit environ un tiers de seconde. C'est voulu en
 * usage reel, mais cela rendrait la suite de tests inutilement lente. Le
 * calcul de derivation est teste separement, dans coffre.test.js.
 */
export async function ouvrirCoffreDeTest() {
  const cle = await genererCleCoffre();
  ouvrirAvecCleBrute(cle);
  return cle;
}
