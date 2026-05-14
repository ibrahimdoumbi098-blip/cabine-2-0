import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==========================================
// PROFESSIONAL LOGGING SYSTEM
// ==========================================
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO;

function log(level, message, data = {}) {
  if (LOG_LEVELS[level] > CURRENT_LOG_LEVEL) return;
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  
  console.log(`[${timestamp}] ${level}: ${message}`, Object.keys(data).length ? data : '');
  
  // In production, you might want to send logs to a service like DataDog, LogRocket, etc.
}

const app = express();
app.set('trust proxy', 1); // Render / nginx reverse proxy — required for req.ip and HSTS
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const APP_DOMAIN = process.env.APP_DOMAIN || 'https://cabine.ci';

// ==========================================
// CORS — production: cabine.ci only
// ==========================================
const ALLOWED_ORIGINS = IS_PROD
  ? [APP_DOMAIN, 'https://www.cabine.ci', 'https://cabine.ci']
  : null; // dev: allow all localhost origins (Vite can use any port 5173-5179)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / server-to-server
    if (!IS_PROD) {
      // Dev: allow any localhost origin regardless of Vite port
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return cb(null, true);
      }
    }
    if (ALLOWED_ORIGINS && ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    log('WARN', 'CORS blocked', { origin });
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

// ==========================================
// www → apex redirect (301 permanent)
// ==========================================
app.use((req, res, next) => {
  if (req.hostname === 'www.cabine.ci') {
    return res.redirect(301, `https://cabine.ci${req.url}`);
  }
  next();
});

// ==========================================
// SECURITY HEADERS — production grade
// ==========================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self' https://cabine.ci",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://cabine.ci https://pay.genius.ci",
    "frame-ancestors 'none'",
  ].join('; '));
  next();
});

// ==========================================
// RATE LIMITING
// ==========================================
function makeRateLimiter(windowMs, max, message) {
  const map = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of map) if (now - e.start > windowMs * 2) map.delete(ip);
  }, windowMs * 2);
  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    const entry = map.get(ip);
    if (!entry || now - entry.start > windowMs) {
      map.set(ip, { count: 1, start: now }); return next();
    }
    entry.count++;
    if (entry.count > max) return res.status(429).json({ error: message });
    next();
  };
}
const rateLimiter     = makeRateLimiter(60000,  30, 'Trop de requêtes. Réessayez dans une minute.');
const authRateLimiter = makeRateLimiter(900000,  8, 'Trop de tentatives. Réessayez dans 15 minutes.');

// ==========================================
// FORFAITS OPÉRATEURS CI — source unique côté serveur
// Mise à jour ici = mis à jour pour tous les clients sans rebuild frontend
// Dernière vérification: 2026-05-07 (sources: orange.ci, mtn.ci, moov-africa.ci)
// ==========================================
const OPERATOR_BUNDLES = {
  lastUpdated: '2026-05-07',
  internet: {
    orange: {
      daily: [
        { id: 'o-d-40m',  label: '40 Mo',  price: 100,  validity: '24h',     tag: null },
        { id: 'o-d-100m', label: '100 Mo', price: 200,  validity: '24h',     tag: null },
        { id: 'o-d-250m', label: '250 Mo', price: 300,  validity: '24h',     tag: null },
        { id: 'o-d-500m', label: '500 Mo', price: 500,  validity: '24h',     tag: null },
        { id: 'o-d-1g',   label: '1 Go',   price: 700,  validity: '24h',     tag: 'Populaire' },
      ],
      weekly: [
        { id: 'o-w-500m', label: '500 Mo', price: 500,  validity: '7 jours', tag: null },
        { id: 'o-w-1g5',  label: '1,5 Go', price: 1000, validity: '7 jours', tag: null },
        { id: 'o-w-3g',   label: '3 Go',   price: 2000, validity: '7 jours', tag: 'Meilleur' },
        { id: 'o-w-5g',   label: '5 Go',   price: 3000, validity: '7 jours', tag: null },
      ],
      monthly: [
        { id: 'o-m-2g',   label: '2 Go',   price: 2000,  validity: '30 jours', tag: null },
        { id: 'o-m-5g',   label: '5 Go',   price: 3500,  validity: '30 jours', tag: 'Populaire' },
        { id: 'o-m-10g',  label: '10 Go',  price: 5000,  validity: '30 jours', tag: null },
        { id: 'o-m-20g',  label: '20 Go',  price: 8000,  validity: '30 jours', tag: 'Top valeur' },
        { id: 'o-m-40g',  label: '40 Go',  price: 15000, validity: '30 jours', tag: null },
      ],
    },
    mtn: {
      daily: [
        { id: 'm-d-220m', label: '220 Mo', price: 200, validity: '2 jours', tag: null },
        { id: 'm-d-400m', label: '400 Mo', price: 300, validity: '3 jours', tag: null },
        { id: 'm-d-450m', label: '450 Mo', price: 450, validity: '3 jours', tag: null },
        { id: 'm-d-750m', label: '750 Mo', price: 500, validity: '3 jours', tag: 'Populaire' },
      ],
      weekly: [
        { id: 'm-w-1g5',  label: '1,5 Go', price: 1000, validity: '5 jours',  tag: null },
        { id: 'm-w-2g2',  label: '2,2 Go', price: 1500, validity: '10 jours', tag: 'Meilleur' },
      ],
      monthly: [
        { id: 'm-m-3g',   label: '3 Go',   price: 2000,  validity: '30 jours', tag: null },
        { id: 'm-m-3g7',  label: '3,7 Go', price: 2500,  validity: '30 jours', tag: null },
        { id: 'm-m-7g4',  label: '7,4 Go', price: 5000,  validity: '30 jours', tag: 'Populaire' },
        { id: 'm-m-20g',  label: '20 Go',  price: 10000, validity: '30 jours', tag: 'Top valeur' },
        { id: 'm-m-30g',  label: '30 Go',  price: 15000, validity: '30 jours', tag: null },
        { id: 'm-m-45g',  label: '45 Go',  price: 20000, validity: '30 jours', tag: null },
      ],
    },
    moov: {
      daily: [
        { id: 'mo-d-150m', label: '150 Mo', price: 150, validity: '2 jours', tag: null },
        { id: 'mo-d-220m', label: '220 Mo', price: 200, validity: '2 jours', tag: null },
        { id: 'mo-d-400m', label: '400 Mo', price: 300, validity: '2 jours', tag: null },
        { id: 'mo-d-750m', label: '750 Mo', price: 500, validity: '3 jours', tag: 'Populaire' },
      ],
      weekly: [
        { id: 'mo-w-1g',   label: '1 Go',   price: 750,  validity: '7 jours',  tag: null },
        { id: 'mo-w-1g5',  label: '1,5 Go', price: 1000, validity: '5 jours',  tag: null },
        { id: 'mo-w-2g5',  label: '2,5 Go', price: 1500, validity: '10 jours', tag: 'Meilleur' },
      ],
      monthly: [
        { id: 'mo-m-3g',   label: '3 Go',   price: 2000,  validity: '30 jours', tag: null },
        { id: 'mo-m-7g4',  label: '7,4 Go', price: 4900,  validity: '30 jours', tag: 'Populaire' },
        { id: 'mo-m-15g',  label: '15 Go',  price: 8000,  validity: '30 jours', tag: null },
        { id: 'mo-m-25g',  label: '25 Go',  price: 12000, validity: '30 jours', tag: 'Top valeur' },
        { id: 'mo-m-40g',  label: '40 Go',  price: 18000, validity: '30 jours', tag: null },
      ],
    },
  },
  calls: {
    orange: {
      daily: [
        { id: 'oc-d-on30',  label: '30 min',  price: 100, validity: '24h',     tag: null,       note: 'Orange→Orange' },
        { id: 'oc-d-on60',  label: '60 min',  price: 150, validity: '24h',     tag: 'Populaire',note: 'Orange→Orange' },
        { id: 'oc-d-all30', label: '30 min',  price: 200, validity: '24h',     tag: null,       note: 'Tous réseaux' },
        { id: 'oc-d-nuit',  label: 'Nuit',    price: 100, validity: '21h–7h',  tag: 'Nuit',     note: 'Illimité Orange' },
      ],
      weekly: [
        { id: 'oc-w-200',  label: '200 min', price: 500,  validity: '7 jours', tag: null,       note: 'Orange→Orange' },
        { id: 'oc-w-all',  label: '100 min', price: 1000, validity: '7 jours', tag: 'Meilleur', note: 'Tous réseaux' },
      ],
      monthly: [
        { id: 'oc-m-ilim', label: 'Illimité', price: 3000, validity: '30 jours', tag: 'Top',   note: 'Orange→Orange' },
        { id: 'oc-m-500',  label: '500 min',  price: 4000, validity: '30 jours', tag: null,     note: 'Tous réseaux' },
      ],
    },
    mtn: {
      daily: [
        { id: 'mc-d-on30',  label: '30 min', price: 100, validity: '24h',     tag: null,        note: 'MTN→MTN' },
        { id: 'mc-d-on60',  label: '60 min', price: 150, validity: '24h',     tag: 'Populaire', note: 'MTN→MTN' },
        { id: 'mc-d-all20', label: '20 min', price: 200, validity: '24h',     tag: null,        note: 'Tous réseaux' },
      ],
      weekly: [
        { id: 'mc-w-100',  label: '100 min', price: 500,  validity: '7 jours', tag: null,       note: 'MTN→MTN' },
        { id: 'mc-w-all',  label: '50 min',  price: 750,  validity: '7 jours', tag: 'Meilleur', note: 'Tous réseaux' },
      ],
      monthly: [
        { id: 'mc-m-300',  label: '300 min', price: 1500, validity: '30 jours', tag: null,     note: 'MTN→MTN' },
        { id: 'mc-m-all',  label: '150 min', price: 3000, validity: '30 jours', tag: 'Top',    note: 'Tous réseaux' },
      ],
    },
    moov: {
      daily: [
        { id: 'movc-d-on30', label: '30 min', price: 100, validity: '24h',     tag: null,        note: 'Moov→Moov' },
        { id: 'movc-d-on60', label: '60 min', price: 150, validity: '24h',     tag: 'Populaire', note: 'Moov→Moov' },
        { id: 'movc-d-all',  label: '20 min', price: 200, validity: '24h',     tag: null,        note: 'Tous réseaux' },
      ],
      weekly: [
        { id: 'movc-w-150', label: '150 min', price: 500,  validity: '7 jours', tag: null,       note: 'Moov→Moov' },
        { id: 'movc-w-all', label: '60 min',  price: 800,  validity: '7 jours', tag: 'Meilleur', note: 'Tous réseaux' },
      ],
      monthly: [
        { id: 'movc-m-400',  label: '400 min', price: 2000, validity: '30 jours', tag: null,    note: 'Moov→Moov' },
        { id: 'movc-m-ilim', label: 'Illimité', price: 5000, validity: '30 jours', tag: 'Top',  note: 'Moov→Moov' },
      ],
    },
  },
};

