import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, ArrowUpRight, ArrowDownToLine, PhoneCall,
  History, Settings, LogOut, Zap, CheckCircle2, Clock,
  XCircle, RefreshCw, Menu, Delete, Printer, Share2, Lock,
  AlertTriangle, Info, X, Download, Send,
  TrendingUp, TrendingDown, BarChart2, Radio, Star, Wifi,
  ChevronLeft, ChevronRight, Copy, Ban, Eye, EyeOff,
  Activity, Banknote, Target, Layers, Phone, Monitor, ShieldCheck
} from 'lucide-react';
import html2canvas from 'html2canvas';
import PrintService from './services/PrintService.js';
import KioskService from './services/KioskService.js';
import './App.css';

const API_URL = '/api';

// === REAL OPERATOR LOGOS (static files) ===
const OPERATOR_LOGOS = {
  orange: '/logos/orange.svg',
  mtn: '/logos/mtn.svg',
  wave: '/logos/wave.svg',
  moov: '/logos/moov.svg',
};
const OPERATOR_NAMES = { orange: 'Orange', mtn: 'MTN', wave: 'Wave', moov: 'Moov' };
const OPERATOR_COLORS = { orange: '#ff6600', mtn: '#ffcc00', wave: '#1ba4e6', moov: '#F37021' };

// === OPERATORS SUPPORTING EACH SERVICE ===
// Wave is app-only — no airtime recharge or data bundle via agents
const OPERATOR_CAPS = {
  transfer: ['orange', 'mtn', 'wave', 'moov'],
  withdraw: ['orange', 'mtn', 'wave', 'moov'],
  airtime:  ['orange', 'mtn', 'moov'],
  internet: ['orange', 'mtn', 'moov'],
};

// === FORFAITS — chargés depuis /api/bundles au démarrage (source: server.js)
// Ne pas modifier ici — modifier OPERATOR_BUNDLES dans server.js
const INTERNET_BUNDLES_FALLBACK = {
  orange: {
    daily: [
      { id: 'o-d-40m',  label: '40 Mo',  price: 100, validity: '24h',    tag: null },
      { id: 'o-d-100m', label: '100 Mo', price: 200, validity: '24h',    tag: null },
      { id: 'o-d-250m', label: '250 Mo', price: 300, validity: '24h',    tag: null },
      { id: 'o-d-500m', label: '500 Mo', price: 500, validity: '24h',    tag: null },
      { id: 'o-d-1g',   label: '1 Go',   price: 700, validity: '24h',    tag: 'Populaire' },
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
      { id: 'm-d-450m', label: '450 Mo', price: 400, validity: '3 jours', tag: null },
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
      { id: 'mo-m-20g',  label: '20 Go',  price: 9900,  validity: '30 jours', tag: 'Top valeur' },
      { id: 'mo-m-30g',  label: '30 Go',  price: 14900, validity: '30 jours', tag: null },
      { id: 'mo-m-45g',  label: '45 Go',  price: 19900, validity: '30 jours', tag: null },
    ],
  },
}; // fallback uniquement si /api/bundles échoue

// === OPERATION CONFIG — single source of truth ===
const OP_CONFIG = {
  transfer: {
    color: '#6366f1', glowColor: 'rgba(99,102,241,0.28)',
    label: 'Transfert',
    headerLabel: 'Nouveau Transfert Inter-Réseaux',
    headerIcon: 'ArrowUpRight',
    submitLabel: 'Valider la transaction',
    amountLabel: 'Montant à transférer',
    phoneLabel: 'Numéro du destinataire',
    confirmTitle: 'Confirmer la transaction',
    confirmPhoneLabel: 'Numéro',
    confirmAmountLabel: 'Montant',
    infoBanner: null,
    endpoint: '/api/transfer',
    txSign: '-', txColorVar: 'var(--text-dark)',
  },
  withdraw: {
    color: '#10b981', glowColor: 'rgba(16,185,129,0.28)',
    label: 'Retrait',
    headerLabel: 'Nouveau Retrait Mobile Money',
    headerIcon: 'ArrowDownToLine',
    submitLabel: 'Valider le retrait',
    amountLabel: 'Montant du retrait',
    phoneLabel: 'Numéro du client',
    confirmTitle: 'Confirmer le retrait',
    confirmPhoneLabel: 'Numéro client',
    confirmAmountLabel: 'Montant à encaisser',
    infoBanner: 'Le client vous envoie les fonds — votre solde sera crédité après confirmation.',
    endpoint: '/api/retrait',
    txSign: '+', txColorVar: 'var(--accent-green)',
  },
  airtime: {
    color: '#f59e0b', glowColor: 'rgba(245,158,11,0.28)',
    label: 'Crédit',
    headerLabel: 'Recharge Crédit Téléphonique',
    headerIcon: 'PhoneCall',
    submitLabel: 'Recharger le crédit',
    amountLabel: 'Montant de la recharge',
    phoneLabel: 'Numéro à recharger',
    confirmTitle: 'Confirmer la recharge',
    confirmPhoneLabel: 'Numéro',
    confirmAmountLabel: 'Montant recharge',
    infoBanner: 'Le crédit sera envoyé instantanément sur le numéro indiqué.',
    endpoint: '/api/airtime',
    txSign: '-', txColorVar: 'var(--accent-yellow)',
  },
  internet: {
    color: '#3b82f6', glowColor: 'rgba(59,130,246,0.28)',
    label: 'Internet',
    headerLabel: 'Forfait Internet Mobile',
    headerIcon: 'Wifi',
    submitLabel: 'Activer le forfait',
    amountLabel: null,
    phoneLabel: 'Numéro à connecter',
    confirmTitle: 'Confirmer le forfait',
    confirmPhoneLabel: 'Numéro',
    confirmAmountLabel: 'Forfait',
    infoBanner: 'Le forfait sera activé dans les 2–5 minutes après confirmation.',
    endpoint: '/api/internet',
    txSign: '-', txColorVar: 'var(--accent-blue)',
  },
};

// === DYNAMIC GREETING ===
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

// === AUTO-DETECT OPERATOR FROM PHONE NUMBER (Côte d'Ivoire) ===
function detectOperator(phone) {
  const cleaned = phone.replace(/[\s\-\.\+]/g, '');
  let digits = cleaned;
  if (digits.startsWith('225')) digits = digits.substring(3);
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.length < 2) return null;
  const prefix = digits.substring(0, 2);
  // Orange CI: 07, 08, 27
  if (['07', '08', '27'].includes(prefix)) return 'orange';
  // MTN CI: 05, 06, 25, 26
  if (['05', '06', '25', '26'].includes(prefix)) return 'mtn';
  // Moov CI: 01, 02, 03
  if (['01', '02', '03'].includes(prefix)) return 'moov';
  // Wave: no specific prefix, app-based
  return null;
}

// === TOAST NOTIFICATION SYSTEM ===
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <div className="toast-icon">
            {t.type === 'success' && <CheckCircle2 size={18} />}
            {t.type === 'error' && <XCircle size={18} />}
            {t.type === 'info' && <Info size={18} />}
            {t.type === 'warning' && <AlertTriangle size={18} />}
          </div>
          <div className="toast-content">
            <strong>{t.title}</strong>
            <p>{t.message}</p>
          </div>
          <button className="toast-close" onClick={() => onDismiss(t.id)}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// === CHART COMPONENTS ===
function BarChart({ data }) {
  if (!data?.length || data.every(d => d.value === 0)) {
    return <div className="chart-empty">Aucune donnée pour la période</div>;
  }
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const n = data.length;
  const bw = (100 / n) * 0.65;
  const bg = (100 / n) * 0.175;
  return (
    <div className="bar-chart-wrap">
      <svg viewBox="0 0 100 80" className="bar-chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="barGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1"/>
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="75" x2="100" y2="75" stroke="var(--border-color)" strokeWidth="0.5"/>
        {data.map((d, i) => {
          const h = Math.max((d.value / maxVal) * 68, d.value > 0 ? 3 : 0);
          const x = i * (100 / n) + bg;
          return <rect key={i} x={x} y={75 - h} width={bw} height={h} fill="url(#barGrad1)" rx="2"/>;
        })}
      </svg>
      <div className="bar-chart-labels">
        {data.map((d, i) => <div key={i} className="bar-label-item">{d.label}</div>)}
      </div>
    </div>
  );
}

function DonutChart({ slices }) {
  const nonZero = slices.filter(s => s.value > 0);
  const total = nonZero.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="donut-wrap">
        <div className="chart-empty" style={{width: 120, height: 120}}>—</div>
      </div>
    );
  }
  const cx = 60, cy = 60, outerR = 50, innerR = 30;
  let ang = -Math.PI / 2;
  const arcs = nonZero.map(slice => {
    const a = (slice.value / total) * 2 * Math.PI;
    const sa = ang; ang += a; const ea = ang;
    const x1 = cx + outerR * Math.cos(sa), y1 = cy + outerR * Math.sin(sa);
    const x2 = cx + outerR * Math.cos(ea), y2 = cy + outerR * Math.sin(ea);
    const ix1 = cx + innerR * Math.cos(sa), iy1 = cy + innerR * Math.sin(sa);
    const ix2 = cx + innerR * Math.cos(ea), iy2 = cy + innerR * Math.sin(ea);
    const laf = a > Math.PI ? 1 : 0;
    const d = `M${ix1} ${iy1} L${x1} ${y1} A${outerR} ${outerR} 0 ${laf} 1 ${x2} ${y2} L${ix2} ${iy2} A${innerR} ${innerR} 0 ${laf} 0 ${ix1} ${iy1}Z`;
    return { d, color: slice.color };
  });
  const fmt = v => new Intl.NumberFormat('fr-FR', {notation:'compact', maximumFractionDigits:0}).format(v);
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" width="120" height="120">
        {arcs.map((arc, i) => <path key={i} d={arc.d} fill={arc.color}/>)}
        <text x={cx} y={cy-5} textAnchor="middle" style={{fontSize:'7px',fill:'var(--text-muted)'}}>Volume</text>
        <text x={cx} y={cy+8} textAnchor="middle" style={{fontSize:'10px',fontWeight:700,fill:'var(--text-dark)'}}>
          {fmt(total)}
        </text>
        <text x={cx} y={cy+20} textAnchor="middle" style={{fontSize:'7px',fill:'var(--text-muted)'}}>FCFA</text>
      </svg>
    </div>
  );
}

function HourlyHeatmap({ hourly }) {
  const currentHour = new Date().getHours();
  const maxVal = Math.max(...hourly.map(h => parseInt(h.total) || 0), 1);
  const cells = Array.from({length: 24}, (_, i) => {
    const found = hourly.find(h => parseInt(h.hour) === i);
    return { hour: i, total: found ? (parseInt(found.total) || 0) : 0 };
  });
  return (
    <div className="hourly-heatmap">
      {cells.map(c => (
        <div key={c.hour}
          className={`hour-cell${c.total > 0 ? ' active' : ''}${c.hour === currentHour ? ' current' : ''}`}
          style={{'--intensity': c.total > 0 ? c.total / maxVal : 0}}
          title={`${c.hour}h00 : ${c.total} transaction${c.total !== 1 ? 's' : ''}`}
        >
          <span className="hour-label">{c.hour}h</span>
        </div>
      ))}
    </div>
  );
}

