const DATA_URL = './data/entries.json';
const els = {
  search: document.querySelector('#searchInput'), town: document.querySelector('#townFilter'),
  watchTown: document.querySelector('#watchTown'), watchList: document.querySelector('#watchList'),
  addWatch: document.querySelector('#addWatchBtn'), results: document.querySelector('#results'),
  count: document.querySelector('#resultCount'), updated: document.querySelector('#lastUpdated'),
  refresh: document.querySelector('#refreshBtn'), notify: document.querySelector('#notifyBtn'),
  install: document.querySelector('#installBtn'), status: document.querySelector('#statusBox')
};
let entries = [], deferredPrompt = null;
const WATCH_KEY = 'mkk-watch-towns';
const SEEN_KEY = 'mkk-seen-ids';

function clean(s=''){ return s.toLocaleLowerCase('de').normalize('NFD').replace(/\p{Diacritic}/gu,''); }
function watchTowns(){ try{return JSON.parse(localStorage.getItem(WATCH_KEY)||'[]')}catch{return []} }
function setWatchTowns(v){ localStorage.setItem(WATCH_KEY,JSON.stringify(v)); syncPrefsToSW(); renderWatchList(); }
function fmtDate(v){ if(!v) return '–'; const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('de-DE'); }
function showStatus(msg){ els.status.textContent=msg; els.status.hidden=!msg; }