// ==========================================
// CONFIGURATION CINETPAY — Collections (dépôts entrants)
// Meilleur agrégateur CI pour recevoir Orange/MTN/Wave/Moov
// ==========================================
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY || '';
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID || '';
const CINETPAY_BASE    = 'https://api-checkout.cinetpay.com/v2';
const CINETPAY_SECRET  = process.env.CINETPAY_SECRET || '';

async function cinetpayCreatePayment({ amount, transactionId, description, customerName, customerEmail, customerPhone, returnUrl }) {
  const body = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: transactionId,
    amount: parseInt(amount, 10),
    currency: 'XOF',
    notify_url: `${APP_DOMAIN}/api/webhooks/cinetpay`,
    return_url: returnUrl || `${APP_DOMAIN}/?deposit_success=1`,
    description: description || 'Recharge flotte Cabine 2.0',
    customer_name: customerName || 'Agent Cabine',
    customer_email: customerEmail || 'agent@cabine.ci',
    customer_phone_number: customerPhone || '',
    customer_address: 'Abidjan',
    customer_city: 'Abidjan',
    customer_country: 'CI',
    channels: 'ALL', // Orange Money + MTN + Wave + Moov
    lang: 'fr',
  };
  const res = await fetch(`${CINETPAY_BASE}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.code !== '201' && data.code !== 201) {
    throw new Error(data.message || 'CinetPay: création paiement échouée');
  }
  return data.data; // { payment_url, payment_token }
}

// ==========================================
// CONFIGURATION GENIUSPAY
// ==========================================
const GENIUSPAY_BASE = 'https://pay.genius.ci/api/v1/merchant';
const GENIUSPAY_PK = process.env.GENIUSPAY_PK || '';
const GENIUSPAY_SK = process.env.GENIUSPAY_SK || '';
const GENIUSPAY_API_KEY = process.env.GENIUSPAY_API_KEY || '';
const GENIUSPAY_WALLET_ID = process.env.GENIUSPAY_WALLET_ID || '';
const GENIUSPAY_WEBHOOK_SECRET = process.env.GENIUSPAY_WEBHOOK_SECRET || '';
const GENIUSPAY_MODE = process.env.GENIUSPAY_MODE || 'sandbox';
const JWT_SECRET = process.env.JWT_SECRET || 'cabine2-secret-change-in-prod-2026';

// Token blacklist (révocation immédiate à la déconnexion)
const tokenBlacklist = new Set();
setInterval(() => {
  for (const t of tokenBlacklist) {
    try { jwt.verify(t, JWT_SECRET); } catch { tokenBlacklist.delete(t); }
  }
}, 3600000);

// Reset tokens (mot de passe oublié)
const resetTokens = new Map(); // email → { token, expires }
// Email verification tokens (KYC step 1)
const emailVerifyTokens = new Map(); // token → { agentId, email, expires }
// 2FA OTP tokens (admin only)
const twoFATokens = new Map(); // email → { otp, expires, attempts }
// Sessions actives (pour révocation + audit)
const activeSessions = new Map(); // jwtId → { agentId, email, role, ip, createdAt, lastSeen }
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of resetTokens) if (now > v.expires) resetTokens.delete(k);
  for (const [k, v] of emailVerifyTokens) if (now > v.expires) emailVerifyTokens.delete(k);
  for (const [k, v] of twoFATokens) if (now > v.expires) twoFATokens.delete(k);
  const weekAgo = now - 86400000 * 7;
  for (const [k, v] of activeSessions) if (v.lastSeen < weekAgo) activeSessions.delete(k);
}, 3600000);

// ==========================================
// SERVER-SENT EVENTS — Push temps réel vers les navigateurs
// ==========================================
const sseClients = new Map(); // walletId → Set<res>

function notifyWallet(walletId, event, data) {
  const clients = sseClients.get(String(walletId));
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { clients.delete(client); }
  }
}

function notifyAll(event, data) {
  for (const clients of sseClients.values()) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try { client.write(payload); } catch { clients.delete(client); }
    }
  }
}

let discoveredWalletId = GENIUSPAY_WALLET_ID;
let geniusPayConnected = false;

// ==========================================
// DATABASE ABSTRACTION (SQLite / PostgreSQL)
// ==========================================
const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !!DATABASE_URL;
let pool, sqliteDb;

async function queryGet(sql, params = []) {
  if (isPostgres) {
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pool.query(pgSql, params);
    return res.rows[0];
  }
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

async function queryAll(sql, params = []) {
  if (isPostgres) {
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pool.query(pgSql, params);
    return res.rows;
  }
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function queryRunInsert(sql, params = []) {
  if (isPostgres) {
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`) + ' RETURNING id';
    const res = await pool.query(pgSql, params);
    return res.rows[0].id;
  }
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

async function queryRunUpdate(sql, params = []) {
  if (isPostgres) {
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    await pool.query(pgSql, params);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, (err) => err ? reject(err) : resolve());
    });
  }
}

// ==========================================
// PIN SECURITY — bcrypt with transparent migration
// ==========================================
const BCRYPT_ROUNDS = 10;

async function verifyPin(walletId, storedPin, enteredPin) {
  const isBcrypt = storedPin.startsWith('$2b$') || storedPin.startsWith('$2a$');
  const valid = isBcrypt
    ? await bcrypt.compare(enteredPin, storedPin)
    : storedPin === enteredPin;
  // Auto-upgrade plaintext PIN on first successful use
  if (valid && !isBcrypt) {
    const hash = await bcrypt.hash(enteredPin, BCRYPT_ROUNDS);
    await queryRunUpdate('UPDATE wallets SET pin = ? WHERE id = ?', [hash, walletId]).catch(() => {});
  }
  return valid;
}

// ==========================================
// INIT DB
// ==========================================
async function initDb() {
  const walletsPg = `CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY, agent_name VARCHAR(255),
    balance INTEGER DEFAULT 0, pin VARCHAR(255) DEFAULT '1234'
  )`;
  const walletsSqlite = `CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, agent_name TEXT,
    balance INTEGER DEFAULT 0, pin TEXT DEFAULT '1234'
  )`;
  const agentsPg = `CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'agent',
    wallet_id INTEGER REFERENCES wallets(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  const agentsSqlite = `CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'agent',
    wallet_id INTEGER,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`;
  const invoicesPg = `CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id),
  wallet_id INTEGER,
  period VARCHAR(7) NOT NULL,
  amount INTEGER NOT NULL DEFAULT 10000,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;
  const invoicesSqlite = `CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER,
  wallet_id INTEGER,
  period TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 10000,
  status TEXT DEFAULT 'pending',
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;
  const ledgerPg = `CREATE TABLE IF NOT EXISTS balance_ledger (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER,
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  done_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;
  const ledgerSqlite = `CREATE TABLE IF NOT EXISTS balance_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  done_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;
  const commissionPg = `CREATE TABLE IF NOT EXISTS commission_config (
  type VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100),
  rate_percent DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER
)`;
  const commissionSqlite = `CREATE TABLE IF NOT EXISTS commission_config (
  type TEXT PRIMARY KEY,
  label TEXT,
  rate_percent REAL NOT NULL DEFAULT 2.00,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER
)`;
  const COMMISSION_DEFAULTS = [
    { type: 'transfer', label: 'Transfert inter-réseaux' },
    { type: 'withdraw', label: 'Retrait Mobile Money' },
    { type: 'airtime',  label: 'Recharge crédit téléphonique' },
    { type: 'internet', label: 'Forfait internet mobile' },
  ];
  const txPg = `CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY, wallet_id INTEGER, type VARCHAR(50),
    provider VARCHAR(50), phone VARCHAR(50), amount INTEGER,
    status VARCHAR(50), geniuspay_ref VARCHAR(255),
    geniuspay_payout_id VARCHAR(255), idempotency_key VARCHAR(255),
    fees INTEGER DEFAULT 0, geniuspay_provider VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  const txSqlite = `CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, wallet_id INTEGER, type TEXT,
    provider TEXT, phone TEXT, amount INTEGER,
    status TEXT, geniuspay_ref TEXT,
    geniuspay_payout_id TEXT, idempotency_key TEXT,
    fees INTEGER DEFAULT 0, geniuspay_provider TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`;

  const IBRAHIM_EMAIL = 'ibrahim.doumbi098@gmail.com';
  const IBRAHIM_DEFAULT_PASS = 'Cabine2025!';

  try {
    if (isPostgres) {
      await pool.query(walletsPg);
      await pool.query(txPg);
      await pool.query(agentsPg);
      await pool.query(invoicesPg);
      await pool.query(ledgerPg);
      await pool.query(commissionPg);
      // Migrate wallet columns if not exists
      await pool.query('ALTER TABLE wallets ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 2000000');
      await pool.query('ALTER TABLE wallets ADD COLUMN IF NOT EXISTS alert_threshold INTEGER DEFAULT 50000');
      await pool.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false');
      // Ibrahim est admin → email vérifié d'office
      await pool.query("UPDATE agents SET email_verified = TRUE WHERE role = 'admin'");
      for (const c of COMMISSION_DEFAULTS) {
        await pool.query(
          'INSERT INTO commission_config (type, label, rate_percent) VALUES ($1, $2, $3) ON CONFLICT (type) DO NOTHING',
          [c.type, c.label, 2.00]
        );
      }
      const res = await pool.query('SELECT * FROM wallets WHERE id = 1');
      if (res.rows.length === 0) {
        await pool.query('INSERT INTO wallets (id, agent_name, balance, pin) VALUES (1, $1, $2, $3)', ['Ibrahim Doumbia', 2450000, '1234']);
        // Reset sequence so next SERIAL insert doesn't collide with id=1
        await pool.query("SELECT setval(pg_get_serial_sequence('wallets','id'), COALESCE((SELECT MAX(id) FROM wallets), 1))");
      } else if (res.rows[0].agent_name === 'Kouassi B.') {
        await pool.query('UPDATE wallets SET agent_name = $1 WHERE id = 1', ['Ibrahim Doumbia']);
      }
      // Seed Ibrahim as admin agent if not exists
      const agentRes = await pool.query('SELECT id FROM agents WHERE email = $1', [IBRAHIM_EMAIL]);
      if (agentRes.rows.length === 0) {
        const hash = await bcrypt.hash(IBRAHIM_DEFAULT_PASS, BCRYPT_ROUNDS);
        await pool.query(
          'INSERT INTO agents (name, email, password_hash, role, wallet_id) VALUES ($1, $2, $3, $4, $5)',
          ['Ibrahim Doumbia', IBRAHIM_EMAIL, hash, 'admin', 1]
        );
        console.log('👤 Agent admin Ibrahim créé — email:', IBRAHIM_EMAIL);
      }
    } else {
      await new Promise((resolve) => {
        sqliteDb.serialize(() => {
          sqliteDb.run(walletsSqlite);
          sqliteDb.run(txSqlite);
          sqliteDb.run(agentsSqlite);
          sqliteDb.run(invoicesSqlite);
          sqliteDb.run(ledgerSqlite);
          sqliteDb.run(commissionSqlite);
          for (const c of COMMISSION_DEFAULTS) {
            sqliteDb.run('INSERT OR IGNORE INTO commission_config (type, label, rate_percent) VALUES (?, ?, ?)', [c.type, c.label, 2.00]);
          }
          sqliteDb.get('SELECT * FROM wallets WHERE id = 1', (err, row) => {
            if (!row) {
              sqliteDb.run('INSERT INTO wallets (agent_name, balance, pin) VALUES (?, ?, ?)', ['Ibrahim Doumbia', 2450000, '1234']);
            } else if (row.agent_name === 'Kouassi B.') {
              sqliteDb.run('UPDATE wallets SET agent_name = ? WHERE id = 1', ['Ibrahim Doumbia']);
            }
            // Seed Ibrahim as admin agent
            sqliteDb.get('SELECT id FROM agents WHERE email = ?', [IBRAHIM_EMAIL], async (err2, agentRow) => {
              if (!agentRow) {
                const hash = await bcrypt.hash(IBRAHIM_DEFAULT_PASS, BCRYPT_ROUNDS);
                sqliteDb.run(
                  'INSERT INTO agents (name, email, password_hash, role, wallet_id) VALUES (?, ?, ?, ?, ?)',
                  ['Ibrahim Doumbia', IBRAHIM_EMAIL, hash, 'admin', 1]
                );
                console.log('👤 Agent admin Ibrahim créé — email:', IBRAHIM_EMAIL);
              }
              resolve();
            });
          });
        });
      });
      // Migrate: add missing columns
      await new Promise(resolve => sqliteDb.run('ALTER TABLE agents ADD COLUMN email_verified INTEGER DEFAULT 0', () => resolve()));
      const cols = ['geniuspay_payout_id', 'idempotency_key', 'fees', 'geniuspay_provider'];
      for (const col of cols) {
        await new Promise((resolve) => {
          const type = col === 'fees' ? 'INTEGER DEFAULT 0' : 'TEXT';
          sqliteDb.run(`ALTER TABLE transactions ADD COLUMN ${col} ${type}`, () => resolve());
        });
      }
      const walletCols = [
        'daily_limit INTEGER DEFAULT 2000000',
        'alert_threshold INTEGER DEFAULT 50000',
      ];
      for (const col of walletCols) {
        const colName = col.split(' ')[0];
        await new Promise(resolve => sqliteDb.run(`ALTER TABLE wallets ADD COLUMN ${col}`, () => resolve()));
      }
    }
    console.log('✅ Base de données initialisée.');
  } catch (err) {
    console.error('❌ Erreur init DB:', err.message);
  }
}

