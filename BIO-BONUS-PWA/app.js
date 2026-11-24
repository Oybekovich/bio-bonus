(() => {
  'use strict';
  const I = window.I18N;
  const t = (key, vars) => I.t(key, vars);

  const STORAGE_KEY = 'bioBonusApp_v3';
  const PREVIOUS_STORAGE_KEY = 'bioBonusApp_v2';
  const LEGACY_KEY = 'bioBonusDemo_v1';
  const RATE_PER_KG = 200;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const FIRST_BLOCK_DAYS = 3;
  const NEXT_BLOCK_DAYS = 7;
  const MIN_WITHDRAW = 100;
  const DEMO_READINGS = [2.4, 1.8, 3.1, 0.9, 4.2, 1.5];
  const CONTAMINANT_KEYS = ['plastic', 'metal', 'stone', 'bottle', 'glass'];
  // Eko-ta’sir uchun taxminiy koeffitsiyentlar (1 kg organik chiqindiga). 2,5 kg chiqindidan 1 kg o‘g‘it olinadi.
  const ECO = { compost: 1 / 2.5, co2: 0.8, kwh: 0.225, compostPerTree: 2 };
  const CARD_SYSTEMS = {
    uzcard: { name: 'UZCARD', prefix: '8600' },
    humo: { name: 'HUMO', prefix: '9860' }
  };
  // Reyting uchun namuna (demo) ishtirokchilar
  const DEMO_LEADERS = [
    { name: 'Dilnoza Karimova', kg: 312.4 },
    { name: 'Azizbek Rahimov', kg: 248.0 },
    { name: 'Madina Olimova', kg: 194.5 },
    { name: 'Jamshid Po‘latov', kg: 142.1 },
    { name: 'Nodira Yusupova', kg: 128.6 },
    { name: 'Bekzod Tursunov', kg: 117.3 },
    { name: 'Gulnora Saidova', kg: 98.4 },
    { name: 'Sardor Aliyev', kg: 86.9 },
    { name: 'Malika Ergasheva', kg: 74.2 },
    { name: 'Otabek Nazarov', kg: 61.5 }
  ];
  const rewards = [
    { id: 'seeds', price: 2000, emoji: '🌻' },
    { id: 'compost', price: 5000, emoji: '🌱' },
    { id: 'shop', price: 10000, emoji: '🛍️' },
    { id: 'utility', price: 20000, emoji: '🏠' },
    { id: 'tree', price: 15000, emoji: '🌳' },
    { id: 'eco', price: 8000, emoji: '♻️' }
  ];

  const $ = id => document.getElementById(id);
  // O‘zbek tili uchun brauzerlarda Intl ma’lumotlari to‘liq emas, shuning uchun sonlar va sanalar qo‘lda formatlanadi
  const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const UZ_DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
  const isUz = () => I.getLang() === 'uz';
  const numLocale = () => (isUz() ? 'en-US' : I.locale());
  const uzGroup = text => (isUz() ? text.replace(/,/g, '\u00a0') : text);
  const pad2 = n => String(n).padStart(2, '0');
  const num = value => uzGroup(new Intl.NumberFormat(numLocale()).format(Math.round(Number(value) || 0)));
  const money = value => `${num(value)} ${t('cur')}`;
  const decimal = (value, digits) => uzGroup(new Intl.NumberFormat(numLocale(), { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(Number(value) || 0));
  const kgText = value => `${decimal(Math.round((Number(value) || 0) * 10) / 10, 1)} ${t('kg')}`;
  const ecoNumber = value => (value < 10 ? decimal(Math.round(value * 10) / 10, 1) : num(value));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const validNumber = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const makeTransactionId = () => `BB-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  const digitsOnly = value => String(value || '').replace(/\D/g, '');
  const formatCard = digits => digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  const formatPhone = phone => (phone && phone.length === 12 ? `+998 ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}` : '');
  const displayName = account => (account.name && account.name !== 'Do‘st' ? account.name : t('defaultName'));

  let pendingReward = null;
  let pendingScan = null;
  let scanTimer = null;
  let toastTimer = null;
  let currentPage = 'home';
  let previousPage = 'home';
  let unlockTimer = null;
  let pendingDemoIndex = 0;
  let wdSystem = 'uzcard';

  /* ---------- Akkauntlar va saqlash ---------- */
  function randomAccountId(existing) {
    for (let tries = 0; tries < 500; tries++) {
      const bytes = new Uint32Array(1);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
      else bytes[0] = Math.floor(Math.random() * 0xffffffff);
      const candidate = String(10000000 + (bytes[0] % 90000000));
      if (!existing.has(candidate)) return candidate;
    }
    throw new Error(t('toast.accFail'));
  }
  function newAccount(name, existing) {
    const id = randomAccountId(existing);
    existing.add(id);
    return {
      id, name: (name || 'Do‘st').trim() || 'Do‘st', balance: 0, totalKg: 0, totalEarned: 0, depositCount: 0,
      phone: '', history: [], redemptions: [], withdrawals: [], notifications: [], lastCard: null,
      contaminationStreak: 0, blockCount: 0, blockedUntil: null
    };
  }
  // Oxirgi topshirish begona chiqindi bo‘lib, undan keyin toza topshirish bo‘lmaganmi?
  function streakFromHistory(history) {
    const relevant = history.filter(x => ['deposit', 'blockedDeposit', 'contamination'].includes(x.type))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = relevant[0];
    return last && last.type === 'contamination' && last.level === 'warning' ? 1 : 0;
  }
  function normalizeAccount(raw, existing) {
    const id = /^[0-9]{8}$/.test(String(raw.id || '')) && !existing.has(String(raw.id)) ? String(raw.id) : randomAccountId(existing);
    existing.add(id);
    const history = Array.isArray(raw.history) ? raw.history : [];
    const oldStep = Math.floor(validNumber(raw.violationStep));
    let lastCard = null;
    if (raw.lastCard && /^[0-9]{4}$/.test(String(raw.lastCard.last4 || ''))) {
      lastCard = { system: CARD_SYSTEMS[raw.lastCard.system] ? raw.lastCard.system : '', last4: String(raw.lastCard.last4) };
    } else if (/^[0-9]{4}$/.test(String(raw.cardLast4 || ''))) {
      lastCard = { system: '', last4: String(raw.cardLast4) };
    }
    return {
      id,
      name: String(raw.name || 'Do‘st').slice(0, 35),
      phone: /^998[0-9]{9}$/.test(String(raw.phone || '')) ? String(raw.phone) : '',
      balance: validNumber(raw.balance), totalKg: validNumber(raw.totalKg),
      totalEarned: validNumber(raw.totalEarned), depositCount: validNumber(raw.depositCount),
      history,
      redemptions: Array.isArray(raw.redemptions) ? raw.redemptions : [],
      withdrawals: Array.isArray(raw.withdrawals) ? raw.withdrawals : [],
      notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
      lastCard,
      contaminationStreak: raw.contaminationStreak !== undefined ? (Number(raw.contaminationStreak) > 0 ? 1 : 0) : streakFromHistory(history),
      blockCount: raw.blockCount !== undefined ? Math.floor(validNumber(raw.blockCount)) : (oldStep >= 4 ? 2 : oldStep >= 2 ? 1 : 0),
      blockedUntil: raw.blockedUntil && !Number.isNaN(new Date(raw.blockedUntil).getTime()) ? String(raw.blockedUntil) : null
    };
  }
  function createDefaultData() {
    const ids = new Set();
    const account = newAccount('Do‘st', ids);
    return { accounts: [account], currentAccountId: account.id, loggedIn: false };
  }
  function fromParsed(parsed) {
    if (!parsed || !Array.isArray(parsed.accounts)) return null;
    const ids = new Set();
    const accounts = parsed.accounts.filter(a => a && typeof a === 'object').map(a => normalizeAccount(a, ids));
    if (!accounts.length) return null;
    const current = accounts.some(a => a.id === String(parsed.currentAccountId)) ? String(parsed.currentAccountId) : accounts[0].id;
    // Bitta telefon raqam faqat bitta akkauntga tegishli bo‘lsin
    const seenPhones = new Set();
    accounts.forEach(a => { if (a.phone) { if (seenPhones.has(a.phone)) a.phone = ''; else seenPhones.add(a.phone); } });
    return { accounts, currentAccountId: current, loggedIn: parsed.loggedIn === true };
  }
  function migrateLegacy() {
    try {
      const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (!old || typeof old !== 'object') return null;
      const data = createDefaultData();
      const a = data.accounts[0];
      a.name = String(old.name || 'Do‘st').slice(0, 35);
      const oldHistory = Array.isArray(old.history) ? old.history : [];
      a.history = oldHistory.map(item => {
        if (item.type === 'deposit') { const kg = Math.round(validNumber(item.kg) * 10) / 10; return { ...item, kg, amount: Math.round(kg * RATE_PER_KG) }; }
        return item;
      });
      const deposits = a.history.filter(x => x.type === 'deposit');
      a.totalKg = Math.round(deposits.reduce((s, x) => s + validNumber(x.kg), 0) * 10) / 10;
      a.totalEarned = deposits.reduce((s, x) => s + validNumber(x.amount), 0);
      a.depositCount = deposits.length;
      a.balance = Math.max(0, a.totalEarned - a.history.filter(x => x.type === 'redeem' || x.type === 'withdrawal').reduce((s, x) => s + validNumber(x.amount), 0));
      a.redemptions = Array.isArray(old.redemptions) ? old.redemptions : [];
      return data;
    } catch (error) { console.warn('Eski demo ma’lumot ko‘chirilmadi:', error); return null; }
  }
  function loadData() {
    for (const key of [STORAGE_KEY, PREVIOUS_STORAGE_KEY]) {
      try { const data = fromParsed(JSON.parse(localStorage.getItem(key) || 'null')); if (data) return data; }
      catch (error) { console.warn('Saqlangan ma’lumot o‘qilmadi:', error); }
    }
    return migrateLegacy() || createDefaultData();
  }
  let appData = loadData();
  function saveData() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch (error) { console.error(error); showToast(t('toast.saveFail')); } }
  function currentAccount() { return appData.accounts.find(a => a.id === appData.currentAccountId) || appData.accounts[0]; }
  function findAccount(id) { return appData.accounts.find(a => a.id === String(id)); }

  /* ---------- Yordamchi UI ---------- */
  function showToast(message) {
    const node = $('toast'); if (!node) return;
    node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3600);
  }
  window.showBioToast = showToast;
  function formatDate(value) {
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '—';
    if (isUz()) return `${d.getDate()}-${UZ_MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return new Intl.DateTimeFormat(I.locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  }
  function formatUntil(value) {
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    if (isUz()) return `${d.getFullYear()}-yil ${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return new Intl.DateTimeFormat(I.locale(), { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  }
  function openModal(id) { $(id).classList.add('show'); }
  function closeModal(id) {
    if (id === 'kioskModal' && pendingScan) routePendingAfterTimeout();
    $(id).classList.remove('show');
  }
  function navigate(page, fromBack = false) {
    if (!$(`screen-${page}`)) return;
    if (page !== currentPage && !fromBack) previousPage = currentPage;
    currentPage = page;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${page}`));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    if (page === 'account') renderAccount();
    if (page === 'warnings') renderWarnings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function goBack() { navigate(previousPage && previousPage !== currentPage ? previousPage : 'home', true); }
  async function copyText(text, okMessage) {
    try { await navigator.clipboard.writeText(text); showToast(okMessage); }
    catch (error) {
      const field = document.createElement('textarea'); field.value = text; document.body.appendChild(field); field.select();
      try { document.execCommand('copy'); showToast(okMessage); } catch (e) { showToast(t('toast.yourId', { id: text })); }
      field.remove();
    }
  }

  /* ---------- Blok va ogohlantirish qoidalari ---------- */
  function isBlocked(account) { return Boolean(account.blockedUntil && new Date(account.blockedUntil).getTime() > Date.now()); }
  function nextBlockDays(account) { return account.blockCount > 0 ? NEXT_BLOCK_DAYS : FIRST_BLOCK_DAYS; }
  function itemName(key, fallback) { return CONTAMINANT_KEYS.includes(key) ? t(`item.${key}`) : (fallback || t('item.unknown')); }
  function scheduleUnlockRefresh() {
    if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
    const account = currentAccount();
    if (!isBlocked(account)) return;
    const remaining = new Date(account.blockedUntil).getTime() - Date.now() + 150;
    unlockTimer = setTimeout(() => {
      if (isBlocked(currentAccount())) scheduleUnlockRefresh();
      else { render(); showToast(t('toast.unlocked')); }
    }, Math.min(Math.max(remaining, 150), 2147483000));
  }
  function blockedBalanceMessage(account) { return t('blockedBalance', { amount: money(account.balance), date: formatUntil(account.blockedUntil) }); }

  /*
    QOIDA:
    • Begona chiqindi aniqlanganda, agar oldingi topshirish ham begona chiqindi bo‘lib, ogohlantirish berilgan bo‘lsa
      (ya’ni oraliqda toza chiqindi topshirilmagan) — blok: birinchi blok 3 kun, keyingilari 7 kun.
    • Aks holda (birinchi marta yoki ogohlantirishdan keyin toza topshirishlar bo‘lgan bo‘lsa) — faqat ogohlantirish.
    • Toza organik topshirish ogohlantirish holatini tiklaydi (contaminationStreak = 0).
    • Blok qo‘llangach ham holat yangidan boshlanadi.
  */
  function applyContamination(account, itemKey, scanId) {
    const date = new Date().toISOString();
    if (isBlocked(account)) {
      account.history.push({ id: scanId, type: 'contamination', amount: 0, itemKey, date, level: 'block' });
      return { kind: 'alreadyBlocked' };
    }
    let notification;
    if (account.contaminationStreak > 0) {
      const days = nextBlockDays(account);
      const until = new Date(Date.now() + days * DAY_MS).toISOString();
      account.blockCount += 1;
      account.blockedUntil = until;
      account.contaminationStreak = 0;
      notification = { v: 2, level: 'block', variant: 'block', itemKey, days, blockedUntil: until };
    } else {
      const hadWarnings = account.notifications.length > 0;
      account.contaminationStreak = 1;
      notification = { v: 2, level: 'warning', variant: hadWarnings ? 'again' : 'first', itemKey, days: nextBlockDays(account), blockedUntil: null };
    }
    account.notifications.unshift({ id: makeTransactionId(), date, read: false, ...notification });
    account.history.push({ id: scanId, type: 'contamination', amount: 0, itemKey, date, level: notification.level });
    return { kind: notification.level, days: notification.days };
  }
  function notificationText(n) {
    if (n.v === 2) {
      const vars = { item: itemName(n.itemKey), days: n.days };
      return { title: t(`n.${n.variant}.title`, vars), message: t(`n.${n.variant}.msg`, vars), item: itemName(n.itemKey) };
    }
    return { title: n.title || t('warn.badgeWarn'), message: n.message || '', item: n.items || '' };
  }

  /* ---------- Render ---------- */
  function renderHistory(target, limit, account) {
    const entries = account.history.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const list = limit ? entries.slice(0, limit) : entries;
    if (!list.length) {
      target.innerHTML = `<div class="empty"><div class="empty-icon">🧺</div><strong>${t('hist.empty.title')}</strong><p>${t('hist.empty.text')}</p></div>`;
      return;
    }
    target.innerHTML = list.map(item => {
      const type = item.type || 'deposit';
      const isDeposit = type === 'deposit', isWithdraw = type === 'withdrawal', isBlockedDeposit = type === 'blockedDeposit';
      const isContamination = type === 'contamination', isRedeem = type === 'redeem';
      const amount = isDeposit ? `+${money(item.amount)}` : (isWithdraw || isRedeem) ? `−${money(item.amount)}` : money(0);
      const kg = kgText(Number(item.kg) || 0);
      let title, note;
      if (isDeposit) { title = t('hist.deposit', { kg }); note = t('hist.station', { station: escapeHtml(item.station || 'BIO-DEMO') }); }
      else if (isBlockedDeposit) { title = t('hist.blockedDeposit', { kg }); note = t('hist.blockedNote'); }
      else if (isContamination) { title = t('hist.contamination'); note = t('hist.contNote', { item: escapeHtml(itemName(item.itemKey, item.items)) }); }
      else if (isWithdraw) {
        const sys = CARD_SYSTEMS[item.system] ? `${CARD_SYSTEMS[item.system].name} ` : '';
        title = t('hist.withdraw'); note = t('hist.wdNote', { card: `${sys}**** ${escapeHtml(item.cardLast4 || '----')}` });
      } else {
        title = item.rewardId && rewards.some(r => r.id === item.rewardId) ? t(`reward.${item.rewardId}.name`) : escapeHtml(item.title || t('hist.reward'));
        note = t('hist.redeemNote', { code: escapeHtml(item.code || '—') });
      }
      const icon = isDeposit ? '♻️' : isWithdraw ? '💳' : isContamination ? '⚠️' : isBlockedDeposit ? '⏳' : '🎁';
      const cls = isDeposit ? 'positive' : (isWithdraw || isRedeem) ? 'negative' : 'warning-amount';
      return `<div class="history-row"><div class="history-left"><div class="history-icon">${icon}</div><div class="history-info"><strong>${title}</strong><span>${note} · ${formatDate(item.date)}</span></div></div><div class="amount ${cls}">${amount}</div></div>`;
    }).join('');
  }
  function renderShop(account) {
    const blocked = isBlocked(account);
    const lockNotice = $('shopBlockNotice');
    if (blocked) { lockNotice.hidden = false; lockNotice.innerHTML = `<strong>${t('shop.closed')}</strong>${escapeHtml(blockedBalanceMessage(account))}`; }
    else { lockNotice.hidden = true; lockNotice.textContent = ''; }
    $('shopGrid').innerHTML = rewards.map(r => `<article class="card product"><div class="product-emoji">${r.emoji}</div><h3>${t(`reward.${r.id}.name`)}</h3><p>${t(`reward.${r.id}.desc`)}</p><div class="product-bottom"><span class="cost">${money(r.price)}</span><button class="small-btn" data-reward="${r.id}" type="button" ${blocked || account.balance < r.price ? 'disabled' : ''}>${blocked ? t('shop.afterBlock') : t('shop.exchange')}</button></div></article>`).join('');
  }
  function renderEcoImpact(account) {
    const kg = account.totalKg;
    const compost = kg * ECO.compost, co2 = kg * ECO.co2, kwh = kg * ECO.kwh;
    const trees = Math.round(compost / ECO.compostPerTree);
    const cards = [
      { cls: 'leaf', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5c-7 0-12 2.5-12 8a5 5 0 0 0 5 5c5.5 0 7-6 7-13Z"></path><path d="M5 20c2-4 5-6.5 9-8.5"></path></svg>', tag: t('eco.c1.tag'), value: `${ecoNumber(compost)} ${t('kg')}`, desc: t('eco.c1.desc', { kg: kgText(kg), trees: num(trees) }) },
      { cls: 'co2', icon: '<span class="co2-mark">CO<sub>2</sub></span>', tag: t('eco.c2.tag'), value: `${ecoNumber(co2)} ${t('kg')} CO₂`, desc: t('eco.c2.desc') },
      { cls: 'bolt', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"></path></svg>', tag: t('eco.c3.tag'), value: `${ecoNumber(kwh)} ${t('eco.kwh')}`, desc: t('eco.c3.desc') }
    ];
    const html = cards.map(c => `<article class="eco-card"><div class="eco-icon ${c.cls}">${c.icon}</div><div class="eco-tag">${c.tag}</div><div class="eco-value">${c.value}</div><p>${c.desc}</p></article>`).join('');
    document.querySelectorAll('.eco-impact-grid').forEach(grid => { grid.innerHTML = html; });
    $('compostPill').textContent = t('goal2.pill', { kg: kgText(kg), compost: `${ecoNumber(compost)} ${t('kg')}` });
  }
  function renderCardStatus(account) {
    const box = $('cardStatusBox');
    const card = account.lastCard;
    const sys = card && CARD_SYSTEMS[card.system] ? CARD_SYSTEMS[card.system].name : '';
    const cardLine = card
      ? `<div class="card-status-row"><span>${t('cardst.last')}</span><strong>${sys ? `<span class="sys-chip">${sys}</span> ` : ''}**** ${escapeHtml(card.last4)}</strong></div>`
      : `<div class="card-status-row"><span>${t('cardst.none')}</span></div>`;
    const blocked = isBlocked(account);
    const state = blocked
      ? `<div class="card-status-state locked">${escapeHtml(t('cardst.locked', { date: formatUntil(account.blockedUntil) }))}</div>`
      : `<div class="card-status-state open">${t('cardst.open')}</div>`;
    box.innerHTML = cardLine + state;
    $('cardStatusWithdraw').disabled = blocked;
  }
  function renderAccount() {
    const a = currentAccount();
    $('accountIdValue').textContent = a.id;
    $('accountPhone').textContent = a.phone ? t('acc.phone', { phone: formatPhone(a.phone) }) : t('acc.noPhone');
    if (document.activeElement !== $('profileName')) $('profileName').value = a.name === 'Do‘st' ? '' : a.name;
    $('guaranteeText').innerHTML = t('guar.text', { amount: escapeHtml(money(a.balance)) });
    $('accountSelect').innerHTML = appData.accounts.map(x => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${escapeHtml(displayName(x))} — ${x.id}</option>`).join('');
    renderCardStatus(a);
  }
  function renderRanking() {
    const me = currentAccount();
    const rows = DEMO_LEADERS.map(x => ({ name: x.name, kg: x.kg, isMe: false, demo: true }))
      .concat(appData.accounts.map(a => ({ name: displayName(a), kg: a.totalKg, isMe: a.id === me.id, demo: false })))
      .sort((a, b) => b.kg - a.kg || (a.isMe ? -1 : b.isMe ? 1 : 0));
    const top = rows.slice(0, 10);
    const row = (r, i) => {
      const place = i + 1;
      const medal = place <= 3 ? ['🥇', '🥈', '🥉'][i] : '';
      const cls = [place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : '', r.isMe ? 'me' : ''].join(' ').trim();
      return `<div class="leader-row ${cls}"><div class="leader-rank">${medal ? `<span class="medal">${medal}</span>` : ''}<span>${place}</span></div><div class="leader-name">${escapeHtml(r.name)}${r.isMe ? ` <span class="you-badge">${t('rating.you')}</span>` : ''}</div><div class="leader-kg">${kgText(r.kg)}</div></div>`;
    };
    let html = top.map(row).join('');
    const myIndex = rows.findIndex(r => r.isMe);
    if (myIndex >= 10) html += `<div class="leader-gap">${t('rating.yourPlace')}</div>${row(rows[myIndex], myIndex)}`;
    $('localRanking').innerHTML = html || `<div class="empty">${t('rating.empty')}</div>`;
  }
  function renderWarnings() {
    const a = currentAccount();
    const list = $('warningsList');
    $('warningTotalCount').textContent = String(a.notifications.length);
    let status;
    if (isBlocked(a)) {
      status = `<div class="restriction-active"><strong>${t('warn.blockedTitle')}</strong><span>${escapeHtml(t('warn.blockedUntil', { date: formatUntil(a.blockedUntil) }))}</span><small>${escapeHtml(blockedBalanceMessage(a))} ${t('warn.blockedExtra')}</small></div>`;
    } else if (a.contaminationStreak > 0) {
      status = `<div class="restriction-caution"><strong>${t('warn.cautionTitle')}</strong><span>${t('warn.cautionText', { days: nextBlockDays(a) })}</span></div>`;
    } else {
      status = `<div class="restriction-clear"><strong>${t('warn.activeTitle')}</strong><span>${t('warn.activeText')}</span></div>`;
    }
    $('warningBlockStatus').innerHTML = status;
    if (!a.notifications.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">🔔</div><strong>${t('warn.empty.title')}</strong><p>${t('warn.empty.text')}</p></div>`;
      return;
    }
    list.innerHTML = a.notifications.slice().sort((x, y) => new Date(y.date) - new Date(x.date)).map(n => {
      const isBlock = n.level === 'block';
      const text = notificationText(n);
      return `<article class="warning-item ${isBlock ? 'is-block' : 'is-warning'} ${n.read ? 'is-read' : ''}"><div class="warning-item-top"><span class="warning-type">${isBlock ? '⛔' : '⚠️'} ${isBlock ? t('warn.badgeBlock') : t('warn.badgeWarn')}</span><time>${formatDate(n.date)}</time></div><h3>${escapeHtml(text.title)}</h3><p>${escapeHtml(text.message)}</p>${text.item ? `<div class="warning-detected">${t('warn.detected')} <strong>${escapeHtml(text.item)}</strong></div>` : ''}${n.blockedUntil ? `<div class="warning-until">${escapeHtml(t('warn.until', { date: formatUntil(n.blockedUntil) }))}</div>` : ''}<div class="warning-read-state">${n.read ? t('warn.read') : t('warn.new')}</div></article>`;
    }).join('');
  }
  function render() {
    renderAuthGate();
    const a = currentAccount();
    $('helloName').textContent = displayName(a);
    $('avatarBtn').textContent = displayName(a).trim().charAt(0).toUpperCase();
    $('balanceValue').textContent = num(a.balance);
    $('shopBalance').textContent = num(a.balance);
    $('totalKg').textContent = kgText(a.totalKg);
    $('earnedValue').textContent = num(a.totalEarned);
    $('depositCount').textContent = num(a.depositCount);
    const unread = a.notifications.filter(n => !n.read).length;
    const badge = $('warningBadge'); badge.textContent = String(unread); badge.hidden = unread === 0;
    const blocked = isBlocked(a);
    $('openWithdraw').disabled = blocked;
    $('openWithdraw').title = blocked ? t('home.withdrawTitleLocked') : t('home.withdrawTitle');
    $('withdrawLockHint').hidden = !blocked;
    const restriction = $('accountRestrictionNotice');
    if (blocked) {
      restriction.hidden = false;
      restriction.innerHTML = `<strong>${t('home.blockedTitle')}</strong>${escapeHtml(blockedBalanceMessage(a))} <button class="inline-link" type="button" data-page="warnings">${t('home.seeWarnings')}</button>`;
    } else restriction.hidden = true;
    renderHistory($('historyList'), 0, a);
    renderHistory($('homeRecent'), 3, a);
    renderShop(a);
    renderEcoImpact(a);
    renderRanking();
    renderWarnings();
    renderAccount();
    if (!pendingScan) $('idLookup').textContent = t('kiosk.wait');
    if ($('withdrawModal').classList.contains('show') && !$('withdrawFormPanel').hidden) validateWithdraw();
    scheduleUnlockRefresh();
  }

  /* ---------- Avtomat (kiosk) ---------- */
  function clearScanTimers() { if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; } }
  function resetKioskScanUI() {
    clearScanTimers(); pendingScan = null;
    $('kioskForm').reset(); $('kioskAccountId').value = ''; $('kioskAccountId').disabled = true;
    $('idLookup').textContent = t('kiosk.wait'); $('creditBonusBtn').disabled = true;
  }
  function beginKiosk() {
    resetKioskScanUI();
    $('personalIdPanel').hidden = false;
    $('demoKioskPanel').hidden = true;
    $('kioskPersonalId').textContent = currentAccount().id;
    openModal('kioskModal');
  }
  function startDemoScan(type) {
    if (pendingScan) { showToast(t('toast.prevScan')); return; }
    const kg = DEMO_READINGS[pendingDemoIndex % DEMO_READINGS.length]; pendingDemoIndex++;
    const organic = type === 'organic';
    const itemKey = organic ? '' : (CONTAMINANT_KEYS.includes(type) ? type : 'unknown');
    pendingScan = { kind: organic ? 'organic' : 'contaminated', itemKey, kg, amount: organic ? Math.round(kg * RATE_PER_KG) : 0, station: 'BIO-DEMO-01', scanId: makeTransactionId() };
    $('kioskAccountId').disabled = false;
    $('idLookup').textContent = organic ? t('kiosk.organicOk') : t('kiosk.contFound', { item: itemName(itemKey) });
    $('creditBonusBtn').disabled = true;
    $('personalIdPanel').hidden = true;
    $('demoKioskPanel').hidden = false;
    clearScanTimers();
    scanTimer = setTimeout(routePendingAfterTimeout, 30000);
    openModal('kioskModal');
    $('kioskAccountId').focus();
  }
  function routePendingAfterTimeout() {
    if (!pendingScan) return;
    const old = pendingScan; pendingScan = null; clearScanTimers();
    showToast(old.kind === 'organic' ? t('toast.timeoutOrganic') : t('toast.timeoutCont'));
    $('kioskAccountId').value = ''; $('kioskAccountId').disabled = true;
    $('idLookup').textContent = t('kiosk.ended'); $('creditBonusBtn').disabled = true;
  }
  function updateIdLookup() {
    const field = $('kioskAccountId');
    const clean = digitsOnly(field.value).slice(0, 8);
    if (field.value !== clean) field.value = clean;
    if (!pendingScan) { $('idLookup').textContent = t('kiosk.wait'); $('creditBonusBtn').disabled = true; return; }
    if (clean.length > 0) clearScanTimers();
    if (clean.length !== 8) { $('idLookup').textContent = t('kiosk.need8'); $('creditBonusBtn').disabled = true; return; }
    const target = findAccount(clean);
    if (!target) { $('idLookup').textContent = t('kiosk.notFound'); $('creditBonusBtn').disabled = true; return; }
    const name = displayName(target);
    if (pendingScan.kind === 'contaminated') $('idLookup').textContent = t('kiosk.foundCont', { name, item: itemName(pendingScan.itemKey) });
    else if (isBlocked(target)) $('idLookup').textContent = t('kiosk.foundBlocked', { name });
    else $('idLookup').textContent = t('kiosk.foundOk', { name });
    $('creditBonusBtn').disabled = false;
  }
  function handleKioskSubmit(event) {
    event.preventDefault();
    if (!pendingScan) { showToast(t('toast.needScan')); return; }
    const id = $('kioskAccountId').value.trim();
    if (!/^[0-9]{8}$/.test(id)) { showToast(t('toast.id8')); return; }
    const target = findAccount(id);
    if (!target) { showToast(t('toast.idNotFound')); updateIdLookup(); return; }
    const scan = pendingScan; clearScanTimers(); pendingScan = null;
    const date = new Date().toISOString();
    const name = displayName(target);
    if (scan.kind === 'contaminated') {
      const result = applyContamination(target, scan.itemKey, scan.scanId);
      if (result.kind === 'alreadyBlocked') showToast(t('alreadyBlocked', { date: formatUntil(target.blockedUntil) }));
      else if (result.kind === 'block') showToast(t('toast.contBlock', { name, id: target.id, days: result.days }));
      else showToast(t('toast.contWarn', { name, id: target.id }));
    } else {
      const kg = scan.kg;
      target.totalKg = Math.round((target.totalKg + kg) * 10) / 10;
      target.depositCount += 1;
      target.contaminationStreak = 0; // toza topshirish ogohlantirish holatini tiklaydi
      if (isBlocked(target)) {
        target.history.push({ id: scan.scanId, type: 'blockedDeposit', kg, amount: 0, station: scan.station, date });
        showToast(t('toast.blockedDeposit', { kg: kgText(kg) }));
      } else {
        target.balance += scan.amount; target.totalEarned += scan.amount;
        target.history.push({ id: scan.scanId, type: 'deposit', kg, amount: scan.amount, station: scan.station, date });
        showToast(t('toast.deposit', { kg: kgText(kg), amount: money(scan.amount), name, id: target.id }));
      }
    }
    saveData(); render(); $('kioskModal').classList.remove('show'); resetKioskScanUI();
  }

  /* ---------- Mablag‘ni chiqarish (UZCARD / HUMO) ---------- */
  function setWithdrawSystem(system, keepFocus) {
    if (!CARD_SYSTEMS[system]) return;
    wdSystem = system;
    const sys = CARD_SYSTEMS[system];
    document.querySelectorAll('.wd-system').forEach(btn => {
      const active = btn.dataset.system === system;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    $('wdCardChip').textContent = sys.name;
    const input = $('wdCardNumber');
    input.placeholder = `${sys.prefix} 0000 0000 0000`;
    let digits = digitsOnly(input.value);
    const knownPrefix = Object.values(CARD_SYSTEMS).some(s => digits.startsWith(s.prefix));
    if (!digits || knownPrefix) digits = sys.prefix + digits.slice(4);
    input.value = formatCard(digits.slice(0, 16));
    if (!keepFocus) { input.focus(); const end = input.value.length; try { input.setSelectionRange(end, end); } catch (e) { /* ba’zi brauzerlarda */ } }
    validateWithdraw();
  }
  function withdrawState() {
    const a = currentAccount();
    const sys = CARD_SYSTEMS[wdSystem];
    const digits = digitsOnly($('wdCardNumber').value);
    const amountRaw = digitsOnly($('wdAmount').value);
    const amount = amountRaw ? Number(amountRaw) : 0;
    let error = '';
    const cardOk = digits.length === 16 && digits.startsWith(sys.prefix);
    if (a.balance < MIN_WITHDRAW) error = t('wd.errZero');
    else if (digits.length >= 4 && !digits.startsWith(sys.prefix)) error = t('wd.errCard', { system: sys.name, prefix: sys.prefix });
    if (!error && amountRaw) {
      if (amount < MIN_WITHDRAW) error = t('wd.errAmount');
      else if (amount > a.balance) error = t('wd.errMax');
    }
    const ok = cardOk && amount >= MIN_WITHDRAW && amount <= a.balance && !isBlocked(a);
    return { ok, error, digits, amount, sys };
  }
  function validateWithdraw() {
    const a = currentAccount();
    $('wdAll').textContent = t('wd.all', { amount: money(a.balance) });
    const state = withdrawState();
    $('wdError').textContent = state.error;
    $('wdSubmit').disabled = !state.ok;
    return state;
  }
  function beginWithdraw() {
    const a = currentAccount();
    if (isBlocked(a)) { showToast(t('toast.wdBlocked', { date: formatUntil(a.blockedUntil) })); return; }
    $('withdrawFormPanel').hidden = false;
    $('withdrawReceipt').hidden = true;
    $('wdCardNumber').value = '';
    $('wdAmount').value = '';
    const system = a.lastCard && CARD_SYSTEMS[a.lastCard.system] ? a.lastCard.system : 'uzcard';
    openModal('withdrawModal');
    setWithdrawSystem(system, false);
  }
  function submitWithdraw(event) {
    event.preventDefault();
    const a = currentAccount();
    if (isBlocked(a)) { closeModal('withdrawModal'); showToast(t('toast.wdBlocked', { date: formatUntil(a.blockedUntil) })); return; }
    const state = validateWithdraw();
    if (!state.ok) {
      if (!state.error) $('wdError').textContent = state.digits.length !== 16 ? t('wd.errCard', { system: state.sys.name, prefix: state.sys.prefix }) : t('wd.errAmount');
      return;
    }
    const last4 = state.digits.slice(-4);
    const date = new Date().toISOString();
    const requestId = makeTransactionId();
    a.balance -= state.amount;
    a.lastCard = { system: wdSystem, last4 };
    const record = { id: requestId, type: 'withdrawal', amount: state.amount, system: wdSystem, cardLast4: last4, date, status: 'demo' };
    a.history.push(record);
    a.withdrawals.push({ ...record });
    saveData(); render();
    const rows = [
      [t('wd.r.amount'), money(state.amount)],
      [t('wd.r.card'), `${state.sys.name} **** ${last4}`],
      [t('wd.r.fee'), t('wd.r.feeVal')],
      [t('wd.r.id'), requestId],
      [t('wd.r.date'), formatDate(date)],
      [t('wd.r.status'), t('wd.r.statusVal')]
    ];
    $('receiptList').innerHTML = rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');
    $('withdrawFormPanel').hidden = true;
    $('withdrawReceipt').hidden = false;
    showToast(t('toast.wdDone'));
  }

  /* ---------- Hodisalar ---------- */
  document.addEventListener('click', event => {
    const pageButton = event.target.closest('[data-page]'); if (pageButton) { navigate(pageButton.dataset.page); return; }
    const backButton = event.target.closest('[data-back]'); if (backButton) { goBack(); return; }
    const closeButton = event.target.closest('[data-close]'); if (closeButton) { closeModal(closeButton.dataset.close); return; }
    const infoButton = event.target.closest('[data-info]');
    if (infoButton) {
      const key = infoButton.dataset.info;
      $('infoTitle').textContent = t(`info.${key}.title`);
      $('infoBody').innerHTML = t(`info.${key}.body`);
      openModal('infoModal');
      return;
    }
    const rewardButton = event.target.closest('[data-reward]');
    if (rewardButton) {
      const reward = rewards.find(r => r.id === rewardButton.dataset.reward); if (!reward) return;
      const a = currentAccount();
      if (isBlocked(a)) { showToast(t('toast.redeemBlocked', { date: formatUntil(a.blockedUntil) })); return; }
      if (a.balance < reward.price) { showToast(t('toast.noBalance')); return; }
      pendingReward = reward;
      $('redeemText').textContent = t('redeem.text', { name: t(`reward.${reward.id}.name`) });
      $('redeemCost').textContent = money(reward.price);
      openModal('redeemModal');
      return;
    }
    const systemButton = event.target.closest('[data-system]');
    if (systemButton) setWithdrawSystem(systemButton.dataset.system, false);
  });

  $('openKiosk').addEventListener('click', beginKiosk);
  $('copyKioskPersonalId').addEventListener('click', () => copyText(currentAccount().id, t('toast.copied')));
  $('copyAccountId').addEventListener('click', () => copyText(currentAccount().id, t('toast.copied')));
  $('openWithdraw').addEventListener('click', beginWithdraw);
  $('cardStatusWithdraw').addEventListener('click', beginWithdraw);
  $('showCardStatus').addEventListener('click', () => {
    const card = $('cardStatusCard');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
  });
  $('openKioskDemo').addEventListener('click', () => { const type = $('homeDemoScanType').value; beginKiosk(); startDemoScan(type); });
  $('kioskAccountId').addEventListener('input', updateIdLookup);
  $('kioskForm').addEventListener('submit', handleKioskSubmit);
  $('markWarningsRead').addEventListener('click', () => {
    currentAccount().notifications.forEach(n => { n.read = true; });
    saveData(); render(); showToast(t('toast.markedRead'));
  });

  $('wdCardNumber').addEventListener('input', () => {
    const input = $('wdCardNumber');
    const digits = digitsOnly(input.value).slice(0, 16);
    input.value = formatCard(digits);
    const detected = Object.keys(CARD_SYSTEMS).find(k => digits.startsWith(CARD_SYSTEMS[k].prefix));
    if (detected && detected !== wdSystem) setWithdrawSystem(detected, true);
    else validateWithdraw();
  });
  $('wdAmount').addEventListener('input', () => {
    const input = $('wdAmount');
    const digits = digitsOnly(input.value).replace(/^0+(?=\d)/, '').slice(0, 9);
    input.value = digits ? num(Number(digits)) : '';
    validateWithdraw();
  });
  $('wdAll').addEventListener('click', () => {
    const balance = Math.floor(currentAccount().balance);
    $('wdAmount').value = balance > 0 ? num(balance) : '';
    validateWithdraw();
  });
  $('withdrawForm').addEventListener('submit', submitWithdraw);

  $('confirmRedeem').addEventListener('click', () => {
    if (!pendingReward) return;
    const a = currentAccount();
    if (isBlocked(a)) { closeModal('redeemModal'); pendingReward = null; showToast(t('toast.redeemBlocked', { date: formatUntil(a.blockedUntil) })); return; }
    if (a.balance < pendingReward.price) { showToast(t('toast.noBalance')); closeModal('redeemModal'); return; }
    const code = makeTransactionId(); const date = new Date().toISOString();
    a.balance -= pendingReward.price;
    a.history.push({ id: makeTransactionId(), type: 'redeem', rewardId: pendingReward.id, title: t(`reward.${pendingReward.id}.name`), amount: pendingReward.price, code, date });
    a.redemptions.push({ rewardId: pendingReward.id, code, date });
    saveData(); render(); closeModal('redeemModal'); pendingReward = null;
    showToast(t('toast.coupon', { code }));
  });
  $('profileForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('profileName').value.trim();
    if (!name) { showToast(t('toast.enterName')); return; }
    currentAccount().name = name; saveData(); render(); showToast(t('toast.profileSaved'));
  });
  $('accountSelect').addEventListener('change', event => {
    const target = findAccount(event.target.value);
    if (!target) { showToast(t('toast.accNotFound')); return; }
    appData.currentAccountId = target.id; saveData(); render();
    showToast(t('toast.switched', { name: displayName(target) }));
  });
  $('newAccountBtn').addEventListener('click', () => { $('newAccountForm').reset(); openModal('newAccountModal'); });
  $('newAccountForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('newAccountName').value.trim();
    if (!name) { showToast(t('toast.enterName')); return; }
    try {
      const existing = new Set(appData.accounts.map(a => a.id));
      const account = newAccount(name, existing);
      appData.accounts.push(account); appData.currentAccountId = account.id;
      saveData(); render(); closeModal('newAccountModal');
      showToast(t('toast.accCreated', { id: account.id }));
    } catch (error) { showToast(t('toast.accFail')); }
  });
  $('exportData').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'BIO-BONUS', exportedAt: new Date().toISOString(), appData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'bio-bonus-malumotlar.json'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    showToast(t('toast.exported'));
  });
  $('resetData').addEventListener('click', () => {
    if (!window.confirm(t('confirm.reset'))) return;
    appData = createDefaultData(); saveData(); render(); navigate('home'); showToast(t('toast.resetDone'));
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop.show').forEach(m => closeModal(m.id)); });


  /* ---------- Kirish / ro‘yxatdan o‘tish (telefon raqam, demo SMS kod) ---------- */
  let authPending = null; // { phone, name, code, accountId }
  function renderAuthGate() {
    const show = !appData.loggedIn;
    $('authScreen').hidden = !show;
    document.body.classList.toggle('auth-open', show);
  }
  function authPhoneDigits() { return digitsOnly($('authPhone').value).slice(0, 9); }
  function findByPhone(phone) { return appData.accounts.find(a => a.phone === phone); }
  function updateAuthPhone() {
    const input = $('authPhone');
    const d = authPhoneDigits();
    input.value = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
    $('authPhoneError').textContent = '';
    if (d.length < 9) { $('authPhoneHint').textContent = ''; $('authNameBox').hidden = true; return; }
    const existing = findByPhone(`998${d}`);
    $('authPhoneHint').innerHTML = existing ? escapeHtml(t('auth.exists', { name: displayName(existing) })) : escapeHtml(t('auth.new'));
    $('authPhoneHint').className = `auth-hint ${existing ? 'known' : 'fresh'}`;
    $('authNameBox').hidden = Boolean(existing);
  }
  function makeCode() {
    const bytes = new Uint32Array(1);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes); else bytes[0] = Math.floor(Math.random() * 1e9);
    return String(1000 + (bytes[0] % 9000));
  }
  function showCodeStep() {
    $('authSentText').innerHTML = t('auth.sent', { phone: escapeHtml(formatPhone(authPending.phone)) });
    $('authDemoCode').innerHTML = t('auth.demoCode', { code: authPending.code });
    $('authPhoneForm').hidden = true;
    $('authCodeForm').hidden = false;
    $('authCode').value = '';
    $('authCodeError').textContent = '';
    $('authCode').focus();
  }
  $('authPhone').addEventListener('input', updateAuthPhone);
  $('authPhoneForm').addEventListener('submit', event => {
    event.preventDefault();
    const d = authPhoneDigits();
    if (d.length !== 9) { $('authPhoneError').textContent = t('auth.errPhone'); return; }
    const phone = `998${d}`;
    const existing = findByPhone(phone);
    const name = $('authName').value.trim();
    if (!existing && !name) { $('authNameBox').hidden = false; $('authPhoneError').textContent = t('auth.errName'); $('authName').focus(); return; }
    authPending = { phone, name, code: makeCode(), accountId: existing ? existing.id : null };
    showCodeStep();
  });
  $('authCode').addEventListener('input', () => {
    $('authCode').value = digitsOnly($('authCode').value).slice(0, 4);
    $('authCodeError').textContent = '';
  });
  $('authCodeForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!authPending) return;
    if ($('authCode').value !== authPending.code) { $('authCodeError').textContent = t('auth.errCode'); return; }
    let account = authPending.accountId ? findAccount(authPending.accountId) : null;
    let isNew = false;
    if (!account) {
      // Telefonsiz eski demo akkaunt bo‘lsa, ma’lumotlari yo‘qolmasligi uchun shu akkauntga bog‘lanadi
      const current = currentAccount();
      if (current && !current.phone) account = current;
      else {
        const existing = new Set(appData.accounts.map(a => a.id));
        account = newAccount(authPending.name, existing);
        appData.accounts.push(account);
      }
      account.phone = authPending.phone;
      account.name = authPending.name.slice(0, 35);
      isNew = true;
    }
    appData.currentAccountId = account.id;
    appData.loggedIn = true;
    authPending = null;
    $('authPhoneForm').reset(); $('authPhoneHint').textContent = ''; $('authNameBox').hidden = true;
    $('authPhoneForm').hidden = false; $('authCodeForm').hidden = true;
    saveData(); render(); navigate('home');
    showToast(isNew ? t('toast.welcomeNew', { id: account.id }) : t('toast.welcomeBack', { name: displayName(account) }));
  });
  $('authChange').addEventListener('click', () => {
    authPending = null;
    $('authCodeForm').hidden = true; $('authPhoneForm').hidden = false; $('authPhone').focus();
  });
  $('authResend').addEventListener('click', () => {
    if (!authPending) return;
    authPending.code = makeCode();
    showCodeStep();
    showToast(t('auth.resent'));
  });
  $('logoutBtn').addEventListener('click', () => {
    appData.loggedIn = false;
    saveData(); render();
    showToast(t('toast.loggedOut'));
  });

  function renderToday() {
    const now = new Date();
    const today = isUz() ? `${UZ_DAYS[now.getDay()]}, ${now.getDate()}-${UZ_MONTHS[now.getMonth()]}` : new Intl.DateTimeFormat(I.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    $('todayLabel').textContent = today.charAt(0).toUpperCase() + today.slice(1);
  }
  I.onChange(() => {
    renderToday();
    if (authPending && !$('authCodeForm').hidden) showCodeStep();
    if (authPhoneDigits().length === 9) updateAuthPhone();
    render();
    if (pendingScan) {
      $('idLookup').textContent = pendingScan.kind === 'organic' ? t('kiosk.organicOk') : t('kiosk.contFound', { item: itemName(pendingScan.itemKey) });
      if ($('kioskAccountId').value) updateIdLookup();
    }
  });
  $('footerYear').textContent = String(new Date().getFullYear());
  renderToday();
  window.addEventListener('focus', () => render());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  saveData(); render();
})();
