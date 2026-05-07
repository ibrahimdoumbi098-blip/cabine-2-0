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

function App() {
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

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_URL}/analytics`);
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
      const walletRes = await fetch(`${API_URL}/wallet`);
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

      const txRes = await fetch(`${API_URL}/transactions?${queryParams.toString()}`);
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
    if (activeTab === 'analytics') fetchAnalytics();
  }, [activeTab]);

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
    const shouldPoll = activeTab === 'dashboard' || activeTab === 'transactions';
    const interval = shouldPoll ? setInterval(fetchData, 3000) : null;
    const gpInterval = setInterval(fetchGpStatus, 20000);
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

      const response = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${API_URL}/wallet/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
            <span className={`status-pill gp-${gpMode}`}>
              <span className="status-dot"/>
              GeniusPay {gpLabel}
            </span>
            {gpStatus.walletId && (
              <span className="status-pill account">
                <Layers size={10}/> {gpStatus.walletId}
              </span>
            )}
            <span className="status-pill account">
              <Zap size={10}/> CAB-{String(balance).slice(-4).padStart(4,'0')}
            </span>
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
                    {[200, 500, 1000, 2000, 5000].map(v => (
                      <button key={v} type="button" className="quick-amount-btn"
                        onClick={() => { setAmount(String(v)); setSelectedBundle(null); }}>
                        {new Intl.NumberFormat('fr-FR').format(v)}
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
           <div className="card-header">
            Profil de l'agent
          </div>
          <div className="card-body">
             <div className="profile-info-row">
               <span>Nom :</span> <strong>{agentName}</strong>
             </div>
             <div className="profile-info-row" style={{marginTop: '10px'}}>
               <span>Email :</span> <strong>ibrahim.doumbi098@gmail.com</strong>
             </div>
             <div className="profile-info-row" style={{marginTop: '10px'}}>
               <span>Identifiant Agence :</span> <strong>ABJ-001</strong>
             </div>
             <div className="profile-info-row" style={{marginTop: '10px'}}>
               <span>Localisation :</span> <strong>Abidjan, Côte d'Ivoire</strong>
             </div>
          </div>
        </div>

        <div className="card settings-panel" style={{gridColumn: '1 / -1'}}>
          <div className="card-header">
            <Radio size={18} style={{marginRight: '8px', verticalAlign: 'middle'}}/>
            Statut GeniusPay
          </div>
          <div className="card-body" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px'}}>
            <div className="profile-info-row" style={{flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px'}}>
              <span>Connexion</span>
              <strong style={{color: gpStatus.connected ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '18px', marginTop: '8px'}}>
                {gpStatus.connected ? '✅' : '❌'}
              </strong>
            </div>
            <div className="profile-info-row" style={{flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px'}}>
              <span>Mode</span>
              <strong style={{fontSize: '14px', marginTop: '8px'}}>
                {gpStatus.mode === 'sandbox' ? '🧪 Sandbox' : '🔴 Live'}
              </strong>
            </div>
            <div className="profile-info-row" style={{flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px'}}>
              <span>Clés API</span>
              <strong style={{color: gpStatus.hasKeys ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '18px', marginTop: '8px'}}>
                {gpStatus.hasKeys ? '✅' : '❌'}
              </strong>
            </div>
            <div className="profile-info-row" style={{flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px'}}>
              <span>Wallet</span>
              <strong style={{fontSize: '12px', marginTop: '8px'}}>
                {gpStatus.walletId || 'Auto'}
              </strong>
            </div>
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
                    <LogOut size={18} color="#ef4444" style={{cursor:'pointer'}}/>
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
                  <LogOut size={18} color="#ef4444" style={{cursor:'pointer'}} title="Déconnexion"/>
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
              <div className="bnav-icon"><History size={20} /></div>
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