// Connect DB
if (isPostgres) {
  pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.log('🐘 PostgreSQL connecté.');
} else {
  const dbPath = join(__dirname, 'cabine.sqlite');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ Erreur SQLite:', err.message);
    else console.log('📦 SQLite connecté.');
  });
}
initDb();

// ==========================================
// GENIUSPAY SERVICE — API RÉELLE
// ==========================================

function formatPhoneCI(phone) {
  let cleaned = phone.replace(/[\s\-\.]/g, '');
  if (cleaned.startsWith('+225')) return cleaned;
  if (cleaned.startsWith('225')) return '+' + cleaned;
  // Conserver le 0 initial CI — +225 + 07XXXXXXXX = +2250700000000 (format correct)
  return '+225' + cleaned;
}

function mapProviderToPayout(provider) {
  const map = {
    'orange': { type: 'mobile_money', provider: 'orange_money', mmo: 'ORANGE_CIV' },
    'mtn':    { type: 'mobile_money', provider: 'mtn_money',    mmo: 'MTN_MOMO_CIV' },
    'wave':   { type: 'mobile_money', provider: 'wave',         mmo: 'WAVE_CIV' },
    'moov':   { type: 'mobile_money', provider: 'moov_money',   mmo: 'MOOV_CIV' },
  };
  return map[provider] || map['orange'];
}

async function geniusPayRequest(method, endpoint, body = null) {
  const url = `${GENIUSPAY_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${GENIUSPAY_API_KEY}`,
    'X-API-Key': GENIUSPAY_PK,
    'X-API-Secret': GENIUSPAY_SK,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  console.log(`[GENIUSPAY ${method}] ${url}`);
  const res = await fetch(url, opts);
  
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error(`[GENIUSPAY] Réponse non-JSON (${res.status}):`, text.substring(0, 200));
    throw new Error(`GeniusPay a retourné une réponse non-JSON (HTTP ${res.status}). L'endpoint ${endpoint} n'est peut-être pas accessible.`);
  }

  const data = await res.json();

  if (!res.ok) {
    console.error(`[GENIUSPAY ERROR ${res.status}]`, JSON.stringify(data));
    throw new Error(data?.error?.message || data?.message || `API Error ${res.status}`);
  }
  return data;
}

// Auto-discover wallet
async function discoverWallet() {
  try {
    const data = await geniusPayRequest('GET', '/wallets');
    if (data?.data?.wallets?.length > 0) {
      discoveredWalletId = data.data.wallets[0].id;
      console.log(`💰 Wallet découvert: ${discoveredWalletId}`);
      geniusPayConnected = true;
      return;
    }
    // Try creating a wallet
    const create = await geniusPayRequest('POST', '/wallets', {
      name: 'Cabine 2.0 Wallet', type: 'payout', currency: 'XOF',
      daily_limit: 10000000, monthly_limit: 100000000
    });
    if (create?.data?.id) {
      discoveredWalletId = create.data.id;
      console.log(`💰 Wallet créé: ${discoveredWalletId}`);
    }
    geniusPayConnected = true;
  } catch (err) {
    console.warn('⚠️ Impossible de découvrir le wallet:', err.message);
    console.warn('⚠️ Mode fallback activé (simulateur local).');
    geniusPayConnected = false;
  }
}

// Check connection
async function checkGeniusPayConnection() {
  try {
    await geniusPayRequest('GET', '/account');
    geniusPayConnected = true;
    console.log('✅ GeniusPay connecté avec succès!');
  } catch (err) {
    geniusPayConnected = false;
    console.warn('⚠️ GeniusPay non connecté:', err.message);
  }
}

// PAYOUT: Envoyer de l'argent au client
async function executeGeniusPayPayout(phone, amount, provider, txId) {
  const formattedPhone = formatPhoneCI(phone);
  const dest = mapProviderToPayout(provider);
  const idempotencyKey = `CABINE-TX-${txId}-${Date.now()}`;

  if (!geniusPayConnected) {
    if (GENIUSPAY_MODE === 'live') {
      // En mode Live, on ne simule jamais — l'erreur doit être visible
      console.error('[LIVE MODE] GeniusPay non connecté — paiement impossible.');
      return { success: false, error: 'GeniusPay indisponible. Vérifiez votre connexion API.', idempotencyKey };
    }
    console.log(`[SIMULATEUR SANDBOX] Payout ${amount} XOF → ${formattedPhone} (${provider})`);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, ref: 'SIM-' + Date.now(), payoutId: 'SIM-PYT-' + txId, fees: 0, idempotencyKey });
      }, 1500);
    });
  }

  try {
    const payload = {
      wallet_id: discoveredWalletId,
      recipient: { name: 'Client Cabine', phone: formattedPhone },
      destination: { type: dest.type, provider: dest.provider, account: formattedPhone },
      amount: amount,
      currency: 'XOF',
      description: `Transfert Cabine 2.0 - TX#${txId} - ${provider.toUpperCase()}`,
      metadata: { cabine_tx_id: String(txId), provider, original_phone: phone },
      idempotency_key: idempotencyKey,
    };

    console.log(`[GENIUSPAY PAYOUT] ${amount} XOF → ${formattedPhone} (${dest.provider})`);
    const data = await geniusPayRequest('POST', '/payouts', payload);

    const payout = data?.data?.payout;
    if (payout) {
      return {
        success: true,
        ref: payout.reference,
        payoutId: payout.id,
        fees: payout.fees || 0,
        status: payout.status,
        idempotencyKey,
      };
    }
    return { success: true, ref: data?.data?.reference || 'GP-' + Date.now(), payoutId: '', fees: 0, idempotencyKey };
  } catch (error) {
    console.error('[GENIUSPAY PAYOUT ERROR]', error.message);
    return { success: false, error: error.message, idempotencyKey };
  }
}

// Poll payout status
async function pollPayoutStatus(reference, txId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const data = await geniusPayRequest('GET', `/payouts/${reference}`);
      const status = data?.data?.payout?.status;
      console.log(`[POLL] TX ${txId} → Payout ${reference} status: ${status}`);

      if (status === 'completed') {
        await queryRunUpdate('UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?',
          ['SUCCESS', reference, txId]);
        console.log(`✅ TX ${txId} SUCCÈS via GeniusPay (${reference})`);
        return;
      }
      if (status === 'failed' || status === 'cancelled') {
        await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
        const tx = await queryGet('SELECT amount FROM transactions WHERE id = ?', [txId]);
        if (tx) await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = 1', [tx.amount]);
        console.log(`❌ TX ${txId} ÉCHEC. Remboursement effectué.`);
        return;
      }
    } catch (err) {
      console.warn(`[POLL ERROR] Attempt ${i+1}:`, err.message);
    }
  }
  // Timeout: mark as pending for manual check
  console.warn(`⚠️ TX ${txId} timeout après ${maxAttempts} tentatives. Vérification manuelle requise.`);
}

// Init GeniusPay with retry (3 attempts, 5s apart)
(async () => {
  if (!GENIUSPAY_API_KEY && !GENIUSPAY_PK) {
    console.warn('⚠️ Aucune clé GeniusPay. Mode simulateur activé.');
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await checkGeniusPayConnection();
      if (geniusPayConnected) {
        if (!discoveredWalletId) await discoverWallet();
        console.log(`✅ GeniusPay initialisé (tentative ${attempt})`);
        return;
      }
    } catch (e) {
      console.warn(`⚠️ GeniusPay init tentative ${attempt}/3 échouée:`, e.message);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 5000));
  }
  console.warn('⚠️ GeniusPay indisponible après 3 tentatives. Simulateur actif.');
})();

// ==========================================
// EMAIL SERVICE (Resend) — optionnel, activer via RESEND_API_KEY
// ==========================================
const RESEND_API_KEY   = process.env.RESEND_API_KEY   || '';
const FROM_EMAIL       = process.env.FROM_EMAIL       || 'Cabine 2.0 <noreply@cabine.ci>';
const AT_API_KEY       = process.env.AT_API_KEY       || ''; // Africa's Talking SMS
const AT_USERNAME      = process.env.AT_USERNAME      || 'sandbox';
const AT_SENDER        = process.env.AT_SENDER        || 'CABINE';
const AT_SHORTCODE     = process.env.AT_SHORTCODE     || '';

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return; // désactivé si clé non configurée
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.json();
      log('WARN', 'Email non envoyé', { to, error: err?.message });
    } else {
      log('INFO', 'Email envoyé', { to, subject });
    }
  } catch (e) {
    log('WARN', 'Erreur email', { to, error: e.message });
  }
}

