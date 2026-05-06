import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// ABSTRACTION DE LA BASE DE DONNÉES (SQLITE / POSTGRESQL)
// ==========================================
const db = {};
let sqliteDb;
let pgPool;
const isPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);

if (isPostgres) {
  console.log('Production: Connexion à PostgreSQL cloud...');
  pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  db.get = async (query, params, callback) => {
    try {
      const res = await pgPool.query(query.replace(/\?/g, (match, offset, str) => {
        // Remplacer les ? par $1, $2, etc. (très basique mais fonctionnel pour nos requêtes)
        let count = 1;
        for (let i = 0; i < offset; i++) if (str[i] === '?') count++;
        return '$' + count;
      }), params);
      callback(null, res.rows[0]);
    } catch (e) { callback(e, null); }
  };

  db.all = async (query, params, callback) => {
    try {
      const res = await pgPool.query(query, params);
      if(typeof params === 'function') params(null, res.rows); // Si aucun paramètre
      else callback(null, res.rows);
    } catch (e) { 
      if(typeof params === 'function') params(e, null);
      else callback(e, null); 
    }
  };

  db.run = async (query, params, callback) => {
    try {
      let pgQuery = query.replace(/\?/g, (match, offset, str) => {
        let count = 1;
        for (let i = 0; i < offset; i++) if (str[i] === '?') count++;
        return '$' + count;
      });
      // Si c'est un INSERT, on veut récupérer l'ID généré
      if (pgQuery.includes('INSERT')) {
        pgQuery += ' RETURNING id';
      }
      
      const res = await pgPool.query(pgQuery, params);
      const ctx = { lastID: res.rows[0]?.id };
      if (callback) callback.call(ctx, null);
    } catch (e) {
      if (callback) callback(e);
    }
  };

  initDbPg();

} else {
  console.log('Développement: Connexion à SQLite local...');
  let dbPath;
  if (process.env.VERCEL) {
    dbPath = '/tmp/cabine.sqlite';
    const sourcePath = join(__dirname, '../cabine.sqlite');
    if (!fs.existsSync(dbPath) && fs.existsSync(sourcePath)) {
      try { fs.copyFileSync(sourcePath, dbPath); } catch(e) {}
    }
  } else {
    dbPath = join(__dirname, '../cabine.sqlite');
  }

  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (!err) initDbSqlite();
  });

  db.get = (query, params, callback) => sqliteDb.get(query, params, callback);
  db.all = (query, callback) => sqliteDb.all(query, callback);
  db.run = function(query, params, callback) {
    sqliteDb.run(query, params, function(err) {
      if (callback) callback.call(this, err);
    });
  };
}

async function initDbPg() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      agent_name VARCHAR(255),
      balance INTEGER DEFAULT 0,
      pin VARCHAR(255) DEFAULT '1234'
    )
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      wallet_id INTEGER,
      type VARCHAR(50),
      provider VARCHAR(50),
      phone VARCHAR(50),
      amount INTEGER,
      status VARCHAR(50),
      geniuspay_ref VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const res = await pgPool.query('SELECT * FROM wallets WHERE id = 1');
  if (res.rows.length === 0) {
    await pgPool.query('INSERT INTO wallets (agent_name, balance, pin) VALUES ($1, $2, $3)', ['Kouassi B.', 2450000, '1234']);
  }
}

function initDbSqlite() {
  sqliteDb.serialize(() => {
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_name TEXT, balance INTEGER DEFAULT 0, pin TEXT DEFAULT '1234'
    )`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, wallet_id INTEGER, type TEXT, provider TEXT, phone TEXT, amount INTEGER, status TEXT, geniuspay_ref TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    sqliteDb.get('SELECT * FROM wallets WHERE id = 1', (err, row) => {
      if (!row) sqliteDb.run('INSERT INTO wallets (agent_name, balance, pin) VALUES (?, ?, ?)', ['Kouassi B.', 2450000, '1234']);
    });
  });
}

// ==========================================
// LOGIQUE MÉTIER & ROUTES API
// ==========================================

const GENIUSPAY_API_URL = process.env.GENIUSPAY_API_URL || 'https://api.genius.ci/v1';
const GENIUSPAY_API_KEY = process.env.GENIUSPAY_API_KEY || 'sk_test_geniuspay_YOUR_KEY_HERE';

async function executeGeniusPayTransfer(phone, amount, provider) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const isSuccess = Math.random() > 0.05;
      if (isSuccess) resolve({ success: true, ref: 'GP-TX-' + Date.now() });
      else resolve({ success: false, error: 'Le réseau opérateur est temporairement indisponible.' });
    }, 2500);
  });
}

app.get('/api/wallet', (req, res) => {
  db.get('SELECT id, agent_name, balance FROM wallets WHERE id = 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || {balance: 0});
  });
});

app.get('/api/transactions', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 20', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/transfer', (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);

  if (!provider || !phone || !numAmount || numAmount <= 0) return res.status(400).json({ error: 'Données invalides.' });
  if (!pin) return res.status(401).json({ error: 'Code PIN requis.' });

  db.get('SELECT balance, pin FROM wallets WHERE id = 1', [], (err, wallet) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!wallet || wallet.pin !== pin) return res.status(403).json({ error: 'Code PIN incorrect.' });
    if (wallet.balance < numAmount) return res.status(400).json({ error: 'Solde insuffisant.' });

    const newBalance = wallet.balance - numAmount;
    db.run('UPDATE wallets SET balance = ? WHERE id = 1', [newBalance], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
        [1, 'TRANSFER', provider, phone, numAmount, 'PENDING'],
        async function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          const txId = this.lastID;
          res.json({ message: 'Transaction initiée', txId, status: 'PENDING', newBalance });

          const geniusPayResult = await executeGeniusPayTransfer(phone, numAmount, provider);
          
          if (geniusPayResult.success) {
            db.run('UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?', ['SUCCESS', geniusPayResult.ref, txId]);
          } else {
            db.run('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
            db.run('UPDATE wallets SET balance = balance + ? WHERE id = 1', [numAmount]);
          }
        }
      );
    });
  });
});

export default app;
