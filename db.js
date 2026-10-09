/* =========================================================
   REIGN — mock data layer
   Everything here simulates a backend using localStorage so
   the whole prototype runs as a static site. Swap DB.* calls
   for real API calls when wiring up a server.
   ========================================================= */

const DB_KEY = 'reign_db_v1';
const SESSION_KEY = 'reign_session_v1';

const PLANS = [
  { id: 'bronze',   name: 'Bronze',   roi: 15, days: 21, min: 2000,    max: 499999 },
  { id: 'silver',   name: 'Silver',   roi: 22, days: 30, min: 500000,  max: 1999999 },
  { id: 'gold',     name: 'Gold',     roi: 30, days: 45, min: 2000000, max: 9999999 },
  { id: 'platinum', name: 'Platinum', roi: 40, days: 60, min: 10000000, max: 100000000 },
];

const RATES = { NGN: 1, USD: 1361.5997798, USDT: 1360.41, BTC: 86638594 };
const BANKS = ['Access Bank','GTBank','Zenith Bank','UBA','First Bank','Standard Chartered Bank','Kuda Bank','Moniepoint MFB','Opay','Wema Bank'];

function uid(prefix){ return prefix + '-' + Math.random().toString(16).slice(2, 8).toUpperCase(); }
function refId(prefix){
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  return `${prefix}-${stamp}-${Math.random().toString(16).slice(2,8).toUpperCase()}`;
}
function fmtMoney(n, ccy='NGN'){
  const symbols = { NGN:'₦', USD:'$', USDT:'₮', BTC:'₿' };
  const digits = ccy === 'BTC' ? 6 : 2;
  const v = Number(n||0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${symbols[ccy]||''}${v}`;
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function daysBetween(a,b){ return Math.max(0,(new Date(b)-new Date(a))/86400000); }

function emptySeed(){
  return { users: [], withdrawals: [], activity: [], nextNotifId: 1 };
}

function loadDB(){
  let raw = localStorage.getItem(DB_KEY);
  if(!raw){
    const seed = emptySeed();
    seedAdmin(seed);
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw); } catch(e){ const seed = emptySeed(); seedAdmin(seed); return seed; }
}
function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function seedAdmin(seed){
  seed.users.push({
    id: uid('U'), role: 'admin',
    firstName: 'Reign', lastName: 'Admin', middleName: '',
    email: 'admin@reign.com', phone: '', password: 'Admin123!',
    dob: '', gender: '', maritalStatus: '', country:'Nigeria', state:'', city:'', address:'', postalCode:'',
    referralCode: 'REIGN-ADMIN', referredBy: null,
    frozen: false, createdAt: new Date().toISOString(),
    kyc: { status: 'none' }, bankAccounts: [],
    wallets: { NGN:{balance:0,locked:0}, USD:{balance:0,locked:0}, USDT:{balance:0,locked:0}, BTC:{balance:0,locked:0} },
    investments: [], transactions: [], notifications: [], twoFA: false,
  });
}

const DB = {
  state: loadDB(),
  persist(){ saveDB(this.state); },

  // ---------- auth ----------
  findByEmail(email){
    return this.state.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  },
  register({firstName,lastName,email,phone,password,referredBy}){
    if(this.findByEmail(email)) throw new Error('An account with this email already exists.');
    const user = {
      id: uid('U'), role: 'user',
      firstName, lastName, middleName:'',
      email, phone, password,
      dob:'', gender:'', maritalStatus:'', country:'Nigeria', state:'', city:'', address:'', postalCode:'',
      referralCode: 'RGN-' + Math.random().toString(36).slice(2,7).toUpperCase(),
      referredBy: referredBy || null,
      frozen:false, createdAt: new Date().toISOString(),
      kyc: { status: 'unsubmitted' }, bankAccounts: [],
      wallets: { NGN:{balance:500000,locked:0}, USD:{balance:0,locked:0}, USDT:{balance:0,locked:0}, BTC:{balance:0,locked:0} },
      investments: [], transactions: [], notifications: [], twoFA:false,
    };
    this.pushTx(user, { type:'Deposit', currency:'NGN', amount:500000, status:'Success', note:'Welcome bonus credit' });
    this.pushNotif(user, 'Welcome to Reign', 'Your account was created with a starter balance of ₦500,000.00 (demo funds).');
    this.state.users.push(user);
    this.persist();
    return user;
  },
  login(email, password){
    const u = this.findByEmail(email);
    if(!u) throw new Error('No account found with that email.');
    if(u.password !== password) throw new Error('Incorrect password.');
    if(u.frozen) throw new Error('This account has been frozen. Contact support.');
    localStorage.setItem(SESSION_KEY, u.id);
    return u;
  },
  logout(){ localStorage.removeItem(SESSION_KEY); },
  currentUser(){
    const id = localStorage.getItem(SESSION_KEY);
    if(!id) return null;
    return this.state.users.find(u => u.id === id) || null;
  },
  resetPassword(email, newPassword){
    const u = this.findByEmail(email);
    if(!u) throw new Error('No account found with that email.');
    u.password = newPassword;
    this.persist();
  },
  updatePassword(user, current, next){
    if(user.password !== current) throw new Error('Current password is incorrect.');
    user.password = next;
    this.pushNotif(user, 'Password updated', 'Your account password was changed successfully.');
    this.persist();
  },

  // ---------- wallet / tx / notif helpers ----------
  pushTx(user, tx){
    user.transactions.unshift({ id: uid('T'), reference: refId('TXN'), date: new Date().toISOString(), ...tx });
  },
  pushNotif(user, title, body){
    user.notifications.unshift({ id: this.state.nextNotifId++, title, body, date: new Date().toISOString(), read:false });
  },
  logActivity(entry){
    this.state.activity.unshift({ id: uid('A'), date: new Date().toISOString(), ...entry });
    this.state.activity = this.state.activity.slice(0, 300);
  },

  fund(user, currency, amount){
    amount = Number(amount);
    user.wallets[currency].balance += amount;
    this.pushTx(user, { type:'Deposit', currency, amount, status:'Success', note:'Wallet funding' });
    this.pushNotif(user, 'Deposit successful', `${fmtMoney(amount, currency)} was added to your ${currency} wallet.`);
    this.logActivity({ userId:user.id, email:user.email, kind:'deposit', detail:`${fmtMoney(amount,currency)} funded to ${currency} wallet` });
    this.persist();
  },
  convert(user, from, to, amount){
    amount = Number(amount);
    if(user.wallets[from].balance < amount) throw new Error('Insufficient balance to convert.');
    const usdValue = amount * RATES[from];
    const toAmount = usdValue / RATES[to];
    user.wallets[from].balance -= amount;
    user.wallets[to].balance += toAmount;
    this.pushTx(user, { type:'Convert', currency:from, amount, status:'Success', note:`Converted to ${fmtMoney(toAmount,to)} ${to}` });
    this.pushNotif(user, 'Conversion complete', `Converted ${fmtMoney(amount,from)} ${from} to ${fmtMoney(toAmount,to)} ${to}.`);
    this.persist();
    return toAmount;
  },
  invest(user, planId, walletCcy, amount){
    const plan = PLANS.find(p=>p.id===planId);
    amount = Number(amount);
    const w = user.wallets[walletCcy];
    if(amount < plan.min) throw new Error(`Minimum for ${plan.name} is ${fmtMoney(plan.min, walletCcy)}.`);
    if(amount > w.balance) throw new Error('Insufficient available balance.');
    w.balance -= amount; w.locked += amount;
    const inv = {
      id: uid('I'), reference: refId('INV'), plan: plan.name, planId, currency: walletCcy,
      principal: amount, roi: plan.roi, days: plan.days,
      startDate: new Date().toISOString(),
      maturityDate: new Date(Date.now() + plan.days*86400000).toISOString(),
      status: 'ACTIVE',
    };
    user.investments.unshift(inv);
    this.pushTx(user, { type:'Investment', currency:walletCcy, amount, status:'Success', note:`${plan.name} plan` });
    this.pushNotif(user, 'Investment started', `${fmtMoney(amount, walletCcy)} invested in the ${plan.name} plan.`);
    this.logActivity({ userId:user.id, email:user.email, kind:'invest', detail:`${fmtMoney(amount,walletCcy)} into ${plan.name}` });
    this.persist();
    return inv;
  },
  investmentValue(inv){
    const elapsed = daysBetween(inv.startDate, new Date().toISOString());
    const pct = Math.min(1, elapsed / inv.days);
    const profit = inv.principal * (inv.roi/100) * pct;
    return { current: inv.principal + profit, pct: Math.round(pct*1000)/10, profit };
  },
  requestWithdrawal(user, currency, amount, bankAccountId){
    amount = Number(amount);
    if(user.kyc.status !== 'approved') throw new Error('Complete KYC verification before withdrawing.');
    if(user.wallets[currency].balance < amount) throw new Error('Insufficient available balance.');
    const bank = user.bankAccounts.find(b=>b.id===bankAccountId);
    if(!bank) throw new Error('Select a bank account.');
    user.wallets[currency].balance -= amount;
    user.wallets[currency].locked += amount;
    const w = {
      id: uid('W'), reference: refId('WDL'), userId:user.id, currency, amount,
      bank: bank.bank, accountNumber: bank.accountNumber, accountName: bank.accountName,
      status: 'Pending', requestedAt: new Date().toISOString(), reviewedAt:null, note:'',
    };
    this.state.withdrawals.unshift(w);
    this.pushTx(user, { type:'Withdrawal', currency, amount, status:'Pending', note:`To ${bank.bank} •••${bank.accountNumber.slice(-4)}` });
    this.pushNotif(user, 'Withdrawal requested', `${fmtMoney(amount,currency)} withdrawal is pending review.`);
    this.logActivity({ userId:user.id, email:user.email, kind:'withdrawal', detail:`${fmtMoney(amount,currency)} requested`, flag: amount > 1000000 ? 'high-value' : null });
    this.persist();
    return w;
  },
  reviewWithdrawal(withdrawalId, approve, note){
    const w = this.state.withdrawals.find(x=>x.id===withdrawalId);
    const user = this.state.users.find(u=>u.id===w.userId);
    w.status = approve ? 'Approved' : 'Rejected';
    w.reviewedAt = new Date().toISOString();
    w.note = note || '';
    user.wallets[w.currency].locked -= w.amount;
    if(!approve) user.wallets[w.currency].balance += w.amount;
    const tx = user.transactions.find(t=>t.note && t.note.includes(w.reference)) || user.transactions.find(t=>t.type==='Withdrawal' && t.status==='Pending');
    if(tx) tx.status = w.status;
    this.pushNotif(user, `Withdrawal ${w.status.toLowerCase()}`, `Your ${fmtMoney(w.amount,w.currency)} withdrawal was ${w.status.toLowerCase()}${note ? ': '+note : '.'}`);
    this.logActivity({ userId:user.id, email:user.email, kind:'withdrawal-review', detail:`${w.reference} ${w.status}` });
    this.persist();
  },
  addBankAccount(user, acc){
    const account = { id: uid('B'), default: user.bankAccounts.length===0, ...acc };
    if(acc.default) user.bankAccounts.forEach(b=>b.default=false);
    user.bankAccounts.push(account);
    this.persist();
    return account;
  },
  setDefaultBank(user, id){
    user.bankAccounts.forEach(b=>b.default = (b.id===id));
    this.persist();
  },
  deleteBankAccount(user, id){
    user.bankAccounts = user.bankAccounts.filter(b=>b.id!==id);
    this.persist();
  },
  submitKYC(user, payload){
    user.kyc = { status:'pending', docType: payload.docType, docNumber: payload.docNumber, submittedAt: new Date().toISOString(), reason:'' };
    this.pushNotif(user, 'KYC submitted', 'Your identity documents were submitted for review.');
    this.logActivity({ userId:user.id, email:user.email, kind:'kyc', detail:'KYC submitted for review' });
    this.persist();
  },
  reviewKYC(userId, approve, reason){
    const user = this.state.users.find(u=>u.id===userId);
    user.kyc.status = approve ? 'approved' : 'rejected';
    user.kyc.reviewedAt = new Date().toISOString();
    user.kyc.reason = approve ? '' : (reason || 'Rejected by administrator.');
    this.pushNotif(user, `KYC ${user.kyc.status}`, approve ? 'Your identity has been verified. All features are unlocked.' : `Verification requires attention: ${user.kyc.reason}`);
    this.logActivity({ userId:user.id, email:user.email, kind:'kyc-review', detail:`KYC ${user.kyc.status}` });
    this.persist();
  },
  toggleFreeze(userId, frozen){
    const user = this.state.users.find(u=>u.id===userId);
    user.frozen = frozen;
    this.pushNotif(user, frozen ? 'Account frozen' : 'Account reinstated', frozen ? 'Your account has been frozen by an administrator.' : 'Your account access has been restored.');
    this.logActivity({ userId:user.id, email:user.email, kind:'freeze', detail: frozen ? 'Account frozen' : 'Account unfrozen' });
    this.persist();
  },
  saveProfile(user, patch){
    Object.assign(user, patch);
    this.persist();
  },

  profileCompletion(user){
    const fields = [user.firstName,user.lastName,user.email,user.phone,user.dob,user.gender,user.maritalStatus,user.postalCode,user.country,user.state,user.city,user.address,user.bankAccounts.length?1:0,user.kyc.status==='approved'?1:0];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled/fields.length)*100);
  },

  // ---------- admin aggregates ----------
  allUsers(){ return this.state.users.filter(u=>u.role!=='admin'); },
  pendingKYC(){ return this.allUsers().filter(u=>u.kyc.status==='pending'); },
  allWithdrawals(){ return this.state.withdrawals; },
  pendingWithdrawals(){ return this.state.withdrawals.filter(w=>w.status==='Pending'); },
  suspiciousActivity(){
    // Simple heuristics for a demo "monitor": large withdrawals, rapid repeat requests, unverified large investments
    const flags = [];
    this.allUsers().forEach(u=>{
      const bigWithdrawals = this.state.withdrawals.filter(w=>w.userId===u.id && w.amount > 1000000);
      bigWithdrawals.forEach(w=> flags.push({ user:u, kind:'Large withdrawal', detail:`${fmtMoney(w.amount,w.currency)} requested`, date:w.requestedAt }));
      const recentWithdrawals = this.state.withdrawals.filter(w=>w.userId===u.id && daysBetween(w.requestedAt, new Date().toISOString()) < 1);
      if(recentWithdrawals.length >= 3) flags.push({ user:u, kind:'Rapid withdrawals', detail:`${recentWithdrawals.length} requests in 24h`, date:new Date().toISOString() });
      if(u.kyc.status !== 'approved' && u.investments.some(i=>i.principal > 1000000)) flags.push({ user:u, kind:'Unverified large investment', detail:'Investment > ₦1,000,000 without approved KYC', date:new Date().toISOString() });
    });
    return flags.sort((a,b)=> new Date(b.date)-new Date(a.date));
  },
  platformTotals(){
    const users = this.allUsers();
    let totalDeposits=0, totalInvested=0, totalWithdrawn=0;
    users.forEach(u=>{
      u.transactions.forEach(t=>{
        if(t.type==='Deposit') totalDeposits += t.amount * (RATES[t.currency]/RATES.NGN);
        if(t.type==='Investment') totalInvested += t.amount * (RATES[t.currency]/RATES.NGN);
        if(t.type==='Withdrawal' && t.status==='Success') totalWithdrawn += t.amount * (RATES[t.currency]/RATES.NGN);
      });
    });
    return { users: users.length, totalDeposits, totalInvested, totalWithdrawn, pendingKYC: this.pendingKYC().length, pendingWithdrawals: this.pendingWithdrawals().length };
  },
  exportUsersCSV(){
    const rows = [['Name','Email','Phone','KYC Status','Frozen','NGN Balance','Investments','Joined']];
    this.allUsers().forEach(u=>{
      rows.push([`${u.firstName} ${u.lastName}`, u.email, u.phone, u.kyc.status, u.frozen?'Yes':'No', u.wallets.NGN.balance, u.investments.length, fmtDate(u.createdAt)]);
    });
    return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  },
  exportWithdrawalsCSV(){
    const rows = [['Reference','User','Currency','Amount','Bank','Account','Status','Requested']];
    this.state.withdrawals.forEach(w=>{
      const user = this.state.users.find(u=>u.id===w.userId);
      rows.push([w.reference, user?user.email:w.userId, w.currency, w.amount, w.bank, w.accountNumber, w.status, fmtDate(w.requestedAt)]);
    });
    return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  },
};

function downloadCSV(filename, csv){
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function toast(msg, kind=''){
  let host = document.getElementById('toast-host');
  if(!host){ host = document.createElement('div'); host.id='toast-host'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' '+kind : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(16px)'; el.style.transition='.2s'; setTimeout(()=>el.remove(),200); }, 3200);
}

function requireAuth(){
  const u = DB.currentUser();
  if(!u){ window.location.href = 'login.html'; return null; }
  if(u.role === 'admin'){ window.location.href = 'admindash.html'; return null; }
  return u;
}
function requireAdmin(){
  const u = DB.currentUser();
  if(!u || u.role !== 'admin'){ window.location.href = 'login.html'; return null; }
  return u;
}
function initials(u){ return (u.firstName?.[0]||'').toUpperCase() + (u.lastName?.[0]||'').toUpperCase(); }