function agentWelcomeHtml(name, email, password, verifyUrl = null) {
  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 36px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px">⚡ Cabine 2.0</div>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px">Votre accès agent est prêt</p>
    </div>
    <div style="padding:32px 36px">
      <p style="font-size:17px;font-weight:700;color:#111827;margin:0 0 8px">Bonjour ${name} 👋</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
        Votre compte agent sur la plateforme Cabine 2.0 a été créé. Vous pouvez maintenant vous connecter et démarrer vos transactions.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Vos identifiants</div>
        <div style="margin-bottom:10px">
          <span style="font-size:12px;color:#9ca3af">Email</span><br>
          <strong style="font-size:15px;color:#111827">${email}</strong>
        </div>
        <div>
          <span style="font-size:12px;color:#9ca3af">Mot de passe provisoire</span><br>
          <strong style="font-size:18px;color:#6366f1;font-family:monospace;letter-spacing:2px">${password}</strong>
        </div>
      </div>
      ${verifyUrl ? `<a href="${verifyUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;margin-bottom:12px">
        ✅ Vérifier mon email &amp; activer le compte
      </a>` : ''}
      <a href="https://cabine.ci" style="display:block;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px">
        Se connecter sur Cabine 2.0
      </a>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0">
        Changez votre mot de passe dès la première connexion.<br>
        Code PIN par défaut : <strong>1234</strong> — à modifier impérativement.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ==========================================
// SMS SERVICE — Africa's Talking
// ==========================================
async function sendSMS(to, message) {
  if (!AT_API_KEY || AT_API_KEY === '') return;
  const phone = to.startsWith('+') ? to : (to.startsWith('225') ? '+' + to : '+225' + to.replace(/\D/g, ''));
  try {
    const body = new URLSearchParams({ username: AT_USERNAME, to: phone, message });
    if (AT_SHORTCODE) body.append('from', AT_SHORTCODE);
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { apiKey: AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    log('INFO', 'SMS envoyé', { to: phone, status: data?.SMSMessageData?.Recipients?.[0]?.status });
  } catch (e) { log('WARN', 'SMS échoué', { to, error: e.message }); }
}

function smsConfirmationClient(type, amount, phone, ref) {
  const fmtAmt = new Intl.NumberFormat('fr-FR').format(amount);
  const msgs = {
    TRANSFER: `Cabine 2.0: Vous avez reçu ${fmtAmt} FCFA. Ref: ${ref}. Votre agent vous a effectué ce transfert.`,
    RETRAIT:  `Cabine 2.0: Votre retrait de ${fmtAmt} FCFA a été pris en charge. Ref: ${ref}.`,
    AIRTIME:  `Cabine 2.0: Votre crédit de ${fmtAmt} FCFA a été rechargé avec succès. Ref: ${ref}.`,
    INTERNET: `Cabine 2.0: Votre forfait internet a été activé. Ref: ${ref}.`,
  };
  return msgs[type] || `Cabine 2.0: Transaction ${fmtAmt} FCFA confirmée. Ref: ${ref}.`;
}

function resetPasswordHtml(name, resetUrl) {
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 36px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px">⚡ Cabine 2.0</div>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px">Réinitialisation du mot de passe</p>
    </div>
    <div style="padding:32px 36px">
      <p style="font-size:17px;font-weight:700;color:#111827;margin:0 0 8px">Bonjour ${name},</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
        Vous avez demandé la réinitialisation de votre mot de passe. Ce lien expire dans <strong>1 heure</strong>.
      </p>
      <a href="${resetUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px">
        Réinitialiser mon mot de passe
      </a>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0">
        Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe reste inchangé.
      </p>
    </div>
  </div></body></html>`;
}

async function sendLowBalanceAlert(agentEmail, agentName, balance, threshold) {
  const html = `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#f59e0b;padding:24px 36px;text-align:center">
      <div style="font-size:24px;font-weight:900;color:#fff;">⚠️ Solde bas — Cabine 2.0</div>
    </div>
    <div style="padding:32px 36px">
      <p style="font-size:16px;color:#111827;margin:0 0 16px">Bonjour <strong>${agentName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 16px">
        Votre solde flotte est passé sous le seuil d'alerte configuré.
      </p>
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:20px">
        <div style="font-size:12px;color:#92400e;font-weight:700">SOLDE ACTUEL</div>
        <div style="font-size:28px;font-weight:900;color:#92400e">${new Intl.NumberFormat('fr-FR').format(balance)} FCFA</div>
        <div style="font-size:12px;color:#b45309">Seuil d'alerte : ${new Intl.NumberFormat('fr-FR').format(threshold)} FCFA</div>
      </div>
      <a href="https://cabine.ci" style="display:block;text-align:center;background:#f59e0b;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px">
        Recharger mon compte
      </a>
    </div>
  </div></body></html>`;
  await sendEmail(agentEmail, '⚠️ Solde flotte bas — Cabine 2.0', html);
}

// ==========================================
// INPUT VALIDATION HELPERS
// ==========================================
const MIN_AMOUNT = 100;       // 100 FCFA minimum
const MAX_AMOUNT = 5000000;   // 5 000 000 FCFA maximum per transaction

function validateOperationInput(provider, phone, amount, pin) {
  if (!provider || !['orange','mtn','wave','moov'].includes(provider))
    return 'Opérateur invalide.';
  if (!phone || phone.replace(/[\s\-\.+]/g, '').length < 8)
    return 'Numéro de téléphone invalide.';
  if (!amount || amount < MIN_AMOUNT || amount > MAX_AMOUNT)
    return `Montant invalide. Min: ${MIN_AMOUNT.toLocaleString('fr-FR')} FCFA, Max: ${MAX_AMOUNT.toLocaleString('fr-FR')} FCFA.`;
  if (!pin || !/^\d{4}$/.test(pin))
    return 'Code PIN invalide (4 chiffres requis).';
  return null;
}

// ==========================================
// API ROUTES
// ==========================================

// Forfaits opérateurs — servis côté serveur pour mise à jour centralisée
// ==========================================
// AUTH MIDDLEWARE + ROUTES
// ==========================================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Non authentifié. Connectez-vous.' });
  if (tokenBlacklist.has(token)) return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
  try {
    req.agent = jwt.verify(token, JWT_SECRET);
    if (req.agent.jwtId && activeSessions.has(req.agent.jwtId)) {
      activeSessions.get(req.agent.jwtId).lastSeen = Date.now();
    }
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
  }
}

// Login
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  try {
    const agent = await queryGet('SELECT * FROM agents WHERE email = ? AND active = TRUE', [email.toLowerCase().trim()]);
    if (!agent) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    const token = jwt.sign(
      { agentId: agent.id, name: agent.name, email: agent.email, role: agent.role, walletId: agent.wallet_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Admin → 2FA OTP avant d'émettre le JWT
    if (agent.role === 'admin') {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      twoFATokens.set(agent.email.toLowerCase(), { otp, expires: Date.now() + 600000, attempts: 0 });
      await sendEmail(agent.email, `[Cabine 2.0] Code de sécurité : ${otp}`,
        `<div style="font-family:sans-serif;max-width:400px;margin:40px auto;background:#fff;border-radius:16px;padding:32px;text-align:center;border:1px solid #e5e7eb"><div style="width:56px;height:56px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:24px">⚡</div><h2 style="color:#111827;font-size:18px;margin-bottom:8px">Vérification de connexion</h2><p style="color:#6b7280;font-size:14px;margin-bottom:24px">Code de sécurité pour votre session admin Cabine 2.0</p><div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px"><span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#6366f1">${otp}</span></div><p style="color:#9ca3af;font-size:12px">Valable 10 minutes. Ne le partagez jamais.</p></div>`
      ).catch(() => {});
      log('INFO', '2FA OTP envoyé admin', { agent: agent.email });
      return res.json({ requires_2fa: true, email: agent.email, message: 'Code de sécurité envoyé sur votre email.' });
    }
    const jwtId = uuidv4();
    const token = jwt.sign(
      { jwtId, agentId: agent.id, name: agent.name, email: agent.email, role: agent.role, walletId: agent.wallet_id },
      JWT_SECRET, { expiresIn: '7d' }
    );
    activeSessions.set(jwtId, { agentId: agent.id, email: agent.email, role: agent.role, ip: req.ip, createdAt: Date.now(), lastSeen: Date.now() });
    log('INFO', 'Login réussi', { agent: agent.email, role: agent.role });
    res.json({ token, agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, walletId: agent.wallet_id, emailVerified: !!agent.email_verified } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const agent = await queryGet('SELECT id, name, email, role, wallet_id, email_verified FROM agents WHERE id = ?', [req.agent.agentId]);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
    res.json({ ...agent, walletId: agent.wallet_id, emailVerified: !!agent.email_verified });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Register (admin only)
app.post('/api/auth/register', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Accès administrateur requis.' });
  const { name, email, password, initialBalance = 0 } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
  try {
    // Create wallet for new agent
    const walletId = await queryRunInsert(
      'INSERT INTO wallets (agent_name, balance, pin) VALUES (?, ?, ?)',
      [name, parseInt(initialBalance, 10), '1234']
    );
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const agentId = await queryRunInsert(
      'INSERT INTO agents (name, email, password_hash, role, wallet_id) VALUES (?, ?, ?, ?, ?)',
      [name, email.toLowerCase().trim(), hash, 'agent', walletId]
    );
    log('INFO', 'Nouvel agent créé', { name, email, walletId, by: req.agent.email });
    // Générer token de vérification email (KYC step 1)
    const verifyToken = crypto.randomBytes(32).toString('hex');
    emailVerifyTokens.set(verifyToken, { agentId, email: email.toLowerCase(), expires: Date.now() + 86400000 });
    const verifyUrl = `${APP_DOMAIN}/?verify_email=${verifyToken}`;
    // Email de bienvenue avec lien de vérification (non-bloquant)
    sendEmail(email, 'Bienvenue sur Cabine 2.0 — Activez votre compte', agentWelcomeHtml(name, email, password, verifyUrl)).catch(() => {});
    res.json({ id: agentId, name, email, walletId, message: 'Agent créé avec succès. PIN par défaut: 1234' });
  } catch (err) {
    if (err.message?.includes('UNIQUE') || err.code === '23505') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// List agents (admin only)
app.get('/api/agents', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Accès administrateur requis.' });
  try {
    const agents = await queryAll(
      'SELECT a.id, a.name, a.email, a.role, a.active, a.created_at, w.balance FROM agents a LEFT JOIN wallets w ON a.wallet_id = w.id ORDER BY a.created_at ASC'
    );
    res.json(agents);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Toggle agent active (admin only)
app.put('/api/agents/:id/toggle', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Accès administrateur requis.' });
  try {
    const agent = await queryGet('SELECT id, active FROM agents WHERE id = ?', [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
    const newActive = !agent.active;
    await queryRunUpdate('UPDATE agents SET active = ? WHERE id = ?', [newActive, req.params.id]);
    res.json({ active: newActive });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 2FA Vérification OTP (admin) ──
app.post('/api/auth/verify-2fa', authRateLimiter, async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'Email et code requis.' });
  const entry = twoFATokens.get(email.toLowerCase());
  if (!entry || Date.now() > entry.expires) return res.status(400).json({ error: 'Code expiré. Reconnectez-vous.' });
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > 5) { twoFATokens.delete(email.toLowerCase()); return res.status(429).json({ error: 'Trop de tentatives. Reconnectez-vous.' }); }
  if (entry.otp !== otp.trim()) return res.status(401).json({ error: `Code incorrect. ${5 - entry.attempts} essai(s) restant(s).` });
  twoFATokens.delete(email.toLowerCase());
  try {
    const agent = await queryGet('SELECT * FROM agents WHERE email = ? AND active = TRUE', [email.toLowerCase()]);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
    const jwtId = uuidv4();
    const token = jwt.sign(
      { jwtId, agentId: agent.id, name: agent.name, email: agent.email, role: agent.role, walletId: agent.wallet_id },
      JWT_SECRET, { expiresIn: '7d' }
    );
    activeSessions.set(jwtId, { agentId: agent.id, email: agent.email, role: agent.role, ip: req.ip, createdAt: Date.now(), lastSeen: Date.now() });
    log('INFO', '2FA validé — Login admin complet', { agent: agent.email });
    res.json({ token, agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, walletId: agent.wallet_id, emailVerified: !!agent.email_verified } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sessions actives (admin)
app.get('/api/auth/sessions', authMiddleware, (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  const sessions = [];
  for (const [jwtId, s] of activeSessions) {
    sessions.push({ jwtId: jwtId.slice(0, 8) + '...', ...s, isCurrent: req.agent.jwtId === jwtId });
  }
  res.json(sessions.sort((a, b) => b.lastSeen - a.lastSeen));
});

// Vérification email (KYC step 1)
app.get('/api/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  const entry = token ? emailVerifyTokens.get(token) : null;
  if (!entry || Date.now() > entry.expires) {
    return res.redirect(`${APP_DOMAIN}/?error=invalid_verify_token`);
  }
  try {
    await queryRunUpdate('UPDATE agents SET email_verified = TRUE WHERE id = ?', [entry.agentId]);
    emailVerifyTokens.delete(token);
    log('INFO', 'Email vérifié (KYC)', { email: entry.email });
    res.redirect(`${APP_DOMAIN}/?verified=1`);
  } catch (err) {
    res.redirect(`${APP_DOMAIN}/?error=verify_failed`);
  }
});

// Renvoyer le lien de vérification
app.post('/api/auth/resend-verify', authMiddleware, async (req, res) => {
  if (req.agent.role === 'admin') return res.json({ message: 'Compte admin déjà vérifié.' });
  const agent = await queryGet('SELECT id, name, email, email_verified FROM agents WHERE id = ?', [req.agent.agentId]);
  if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
  if (agent.email_verified) return res.json({ message: 'Email déjà vérifié.' });
  const verifyToken = crypto.randomBytes(32).toString('hex');
  emailVerifyTokens.set(verifyToken, { agentId: agent.id, email: agent.email, expires: Date.now() + 86400000 });
  const verifyUrl = `${APP_DOMAIN}/?verify_email=${verifyToken}`;
  await sendEmail(agent.email, '✅ Vérifiez votre email Cabine 2.0', `<p>Cliquez ici pour vérifier votre compte : <a href="${verifyUrl}">${verifyUrl}</a></p>`);
  res.json({ message: 'Lien de vérification envoyé.' });
});

// Déconnexion (révoque le token)
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  if (token) tokenBlacklist.add(token);
  res.json({ message: 'Déconnecté.' });
});

// Mot de passe oublié
app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  try {
    const agent = await queryGet('SELECT id, name, email FROM agents WHERE email = ?', [email.toLowerCase().trim()]);
    // Toujours répondre OK pour ne pas révéler si l'email existe
    res.json({ message: 'Si cet email est enregistré, vous recevrez un lien de réinitialisation dans quelques minutes.' });
    if (!agent) return;
    const token = crypto.randomBytes(32).toString('hex');
    resetTokens.set(email.toLowerCase(), { token, expires: Date.now() + 3600000 });
    const resetUrl = `${APP_DOMAIN}/?reset_token=${token}&email=${encodeURIComponent(email.toLowerCase())}`;
    await sendEmail(email, 'Réinitialisation de votre mot de passe — Cabine 2.0', resetPasswordHtml(agent.name, resetUrl));
    log('INFO', 'Reset password demandé', { email });
  } catch (err) { log('ERROR', 'forgot-password', { error: err.message }); }
});

// Réinitialiser le mot de passe (via token email)
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !token || !newPassword)
    return res.status(400).json({ error: 'Données manquantes.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (minimum 6 caractères).' });
  const entry = resetTokens.get(email.toLowerCase());
  if (!entry || entry.token !== token || Date.now() > entry.expires)
    return res.status(400).json({ error: 'Lien invalide ou expiré. Faites une nouvelle demande.' });
  try {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await queryRunUpdate('UPDATE agents SET password_hash = ? WHERE email = ?', [hash, email.toLowerCase()]);
    resetTokens.delete(email.toLowerCase());
    log('INFO', 'Mot de passe réinitialisé', { email });
    res.json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Changer son propre mot de passe (authentifié)
app.put('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Nouveau mot de passe trop court (minimum 6 caractères).' });
  try {
    const agent = await queryGet('SELECT password_hash FROM agents WHERE id = ?', [req.agent.agentId]);
    const valid = await bcrypt.compare(currentPassword, agent.password_hash);
    if (!valid) return res.status(403).json({ error: 'Mot de passe actuel incorrect.' });
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await queryRunUpdate('UPDATE agents SET password_hash = ? WHERE id = ?', [hash, req.agent.agentId]);
    log('INFO', 'Mot de passe changé', { agent: req.agent.email });
    res.json({ message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ADMIN — SUPERVISION + RECHARGE + FACTURATION
// ==========================================

// Vue d'ensemble superviseur
app.get('/api/admin/overview', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  try {
    const agents = await queryAll(
      `SELECT a.id, a.name, a.email, a.role, a.active, a.created_at,
        w.balance,
        COUNT(t.id) as today_tx,
        SUM(CASE WHEN t.status='SUCCESS' THEN 1 ELSE 0 END) as today_success,
        SUM(CASE WHEN t.status='SUCCESS' THEN t.amount ELSE 0 END) as today_volume
       FROM agents a
       LEFT JOIN wallets w ON a.wallet_id = w.id
       LEFT JOIN transactions t ON t.wallet_id = w.id AND DATE(t.created_at) = ${isPostgres ? 'CURRENT_DATE' : "DATE('now')"}
       GROUP BY a.id, a.name, a.email, a.role, a.active, a.created_at, w.balance
       ORDER BY a.created_at ASC`
    );
    const summary = {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.active).length,
      totalFloat: agents.reduce((s, a) => s + (parseInt(a.balance) || 0), 0),
      todayTx: agents.reduce((s, a) => s + (parseInt(a.today_tx) || 0), 0),
      todayVolume: agents.reduce((s, a) => s + (parseInt(a.today_volume) || 0), 0),
      todaySuccess: agents.reduce((s, a) => s + (parseInt(a.today_success) || 0), 0),
    };
    res.json({ summary, agents });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Recharger le solde d'un agent (ou 'self' pour l'admin lui-même)
app.post('/api/admin/recharge/:agentId', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  const { amount, description = 'Recharge admin' } = req.body;
  const numAmount = parseInt(amount, 10);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
  try {
    const targetId = req.params.agentId === 'self' ? req.agent.agentId : req.params.agentId;
    const agent = await queryGet('SELECT id, wallet_id, name FROM agents WHERE id = ?', [targetId]);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
    await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [numAmount, agent.wallet_id]);
    await queryRunInsert(
      'INSERT INTO balance_ledger (wallet_id, amount, type, description, done_by) VALUES (?, ?, ?, ?, ?)',
      [agent.wallet_id, numAmount, 'RECHARGE', description, req.agent.agentId]
    );
    const wallet = await queryGet('SELECT balance FROM wallets WHERE id = ?', [agent.wallet_id]);
    log('INFO', `Recharge ${agent.name}: +${numAmount} FCFA`, { by: req.agent.email });
    notifyWallet(agent.wallet_id, 'balance_update', { balance: wallet.balance, type: 'RECHARGE', amount: numAmount });
    res.json({ message: `+${numAmount} FCFA crédités à ${agent.name}`, newBalance: wallet.balance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lister les factures
app.get('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const sql = req.agent.role === 'admin'
      ? 'SELECT i.*, a.name as agent_name, a.email FROM invoices i JOIN agents a ON i.agent_id = a.id ORDER BY i.created_at DESC LIMIT 100'
      : 'SELECT i.*, a.name as agent_name FROM invoices i JOIN agents a ON i.agent_id = a.id WHERE i.agent_id = ? ORDER BY i.created_at DESC LIMIT 24';
    const params = req.agent.role === 'admin' ? [] : [req.agent.agentId];
    const rows = await queryAll(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Générer les factures du mois (admin)
app.post('/api/invoices/generate', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  const { period, amount = 10000 } = req.body;
  const p = period || new Date().toISOString().slice(0, 7);
  try {
    const agents = await queryAll("SELECT id, wallet_id FROM agents WHERE role = 'agent' AND active = TRUE");
    let created = 0;
    for (const ag of agents) {
      const existing = await queryGet('SELECT id FROM invoices WHERE agent_id = ? AND period = ?', [ag.id, p]);
      if (!existing) {
        await queryRunInsert(
          'INSERT INTO invoices (agent_id, wallet_id, period, amount, status) VALUES (?, ?, ?, ?, ?)',
          [ag.id, ag.wallet_id, p, parseInt(amount, 10), 'pending']
        );
        created++;
      }
    }
    res.json({ message: `${created} facture(s) générée(s) pour ${p}`, period: p });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Marquer facture comme payée + débiter le wallet
app.put('/api/invoices/:id/pay', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  try {
    const inv = await queryGet('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Déjà payée.' });
    await queryRunUpdate('UPDATE wallets SET balance = balance - ? WHERE id = ?', [inv.amount, inv.wallet_id]);
    await queryRunUpdate(
      `UPDATE invoices SET status = 'paid', paid_at = ${isPostgres ? 'NOW()' : "datetime('now')"} WHERE id = ?`,
      [inv.id]
    );
    await queryRunInsert(
      'INSERT INTO balance_ledger (wallet_id, amount, type, description, done_by) VALUES (?, ?, ?, ?, ?)',
      [inv.wallet_id, -inv.amount, 'ABONNEMENT', `Abonnement ${inv.period}`, req.agent.agentId]
    );
    res.json({ message: 'Facture marquée comme payée.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Historique recharges wallet
app.get('/api/wallet/ledger', authMiddleware, async (req, res) => {
  try {
    const wid = req.agent.role === 'admin' && req.query.walletId
      ? req.query.walletId : req.agent.walletId;
    const rows = await queryAll(
      'SELECT * FROM balance_ledger WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 50',
      [wid]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// COMMISSIONS
// ==========================================

// Lire toutes les commissions
app.get('/api/commissions', authMiddleware, async (req, res) => {
  try {
    const rows = await queryAll('SELECT * FROM commission_config ORDER BY type');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mettre à jour une commission (admin)
app.put('/api/commissions/:type', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  const { type } = req.params;
  const { rate_percent } = req.body;
  if (!['transfer', 'withdraw', 'airtime', 'internet'].includes(type))
    return res.status(400).json({ error: 'Type invalide.' });
  const rate = parseFloat(rate_percent);
  if (isNaN(rate) || rate < 0 || rate > 20)
    return res.status(400).json({ error: 'Taux invalide (0–20%).' });
  try {
    await queryRunUpdate(
      `UPDATE commission_config SET rate_percent = ?, updated_at = ${isPostgres ? 'NOW()' : "datetime('now')"}, updated_by = ? WHERE type = ?`,
      [rate, req.agent.agentId, type]
    );
    log('INFO', `Commission ${type} → ${rate}%`, { by: req.agent.email });
    res.json({ type, rate_percent: rate, message: `Commission ${type} mise à jour à ${rate}%.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// SSE ENDPOINT — stream temps réel des mises à jour
// ==========================================
app.get('/api/events', (req, res) => {
  // EventSource ne supporte pas les headers custom — token en query param
  const token = req.query.token;
  if (!token) return res.status(401).end();
  if (tokenBlacklist.has(token)) return res.status(401).end();
  let agent;
  try { agent = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).end(); }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering Nginx/Render
  res.flushHeaders();

  const wid = String(agent.walletId);
  if (!sseClients.has(wid)) sseClients.set(wid, new Set());
  sseClients.get(wid).add(res);
  log('INFO', 'SSE connecté', { walletId: wid, agent: agent.email });

  res.write(`event: connected\ndata: ${JSON.stringify({ walletId: wid, ts: Date.now() })}\n\n`);

  // Heartbeat toutes les 25s pour maintenir la connexion vivante
  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(wid)?.delete(res);
    if (sseClients.get(wid)?.size === 0) sseClients.delete(wid);
    log('INFO', 'SSE déconnecté', { walletId: wid });
  });
});

// Synchroniser le solde local depuis GeniusPay (admin)
app.post('/api/admin/sync-balance', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  try {
    const data = await geniusPayRequest('GET', '/wallets');
    const wallets = data?.data?.wallets || [];
    if (!wallets.length) return res.status(404).json({ error: 'Aucun wallet GeniusPay trouvé.' });
    const gpWallet = wallets.find(w => w.id === discoveredWalletId) || wallets[0];
    const gpBalance = Math.floor(parseFloat(gpWallet.available_balance || gpWallet.balance || 0));
    const targetId = req.body?.agentId || req.agent.agentId;
    const agent = await queryGet('SELECT wallet_id FROM agents WHERE id = ?', [targetId]);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = ?', [gpBalance, agent.wallet_id]);
    await queryRunInsert(
      'INSERT INTO balance_ledger (wallet_id, amount, type, description, done_by) VALUES (?, ?, ?, ?, ?)',
      [agent.wallet_id, gpBalance, 'SYNC_GENIUSPAY', `Sync GeniusPay: ${gpBalance} FCFA`, req.agent.agentId]
    );
    notifyWallet(agent.wallet_id, 'balance_update', { balance: gpBalance, type: 'SYNC' });
    log('INFO', `Sync GeniusPay: solde mis à ${gpBalance} FCFA`, { by: req.agent.email });
    res.json({ message: `Solde synchronisé depuis GeniusPay : ${new Intl.NumberFormat('fr-FR').format(gpBalance)} FCFA`, balance: gpBalance, gpWalletId: gpWallet.id });
  } catch (err) {
    res.status(500).json({ error: `Impossible de lire le solde GeniusPay : ${err.message}` });
  }
});

