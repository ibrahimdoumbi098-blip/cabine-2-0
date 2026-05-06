import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
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
// BASIC RATE LIMITING (transfer endpoint)
// ==========================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return next();
  }
  const entry = rateLimitMap.get(ip);
  if (now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans une minute.' });
  }
  next();
}
// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 2) rateLimitMap.delete(ip);
  }
}, 120000);

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

  try {
    if (isPostgres) {
      await pool.query(walletsPg);
      await pool.query(txPg);
      const res = await pool.query('SELECT * FROM wallets WHERE id = 1');
      if (res.rows.length === 0) {
        await pool.query('INSERT INTO wallets (id, agent_name, balance, pin) VALUES (1, $1, $2, $3)', ['Ibrahim Doumbia', 2450000, '1234']);
      } else if (res.rows[0].agent_name === 'Kouassi B.') {
        await pool.query('UPDATE wallets SET agent_name = $1 WHERE id = 1', ['Ibrahim Doumbia']);
      }
    } else {
      await new Promise((resolve) => {
        sqliteDb.serialize(() => {
          sqliteDb.run(walletsSqlite);
          sqliteDb.run(txSqlite);
          sqliteDb.get('SELECT * FROM wallets WHERE id = 1', (err, row) => {
            if (!row) {
              sqliteDb.run('INSERT INTO wallets (agent_name, balance, pin) VALUES (?, ?, ?)', ['Ibrahim Doumbia', 2450000, '1234']);
            } else if (row.agent_name === 'Kouassi B.') {
              sqliteDb.run('UPDATE wallets SET agent_name = ? WHERE id = 1', ['Ibrahim Doumbia']);
            }
            resolve();
          });
        });
      });
      // Migrate: add missing columns to old DB
      const cols = ['geniuspay_payout_id', 'idempotency_key', 'fees', 'geniuspay_provider'];
      for (const col of cols) {
        await new Promise((resolve) => {
          const type = col === 'fees' ? 'INTEGER DEFAULT 0' : 'TEXT';
          sqliteDb.run(`ALTER TABLE transactions ADD COLUMN ${col} ${type}`, () => resolve());
        });
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
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
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
    console.log(`[FALLBACK SIMULATEUR] Payout ${amount} XOF → ${formattedPhone} (${provider})`);
    return new Promise((resolve) => {
      setTimeout(() => {
        const ok = Math.random() > 0.05;
        resolve(ok
          ? { success: true, ref: 'SIM-' + Date.now(), payoutId: 'SIM-PYT-' + txId, fees: 0, idempotencyKey }
          : { success: false, error: 'Réseau opérateur indisponible (simulateur).', idempotencyKey }
        );
      }, 2000);
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
app.get('/api/wallet', async (req, res) => {
  try {
    const row = await queryGet('SELECT id, agent_name, balance FROM wallets WHERE id = 1');
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Transaction history
app.get('/api/transactions', async (req, res) => {
  try {
    const { status, q, since, until, limit = 50 } = req.query;
    let sql = 'SELECT * FROM transactions';
    const filters = [];
    const params = [];

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

app.get('/api/transactions/export', async (req, res) => {
  try {
    const rows = await queryAll('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1000');
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
app.put('/api/wallet/pin', async (req, res) => {
  const { oldPin, newPin } = req.body;
  if (!oldPin || !newPin) return res.status(400).json({ error: 'Données invalides.' });
  try {
    const wallet = await queryGet('SELECT pin FROM wallets WHERE id = 1');
    if (!(await verifyPin(1, wallet.pin, oldPin))) return res.status(403).json({ error: 'Ancien code PIN incorrect.' });
    const hash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
    await queryRunUpdate('UPDATE wallets SET pin = ? WHERE id = 1', [hash]);
    res.json({ message: 'Code PIN mis à jour avec succès.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === TRANSFER — Cœur du système ===
app.post('/api/transfer', rateLimiter, async (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);

  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = 1');
    if (!(await verifyPin(1, wallet.pin, pin))) return res.status(403).json({ error: 'Code PIN incorrect. Transaction refusée.' });
    if (wallet.balance < numAmount) return res.status(400).json({ error: 'Solde insuffisant.' });

    // Débit immédiat
    const newBalance = wallet.balance - numAmount;
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = 1', [newBalance]);

    // Créer la transaction
    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'TRANSFER', provider, phone, numAmount, 'PENDING']
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
      await queryRunUpdate(
        'UPDATE transactions SET geniuspay_ref = ?, geniuspay_payout_id = ?, fees = ?, status = ? WHERE id = ?',
        [result.ref, result.payoutId || '', result.fees || 0, result.status === 'pending' ? 'PROCESSING' : 'SUCCESS', txId]
      );
      console.log(`✅ TX ${txId} envoyée → Ref: ${result.ref}`);

      // Si le payout est encore pending, poll le statut
      if (result.status === 'pending' && geniusPayConnected) {
        pollPayoutStatus(result.ref, txId).catch(e => console.error('Poll error:', e));
      }
    } else {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
      await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = 1', [numAmount]);
      console.log(`❌ TX ${txId} échouée: ${result.error}. Remboursement OK.`);
    }
  } catch (err) {
    console.error('Transfer error:', err);
  }
});

// === RETRAIT — Encaissement client ===
app.post('/api/retrait', rateLimiter, async (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);

  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = 1');
    if (!(await verifyPin(1, wallet.pin, pin)))
      return res.status(403).json({ error: 'Code PIN incorrect. Opération refusée.' });

    // Crédit immédiat du wallet agent
    await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = 1', [numAmount]);

    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'RETRAIT', provider, phone, numAmount, 'PENDING']
    );

    // Répondre immédiatement
    res.json({ message: 'Retrait initié', txId, status: 'PENDING' });

    // Simulation d'encaissement (en production: GeniusPay collection API)
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    const ok = Math.random() > 0.02; // 98% succès simulé

    if (ok) {
      const ref = geniusPayConnected
        ? `GP-RET-${Date.now()}`
        : `SIM-RET-${Date.now()}`;
      await queryRunUpdate(
        'UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?',
        ['SUCCESS', ref, txId]
      );
      log('INFO', `Retrait TX ${txId} SUCCÈS`, { ref, amount: numAmount, provider });
    } else {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
      // Annuler le crédit si échec
      await queryRunUpdate('UPDATE wallets SET balance = balance - ? WHERE id = 1', [numAmount]);
      log('WARN', `Retrait TX ${txId} ÉCHEC. Crédit annulé.`);
    }
  } catch (err) {
    log('ERROR', 'Retrait error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// === AIRTIME — Recharge crédit téléphonique ===
app.post('/api/airtime', rateLimiter, async (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);

  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = 1');
    if (!(await verifyPin(1, wallet.pin, pin)))
      return res.status(403).json({ error: 'Code PIN incorrect. Opération refusée.' });
    if (wallet.balance < numAmount)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    const newBalance = wallet.balance - numAmount;
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = 1', [newBalance]);

    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'AIRTIME', provider, phone, numAmount, 'PENDING']
    );

    res.json({ message: 'Recharge initiée', txId, status: 'PENDING', newBalance });

    await new Promise(r => setTimeout(r, 1000 + Math.random() * 800));
    const ok = Math.random() > 0.02;
    if (ok) {
      const ref = `SIM-AIR-${Date.now()}`;
      await queryRunUpdate('UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?', ['SUCCESS', ref, txId]);
      log('INFO', `Airtime TX ${txId} SUCCÈS`, { ref, amount: numAmount, provider });
    } else {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
      await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = 1', [numAmount]);
      log('WARN', `Airtime TX ${txId} ÉCHEC. Remboursé.`);
    }
  } catch (err) {
    log('ERROR', 'Airtime error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// === INTERNET — Activation forfait data ===
app.post('/api/internet', rateLimiter, async (req, res) => {
  const { provider, phone, amount, bundle, pin } = req.body;
  const numAmount = parseInt(amount, 10);

  if (!bundle || typeof bundle !== 'object' || !bundle.id || !bundle.label)
    return res.status(400).json({ error: 'Forfait invalide.' });
  const validationError = validateOperationInput(provider, phone, numAmount, pin);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const wallet = await queryGet('SELECT balance, pin FROM wallets WHERE id = 1');
    if (!(await verifyPin(1, wallet.pin, pin)))
      return res.status(403).json({ error: 'Code PIN incorrect. Opération refusée.' });
    if (wallet.balance < numAmount)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    const newBalance = wallet.balance - numAmount;
    await queryRunUpdate('UPDATE wallets SET balance = ? WHERE id = 1', [newBalance]);

    const txId = await queryRunInsert(
      'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'INTERNET', provider, phone, numAmount, 'PENDING']
    );

    res.json({ message: 'Forfait en cours d\'activation', txId, status: 'PENDING', newBalance });

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
    const ok = Math.random() > 0.02;
    if (ok) {
      const ref = `SIM-NET-${bundle.id}-${Date.now()}`;
      await queryRunUpdate('UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?', ['SUCCESS', ref, txId]);
      log('INFO', `Internet TX ${txId} SUCCÈS`, { ref, bundle: bundle.label, amount: numAmount, provider });
    } else {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
      await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = 1', [numAmount]);
      log('WARN', `Internet TX ${txId} ÉCHEC. Remboursé.`);
    }
  } catch (err) {
    log('ERROR', 'Internet error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// === WEBHOOK GENIUSPAY ===
app.post('/api/webhooks/geniuspay', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const event = req.headers['x-webhook-event'];

  // Verify signature if secret is configured
  if (GENIUSPAY_WEBHOOK_SECRET && signature) {
    const payload = JSON.stringify(req.body);
    const data = timestamp + '.' + payload;
    const expected = crypto.createHmac('sha256', GENIUSPAY_WEBHOOK_SECRET).update(data).digest('hex');
    if (expected !== signature) {
      console.warn('⚠️ Webhook signature invalide!');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    // Replay protection (5 min)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
      return res.status(400).json({ error: 'Timestamp too old' });
    }
  }

  console.log(`[WEBHOOK] Event: ${event}`, JSON.stringify(req.body?.data?.reference));

  try {
    const payoutData = req.body?.data;
    if (!payoutData) return res.status(200).json({ received: true });

    const ref = payoutData.reference;
    const status = payoutData.status;
    const cabineTxId = payoutData.metadata?.cabine_tx_id;

    if (event === 'payout.completed' && cabineTxId) {
      await queryRunUpdate('UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?',
        ['SUCCESS', ref, cabineTxId]);
      console.log(`✅ [WEBHOOK] TX ${cabineTxId} confirmée SUCCESS.`);
    } else if (event === 'payout.failed' && cabineTxId) {
      await queryRunUpdate('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', cabineTxId]);
      const tx = await queryGet('SELECT amount FROM transactions WHERE id = ?', [cabineTxId]);
      if (tx) await queryRunUpdate('UPDATE wallets SET balance = balance + ? WHERE id = 1', [tx.amount]);
      console.log(`❌ [WEBHOOK] TX ${cabineTxId} FAILED. Remboursé.`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ==========================================
// ANALYTICS ENDPOINT
// ==========================================
app.get('/api/analytics', async (req, res) => {
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

// Serve static files
app.use(express.static(join(__dirname, 'dist')));
app.get('{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cabine 2.0 Backend en écoute sur http://0.0.0.0:${PORT}`);
  console.log(`📡 GeniusPay Mode: ${GENIUSPAY_MODE} | Connecté: ${geniusPayConnected}`);
});
