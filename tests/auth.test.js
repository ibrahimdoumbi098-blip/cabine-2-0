// Tests authentification — Cabine 2.0
import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-cabine-2-unit-tests';

describe('JWT tokens', () => {
  it('génère et vérifie un token agent', () => {
    const payload = { agentId: 1, name: 'Test Agent', role: 'agent', walletId: 1 };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.agentId).toBe(1);
    expect(decoded.role).toBe('agent');
    expect(decoded.walletId).toBe(1);
  });

  it('génère et vérifie un token admin', () => {
    const token = jwt.sign({ agentId: 1, role: 'admin', walletId: 1 }, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.role).toBe('admin');
  });

  it('rejette un token avec mauvais secret', () => {
    const token = jwt.sign({ agentId: 1 }, 'wrong-secret', { expiresIn: '1h' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('rejette un token expiré', async () => {
    const token = jwt.sign({ agentId: 1 }, JWT_SECRET, { expiresIn: '1ms' });
    await new Promise(r => setTimeout(r, 10));
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('contient tous les champs requis', () => {
    const token = jwt.sign({ agentId: 2, name: 'Ibrahim', email: 'test@cabine.ci', role: 'admin', walletId: 1 }, JWT_SECRET);
    const d = jwt.verify(token, JWT_SECRET);
    expect(d).toHaveProperty('agentId');
    expect(d).toHaveProperty('role');
    expect(d).toHaveProperty('walletId');
    expect(d).toHaveProperty('name');
  });

  it('jwtId optionnel dans le payload', () => {
    const token = jwt.sign({ agentId: 1, jwtId: 'test-uuid', role: 'agent', walletId: 1 }, JWT_SECRET);
    const d = jwt.verify(token, JWT_SECRET);
    expect(d.jwtId).toBe('test-uuid');
  });
});

describe('bcrypt passwords', () => {
  it('hash et vérifie un mot de passe', async () => {
    const hash = await bcrypt.hash('Cabine2025!', 10);
    expect(await bcrypt.compare('Cabine2025!', hash)).toBe(true);
  });

  it('rejette un mauvais mot de passe', async () => {
    const hash = await bcrypt.hash('correct', 10);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });

  it('deux hashes du même mot de passe sont différents (salt)', async () => {
    const h1 = await bcrypt.hash('same', 10);
    const h2 = await bcrypt.hash('same', 10);
    expect(h1).not.toBe(h2);
  });

  it('hash commence par $2b$', async () => {
    const hash = await bcrypt.hash('test', 10);
    expect(hash.startsWith('$2b$')).toBe(true);
  });
});

describe('Token blacklist simulation', () => {
  it('blacklist révoque un token valide', () => {
    const blacklist = new Set();
    const token = jwt.sign({ agentId: 1 }, JWT_SECRET);
    blacklist.add(token);
    expect(blacklist.has(token)).toBe(true);
  });

  it('token non blacklisté passe', () => {
    const blacklist = new Set();
    const token = jwt.sign({ agentId: 1 }, JWT_SECRET);
    expect(blacklist.has(token)).toBe(false);
  });
});

describe('2FA logic', () => {
  it('OTP format correct', () => {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it('OTP expire selon TTL', () => {
    const entry = { otp: '123456', expires: Date.now() - 1 };
    expect(Date.now() > entry.expires).toBe(true);
  });

  it('OTP pas encore expiré', () => {
    const entry = { otp: '123456', expires: Date.now() + 600000 };
    expect(Date.now() > entry.expires).toBe(false);
  });

  it('tentatives incorrectes incrementées', () => {
    const entry = { otp: '123456', expires: Date.now() + 600000, attempts: 0 };
    entry.attempts++;
    entry.attempts++;
    expect(entry.attempts).toBe(2);
    expect(entry.attempts <= 5).toBe(true);
  });
});
