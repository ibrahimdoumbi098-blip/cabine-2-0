// Génération de rapport PDF mensuel — Cabine 2.0
// Utilise window.print() avec HTML stylé — aucune dépendance externe

export function generateMonthlyReportHTML(agentName, email, period, transactions, summary = {}) {
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(parseInt(n) || 0);
  const fmtDate = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const successTx = transactions.filter(t => t.status === 'SUCCESS');
  const totalVolume = successTx.reduce((s, t) => s + (parseInt(t.amount) || 0), 0);
  const byType = { TRANSFER: 0, RETRAIT: 0, AIRTIME: 0, INTERNET: 0 };
  successTx.forEach(t => { byType[t.type] = (byType[t.type] || 0) + (parseInt(t.amount) || 0); });
  const commissionRate = summary.commissionRate || 2;
  const estimatedCommission = Math.round(totalVolume * commissionRate / 100);
  const geniusFees = Math.round(totalVolume * 0.01);
  const netProfit = estimatedCommission - geniusFees;

  const txRows = successTx.slice(0, 200).map(tx => `
    <tr>
      <td>${fmtDate(tx.created_at)}</td>
      <td style="font-family:monospace">TX-${String(tx.id).padStart(6, '0')}</td>
      <td><span class="badge badge-${tx.type?.toLowerCase()}">${tx.type}</span></td>
      <td>${(tx.provider || '').toUpperCase()}</td>
      <td>${tx.phone || ''}</td>
      <td style="text-align:right;font-weight:700">${fmt(tx.amount)} F</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport — ${agentName} — ${period}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Inter',-apple-system,sans-serif;color:#111827;background:#fff;font-size:12px;line-height:1.5; }
  .header { background:linear-gradient(135deg,#4338ca,#6366f1,#818cf8);color:white;padding:28px 36px; }
  .header h1 { font-size:22px;font-weight:900;letter-spacing:-0.5px;margin-bottom:4px; }
  .header p { opacity:.75;font-size:13px;margin-bottom:14px; }
  .meta { display:flex;gap:10px;flex-wrap:wrap; }
  .meta span { background:rgba(255,255,255,.15);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600; }
  .kpis { display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:20px 36px;border-bottom:1px solid #e5e7eb; }
  .kpi { background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px; }
  .kpi-label { font-size:9px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px; }
  .kpi-value { font-size:22px;font-weight:900;color:#111827;letter-spacing:-1px; }
  .kpi-sub { font-size:10px;color:#9ca3af;margin-top:3px; }
  .kpi.green .kpi-value { color:#10b981; }
  .kpi.purple { border-top:2px solid #6366f1; }
  .kpi.purple .kpi-value { color:#6366f1; }
  .section { padding:18px 36px; }
  .section + .section { border-top:1px solid #f3f4f6; }
  .section-title { font-size:11px;font-weight:700;color:#374151;margin-bottom:12px;text-transform:uppercase;letter-spacing:.8px;display:flex;align-items:center;gap:8px; }
  .section-title::before { content:'';width:3px;height:14px;background:#6366f1;border-radius:2px;display:inline-block; }
  .profit-box { background:linear-gradient(135deg,rgba(16,185,129,.06),rgba(16,185,129,.02));border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:16px 20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px; }
  .profit-item { text-align:center; }
  .profit-label { font-size:9px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px; }
  .profit-amount { font-size:20px;font-weight:900; }
  .profit-amount.green { color:#10b981; }
  .profit-amount.red { color:#ef4444; }
  .profit-amount.big { font-size:24px;color:#6366f1; }
  table { width:100%;border-collapse:collapse;font-size:11px; }
  th { background:#f3f4f6;padding:8px 10px;text-align:left;font-weight:700;color:#6b7280;text-transform:uppercase;font-size:9px;letter-spacing:.5px; }
  td { padding:8px 10px;border-bottom:1px solid #f3f4f6;color:#374151; }
  tr:nth-child(even) td { background:#fafafa; }
  .badge { display:inline-block;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:700;text-transform:uppercase; }
  .badge-transfer { background:rgba(99,102,241,.1);color:#6366f1; }
  .badge-retrait { background:rgba(16,185,129,.1);color:#10b981; }
  .badge-airtime { background:rgba(245,158,11,.1);color:#b45309; }
  .badge-internet { background:rgba(59,130,246,.1);color:#3b82f6; }
  .footer { padding:14px 36px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:10px;background:#f9fafb; }
  @media print {
    @page { margin:10mm;size:A4; }
    body { -webkit-print-color-adjust:exact;print-color-adjust:exact; }
    .no-print { display:none; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>⚡ Rapport Mensuel Cabine 2.0</h1>
  <p>Relevé de performance et d'activité de l'agent</p>
  <div class="meta">
    <span>📅 ${period}</span>
    <span>👤 ${agentName}</span>
    <span>📧 ${email}</span>
    <span>Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
  </div>
</div>

<div class="kpis">
  <div class="kpi">
    <div class="kpi-label">Transactions réussies</div>
    <div class="kpi-value">${successTx.length}</div>
    <div class="kpi-sub">sur ${transactions.length} initiées — ${transactions.length > 0 ? Math.round(successTx.length / transactions.length * 100) : 0}% de succès</div>
  </div>
  <div class="kpi purple">
    <div class="kpi-label">Volume total</div>
    <div class="kpi-value">${fmt(totalVolume)}</div>
    <div class="kpi-sub">FCFA traités ce mois</div>
  </div>
  <div class="kpi green">
    <div class="kpi-label">Bénéfice net estimé</div>
    <div class="kpi-value">${fmt(netProfit)}</div>
    <div class="kpi-sub">FCFA après frais GeniusPay</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Commission collectée</div>
    <div class="kpi-value">${commissionRate}%</div>
    <div class="kpi-sub">Taux configuré par l'admin</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Analyse des revenus</div>
  <div class="profit-box">
    <div class="profit-item">
      <div class="profit-label">Commission à ${commissionRate}%</div>
      <div class="profit-amount green">+${fmt(estimatedCommission)} FCFA</div>
    </div>
    <div class="profit-item">
      <div class="profit-label">Frais GeniusPay (1%)</div>
      <div class="profit-amount red">−${fmt(geniusFees)} FCFA</div>
    </div>
    <div class="profit-item">
      <div class="profit-label">Bénéfice net</div>
      <div class="profit-amount big">${fmt(netProfit)} FCFA</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Répartition par service</div>
  <table>
    <tr><th>Service</th><th style="text-align:right">Volume (FCFA)</th><th style="text-align:right">Part (%)</th><th style="text-align:right">Nb tx</th></tr>
    ${Object.entries(byType).filter(([, v]) => v > 0).map(([type, vol]) => `
      <tr>
        <td><span class="badge badge-${type.toLowerCase()}">${type}</span></td>
        <td style="text-align:right;font-weight:700">${fmt(vol)}</td>
        <td style="text-align:right">${totalVolume > 0 ? Math.round(vol / totalVolume * 100) : 0}%</td>
        <td style="text-align:right">${successTx.filter(t => t.type === type).length}</td>
      </tr>
    `).join('')}
  </table>
</div>

<div class="section">
  <div class="section-title">Détail des transactions (${Math.min(successTx.length, 200)} / ${successTx.length})</div>
  <table>
    <tr><th>Date & heure</th><th>Référence</th><th>Type</th><th>Opérateur</th><th>Numéro</th><th style="text-align:right">Montant</th></tr>
    ${txRows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px">Aucune transaction réussie ce mois</td></tr>'}
  </table>
</div>

<div class="footer">
  ⚡ Cabine 2.0 — Plateforme Mobile Money Côte d'Ivoire · cabine.ci<br>
  Rapport confidentiel — Usage exclusif de l'agent ${agentName}
</div>
</body>
</html>`;
}

export function downloadPDFReport(agentName, email, period, transactions, summary) {
  const html = generateMonthlyReportHTML(agentName, email, period, transactions, summary);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => {
        win.print();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 600);
    });
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${agentName.replace(/\s+/g, '-').toLowerCase()}-${period}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