// Définir un solde exact (admin) — pour corriger le solde test
app.put('/api/admin/set-balance/:agentId', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  const { balance, reason = 'Correction manuelle du solde' } = req.body;
  const newBalance = parseInt(balance, 10);
  if (isNaN(newBalance) || newBalance < 0) return res.status(400).json({ error: 'Solde invalide.' });
  try {
    const targetId = req.params.agentId === 'self' ? req.agent.agentId : req.params.agentId;
    const agent = await queryGet('SELECT id, wallet_id, name FROM agents WHERE id = ?', [targetId]);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
    const old = await queryGet('SELECT balance FROM wallets WHERE id = ?', [agent.wallet_id]);
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = ?', [newBalance, agent.wallet_id]);
    await queryRunInsert(
      'INSERT INTO balance_ledger (wallet_id, amount, type, description, done_by) VALUES (?, ?, ?, ?, ?)',
      [agent.wallet_id, newBalance - (old?.balance || 0), 'SET_BALANCE', reason, req.agent.agentId]
    );
    notifyWallet(agent.wallet_id, 'balance_update', { balance: newBalance, type: 'SET' });
    log('INFO', `Solde ${agent.name} défini à ${newBalance} FCFA (était ${old?.balance})`, { by: req.agent.email });
    res.json({ message: `Solde de ${agent.name} défini à ${new Intl.NumberFormat('fr-FR').format(newBalance)} FCFA`, balance: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Configurer seuil d'alerte solde bas
app.put('/api/wallet/alert-threshold', authMiddleware, async (req, res) => {
  const { threshold } = req.body;
  const val = parseInt(threshold, 10);
  if (isNaN(val) || val < 0) return res.status(400).json({ error: 'Seuil invalide.' });
  try {
    await queryRunUpdate('UPDATE wallets SET alert_threshold = ? WHERE id = ?', [val, req.agent.walletId]);
    res.json({ message: 'Seuil d\'alerte mis à jour.', threshold: val });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Configurer limite journalière (admin seulement)
app.put('/api/agents/:id/limits', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  const { daily_limit } = req.body;
  const limit = parseInt(daily_limit, 10);
  if (isNaN(limit) || limit < 0) return res.status(400).json({ error: 'Limite invalide.' });
  try {
    const agent = await queryGet('SELECT wallet_id FROM agents WHERE id = ?', [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });
    await queryRunUpdate('UPDATE wallets SET daily_limit = ? WHERE id = ?', [limit, agent.wallet_id]);
    res.json({ message: 'Limite journalière mise à jour.', daily_limit: limit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// DÉPÔTS VIA MOBILE MONEY (CinetPay Collections)
// Admin recharge son compte directement depuis Orange/MTN/Wave/Moov
// ==========================================

// Stocker les dépôts en attente
const pendingDeposits = new Map(); // transactionId → { agentId, walletId, amount, createdAt }

// Initier un dépôt via CinetPay
app.post('/api/wallet/topup/init', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  const { amount, phone } = req.body;
  const numAmount = parseInt(amount, 10);
  if (!numAmount || numAmount < 500) return res.status(400).json({ error: 'Montant minimum : 500 FCFA.' });
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    return res.status(503).json({
      error: 'CinetPay non configuré.',
      setup: 'Ajoutez CINETPAY_API_KEY et CINETPAY_SITE_ID dans les variables Render.',
    });
  }
  try {
    const transactionId = `DEP-${Date.now()}-${req.agent.agentId}`;
    const agent = await queryGet('SELECT name, email, wallet_id FROM agents WHERE id = ?', [req.agent.agentId]);
    const paymentData = await cinetpayCreatePayment({
      amount: numAmount,
      transactionId,
      description: `Recharge flotte Cabine 2.0 — ${agent?.name}`,
      customerName: agent?.name || req.agent.name,
      customerEmail: req.agent.email,
      customerPhone: phone || '',
      returnUrl: `${APP_DOMAIN}/?deposit_success=1&amount=${numAmount}`,
    });
    pendingDeposits.set(transactionId, {
      agentId: req.agent.agentId,
      walletId: agent?.wallet_id || req.agent.walletId,
      amount: numAmount,
      createdAt: Date.now(),
    });
    // Nettoyer après 2h
    setTimeout(() => pendingDeposits.delete(transactionId), 7200000);
    log('INFO', `Dépôt CinetPay initié: ${numAmount} FCFA`, { by: req.agent.email, transactionId });
    res.json({
      transactionId,
      paymentUrl: paymentData.payment_url,
      amount: numAmount,
      message: 'Lien de paiement créé. Payez via votre téléphone.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vérifier manuellement le statut d'un dépôt CinetPay
app.get('/api/wallet/topup/:transactionId/status', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  try {
    const checkRes = await fetch(`${CINETPAY_BASE}/payment/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: CINETPAY_API_KEY,
        site_id: CINETPAY_SITE_ID,
        transaction_id: req.params.transactionId,
      }),
    });
    const data = await checkRes.json();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Webhook CinetPay — confirmation de paiement ──
app.post('/api/webhooks/cinetpay', async (req, res) => {
  res.status(200).send('OK'); // Répondre 200 immédiatement à CinetPay
  try {
    const { cpm_trans_id, cpm_amount, cpm_result, status, payment_method } = req.body;
    log('INFO', '[CINETPAY WEBHOOK]', { transactionId: cpm_trans_id, status, result: cpm_result });
    if (cpm_result !== '00' && status !== 'ACCEPTED') return;
    const deposit = pendingDeposits.get(cpm_trans_id);
    if (!deposit) {
      log('WARN', '[CINETPAY] Dépôt introuvable en mémoire', { transactionId: cpm_trans_id });
      return;
    }
    const amount = parseInt(cpm_amount, 10) || deposit.amount;
    await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amount, deposit.walletId]);
    await queryRunInsert(
      'INSERT INTO balance_ledger (wallet_id, amount, type, description, done_by) VALUES (?, ?, ?, ?, ?)',
      [deposit.walletId, amount, 'DEPOSIT_CINETPAY', `Dépôt ${payment_method || 'Mobile Money'} — ${cpm_trans_id}`, deposit.agentId]
    );
    const wallet = await queryGet('SELECT balance FROM wallets WHERE id = ?', [deposit.walletId]);
    notifyWallet(deposit.walletId, 'balance_update', {
      balance: wallet.balance,
      type: 'DEPOSIT',
      amount,
      method: payment_method,
    });
    pendingDeposits.delete(cpm_trans_id);
    log('INFO', `✅ Dépôt confirmé CinetPay: +${amount} FCFA`, { walletId: deposit.walletId, method: payment_method });
  } catch (err) {
    log('ERROR', '[CINETPAY WEBHOOK] Erreur', { error: err.message });
  }
});

// ── Status public (uptime, santé système) ──
app.get('/api/status', async (req, res) => {
  const uptime = process.uptime();
  const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  let dbOk = false;
  try { await queryGet('SELECT 1 as ok'); dbOk = true; } catch {}
  res.json({
    status: dbOk ? 'operational' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      api: 'operational',
      database: dbOk ? 'operational' : 'down',
      geniuspay: geniusPayConnected ? 'operational' : 'degraded',
    },
    uptime: { seconds: Math.floor(uptime), human: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m` },
    memory_mb: memMB,
    active_sessions: activeSessions.size,
    version: '2.0.0',
  });
});

app.get('/api/bundles', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1h
  res.json(OPERATOR_BUNDLES);
});

// Status GeniusPay
app.get('/api/geniuspay/status', (req, res) => {
  res.json({
    connected: geniusPayConnected,
    mode: GENIUSPAY_MODE,
    walletId: discoveredWalletId ? '***' + String(discoveredWalletId).slice(-6) : null,
    hasKeys: !!(GENIUSPAY_PK && GENIUSPAY_SK),
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connectivity
    const dbHealth = await queryGet('SELECT 1 as health_check');
    
    // Get system metrics
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Get transaction stats (DB-agnostic date syntax)
    const txStats = await queryAll(isPostgres
      ? `SELECT COUNT(*) as total_tx,
           COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as success_tx,
           SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END) as total_volume
         FROM transactions WHERE created_at >= NOW() - INTERVAL '24 hours'`
      : `SELECT COUNT(*) as total_tx,
           COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as success_tx,
           SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END) as total_volume
         FROM transactions WHERE created_at >= datetime('now', '-24 hours')`
    );
    
    res.json({
      status: 'healthy',
      uptime: Math.floor(uptime),
      geniuspay: {
        connected: geniusPayConnected,
        mode: GENIUSPAY_MODE,
        wallet: discoveredWalletId ? 'configured' : 'not_configured'
      },
      database: dbHealth ? 'connected' : 'disconnected',
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      transactions_24h: txStats[0] || { total_tx: 0, success_tx: 0, total_volume: 0 },
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  } catch (error) {
    log('ERROR', 'Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Wallet balance
app.get('/api/wallet', authMiddleware, async (req, res) => {
  try {
    const row = await queryGet('SELECT id, agent_name, balance, alert_threshold FROM wallets WHERE id = ?', [req.agent.walletId]);
    // Vérifier alerte solde bas
    if (row && row.alert_threshold > 0 && row.balance < row.alert_threshold) {
      const ag = await queryGet('SELECT email, name FROM agents WHERE wallet_id = ?', [req.agent.walletId]);
      if (ag) sendLowBalanceAlert(ag.email, ag.name, row.balance, row.alert_threshold).catch(() => {});
    }
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Transaction history
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { status, q, since, until, limit = 50 } = req.query;
    let sql = 'SELECT * FROM transactions';
    const filters = ['wallet_id = ?'];
    const params = [req.agent.walletId];

    if (status && status !== 'all') {
      const normalized = status.toUpperCase();
      filters.push('status = ?');
      params.push(normalized);
    }

    if (q) {
      const search = `%${q}%`;
      filters.push('(phone LIKE ? OR provider LIKE ? OR geniuspay_ref LIKE ? OR CAST(amount AS TEXT) LIKE ?)');
      params.push(search, search, search, search);
    }

    if (since) {
      filters.push('created_at >= ?');
      params.push(since);
    }

    if (until) {
      filters.push('created_at <= ?');
      params.push(until);
    }

    if (filters.length) sql += ` WHERE ${filters.join(' AND ')}`;
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const rows = await queryAll(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/transactions/export', authMiddleware, async (req, res) => {
  try {
    const rows = await queryAll('SELECT * FROM transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 1000', [req.agent.walletId]);
    const header = ['Date','Référence','Opérateur','Téléphone','Montant','Statut','GeniusPay Ref'];
    const lines = rows.map(tx => [
      new Date(tx.created_at).toLocaleString('fr-FR'),
      `TX-${tx.id.toString().padStart(6, '0')}`,
      tx.provider,
      tx.phone,
      tx.amount,
      tx.status,
      tx.geniuspay_ref || ''
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions-cabine-2-0.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change PIN
app.put('/api/wallet/pin', authMiddleware, async (req, res) => {
  const { oldPin, newPin } = req.body;
  if (!oldPin || !newPin) return res.status(400).json({ error: 'Données invalides.' });
  try {
    const wid = req.agent.walletId;
    const wallet = await queryGet('SELECT pin FROM wallets WHERE id = ?', [wid]);
    if (!(await verifyPin(wid, wallet.pin, oldPin))) return res.status(403).json({ error: 'Ancien code PIN incorrect.' });
    const hash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
    await queryRunUpdate('UPDATE wallets SET pin = ? WHERE id = ?', [hash, wid]);
    res.json({ message: 'Code PIN mis à jour avec succès.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === TRANSFER — Cœur du système ===
app.post('/api/transfer', rateLimiter, authMiddleware, async (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);
  const wid = req.agent.walletId;

  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = ?', [wid]);
    if (!(await verifyPin(wid, wallet.pin, pin))) return res.status(403).json({ error: 'Code PIN incorrect. Transaction refusée.' });
    if (wallet.balance < numAmount) return res.status(400).json({ error: 'Solde insuffisant.' });

    const newBalance = wallet.balance - numAmount;
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = ?', [newBalance, wid]);

    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [wid, 'TRANSFER', provider, phone, numAmount, 'PENDING']
    );

    // Répondre immédiatement au client
    res.json({
      message: 'Transaction initiée via GeniusPay',
      txId, status: 'PENDING', newBalance,
      geniuspayConnected: geniusPayConnected,
      mode: GENIUSPAY_MODE,
    });

    // === APPEL GENIUSPAY EN ARRIÈRE-PLAN ===
    const result = await executeGeniusPayPayout(phone, numAmount, provider, txId);

    // Sauvegarder les infos GeniusPay
    if (result.idempotencyKey) {
      await queryRunUpdate('UPDATE transactions SET idempotency_key = ? WHERE id = ?',
        [result.idempotencyKey, txId]);
    }

    if (result.success) {
      const txStatus = result.status === 'pending' ? 'PROCESSING' : 'SUCCESS';
      await queryRunUpdate(
        'UPDATE transactions SET geniuspay_ref = ?, geniuspay_payout_id = ?, fees = ?, status = ? WHERE id = ?',
        [result.ref, result.payoutId || '', result.fees || 0, txStatus, txId]
      );
      console.log(`✅ TX ${txId} envoyée → Ref: ${result.ref}`);
      notifyWallet(wid, 'tx_update', { txId, status: txStatus, ref: result.ref, balance: newBalance });

      // Si le payout est encore pending, poll le statut
      if (result.status === 'pending' && geniusPayConnected) {
        pollPayoutStatus(result.ref, txId).catch(e => console.error('Poll error:', e));
      }
    } else {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
      const refundedBalance = newBalance + numAmount;
      await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [numAmount, wid]);
      console.log(`❌ TX ${txId} échouée: ${result.error}. Remboursement OK.`);
    }
  } catch (err) {
    console.error('Transfer error:', err);
  }
});

// === RETRAIT — Encaissement client ===
app.post('/api/retrait', rateLimiter, authMiddleware, async (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);
  const wid = req.agent.walletId;

  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = ?', [wid]);
    if (!(await verifyPin(wid, wallet.pin, pin)))
      return res.status(403).json({ error: 'Code PIN incorrect. Opération refusée.' });

    await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [numAmount, wid]);

    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [wid, 'RETRAIT', provider, phone, numAmount, 'PENDING']
    );

    // Le retrait = le client envoie ses fonds à l'agent → on confirme immédiatement
    const ref = `RET-${Date.now()}`;
    await queryRunUpdate(
      'UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?',
      ['SUCCESS', ref, txId]
    );
    const newBal = (await queryGet('SELECT balance FROM wallets WHERE id = ?', [wid]))?.balance;
    log('INFO', `Retrait TX ${txId} SUCCÈS`, { ref, amount: numAmount, provider });
    notifyWallet(wid, 'tx_update', { txId, status: 'SUCCESS', ref, balance: newBal });
    res.json({ message: 'Retrait enregistré', txId, status: 'SUCCESS' });
  } catch (err) {
    log('ERROR', 'Retrait error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// === AIRTIME — Recharge crédit téléphonique ===
app.post('/api/airtime', rateLimiter, authMiddleware, async (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);
  const wid = req.agent.walletId;

  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = ?', [wid]);
    if (!(await verifyPin(wid, wallet.pin, pin)))
      return res.status(403).json({ error: 'Code PIN incorrect. Opération refusée.' });
    if (wallet.balance < numAmount)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    const newBalance = wallet.balance - numAmount;
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = ?', [newBalance, wid]);

    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [wid, 'AIRTIME', provider, phone, numAmount, 'PENDING']
    );

    // Répondre immédiatement, traiter GeniusPay en arrière-plan
    res.json({ message: 'Recharge initiée', txId, status: 'PENDING', newBalance });

    const result = await executeGeniusPayPayout(phone, numAmount, provider, txId);
    if (result.success) {
      const txStatus = result.status === 'pending' ? 'PROCESSING' : 'SUCCESS';
      await queryRunUpdate('UPDATE transactions SET status = ?, geniuspay_ref = ?, fees = ? WHERE id = ?',
        [txStatus, result.ref, result.fees || 0, txId]);
      log('INFO', `Airtime TX ${txId} → ${txStatus}`, { ref: result.ref, amount: numAmount, provider });
      notifyWallet(wid, 'tx_update', { txId, status: txStatus, ref: result.ref, balance: newBalance });
      if (result.status === 'pending' && geniusPayConnected) pollPayoutStatus(result.ref, txId).catch(() => {});
    } else {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
      await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [numAmount, wid]);
      log('WARN', `Airtime TX ${txId} ÉCHEC. Remboursé.`, { error: result.error });
      notifyWallet(wid, 'tx_update', { txId, status: 'FAILED', balance: newBalance + numAmount });
    }
  } catch (err) {
    log('ERROR', 'Airtime error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// === INTERNET — Activation forfait data ===
app.post('/api/internet', rateLimiter, authMiddleware, async (req, res) => {
  const { provider, phone, amount, bundle, pin } = req.body;
  const numAmount = parseInt(amount, 10);
  const wid = req.agent.walletId;

  if (!bundle || typeof bundle !== 'object' || !bundle.id || !bundle.label)
    return res.status(400).json({ error: 'Forfait invalide.' });
  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = ?', [wid]);
    if (!(await verifyPin(wid, wallet.pin, pin)))
      return res.status(403).json({ error: 'Code PIN incorrect. Opération refusée.' });
    if (wallet.balance < numAmount)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    const newBalance = wallet.balance - numAmount;
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = ?', [newBalance, wid]);

    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [wid, 'INTERNET', provider, phone, numAmount, 'PENDING']
    );

    // Répondre immédiatement, traiter GeniusPay en arrière-plan
    res.json({ message: "Forfait en cours d'activation", txId, status: 'PENDING', newBalance });

    const result = await executeGeniusPayPayout(phone, numAmount, provider, txId);
    if (result.success) {
      const txStatus = result.status === 'pending' ? 'PROCESSING' : 'SUCCESS';
      await queryRunUpdate('UPDATE transactions SET status = ?, geniuspay_ref = ?, fees = ? WHERE id = ?',
        [txStatus, result.ref, result.fees || 0, txId]);
      log('INFO', `Internet TX ${txId} → ${txStatus}`, { ref: result.ref, bundle: bundle.label, provider });
      notifyWallet(wid, 'tx_update', { txId, status: txStatus, ref: result.ref, balance: newBalance });
      if (result.status === 'pending' && geniusPayConnected) pollPayoutStatus(result.ref, txId).catch(() => {});
    } else {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
      await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [numAmount, wid]);
      log('WARN', `Internet TX ${txId} ÉCHEC. Remboursé.`, { error: result.error });
      notifyWallet(wid, 'tx_update', { txId, status: 'FAILED', balance: newBalance + numAmount });
    }
  } catch (err) {
    log('ERROR', 'Internet error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Stockage du dernier webhook pour debug
let lastWebhookPayload = null;

// === WEBHOOK GENIUSPAY ===
app.post('/api/webhooks/geniuspay', async (req, res) => {
  // Log complet pour debug (GeniusPay peut changer ses headers)
  const rawHeaders = {
    event:     req.headers['x-webhook-event'] || req.headers['x-event-type'] || req.body?.event || req.body?.type,
    signature: req.headers['x-webhook-signature'] || req.headers['x-signature'] || req.headers['x-geniuspay-signature'],
    timestamp: req.headers['x-webhook-timestamp'] || req.headers['x-timestamp'],
  };
  lastWebhookPayload = { headers: rawHeaders, body: req.body, receivedAt: new Date().toISOString() };
  log('INFO', '[WEBHOOK] Reçu', { event: rawHeaders.event, body: JSON.stringify(req.body).slice(0, 200) });

  // Vérification signature flexible
  if (GENIUSPAY_WEBHOOK_SECRET && rawHeaders.signature) {
    const payload = JSON.stringify(req.body);
    // Essayer différents formats de signature GeniusPay
    const variants = [
      rawHeaders.timestamp ? rawHeaders.timestamp + '.' + payload : null,
      payload,
      rawHeaders.timestamp ? rawHeaders.timestamp + payload : null,
    ].filter(Boolean);
    const valid = variants.some(data =>
      crypto.createHmac('sha256', GENIUSPAY_WEBHOOK_SECRET).update(data).digest('hex') === rawHeaders.signature
    );
    if (!valid) {
      log('WARN', '[WEBHOOK] Signature invalide — traitement quand même (debug mode)', {});
      // En production stricte, uncomment: return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  res.status(200).json({ received: true }); // Répondre 200 immédiatement à GeniusPay

  try {
    const event = rawHeaders.event || '';
    // GeniusPay peut encapsuler dans .data ou directement à la racine
    const payload = req.body?.data || req.body;
    if (!payload) return;

    // Extraire les champs — GeniusPay peut utiliser différentes structures
    const ref       = payload.reference || payload.payout_reference || payload.id;
    const gpStatus  = payload.status || '';
    const cabineTxId = payload.metadata?.cabine_tx_id
                    || payload.meta?.cabine_tx_id
                    || payload.external_id;

    const isSuccess = event.includes('success') || event.includes('completed')
                   || gpStatus === 'completed' || gpStatus === 'successful' || gpStatus === 'success';
    const isFailed  = event.includes('failed')  || event.includes('cancelled')
                   || gpStatus === 'failed' || gpStatus === 'cancelled';

    if (!cabineTxId) {
      log('WARN', '[WEBHOOK] cabine_tx_id manquant dans metadata', { ref, event });
      return;
    }

    if (isSuccess) {
      await queryRunUpdate('UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?',
        ['SUCCESS', ref, cabineTxId]);
      const tx = await queryGet('SELECT wallet_id, type, amount, phone FROM transactions WHERE id = ?', [cabineTxId]);
      log('INFO', `[WEBHOOK] TX ${cabineTxId} → SUCCESS`, { ref, event });
      if (tx) {
        notifyWallet(tx.wallet_id, 'tx_update', { txId: parseInt(cabineTxId), status: 'SUCCESS', ref });
        // SMS de confirmation au client
        sendSMS(tx.phone, smsConfirmationClient(tx.type, tx.amount, tx.phone, `TX-${String(cabineTxId).padStart(6,'0')}`)).catch(() => {});
      }
    } else if (isFailed) {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', cabineTxId]);
      const tx = await queryGet('SELECT wallet_id, amount FROM transactions WHERE id = ?', [cabineTxId]);
      if (tx) {
        await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [tx.amount, tx.wallet_id]);
        const wallet = await queryGet('SELECT balance FROM wallets WHERE id = ?', [tx.wallet_id]);
        log('WARN', `[WEBHOOK] TX ${cabineTxId} → FAILED. Remboursement +${tx.amount} FCFA`, { ref, event });
        notifyWallet(tx.wallet_id, 'tx_update', { txId: parseInt(cabineTxId), status: 'FAILED', balance: wallet?.balance });
      }
    } else {
      log('INFO', `[WEBHOOK] Event non traité: ${event} (status: ${gpStatus})`, {});
    }
  } catch (err) {
    log('ERROR', '[WEBHOOK] Erreur traitement', { error: err.message });
  }
});

// Endpoint debug webhook — admin seulement
app.get('/api/webhooks/last', authMiddleware, (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  res.json(lastWebhookPayload || { message: 'Aucun webhook reçu depuis le démarrage du serveur.' });
});

// ==========================================
// ANALYTICS ENDPOINT
// ==========================================
app.get('/api/analytics', authMiddleware, async (req, res) => {
  try {
    const sevenDaysSql = isPostgres
      ? `SELECT DATE(created_at) as day, COUNT(*) as total,
         SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(created_at) ORDER BY day ASC`
      : `SELECT DATE(created_at) as day, COUNT(*) as total,
         SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE created_at >= datetime('now', '-7 days')
         GROUP BY DATE(created_at) ORDER BY day ASC`;

    const byOperatorSql = `SELECT provider, COUNT(*) as total,
      SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
      FROM transactions WHERE status='SUCCESS' GROUP BY provider`;

    const hourlySql = isPostgres
      ? `SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as total,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE DATE(created_at) = CURRENT_DATE
         GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY hour ASC`
      : `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as total,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE DATE(created_at) = DATE('now')
         GROUP BY hour ORDER BY hour ASC`;

    const todaySql = isPostgres
      ? `SELECT COUNT(*) as total, SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE DATE(created_at) = CURRENT_DATE`
      : `SELECT COUNT(*) as total, SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE DATE(created_at) = DATE('now')`;

    const yesterdaySql = isPostgres
      ? `SELECT COUNT(*) as total, SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`
      : `SELECT COUNT(*) as total, SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume
         FROM transactions WHERE DATE(created_at) = DATE('now', '-1 day')`;

    const allTimeSql = `SELECT COUNT(*) as total,
      SUM(CASE WHEN status='SUCCESS' THEN amount ELSE 0 END) as volume,
      SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) as success
      FROM transactions`;

    const [daily, byOperator, hourly, today, yesterday, allTime] = await Promise.all([
      queryAll(sevenDaysSql),
      queryAll(byOperatorSql),
      queryAll(hourlySql),
      queryGet(todaySql),
      queryGet(yesterdaySql),
      queryGet(allTimeSql),
    ]);

    res.json({ daily, byOperator, hourly, today, yesterday, allTime });
  } catch (err) {
    log('ERROR', 'Analytics error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TRANSACTION REVERSAL (admin)
// ==========================================
app.post('/api/admin/reverse/:txId', authMiddleware, async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin requis.' });
  try {
    const tx = await queryGet('SELECT * FROM transactions WHERE id = ?', [req.params.txId]);
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable.' });
    if (tx.status !== 'SUCCESS') return res.status(400).json({ error: 'Seules les transactions SUCCESS peuvent être annulées.' });
    if (tx.type === 'RETRAIT') return res.status(400).json({ error: 'Un retrait ne peut pas être annulé.' });
    // Rembourser le wallet
    await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = ?', [tx.amount, tx.wallet_id]);
    await queryRunUpdate(
      `UPDATE transactions SET status = 'REVERSED' WHERE id = ?`, [tx.id]
    );
    await queryRunInsert(
      'INSERT INTO balance_ledger (wallet_id, amount, type, description, done_by) VALUES (?, ?, ?, ?, ?)',
      [tx.wallet_id, tx.amount, 'REVERSAL', `Annulation TX-${String(tx.id).padStart(6,'0')}`, req.agent.agentId]
    );
    const wallet = await queryGet('SELECT balance FROM wallets WHERE id = ?', [tx.wallet_id]);
    notifyWallet(tx.wallet_id, 'tx_update', { txId: tx.id, status: 'REVERSED', balance: wallet?.balance });
    log('INFO', `TX ${tx.id} annulée +${tx.amount} FCFA remboursé`, { by: req.agent.email });
    res.json({ message: `Transaction TX-${String(tx.id).padStart(6,'0')} annulée. ${new Intl.NumberFormat('fr-FR').format(tx.amount)} FCFA remboursés.`, newBalance: wallet?.balance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// CRON — Génération auto des factures (1er du mois, minuit)
// ==========================================
function scheduleAutoInvoice() {
  const check = async () => {
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() < 5) {
      try {
        const period = now.toISOString().slice(0, 7);
        const agents = await queryAll("SELECT id, wallet_id FROM agents WHERE role = 'agent' AND active = TRUE");
        let created = 0;
        for (const ag of agents) {
          const existing = await queryGet('SELECT id FROM invoices WHERE agent_id = ? AND period = ?', [ag.id, period]);
          if (!existing) {
            await queryRunInsert(
              'INSERT INTO invoices (agent_id, wallet_id, period, amount, status) VALUES (?, ?, ?, ?, ?)',
              [ag.id, ag.wallet_id, period, 10000, 'pending']
            );
            created++;
          }
        }
        if (created > 0) log('INFO', `Auto-factures ${period}: ${created} factures créées`);
      } catch (e) { log('ERROR', 'Auto-invoice cron failed', { error: e.message }); }
    }
  };
  setInterval(check, 5 * 60 * 1000); // vérif toutes les 5 min
}
scheduleAutoInvoice();

// ==========================================
// CRON — Sync solde GeniusPay (toutes les 6h)
// ==========================================
async function autoSyncGeniusPayBalance() {
  if (!geniusPayConnected || !discoveredWalletId) return;
  try {
    const data = await geniusPayRequest('GET', '/wallets');
    const wallets = data?.data?.wallets || [];
    if (!wallets.length) return;
    const gpWallet = wallets.find(w => w.id === discoveredWalletId) || wallets[0];
    const gpBalance = Math.floor(parseFloat(gpWallet.available_balance || gpWallet.balance || 0));
    // Met à jour seulement le wallet de l'admin (wallet_id=1) si la différence est significative
    const current = await queryGet('SELECT balance FROM wallets WHERE id = 1');
    const diff = Math.abs((current?.balance || 0) - gpBalance);
    if (diff > 1000) { // seulement si diff > 1000 FCFA pour éviter les faux sync
      log('INFO', `Auto-sync GeniusPay: ${current?.balance} → ${gpBalance} FCFA (diff: ${diff})`);
      // Notifier l'admin mais ne pas changer automatiquement — juste alerter
      notifyAll('balance_drift', { localBalance: current?.balance, gpBalance, diff });
    }
  } catch {}
}
setInterval(autoSyncGeniusPayBalance, 6 * 60 * 60 * 1000); // toutes les 6h

// Serve static files
app.use(express.static(join(__dirname, 'dist')));
app.get('{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cabine 2.0 Backend en écoute sur http://0.0.0.0:${PORT}`);
  console.log(`📡 GeniusPay Mode: ${GENIUSPAY_MODE} | Connecté: ${geniusPayConnected}`);
});
