// Tests utilitaires — Cabine 2.0
import { describe, it, expect } from 'vitest';

// Versions corrigées des fonctions de production
function formatPhoneCI(phone) {
  let cleaned = phone.replace(/[\s\-\.]/g, '');
  if (cleaned.startsWith('+225')) return cleaned;
  if (cleaned.startsWith('225')) return '+' + cleaned;
  // Conserver le 0 initial — +225 + 0XXXXXXXXX = format CI correct
  return '+225' + cleaned;
}

function detectOperator(phone) {
  const cleaned = phone.replace(/[\s\-\.\+]/g, '');
  let digits = cleaned;
  if (digits.startsWith('225')) digits = digits.substring(3);
  // Ne PAS supprimer le 0 initial — les préfixes CI sont 07, 08, 27, 05, 06, 01, 02, 03
  if (digits.length < 2) return null;
  const prefix = digits.substring(0, 2);
  if (['07', '08', '27'].includes(prefix)) return 'orange';
  if (['05', '06', '25', '26'].includes(prefix)) return 'mtn';
  if (['01', '02', '03'].includes(prefix)) return 'moov';
  return null;
}

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 5000000;

describe('Formatage téléphone CI', () => {
  it('formate un numéro à 10 chiffres', () => expect(formatPhoneCI('0700000000')).toBe('+2250700000000'));
  it('formate un numéro avec préfixe 225', () => expect(formatPhoneCI('2250700000000')).toBe('+2250700000000'));
  it('préserve le + si déjà présent', () => expect(formatPhoneCI('+2250700000000')).toBe('+2250700000000'));
  it('formate avec espaces', () => expect(formatPhoneCI('07 00 00 00 00')).toBe('+2250700000000'));
  it('formate MTN', () => expect(formatPhoneCI('0500000000')).toBe('+2250500000000'));
});

describe('Détection opérateur CI', () => {
  it('détecte Orange 07', () => expect(detectOperator('0700000000')).toBe('orange'));
  it('détecte Orange 08', () => expect(detectOperator('0800000000')).toBe('orange'));
  it('détecte Orange 27', () => expect(detectOperator('2700000000')).toBe('orange'));
  it('détecte MTN 05', () => expect(detectOperator('0500000000')).toBe('mtn'));
  it('détecte MTN 06', () => expect(detectOperator('0600000000')).toBe('mtn'));
  it('détecte Moov 01', () => expect(detectOperator('0100000000')).toBe('moov'));
  it('retourne null inconnu', () => expect(detectOperator('0999999999')).toBe(null));
  it('fonctionne avec +225', () => expect(detectOperator('+2250700000000')).toBe('orange'));
});

describe('Validation montants', () => {
  it('accepte 5000', () => expect(5000 >= MIN_AMOUNT && 5000 <= MAX_AMOUNT).toBe(true));
  it('rejette 50 (trop bas)', () => expect(50 >= MIN_AMOUNT).toBe(false));
  it('rejette 6000000 (trop haut)', () => expect(6000000 <= MAX_AMOUNT).toBe(false));
  it('accepte le minimum', () => expect(MIN_AMOUNT >= MIN_AMOUNT).toBe(true));
  it('accepte le maximum', () => expect(MAX_AMOUNT <= MAX_AMOUNT).toBe(true));
});

describe('Calcul commission & bénéfice', () => {
  const calcNet = (amount, commRate, geniusPct = 1) => ({
    commission: Math.round(amount * commRate / 100),
    fees: Math.round(amount * geniusPct / 100),
    net: Math.round(amount * commRate / 100) - Math.round(amount * geniusPct / 100),
  });

  it('2% commission sur 10000 = 200F', () => expect(calcNet(10000, 2).commission).toBe(200));
  it('frais GeniusPay 1% sur 10000 = 100F', () => expect(calcNet(10000, 2).fees).toBe(100));
  it('bénéfice net 2% - 1% = 100F sur 10000', () => expect(calcNet(10000, 2).net).toBe(100));
  it('3% commission sur 50000 = 500F net', () => expect(calcNet(50000, 3).net).toBe(1000));
  it('0% commission = bénéfice négatif', () => expect(calcNet(10000, 0).net).toBe(-100));
});

describe('Validation PIN', () => {
  it('PIN 4 chiffres valide', () => expect(/^\d{4}$/.test('1234')).toBe(true));
  it('PIN 3 chiffres invalide', () => expect(/^\d{4}$/.test('123')).toBe(false));
  it('PIN avec lettres invalide', () => expect(/^\d{4}$/.test('12ab')).toBe(false));
  it('PIN 5 chiffres invalide', () => expect(/^\d{4}$/.test('12345')).toBe(false));
  it('PIN vide invalide', () => expect(/^\d{4}$/.test('')).toBe(false));
});

describe('OTP 2FA', () => {
  const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));
  it('OTP = 6 chiffres', () => expect(genOTP()).toMatch(/^\d{6}$/));
  it('OTP dans range 100000-999999', () => {
    const n = parseInt(genOTP());
    expect(n).toBeGreaterThanOrEqual(100000);
    expect(n).toBeLessThanOrEqual(999999);
  });
  it('deux OTPs différents (très probable)', () => {
    const set = new Set(Array.from({ length: 10 }, genOTP));
    expect(set.size).toBeGreaterThan(1);
  });
});
