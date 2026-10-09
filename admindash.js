const admin = requireAdmin();
if(admin){
  const $ = id => document.getElementById(id);
  const fmtN = n => '₦' + Math.round(n).toLocaleString('en-US');
  const stamp = iso => new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const ago = iso => { const m = Math.floor((Date.now()-new Date(iso))/60000); if(m<1) return 'just now'; if(m<60) return m+'m'; const h=Math.floor(m/60); return h<24 ? h+'h' : Math.floor(h/24)+'d'; };
  const walletNGN = u => Object.keys(u.wallets).reduce((s,c)=> s + (u.wallets[c].balance + u.wallets[c].locked) * RATES[c], 0);
  const userById = id => DB.state.users.find(u=>u.id===id);
  const caseId = (p,id) => p + '-' + id.replace(/^[A-Z]-/,'');
  const state = { kyc:'pending', wd:'Pending', range:24 };
  const empty = (cols,t='No records') => `<tr><td colspan="${cols}"><div class="empty"><b>${t}</b>Nothing matches this view.</div></td></tr>`;
  const pill = s => { const m={approved:'pill-success',Approved:'pill-success',pending:'pill-warn',Pending:'pill-warn',rejected:'pill-danger',Rejected:'pill-danger',frozen:'pill-danger',Active:'pill-success'}; return `<span class="pill ${m[s]||'pill-neutral'}">${s}</span>`; };

  $('adminName').textContent = `${admin.firstName} ${admin.lastName}`;
  $('adminId').textContent = 'OP-' + admin.id.replace(/^U-/,'');
  $('logoutBtn').addEventListener('click', e=>{ e.preventDefault(); DB.logout(); location.href='login.html'; });
  document.querySelectorAll('.navlink[data-panel]').forEach(l=> l.addEventListener('click', e=>{ e.preventDefault(); switchPanel(l.dataset.panel); }));

  const titles = { overview:'Dashboard', registry:'User Registry', kyc:'KYC Review', payouts:'Payout Authorisation', risk:'Risk Monitor', audit:'Audit Log', reports:'Reports' };
  function switchPanel(name){
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.navlink[data-panel]').forEach(l=>l.classList.remove('active'));
    $('panel-'+name).classList.add('active');
    document.querySelector(`.navlink[data-panel="${name}"]`).classList.add('active');
    closeDrawer(); renderAll(); scrollTo(0,0);
  }
  window.switchPanel = switchPanel;

  function tabs(el, opts, cur, onPick){
    $(el).innerHTML = opts.map(([k,l,n])=>`<button class="${k===cur?'on':''}" data-k="${k}">${l}<span>${n}</span></button>`).join('');
    $(el).querySelectorAll('button').forEach(b=> b.onclick = ()=>{ onPick(b.dataset.k); renderAll(); });
  }

  function renderAll(){ renderBadges(); renderOverview(); renderRail(); renderRegistry(); renderKYC(); renderPayouts(); renderRisk(); renderAudit(); }

  function renderBadges(){
    const set = (id,n)=>{ $(id).style.display = n?'inline-flex':'none'; $(id).textContent = n; };
    set('kycBadge', DB.pendingKYC().length); set('wdBadge', DB.pendingWithdrawals().length); set('riskBadge', DB.suspiciousActivity().length);
  }

  function bars(rows){ const max = Math.max(1,...rows.map(r=>r[1])); return rows.map(([l,v,c,txt])=>`<div class="bar-row"><div class="l"><span>${l}</span><b>${txt}</b></div><div class="t"><i class="${c||''}" style="width:${v/max*100}%"></i></div></div>`).join(''); }

  const inRange = (iso,h)=> !h || (Date.now()-new Date(iso))/3600000 <= h;
  const compact = n => n>=1e9 ? '₦'+(n/1e9).toFixed(1)+' b' : n>=1e6 ? '₦'+(n/1e6).toFixed(1)+' m' : fmtN(n);
  const ring = (pct,color,size,sw)=>{ const r=(size-sw)/2, C=2*Math.PI*r, h=size/2; return `<svg width="${size}" height="${size}"><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${sw}"/><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C*Math.min(pct,100)/100} ${C}"/></svg>`; };
  const ico = {
    users:'<svg viewBox="0 0 24 24" fill="#8c6bff"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.500 7 6z"/><circle cx="17" cy="9" r="2.800" opacity=".7"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="#f0524f" stroke-width="2.500"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
    coin:'<svg viewBox="0 0 24 24" fill="none" stroke="#3d8bff" stroke-width="2.500"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10c0-2 6-2 6 0s-6 2-6 4 6 2 6 0"/></svg>'
  };
  const arrow = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d8bff" stroke-width="2.500"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  // populate plan filter once, wire filters + range pills
  $('fPlan').innerHTML += PLANS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  ['fAcct','fKyc','fPlan','fReg'].forEach(id=> $(id).addEventListener('change', renderOverview));
  document.querySelectorAll('.range button').forEach(b=> b.onclick = ()=>{ document.querySelectorAll('.range button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.range = +b.dataset.h; renderAll(); });
  $('gSearch').addEventListener('keydown', e=>{ if(e.key==='Enter'){ switchPanel('registry'); $('userSearch').value = e.target.value; renderRegistry(); } });

  function queueItems(){
    const q = [];
    DB.pendingWithdrawals().forEach(w=>{ const u=userById(w.userId); q.push({hi: w.amount*RATES[w.currency]>1000000, item:'Payout request', who:u?u.email:'—', date:w.requestedAt, panel:'payouts'}); });
    DB.pendingKYC().forEach(u=> q.push({hi:false, item:'KYC submission', who:u.email, date:u.kyc.submittedAt, panel:'kyc'}));
    DB.suspiciousActivity().forEach(f=> q.push({hi:true, item:f.kind, who:f.user.email, date:f.date, panel:'risk'}));
    return q.sort((a,b)=> (b.hi-a.hi) || new Date(a.date)-new Date(b.date));
  }

  function renderOverview(){
    const af=$('fAcct').value, kf=$('fKyc').value, pf=$('fPlan').value, rf=+$('fReg').value;
    const users = DB.allUsers().filter(u=> (af==='all'||(af==='frozen')===!!u.frozen) && (kf==='all'||u.kyc.status===kf) && (pf==='all'||u.investments.some(i=>i.planId===pf)) && inRange(u.createdAt,rf));
    const verified = users.filter(u=>u.kyc.status==='approved').length;
    const pct = users.length ? Math.round(verified/users.length*100) : 0;
    let invested = 0; users.forEach(u=>u.investments.forEach(i=>{ if(pf==='all'||i.planId===pf) invested += i.principal*RATES[i.currency]; }));
    const pendK = DB.pendingKYC().length, pendW = DB.pendingWithdrawals().length;
    $('hero').innerHTML = `
      <div class="ringbox">${ring(pct,'#c4c22a',170,14)}<div class="c">KYC verified<b>${pct}%</b></div></div>
      <div class="scard"><div class="l">Registered users</div><div class="v">${ico.users}${users.length}</div><a onclick="switchPanel('registry')">View users ${arrow}</a></div>
      <div class="scard"><div class="l">Pending approvals</div><div class="v">${ico.check}${pendK+pendW}</div><a onclick="switchPanel('${pendW>=pendK?'payouts':'kyc'}')">Review queue ${arrow}</a></div>
      <div class="scard"><div class="l">Capital invested</div><div class="v">${ico.coin}${compact(invested)}</div><a onclick="switchPanel('reports')">View reports ${arrow}</a></div>`;

    const wds = DB.allWithdrawals(), pw = wds.filter(w=>w.status==='Pending').sort((a,b)=>b.amount*RATES[b.currency]-a.amount*RATES[a.currency]);
    const kycAll = DB.allUsers().filter(u=>u.kyc.status!=='unsubmitted'), pk = DB.pendingKYC();
    const flags = DB.suspiciousActivity(), flagged = new Set(flags.map(f=>f.user.id)).size, all = DB.allUsers().length;
    const lst = (arr,fn)=> arr.length ? arr.slice(0,2).map(fn).join('') : '<small>Nothing outstanding.</small>';
    const card = (title,pct,col,items,link,panel)=>`<div class="pcard"><h4>${title}</h4><div class="pm"><div class="mini">${ring(pct,col,96,9)}<div class="c">Open<b style="color:${col}">${pct}%</b></div></div><div class="lst">${items}</div></div><a onclick="switchPanel('${panel}')">${link} →</a></div>`;
    $('pcards').innerHTML =
      card('Pending payouts', wds.length?Math.round(pw.length/wds.length*100):0, '#f0a13a', lst(pw,w=>{ const u=userById(w.userId); return `<div class="pi"><i class="d" style="background:${w.amount*RATES[w.currency]>1000000?'#f0524f':'#f0a13a'}"></i><div>${u?u.firstName+' '+u.lastName:'—'}<span>${fmtMoney(w.amount,w.currency)} · ${ago(w.requestedAt)}</span></div></div>`; }), 'Open payouts','payouts') +
      card('KYC review queue', kycAll.length?Math.round(pk.length/kycAll.length*100):0, '#3d8bff', lst(pk,u=>`<div class="pi"><i class="d" style="background:#3d8bff"></i><div>${u.firstName} ${u.lastName}<span>${u.kyc.docType||'ID'} · ${ago(u.kyc.submittedAt)}</span></div></div>`), 'Open KYC review','kyc') +
      card('Risk flags', all?Math.round(flagged/all*100):0, '#f0524f', lst(flags,f=>`<div class="pi"><i class="d" style="background:#f0524f"></i><div>${f.kind}<span>${f.user.email}</span></div></div>`), 'Open risk monitor','risk');
    $('queueCount').textContent = queueItems().length + ' open items';
  }

  function renderRail(){
    const q = queueItems();
    $('railAlerts').innerHTML = q.length ? q.slice(0,5).map(r=>`<div class="ritem" onclick="switchPanel('${r.panel}')"><i class="ic" style="background:${r.hi?'#f0524f':'#f0a13a'}"></i><div><b>${r.item}</b><small>${r.who} · ${ago(r.date)} <span class="sevtxt ${r.hi?'c':'m'}">${r.hi?'Critical':'Medium'}</span></small></div></div>`).join('') : '<div class="empty"><b>All clear</b>No open alerts.</div>';
    const col = {deposit:'#4cc36b',withdrawal:'#f0a13a',invest:'#3d8bff'};
    const act = DB.state.activity.filter(a=>inRange(a.date,state.range)).slice(0,6);
    $('railAct').innerHTML = act.length ? act.map(a=>`<div class="ritem"><i class="ic" style="background:${col[a.kind]||'#c4c22a'}"></i><div><b style="text-transform:capitalize">${String(a.kind).replace('-',' ')}</b><small>${a.email||'—'} · ${ago(a.date)}<br>${a.detail}</small></div></div>`).join('') : '<div class="empty"><b>No activity</b>Nothing in this time window.</div>';
  }

  function auditRows(list){ return list.map(a=>`<tr><td class="mono">${stamp(a.date)}</td><td><span class="pill pill-neutral">${a.kind}</span></td><td>${a.email||'—'}</td><td>${a.detail}</td></tr>`).join(''); }

  function renderRegistry(){
    const q = ($('userSearch').value||'').toLowerCase(), f = $('regFilter').value;
    const list = DB.allUsers().filter(u=>{
      if(q && !(`${u.firstName} ${u.lastName} ${u.email} ${u.id}`).toLowerCase().includes(q)) return false;
      return f==='all' || (f==='active'&&!u.frozen) || (f==='frozen'&&u.frozen) || (f==='unverified'&&u.kyc.status!=='approved');
    });
    $('usersBody').innerHTML = list.length ? list.map(u=>`<tr style="cursor:pointer" onclick="openDrawer('${u.id}')"><td class="mono">${u.id}</td><td><b>${u.firstName} ${u.lastName}</b></td><td>${u.email}</td><td>${pill(u.kyc.status)}</td><td class="mono">${fmtN(walletNGN(u))}</td><td>${u.investments.length}</td><td>${pill(u.frozen?'frozen':'Active')}</td><td>${fmtDate(u.createdAt)}</td></tr>`).join('') : empty(8);
  }
  ['userSearch','regFilter'].forEach(id=> $(id).addEventListener('input', renderRegistry));

  function renderKYC(){
    const all = DB.allUsers().filter(u=>u.kyc.status!=='unsubmitted');
    const n = s => all.filter(u=>u.kyc.status===s).length;
    tabs('kycTabs',[['pending','Pending',n('pending')],['approved','Approved',n('approved')],['rejected','Rejected',n('rejected')],['all','All',all.length]], state.kyc, k=>state.kyc=k);
    const list = all.filter(u=> state.kyc==='all' || u.kyc.status===state.kyc);
    $('kycBody').innerHTML = list.length ? list.map(u=>`<tr><td class="mono">${caseId('KYC',u.id)}</td><td>${u.firstName} ${u.lastName}<br><span style="font-size:11.5px;color:var(--muted)">${u.email}</span></td><td>${u.kyc.docType||'—'}</td><td class="mono">${u.kyc.docNumber||'—'}</td><td>${u.kyc.submittedAt?stamp(u.kyc.submittedAt):'—'}</td><td>${pill(u.kyc.status)}</td><td><button class="btn ${u.kyc.status==='pending'?'btn-navy':'btn-outline'} btn-sm" onclick="openReview('kyc','${u.id}')">${u.kyc.status==='pending'?'Review':'View'}</button></td></tr>`).join('') : empty(7);
  }

  function renderPayouts(){
    const all = DB.allWithdrawals(); const n = s => all.filter(w=>w.status===s).length;
    tabs('wdTabs',[['Pending','Awaiting decision',n('Pending')],['Approved','Authorised',n('Approved')],['Rejected','Declined',n('Rejected')],['all','All',all.length]], state.wd, k=>state.wd=k);
    const list = all.filter(w=> state.wd==='all' || w.status===state.wd);
    $('wdBody').innerHTML = list.length ? list.map(w=>{ const u=userById(w.userId); return `<tr><td class="mono">${w.reference}</td><td>${u?u.firstName+' '+u.lastName:'—'}<br><span style="font-size:11.5px;color:var(--muted)">${u?u.email:''}</span></td><td class="mono"><b>${fmtMoney(w.amount,w.currency)}</b></td><td>${w.bank}<br><span class="mono" style="font-size:11.5px;color:var(--muted)">${w.accountNumber}</span></td><td>${stamp(w.requestedAt)}</td><td>${pill(w.status)}</td><td><button class="btn ${w.status==='Pending'?'btn-navy':'btn-outline'} btn-sm" onclick="openReview('wd','${w.id}')">${w.status==='Pending'?'Review':'View'}</button></td></tr>`; }).join('') : empty(7);
  }

  function renderRisk(){
    const f = DB.suspiciousActivity();
    $('riskBody').innerHTML = f.length ? f.map(x=>`<tr><td><span class="sev high">HIGH</span></td><td>${x.kind}</td><td>${x.user.firstName} ${x.user.lastName}<br><span style="font-size:11.5px;color:var(--muted)">${x.user.email}</span></td><td>${x.detail}</td><td><button class="btn btn-outline btn-sm" onclick="openDrawer('${x.user.id}')">Open file</button></td></tr>`).join('') : empty(5,'No active flags');
  }

  function renderAudit(){
    const kinds = [...new Set(DB.state.activity.map(a=>a.kind))];
    const cur = $('auditKind').value || 'all';
    $('auditKind').innerHTML = '<option value="all">All events</option>' + kinds.map(k=>`<option value="${k}" ${k===cur?'selected':''}>${k}</option>`).join('');
    const q = ($('auditSearch').value||'').toLowerCase();
    const list = DB.state.activity.filter(a=> (cur==='all'||a.kind===cur) && (!q || `${a.email||''} ${a.detail}`.toLowerCase().includes(q)));
    $('auditBody').innerHTML = list.length ? auditRows(list.slice(0,100)) : empty(4);
  }
  $('auditSearch').addEventListener('input', renderAudit); $('auditKind').addEventListener('change', renderAudit);

  // ----- user file drawer -----
  window.openDrawer = id => {
    const u = userById(id); if(!u) return;
    const inv = u.investments.filter(i=>i.status==='ACTIVE');
    $('drawer').innerHTML = `
      <div class="drawer-h"><div><h3>${u.firstName} ${u.lastName}</h3><small>${u.id} · ${pill(u.frozen?'frozen':'Active')}</small></div><button class="icon-btn" onclick="closeDrawer()">✕</button></div>
      <div class="drawer-s"><h4>Profile</h4><dl class="kv"><dt>Email</dt><dd>${u.email}</dd><dt>Phone</dt><dd>${u.phone||'—'}</dd><dt>Country</dt><dd>${u.country||'—'}</dd><dt>Registered</dt><dd>${fmtDate(u.createdAt)}</dd><dt>Referral code</dt><dd class="mono">${u.referralCode}</dd></dl></div>
      <div class="drawer-s"><h4>Verification</h4><dl class="kv"><dt>KYC status</dt><dd>${pill(u.kyc.status)}</dd><dt>Document</dt><dd>${u.kyc.docType||'—'} ${u.kyc.docNumber||''}</dd><dt>Bank accounts</dt><dd>${u.bankAccounts.length}</dd></dl></div>
      <div class="drawer-s"><h4>Holdings</h4><dl class="kv">${Object.keys(u.wallets).map(c=>`<dt>${c}</dt><dd class="mono">${fmtMoney(u.wallets[c].balance,c)} <span style="color:var(--muted)">(locked ${fmtMoney(u.wallets[c].locked,c)})</span></dd>`).join('')}<dt>Active plans</dt><dd>${inv.length}</dd></dl></div>
      <div class="drawer-s"><h4>Recent transactions</h4><table style="min-width:0;font-size:12.5px;"><tbody>${u.transactions.slice(0,8).map(t=>`<tr><td style="padding:8px 0">${t.type}<br><span class="mono" style="color:var(--muted);font-size:11px">${fmtDate(t.date)}</span></td><td style="padding:8px 0;text-align:right" class="mono">${fmtMoney(t.amount,t.currency)}<br>${pill(t.status)}</td></tr>`).join('') || '<tr><td>None</td></tr>'}</tbody></table></div>
      <div class="drawer-s"><h4>Account control</h4><button class="btn ${u.frozen?'btn-emerald':'btn-coral'}" onclick="toggleFreeze('${u.id}',${!u.frozen})">${u.frozen?'Reinstate account':'Freeze account'}</button></div>`;
    $('drawer').classList.add('open'); $('drawerBg').classList.add('open');
  };
  window.closeDrawer = ()=>{ $('drawer').classList.remove('open'); $('drawerBg').classList.remove('open'); };
  $('drawerBg').addEventListener('click', closeDrawer);
  window.toggleFreeze = (id,val)=>{ if(!confirm(val?'Freeze this account? The user will be unable to log in.':'Reinstate this account?')) return; DB.toggleFreeze(id,val); toast(val?'Account frozen':'Account reinstated','ok'); closeDrawer(); renderAll(); };

  // ----- review modal (KYC + payouts) -----
  window.closeModal = id => $(id).classList.remove('open');
  window.openReview = (kind,id)=>{
    let head, rows, canAct, noteLabel, yes, no;
    if(kind==='kyc'){
      const u = userById(id); canAct = u.kyc.status==='pending';
      head = `KYC case ${caseId('KYC',u.id)}`;
      rows = [['Applicant',`${u.firstName} ${u.lastName}`],['Email',u.email],['Document',u.kyc.docType||'—'],['Doc. number',u.kyc.docNumber||'—'],['Submitted',u.kyc.submittedAt?stamp(u.kyc.submittedAt):'—'],['Status',pill(u.kyc.status)],['Decision note',u.kyc.reason||'—']];
      noteLabel='Reason (required to reject)'; yes='Approve verification'; no='Reject';
    } else {
      const w = DB.allWithdrawals().find(x=>x.id===id), u = userById(w.userId); canAct = w.status==='Pending';
      head = `Payout ${w.reference}`;
      rows = [['Account holder',`${u.firstName} ${u.lastName}`],['Email',u.email],['KYC status',pill(u.kyc.status)],['Amount',`<b>${fmtMoney(w.amount,w.currency)}</b>`],['Bank',w.bank],['Account',`${w.accountName} · ${w.accountNumber}`],['Requested',stamp(w.requestedAt)],['Status',pill(w.status)],['Decision note',w.note||'—']];
      noteLabel='Note (optional)'; yes='Authorise payout'; no='Decline';
    }
    $('reviewBox').innerHTML = `<div class="modal-head"><h3 style="margin:0;font-size:16px;">${head}</h3><button class="icon-btn" onclick="closeModal('reviewModal')">✕</button></div>
      <div class="modal-body"><dl class="kv" style="grid-template-columns:120px 1fr;">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${canAct?`<div class="field" style="margin:18px 0 0;"><label>${noteLabel}</label><textarea id="rvNote" rows="2"></textarea></div>`:''}</div>
      <div class="modal-foot"><button class="btn btn-outline" onclick="closeModal('reviewModal')">Close</button>${canAct?`<button class="btn btn-coral" onclick="decide('${kind}','${id}',false)">${no}</button><button class="btn btn-emerald" onclick="decide('${kind}','${id}',true)">${yes}</button>`:''}</div>`;
    $('reviewModal').classList.add('open');
  };
  window.decide = (kind,id,ok)=>{
    const note = ($('rvNote')||{}).value ? $('rvNote').value.trim() : '';
    if(kind==='kyc'){ if(!ok && !note){ toast('A reason is required to reject','err'); return; } DB.reviewKYC(id, ok, note); }
    else DB.reviewWithdrawal(id, ok, note);
    toast(ok?'Decision recorded: approved':'Decision recorded: declined','ok'); closeModal('reviewModal'); renderAll();
  };
  $('reviewModal').addEventListener('click', e=>{ if(e.target===$('reviewModal')) closeModal('reviewModal'); });

  // ----- exports -----
  $('exUsers').onclick = ()=>{ downloadCSV('reign-user-registry.csv', DB.exportUsersCSV()); toast('Report downloaded','ok'); };
  $('exWd').onclick = ()=>{ downloadCSV('reign-payout-ledger.csv', DB.exportWithdrawalsCSV()); toast('Report downloaded','ok'); };
  $('exAudit').onclick = ()=>{
    const rows = [['Timestamp','Event','Subject','Detail'], ...DB.state.activity.map(a=>[a.date,a.kind,a.email||'',a.detail])];
    downloadCSV('reign-audit-log.csv', rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')); toast('Report downloaded','ok');
  };

  switchPanel('overview');
}
