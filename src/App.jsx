import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Send, 
  Download, 
  PhoneCall, 
  History, 
  Settings, 
  LogOut,
  Smartphone,
  Wifi,
  Zap,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Menu,
  Delete,
  Printer,
  Share2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import './App.css';

const API_URL = '/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProvider, setSelectedProvider] = useState('orange');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [agentName, setAgentName] = useState('Chargement...');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Security States
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState('');

  // Receipt States
  const [receiptData, setReceiptData] = useState(null);
  const pendingTxRef = useRef(null);
  const receiptRef = useRef(null);

  const fetchData = async () => {
    try {
      const walletRes = await fetch(`${API_URL}/wallet`);
      const walletData = await walletRes.json();
      setBalance(walletData.balance);
      setAgentName(walletData.agent_name);

      const txRes = await fetch(`${API_URL}/transactions`);
      const txData = await txRes.json();
      setTransactions(txData);

      // Check if a pending transaction has resolved
      if (pendingTxRef.current) {
        const tx = txData.find(t => t.id === pendingTxRef.current);
        if (tx) {
          if (tx.status === 'SUCCESS') {
            setReceiptData(tx); // Trigger receipt modal
            pendingTxRef.current = null;
          } else if (tx.status === 'FAILED') {
            alert(`La transaction de ${tx.amount} F vers ${tx.phone} a échoué. Le solde a été recrédité.`);
            pendingTxRef.current = null;
          }
        }
      }

    } catch (error) {
      console.error("Erreur de connexion au backend", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const initiateTransfer = (e) => {
    e.preventDefault();
    if (!amount || !phone) return;
    setPinCode('');
    setShowPinModal(true);
  };

  const handlePinKeyPress = (digit) => {
    if (pinCode.length < 4) {
      const newPin = pinCode + digit;
      setPinCode(newPin);
      
      if (newPin.length === 4) {
        executeTransfer(newPin);
      }
    }
  };

  const handlePinDelete = () => {
    setPinCode(pinCode.slice(0, -1));
  };

  const executeTransfer = async (enteredPin) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_URL}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          phone: phone,
          amount: amount,
          pin: enteredPin
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        pendingTxRef.current = result.txId; // Track this transaction
        setAmount('');
        setPhone('');
        setShowPinModal(false);
        fetchData(); 
        
        if(window.innerWidth < 768) {
           window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
      } else {
        alert("Erreur: " + result.error);
        setPinCode(''); 
      }
    } catch (error) {
      alert("Erreur de connexion au serveur.");
      setPinCode('');
    } finally {
      setIsProcessing(false);
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

  const getProviderIcon = (provider) => {
    switch(provider) {
      case 'orange': return <Zap size={18} />;
      case 'wave': return <Zap size={18} />;
      case 'mtn': return <Download size={18} />;
      case 'moov': return <Wifi size={18} />;
      default: return <Smartphone size={18} />;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'SUCCESS':
        return <div className="tx-status success"><CheckCircle2 size={10} style={{marginRight: '4px', verticalAlign: 'middle'}}/> Succès</div>;
      case 'PENDING':
        return <div className="tx-status pending"><Clock size={10} style={{marginRight: '4px', verticalAlign: 'middle'}}/> En cours</div>;
      case 'FAILED':
        return <div className="tx-status" style={{background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)'}}><XCircle size={10} style={{marginRight: '4px', verticalAlign: 'middle'}}/> Échec (Remboursé)</div>;
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
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

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="logo-area desktop-logo">
          <div className="logo-icon">
            <Zap size={24} color="white" fill="white" />
          </div>
          <span>Cabine 2.0</span>
        </div>

        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}>
            <LayoutDashboard size={20} />
            <span>Tableau de bord</span>
          </div>
          <div className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }}>
            <History size={20} />
            <span>Historique (Ledger)</span>
          </div>
          <div className="nav-item" onClick={() => setMobileMenuOpen(false)}>
            <Settings size={20} />
            <span>Paramètres</span>
          </div>
        </nav>

        <div className="agent-card">
          <div className="avatar">KB</div>
          <div className="agent-info">
            <h4>{agentName}</h4>
            <p>Agent Principal - Cocody</p>
          </div>
          <LogOut size={18} color="#ef4444" style={{marginLeft: 'auto', cursor: 'pointer'}} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}>
        <div className="dashboard-header animate-slide-up">
          <div className="header-title">
            <h1>Bonjour, {agentName.split(' ')[0]} 👋</h1>
            <p>Prêt à traiter les transactions d'aujourd'hui ?</p>
          </div>
          <div className="master-balance glass-panel">
            <div className="label">Solde Flotte Global</div>
            <div className="amount">
              {new Intl.NumberFormat('fr-FR').format(balance)} 
              <span className="currency-label">XOF</span>
            </div>
          </div>
        </div>

        <div className="action-grid animate-slide-up" style={{animationDelay: '0.1s'}}>
          <div className="action-card glass-panel transfer">
            <div className="action-icon"><Send size={24} /></div>
            <span>Transfert</span>
          </div>
          <div className="action-card glass-panel withdraw">
            <div className="action-icon"><Download size={24} /></div>
            <span>Retrait</span>
          </div>
          <div className="action-card glass-panel airtime">
            <div className="action-icon"><PhoneCall size={24} /></div>
            <span>Crédit</span>
          </div>
          <div className="action-card glass-panel deposit">
            <div className="action-icon"><Wifi size={24} /></div>
            <span>Internet</span>
          </div>
        </div>

        <div className="working-area animate-slide-up" style={{animationDelay: '0.2s'}}>
          {/* Operation Panel */}
          <div className="glass-panel operation-panel">
            <div className="panel-header">
              Nouvelle Opération Inter-Réseaux
            </div>
            <div className="panel-body">
              <form onSubmit={initiateTransfer}>
                <div className="form-group">
                  <label>Réseau de destination</label>
                  <div className="provider-select">
                    <div 
                      className={`provider-btn orange ${selectedProvider === 'orange' ? 'selected' : ''}`}
                      onClick={() => setSelectedProvider('orange')}
                    >
                      <Smartphone size={18} /> Orange
                    </div>
                    <div 
                      className={`provider-btn mtn ${selectedProvider === 'mtn' ? 'selected' : ''}`}
                      onClick={() => setSelectedProvider('mtn')}
                    >
                      <Smartphone size={18} /> MTN
                    </div>
                    <div 
                      className={`provider-btn wave ${selectedProvider === 'wave' ? 'selected' : ''}`}
                      onClick={() => setSelectedProvider('wave')}
                    >
                      <Smartphone size={18} /> Wave
                    </div>
                    <div 
                      className={`provider-btn moov ${selectedProvider === 'moov' ? 'selected' : ''}`}
                      onClick={() => setSelectedProvider('moov')}
                    >
                      <Smartphone size={18} /> Moov
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Numéro du client</label>
                  <input 
                    type="tel" 
                    className="phone-input" 
                    placeholder="Ex: 07 00 00 00 00" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Montant à transférer</label>
                  <div className="amount-input">
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      min="100"
                    />
                    <span className="currency">XOF</span>
                  </div>
                </div>

                <button type="submit" className="submit-btn" disabled={isProcessing || pendingTxRef.current}>
                  {pendingTxRef.current ? <RefreshCw className="spinner" size={20} style={{animation: 'spin 1s linear infinite'}}/> : 'Valider la transaction'}
                </button>
              </form>
            </div>
          </div>

          {/* Ledger / Recent Activity Panel */}
          <div className="glass-panel ledger-panel">
            <div className="panel-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              Historique en direct
              <span style={{fontSize: '12px', color: 'var(--accent-primary)', cursor: 'pointer'}} onClick={fetchData}><RefreshCw size={14}/></span>
            </div>
            <div className="panel-body tx-body">
              <div className="tx-list">
                
                {transactions.length === 0 ? (
                  <p style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px'}}>Aucune transaction</p>
                ) : (
                  transactions.map(tx => (
                    <div className="tx-item" key={tx.id}>
                      <div className="tx-info">
                        <div className={`tx-icon ${tx.provider}`}>
                          {getProviderIcon(tx.provider)}
                        </div>
                        <div className="tx-details">
                          <p style={{textTransform: 'capitalize'}}>{tx.type} {tx.provider}</p>
                          <span>{tx.phone}</span>
                        </div>
                      </div>
                      <div className={`tx-amount ${tx.status === 'SUCCESS' ? 'debit' : ''}`}>
                        <p style={{fontWeight: '600', textDecoration: tx.status === 'FAILED' ? 'line-through' : 'none', color: tx.status === 'FAILED' ? 'var(--text-muted)' : 'white'}}>
                          - {new Intl.NumberFormat('fr-FR').format(tx.amount)} F
                        </p>
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>
                  ))
                )}

              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- PIN MODAL OVERLAY --- */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="pin-modal">
            <h3>Saisissez votre code PIN</h3>
            <p>Pour valider l'envoi de {new Intl.NumberFormat('fr-FR').format(amount)} F</p>
            
            <div className="pin-dots">
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

      {/* --- RECEIPT MODAL OVERLAY --- */}
      {receiptData && (
        <div className="modal-overlay" style={{zIndex: 200}}>
          <div className="receipt-modal">
            
            {/* The actual receipt element to be screenshotted */}
            <div className="receipt-paper" ref={receiptRef}>
              <div className="receipt-header">
                <div className="receipt-logo"><Zap size={24} fill="currentColor" /></div>
                <h2>CABINE 2.0</h2>
                <p>Agence de {agentName}</p>
                <p>Reçu de Transaction</p>
              </div>
              
              <div className="receipt-divider"></div>
              
              <div className="receipt-row">
                <span>Date:</span>
                <span>{new Date(receiptData.created_at).toLocaleString('fr-FR')}</span>
              </div>
              <div className="receipt-row">
                <span>ID Trans:</span>
                <span>TX-{receiptData.id.toString().padStart(6, '0')}</span>
              </div>
              <div className="receipt-row">
                <span>Opérateur:</span>
                <span style={{textTransform: 'capitalize'}}>{receiptData.provider}</span>
              </div>
              <div className="receipt-row">
                <span>Numéro:</span>
                <span style={{fontWeight: 'bold'}}>{receiptData.phone}</span>
              </div>
              
              <div className="receipt-divider"></div>
              
              <div className="receipt-total">
                <span>Montant Envoyé</span>
                <h2>{new Intl.NumberFormat('fr-FR').format(receiptData.amount)} FCFA</h2>
              </div>
              
              <div className="receipt-divider"></div>
              <div className="receipt-footer">
                <p>Statut : <span style={{color: '#22c55e', fontWeight: 'bold'}}>RÉUSSI</span></p>
                <p>Merci de votre confiance !</p>
              </div>
            </div>

            <div className="receipt-actions">
              <button className="btn-secondary" onClick={() => setReceiptData(null)}>
                Fermer
              </button>
              <button className="btn-primary" onClick={downloadReceipt}>
                <Download size={18} /> Télécharger l'image
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}

export default App;
