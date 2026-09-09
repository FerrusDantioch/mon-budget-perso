/*
 * PREPARATION DES TESTS AUTOMATISES
 *
 * Ce fichier s'execute avant chaque fichier de test. Il installe ce qui
 * existe dans un navigateur mais pas dans Node.js :
 *
 *   - "fake-indexeddb" : une fausse base IndexedDB, entierement en memoire ;
 *   - la vraie cryptographie de Node a la place de celle de jsdom.
 *
 * Ce dernier point est indispensable : jsdom fournit bien un objet "crypto",
 * mais sans "crypto.subtle", c'est-a-dire sans AES ni PBKDF2. Sans cette
 * substitution, tous les tests de chiffrement echoueraient.
 */

import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// On remplace systematiquement l'objet crypto : celui de jsdom est incomplet.
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
  writable: true,
});