async function loadData({fresh=false}={}){
  els.refresh.disabled=true;
  try{
    const r=await fetch(`${DATA_URL}${fresh?'?t='+Date.now():''}`,{cache:fresh?'no-store':'default'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    entries=(data.entries||[]).sort((a,b)=>(b.first_seen||'').localeCompare(a.first_seen||''));
    els.updated.textContent=data.generated_at?new Date(data.generated_at).toLocaleString('de-DE'):'–';
    populateTowns(); render(); await detectNewEntries(); showStatus('');
  }catch(e){
    showStatus('Die aktuellen Daten konnten gerade nicht geladen werden. Die amtliche Quelle kann weiterhin direkt geöffnet werden.');
  }finally{ els.refresh.disabled=false; }
}

function populateTowns(){
  const towns=[...new Set(entries.map(x=>x.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
  const current=els.town.value, watchCurrent=els.watchTown.value;
  els.town.innerHTML='<option value="">Alle Orte</option>'+towns.map(t=>`<option>${escapeHtml(t)}</option>`).join('');
  els.watchTown.innerHTML='<option value="">Ort auswählen …</option>'+towns.map(t=>`<option>${escapeHtml(t)}</option>`).join('');
  if(towns.includes(current)) els.town.value=current;
  if(towns.includes(watchCurrent)) els.watchTown.value=watchCurrent;
}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function render(){
  const q=clean(els.search.value), town=els.town.value;
  const filtered=entries.filter(e=>{
    const hay=clean([e.name,e.street,e.postal_code,e.city,e.summary].join(' '));
    return (!q||hay.includes(q)) && (!town||e.city===town);
  });
  els.count.textContent=filtered.length;
  if(!filtered.length){ els.results.innerHTML='<div class="panel empty">Keine passenden MKK-Veröffentlichungen gefunden.</div>'; return; }
  els.results.innerHTML=filtered.map(e=>`<article class="card">
    <div class="card-head"><div><h3>${escapeHtml(e.name||'Unbenannter Betrieb')}</h3><div class="address">${escapeHtml([e.street,[e.postal_code,e.city].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</div></div>${e.resolved?'<span class="tag good">Mängel laut Veröffentlichung behoben</span>':''}</div>
    <p class="summary">${escapeHtml(e.summary||'Keine Kurzbeschreibung verfügbar.')}</p>
    <div class="meta"><span class="tag">Main-Kinzig-Kreis</span>${e.detected_date?`<span class="tag">Festgestellt: ${escapeHtml(e.detected_date)}</span>`:''}${e.published_date?`<span class="tag">Veröffentlicht: ${escapeHtml(e.published_date)}</span>`:''}${e.first_seen?`<span class="tag">Erstmals erfasst: ${fmtDate(e.first_seen)}</span>`:''}</div>
    <a href="${escapeHtml(e.url||'https://verbraucherfenster.hessen.de/ernaehrung/sichere-lebensmittel/veroeffentlichung-maengel-lfgb')}" target="_blank" rel="noopener">Amtliche Detailansicht →</a>
  </article>`).join('');
}

function renderWatchList(){
  const list=watchTowns();
  els.watchList.innerHTML=list.length?list.map(t=>`<span class="chip">${escapeHtml(t)} <button data-town="${escapeHtml(t)}" aria-label="${escapeHtml(t)} entfernen">×</button></span>`).join(''):'<span class="chip">Alle Orte im Main-Kinzig-Kreis</span>';
}
els.watchList.addEventListener('click',e=>{ const t=e.target.dataset.town; if(t) setWatchTowns(watchTowns().filter(x=>x!==t)); });
els.addWatch.addEventListener('click',()=>{ const t=els.watchTown.value; if(!t)return; setWatchTowns([...new Set([...watchTowns(),t])]); });
els.search.addEventListener('input',render); els.town.addEventListener('change',render); els.refresh.addEventListener('click',()=>loadData({fresh:true}));

async function enableNotifications(){
  if(!('Notification' in window)){ showStatus('Dieser Browser unterstützt keine Systembenachrichtigungen.'); return; }
  const p=await Notification.requestPermission();
  if(p!=='granted'){ showStatus('Benachrichtigungen wurden nicht freigegeben.'); return; }
  localStorage.setItem('mkk-notify','1');
  els.notify.textContent='Benachrichtigungen aktiv';
  await syncPrefsToSW();
  try{
    const reg=await navigator.serviceWorker.ready;
    if('periodicSync' in reg){ await reg.periodicSync.register('mkk-check',{minInterval:6*60*60*1000}); }
  }catch{}
  showStatus('Benachrichtigungen sind aktiviert. Android/Chrome kann im Hintergrund regelmäßig prüfen; zusätzlich wird bei jedem Öffnen der App geprüft.');
}
els.notify.addEventListener('click',enableNotifications);

async function detectNewEntries(){
  const ids=entries.map(e=>e.id); let seen=[];
  try{seen=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]')}catch{}
  if(!seen.length){ localStorage.setItem(SEEN_KEY,JSON.stringify(ids)); return; }
  const watched=watchTowns();
  const fresh=entries.filter(e=>!seen.includes(e.id) && (!watched.length||watched.includes(e.city)));
  localStorage.setItem(SEEN_KEY,JSON.stringify(ids.slice(0,500)));
  if(fresh.length && localStorage.getItem('mkk-notify')==='1' && Notification.permission==='granted'){
    const reg=await navigator.serviceWorker.ready;
    await reg.showNotification('Neue MKK-Hygieneveröffentlichung',{body:fresh.length===1?`${fresh[0].name} · ${fresh[0].city}`:`${fresh.length} neue Einträge im beobachteten Bereich`,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'mkk-new'});
  }
}

async function syncPrefsToSW(){
  if(!('serviceWorker' in navigator))return;
  const reg=await navigator.serviceWorker.ready.catch(()=>null); if(!reg)return;
  (reg.active||reg.waiting||reg.installing)?.postMessage({type:'SET_PREFS',towns:watchTowns(),notifications:localStorage.getItem('mkk-notify')==='1'});
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(syncPrefsToSW).catch(()=>{});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;els.install.hidden=false});
els.install.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;els.install.hidden=true});
if(localStorage.getItem('mkk-notify')==='1') els.notify.textContent='Benachrichtigungen aktiv';
renderWatchList(); loadData();
