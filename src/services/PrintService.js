/**
 * PrintService — Cabine 2.0
 * Détecte l'environnement et utilise la méthode d'impression appropriée.
 *
 * Priorité:
 *  1. Terminal Sunmi (via plugin Capacitor natif SunmiPrinter)
 *  2. Capacitor Android générique (share intent)
 *  3. Browser / PWA (window.print() avec CSS dédié)
 */

const isSunmi = () =>
  typeof window !== 'undefined' &&
  (navigator.userAgent.includes('Sunmi') ||
   window.SunmiPrinterPlugin !== undefined ||
   localStorage.getItem('terminal_type') === 'sunmi');

const isCapacitor = () =>
  typeof window !== 'undefined' &&
  window.Capacitor?.isNativePlatform?.() === true;

// ─── Génère le HTML du reçu pour l'impression ───────────────────────────────
function buildReceiptHtml(tx, agentName, balance) {
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);
  const date = tx.created_at
    ? new Date(tx.created_at).toLocaleString('fr-FR')
    : new Date().toLocaleString('fr-FR');

  const typeLabels = {
    TRANSFER: 'Transfert',
    RETRAIT:  'Retrait',
    AIRTIME:  'Crédit téléphone',
    INTERNET: 'Forfait internet',
  };

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  @page { margin: 0; size: 58mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    width: 58mm;
    padding: 4mm;
    color: #000;
  }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .large  { font-size: 15px; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .row    { display: flex; justify-content: space-between; margin: 2px 0; }
  .logo   { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
  .ref    { font-size: 9px; color: #555; word-break: break-all; }
  .status-ok   { color: #000; font-weight: bold; }
  .footer { font-size: 9px; text-align: center; margin-top: 6px; }
</style>
</head>
<body>
  <div class="center">
    <div class="logo">CABINE 2.0</div>
    <div style="font-size:9px">Agent Mobile Money — Côte d'Ivoire</div>
  </div>
  <div class="divider"></div>
  <div class="center bold large">${typeLabels[tx.type] || tx.type}</div>
  <div class="divider"></div>
  <div class="row"><span>Date</span><span>${date}</span></div>
  <div class="row"><span>Réseau</span><span class="bold">${(tx.provider || '').toUpperCase()}</span></div>
  <div class="row"><span>Numéro</span><span>${tx.phone}</span></div>
  <div class="row bold large"><span>Montant</span><span>${fmt(tx.amount)} FCFA</span></div>
  ${tx.fees ? `<div class="row"><span>Frais</span><span>${fmt(tx.fees)} FCFA</span></div>` : ''}
  <div class="divider"></div>
  <div class="row"><span>Statut</span><span class="status-ok">✓ SUCCÈS</span></div>
  ${tx.geniuspay_ref ? `<div class="row"><span>Réf.</span><span class="ref">${tx.geniuspay_ref}</span></div>` : ''}
  <div class="row"><span>Agent</span><span>${agentName}</span></div>
  <div class="divider"></div>
  <div class="footer">
    Conservez ce reçu comme preuve de transaction.<br/>
    Support: cabine.ci<br/>
    <div class="bold">Merci de votre confiance</div>
  </div>
</body>
</html>`;
}

// ─── Impression via window.print() (browser / PWA) ─────────────────────────
function printWeb(html) {
  const win = window.open('', '_blank', 'width=320,height=600,scrollbars=no');
  if (!win) {
    console.warn('PrintService: popup bloqué, essai dans le même onglet');
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.onafterprint = () => document.body.removeChild(iframe);
    iframe.contentWindow.print();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = () => win.close();
  win.print();
}

// ─── Impression Sunmi (terminal avec imprimante intégrée) ──────────────────
async function printSunmi(tx, agentName) {
  const P = window.SunmiPrinterPlugin;
  try {
    await P.printerInit();
    await P.setAlignment({ alignment: 1 }); // center
    await P.printText({ text: '================================\n' });
    await P.setFontSize({ size: 28 });
    await P.printText({ text: 'CABINE 2.0\n' });
    await P.setFontSize({ size: 20 });
    await P.printText({ text: 'Agent Mobile Money CI\n' });
    await P.setFontSize({ size: 18 });
    await P.printText({ text: '================================\n' });

    const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);
    const typeLabels = { TRANSFER: 'TRANSFERT', RETRAIT: 'RETRAIT', AIRTIME: 'CRÉDIT TEL', INTERNET: 'FORFAIT NET' };
    await P.setAlignment({ alignment: 1 });
    await P.setFontSize({ size: 24 });
    await P.printText({ text: `${typeLabels[tx.type] || tx.type}\n` });

    await P.setAlignment({ alignment: 0 }); // left
    await P.setFontSize({ size: 18 });
    const date = new Date(tx.created_at || Date.now()).toLocaleString('fr-FR');
    await P.printText({ text: `Date    : ${date}\n` });
    await P.printText({ text: `Réseau  : ${(tx.provider || '').toUpperCase()}\n` });
    await P.printText({ text: `Numéro  : ${tx.phone}\n` });
    await P.printText({ text: '--------------------------------\n' });

    await P.setFontSize({ size: 26 });
    await P.printText({ text: `${fmt(tx.amount)} FCFA\n` });
    await P.setFontSize({ size: 18 });

    if (tx.fees) await P.printText({ text: `Frais   : ${fmt(tx.fees)} FCFA\n` });
    await P.printText({ text: '--------------------------------\n' });
    await P.printText({ text: `Statut  : ✓ SUCCES\n` });
    if (tx.geniuspay_ref) await P.printText({ text: `Ref.    : ${tx.geniuspay_ref}\n` });
    await P.printText({ text: `Agent   : ${agentName}\n` });
    await P.printText({ text: '================================\n' });
    await P.setAlignment({ alignment: 1 });
    await P.printText({ text: 'Merci de votre confiance\ncabine.ci\n\n\n' });
    await P.cutPaper({ mode: 0 });
  } catch (err) {
    console.error('PrintService Sunmi error:', err);
    throw err;
  }
}

// ─── Partage texte via Capacitor Share (fallback Android générique) ─────────
async function printCapacitorShare(tx, agentName) {
  try {
    const { Share } = await import('@capacitor/share');
    const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);
    const date = new Date(tx.created_at || Date.now()).toLocaleString('fr-FR');
    const text = [
      '=== CABINE 2.0 ===',
      `${tx.type} — ${date}`,
      `Réseau : ${(tx.provider || '').toUpperCase()}`,
      `Numéro : ${tx.phone}`,
      `Montant: ${fmt(tx.amount)} FCFA`,
      tx.fees ? `Frais  : ${fmt(tx.fees)} FCFA` : null,
      `Statut : ✓ SUCCÈS`,
      tx.geniuspay_ref ? `Réf.   : ${tx.geniuspay_ref}` : null,
      `Agent  : ${agentName}`,
      '==================',
      'cabine.ci',
    ].filter(Boolean).join('\n');
    await Share.share({ title: 'Reçu Cabine 2.0', text, dialogTitle: 'Partager le reçu' });
  } catch (err) {
    console.warn('PrintService Share error:', err);
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────
const PrintService = {
  async print(tx, agentName, balance) {
    if (isSunmi()) {
      return printSunmi(tx, agentName);
    }
    if (isCapacitor()) {
      return printCapacitorShare(tx, agentName);
    }
    return printWeb(buildReceiptHtml(tx, agentName, balance));
  },

  canPrint: () => true,
  isSunmi,
  isCapacitor,
  buildReceiptHtml,
};

export default PrintService;
