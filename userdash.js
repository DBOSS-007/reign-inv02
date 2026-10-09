const user = requireAuth();

if(user){
  document.getElementById('avatar').textContent = initials(user);
  document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('welcomeHeading').textContent = `Welcome back, ${user.firstName} 👋`;

  document.getElementById('logoutBtn').addEventListener('click', (e)=>{ e.preventDefault(); DB.logout(); window.location.href='login.html'; });
  document.getElementById('menuBtn').addEventListener('click', ()=> document.getElementById('sidebar').classList.toggle('open'));

  document.querySelectorAll('.navlink[data-panel]').forEach(l=>{
    l.addEventListener('click', e=>{ e.preventDefault(); switchPanel(l.dataset.panel); });
  });

  function switchPanel(name){
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.navlink[data-panel]').forEach(l=>l.classList.remove('active'));
    const panel = document.getElementById('panel-'+name);
    if(panel) panel.classList.add('active');
    const link = document.querySelector(`.navlink[data-panel="${name}"]`);
    if(link) link.classList.add('active');
    const titles = { overview:'Dashboard', user:'My profile', wallet:'Wallet', deposit:'Deposit', invest:'Investment plan', withdraw:'Withdraw', transactions:'Transactions', commission:'Commission record', referral:'Referral', notifications:'Notifications', kyc:'KYC documents', bank:'Bank details' };
    document.getElementById('pageTitle').textContent = titles[name] || 'Dashboard';
    document.getElementById('sidebar').classList.remove('open');
    renderAll();
    window.scrollTo(0,0);
  }
  window.switchPanel = switchPanel;

  const kycPillMap = {
    unsubmitted: ['pill-neutral','Not started'], pending:['pill-warn','Pending review'],
    approved:['pill-success','Verified'], rejected:['pill-danger','Rejected'], none:['pill-neutral','—'],
  };

  function renderAll(){
    renderTopbar();
    renderOverview();
    renderProfile();
    renderWallet();
    renderInvestPanel();
    renderWithdrawPanel();
    renderTransactions();
    renderCommission();
    renderReferral();
    renderNotifications();
    renderKYC();
    renderBank();
  }

  function renderTopbar(){
    const [cls,label] = kycPillMap[user.kyc.status] || kycPillMap.none;
    const pill = document.getElementById('kycTopPill');
    pill.className = 'pill ' + cls; pill.textContent = 'KYC: ' + label;
    const unread = user.notifications.filter(n=>!n.read).length;
    const badge = document.getElementById('notifBadge');
    if(unread>0){ badge.style.display='inline-flex'; badge.textContent = unread; } else badge.style.display='none';
  }

  function renderOverview(){
    const invs = user.investments;
    const active = invs.filter(i=>i.status==='ACTIVE');
    let totalInvested=0, totalValue=0;
    invs.forEach(i=>{ totalInvested += i.principal; totalValue += DB.investmentValue(i).current; });
    document.getElementById('invOverview').innerHTML = `
      <div class="card stat"><div class="label">Active investments</div><div class="value">${active.length}</div></div>
      <div class="card stat"><div class="label">Total invested</div><div class="value">${fmtMoney(totalInvested,'NGN')}</div></div>
      <div class="card stat"><div class="label">Total profit</div><div class="value">${fmtMoney(totalValue-totalInvested,'NGN')}</div></div>
      <div class="card stat"><div class="label">Portfolio value</div><div class="value">${fmtMoney(totalValue,'NGN')}</div></div>`;

    document.getElementById('recentTxBody').innerHTML = rowsOrEmpty(user.transactions.slice(0,5), 6, t=>`
      <tr><td class="mono">${t.reference}</td><td>${t.type}</td><td>${t.currency}</td><td>${fmtMoney(t.amount,t.currency)}</td><td>${statusPill(t.status)}</td><td>${fmtDate(t.date)}</td></tr>`);

    document.getElementById('recentInvBody').innerHTML = rowsOrEmpty(invs.slice(0,5), 7, i=>{
      const v = DB.investmentValue(i);
      return `<tr><td class="mono">${i.reference}</td><td>${i.plan}</td><td>${fmtMoney(i.principal,i.currency)}</td><td>${fmtMoney(v.current,i.currency)}</td>
        <td><div class="progress"><i style="width:${v.pct}%"></i></div><span style="font-size:11px;color:var(--muted);">${v.pct}%</span></td>
        <td>${statusPill(i.status)}</td><td>${fmtDate(i.startDate)}</td></tr>`;
    });
  }

  function renderProfile(){
    document.getElementById('pFirstName').value = user.firstName || '';
    document.getElementById('pLastName').value = user.lastName || '';
    document.getElementById('pMiddleName').value = user.middleName || '';
    document.getElementById('pEmail').value = user.email || '';
    document.getElementById('pPhone').value = user.phone || '';
    document.getElementById('pDob').value = user.dob || '';
    document.getElementById('pGender').value = user.gender || '';
    document.getElementById('pMarital').value = user.maritalStatus || '';
    document.getElementById('pPostal').value = user.postalCode || '';
    document.getElementById('pCountry').value = user.country || '';
    document.getElementById('pState').value = user.state || '';
    document.getElementById('pCity').value = user.city || '';
    document.getElementById('pAddress').value = user.address || '';
    document.getElementById('secEmail').textContent = user.email;
    document.getElementById('secPhone').textContent = user.phone || 'Not provided';
    const pct = DB.profileCompletion(user);
    document.getElementById('pctLabel').textContent = pct + '%';
    document.getElementById('pctBar').style.width = pct + '%';
    document.getElementById('twofaBtn').textContent = user.twoFA ? '2FA enabled ✓' : 'Set up 2FA';
  }

  function renderWallet(){
    const ccys = ['NGN','USD','USDT','BTC'];
    document.getElementById('walletGrid').innerHTML = ccys.map(c=>`
      <div class="card wallet-card">
        <div class="ccy">${c} Wallet</div>
        <div class="bal">${fmtMoney(user.wallets[c].balance, c)}</div>
        <div class="sub">Locked: ${fmtMoney(user.wallets[c].locked, c)}</div>
        <div class="row-btns">
          <button class="btn btn-emerald btn-sm" onclick="quickDeposit('${c}')">Fund</button>
          <button class="btn btn-navy btn-sm" onclick="openConvert('${c}')">Convert</button>
        </div>
      </div>`).join('');
  }
  window.quickDeposit = (ccy)=>{ switchPanel('deposit'); document.getElementById('depCcy').value = ccy; };

  function renderInvestPanel(){
    document.getElementById('investBody').innerHTML = rowsOrEmpty(user.investments, 7, i=>{
      const v = DB.investmentValue(i);
      return `<tr><td class="mono">${i.reference}</td><td>${i.plan} (${i.roi}%)</td><td>${fmtMoney(i.principal,i.currency)}</td><td>${fmtMoney(v.current,i.currency)}</td>
        <td><div class="progress"><i style="width:${v.pct}%"></i></div><span style="font-size:11px;color:var(--muted);">${v.pct}%</span></td>
        <td>${statusPill(v.pct>=100?'MATURED':i.status)}</td><td>${fmtDate(i.maturityDate)}</td></tr>`;
    });
  }

  function renderWithdrawPanel(){
    const notice = document.getElementById('withdrawKycNotice');
    if(user.kyc.status !== 'approved'){
      notice.style.display='block';
      notice.innerHTML = `<b style="color:var(--coral);">Verification required</b><p style="color:var(--muted);margin:8px 0 12px;font-size:13.5px;">Complete KYC verification before you can withdraw funds.</p><a href="#" onclick="switchPanel('kyc');return false;" class="btn btn-coral btn-sm">Go to KYC</a>`;
    } else notice.style.display='none';

    const sel = document.getElementById('wdBank');
    sel.innerHTML = user.bankAccounts.length
      ? user.bankAccounts.map(b=>`<option value="${b.id}">${b.bank} — ${b.accountNumber} (${b.accountName})</option>`).join('')
      : `<option value="">Add a bank account first</option>`;

    updateWdAvail();
    document.getElementById('withdrawBody').innerHTML = rowsOrEmpty(DB.state.withdrawals.filter(w=>w.userId===user.id), 6, w=>
      `<tr><td class="mono">${w.reference}</td><td>${w.currency}</td><td>${fmtMoney(w.amount,w.currency)}</td><td>${w.bank}</td><td>${statusPill(w.status)}</td><td>${fmtDate(w.requestedAt)}</td></tr>`);
  }
  function updateWdAvail(){
    const ccy = document.getElementById('wdCcy').value;
    document.getElementById('wdAvail').textContent = `Available balance: ${fmtMoney(user.wallets[ccy].balance, ccy)}`;
  }
  document.getElementById('wdCcy').addEventListener('change', updateWdAvail);

  function renderTransactions(){
    document.getElementById('allTxBody').innerHTML = rowsOrEmpty(user.transactions, 6, t=>
      `<tr><td class="mono">${t.reference}</td><td>${t.type}</td><td>${t.currency}</td><td>${fmtMoney(t.amount,t.currency)}</td><td>${statusPill(t.status)}</td><td>${fmtDate(t.date)}</td></tr>`);
  }

  function renderCommission(){
    const referrals = DB.state.users.filter(u=>u.referredBy === user.referralCode);
    let total = 0; const rows = [];
    referrals.forEach(r=>{
      r.investments.forEach(i=>{
        const commission = i.principal * 0.05;
        total += commission;
        rows.push({ name:`${r.firstName} ${r.lastName}`, source:i.plan, amount:i.principal, ccy:i.currency, commission, date:i.startDate });
      });
    });
    document.getElementById('commTotal').textContent = fmtMoney(total,'NGN');
    document.getElementById('commReferrals').textContent = referrals.filter(r=>r.investments.length).length;
    document.getElementById('commBody').innerHTML = rowsOrEmpty(rows, 5, r=>
      `<tr><td>${r.name}</td><td>${r.source} plan investment</td><td>${fmtMoney(r.amount,r.ccy)}</td><td>${fmtMoney(r.commission,r.ccy)}</td><td>${fmtDate(r.date)}</td></tr>`);
  }

  function renderReferral(){
    document.getElementById('refCode').textContent = user.referralCode;
    const referrals = DB.state.users.filter(u=>u.referredBy === user.referralCode);
    document.getElementById('referralBody').innerHTML = rowsOrEmpty(referrals, 4, r=>
      `<tr><td>${r.firstName} ${r.lastName}</td><td>${r.email}</td><td>${fmtDate(r.createdAt)}</td><td>${r.investments.length}</td></tr>`);
  }
  document.getElementById('copyRefBtn').addEventListener('click', ()=>{
    navigator.clipboard?.writeText(user.referralCode).catch(()=>{});
    toast('Referral code copied', 'ok');
  });

  function renderNotifications(){
    const list = document.getElementById('notifList');
    if(!user.notifications.length){ list.innerHTML = emptyState('No notifications yet', 'Activity on your account will show up here.'); return; }
    list.innerHTML = user.notifications.map(n=>`
      <div class="notif-item ${n.read?'read':''}">
        <div class="notif-dot"></div>
        <div><b style="font-size:13.8px;display:block;">${n.title}</b><div style="font-size:13px;color:var(--muted);margin-top:2px;">${n.body}</div><div style="font-size:11.5px;color:var(--muted);margin-top:6px;">${fmtDate(n.date)}</div></div>
      </div>`).join('');
    user.notifications.forEach(n=>n.read=true);
    DB.persist();
  }

  function renderKYC(){
    const card = document.getElementById('kycStatusCard');
    const wrap = document.getElementById('kycFormWrap');
    const k = user.kyc;
    const icons = { unsubmitted:['🪪','pill-neutral'], pending:['⏳','pill-warn'], approved:['✅','pill-success'], rejected:['⚠️','pill-danger'] };
    const [icon, cls] = icons[k.status] || icons.unsubmitted;
    const bg = { 'pill-neutral':'#eef0f6', 'pill-warn':'var(--amber-soft)', 'pill-success':'var(--emerald-soft)', 'pill-danger':'var(--coral-soft)' }[cls];
    card.innerHTML = `
      <div class="kyc-icon" style="background:${bg};">${icon}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;"><b style="font-family:var(--font-display);font-size:17px;color:var(--navy);">Verification status</b>${statusPill(k.status)}</div>
        ${k.status==='unsubmitted' ? '<p style="color:var(--muted);font-size:13.8px;margin:6px 0 0;">Submit a government ID to verify your identity.</p>' : ''}
        ${k.status==='pending' ? `<p style="color:var(--muted);font-size:13.8px;margin:6px 0 0;">Your ${k.docType} was submitted on ${fmtDate(k.submittedAt)} and is awaiting review.</p>` : ''}
        ${k.status==='approved' ? `<p style="color:var(--muted);font-size:13.8px;margin:6px 0 0;">Verified with ${k.docType} •••${String(k.docNumber).slice(-4)} on ${fmtDate(k.reviewedAt)}.</p>` : ''}
        ${k.status==='rejected' ? `<p style="color:var(--coral);font-size:13.8px;margin:6px 0 0;"><b>Reason:</b> ${k.reason}</p><p style="color:var(--muted);font-size:12.5px;margin:4px 0 0;">Reviewed ${fmtDate(k.reviewedAt)}</p>` : ''}
      </div>`;

    if(k.status === 'approved'){ wrap.innerHTML=''; return; }
    wrap.innerHTML = `
      <form id="kycForm" class="card card-pad">
        <div class="field"><label>Identity document</label>
          <select id="kDocType" required><option value="">Select document type</option><option>National ID (NIN)</option><option>Passport</option><option>Driver's License</option><option>Voter's Card</option></select>
        </div>
        <div class="field"><label>Document number</label><input id="kDocNumber" required placeholder="Enter document number"></div>
        <div class="field"><label>Front of document</label><input type="file" id="kFront" accept="image/*"><p class="hint">Upload a clear image of the front of your identity document.</p></div>
        <div class="field"><label>Back of document</label><input type="file" id="kBack" accept="image/*"><p class="hint">Upload the back of your document where applicable.</p></div>
        <button type="submit" class="btn btn-navy">${k.status==='rejected' ? 'Resubmit KYC' : 'Submit KYC'}</button>
      </form>`;
    document.getElementById('kycForm').addEventListener('submit', e=>{
      e.preventDefault();
      DB.submitKYC(user, { docType: document.getElementById('kDocType').value, docNumber: document.getElementById('kDocNumber').value });
      toast('KYC submitted for review', 'ok');
      renderAll();
    });
  }

  function renderBank(){
    document.getElementById('bankBody').innerHTML = rowsOrEmpty(user.bankAccounts, 5, b=>`
      <tr><td>${b.bank}</td><td class="mono">${b.accountNumber}</td><td>${b.accountName}</td><td>${b.default?'<span class=\"pill pill-success\">Default</span>':'No'}</td>
      <td style="display:flex;gap:6px;">
        ${b.default?'':`<button class="btn btn-outline btn-sm" onclick="setDefaultBank('${b.id}')">Set default</button>`}
        <button class="btn btn-coral btn-sm" onclick="deleteBank('${b.id}')">Delete</button>
      </td></tr>`);
  }
  window.setDefaultBank = (id)=>{ DB.setDefaultBank(user, id); toast('Default account updated','ok'); renderAll(); };
  window.deleteBank = (id)=>{ DB.deleteBankAccount(user, id); toast('Bank account removed','ok'); renderAll(); };

  // ---------- forms ----------
  document.getElementById('profileForm').addEventListener('submit', e=>{
    e.preventDefault();
    DB.saveProfile(user, {
      firstName: document.getElementById('pFirstName').value, lastName: document.getElementById('pLastName').value,
      middleName: document.getElementById('pMiddleName').value, phone: document.getElementById('pPhone').value,
      dob: document.getElementById('pDob').value, gender: document.getElementById('pGender').value,
      maritalStatus: document.getElementById('pMarital').value, postalCode: document.getElementById('pPostal').value,
      country: document.getElementById('pCountry').value, state: document.getElementById('pState').value,
      city: document.getElementById('pCity').value, address: document.getElementById('pAddress').value,
    });
    toast('Profile saved', 'ok'); renderAll();
  });

  document.getElementById('twofaBtn').addEventListener('click', ()=>{
    user.twoFA = !user.twoFA; DB.persist();
    toast(user.twoFA ? '2FA enabled' : '2FA disabled', 'ok'); renderProfile();
  });

  document.getElementById('depositForm').addEventListener('submit', e=>{
    e.preventDefault();
    const amt = Number(document.getElementById('depAmount').value);
    if(amt<=0) return toast('Enter a valid amount','err');
    DB.fund(user, document.getElementById('depCcy').value, amt);
    toast('Wallet funded successfully', 'ok');
    document.getElementById('depositForm').reset();
    renderAll();
  });

  document.getElementById('withdrawForm').addEventListener('submit', e=>{
    e.preventDefault();
    try{
      DB.requestWithdrawal(user, document.getElementById('wdCcy').value, Number(document.getElementById('wdAmount').value), document.getElementById('wdBank').value);
      toast('Withdrawal request submitted', 'ok');
      document.getElementById('withdrawForm').reset();
      renderAll();
    }catch(ex){ toast(ex.message, 'err'); }
  });

  // ---------- invest modal ----------
  let selectedPlan = PLANS[0].id;
  function openInvestModal(){
    document.getElementById('planPick').innerHTML = PLANS.map(p=>`<div class="p ${p.id===selectedPlan?'sel':''}" data-plan="${p.id}"><b>${p.name}</b><span>${p.roi}% · ${p.days}d</span></div>`).join('');
    document.querySelectorAll('#planPick .p').forEach(el=>el.addEventListener('click', ()=>{ selectedPlan = el.dataset.plan; openInvestModal(); }));
    const wSel = document.getElementById('invWallet');
    wSel.innerHTML = ['NGN','USD','USDT','BTC'].map(c=>`<option value="${c}">${c} Wallet (${fmtMoney(user.wallets[c].balance,c)})</option>`).join('');
    document.getElementById('invAmount').value = '';
    updateInvestSummary();
    document.getElementById('investModal').classList.add('open');
  }
  function updateInvestSummary(){
    const plan = PLANS.find(p=>p.id===selectedPlan);
    const ccy = document.getElementById('invWallet').value || 'NGN';
    const amount = Number(document.getElementById('invAmount').value)||0;
    const profit = amount * (plan.roi/100);
    const maturity = new Date(Date.now()+plan.days*86400000);
    document.getElementById('invSummary').innerHTML = `
      Plan <b>${plan.name}</b><br>Wallet <b>${ccy} Wallet</b><br>Available balance <b>${fmtMoney(user.wallets[ccy].balance,ccy)}</b><hr style="border:none;border-top:1px solid var(--line);margin:8px 0;">
      Investment amount <b>${fmtMoney(amount,ccy)}</b><br>ROI <b>${plan.roi}%</b><br>Duration <b>${plan.days} Days</b><br>
      Expected profit <b>${fmtMoney(profit,ccy)}</b><br>Expected return <b>${fmtMoney(amount+profit,ccy)}</b><br>Maturity date <b>${maturity.toLocaleDateString()}</b>`;
  }
  document.getElementById('openInvestBtn').addEventListener('click', openInvestModal);
  document.getElementById('invWallet').addEventListener('change', updateInvestSummary);
  document.getElementById('invAmount').addEventListener('input', updateInvestSummary);
  document.getElementById('confirmInvestBtn').addEventListener('click', ()=>{
    try{
      DB.invest(user, selectedPlan, document.getElementById('invWallet').value, Number(document.getElementById('invAmount').value));
      toast('Investment started', 'ok');
      closeModal('investModal');
      renderAll();
    }catch(ex){ toast(ex.message, 'err'); }
  });

  // ---------- bank modal ----------
  document.getElementById('bBank').innerHTML = BANKS.map(b=>`<option>${b}</option>`).join('');
  document.getElementById('openBankBtn').addEventListener('click', ()=>{
    document.getElementById('bankForm').reset();
    document.getElementById('bankModal').classList.add('open');
  });
  document.getElementById('saveBankBtn').addEventListener('click', ()=>{
    const accNum = document.getElementById('bAccNum').value.trim();
    const accName = document.getElementById('bAccName').value.trim();
    if(!accNum || !accName) return toast('Fill in all bank details','err');
    DB.addBankAccount(user, { bank: document.getElementById('bBank').value, accountNumber: accNum, accountName: accName, default: document.getElementById('bDefault').checked });
    toast('Bank account added', 'ok');
    closeModal('bankModal');
    renderAll();
  });

  // ---------- convert modal ----------
  function openConvert(fromCcy){
    const ccys = ['NGN','USD','USDT','BTC'];
    document.getElementById('cvFrom').innerHTML = ccys.map(c=>`<option ${c===fromCcy?'selected':''}>${c}</option>`).join('');
    document.getElementById('cvTo').innerHTML = ccys.map(c=>`<option ${c===(fromCcy==='NGN'?'USD':'NGN')?'selected':''}>${c}</option>`).join('');
    document.getElementById('cvAmount').value = '';
    updateConvertPreview();
    document.getElementById('convertModal').classList.add('open');
  }
  window.openConvert = openConvert;
  function updateConvertPreview(){
    const from = document.getElementById('cvFrom').value, to = document.getElementById('cvTo').value;
    const amt = Number(document.getElementById('cvAmount').value)||0;
    const out = (amt*RATES[from])/RATES[to];
    document.getElementById('cvPreview').textContent = `Available: ${fmtMoney(user.wallets[from].balance,from)} · You'll receive ≈ ${fmtMoney(out,to)}`;
  }
  ['cvFrom','cvTo','cvAmount'].forEach(id=>document.getElementById(id).addEventListener('input', updateConvertPreview));
  document.getElementById('confirmConvertBtn').addEventListener('click', ()=>{
    try{
      DB.convert(user, document.getElementById('cvFrom').value, document.getElementById('cvTo').value, Number(document.getElementById('cvAmount').value));
      toast('Conversion complete', 'ok');
      closeModal('convertModal');
      renderAll();
    }catch(ex){ toast(ex.message, 'err'); }
  });

  window.closeModal = (id)=> document.getElementById(id).classList.remove('open');
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('open'); }));

  // ---------- helpers ----------
  function statusPill(status){
    const map = { Success:'pill-success', ACTIVE:'pill-success', Approved:'pill-success', approved:'pill-success', MATURED:'pill-navy',
      Pending:'pill-warn', pending:'pill-warn', Rejected:'pill-danger', rejected:'pill-danger', unsubmitted:'pill-neutral', none:'pill-neutral' };
    return `<span class="pill ${map[status]||'pill-neutral'}">${status}</span>`;
  }
  function rowsOrEmpty(arr, colspan, renderFn){
    if(!arr.length) return `<tr><td colspan="${colspan}" style="padding:0;"><div class="empty"><b>Nothing here yet</b>Activity will appear as soon as you take an action.</div></td></tr>`;
    return arr.map(renderFn).join('');
  }
  function emptyState(title, sub){ return `<div class="empty"><b>${title}</b>${sub}</div>`; }

  const params = new URLSearchParams(window.location.search);
  switchPanel(params.get('panel') || 'overview');
}
