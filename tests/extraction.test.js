/*
 * TESTS — lecture d'un ticket de caisse
 *
 * Les textes utilises ici imitent ce que renvoie reellement l'OCR : colonnes
 * mal alignees, lignes parasites, caracteres en trop. On verifie que
 * l'application propose la bonne valeur, et surtout qu'elle annonce
 * honnetement son niveau de confiance.
 */

import { describe, it, expect } from 'vitest';

import {
  analyserTicket,
  extraireCommercant,
  extraireDate,
  extraireMontant,
  montantsDeLaLigne,
} from '../src/ocr/extraction.js';

const TICKET_SUPERMARCHE = [
  'CARREFOUR MARKET',
  '12 rue des Lilas',
  '75011 PARIS',
  'SIRET 123 456 789 00012',
  '',
  'Pain complet          2,40',
  'Lait 1L x2            3,10',
  'Pommes 1,2kg          4,68',
  '',
  'TOTAL TTC            10,18',
  'TVA 5,5%              0,53',
  'CARTE BANCAIRE       10,18',
  '',
  '15/03/2026 18:42',
  'Merci de votre visite',
].join('\n');

describe('montantsDeLaLigne', () => {
  it('lit un montant simple', () => {
    expect(montantsDeLaLigne('Pain complet 2,40')).toEqual([240]);
    expect(montantsDeLaLigne('Pain complet 2.40')).toEqual([240]);
  });

  it('lit plusieurs montants sur une ligne', () => {
    expect(montantsDeLaLigne('2 x 3,50 = 7,00')).toEqual([350, 700]);
  });

  it('gere les separateurs de milliers', () => {
    expect(montantsDeLaLigne('TOTAL 1 234,56')).toEqual([123456]);
    expect(montantsDeLaLigne('TOTAL 1234,56')).toEqual([123456]);
  });

  it('ignore ce qui n’est pas un montant', () => {
    expect(montantsDeLaLigne('SIRET 123 456 789')).toEqual([]);
    expect(montantsDeLaLigne('Article sans prix')).toEqual([]);
    // Trois decimales : ce n'est pas un prix.
    expect(montantsDeLaLigne('Poids 1,255 kg')).toEqual([]);
  });
});

describe('extraireMontant', () => {
  it('trouve le total et l’annonce comme fiable', () => {
    const resultat = extraireMontant(TICKET_SUPERMARCHE);
    expect(resultat.centimes).toBe(1018);
    expect(resultat.confiance).toBe('bonne');
    expect(resultat.ligne).toContain('TOTAL TTC');
  });

  it('ne confond pas le total avec la ligne de TVA', () => {
    const ticket = ['Article 12,00', 'TOTAL HT 10,00', 'TVA 20% 2,00', 'TOTAL TTC 12,00'].join('\n');
    expect(extraireMontant(ticket).centimes).toBe(1200);
  });

  it('reconnait « NET A PAYER »', () => {
    const ticket = ['Article 12,00', 'NET A PAYER 12,00'].join('\n');
    const resultat = extraireMontant(ticket);
    expect(resultat.centimes).toBe(1200);
    expect(resultat.confiance).toBe('bonne');
  });

  it('lit le montant sur la ligne suivante quand il y est', () => {
    const ticket = ['Article 12,00', 'TOTAL', '12,00'].join('\n');
    expect(extraireMontant(ticket).centimes).toBe(1200);
  });

  it('se rabat sur le plus gros montant, en le signalant', () => {
    const ticket = ['Article A 3,50', 'Article B 12,90', 'Article C 1,20'].join('\n');
    const resultat = extraireMontant(ticket);
    expect(resultat.centimes).toBe(1290);
    // Point essentiel : la confiance doit etre degradee.
    expect(resultat.confiance).toBe('moyenne');
  });

  it('avoue ne rien avoir trouve', () => {
    const resultat = extraireMontant('Texte illisible sans aucun chiffre');
    expect(resultat.centimes).toBeNull();
    expect(resultat.confiance).toBe('aucune');
  });
});

describe('extraireDate', () => {
  it('lit une date au format francais', () => {
    expect(extraireDate('15/03/2026 18:42', '2026-09-08').date).toBe('2026-03-15');
    expect(extraireDate('15-03-2026', '2026-09-08').date).toBe('2026-03-15');
    expect(extraireDate('15.03.2026', '2026-09-08').date).toBe('2026-03-15');
  });

  it('complete une annee sur deux chiffres', () => {
    expect(extraireDate('15/03/26', '2026-09-08').date).toBe('2026-03-15');
  });

  it('lit une date ecrite en toutes lettres', () => {
    expect(extraireDate('Le 15 mars 2026', '2026-09-08').date).toBe('2026-03-15');
    expect(extraireDate('3 février 2026', '2026-09-08').date).toBe('2026-02-03');
  });

  it('ecarte une date impossible', () => {
    // 32/03 n'existe pas ; la seconde date doit etre retenue.
    expect(extraireDate('32/03/2026 puis 15/03/2026', '2026-09-08').date).toBe('2026-03-15');
  });

  it('ecarte une date future', () => {
    const resultat = extraireDate('15/03/2027', '2026-09-08');
    expect(resultat.date).toBeNull();
  });

  it('avoue ne rien avoir trouve', () => {
    const resultat = extraireDate('Aucune date ici', '2026-09-08');
    expect(resultat.date).toBeNull();
    expect(resultat.confiance).toBe('aucune');
  });
});

describe('extraireCommercant', () => {
  it('prend le nom en haut du ticket', () => {
    const resultat = extraireCommercant(TICKET_SUPERMARCHE);
    expect(resultat.nom).toBe('CARREFOUR MARKET');
    expect(resultat.confiance).toBe('bonne');
  });

  it('saute les lignes parasites', () => {
    const ticket = ['TICKET DE CAISSE', 'N° 004512', 'BOULANGERIE DUPONT', 'Pain 1,20'].join('\n');
    const resultat = extraireCommercant(ticket);
    expect(resultat.nom).toBe('BOULANGERIE DUPONT');
    // Trouve mais pas en premiere ligne : confiance moindre.
    expect(resultat.confiance).toBe('moyenne');
  });

  it('ignore une ligne majoritairement chiffree', () => {
    const ticket = ['75011 12 345 678', 'PHARMACIE CENTRALE'].join('\n');
    expect(extraireCommercant(ticket).nom).toBe('PHARMACIE CENTRALE');
  });

  it('avoue ne rien avoir trouve', () => {
    expect(extraireCommercant('12345\n678\n90').nom).toBeNull();
  });
});

describe('analyserTicket', () => {
  it('extrait les trois informations d’un ticket lisible', () => {
    const resultat = analyserTicket(TICKET_SUPERMARCHE, '2026-09-08');
    expect(resultat.montantCentimes).toBe(1018);
    expect(resultat.date).toBe('2026-03-15');
    expect(resultat.commercant).toBe('CARREFOUR MARKET');
    expect(resultat.qualiteGlobale).toBe('bonne');
  });

  it('signale une qualite faible sur un texte inexploitable', () => {
    const resultat = analyserTicket('~~~ ### ???', '2026-09-08');
    expect(resultat.montantCentimes).toBeNull();
    expect(resultat.date).toBeNull();
    expect(resultat.qualiteGlobale).toBe('faible');
  });

  it('signale une qualite partielle quand une seule information est sure', () => {
    const resultat = analyserTicket('Article A 3,50\nArticle B 12,90', '2026-09-08');
    // Montant devine (confiance moyenne), pas de date, commercant devine.
    expect(resultat.qualiteGlobale).not.toBe('bonne');
  });
});