// === LOGIN SCREEN ===
function LoginScreen({ onLogin }) {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPwd, setShowPwd]     = useState(false);
  const [mode, setMode]           = useState('login'); // 'login' | 'forgot' | 'reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Handle reset token from URL (?reset_token=...&email=...)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken  = urlParams.get('reset_token');
  const urlEmail  = urlParams.get('email');

  const [resetToken, setResetToken]       = useState(urlToken || '');
  const [resetEmail, setResetEmail]       = useState(urlEmail || '');
  const [resetNewPwd, setResetNewPwd]     = useState('');
  const [resetConfirm, setResetConfirm]   = useState('');
  const [resetMsg, setResetMsg]           = useState('');
  const [resetLoading, setResetLoading]   = useState(false);

  React.useEffect(() => {
    if (urlToken && urlEmail) setMode('reset');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Connexion échouée.'); return; }
      localStorage.setItem('cabine_token', data.token);
      onLogin(data.agent);
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotLoading(true); setForgotMsg('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      setForgotMsg(data.message || 'Email envoyé si le compte existe.');
    } catch {
      setForgotMsg('Erreur réseau. Réessayez.');
    } finally { setForgotLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (resetNewPwd !== resetConfirm) { setResetMsg('❌ Les mots de passe ne correspondent pas.'); return; }
    if (resetNewPwd.length < 6) { setResetMsg('❌ Minimum 6 caractères.'); return; }
    setResetLoading(true); setResetMsg('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, token: resetToken, newPassword: resetNewPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setResetMsg(`❌ ${data.error}`); return; }
      setResetMsg('✅ ' + data.message);
      setTimeout(() => {
        window.history.replaceState({}, '', '/');
        setMode('login');
      }, 2000);
    } catch {
      setResetMsg('❌ Erreur réseau.');
    } finally { setResetLoading(false); }
  };

  const card = {
    width: '100%', maxWidth: '420px', background: 'var(--bg-card)',
    borderRadius: '20px', padding: '40px 36px',
    boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 0.3s ease forwards',
  };
  const Brand = () => (
    <div style={{textAlign: 'center', marginBottom: '32px'}}>
      <div style={{width: 60, height: 60, borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(99,102,241,0.35)'}}>
        <Zap size={28} fill="white" color="white" />
      </div>
      <h1 style={{fontSize: '24px', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px'}}>Cabine 2.0</h1>
      <p style={{color: 'var(--text-secondary)', fontSize: '14px'}}>Plateforme Fintech — Côte d'Ivoire</p>
    </div>
  );

  if (mode === 'forgot') return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '20px'}}>
      <div style={card}>
        <Brand />
        <h2 style={{fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)'}}>Mot de passe oublié</h2>
        <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px'}}>Entrez votre email — vous recevrez un lien de réinitialisation valable 1 heure.</p>
        {!forgotMsg ? (
          <form onSubmit={handleForgot}>
            <div className="form-group" style={{marginBottom: '16px'}}>
              <label style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block'}}>Adresse email</label>
              <input type="email" required autoFocus placeholder="exemple@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
            </div>
            <button type="submit" className="submit-btn" disabled={forgotLoading} style={{width: '100%'}}>
              {forgotLoading ? <><RefreshCw size={16} style={{animation: 'spin 1s linear infinite'}}/> Envoi...</> : 'Envoyer le lien'}
            </button>
          </form>
        ) : (
          <div style={{background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '14px', fontSize: '13px', color: 'var(--accent-green)', marginBottom: '16px'}}>
            <CheckCircle2 size={15} style={{marginRight: '6px', verticalAlign: 'middle'}}/>{forgotMsg}
          </div>
        )}
        <button onClick={() => setMode('login')} style={{width: '100%', marginTop: '12px', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600}}>
          ← Retour à la connexion
        </button>
      </div>
    </div>
  );

  if (mode === 'reset') return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '20px'}}>
      <div style={card}>
        <Brand />
        <h2 style={{fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)'}}>Nouveau mot de passe</h2>
        <form onSubmit={handleReset}>
          <div className="form-group" style={{marginBottom: '12px'}}>
            <label style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block'}}>Nouveau mot de passe</label>
            <input type="password" required minLength={6} autoFocus placeholder="Minimum 6 caractères" value={resetNewPwd} onChange={e => setResetNewPwd(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom: '20px'}}>
            <label style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block'}}>Confirmer le mot de passe</label>
            <input type="password" required placeholder="Répétez le mot de passe" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} />
          </div>
          {resetMsg && (
            <div style={{background: resetMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${resetMsg.startsWith('✅') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '10px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: resetMsg.startsWith('✅') ? 'var(--accent-green)' : 'var(--accent-red)'}}>
              {resetMsg}
            </div>
          )}
          <button type="submit" className="submit-btn" disabled={resetLoading} style={{width: '100%'}}>
            {resetLoading ? <><RefreshCw size={16} style={{animation: 'spin 1s linear infinite'}}/> Mise à jour...</> : 'Changer le mot de passe'}
          </button>
        </form>
        <button onClick={() => { setMode('login'); window.history.replaceState({}, '', '/'); }} style={{width: '100%', marginTop: '12px', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600}}>
          ← Retour à la connexion
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '20px'}}>
      <div style={card}>
        <Brand />
        <form onSubmit={handleLogin}>
          <div className="form-group" style={{marginBottom: '16px'}}>
            <label style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block'}}>Adresse email</label>
            <input type="email" required autoFocus placeholder="exemple@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom: '8px', position: 'relative'}}>
            <label style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block'}}>Mot de passe</label>
            <input type={showPwd ? 'text' : 'password'} required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{paddingRight: '44px'}} />
            <button type="button" onClick={() => setShowPwd(p => !p)} style={{position: 'absolute', right: '12px', bottom: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer'}}>
              {showPwd ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
          </div>
          <div style={{textAlign: 'right', marginBottom: '20px'}}>
            <button type="button" onClick={() => setMode('forgot')} style={{background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600}}>
              Mot de passe oublié ?
            </button>
          </div>
          {error && (
            <div style={{background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', color: 'var(--accent-red)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <AlertTriangle size={15}/> {error}
            </div>
          )}
          <button type="submit" className="submit-btn" disabled={loading} style={{width: '100%'}}>
            {loading ? <><RefreshCw size={16} style={{animation: 'spin 1s linear infinite'}}/> Connexion...</> : <><Zap size={16}/> Se connecter</>}
          </button>
        </form>
        <p style={{textAlign: 'center', marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)'}}>Cabine 2.0 — Accès réservé aux agents autorisés</p>
      </div>
    </div>
  );
}

function App() {
  // Auth
  const [authAgent, setAuthAgent]           = useState(null);
  const [authChecked, setAuthChecked]       = useState(false);

  const getToken = () => localStorage.getItem('cabine_token');
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
    } catch { /* silently ignore */ }
    localStorage.removeItem('cabine_token');
    setAuthAgent(null);
  };

  // Validate token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthChecked(true); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(agent => { if (agent) setAuthAgent(agent); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProvider, setSelectedProvider] = useState('orange');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('all');
  const [transactionSince, setTransactionSince] = useState('');
  const [transactionUntil, setTransactionUntil] = useState('');
  const [agentName, setAgentName] = useState('Chargement...');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [activeOperation, setActiveOperation] = useState('transfer');
  const [analytics, setAnalytics] = useState(null);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('sidebar_collapsed') === 'true'
  );
  const offlineCount = useRef(0);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cabine_contacts') || '[]'); }
    catch { return []; }
  });

  // GeniusPay Status
  const [gpStatus, setGpStatus] = useState({ connected: false, mode: 'sandbox', hasKeys: false });

  // Agent management (admin)
  const [agentsList, setAgentsList]           = useState([]);
  const [agentsLoading, setAgentsLoading]     = useState(false);
  const [newAgentName, setNewAgentName]       = useState('');
  const [newAgentEmail, setNewAgentEmail]     = useState('');
  const [newAgentPass, setNewAgentPass]       = useState('');
  const [newAgentBalance, setNewAgentBalance] = useState('');
  const [agentFormMsg, setAgentFormMsg]       = useState('');

  // Admin supervision
  const [adminOverview, setAdminOverview]     = useState(null);
  const [adminLoading, setAdminLoading]       = useState(false);
  const [invoicesList, setInvoicesList]       = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [rechargeModal, setRechargeModal]     = useState(null);
  const [rechargeAmount, setRechargeAmount]   = useState('');
  const [rechargeNote, setRechargeNote]       = useState('');
  const [rechargeMsg, setRechargeMsg]         = useState('');
  const [genInvoiceMsg, setGenInvoiceMsg]     = useState('');
  const [webhookDebug, setWebhookDebug]       = useState(null);

  // Change password (for all users)
  const [changePwdCurrent, setChangePwdCurrent]   = useState('');
  const [changePwdNew, setChangePwdNew]           = useState('');
  const [changePwdConfirm, setChangePwdConfirm]   = useState('');
  const [changePwdMsg, setChangePwdMsg]           = useState('');
  const [changePwdLoading, setChangePwdLoading]   = useState(false);

  // Alert threshold
  const [alertThreshold, setAlertThreshold]       = useState(50000);
  const [alertThresholdInput, setAlertThresholdInput] = useState('50000');
  const [alertThresholdMsg, setAlertThresholdMsg] = useState('');

  // Commission config
  const [commissions, setCommissions] = useState({ transfer: 2, withdraw: 2, airtime: 2, internet: 2 });
  const [localRates, setLocalRates]   = useState({ transfer: 2, withdraw: 2, airtime: 2, internet: 2 });
  const [commissionSaving, setCommissionSaving] = useState({}); // { [type]: bool }

  // Balance visibility toggle
  const [balanceHidden, setBalanceHidden] = useState(false);

  // Kiosk mode
  const [isKiosk, setIsKiosk]             = useState(KioskService.isKiosk());
  const [kioskPinInput, setKioskPinInput] = useState('');
  const [kioskPinError, setKioskPinError] = useState('');
  const [showKioskExit, setShowKioskExit] = useState(false);

  // Forfaits opérateurs — chargés depuis /api/bundles
  const [serverBundles, setServerBundles] = useState({ internet: INTERNET_BUNDLES_FALLBACK, calls: {}, lastUpdated: null });

  const avatarInitials = agentName
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AG';

  // Toast Notifications
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  // Security States
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pinCode, setPinCode] = useState('');
  
  // Settings PIN States
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinUpdateMessage, setPinUpdateMessage] = useState('');

  // Receipt States
  const [receiptData, setReceiptData] = useState(null);
  const pendingTxRef = useRef(null);
  const receiptRef = useRef(null);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Phone number formatting helper
  const formatPhoneDisplay = (value) => {
    const digits = value.replace(/\D/g, '');
    const parts = [];
    for (let i = 0; i < digits.length && i < 10; i += 2) {
      parts.push(digits.substring(i, i + 2));
    }
    return parts.join(' ');
  };

  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').substring(0, 10);
    const formatted = formatPhoneDisplay(raw);
    setPhone(formatted);
    const op = detectOperator(raw);
    if (op) setSelectedProvider(op);
  };

  const addToast = useCallback((type, title, message) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchGpStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/geniuspay/status`);
      const data = await res.json();
      setGpStatus(data);
    } catch (e) { /* silent */ }
  };

  const fetchBundles = async () => {
    try {
      const res = await fetch(`${API_URL}/bundles`);
      const data = await res.json();
      setServerBundles(data);
    } catch (e) { /* keep fallback */ }
  };

  const fetchCommissions = async () => {
    try {
      const res = await apiFetch('/commissions');
      const data = await res.json();
      if (Array.isArray(data)) {
        const map = {};
        data.forEach(c => { map[c.type] = parseFloat(c.rate_percent) ?? 2; });
        setCommissions(prev => ({ ...prev, ...map }));
        setLocalRates(prev => ({ ...prev, ...map }));
      }
    } catch { /* keep defaults */ }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (changePwdNew !== changePwdConfirm) { setChangePwdMsg('❌ Les mots de passe ne correspondent pas.'); return; }
    if (changePwdNew.length < 6) { setChangePwdMsg('❌ Minimum 6 caractères.'); return; }
    setChangePwdLoading(true); setChangePwdMsg('');
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: changePwdCurrent, newPassword: changePwdNew }),
      });
      const data = await res.json();
      if (!res.ok) { setChangePwdMsg(`❌ ${data.error}`); return; }
      setChangePwdMsg('✅ ' + data.message);
      setChangePwdCurrent(''); setChangePwdNew(''); setChangePwdConfirm('');
      setTimeout(() => setChangePwdMsg(''), 4000);
    } catch (err) { setChangePwdMsg(`❌ ${err.message}`); }
    finally { setChangePwdLoading(false); }
  };

  const saveAlertThreshold = async () => {
    const val = parseInt(alertThresholdInput, 10);
    if (isNaN(val) || val < 0) { setAlertThresholdMsg('❌ Valeur invalide.'); return; }
    try {
      const res = await apiFetch('/wallet/alert-threshold', { method: 'PUT', body: JSON.stringify({ threshold: val }) });
      const data = await res.json();
      if (!res.ok) { setAlertThresholdMsg(`❌ ${data.error}`); return; }
      setAlertThreshold(val);
      setAlertThresholdMsg('✅ Seuil mis à jour.');
      setTimeout(() => setAlertThresholdMsg(''), 3000);
    } catch (err) { setAlertThresholdMsg(`❌ ${err.message}`); }
  };

  const saveCommission = async (type, rate) => {
    setCommissionSaving(prev => ({ ...prev, [type]: true }));
    try {
      const res = await apiFetch(`/commissions/${type}`, {
        method: 'PUT',
        body: JSON.stringify({ rate_percent: rate }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommissions(prev => ({ ...prev, [type]: rate }));
        addToast('success', 'Commission mise à jour', data.message);
      } else {
        addToast('error', 'Erreur', data.error);
      }
    } catch (err) {
      addToast('error', 'Erreur réseau', err.message);
    } finally {
      setCommissionSaving(prev => ({ ...prev, [type]: false }));
    }
  };

  const apiFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    if (res.status === 401) { handleLogout(); throw new Error('Session expirée'); }
    return res;
  }, []);

  const fetchAgents = async () => {
    setAgentsLoading(true);
    try {
      const res = await apiFetch('/agents');
      const data = await res.json();
      setAgentsList(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally { setAgentsLoading(false); }
  };

  const createAgent = async (e) => {
    e.preventDefault();
    setAgentFormMsg('');
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: newAgentName.trim(),
          email: newAgentEmail.trim(),
          password: newAgentPass,
          initialBalance: parseInt(newAgentBalance || '0', 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAgentFormMsg(`❌ ${data.error}`); return; }
      setAgentFormMsg(`✅ Agent "${data.name}" créé. PIN par défaut: 1234`);
      setNewAgentName(''); setNewAgentEmail(''); setNewAgentPass(''); setNewAgentBalance('');
      fetchAgents();
    } catch (err) { setAgentFormMsg(`❌ ${err.message}`); }
  };

  const toggleAgent = async (id) => {
    try {
      await apiFetch(`/agents/${id}/toggle`, { method: 'PUT' });
      fetchAgents();
    } catch { /* silent */ }
  };

  const fetchAdminOverview = async () => {
    setAdminLoading(true);
    try {
      const res = await apiFetch('/admin/overview');
      const data = await res.json();
      setAdminOverview(data);
    } catch { /* silent */ } finally { setAdminLoading(false); }
  };

  const fetchAdminInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const res = await apiFetch('/invoices');
      const data = await res.json();
      setInvoicesList(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally { setInvoicesLoading(false); }
  };

  const rechargeAgent = async () => {
    if (!rechargeModal) return;
    const numAmount = parseInt(rechargeAmount, 10);
    if (!numAmount || numAmount <= 0) { setRechargeMsg('❌ Montant invalide.'); return; }
    try {
      setRechargeMsg('Rechargement en cours...');
      const res = await apiFetch(`/admin/recharge/${rechargeModal.agentId}`, {
        method: 'POST',
        body: JSON.stringify({ amount: numAmount, description: rechargeNote || 'Recharge admin' }),
      });
      const data = await res.json();
      if (!res.ok) { setRechargeMsg(`❌ ${data.error}`); return; }
      setRechargeMsg(`✅ ${data.message}`);
      setRechargeAmount('');
      fetchAdminOverview();
      setTimeout(() => { setRechargeModal(null); setRechargeMsg(''); }, 1800);
    } catch (err) { setRechargeMsg(`❌ ${err.message}`); }
  };

  const generateInvoices = async () => {
    try {
      setGenInvoiceMsg('Génération en cours...');
      const res = await apiFetch('/invoices/generate', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { setGenInvoiceMsg(`❌ ${data.error}`); return; }
      setGenInvoiceMsg(`✅ ${data.message || 'Factures générées.'}`);
      fetchAdminInvoices();
      setTimeout(() => setGenInvoiceMsg(''), 3500);
    } catch (err) { setGenInvoiceMsg(`❌ ${err.message}`); }
  };

  const payInvoice = async (id) => {
    try {
      const res = await apiFetch(`/invoices/${id}/pay`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) { addToast('error', 'Erreur', data.error); return; }
      addToast('success', 'Facture payée', data.message || 'Paiement enregistré.');
      fetchAdminInvoices();
      fetchData();
    } catch (err) { addToast('error', 'Erreur', err.message); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await apiFetch('/analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (e) { /* silent */ }
  };

  const saveContact = () => {
    const raw = phone.replace(/\s/g, '');
    if (!raw || raw.length < 8) return;
    const newContact = { phone: raw, operator: selectedProvider };
    const updated = [newContact, ...contacts.filter(c => c.phone !== raw)].slice(0, 8);
    setContacts(updated);
    localStorage.setItem('cabine_contacts', JSON.stringify(updated));
    addToast('success', 'Contact sauvegardé', `${formatPhoneDisplay(raw)} ajouté aux favoris.`);
  };

  const fetchData = async () => {
    try {
      const walletRes = await apiFetch('/wallet');
      const walletData = await walletRes.json();
      setBalance(walletData.balance);
      setAgentName(walletData.agent_name);
      offlineCount.current = 0;
      setIsOffline(false);

      const queryParams = new URLSearchParams({ limit: '50' });
      if (transactionStatus && transactionStatus !== 'all') queryParams.set('status', transactionStatus);
      if (transactionSearch) queryParams.set('q', transactionSearch);
      if (transactionSince) queryParams.set('since', transactionSince);
      if (transactionUntil) queryParams.set('until', transactionUntil);

      const txRes = await apiFetch(`/transactions?${queryParams.toString()}`);
      const txData = await txRes.json();
      setTransactions(txData);

      if (pendingTxRef.current) {
        const tx = txData.find(t => t.id === pendingTxRef.current);
        if (tx) {
          const fmtAmt = new Intl.NumberFormat('fr-FR').format(tx.amount);
          if (tx.status === 'SUCCESS') {
            setReceiptData(tx);
            pendingTxRef.current = null;
            // Haptic feedback on mobile
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            if (tx.type === 'RETRAIT') {
              addToast('success', 'Retrait réussi !', `+${fmtAmt} F encaissés depuis ${tx.phone}`);
            } else if (tx.type === 'AIRTIME') {
              addToast('success', 'Crédit envoyé !', `${fmtAmt} FCFA rechargés sur ${tx.phone}`);
            } else if (tx.type === 'INTERNET') {
              addToast('success', 'Forfait activé !', `Forfait internet activé sur ${tx.phone}`);
            } else {
              addToast('success', 'Transaction réussie !', `${fmtAmt} F envoyés à ${tx.phone}`);
            }
          } else if (tx.status === 'FAILED') {
            pendingTxRef.current = null;
            if (tx.type === 'RETRAIT') {
              addToast('error', 'Retrait échoué', `Le client n'a pas pu envoyer les fonds. Solde non débité.`);
            } else if (tx.type === 'AIRTIME') {
              addToast('error', 'Recharge échouée', `La recharge crédit a échoué. Solde recrédité.`);
            } else if (tx.type === 'INTERNET') {
              addToast('error', 'Forfait non activé', `L'activation du forfait a échoué. Solde recrédité.`);
            } else {
              addToast('error', 'Transaction échouée', `${fmtAmt} F vers ${tx.phone} — Solde recrédité.`);
            }
          }
        }
      }
      setIsLoading(false);
    } catch (error) {
      offlineCount.current += 1;
      setIsOffline(offlineCount.current >= 20); // 60s tolerance for cold starts
      setIsLoading(false);
      console.warn(`Tentative ${offlineCount.current} — backend inaccessible`);
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions') setTxBadge(0); // efface le badge quand on ouvre Historique
  }, [activeTab]);

  useEffect(() => {
    if (!authAgent) return; // attendre que l'auth soit résolue
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'settings' && authAgent.role === 'admin') fetchAgents();
    if (activeTab === 'admin' && authAgent.role === 'admin') { fetchAdminOverview(); fetchAdminInvoices(); fetchCommissions(); }
  }, [activeTab, authAgent?.id]); // authAgent.id en dépendance — recharge si l'auth change

  useEffect(() => {
    if (!authAgent) return;
    fetchCommissions();
    // Charger les données admin dès le login si on est déjà sur le bon onglet
    if (authAgent.role === 'admin') {
      if (activeTab === 'admin') { fetchAdminOverview(); fetchAdminInvoices(); }
      if (activeTab === 'settings') fetchAgents();
    }
  }, [authAgent?.id]);

  const sseRef = useRef(null);
  const [txBadge, setTxBadge] = useState(0); // badge "nouvelles tx" sur Historique

  // SSE — connexion temps réel, remplace le polling 3s
  const connectSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    sseRef.current = es;

    es.addEventListener('tx_update', (e) => {
      const d = JSON.parse(e.data);
      setTransactions(prev => prev.map(tx =>
        tx.id === d.txId ? { ...tx, status: d.status, geniuspay_ref: d.ref || tx.geniuspay_ref } : tx
      ));
      // Badge sur Historique si l'onglet n'est pas actif
      if (d.status === 'SUCCESS' || d.status === 'FAILED') {
        setTxBadge(n => n + 1);
      }
      if (d.balance !== undefined) setBalance(d.balance);

      if (pendingTxRef.current === d.txId) {
        if (d.status === 'SUCCESS' || d.status === 'FAILED') {
          fetchData(); // rafraîchit solde + liste complète
        }
      }
    });

    es.addEventListener('balance_update', (e) => {
      const d = JSON.parse(e.data);
      if (d.balance !== undefined) {
        setBalance(d.balance);
        if (d.type === 'RECHARGE') addToast('success', 'Compte rechargé', `+${new Intl.NumberFormat('fr-FR').format(d.amount)} FCFA crédités.`);
      }
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
      // Reconnexion après 5s si toujours authentifié
      setTimeout(() => { if (getToken()) connectSSE(); }, 5000);
    };
  }, []);

  useEffect(() => {
    if (authAgent) connectSSE();
    return () => { sseRef.current?.close(); sseRef.current = null; };
  }, [authAgent]);

  useEffect(() => {
    fetchBundles();
    KioskService.restore();
    const unsub = KioskService.onChange(v => setIsKiosk(v));

    // Capacitor Android back button — navigate back through tabs instead of exiting
    let backListener = null;
    const setupBackButton = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        backListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (activeTab !== 'dashboard') {
            setActiveTab('dashboard');
          } else if (!canGoBack) {
            CapApp.minimizeApp();
          }
        });
      } catch { /* not in Capacitor env */ }
    };
    setupBackButton();

    return () => {
      unsub();
      backListener?.remove();
    };
  }, []);

  useEffect(() => {
    fetchData();
    fetchGpStatus();
    // Poll only when user is on dashboard or transactions (live data matters)
    // Polling de sécurité 30s (SSE gère le temps réel, le poll garantit la cohérence)
    const interval = setInterval(fetchData, 30000);
    const gpInterval = setInterval(fetchGpStatus, 30000);
    const goOffline = () => { offlineCount.current = 10; setIsOffline(true); };
    const goOnline = () => { offlineCount.current = 0; setIsOffline(false); fetchData(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      if (interval) clearInterval(interval);
      clearInterval(gpInterval);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [transactionSearch, transactionStatus, transactionSince, transactionUntil, activeTab]);

  const initiateTransfer = (e) => {
    e.preventDefault();
    if (!phone) return;
    if (activeOperation === 'internet') {
      if (!selectedBundle) {
        addToast('warning', 'Forfait requis', 'Veuillez sélectionner un forfait internet.');
        return;
      }
    } else {
      if (!amount) return;
    }
    setShowConfirmModal(true);
  };

  const confirmAndShowPin = () => {
    setShowConfirmModal(false);
    setPinCode('');
    setShowPinModal(true);
  };

  const handlePinKeyPress = (digit) => {
    if (pinCode.length < 4) {
      const entered = pinCode + digit;
      setPinCode(entered);
      if (entered.length === 4) {
        executeTransfer(entered);
      }
    }
  };

  const handlePinDelete = () => {
    setPinCode(pinCode.slice(0, -1));
  };

  const executeTransfer = async (enteredPin) => {
    setIsProcessing(true);
    const cfg = OP_CONFIG[activeOperation];
    const numAmount = activeOperation === 'internet'
      ? selectedBundle.price
      : parseInt(amount, 10);
    // Capture before reset
    const capturedPhone = phone;
    const capturedBundle = selectedBundle;

    try {
      const body = {
        provider: selectedProvider,
        phone: capturedPhone,
        amount: numAmount,
        pin: enteredPin,
      };
      if (activeOperation === 'internet' && capturedBundle) {
        body.bundle = capturedBundle;
      }

      const response = await apiFetch(cfg.endpoint.replace(API_URL, ''), {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok) {
        pendingTxRef.current = result.txId;
        setAmount('');
        setPhone('');
        setSelectedBundle(null);
        setPinCode('');
        setShowPinModal(false);
        fetchData();
        const fmtAmt = new Intl.NumberFormat('fr-FR').format(numAmount);
        if (activeOperation === 'withdraw') {
          addToast('info', 'Retrait initié', `Encaissement de ${fmtAmt} FCFA en cours...`);
        } else if (activeOperation === 'airtime') {
          addToast('info', 'Recharge en cours', `${fmtAmt} FCFA de crédit vers ${capturedPhone}...`);
        } else if (activeOperation === 'internet') {
          addToast('info', 'Activation en cours', `${capturedBundle?.label} en cours sur ${capturedPhone}...`);
        } else {
          addToast('info', 'Transaction initiée', `Traitement via GeniusPay ${result.mode === 'sandbox' ? '(Sandbox)' : ''}...`);
        }
        if (window.innerWidth < 768) {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
      } else {
        addToast('error', 'Erreur', result.error);
        setPinCode('');
      }
    } catch (error) {
      addToast('error', 'Erreur réseau', 'Impossible de joindre le serveur.');
      setPinCode('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdatePin = async (e) => {
    e.preventDefault();
    setPinUpdateMessage('Mise à jour en cours...');
    
    try {
      const response = await apiFetch('/wallet/pin', {
        method: 'PUT',
        body: JSON.stringify({ oldPin, newPin }),
      });

      const result = await response.json();
      if (response.ok) {
        setPinUpdateMessage('✅ Code PIN mis à jour avec succès.');
        setOldPin('');
        setNewPin('');
        setTimeout(() => setPinUpdateMessage(''), 3000);
      } else {
        setPinUpdateMessage(`❌ Erreur: ${result.error}`);
      }
    } catch (err) {
      setPinUpdateMessage("❌ Erreur de connexion au serveur.");
    }
  };

  const downloadReceipt = async () => {
    if (receiptRef.current) {
      try {
        const canvas = await html2canvas(receiptRef.current, { backgroundColor: '#ffffff' });
        const image = canvas.toDataURL("image/png", 1.0);
        const link = document.createElement('a');
        link.download = `Recu_Cabine_TX_${receiptData.id}.png`;
        link.href = image;
        link.click();
      } catch (err) {
        console.error("Erreur génération reçu", err);
      }
    }
  };

  const shareReceipt = async () => {
    if (receiptRef.current) {
      try {
        const canvas = await html2canvas(receiptRef.current, { backgroundColor: '#ffffff' });
        canvas.toBlob(async (blob) => {
          if (navigator.share && blob) {
            const file = new File([blob], `Recu_Cabine_TX_${receiptData.id}.png`, { type: blob.type });
            try {
              await navigator.share({
                title: 'Reçu de Transaction Cabine 2.0',
                text: `Reçu pour la transaction de ${receiptData.amount} FCFA vers ${receiptData.phone}.`,
                files: [file],
              });
            } catch (error) {
              console.log("Partage annulé ou échoué", error);
            }
          } else {
            addToast('info', 'Partage non disponible', "Le partage natif n'est pas supporté sur cet appareil.");
          }
        }, "image/png");
      } catch (err) {
        console.error("Erreur lors de la préparation du partage", err);
      }
    }
  };

  const printReceipt = async () => {
    if (!receiptData) return;
    try {
      await PrintService.print(receiptData, agentName, balance);
    } catch (err) {
      addToast('error', 'Impression échouée', err.message || 'Erreur impression');
    }
  };

  const copyToClipboard = (text, label = 'Référence') => {
    navigator.clipboard?.writeText(text).then(() => {
      addToast('success', 'Copié !', `${label} copiée dans le presse-papier.`);
    }).catch(() => {
      addToast('info', 'Non supporté', 'La copie automatique n\'est pas disponible.');
    });
  };

  const getProviderIcon = (provider) => {
    return <img src={OPERATOR_LOGOS[provider]} alt={OPERATOR_NAMES[provider]} style={{width: 34, height: 34, borderRadius: 8, objectFit: 'contain'}} />;
  };

  const downloadTransactionsCsv = () => {
    const header = ['Date', 'Référence', 'Type', 'Opérateur', 'Téléphone', 'Montant', 'Statut', 'Ref GeniusPay'];
    const rows = transactions.map(tx => ([
      new Date(tx.created_at).toLocaleString('fr-FR'),
      `TX-${tx.id.toString().padStart(6, '0')}`,
      tx.type || 'TRANSFER',
      OPERATOR_NAMES[tx.provider] || tx.provider,
      tx.phone,
      tx.type === 'RETRAIT' ? `+${tx.amount}` : `-${tx.amount}`,
      tx.status,
      tx.geniuspay_ref || ''
    ]));

    const csvLines = [header, ...rows].map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'transactions-cabine-2-0.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'SUCCESS':
        return <div className="tx-status success"><CheckCircle2 size={10} style={{marginRight: '4px', verticalAlign: 'middle'}}/> Succès</div>;
      case 'PROCESSING':
        return <div className="tx-status processing"><RefreshCw size={10} style={{marginRight: '4px', verticalAlign: 'middle', animation: 'spin 1s linear infinite'}}/> GeniusPay...</div>;
      case 'PENDING':
        return <div className="tx-status pending"><Clock size={10} style={{marginRight: '4px', verticalAlign: 'middle'}}/> En cours</div>;
      case 'FAILED':
        return <div className="tx-status" style={{background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)'}}><XCircle size={10} style={{marginRight: '4px', verticalAlign: 'middle'}}/> Échec (Remboursé)</div>;
      default:
        return null;
    }
  };

  // VIEWS
  const detectedOp = detectOperator(phone);

  const renderDashboard = () => {
    const successCount = transactions.filter(t => t.status === 'SUCCESS').length;
    const successRate = Math.round((successCount / Math.max(transactions.length, 1)) * 100) || 0;
    const gpMode = gpStatus.connected
      ? (gpStatus.mode === 'live' ? 'live' : 'sandbox')
      : gpStatus.hasKeys ? 'warn' : 'off';
    const gpLabel = gpStatus.connected
      ? (gpStatus.mode === 'live' ? 'Live' : 'Sandbox')
      : gpStatus.hasKeys ? 'Simulateur' : 'Hors ligne';

    return (
    <>
      {/* ── PREMIUM DASHBOARD HEADER ── */}
      <div className="dashboard-header animate-in">
        <div className="header-left">
          <h1>{getGreeting()}, {agentName.split(' ')[0]} 👋</h1>
          <p>Prêt à traiter les transactions d'aujourd'hui ?</p>
          <div className="status-badges">
            {/* Statut connexion — visible par tous */}
            <span className={`status-pill gp-${gpMode}`}>
              <span className="status-dot"/>
              {authAgent?.role === 'admin' ? `GeniusPay ${gpLabel}` : (gpStatus.connected ? '● En ligne' : '● Hors ligne')}
            </span>
            {/* Infos techniques — admin seulement */}
            {authAgent?.role === 'admin' && gpStatus.walletId && (
              <span className="status-pill account">
                <Layers size={10}/> {gpStatus.walletId}
              </span>
            )}
            {authAgent?.role === 'admin' && (
              <span className="status-pill account">
                <Zap size={10}/> CAB-{String(balance).slice(-4).padStart(4,'0')}
              </span>
            )}
          </div>
        </div>

        <div className="master-balance">
          <div className="balance-header-row">
            <div className="balance-label">SOLDE FLOTTE</div>
            <button
              className="balance-eye-btn"
              onClick={() => setBalanceHidden(h => !h)}
              title={balanceHidden ? 'Afficher le solde' : 'Masquer le solde'}
            >
              {balanceHidden ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
          </div>
          <div className="balance-amount">
            {balanceHidden
              ? <span className="balance-masked">• • • • • •</span>
              : <>{new Intl.NumberFormat('fr-FR').format(balance)}<span className="currency-label">FCFA</span></>
            }
          </div>
          <div className="balance-footer-row">
            <Activity size={11}/>
            <span>{transactions.length > 0 ? `${transactions.length} tx aujourd'hui` : 'Aucune activité'}</span>
          </div>
        </div>
      </div>

      {/* ── 4 CARTES STATUT — chacune unique ── */}
      {(() => {
        const pendingCount = transactions.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING').length;
        const failedCount  = transactions.filter(t => t.status === 'FAILED').length;
        const cards = [
          {
            color: 'ac-green', iconColor: 'ac-icon-green',
            icon: <CheckCircle2 size={22}/>,
            label: 'Réussies',
            value: successCount,
            trend: 'trend-up',
            trendIcon: <TrendingUp size={11}/>,
            trendLabel: 'Filtrer →',
            onClick: () => { setActiveTab('transactions'); setTransactionStatus('SUCCESS'); },
            title: 'Voir les transactions réussies',
          },
          {
            color: 'ac-yellow', iconColor: 'ac-icon-yellow',
            icon: <Clock size={22}/>,
            label: 'En attente',
            value: pendingCount,
            trend: pendingCount > 0 ? 'trend-neutral' : 'trend-up',
            trendIcon: <Activity size={11}/>,
            trendLabel: 'Filtrer →',
            onClick: () => { setActiveTab('transactions'); setTransactionStatus('PENDING'); },
            title: 'Voir les transactions en attente',
          },
          {
            color: 'ac-red', iconColor: 'ac-icon-red',
            icon: <XCircle size={22}/>,
            label: 'Échouées',
            value: failedCount,
            trend: failedCount > 0 ? 'trend-down' : 'trend-up',
            trendIcon: failedCount > 0 ? <TrendingDown size={11}/> : <CheckCircle2 size={11}/>,
            trendLabel: failedCount > 0 ? 'Filtrer →' : 'Aucun échec',
            onClick: () => { setActiveTab('transactions'); setTransactionStatus('FAILED'); },
            title: 'Voir les transactions échouées',
          },
          {
            color: 'ac-purple', iconColor: 'ac-icon-purple',
            icon: <Target size={22}/>,
            label: 'Taux de succès',
            value: `${successRate}%`,
            trend: successRate >= 80 ? 'trend-up' : successRate >= 50 ? 'trend-neutral' : 'trend-down',
            trendIcon: successRate >= 80 ? <TrendingUp size={11}/> : successRate >= 50 ? <Activity size={11}/> : <TrendingDown size={11}/>,
            trendLabel: successRate >= 80 ? 'Excellent' : successRate >= 50 ? 'Correct' : 'Voir graphes →',
            onClick: () => setActiveTab('analytics'),
            title: 'Voir les analytiques détaillées',
          },
        ];
        return (
          <div className="analytics-grid animate-in" style={{animationDelay: '0.02s'}}>
            {cards.map((c, i) => (
              <div key={i} className={`analytics-card ${c.color} analytics-card--nav`}
                onClick={c.onClick} title={c.title}>
                <div className={`analytics-icon ${c.iconColor}`}>{c.icon}</div>
                <div className="analytics-content">
                  <p>{c.label}</p>
                  <h3>{c.value}</h3>
                  <div className={`analytics-trend ${c.trend}`}>
                    {c.trendIcon}<span>{c.trendLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="action-nav animate-in" style={{animationDelay: '0.05s'}}>
        {[
          { id: 'transfer', icon: <ArrowUpRight size={20}/>, label: 'Transfert' },
          { id: 'withdraw', icon: <ArrowDownToLine size={20}/>, label: 'Retrait' },
          { id: 'airtime',  icon: <PhoneCall size={20}/>, label: 'Crédit' },
          { id: 'internet', icon: <Wifi size={20}/>, label: 'Internet' },
        ].map(tab => {
          const isActive = tab.id === activeOperation;
          const cfg = OP_CONFIG[tab.id];
          return (
            <div key={tab.id}
              className={`action-tab ${isActive ? 'active' : ''}`}
              style={isActive ? { '--tab-color': cfg.color, '--tab-glow': cfg.glowColor } : {}}
              onClick={() => {
                setActiveOperation(tab.id);
                setAmount('');
                setPhone('');
                setSelectedBundle(null);
                const caps = OPERATOR_CAPS[tab.id] ?? ['orange','mtn','wave','moov'];
                if (!caps.includes(selectedProvider)) setSelectedProvider('orange');
              }}
            >
              <div className="tab-icon">{tab.icon}</div>
              <span>{tab.label}</span>
            </div>
          );
        })}
      </div>

      <div className="working-area animate-in" style={{animationDelay: '0.1s'}}>
        {/* Operation Panel */}
        <div className="card" key={activeOperation}>
          <div className="card-header" style={{borderBottom: `2px solid ${OP_CONFIG[activeOperation].color}22`}}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              color: OP_CONFIG[activeOperation].color, fontWeight:700
            }}>
              {activeOperation === 'transfer' && <ArrowUpRight size={16}/>}
              {activeOperation === 'withdraw' && <ArrowDownToLine size={16}/>}
              {activeOperation === 'airtime'  && <PhoneCall size={16}/>}
              {activeOperation === 'internet' && <Wifi size={16}/>}
              {OP_CONFIG[activeOperation].headerLabel}
            </span>
          </div>
          <div className="card-body animate-in">
            <form onSubmit={initiateTransfer}>
              <div className="form-group">
                <label>Réseau {activeOperation === 'internet' ? 'mobile' : 'de destination'}</label>
                <div className="provider-grid">
                  {(['orange', 'mtn', 'wave', 'moov']).filter(p =>
                    OPERATOR_CAPS[activeOperation]?.includes(p) ?? true
                  ).map(p => {
                    const isSelected = selectedProvider === p;
                    return (
                      <div key={p}
                        className={`provider-btn ${p} ${isSelected ? 'selected' : ''}`}
                        onClick={() => { setSelectedProvider(p); setSelectedBundle(null); }}
                      >
                        <img src={OPERATOR_LOGOS[p]} alt={OPERATOR_NAMES[p]} className="provider-logo-img" />
                        {OPERATOR_NAMES[p]}
                        {detectedOp === p && <span className={`detected-badge ${p}`}>Détecté</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {contacts.length > 0 && (
                <div className="contacts-section">
                  <label>Contacts rapides</label>
                  <div className="contacts-chips">
                    {contacts.map((c, i) => (
                      <button key={i} type="button" className="contact-chip"
                        onClick={() => {
                          setPhone(formatPhoneDisplay(c.phone));
                          setSelectedProvider(c.operator);
                        }}
                      >
                        <img src={OPERATOR_LOGOS[c.operator]} alt="" style={{width:14,height:14,borderRadius:3}}/>
                        {formatPhoneDisplay(c.phone)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>{OP_CONFIG[activeOperation].phoneLabel}</label>
                <div className="phone-field-row">
                  <input
                    type="tel"
                    className="phone-input"
                    placeholder="Ex: 07 00 00 00 00"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                  />
                  <button
                    type="button"
                    className="save-contact-btn"
                    onClick={saveContact}
                    title="Sauvegarder ce contact"
                    disabled={!phone || phone.replace(/\s/g,'').length < 8}
                  >
                    <Star size={14}/>
                  </button>
                </div>
              </div>

              {/* ── Internet: forfait data par catégorie ── */}
              {activeOperation === 'internet' && (() => {
                const opBundles = (serverBundles.internet || INTERNET_BUNDLES_FALLBACK)[selectedProvider] || {};
                const cats = [
                  { key: 'daily',   label: '⏱ Journalier' },
                  { key: 'weekly',  label: '📅 Hebdomadaire' },
                  { key: 'monthly', label: '🗓 Mensuel' },
                ];
                return (
                  <div className="form-group">
                    <div className="bundle-header-row">
                      <label>Choisir un forfait internet</label>
                      {serverBundles.lastUpdated && (
                        <span className="bundle-updated">Màj {serverBundles.lastUpdated}</span>
                      )}
                    </div>
                    {cats.map(({ key, label }) => {
                      const bundles = opBundles[key] || [];
                      if (!bundles.length) return null;
                      return (
                        <div key={key} className="bundle-category">
                          <div className="bundle-cat-label">{label}</div>
                          <div className="bundle-grid">
                            {bundles.map(b => (
                              <div key={b.id}
                                className={`bundle-card${selectedBundle?.id === b.id ? ' selected' : ''}`}
                                style={selectedBundle?.id === b.id ? {'--bundle-color': OP_CONFIG.internet.color} : {}}
                                onClick={() => setSelectedBundle(b)}
                              >
                                {b.tag && <span className="bundle-tag">{b.tag}</span>}
                                <div className="bundle-size">{b.label}</div>
                                <div className="bundle-price">{new Intl.NumberFormat('fr-FR').format(b.price)} F</div>
                                <div className="bundle-validity">{b.validity}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── Crédit: forfait appels par catégorie ── */}
              {activeOperation === 'airtime' && (() => {
                const opCalls = (serverBundles.calls || {})[selectedProvider] || {};
                const hasCalls = Object.values(opCalls).some(arr => arr?.length > 0);
                if (!hasCalls) return null;
                const cats = [
                  { key: 'daily',   label: '⏱ Journalier' },
                  { key: 'weekly',  label: '📅 Hebdomadaire' },
                  { key: 'monthly', label: '🗓 Mensuel' },
                ];
                return (
                  <div className="form-group">
                    <div className="bundle-header-row">
                      <label>Forfaits appels disponibles</label>
                      {serverBundles.lastUpdated && (
                        <span className="bundle-updated">Màj {serverBundles.lastUpdated}</span>
                      )}
                    </div>
                    {cats.map(({ key, label }) => {
                      const bundles = opCalls[key] || [];
                      if (!bundles.length) return null;
                      return (
                        <div key={key} className="bundle-category">
                          <div className="bundle-cat-label">{label}</div>
                          <div className="bundle-grid">
                            {bundles.map(b => (
                              <div key={b.id}
                                className={`bundle-card call-card${selectedBundle?.id === b.id ? ' selected' : ''}`}
                                style={selectedBundle?.id === b.id ? {'--bundle-color': OP_CONFIG.airtime.color} : {}}
                                onClick={() => { setSelectedBundle(b); setAmount(String(b.price)); }}
                              >
                                {b.tag && <span className="bundle-tag call-tag">{b.tag}</span>}
                                <div className="bundle-size"><Phone size={12} style={{marginBottom:3}}/>{b.label}</div>
                                <div className="bundle-price">{new Intl.NumberFormat('fr-FR').format(b.price)} F</div>
                                <div className="bundle-validity">{b.validity}</div>
                                {b.note && <div className="bundle-note">{b.note}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div className="bundle-or-divider"><span>— ou saisir un montant libre —</span></div>
                  </div>
                );
              })()}

              {/* Amount field — not shown for internet */}
              {activeOperation !== 'internet' && (
                <div className="form-group">
                  <label>{OP_CONFIG[activeOperation].amountLabel}</label>
                  <div className="amount-input">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setSelectedBundle(null); }}
                      required min="100" max="5000000"
                    />
                    <span className="currency">FCFA</span>
                  </div>
                  <div className="quick-amounts">
                    {[500, 1000, 2000, 5000, 10000, 20000, 50000].map(v => (
                      <button key={v} type="button" className="quick-amount-btn"
                        onClick={() => { setAmount(String(v)); setSelectedBundle(null); }}>
                        {v >= 1000 ? `${v/1000}k` : v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Info banner per operation */}
              {OP_CONFIG[activeOperation].infoBanner && (
                <div className={`op-info-banner op-info-banner--${activeOperation}`}>
                  {activeOperation === 'withdraw' && <ArrowDownToLine size={14}/>}
                  {activeOperation === 'airtime'  && <PhoneCall size={14}/>}
                  {activeOperation === 'internet' && <Wifi size={14}/>}
                  {OP_CONFIG[activeOperation].infoBanner}
                </div>
              )}

              <button type="submit"
                className={`submit-btn submit-btn--${activeOperation}`}
                disabled={isProcessing || !!pendingTxRef.current}
                style={{'--op-color': OP_CONFIG[activeOperation].color, '--op-glow': OP_CONFIG[activeOperation].glowColor}}
              >
                {pendingTxRef.current
                  ? <RefreshCw size={20} style={{animation:'spin 1s linear infinite'}}/>
                  : <>{activeOperation === 'transfer' && <Send size={18}/>}
                      {activeOperation === 'withdraw' && <ArrowDownToLine size={18}/>}
                      {activeOperation === 'airtime'  && <PhoneCall size={18}/>}
                      {activeOperation === 'internet' && <Wifi size={18}/>}
                      {' '}{OP_CONFIG[activeOperation].submitLabel}
                    </>
                }
              </button>
            </form>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            Historique en direct
            <span style={{fontSize: '12px', color: 'var(--accent-primary)', cursor: 'pointer'}} onClick={fetchData}><RefreshCw size={14}/></span>
          </div>
          <div className="card-body tx-body">
            <div className="tx-list">
              {transactions.length === 0 ? (
                <p style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px'}}>Aucune transaction</p>
              ) : (
                transactions.slice(0, 5).map(tx => (
                  <div className="tx-item" key={tx.id}>
                    <div className="tx-info">
                      <img src={OPERATOR_LOGOS[tx.provider]} alt={tx.provider} className="tx-logo" />
                      <div className="tx-details">
                        <p style={{textTransform: 'capitalize'}}>{tx.type} {OPERATOR_NAMES[tx.provider] || tx.provider}</p>
                        <span>{tx.phone}</span>
                      </div>
                    </div>
                    <div className={`tx-amount`}>
                      <p style={{fontWeight:'600', textDecoration: tx.status==='FAILED'?'line-through':'none',
                        color: tx.status==='FAILED' ? 'var(--text-muted)' :
                          tx.type==='RETRAIT' ? 'var(--accent-green)' :
                          tx.type==='AIRTIME' ? 'var(--accent-yellow)' :
                          tx.type==='INTERNET' ? 'var(--accent-blue)' : 'var(--text-dark)'}}>
                        {tx.type === 'RETRAIT' ? '+' : '-'} {new Intl.NumberFormat('fr-FR').format(tx.amount)} F
                      </p>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button className="view-all-btn" onClick={() => setActiveTab('transactions')}>
              Voir tout l'historique
              {transactions.length > 0 && <span className="view-all-count">{transactions.length}</span>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
  };

  const renderTransactions = () => (
    <div className="animate-in">
      <div className="dashboard-header" style={{marginBottom: '20px'}}>
        <div className="header-title">
          <h1>Historique Complet</h1>
          <p>Toutes vos transactions récentes</p>
        </div>
      </div>
      <div className="card" style={{minHeight: '60vh'}}>
        <div className="card-header">
          Historique des transactions
          <span style={{fontSize: '12px', color: 'var(--accent-primary)', cursor: 'pointer'}} onClick={fetchData}><RefreshCw size={14} style={{marginRight: '5px', verticalAlign:'middle'}}/> Actualiser</span>
        </div>
        <div className="filter-panel">
          <div className="filter-row">
            <input
              type="search"
              className="filter-input"
              placeholder="Rechercher par numéro, opérateur, référence..."
              value={transactionSearch}
              onChange={(e) => setTransactionSearch(e.target.value)}
            />
            <select className="filter-input" value={transactionStatus} onChange={(e) => setTransactionStatus(e.target.value)}>
              <option value="all">Tous statuts</option>
              <option value="PENDING">En cours</option>
              <option value="PROCESSING">Processing</option>
              <option value="SUCCESS">Succès</option>
              <option value="FAILED">Échec</option>
            </select>
          </div>
          <div className="filter-row" style={{justifyContent: 'space-between', gap: '12px'}}>
            <div className="date-filter">
              <label>Date début</label>
              <input type="date" value={transactionSince} onChange={(e) => setTransactionSince(e.target.value)} />
            </div>
            <div className="date-filter">
              <label>Date fin</label>
              <input type="date" value={transactionUntil} onChange={(e) => setTransactionUntil(e.target.value)} />
            </div>
            {(transactionSearch || transactionStatus !== 'all' || transactionSince || transactionUntil) && (
              <button className="reset-filters-btn" onClick={() => {
                setTransactionSearch(''); setTransactionStatus('all');
                setTransactionSince(''); setTransactionUntil('');
              }}>
                <X size={13}/> Réinitialiser
              </button>
            )}
            <button className="export-btn" onClick={downloadTransactionsCsv}>
              <Download size={14} style={{marginRight: '6px'}} /> Exporter CSV
            </button>
          </div>
        </div>
        <div className="card-body tx-body" style={{maxHeight: 'none'}}>
          <div className="tx-list">
            {transactions.length === 0 ? (
              <p style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px'}}>Aucune transaction disponible.</p>
            ) : (
              transactions.map(tx => (
                <div className="tx-item" key={tx.id} style={{padding: '14px 0'}}>
                  <div className="tx-info">
                    <img src={OPERATOR_LOGOS[tx.provider]} alt={tx.provider} className="tx-logo" />
                    <div className="tx-details">
                      <p style={{fontWeight: '600'}}>
                        {tx.type === 'RETRAIT'   && <span className="type-badge retrait">Retrait</span>}
                        {tx.type === 'AIRTIME'   && <span className="type-badge airtime">Crédit</span>}
                        {tx.type === 'INTERNET'  && <span className="type-badge internet">Internet</span>}
                        {OPERATOR_NAMES[tx.provider] || tx.provider}
                        <span style={{fontSize:'11px', color:'var(--text-muted)', fontWeight:'normal', marginLeft:'6px'}}>{new Date(tx.created_at).toLocaleString('fr-FR')}</span>
                      </p>
                      <span>
                        {tx.phone}
                        {' • '}
                        <span
                          className="tx-ref-copy"
                          onClick={() => copyToClipboard(`TX-${tx.id.toString().padStart(6,'0')}`, 'Référence')}
                          title="Copier la référence"
                        >
                          TX-{tx.id.toString().padStart(6,'0')} <Copy size={10}/>
                        </span>
                        {tx.geniuspay_ref && <> • <span className="tx-ref-copy" onClick={() => copyToClipboard(tx.geniuspay_ref, 'Réf. GeniusPay')} title="Copier réf. GeniusPay">{tx.geniuspay_ref} <Copy size={10}/></span></>}
                      </span>
                    </div>
                  </div>
                  <div className="tx-actions-row">
                    <div className="tx-amount" style={{textAlign: 'right'}}>
                      <p style={{fontWeight:'600', textDecoration: tx.status==='FAILED'?'line-through':'none',
                        color: tx.status==='FAILED' ? 'var(--text-muted)' :
                          tx.type==='RETRAIT' ? 'var(--accent-green)' :
                          tx.type==='AIRTIME' ? 'var(--accent-yellow)' :
                          tx.type==='INTERNET' ? 'var(--accent-blue)' : 'var(--text-dark)'}}>
                        {tx.type === 'RETRAIT' ? '+' : '-'} {new Intl.NumberFormat('fr-FR').format(tx.amount)} F
                      </p>
                      {getStatusBadge(tx.status)}
                    </div>
                    {tx.status === 'SUCCESS' && (
                       <button className="icon-btn" onClick={() => setReceiptData(tx)} title="Voir le reçu">
                         <Printer size={16} />
                       </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="animate-in">
      <div className="dashboard-header" style={{marginBottom: '20px'}}>
        <div className="header-title">
          <h1>Paramètres du compte</h1>
          <p>Gérez vos préférences et votre sécurité</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="card settings-panel">
          <div className="card-header">
            <Lock size={18} style={{marginRight: '8px', verticalAlign: 'middle'}}/> 
            Sécurité (Modifier le PIN)
          </div>
          <div className="card-body">
            <form onSubmit={handleUpdatePin}>
              <div className="form-group">
                <label>Ancien code PIN</label>
                <input 
                  type="password" 
                  maxLength="4"
                  placeholder="****"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nouveau code PIN (4 chiffres)</label>
                <input 
                  type="password" 
                  maxLength="4"
                  placeholder="****"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="submit-btn" style={{marginTop: '10px'}}>
                Mettre à jour le PIN
              </button>
              {pinUpdateMessage && (
                <div style={{marginTop: '15px', color: pinUpdateMessage.includes('✅') ? '#22c55e' : 'var(--accent-red)', fontSize: '14px', textAlign: 'center'}}>
                  {pinUpdateMessage}
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="card settings-panel">
          <div className="card-header">Profil de l'agent</div>
          <div className="card-body">
            <div className="profile-info-row"><span>Nom :</span> <strong>{agentName}</strong></div>
            <div className="profile-info-row" style={{marginTop: '10px'}}><span>Email :</span> <strong>{authAgent?.email || '—'}</strong></div>
            <div className="profile-info-row" style={{marginTop: '10px'}}><span>Rôle :</span>
              <strong style={{color: authAgent?.role === 'admin' ? 'var(--accent-primary)' : 'var(--accent-green)'}}>
                {authAgent?.role === 'admin' ? '👑 Administrateur' : '👤 Agent'}
              </strong>
            </div>
            <div className="profile-info-row" style={{marginTop: '10px'}}><span>Localisation :</span> <strong>Abidjan, Côte d'Ivoire</strong></div>
          </div>
        </div>

        {/* Changer le mot de passe */}
        <div className="card settings-panel">
          <div className="card-header"><Lock size={16} style={{marginRight:'8px',verticalAlign:'middle'}}/>Changer le mot de passe</div>
          <div className="card-body">
            <form onSubmit={handleChangePassword}>
              <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'12px', marginBottom:'12px'}}>
                <div className="form-group" style={{margin:0}}>
                  <label>Mot de passe actuel</label>
                  <input type="password" placeholder="••••••••" required value={changePwdCurrent} onChange={e => setChangePwdCurrent(e.target.value)} />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Nouveau mot de passe</label>
                  <input type="password" placeholder="Min. 6 caractères" required minLength={6} value={changePwdNew} onChange={e => setChangePwdNew(e.target.value)} />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Confirmer le nouveau mot de passe</label>
                  <input type="password" placeholder="Répétez le nouveau mot de passe" required value={changePwdConfirm} onChange={e => setChangePwdConfirm(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={changePwdLoading}>
                {changePwdLoading ? <><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Mise à jour...</> : 'Changer le mot de passe'}
              </button>
              {changePwdMsg && <p style={{marginTop:'10px', fontSize:'13px', color: changePwdMsg.startsWith('✅') ? 'var(--accent-green)' : 'var(--accent-red)'}}>{changePwdMsg}</p>}
            </form>
          </div>
        </div>

        {/* Seuil d'alerte solde bas */}
        <div className="card settings-panel">
          <div className="card-header"><AlertTriangle size={16} style={{marginRight:'8px',verticalAlign:'middle'}}/>Alerte solde bas</div>
          <div className="card-body">
            <p style={{fontSize:'13px', color:'var(--text-muted)', marginBottom:'12px'}}>
              Recevez un email automatique quand votre solde flotte descend sous ce seuil.
            </p>
            <div style={{display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap'}}>
              <div className="form-group" style={{margin:0, flex:1, minWidth:'180px'}}>
                <label>Seuil d'alerte (FCFA)</label>
                <input type="number" min="0" step="5000" value={alertThresholdInput} onChange={e => setAlertThresholdInput(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={saveAlertThreshold} style={{minWidth:'120px'}}>Enregistrer</button>
            </div>
            {alertThresholdMsg && <p style={{marginTop:'10px', fontSize:'13px', color: alertThresholdMsg.startsWith('✅') ? 'var(--accent-green)' : 'var(--accent-red)'}}>{alertThresholdMsg}</p>}
            <p style={{fontSize:'12px', color:'var(--text-muted)', marginTop:'8px'}}>
              Seuil actuel : <strong>{new Intl.NumberFormat('fr-FR').format(alertThreshold)} FCFA</strong>
              {' '}— Nécessite <code>RESEND_API_KEY</code> configuré sur Render.
            </p>
          </div>
        </div>

        {/* Statut GeniusPay — visible par tous */}
        <div className="card settings-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-header">
            <Radio size={18} style={{marginRight: '8px', verticalAlign: 'middle'}}/>
            Statut GeniusPay
          </div>
          <div className="card-body" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px'}}>
            {[
              { label: 'Connexion', value: gpStatus.connected ? '✅' : '❌', color: gpStatus.connected ? 'var(--accent-green)' : 'var(--accent-red)', size: '18px' },
              { label: 'Mode', value: gpStatus.mode === 'sandbox' ? '🧪 Sandbox' : '🔴 Live', size: '14px' },
              { label: 'Clés API', value: gpStatus.hasKeys ? '✅' : '❌', color: gpStatus.hasKeys ? 'var(--accent-green)' : 'var(--accent-red)', size: '18px' },
              { label: 'Wallet', value: gpStatus.walletId || 'Auto', size: '12px' },
            ].map((item, i) => (
              <div key={i} style={{flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display:'flex'}}>
                <span style={{fontSize:'12px', color:'var(--text-muted)'}}>{item.label}</span>
                <strong style={{color: item.color || 'var(--text-dark)', fontSize: item.size, marginTop: '8px'}}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Kiosk Mode Panel */}
        <div className="card settings-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-header">
            <Monitor size={18} style={{marginRight: '8px', verticalAlign: 'middle'}}/>
            Mode Kiosque (Terminal de paiement)
          </div>
          <div className="card-body">
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px'}}>
              <div>
                <div style={{fontWeight: 600, marginBottom: '4px'}}>
                  {isKiosk ? '🔒 Mode kiosque actif' : '🔓 Mode kiosque inactif'}
                </div>
                <div style={{fontSize: '13px', color: 'var(--text-secondary)'}}>
                  {isKiosk
                    ? 'L\'application est verrouillée en plein écran. Les utilisateurs ne peuvent pas quitter.'
                    : 'Activez ce mode pour bloquer l\'application sur le terminal de paiement.'}
                </div>
              </div>
              <button
                className={isKiosk ? 'btn-secondary' : 'btn-primary'}
                style={isKiosk ? {color: 'var(--accent-red)', minWidth: '140px'} : {minWidth: '140px'}}
                onClick={async () => {
                  if (isKiosk) {
                    setShowKioskExit(true);
                  } else {
                    await KioskService.enable();
                    addToast('success', 'Mode kiosque activé', 'Terminal verrouillé. PIN admin requis pour quitter.');
                  }
                }}
              >
                {isKiosk ? <><ShieldCheck size={15}/> Désactiver</> : <><Monitor size={15}/> Activer</>}
              </button>
            </div>

            <div style={{borderTop: '1px solid var(--border-color)', paddingTop: '16px'}}>
              <div style={{fontWeight: 600, marginBottom: '12px', fontSize: '14px'}}>
                Changer le PIN administrateur
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '400px'}}>
                <div className="form-group" style={{margin: 0}}>
                  <label>Ancien PIN admin</label>
                  <input
                    type="password"
                    maxLength="6"
                    placeholder="PIN actuel"
                    id="kiosk-old-pin"
                  />
                </div>
                <div className="form-group" style={{margin: 0}}>
                  <label>Nouveau PIN admin</label>
                  <input
                    type="password"
                    maxLength="6"
                    placeholder="Nouveau PIN"
                    id="kiosk-new-pin"
                  />
                </div>
              </div>
              <button
                className="btn-primary"
                style={{marginTop: '12px'}}
                onClick={() => {
                  const oldP = document.getElementById('kiosk-old-pin')?.value;
                  const newP = document.getElementById('kiosk-new-pin')?.value;
                  if (!oldP || !newP) { addToast('warning', 'Champs requis', 'Remplissez les deux champs PIN.'); return; }
                  if (newP.length < 4) { addToast('warning', 'PIN trop court', 'Le PIN doit contenir au moins 4 chiffres.'); return; }
                  const ok = KioskService.verifyAdminPin(oldP);
                  if (!ok) { addToast('error', 'PIN incorrect', 'L\'ancien PIN admin est incorrect.'); return; }
                  KioskService.setAdminPin(newP);
                  document.getElementById('kiosk-old-pin').value = '';
                  document.getElementById('kiosk-new-pin').value = '';
                  addToast('success', 'PIN mis à jour', 'Nouveau PIN administrateur enregistré.');
                }}
              >
                Mettre à jour le PIN kiosque
              </button>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px'}}>
                PIN par défaut: <code>1234</code> — Changez-le avant déploiement sur terminal.
              </p>
            </div>
          </div>
        </div>

        {/* Agent Management — lien vers Admin tab (doublon supprimé) */}
        {authAgent?.role === 'admin' && (
          <div className="card settings-panel" style={{gridColumn: '1 / -1'}}>
            <div className="card-header">
              <Activity size={18} style={{marginRight: '8px', verticalAlign: 'middle'}}/>
              Gestion des agents
            </div>
            <div className="card-body" style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'16px'}}>
              <div>
                <div style={{fontWeight: 600, marginBottom: '4px'}}>Créer, recharger et superviser les agents</div>
                <div style={{fontSize: '13px', color: 'var(--text-secondary)'}}>Toute la gestion se fait dans l'onglet Supervision</div>
              </div>
              <button className="btn-primary" onClick={() => setActiveTab('admin')} style={{minWidth: '160px'}}>
                <ShieldCheck size={15} style={{marginRight: '6px', verticalAlign: 'middle'}}/>
                Aller à Supervision
              </button>
            </div>
          </div>
        )}

        {/* Display preferences */}
        <div className="card settings-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-header">
            Préférences d'affichage
          </div>
          <div className="card-body" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'}}>
            <div>
              <div style={{fontWeight: 600, marginBottom: '4px'}}>Thème sombre</div>
              <div style={{fontSize: '13px', color: 'var(--text-secondary)'}}>Réduit la fatigue visuelle en conditions de faible luminosité</div>
            </div>
            <button
              className={darkMode ? 'btn-primary' : 'btn-secondary'}
              style={{minWidth: '120px'}}
              onClick={() => setDarkMode(d => !d)}
            >
              {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => {
    if (!analytics) {
      return (
        <div className="animate-in" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'300px',gap:'16px'}}>
          <RefreshCw size={28} style={{animation:'spin 1s linear infinite',color:'var(--accent-primary)'}}/>
          <p style={{color:'var(--text-muted)'}}>Chargement des analytiques...</p>
        </div>
      );
    }

    // Vue simplifiée pour agents (pas de graphes complexes)
    if (authAgent?.role !== 'admin') {
      const today = analytics.today || {};
      const yesterday = analytics.yesterday || {};
      const todayVol = parseInt(today.volume) || 0;
      const todayTx = parseInt(today.total) || 0;
      const todaySuccess = parseInt(today.success) || 0;
      const todayRate = todayTx > 0 ? Math.round(todaySuccess / todayTx * 100) : 0;
      const yesterdayVol = parseInt(yesterday.volume) || 0;
      return (
        <div className="animate-in">
          <div className="dashboard-header" style={{marginBottom: '20px'}}>
            <div className="header-title"><h1>Mes Performances</h1><p>Résumé de votre activité</p></div>
            <button className="export-btn" onClick={fetchAnalytics}><RefreshCw size={13}/> Actualiser</button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'14px', marginBottom:'24px'}}>
            {[
              { label: "Transactions auj.", value: todayTx, icon: <Activity size={20}/>, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
              { label: "Volume auj.", value: `${new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(todayVol)} F`, icon: <Banknote size={20}/>, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
              { label: "Taux de succès", value: `${todayRate}%`, icon: <Target size={20}/>, color: todayRate >= 80 ? '#10b981' : '#f59e0b', bg: `rgba(${todayRate >= 80 ? '16,185,129' : '245,158,11'},0.1)` },
              { label: "Vol. hier", value: `${new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(yesterdayVol)} F`, icon: <TrendingUp size={20}/>, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
            ].map((c,i) => (
              <div key={i} style={{background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'14px',padding:'16px',display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{width:40,height:40,borderRadius:'10px',background:c.bg,color:c.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.icon}</div>
                <div>
                  <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'2px'}}>{c.label}</div>
                  <div style={{fontSize:'20px',fontWeight:800,color:c.color,lineHeight:1.2}}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-header">Activité horaire — Aujourd'hui</div>
            <div className="card-body">
              <HourlyHeatmap hourly={analytics.hourly || []}/>
            </div>
          </div>
        </div>
      );
    }

    const today = analytics.today || {};
    const yesterday = analytics.yesterday || {};
    const allTime = analytics.allTime || {};
    const todayVol = parseInt(today.volume) || 0;
    const yesterdayVol = parseInt(yesterday.volume) || 0;
    const todayTx = parseInt(today.total) || 0;
    const yesterdayTx = parseInt(yesterday.total) || 0;
    const todaySuccess = parseInt(today.success) || 0;
    const todayRate = todayTx > 0 ? Math.round(todaySuccess / todayTx * 100) : 0;
    const volChange = yesterdayVol > 0 ? ((todayVol - yesterdayVol) / yesterdayVol * 100) : null;
    const txChange = yesterdayTx > 0 ? ((todayTx - yesterdayTx) / yesterdayTx * 100) : null;
    const totalAllTime = parseInt(allTime.total) || 0;
    const volumeAllTime = parseInt(allTime.volume) || 0;

    const last7 = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const found = (analytics.daily || []).find(r => (r.day || '').slice(0, 10) === dateStr);
      const [y, m, day] = dateStr.split('-');
      const localDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
      return {
        label: localDate.toLocaleDateString('fr-FR', {weekday: 'short'}),
        value: found ? (parseInt(found.volume) || 0) : 0,
      };
    });

    const donutSlices = (analytics.byOperator || []).map(op => ({
      label: OPERATOR_NAMES[op.provider] || op.provider,
      value: parseInt(op.volume) || 0,
      color: OPERATOR_COLORS[op.provider] || '#6366f1',
    }));

    const TrendBadge = ({ change }) => {
      if (change === null || change === undefined) return <span className="trend-badge neutral">—</span>;
      const isUp = change >= 0;
      return (
        <span className={`trend-badge ${isUp ? 'up' : 'down'}`}>
          {isUp ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
          {Math.abs(change).toFixed(1)}%
        </span>
      );
    };

    return (
      <div className="animate-in">
        <div className="dashboard-header" style={{marginBottom: '20px'}}>
          <div className="header-title">
            <h1>Analytiques</h1>
            <p>Performance et statistiques de votre cabine</p>
          </div>
          <button className="export-btn" onClick={fetchAnalytics} style={{alignSelf:'flex-start'}}>
            <RefreshCw size={13}/> Actualiser
          </button>
        </div>

        <div className="analytics-kpi-row">
          <div className="analytics-kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Transactions aujourd'hui</span>
              <TrendBadge change={txChange}/>
            </div>
            <div className="kpi-value">{todayTx}</div>
            <div className="kpi-sub">vs {yesterdayTx} hier</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Volume aujourd'hui</span>
              <TrendBadge change={volChange}/>
            </div>
            <div className="kpi-value" style={{fontSize:'22px'}}>
              {new Intl.NumberFormat('fr-FR').format(todayVol)}
            </div>
            <div className="kpi-sub">FCFA · hier : {new Intl.NumberFormat('fr-FR').format(yesterdayVol)}</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Taux de succès</span>
            </div>
            <div className="kpi-value">{todayRate}%</div>
            <div className="kpi-sub">{todaySuccess}/{todayTx} transactions</div>
          </div>
          <div className="analytics-kpi-card highlight">
            <div className="kpi-top">
              <span className="kpi-label">Volume total (all-time)</span>
            </div>
            <div className="kpi-value" style={{fontSize:'20px'}}>
              {new Intl.NumberFormat('fr-FR', {notation:'compact', maximumFractionDigits:1}).format(volumeAllTime)}
            </div>
            <div className="kpi-sub">{totalAllTime} transactions au total</div>
          </div>
        </div>

        <div className="charts-row">
          <div className="card chart-card">
            <div className="card-header">
              Volume — 7 derniers jours (FCFA)
            </div>
            <div className="card-body">
              <BarChart data={last7}/>
            </div>
          </div>
          <div className="card chart-card">
            <div className="card-header">Répartition par opérateur</div>
            <div className="card-body donut-section">
              <DonutChart slices={donutSlices}/>
              <div className="donut-legend">
                {donutSlices.length > 0 ? donutSlices.map((s, i) => (
                  <div key={i} className="legend-item">
                    <div className="legend-dot" style={{background: s.color}}/>
                    <span>{s.label}</span>
                    <strong>
                      {new Intl.NumberFormat('fr-FR', {notation:'compact', maximumFractionDigits:1}).format(s.value)}
                    </strong>
                  </div>
                )) : <p style={{color:'var(--text-muted)',fontSize:'13px'}}>Aucune transaction réussie</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{marginTop:'20px', marginBottom:'40px'}}>
          <div className="card-header">Activité horaire — Aujourd'hui</div>
          <div className="card-body">
            <p style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'12px'}}>
              Chaque cellule représente une heure de la journée. La cellule surlignée = heure courante.
            </p>
            <HourlyHeatmap hourly={analytics.hourly || []}/>
          </div>
        </div>
      </div>
    );
  };

  const renderAdmin = () => {
    if (!authAgent || authAgent.role !== 'admin') return null;
    const summary = adminOverview?.summary || {};
    const agentRows = adminOverview?.agents || [];
    const fmt = (n) => new Intl.NumberFormat('fr-FR').format(parseInt(n) || 0);
    const fmtC = (n) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(parseInt(n) || 0);

    return (
      <div className="animate-in">
        <div className="dashboard-header" style={{ marginBottom: '20px' }}>
          <div className="header-title">
            <h1>Supervision Admin</h1>
            <p>Gestion centralisée de la flotte d'agents</p>
          </div>
          <button className="export-btn" onClick={() => { fetchAdminOverview(); fetchAdminInvoices(); }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* Mon compte — self-recharge */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderRadius: '16px', padding: '20px', color: 'white' }}>
            <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '4px', fontWeight: 500 }}>MON SOLDE FLOTTE</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>
              {new Intl.NumberFormat('fr-FR').format(balance)} <span style={{ fontSize: '14px', fontWeight: 500 }}>FCFA</span>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.75 }}>{agentName} • Admin</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gestion du solde flotte</div>
            <button
              className="btn-primary"
              style={{ background: '#10b981', fontSize: '13px' }}
              onClick={async () => {
                addToast('info', 'Synchronisation...', 'Lecture du solde GeniusPay en cours.');
                try {
                  const res = await apiFetch('/admin/sync-balance', { method: 'POST', body: JSON.stringify({ agentId: authAgent?.id }) });
                  const data = await res.json();
                  if (!res.ok) { addToast('error', 'Erreur sync', data.error); return; }
                  addToast('success', 'Solde synchronisé', data.message);
                  setBalance(data.balance);
                  fetchAdminOverview();
                } catch (e) { addToast('error', 'Erreur', e.message); }
              }}
            >
              <RefreshCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Sync depuis GeniusPay
            </button>
            <button
              className="btn-primary"
              style={{ background: '#6366f1', fontSize: '13px' }}
              onClick={() => {
                setRechargeModal({ agentId: 'self', agentName: agentName + ' (moi)', currentBalance: balance });
                setRechargeAmount(''); setRechargeNote(''); setRechargeMsg('');
              }}
            >
              <Banknote size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Ajouter au solde
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize: '13px', color: 'var(--accent-red)' }}
              onClick={() => {
                const v = prompt('Définir le solde exact (FCFA) — remplace le solde actuel :');
                if (!v) return;
                const n = parseInt(v, 10);
                if (isNaN(n) || n < 0) { addToast('error', 'Valeur invalide', 'Entrez un nombre entier positif.'); return; }
                apiFetch(`/admin/set-balance/self`, { method: 'PUT', body: JSON.stringify({ balance: n, reason: 'Correction solde initial' }) })
                  .then(r => r.json())
                  .then(d => { addToast('success', 'Solde défini', d.message); setBalance(n); fetchAdminOverview(); })
                  .catch(e => addToast('error', 'Erreur', e.message));
              }}
            >
              Définir un solde exact
            </button>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              "Sync GeniusPay" lit le solde réel de ton wallet et le synchronise.<br/>
              "Définir exact" remplace le solde — utilise cette option pour passer de 2 450 000 F test à 0.
            </p>
          </div>
        </div>

        {/* Summary KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Agents totaux',   value: summary.totalAgents   || 0,                              icon: <Activity size={20}/>,    bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
            { label: 'Agents actifs',   value: summary.activeAgents  || 0,                              icon: <CheckCircle2 size={20}/>, bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
            { label: 'Float total',     value: `${fmtC(summary.totalFloat)} FCFA`,                      icon: <Banknote size={20}/>,     bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
            { label: "Tx auj.",         value: summary.todayTx       || 0,                              icon: <TrendingUp size={20}/>,   bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
            { label: "Volume auj.",     value: `${fmtC(summary.todayVolume)} F`,                        icon: <BarChart2 size={20}/>,    bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
          ].map((c, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px',
              padding: '16px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>{c.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.2 }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Agents table */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <Activity size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Agents & Soldes
            {adminLoading && <RefreshCw size={13} style={{ marginLeft: '8px', animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} />}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {agentRows.length === 0 ? (
              <p style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {adminLoading ? 'Chargement...' : 'Aucun agent trouvé.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-hover)' }}>
                      {['Agent', 'Solde', 'Tx auj.', 'Vol auj.', 'Limite/jour', 'Statut', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Agent' ? 'left' : 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agentRows.map(ag => (
                      <tr key={ag.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: ag.active ? 1 : 0.55 }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              background: ag.role === 'admin' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#10b981,#059669)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '11px',
                            }}>
                              {ag.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                                {ag.name}
                                {ag.role === 'admin' && <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: '10px' }}>Admin</span>}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ag.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap' }}>
                          {fmt(ag.balance)} F
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {ag.today_tx || 0}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmtC(ag.today_volume)} F
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            style={{ background: 'none', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            title="Cliquer pour modifier la limite journalière"
                            onClick={() => {
                              const v = prompt(`Limite journalière pour ${ag.name} (FCFA) :\nActuelle: ${new Intl.NumberFormat('fr-FR').format(ag.daily_limit || 2000000)} FCFA`);
                              if (!v) return;
                              const n = parseInt(v.replace(/\s/g,''), 10);
                              if (isNaN(n) || n < 0) return;
                              apiFetch(`/agents/${ag.id}/limits`, { method: 'PUT', body: JSON.stringify({ daily_limit: n }) })
                                .then(() => { addToast('success', 'Limite mise à jour', `${ag.name}: ${new Intl.NumberFormat('fr-FR').format(n)} FCFA/jour`); fetchAdminOverview(); })
                                .catch(e => addToast('error', 'Erreur', e.message));
                            }}
                          >
                            {new Intl.NumberFormat('fr-FR', {notation:'compact'}).format(ag.daily_limit || 2000000)} ✎
                          </button>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                            background: ag.active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: ag.active ? 'var(--accent-green)' : 'var(--accent-red)',
                          }}>
                            {ag.active ? '● Actif' : '● Suspendu'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <button
                            className="btn-primary"
                            style={{ fontSize: '12px', padding: '5px 12px', background: '#10b981', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              setRechargeModal({ agentId: ag.id, agentName: ag.name, currentBalance: ag.balance });
                              setRechargeAmount(''); setRechargeNote(''); setRechargeMsg('');
                            }}
                          >
                            + Recharger
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Invoices section */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span><Banknote size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Facturation mensuelle</span>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {genInvoiceMsg && (
                <span style={{ fontSize: '13px', color: genInvoiceMsg.startsWith('✅') ? 'var(--accent-green)' : genInvoiceMsg.includes('cours') ? 'var(--text-muted)' : 'var(--accent-red)' }}>
                  {genInvoiceMsg}
                </span>
              )}
              <button className="btn-primary" style={{ fontSize: '12px', padding: '6px 16px' }} onClick={generateInvoices}>
                Générer factures du mois
              </button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {invoicesLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Chargement...
              </div>
            ) : invoicesList.length === 0 ? (
              <p style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>
                Aucune facture. Cliquez sur "Générer factures du mois" pour créer les abonnements mensuels (10 000 FCFA / agent).
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-hover)' }}>
                      {['Agent', 'Période', 'Montant', 'Statut', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Agent' ? 'left' : 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesList.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{inv.agent_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{inv.email}</div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>{inv.period}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(inv.amount)} FCFA</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                            background: inv.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                            color: inv.status === 'paid' ? 'var(--accent-green)' : 'var(--accent-yellow)',
                          }}>
                            {inv.status === 'paid' ? '✓ Payée' : '⏳ En attente'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {inv.status !== 'paid' ? (
                            <button className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => payInvoice(inv.id)}>
                              Marquer payée
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-FR') : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Commission configuration — admin seulement */}
        {authAgent?.role === 'admin' && <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <Target size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Taux de commission par opération
            <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
              — affiché aux agents pendant la confirmation
            </span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Ces taux guident l'agent sur la commission à collecter en plus du montant envoyé au client.
              Ex : transfert 10 000 FCFA à 2% → l'agent collecte 10 200 FCFA du client.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {[
                { type: 'transfer', label: 'Transfert',   icon: <ArrowUpRight size={16}/>,    color: '#6366f1' },
                { type: 'withdraw', label: 'Retrait',     icon: <ArrowDownToLine size={16}/>, color: '#10b981' },
                { type: 'airtime',  label: 'Crédit tél.', icon: <PhoneCall size={16}/>,       color: '#f59e0b' },
                { type: 'internet', label: 'Internet',    icon: <Wifi size={16}/>,            color: '#3b82f6' },
              ].map(({ type, label, icon, color }) => (
                <div key={type} style={{
                  padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)', display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {icon}
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-dark)' }}>{label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '18px', fontWeight: 800, color }}>{commissions[type]}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0" max="20" step="0.5"
                      value={localRates[type] ?? 2}
                      onChange={e => setLocalRates(prev => ({ ...prev, [type]: parseFloat(e.target.value) || 0 }))}
                      style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}
                    />
                    <button
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px', background: color, opacity: commissionSaving[type] ? 0.6 : 1 }}
                      disabled={!!commissionSaving[type]}
                      onClick={() => saveCommission(type, localRates[type] ?? 2)}
                    >
                      {commissionSaving[type] ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Enregistrer'}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Sur 10 000 FCFA → collectez <strong>{Math.round(10000 * ((localRates[type] ?? 2) / 100 + 1)).toLocaleString('fr-FR')} FCFA</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>}

        {/* Monitoring Système */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span><Radio size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Monitoring &amp; Tests</span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ fontSize: '12px', padding: '6px 14px', background: '#6366f1' }}
                onClick={async () => {
                  try {
                    const res = await apiFetch('/webhooks/last');
                    const data = await res.json();
                    setWebhookDebug(data);
                  } catch (e) { setWebhookDebug({ error: e.message }); }
                }}>
                Voir dernier webhook
              </button>
              <button className="btn-primary" style={{ fontSize: '12px', padding: '6px 14px', background: '#10b981' }}
                onClick={async () => {
                  try {
                    const res = await apiFetch('/health');
                    const data = await res.json();
                    setWebhookDebug(data);
                  } catch (e) { setWebhookDebug({ error: e.message }); }
                }}>
                Santé du serveur
              </button>
              <button className="export-btn" style={{ fontSize: '12px' }}
                onClick={() => setWebhookDebug(null)}>
                Effacer
              </button>
            </div>
          </div>
          {webhookDebug && (
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {/* GeniusPay status card */}
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: gpStatus.connected ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${gpStatus.connected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>GENIUSPAY</div>
                  <div style={{ fontWeight: 700, color: gpStatus.connected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {gpStatus.connected ? '✅ Connecté' : '❌ Hors ligne'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Mode : {gpStatus.mode === 'live' ? '🔴 Live' : '🧪 Sandbox'}
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-hover)', borderRadius: '10px', padding: '14px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)', maxHeight: '320px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(webhookDebug, null, 2)}
              </div>
            </div>
          )}
          {!webhookDebug && (
            <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Cliquez "Voir dernier webhook" après un test GeniusPay pour voir la structure exacte reçue.
              Utilisez le bouton ▶ dans GeniusPay → Paramètres → Webhooks pour envoyer un test.
            </div>
          )}
        </div>

        {/* Recharge Modal */}
        {rechargeModal && (
          <div className="modal-overlay">
            <div className="confirm-modal" style={{ '--confirm-color': '#10b981' }}>
              <div className="confirm-modal-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                <Banknote size={22} />
              </div>
              <h3>Recharger l'agent</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                {rechargeModal.agentName} — Solde actuel : {fmt(rechargeModal.currentBalance)} FCFA
              </p>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Montant à créditer (FCFA)</label>
                <input
                  type="number" placeholder="Ex: 50 000" min="100"
                  value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)}
                  style={{ textAlign: 'right' }} autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Note (optionnel)</label>
                <input
                  type="text" placeholder="Virement, dépôt cash, etc."
                  value={rechargeNote} onChange={e => setRechargeNote(e.target.value)}
                />
              </div>
              {rechargeMsg && (
                <p style={{ fontSize: '13px', marginBottom: '12px', color: rechargeMsg.startsWith('✅') ? 'var(--accent-green)' : rechargeMsg.includes('cours') ? 'var(--text-muted)' : 'var(--accent-red)' }}>
                  {rechargeMsg}
                </p>
              )}
              <div className="confirm-actions">
                <button className="btn-secondary" onClick={() => { setRechargeModal(null); setRechargeMsg(''); }}>Annuler</button>
                <button className="btn-primary" style={{ background: '#10b981' }} onClick={rechargeAgent}>
                  Confirmer la recharge
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Auth gate
  if (!authChecked) return null;
  if (!authAgent) return <LoginScreen onLogin={agent => setAuthAgent(agent)} />;

  return (
    <div className="app-container">
      {isLoading ? (
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-logo">
              <div className="logo-icon loading-pulse">
                <Zap size={32} color="white" fill="white" />
              </div>
              <h1>Cabine 2.0</h1>
              <p>Initialisation du système...</p>
            </div>
            <div className="loading-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Header */}
          <div className="mobile-header">
            <div className="logo-area">
              <div className="logo-icon">
                <Zap size={20} color="white" fill="white" />
              </div>
              <span>Cabine 2.0</span>
            </div>
            <button className="menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu size={24} color="white" />
            </button>
          </div>

          {/* Floating hamburger — desktop only, visible when sidebar is collapsed */}
          {sidebarCollapsed && (
            <button className="sidebar-float-btn" onClick={toggleSidebar} title="Ouvrir la navigation">
              <Menu size={18}/>
            </button>
          )}

          {/* Sidebar */}
          <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-top">
              <button
                className="sidebar-toggle-btn"
                onClick={toggleSidebar}
                title={sidebarCollapsed ? 'Déplier' : 'Réduire'}
              >
                <Menu size={18}/>
              </button>
              {!sidebarCollapsed && (
                <div className="logo-area desktop-logo">
                  <div className="logo-icon">
                    <Zap size={22} color="white" fill="white" />
                  </div>
                  <span>Cabine 2.0</span>
                </div>
              )}
            </div>

            <nav className="nav-menu">
              {[
                { id: 'dashboard',    icon: <LayoutDashboard size={20}/>, label: 'Tableau de bord' },
                { id: 'transactions', icon: <History size={20}/>,         label: 'Transactions' },
                { id: 'analytics',    icon: <BarChart2 size={20}/>,       label: 'Analytiques' },
                ...(authAgent?.role === 'admin' ? [{ id: 'admin', icon: <ShieldCheck size={20}/>, label: 'Supervision' }] : []),
                { id: 'settings',     icon: <Settings size={20}/>,        label: 'Paramètres' },
              ].map(item => (
                <div
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>
              ))}
            </nav>

            <div className={`agent-card ${sidebarCollapsed ? 'agent-card--mini' : ''}`}>
              <div className="avatar" title={sidebarCollapsed ? agentName : ''}>{avatarInitials}</div>
              {!sidebarCollapsed && (
                <>
                  <div className="agent-info">
                    <h4>{agentName}</h4>
                    <p>Agent Principal</p>
                  </div>
                  <div style={{display:'flex',gap:'8px',marginLeft:'auto'}}>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      style={{padding:'4px',background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',borderRadius:'4px'}}
                      title={darkMode ? 'Mode clair' : 'Mode sombre'}
                    >
                      {darkMode ? '☀️' : '🌙'}
                    </button>
                    <LogOut size={18} color="#ef4444" style={{cursor:'pointer'}} onClick={handleLogout} title="Déconnexion"/>
                  </div>
                </>
              )}
              {sidebarCollapsed && (
                <div style={{display:'flex',flexDirection:'column',gap:'8px',alignItems:'center',width:'100%'}}>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    style={{padding:'4px',background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',borderRadius:'4px'}}
                    title={darkMode ? 'Mode clair' : 'Mode sombre'}
                  >
                    {darkMode ? '☀️' : '🌙'}
                  </button>
                  <LogOut size={18} color="#ef4444" style={{cursor:'pointer'}} onClick={handleLogout} title="Déconnexion"/>
                </div>
              )}
            </div>
          </aside>

          {/* Connecting banner — soft yellow, shown 2-7 failures */}
          {!isOffline && !isLoading && offlineCount.current >= 2 && (
            <div className="connecting-banner">
              <RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Connexion au serveur en cours...
            </div>
          )}

          {/* Offline Banner — hard red, shown after 8 failures (16s+) */}
          {isOffline && (
            <div className="offline-banner">
              <AlertTriangle size={16} /> Serveur inaccessible — vérifiez votre réseau ou réessayez dans quelques secondes
            </div>
          )}

          {/* Main Content */}
          <main className="main-content" onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'transactions' && renderTransactions()}
            {activeTab === 'analytics' && renderAnalytics()}
            {activeTab === 'admin' && renderAdmin()}
            {activeTab === 'settings' && renderSettings()}
          </main>

          {/* --- CONFIRMATION MODAL --- */}
          {showConfirmModal && (() => {
            const cfg = OP_CONFIG[activeOperation];
            const displayAmount = activeOperation === 'internet'
              ? selectedBundle?.price
              : parseInt(amount, 10);
            return (
              <div className="modal-overlay">
                <div className="confirm-modal" style={{'--confirm-color': cfg.color}}>
                  <div className="confirm-modal-icon" style={{background: `${cfg.color}18`, color: cfg.color}}>
                    {activeOperation === 'transfer' && <ArrowUpRight size={22}/>}
                    {activeOperation === 'withdraw' && <ArrowDownToLine size={22}/>}
                    {activeOperation === 'airtime'  && <PhoneCall size={22}/>}
                    {activeOperation === 'internet' && <Wifi size={22}/>}
                  </div>
                  <h3>{cfg.confirmTitle}</h3>
                  <div className="confirm-summary">
                    <div className="confirm-row">
                      <span>Opérateur</span>
                      <span className="confirm-value">
                        <img src={OPERATOR_LOGOS[selectedProvider]} alt="" style={{width:22,height:22,borderRadius:6,verticalAlign:'middle',marginRight:6}}/>
                        {OPERATOR_NAMES[selectedProvider]}
                      </span>
                    </div>
                    <div className="confirm-row">
                      <span>{cfg.confirmPhoneLabel}</span>
                      <span className="confirm-value">{phone}</span>
                    </div>
                    {activeOperation === 'internet' && selectedBundle && (
                      <div className="confirm-row">
                        <span>Forfait</span>
                        <span className="confirm-value" style={{color: cfg.color}}>
                          {selectedBundle.label} — {selectedBundle.validity}
                        </span>
                      </div>
                    )}
                    <div className="confirm-row confirm-total">
                      <span>{cfg.confirmAmountLabel}</span>
                      <span className="confirm-value" style={{color: cfg.color}}>
                        {activeOperation === 'withdraw' ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(displayAmount)} FCFA
                      </span>
                    </div>
                    {activeOperation !== 'withdraw' && (
                      <div className="confirm-row" style={{opacity: 0.7, fontSize: '12px'}}>
                        <span>Solde après opération</span>
                        <span className="confirm-value" style={{color: balance - displayAmount < 0 ? 'var(--accent-red)' : 'var(--text-muted)'}}>
                          {new Intl.NumberFormat('fr-FR').format(balance - displayAmount)} FCFA
                        </span>
                      </div>
                    )}
                    {(() => {
                      const rate = commissions[activeOperation] ?? 2;
                      const commissionAmt = Math.round(displayAmount * rate / 100);
                      const geniusFee = activeOperation !== 'withdraw' ? Math.round(displayAmount * 0.01) : 0;
                      const netProfit = commissionAmt - geniusFee;
                      return (
                        <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px dashed rgba(16,185,129,0.3)' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Votre gain estimé
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            <span>Commission à collecter ({rate}%)</span>
                            <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>+{new Intl.NumberFormat('fr-FR').format(commissionAmt)} FCFA</span>
                          </div>
                          {geniusFee > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                              <span>Frais GeniusPay (1%)</span>
                              <span style={{ color: 'var(--accent-red)' }}>−{new Intl.NumberFormat('fr-FR').format(geniusFee)} FCFA</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, borderTop: '1px solid rgba(16,185,129,0.2)', paddingTop: '6px', marginTop: '4px' }}>
                            <span style={{ color: 'var(--text-dark)' }}>Bénéfice net</span>
                            <span style={{ color: netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {netProfit >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(netProfit)} FCFA
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Collectez <strong>{new Intl.NumberFormat('fr-FR').format(displayAmount + commissionAmt)} FCFA</strong> du client
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="confirm-actions">
                    <button className="btn-secondary" onClick={() => setShowConfirmModal(false)}>
                      Annuler
                    </button>
                    <button
                      className="btn-confirm-op"
                      style={{background: cfg.color, boxShadow: `0 4px 14px ${cfg.glowColor}`}}
                      onClick={confirmAndShowPin}
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* --- PIN MODAL --- */}
          {showPinModal && (
            <div className="modal-overlay">
              <div className="pin-modal">
                <h3>Code PIN de sécurité</h3>
                <p>Entrez votre code PIN à 4 chiffres</p>

                <div className="pin-display">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`pin-dot ${pinCode.length > i ? 'filled' : ''}`}></div>
                  ))}
                </div>

                <div className="keypad">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} className="key-btn" onClick={() => handlePinKeyPress(num.toString())}>
                      {num}
                    </button>
                  ))}
                  <button className="key-btn cancel" onClick={() => setShowPinModal(false)}>
                    Annuler
                  </button>
                  <button className="key-btn" onClick={() => handlePinKeyPress('0')}>
                    0
                  </button>
                  <button className="key-btn delete" onClick={handlePinDelete}>
                    <Delete size={24} />
                  </button>
                </div>

                {isProcessing && (
                  <div style={{marginTop: '20px', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
                    <RefreshCw size={16} style={{animation: 'spin 1s linear infinite'}}/>
                    <span>Vérification...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {receiptData && (
            <div className="modal-overlay" style={{zIndex: 200}}>
              <div className="receipt-modal">
                <div className="receipt-paper" ref={receiptRef}>
                  <div className="receipt-header">
                    <div className="receipt-brand">
                      <Zap size={18} fill="#6366f1" color="#6366f1" />
                      <span style={{fontWeight: 800, color: '#111827', fontSize: '16px'}}>CABINE 2.0</span>
                    </div>
                    <h2>REÇU DE TRANSACTION</h2>
                    <p>{agentName} • Abidjan</p>
                  </div>

                  <hr className="receipt-divider" />

                  <div className="receipt-row">
                    <span>Date</span>
                    <span>{new Date(receiptData.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Référence</span>
                    <span style={{fontWeight: 600}}>TX-{receiptData.id.toString().padStart(6, '0')}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Opérateur</span>
                    <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <img src={OPERATOR_LOGOS[receiptData.provider]} alt="" style={{width: '18px', height: '18px', borderRadius: '4px'}} />
                      {OPERATOR_NAMES[receiptData.provider] || receiptData.provider}
                    </span>
                  </div>
                  <div className="receipt-row">
                    <span>{receiptData.type === 'AIRTIME' ? 'Numéro rechargé' : receiptData.type === 'INTERNET' ? 'Numéro connecté' : 'Destinataire'}</span>
                    <span style={{fontWeight: 600}}>{receiptData.phone}</span>
                  </div>
                  {receiptData.geniuspay_ref && (
                    <div className="receipt-row">
                      <span>Réf. paiement</span>
                      <span style={{fontSize: '11px', fontWeight: 500}}>{receiptData.geniuspay_ref}</span>
                    </div>
                  )}

                  <div className="receipt-total">
                    <span>
                      {receiptData.type === 'RETRAIT' ? 'Montant encaissé' :
                       receiptData.type === 'AIRTIME'  ? 'Crédit envoyé' :
                       receiptData.type === 'INTERNET' ? 'Forfait activé' : 'Montant envoyé'}
                    </span>
                    <h2 style={{color:
                      receiptData.type === 'RETRAIT'  ? '#10b981' :
                      receiptData.type === 'AIRTIME'  ? '#f59e0b' :
                      receiptData.type === 'INTERNET' ? '#3b82f6' : '#111827'}}>
                      {receiptData.type === 'RETRAIT' ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(receiptData.amount)} FCFA
                    </h2>
                    <div className="receipt-status">
                      <CheckCircle2 size={14} />
                      {receiptData.type === 'RETRAIT'  ? 'Retrait réussi' :
                       receiptData.type === 'AIRTIME'  ? 'Recharge réussie' :
                       receiptData.type === 'INTERNET' ? 'Forfait activé' : 'Transaction réussie'}
                    </div>
                  </div>

                  <hr className="receipt-divider" />
                  <div className="receipt-footer">
                    <p>Cabine 2.0 — Transfert Inter-Réseaux</p>
                    <p style={{marginTop: '2px'}}>Merci de votre confiance !</p>
                  </div>
                </div>

                <div className="receipt-actions">
                  <button className="btn-secondary" onClick={() => setReceiptData(null)}>
                    Fermer
                  </button>
                  <button className="btn-primary" onClick={printReceipt}>
                    <Printer size={16} /> Imprimer
                  </button>
                  <button className="btn-secondary" onClick={downloadReceipt} style={{color: 'var(--accent-primary)'}}>
                    <Download size={16} /> Télécharger
                  </button>
                  <button className="btn-secondary" onClick={shareReceipt} style={{color: 'var(--accent-blue)'}}>
                    <Share2 size={16} /> Partager
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast Notifications */}
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />

          {/* Bottom Navigation — mobile only */}
          <nav className="bottom-nav">
            <button
              className={`bottom-nav-item${activeTab === 'dashboard' ? ' active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <div className="bnav-icon"><LayoutDashboard size={20} /></div>
              <span>Accueil</span>
            </button>
            <button
              className={`bottom-nav-item${activeTab === 'transactions' ? ' active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              <div className="bnav-icon" style={{position:'relative'}}>
                <History size={20} />
                {txBadge > 0 && (
                  <span style={{position:'absolute',top:-4,right:-4,background:'#ef4444',color:'white',fontSize:'10px',fontWeight:800,borderRadius:'999px',minWidth:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px',lineHeight:1}}>
                    {txBadge > 9 ? '9+' : txBadge}
                  </span>
                )}
              </div>
              <span>Historique</span>
            </button>
            <button
              className="bottom-nav-item bnav-cta"
              onClick={() => { setActiveTab('dashboard'); setActiveOperation('transfer'); }}
            >
              <div className="bnav-icon"><Zap size={22} /></div>
              <span>Action</span>
            </button>
            <button
              className={`bottom-nav-item${activeTab === 'analytics' ? ' active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <div className="bnav-icon"><BarChart2 size={20} /></div>
              <span>Stats</span>
            </button>
            {authAgent?.role === 'admin' && (
              <button
                className={`bottom-nav-item${activeTab === 'admin' ? ' active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <div className="bnav-icon"><ShieldCheck size={20} /></div>
                <span>Admin</span>
              </button>
            )}
            <button
              className={`bottom-nav-item${activeTab === 'settings' ? ' active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <div className="bnav-icon"><Settings size={20} /></div>
              <span>Réglages</span>
            </button>
          </nav>

          {/* Kiosk exit button — visible only in kiosk mode */}
          {isKiosk && (
            <button
              className="kiosk-exit-btn"
              onClick={() => setShowKioskExit(true)}
              title="Quitter le mode kiosque"
            >
              <ShieldCheck size={18} />
            </button>
          )}

          {/* Kiosk exit PIN modal */}
          {showKioskExit && (
            <div className="modal-overlay" style={{zIndex: 9999}}>
              <div className="confirm-modal" style={{'--confirm-color': '#ef4444'}}>
                <div className="confirm-header">
                  <ShieldCheck size={22} />
                  <h3>Mode administrateur</h3>
                </div>
                <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px'}}>
                  Entrez le PIN administrateur pour quitter le mode kiosque.
                </p>
                <input
                  type="password"
                  maxLength="6"
                  placeholder="PIN admin"
                  value={kioskPinInput}
                  onChange={e => { setKioskPinInput(e.target.value); setKioskPinError(''); }}
                  style={{marginBottom: '8px'}}
                  autoFocus
                />
                {kioskPinError && (
                  <p style={{color: 'var(--accent-red)', fontSize: '13px', marginBottom: '12px'}}>
                    {kioskPinError}
                  </p>
                )}
                <div className="confirm-actions">
                  <button className="btn-secondary" onClick={() => { setShowKioskExit(false); setKioskPinInput(''); setKioskPinError(''); }}>
                    Annuler
                  </button>
                  <button
                    className="btn-primary"
                    style={{background: '#ef4444'}}
                    onClick={async () => {
                      const ok = await KioskService.disable(kioskPinInput);
                      if (ok) {
                        setShowKioskExit(false);
                        setKioskPinInput('');
                        setKioskPinError('');
                        addToast('success', 'Mode kiosque désactivé', 'Accès administrateur accordé.');
                      } else {
                        setKioskPinError('PIN incorrect. Réessayez.');
                      }
                    }}
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          )}

          <style dangerouslySetInnerHTML={{__html: `
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}} />
        </>
      )}

    </div>
  );
}

export default App;
