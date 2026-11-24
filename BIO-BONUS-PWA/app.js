(() => {
  'use strict';
  const STORAGE_KEY = 'bioBonusApp_v3';
  const PREVIOUS_STORAGE_KEY = 'bioBonusApp_v2';
  const LEGACY_KEY = 'bioBonusDemo_v1';
  const RATE_PER_KG = 200;
  const MAX_WEIGHT_KG = 25;
  const BLOCK_3_DAYS = 3 * 24 * 60 * 60 * 1000;
  const BLOCK_7_DAYS = 7 * 24 * 60 * 60 * 1000;
  const DEMO_READINGS = [2.4, 1.8, 3.1, 0.9, 4.2, 1.5];
  const CONTAMINANTS = {
    plastic: 'plastik', metal: 'temir yoki metall buyum', stone: 'tosh',
    bottle: 'bakalashka', glass: 'shisha'
  };
  const rewards = [
    {id:'seeds',name:'Gul urug‘lari',description:'Uy yoki maktab bog‘i uchun urug‘lar to‘plami.',price:2000,emoji:'🌻'},
    {id:'compost',name:'Organik kompost',description:'Hamkor markaz tasdiqlagan kompost uchun demo kupon.',price:5000,emoji:'🌱'},
    {id:'shop',name:'Do‘kon chegirmasi',description:'Hamkor do‘konda foydalanish uchun demo kupon.',price:10000,emoji:'🛍️'},
    {id:'utility',name:'Kommunal chegirma',description:'Kelajakdagi hamkorlik orqali faollashtiriladigan chegirma.',price:20000,emoji:'🏠'},
    {id:'tree',name:'Ko‘chat sovg‘asi',description:'Ekologik tadbirda ko‘chat olish uchun demo kupon.',price:15000,emoji:'🌳'},
    {id:'eco',name:'Ekologik sovg‘a',description:'Qayta foydalaniladigan sumka yoki sovg‘a to‘plami.',price:8000,emoji:'♻️'}
  ];
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('uz-UZ').format(Math.round(Number(value)||0));
  const kgText = value => `${Number((Number(value)||0).toFixed(1)).toLocaleString('uz-UZ')} kg`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const validNumber = value => {const n=Number(value);return Number.isFinite(n)&&n>=0?n:0;};
  const makeTransactionId = () => `BB-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*900+100)}`;
  let pendingReward = null;
  let pendingScan = null;
  let demoScaleIndex = 0;
  let scanTimer = null;
  let scanDeadline = 0;
  let toastTimer = null;
  let currentPage = 'home';
  let previousPage = 'home';
  let unlockTimer = null;

  function randomAccountId(existing){
    for(let tries=0;tries<500;tries++){
      const bytes=new Uint32Array(1);
      if(window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
      else bytes[0]=Math.floor(Math.random()*0xffffffff);
      const candidate=String(10000000+(bytes[0]%90000000));
      if(!existing.has(candidate)) return candidate;
    }
    throw new Error('Yangi ID yaratilmadi. Qayta urinib ko‘ring.');
  }
  function newAccount(name,existing){
    return {id:randomAccountId(existing),name:(name||'Do‘st').trim()||'Do‘st',balance:0,totalKg:0,totalEarned:0,depositCount:0,history:[],redemptions:[],cardLast4:'',cardOwner:'',withdrawals:[],notifications:[],violationStep:0,blockedUntil:null};
  }
  function normalizeAccount(raw,existing){
    const id=/^[0-9]{8}$/.test(String(raw.id||''))&&!existing.has(String(raw.id))?String(raw.id):randomAccountId(existing);
    existing.add(id);
    return {
      id,name:String(raw.name||'Do‘st').slice(0,35),balance:validNumber(raw.balance),totalKg:validNumber(raw.totalKg),
      totalEarned:validNumber(raw.totalEarned),depositCount:validNumber(raw.depositCount),
      history:Array.isArray(raw.history)?raw.history:[],redemptions:Array.isArray(raw.redemptions)?raw.redemptions:[],
      cardLast4:/^[0-9]{4}$/.test(String(raw.cardLast4||''))?String(raw.cardLast4):'',cardOwner:String(raw.cardOwner||'').slice(0,60),
      withdrawals:Array.isArray(raw.withdrawals)?raw.withdrawals:[],
      notifications:Array.isArray(raw.notifications)?raw.notifications:[],
      violationStep:Math.max(0,Math.min(4,Math.floor(validNumber(raw.violationStep)))),
      blockedUntil:raw.blockedUntil?String(raw.blockedUntil):null
    };
  }
  function createDefaultData(){
    const accounts=[];const ids=new Set();const account=newAccount('Do‘st',ids);accounts.push(account);
    return {accounts,currentAccountId:account.id};
  }
  function migrateFromStorage(key){
    try{
      const old=JSON.parse(localStorage.getItem(key)||'null');
      if(!old||typeof old!=='object') return null;
      if(Array.isArray(old.accounts)){
        const ids=new Set();const accounts=old.accounts.map(a=>normalizeAccount(a,ids));
        if(!accounts.length) return null;
        const current=accounts.some(a=>a.id===String(old.currentAccountId))?String(old.currentAccountId):accounts[0].id;
        return {accounts,currentAccountId:current};
      }
      if(key===LEGACY_KEY){
        const data=createDefaultData();const a=data.accounts[0];
        a.name=String(old.name||'Do‘st').slice(0,35);
        const oldHistory=Array.isArray(old.history)?old.history:[];
        a.history=oldHistory.map(item=>{
          if(item.type==='deposit'){
            const kg=Math.round(validNumber(item.kg)*10)/10;return {...item,kg,amount:Math.round(kg*RATE_PER_KG)};
          }
          return item;
        });
        a.totalKg=Math.round(a.history.filter(x=>x.type==='deposit').reduce((s,x)=>s+validNumber(x.kg),0)*10)/10;
        a.totalEarned=a.history.filter(x=>x.type==='deposit').reduce((s,x)=>s+validNumber(x.amount),0);
        a.depositCount=a.history.filter(x=>x.type==='deposit').length;
        a.balance=Math.max(0,a.totalEarned-a.history.filter(x=>x.type==='redeem'||x.type==='withdrawal').reduce((s,x)=>s+validNumber(x.amount),0));
        a.redemptions=Array.isArray(old.redemptions)?old.redemptions:[];
        return data;
      }
    }catch(error){console.warn('Saqlangan demo ma’lumot ko‘chirilmadi:',error);}
    return null;
  }
  function loadData(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed=JSON.parse(raw);if(parsed&&Array.isArray(parsed.accounts)){
          const ids=new Set();const accounts=parsed.accounts.map(a=>normalizeAccount(a,ids));
          if(accounts.length){const current=accounts.some(a=>a.id===String(parsed.currentAccountId))?String(parsed.currentAccountId):accounts[0].id;return {accounts,currentAccountId:current};}
        }
      }
    }catch(error){console.warn('Saqlangan ma’lumot o‘qilmadi:',error);}
    return migrateFromStorage(PREVIOUS_STORAGE_KEY)||migrateFromStorage(LEGACY_KEY)||createDefaultData();
  }
  let appData=loadData();
  function saveData(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(appData));}catch(error){console.error(error);showToast('Brauzer xotirasiga saqlab bo‘lmadi.');}}
  function currentAccount(){return appData.accounts.find(a=>a.id===appData.currentAccountId)||appData.accounts[0];}
  function findAccount(id){return appData.accounts.find(a=>a.id===String(id));}
  function showToast(message){const node=$('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3200);}
  function formatDate(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return 'Sana noma’lum';return new Intl.DateTimeFormat('uz-UZ',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
  function formatUntil(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return '';return new Intl.DateTimeFormat('uz-UZ',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
  function openModal(id){$(id).classList.add('show');}
  function closeModal(id){
    if(id==='kioskModal'&&pendingScan) routePendingAfterTimeout('modal-closed');
    $(id).classList.remove('show');
  }
  function navigate(page,fromBack=false){
    if(!document.getElementById(`screen-${page}`)) return;
    if(page!==currentPage&&!fromBack) previousPage=currentPage;
    currentPage=page;
    document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===`screen-${page}`));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    if(page==='account') renderAccount();
    if(page==='warnings') renderWarnings();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function goBack(){navigate(previousPage&&previousPage!==currentPage?previousPage:'home',true);}
  function isBlocked(account){return Boolean(account.blockedUntil&&new Date(account.blockedUntil).getTime()>Date.now());}
  function scheduleUnlockRefresh(){
    if(unlockTimer){clearTimeout(unlockTimer);unlockTimer=null;}
    const account=currentAccount();
    if(!isBlocked(account)) return;
    const remaining=new Date(account.blockedUntil).getTime()-Date.now()+150;
    unlockTimer=setTimeout(()=>{
      if(isBlocked(currentAccount())) scheduleUnlockRefresh();
      else {render();showToast('Blok muddati tugadi. Saqlangan balansingizdan yana foydalanishingiz mumkin.');}
    },Math.min(Math.max(remaining,150),2147483000));
  }
  function blockedBalanceMessage(account){
    return `Hisobingizdagi ${money(account.balance)} so‘m saqlanadi. ${formatUntil(account.blockedUntil)} gacha bonus do‘konida ishlatish va kartaga chiqarish yopiq. Blok tugagach, balansingiz yana ochiladi.`;
  }
  function unreadCount(account){return account.notifications.filter(n=>!n.read).length;}
  function addNotification(account,notification){
    account.notifications.unshift({id:makeTransactionId(),date:new Date().toISOString(),read:false,...notification});
  }
  function applyContamination(account,items){
    if(isBlocked(account)){
      return {kind:'alreadyBlocked',message:`Hisobingiz ${formatUntil(account.blockedUntil)} gacha bonus olishdan bloklangan. Yangi bonus yozilmadi.`};
    }
    const next=(Number(account.violationStep)||0)+1;
    account.violationStep=Math.min(next,4);
    let notification;
    if(next===1){
      notification={level:'warning',title:'Birinchi ogohlantirish',message:`Siz topshirgan chiqindida ${items} aniqlandi. BIO-BONUS faqat chiriydigan organik chiqindini qabul qiladi. Bu safar ogohlantirish berildi. Takrorlansa, bonus olish 3 kunga bloklanadi.`,items,blockedUntil:null};
    }else if(next===2){
      const until=new Date(Date.now()+BLOCK_3_DAYS).toISOString();account.blockedUntil=until;
      notification={level:'block',title:'3 kunlik bonus bloklandi',message:`Qoidabuzarlik takrorlandi: ${items} aniqlandi. Akkauntingiz 3 kun davomida bonus olishdan bloklandi. Shu davrda toza organik chiqindi topshirishingiz mumkin, ammo bonus hisoblanmaydi.`,items,blockedUntil:until,days:3};
    }else if(next===3){
      notification={level:'warning',title:'Yana bir ogohlantirish',message:`3 kunlik blok muddati tugaganidan keyin yana ${items} aniqlandi. Bu safar ogohlantirish berildi. Keyingi shunday holatda bonus olish 7 kunga bloklanadi.`,items,blockedUntil:null};
    }else{
      const until=new Date(Date.now()+BLOCK_7_DAYS).toISOString();account.blockedUntil=until;
      notification={level:'block',title:'7 kunlik bonus bloklandi',message:`Begona chiqindi yana takroran aniqlandi: ${items}. Akkauntingiz 7 kun davomida bonus olishdan bloklandi. Toza organik chiqindi qabul qilinishi mumkin, lekin blok tugamaguncha bonus berilmaydi.`,items,blockedUntil:until,days:7};
    }
    addNotification(account,notification);
    account.history.push({id:makeTransactionId(),type:'contamination',amount:0,items,date:new Date().toISOString(),level:notification.level});
    return {kind:notification.level,notification};
  }
  function renderHistory(target,limit,account){
    const entries=account.history.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));const list=limit?entries.slice(0,limit):entries;
    if(!list.length){target.innerHTML='<div class="empty"><div class="empty-icon">🧺</div><strong>Hozircha tarix bo‘sh</strong><p>Organik chiqindi topshirganingizdan keyin harakatlaringiz shu yerda ko‘rinadi.</p></div>';return;}
    target.innerHTML=list.map(item=>{
      const type=item.type||'deposit';const isDeposit=type==='deposit';const isWithdraw=type==='withdrawal';
      const isBlockedDeposit=type==='blockedDeposit';const isContamination=type==='contamination';const isRedeem=type==='redeem';
      const amount=isDeposit?`+${money(item.amount)} so‘m`:isWithdraw||isRedeem?`−${money(item.amount)} so‘m`:isBlockedDeposit?'0 so‘m':'0 so‘m';
      const title=isDeposit?`${kgText(Number(item.kg)||0)} organik chiqindi`:isBlockedDeposit?`${kgText(Number(item.kg)||0)} organik chiqindi · blok davri`:isContamination?'Begona chiqindi aniqlandi':isWithdraw?'Kartaga chiqarish so‘rovi':escapeHtml(item.title||'Mukofot');
      const note=isDeposit?`Avtomat: ${escapeHtml(item.station||'BIO-DEMO')}`:isBlockedDeposit?'Chiqindi qabul qilindi, bonus berilmadi':isContamination?`${escapeHtml(item.items||'Begona material')} · bonus berilmadi`:isWithdraw?`Demo · karta **** ${escapeHtml(item.cardLast4||'----')} · bankka yuborilmadi`:`Bonus do‘koni · ${escapeHtml(item.code||'Kupon')}`;
      return `<div class="history-row"><div class="history-left"><div class="history-icon">${isDeposit?'♻️':isWithdraw?'💳':isContamination?'⚠️':isBlockedDeposit?'⏳':'🎁'}</div><div class="history-info"><strong>${title}</strong><span>${note} · ${formatDate(item.date)}</span></div></div><div class="amount ${isDeposit?'positive':isWithdraw||isRedeem?'negative':'warning-amount'}">${amount}</div></div>`;
    }).join('');
  }
  function renderShop(account){
    const blocked=isBlocked(account);
    const lockNotice=$('shopBlockNotice');
    if(blocked){
      lockNotice.hidden=false;
      lockNotice.innerHTML=`<strong>⛔ Bonus do‘koni vaqtincha yopiq</strong>${blockedBalanceMessage(account)}`;
    }else{
      lockNotice.hidden=true;
      lockNotice.textContent='';
    }
    $('shopGrid').innerHTML=rewards.map(r=>`<article class="card product"><div class="product-emoji">${r.emoji}</div><h3>${r.name}</h3><p>${r.description}</p><div class="product-bottom"><span class="cost">${money(r.price)} so‘m</span><button class="small-btn" data-reward="${r.id}" ${blocked||account.balance<r.price?'disabled':''}>${blocked?'Blok tugagach':'Almashtirish'}</button></div></article>`).join('');
  }
  function renderAccount(){
    const a=currentAccount();$('accountIdValue').textContent=a.id;$('profileName').value=a.name;$('cardNumberDemo').value='';$('cardOwnerPanel').hidden=true;$('cardStatus').textContent=a.cardLast4?`Demo karta ulangan: **** ${a.cardLast4} · ${a.cardOwner||'Demo foydalanuvchi'}`:'Demo karta hali ulanmagan.';
    $('accountSelect').innerHTML=appData.accounts.map(x=>`<option value="${x.id}" ${x.id===a.id?'selected':''}>${escapeHtml(x.name)} — ${x.id}</option>`).join('');
  }
  function renderRanking(){
    const rows=appData.accounts.slice().sort((a,b)=>b.totalKg-a.totalKg);
    if(!rows.length){$('localRanking').innerHTML='<div class="empty">Hozircha ma’lumot yo‘q.</div>';return;}
    $('localRanking').innerHTML=`<table class="rank-table"><thead><tr><th>O‘rin</th><th>Ism</th><th>Chiqindi</th></tr></thead><tbody>${rows.map((a,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(a.name)}${a.id===currentAccount().id?' <span class="chip-status">Siz</span>':''}</td><td>${kgText(a.totalKg)}</td></tr>`).join('')}</tbody></table>`;
  }
  function renderWarnings(){
    const a=currentAccount();const list=$('warningsList');
    $('warningTotalCount').textContent=String(a.notifications.length);
    const remaining=isBlocked(a)?`<div class="restriction-active"><strong>⛔ Akkauntingiz vaqtincha bloklangan</strong><span>Blok muddati: ${formatUntil(a.blockedUntil)}</span><small>${escapeHtml(blockedBalanceMessage(a))} Toza organik chiqindi topshirishingiz mumkin, ammo blok tugaguncha yangi bonus ham berilmaydi.</small></div>`:'<div class="restriction-clear"><strong>✅ Akkauntingiz faol</strong><span>Blok muddati tugagan. Balansingizdan foydalanishingiz mumkin.</span></div>';
    $('warningBlockStatus').innerHTML=remaining;
    if(!a.notifications.length){list.innerHTML='<div class="empty"><div class="empty-icon">🔔</div><strong>Hozircha ogohlantirish yo‘q</strong><p>Avtomat begona chiqindini aniqlasa, xabarlar shu yerda paydo bo‘ladi.</p></div>';return;}
    list.innerHTML=a.notifications.slice().sort((x,y)=>new Date(y.date)-new Date(x.date)).map(n=>{
      const badge=n.level==='block'?'Blok': 'Ogohlantirish';
      return `<article class="warning-item ${n.level==='block'?'is-block':'is-warning'} ${n.read?'is-read':''}"><div class="warning-item-top"><span class="warning-type">${n.level==='block'?'⛔':'⚠️'} ${badge}</span><time>${formatDate(n.date)}</time></div><h3>${escapeHtml(n.title||'Ogohlantirish')}</h3><p>${escapeHtml(n.message||'Begona chiqindi aniqlandi.')}</p>${n.items?`<div class="warning-detected">Aniqlangan narsa: <strong>${escapeHtml(n.items)}</strong></div>`:''}${n.blockedUntil?`<div class="warning-until">Blok tugashi: ${formatUntil(n.blockedUntil)}</div>`:''}<div class="warning-read-state">${n.read?'O‘qilgan':'Yangi xabar'}</div></article>`;
    }).join('');
  }
  function render(){
    const a=currentAccount();$('helloName').textContent=a.name||'Do‘st';$('avatarBtn').textContent=(a.name||'D').trim().charAt(0).toUpperCase();
    $('balanceValue').textContent=money(a.balance);$('shopBalance').textContent=money(a.balance);$('withdrawBalance').textContent=`${money(a.balance)} so‘m`;
    $('totalKg').textContent=kgText(a.totalKg);$('earnedValue').textContent=money(a.totalEarned);$('depositCount').textContent=money(a.depositCount);
    $('ratingKg').textContent=kgText(a.totalKg);$('ratingSum').textContent=`${money(a.totalEarned)} so‘m`;$('ratingCount').textContent=money(a.depositCount);
    $('ecoKg').textContent=kgText(a.totalKg);$('ecoBonus').textContent=money(a.totalEarned);$('ecoActions').textContent=money(a.depositCount);
    $('withdrawCard').textContent=a.cardLast4?`**** ${a.cardLast4}`:'Ulanmagan';$('withdrawCardOwner').textContent=a.cardLast4?(a.cardOwner||'Demo foydalanuvchi'):'Karta ulanmagan';
    const badge=$('warningBadge');badge.textContent=String(a.notifications.length);badge.hidden=a.notifications.length===0;
    const restriction=$('accountRestrictionNotice');
    const blocked=isBlocked(a);
    $('openWithdraw').disabled=blocked;
    $('openWithdraw').title=blocked?'Blok tugamaguncha balansni kartaga chiqarib bo‘lmaydi.':'Demo balansni kartaga chiqarish so‘rovi';
    $('withdrawLockHint').hidden=!blocked;
    if(blocked){restriction.hidden=false;restriction.innerHTML=`<strong>⛔ Hisobingiz vaqtincha bloklangan</strong>${escapeHtml(blockedBalanceMessage(a))} <button class="inline-link" type="button" data-page="warnings">Ogohlantirishni ko‘rish</button>`;}
    else restriction.hidden=true;
    renderHistory($('historyList'),0,a);renderHistory($('homeRecent'),3,a);renderShop(a);renderRanking();renderWarnings();
    if(currentPage==='account')renderAccount();
    scheduleUnlockRefresh();
  }
  let pendingDemoIndex=0;
  function clearScanTimers(){if(scanTimer){clearTimeout(scanTimer);scanTimer=null;}scanDeadline=0;}
  function resetKioskScanUI(){
    clearScanTimers();pendingScan=null;
    $('kioskForm').reset();$('kioskAccountId').value='';$('kioskAccountId').disabled=true;
    $('idLookup').textContent='Avtomat chiqindini tekshirib bo‘lgach, ID kiritish ochiladi.';$('creditBonusBtn').disabled=true;
  }
  function beginKiosk(){
    resetKioskScanUI();
    $('personalIdPanel').hidden=false;
    $('demoKioskPanel').hidden=true;
    $('kioskPersonalId').textContent=currentAccount().id;
    openModal('kioskModal');
  }
  function startDemoScan(type){
    if(pendingScan){showToast('Oldingi avtomat tekshiruvi yakunlanishi kerak.');return;}
    const kg=DEMO_READINGS[pendingDemoIndex%DEMO_READINGS.length];pendingDemoIndex++;
    const organic=type==='organic';const item=organic?'':(CONTAMINANTS[type]||'begona material');
    pendingScan={kind:organic?'organic':'contaminated',item,kg,amount:organic?Math.round(kg*RATE_PER_KG):0,station:'BIO-DEMO-01',scanId:makeTransactionId(),createdAt:new Date().toISOString()};
    $('kioskAccountId').disabled=false;
    $('idLookup').textContent=organic
      ? 'Avtomat toza organik chiqindini tasdiqladi. Bonusni o‘tkazish uchun 8 xonali ID kiriting.'
      : `Avtomat ${item} aniqladi. Ogohlantirishni tegishli akkauntga yuborish uchun 8 xonali ID kiriting.`;
    $('creditBonusBtn').disabled=true;
    $('personalIdPanel').hidden=true;
    $('demoKioskPanel').hidden=false;
    startIdTimeout();
    openModal('kioskModal');
    $('kioskAccountId').focus();
  }
  function startIdTimeout(){
    clearScanTimers();scanDeadline=Date.now()+30000;
    scanTimer=setTimeout(()=>routePendingAfterTimeout('no-id'),30000);
  }
  function stopIdTimeout(){clearScanTimers();}
  function routePendingAfterTimeout(reason){
    if(!pendingScan)return;
    const old=pendingScan;pendingScan=null;clearScanTimers();
    if(old.kind==='organic'){
      showToast('30 soniyada ID kiritilmadi. Organik chiqindi umumiy idishga avtomatik yuborildi, bonus berilmadi.');
    }else{
      showToast('Begona aralashma bioxomashyoni ifloslantirmasligi uchun karantin idishiga yo‘naltirildi. ID kiritilmagani sababli akkauntga ogohlantirish bog‘lanmadi.');
    }
    $('kioskAccountId').value='';$('kioskAccountId').disabled=true;
    $('idLookup').textContent='Urinish yakunlandi. Keyingi tekshiruv kutilmoqda.';$('creditBonusBtn').disabled=true;
  }
  function updateIdLookup(){
    const id=$('kioskAccountId').value.trim();
    if(pendingScan&&id.length>0) stopIdTimeout();
    if(!pendingScan){$('idLookup').textContent='Avtomat chiqindini tekshirib bo‘lgach, ID kiritish ochiladi.';$('creditBonusBtn').disabled=true;return;}
    if(!/^[0-9]{8}$/.test(id)){$('idLookup').textContent='8 ta raqamdan iborat ID ni kiriting.';$('creditBonusBtn').disabled=true;return;}
    const target=findAccount(id);
    if(!target){$('idLookup').textContent='Bu ID topilmadi. Ogohlantirish ham, bonus ham hech kimga yozilmadi.';$('creditBonusBtn').disabled=true;return;}
    if(pendingScan.kind==='contaminated'){
      $('idLookup').textContent=`${target.name} akkaunti topildi. ${pendingScan.item} bo‘yicha ogohlantirish shu hisobga yuboriladi; bonus berilmaydi.`;
    }else if(isBlocked(target)){
      $('idLookup').textContent=`${target.name} akkaunti topildi, lekin bonus olish vaqtincha bloklangan. Bu topshirish uchun bonus 0 so‘m.`;
    }else{
      $('idLookup').textContent=`${target.name} akkaunti topildi. Tekshiruvdan o‘tgan bonus shu hisobga o‘tkaziladi.`;
    }
    $('creditBonusBtn').disabled=false;
  }
  function handleKioskSubmit(event){
    event.preventDefault();
    if(!pendingScan){showToast('Avval avtomat tekshiruv natijasi kelishi kerak.');return;}
    const id=$('kioskAccountId').value.trim();const target=findAccount(id);
    if(!/^[0-9]{8}$/.test(id)){showToast('ID aynan 8 ta raqamdan iborat bo‘lishi kerak.');return;}
    if(!target){showToast('Bu ID topilmadi. Amal bajarilmadi.');updateIdLookup();return;}
    const scan=pendingScan;stopIdTimeout();pendingScan=null;
    const date=new Date().toISOString();
    if(scan.kind==='contaminated'){
      const result=applyContamination(target,scan.item);
      if(result.kind==='alreadyBlocked'){
        target.history.push({id:scan.scanId,type:'contamination',amount:0,items:scan.item,date,level:'block'});
        showToast(result.message);
      }else{
        const msg=result.notification.level==='block'?'Blok muddati qo‘llandi.':'Ogohlantirish akkauntingizga yuborildi.';
        showToast(`${target.name} (${target.id}): ${msg}`);
      }
    }else{
      const kg=scan.kg;const amount=scan.amount;
      target.totalKg=Math.round((target.totalKg+kg)*10)/10;target.depositCount+=1;
      if(isBlocked(target)){
        target.history.push({id:scan.scanId,type:'blockedDeposit',kg,amount:0,station:scan.station,date,reason:'blocked'});
        showToast(`${kg.toFixed(1)} kg organik chiqindi qabul qilindi, ammo akkaunt bloklanganligi sababli bonus berilmadi.`);
      }else{
        target.balance+=amount;target.totalEarned+=amount;target.history.push({id:scan.scanId,type:'deposit',kg,amount,station:scan.station,date,measurementId:scan.scanId});
        showToast(`${kg.toFixed(1)} kg · ${money(amount)} so‘m ${target.name} (${target.id}) akkauntiga qo‘shildi.`);
      }
    }
    saveData();render();closeModal('kioskModal');resetKioskScanUI();
  }
  function beginWithdraw(){
    const a=currentAccount();
    if(isBlocked(a)){showToast(`Kartaga chiqarish bloklangan. ${formatUntil(a.blockedUntil)} dan keyin qayta urinib ko‘ring.`);return;}
    $('withdrawAmount').value='';$('withdrawAmount').max=String(a.balance);$('withdrawBalance').textContent=`${money(a.balance)} so‘m`;$('withdrawCard').textContent=a.cardLast4?`**** ${a.cardLast4}`:'Ulanmagan';$('withdrawCardOwner').textContent=a.cardLast4?(a.cardOwner||'Demo foydalanuvchi'):'Karta ulanmagan';openModal('withdrawModal');
  }

  document.addEventListener('click',event=>{
    const pageButton=event.target.closest('[data-page]');if(pageButton){navigate(pageButton.dataset.page);return;}
    const backButton=event.target.closest('[data-back]');if(backButton){goBack();return;}
    const closeButton=event.target.closest('[data-close]');if(closeButton){closeModal(closeButton.dataset.close);return;}
    const rewardButton=event.target.closest('[data-reward]');if(rewardButton){
      const reward=rewards.find(r=>r.id===rewardButton.dataset.reward);if(!reward)return;const a=currentAccount();
      if(isBlocked(a)){showToast(`Balansingiz bloklangan. ${formatUntil(a.blockedUntil)} gacha undan foydalanib bo‘lmaydi.`);return;}
      if(a.balance<reward.price){showToast('Bonus balansingiz yetarli emas.');return;}
      pendingReward=reward;$('redeemText').textContent=`${reward.name} mukofotini olishni tasdiqlaysizmi? Demo versiyada kupon kodi yaratiladi.`;$('redeemCost').textContent=`${money(reward.price)} so‘m`;openModal('redeemModal');
    }
  });
  $('openKiosk').addEventListener('click',beginKiosk);
  $('copyKioskPersonalId').addEventListener('click',async()=>{
    const id=currentAccount().id;
    try{await navigator.clipboard.writeText(id);showToast('ID raqamingiz nusxalandi.');}
    catch(error){const field=document.createElement('textarea');field.value=id;document.body.appendChild(field);field.select();try{document.execCommand('copy');showToast('ID raqamingiz nusxalandi.');}catch(e){showToast(`Sizning ID raqamingiz: ${id}`);}field.remove();}
  });
  $('openWithdraw').addEventListener('click',()=>{
    const account=currentAccount();
    if(isBlocked(account)){showToast(`Balansingiz saqlanadi, lekin ${formatUntil(account.blockedUntil)} gacha kartaga chiqarish yopiq.`);return;}
    if(!account.cardLast4){showToast('Avval profilingizda demo kartani bog‘lang.');navigate('account');return;}
    beginWithdraw();
  });
  $('openKioskDemo').addEventListener('click',()=>{const type=$('homeDemoScanType').value;beginKiosk();startDemoScan(type);});
  $('kioskAccountId').addEventListener('input',updateIdLookup);
  $('kioskForm').addEventListener('submit',handleKioskSubmit);
  $('markWarningsRead').addEventListener('click',()=>{currentAccount().notifications.forEach(n=>n.read=true);saveData();renderWarnings();showToast('Barcha ogohlantirishlar o‘qilgan deb belgilandi.');});
  $('withdrawForm').addEventListener('submit',event=>{
    event.preventDefault();const a=currentAccount();const amount=Number($('withdrawAmount').value);
    if(isBlocked(a)){closeModal('withdrawModal');showToast(`Hisob bloklangan. Balansingiz saqlanadi; ${formatUntil(a.blockedUntil)} dan keyin kartaga chiqarishingiz mumkin.`);return;}
    if(!a.cardLast4){showToast('Avval profilingizda demo kartani bog‘lang.');closeModal('withdrawModal');navigate('account');return;}
    if(!Number.isFinite(amount)||amount<100||!Number.isInteger(amount)){showToast('Summani kamida 100 so‘m bo‘lgan butun son sifatida kiriting.');return;}
    if(amount>a.balance){showToast('Balansingizda buncha mablag‘ yo‘q.');return;}
    const date=new Date().toISOString();const requestId=makeTransactionId();a.balance-=amount;a.history.push({id:requestId,type:'withdrawal',amount,cardLast4:a.cardLast4,date,status:'demo'});a.withdrawals.push({id:requestId,amount,cardLast4:a.cardLast4,date,status:'demo'});
    saveData();render();closeModal('withdrawModal');showToast('Demo so‘rov qayd etildi. Bankka haqiqiy pul yuborilmadi.');
  });
  $('confirmRedeem').addEventListener('click',()=>{
    if(!pendingReward)return;const a=currentAccount();
    if(isBlocked(a)){closeModal('redeemModal');pendingReward=null;showToast(`Akkauntingiz bloklangan. Balansingiz saqlanadi va ${formatUntil(a.blockedUntil)} dan keyin ishlatish mumkin.`);return;}
    if(a.balance<pendingReward.price){showToast('Balans yetarli emas.');closeModal('redeemModal');return;}
    const code=makeTransactionId();const date=new Date().toISOString();a.balance-=pendingReward.price;a.history.push({id:makeTransactionId(),type:'redeem',title:pendingReward.name,amount:pendingReward.price,code,date});a.redemptions.push({rewardId:pendingReward.id,code,date});
    saveData();render();closeModal('redeemModal');pendingReward=null;showToast(`Demo kupon kodi: ${code}`);
  });
  $('profileForm').addEventListener('submit',event=>{event.preventDefault();const name=$('profileName').value.trim();if(!name){showToast('Ismingizni kiriting.');return;}currentAccount().name=name;saveData();render();showToast('Profil saqlandi.');});
  $('copyAccountId').addEventListener('click',async()=>{const id=currentAccount().id;try{await navigator.clipboard.writeText(id);showToast('8 xonali ID nusxalandi.');}catch(error){const field=document.createElement('textarea');field.value=id;document.body.appendChild(field);field.select();try{document.execCommand('copy');showToast('8 xonali ID nusxalandi.');}catch(e){showToast(`Sizning ID raqamingiz: ${id}`);}field.remove();}});
  $('accountSelect').addEventListener('change',event=>{const target=findAccount(event.target.value);if(!target){showToast('Akkaunt topilmadi.');return;}appData.currentAccountId=target.id;saveData();render();renderAccount();showToast(`${target.name} akkauntiga o‘tdingiz.`);});
  $('newAccountBtn').addEventListener('click',()=>{$('newAccountForm').reset();openModal('newAccountModal');});
  $('newAccountForm').addEventListener('submit',event=>{event.preventDefault();const name=$('newAccountName').value.trim();if(!name){showToast('Ismni kiriting.');return;}try{const existing=new Set(appData.accounts.map(a=>a.id));const account=newAccount(name,existing);appData.accounts.push(account);appData.currentAccountId=account.id;saveData();render();renderAccount();closeModal('newAccountModal');showToast(`Yangi akkaunt yaratildi. ID: ${account.id}`);}catch(error){showToast(error.message||'Akkaunt yaratilmadi.');}});
  $('cardNumberDemo').addEventListener('input',()=>{
    const digits=$('cardNumberDemo').value.replace(/\D/g,'').slice(0,16);
    $('cardNumberDemo').value=digits.replace(/(.{4})/g,'$1 ').trim();
    $('cardOwnerPanel').hidden=digits!=='0000000000000000';
  });
  $('cardForm').addEventListener('submit',event=>{
    event.preventDefault();const digits=$('cardNumberDemo').value.replace(/\D/g,'');
    if(digits!=='0000000000000000'){showToast('Demo uchun faqat 0000 0000 0000 0000 raqami ishlaydi. Haqiqiy karta raqamini kiritmang.');return;}
    const a=currentAccount();a.cardLast4='0000';a.cardOwner='Demo Foydalanuvchi';saveData();render();renderAccount();
    $('cardStatus').textContent='Ulandi: **** 0000 · Demo Foydalanuvchi (bank tasdig‘i emas).';
    showToast('Demo karta bog‘landi. Haqiqiy bank kartasi ulanmagan.');
  });
  $('exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({app:'BIO-BONUS',exportedAt:new Date().toISOString(),appData},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='bio-bonus-malumotlar.json';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);showToast('Ma’lumot fayli yuklab olindi.');});
  $('resetData').addEventListener('click',()=>{const confirmed=window.confirm('Ushbu brauzerdagi barcha demo akkauntlar, balanslar va tarix o‘chirilsinmi?');if(!confirmed)return;appData=createDefaultData();saveData();render();renderAccount();navigate('home');showToast('Demo ma’lumotlar tozalandi.');});
  document.querySelectorAll('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeModal(backdrop.id);}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.modal-backdrop.show').forEach(m=>closeModal(m.id));});

  const today=new Intl.DateTimeFormat('uz-UZ',{weekday:'long',day:'numeric',month:'long'}).format(new Date());$('todayLabel').textContent=today.charAt(0).toUpperCase()+today.slice(1);
  window.addEventListener('focus',()=>render());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  saveData();render();
})();
