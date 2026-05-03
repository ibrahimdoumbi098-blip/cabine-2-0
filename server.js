import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const dbPath = join(__dirname, 'cabine.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur ouverture DB:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT,
      balance INTEGER DEFAULT 0,
      pin TEXT DEFAULT '1234'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id INTEGER,
      type TEXT,
      provider TEXT,
      phone TEXT,
      amount INTEGER,
      status TEXT,
      geniuspay_ref TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get('SELECT * FROM wallets WHERE id = 1', (err, row) => {
      if (!row) {
        db.run('INSERT INTO wallets (agent_name, balance, pin) VALUES (?, ?, ?)', ['Kouassi B.', 2450000, '1234']);
        console.log('Portefeuille test créé.');
      }
    });
  });
}

// --- SERVICE GENIUSPAY ---
// Identifiants fournis par GeniusPay (À remplacer par tes vraies clés en production)
const GENIUSPAY_API_URL = process.env.GENIUSPAY_API_URL || 'https://api.genius.ci/v1';
const GENIUSPAY_API_KEY = process.env.GENIUSPAY_API_KEY || 'sk_test_geniuspay_YOUR_KEY_HERE';

async function executeGeniusPayTransfer(phone, amount, provider) {
  // Mapping standardisé des réseaux pour l'API GeniusPay
  const providerMap = {
    'orange': 'ORANGE_CI',
    'mtn': 'MTN_CI',
    'wave': 'WAVE_CI',
    'moov': 'MOOV_CI'
  };

  try {
    console.log(`[GENIUSPAY API] Initiation transfert: ${amount} XOF vers ${phone} (${providerMap[provider]})`);
    
    /* 
    ====================================================================
    DÉCOMMENTE CE BLOC QUAND TU AURAS TES VRAIES CLÉS GENIUSPAY
    ====================================================================
    const response = await fetch(`${GENIUSPAY_API_URL}/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GENIUSPAY_API_KEY}`
      },
      body: JSON.stringify({
        recipient: phone,
        amount: parseInt(amount),
        currency: 'XOF',
        network: providerMap[provider],
        // Le webhook permettra à GeniusPay d'avertir ton serveur quand le transfert est validé par Orange/MTN
        callback_url: 'https://ton-domaine.com/api/webhooks/geniuspay' 
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de l\'appel à GeniusPay');
    }
    
    const data = await response.json();
    return { success: true, ref: data.transaction_id || data.reference };
    ====================================================================
    */

    // SIMULATION D'ATTENTE DE L'API GENIUSPAY (Pour le dev local)
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simule 95% de succès
        const isSuccess = Math.random() > 0.05;
        if (isSuccess) {
          resolve({ success: true, ref: 'GP-TX-' + Date.now() });
        } else {
          resolve({ success: false, error: 'Le réseau opérateur est temporairement indisponible.' });
        }
      }, 2500); // L'API d'un agrégateur prend généralement 2 à 4 secondes
    });

  } catch (error) {
    console.error('[GENIUSPAY API ERROR]', error);
    return { success: false, error: error.message };
  }
}

// 1. Obtenir le solde
app.get('/api/wallet', (req, res) => {
  db.get('SELECT id, agent_name, balance FROM wallets WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// 2. Obtenir l'historique
app.get('/api/transactions', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 20', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 3. Initier un transfert
app.post('/api/transfer', (req, res) => {
  const { provider, phone, amount, pin } = req.body;
  const numAmount = parseInt(amount, 10);

  if (!provider || !phone || !numAmount || numAmount <= 0) return res.status(400).json({ error: 'Données invalides.' });
  if (!pin) return res.status(401).json({ error: 'Code PIN requis.' });

  db.get('SELECT balance, pin FROM wallets WHERE id = 1', (err, wallet) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (wallet.pin !== pin) {
      return res.status(403).json({ error: 'Code PIN incorrect. Transaction refusée.' });
    }

    if (wallet.balance < numAmount) {
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

    // 1. Débiter (Statut PENDING)
    const newBalance = wallet.balance - numAmount;
    db.run('UPDATE wallets SET balance = ? WHERE id = 1', [newBalance], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        'INSERT INTO transactions (wallet_id, type, provider, phone, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
        [1, 'TRANSFER', provider, phone, numAmount, 'PENDING'],
        async function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          const txId = this.lastID;
          
          // Répondre au frontend immédiatement pour ne pas bloquer l'UI
          res.json({ message: 'Transaction initiée', txId, status: 'PENDING', newBalance });

          // 2. APPELER L'API GENIUSPAY EN ARRIÈRE-PLAN
          const geniusPayResult = await executeGeniusPayTransfer(phone, numAmount, provider);
          
          if (geniusPayResult.success) {
            // Mettre à jour la base avec le succès et la référence GeniusPay
            db.run('UPDATE transactions SET status = ?, geniuspay_ref = ? WHERE id = ?', ['SUCCESS', geniusPayResult.ref, txId]);
            console.log(`[SUCCÈS] TX ${txId} validée par GeniusPay (Ref: ${geniusPayResult.ref})`);
          } else {
            // ÉCHEC: Rollback automatique (Rembourser le wallet)
            db.run('UPDATE transactions SET status = ? WHERE id = ?', ['FAILED', txId]);
            db.run('UPDATE wallets SET balance = balance + ? WHERE id = 1', [numAmount]);
            console.log(`[ÉCHEC] TX ${txId} refusée par GeniusPay. Raison: ${geniusPayResult.error}. Remboursement effectué.`);
          }
        }
      );
    });
  });
});

// 4. Servir le Frontend React (Dossier 'dist' compilé)
app.use(express.static(join(__dirname, 'dist')));

app.get('/*splat', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur Backend sécurisé en écoute sur http://0.0.0.0:${PORT}`);
});
