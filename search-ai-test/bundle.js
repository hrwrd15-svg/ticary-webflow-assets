window.__asInit_v5 = true;
window.__asInit_v6 = true;
window.__asComplete = true;

(function(){
  // =========================
  // CONFIG
  // =========================
  var SNAPSHOT_INDEX = 'https://raw.githubusercontent.com/hrwrd15-svg/vehicle_snapshot/main/cars_index.json?_=' + Date.now();
  var SNAPSHOT_BASE  = 'https://raw.githubusercontent.com/hrwrd15-svg/vehicle_snapshot/main/';
  var API      = 'https://vehicle-api-espm.onrender.com/cars?_=' + Date.now();
  var PAGE_SIZE_BOOT = 24;

  // expose early so Part B can "wait" safely
  window.__ticaryCars = window.__ticaryCars || [];

  function log(){ try{ console.log.apply(console, ['[ticary:eop1]'].concat([].slice.call(arguments))); }catch(_){} }

  // =========================
  // HELPERS
  // =========================
  function parseJSON(txt){
    try{
      var j = JSON.parse(txt);
      if (Array.isArray(j)) return j;
      if (j && Array.isArray(j.cars)) return j.cars;
    }catch(e){}
    return null;
  }

  function num(v){
    var n = String(v ?? '').replace(/[^0-9.\-]/g,'');
    return n ? Number(n) : NaN;
  }

  function hasCoords(c){
    if (!c) return false;
    var lat = c.latitude ?? c.lat ?? c.dealer_lat;
    var lng = c.longitude ?? c.lng ?? c.dealer_lng;
    return isFinite(num(lat)) && isFinite(num(lng));
  }

  function safe(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function money(n){
    if(n==null || n==='' || !isFinite(Number(n))) return 'POA';
    var v = Math.round(Number(n));
    return '£' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  }

  function miles(n){
    if(n==null || n==='' || !isFinite(Number(n))) return '';
    return (Math.round(Number(n))).toLocaleString('en-GB') + ' miles';
  }

function isUK(lat, lng){
  lat = num(lat);
  lng = num(lng);
  return isFinite(lat) && isFinite(lng) && lat >= 49.5 && lat <= 61.5 && lng >= -8.8 && lng <= 2.2;
}

  function ensureCoords(c){
  var lat = c.latitude ?? c.lat ?? c.dealer_lat ?? '';
  var lng = c.longitude ?? c.lng ?? c.dealer_lng ?? '';

  // Reject non-UK coords so the map never plots overseas pins
  if (!isUK(lat, lng)) return { lat:'', lng:'' };

  return { lat:String(lat||''), lng:String(lng||'') };
}


  // =========================
  // CARD RENDERER (Part B calls this)
  // =========================
  function cardHTML(c){

  // ---------- helpers ----------
  function pick(keys){
    for (var i=0;i<keys.length;i++){
      var k = keys[i];
      var v = (c && c[k] != null) ? c[k] : null;
      if (v !== null && v !== undefined){
        var s = String(v).trim();
        if (s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'nan') return v;
      }
    }
    return '';
  }

  function normalizeImgUrl(u){
    var s = String(u || '').trim();
    if (!s) return '';
    if (s.indexOf('alexandersprestige.co.uk/_next/image') !== -1) {
      var m = s.match(/[?&]url=([^&]+)/);
      if (m && m[1]) {
        try { return decodeURIComponent(m[1]); } catch(e) { return m[1]; }
      }
    }
    return s;
  }

  function svg(icon){
    // All icons inherit colour from CSS via currentColor
    if (icon === 'year'){
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 3v2M17 3v2M4 8h16"/><path fill="none" stroke="currentColor" stroke-width="2" d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';
    }
    if (icon === 'miles'){
  return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>"
    + "<path d='M20 13a8 8 0 1 0-16 0'/>"
    + "<path d='M12 13l4-4'/>"
    + "<path d='M6 19h12'/>"
    + "</svg>";
   }

    if (icon === 'fuel'){
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 21V4a1 1 0 0 1 1-1h8v9H6"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15 8h2l2 2v9a2 2 0 0 1-2 2h-2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15 12h2v3a1 1 0 0 0 1 1"/></svg>';
    }
    // gearbox
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v8"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M8 6h8"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 10l-4 4"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 10l4 4"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M8 14v8"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 14v8"/></svg>';
  }

  function chip(iconKey, text){
    if (!text) return '';
    return ''
      + '<span class="as-chip" role="listitem">'
      +   '<span class="as-chip-ic" aria-hidden="true">'+svg(iconKey)+'</span>'
      +   '<span class="as-chip-t">'+safe(text)+'</span>'
      + '</span>';
  }

  // ---------- fields ----------
  var k   = ensureCoords(c);

  var make  = pick(['make']);
  var model = pick(['model']);
  var variant = pick(['variant','edition','trim','variants']);

  var year = pick(['year']);
  var mileageRaw = pick(['mileage_mi','mileage']);
  var fuel = pick(['fuel_type','fuel']);
  var trans = pick(['transmission','gearbox']);

  var dealerName = pick(['dealer_name','dealer','dealerName']);
  var phone = pick(['seller_phone','phone','dealer_phone']); // will only show if present
  var city = pick(['city','town']);
  var county = pick(['county']);
  var postcode = pick(['postal_code','postcode']);

  var img = normalizeImgUrl(pick(['image_cover_url','thumb','primary_image','image','cover','image_url']));
  var href = pick(['listing_url','url']) || '#';

  var chipYear  = year ? String(year) : '';
  var chipMiles = mileageRaw ? miles(mileageRaw) : '';
  var chipFuel  = fuel ? String(fuel) : '';
  var chipTrans = trans ? String(trans) : '';

  var locationLine = [city, county].filter(Boolean).join(', ');
  if (!locationLine) locationLine = [postcode].filter(Boolean).join(' ');

  return ''
  + '<div class="w-dyn-item" role="listitem">'
  +   '<article class="as-card"'
  +     ' data-lat="'+safe(k.lat)+'"'
  +     ' data-lng="'+safe(k.lng)+'"'
  +     ' data-vehicle-id="'+safe(c.id||'')+'"'
  +     ' data-url="'+safe(href)+'">'

  +     '<a class="as-media as-link" href="'+safe(href)+'" target="_blank" rel="noopener">'
  +       '<span class="as-price-badge">'+safe(money(c.price_gbp))+'</span>'
  +       '<span class="as-thumb" aria-hidden="true" style="'+(img ? ('background-image:url('+String(img).replace(/"/g,'%22')+');') : '')+'"></span>'
  +     '</a>'

  +     '<div class="as-body">'

  +       '<div class="as-titleRow">'
  +         '<span class="as-make" fs-list-field="make">'+safe(make)+'</span>'
  +         '<span class="as-model" fs-list-field="model">'+safe(model)+'</span>'
  +       '</div>'

  +       '<div class="as-line as-edition" fs-list-field="edition">'+safe(variant)+'</div>'

  +       '<div class="as-chips" role="list" aria-label="Key specs">'
  +         chip('year',  chipYear)
  +         chip('miles', chipMiles)
  +         chip('fuel',  chipFuel)
  +         chip('gear',  chipTrans)
  +       '</div>'

  +       '<div class="as-bottom">'
  +         '<div class="as-dealer">'
  +           (dealerName ? '<div class="as-dealerName">'+safe(dealerName)+'</div>' : '')
  +           (locationLine ? '<div class="as-dealerMeta">'+safe(locationLine)+'</div>' : '')
  +           (phone ? '<div class="as-dealerPhone">'+safe(phone)+'</div>' : '')
  +         '</div>'

  +         '<div class="as-actions">'
  +           '<a class="as-cta as-view" href="'+safe(href)+'" target="_blank" rel="noopener">View details</a>'
  +           '<div class="as-financeWrap" aria-label="Finance">'
  +             '<div class="as-financeLabel">Finance</div>'
  +             '<span class="as-finance-inline" fs-list-field="finance_monthly" style="display:none;"></span>'
  +           '</div>'
  +         '</div>'
  +       '</div>'

  +     '</div>'
  +   '</article>'
  + '</div>';
}


  try{ window.__ticaryCardHTML = window.__ticaryCardHTML || cardHTML; }catch(e){}

  // =========================
  // LIST TARGETING (STRICT)
  // =========================
  function getListInner(){
    return (
      document.getElementById('vehiclesList') ||
      document.querySelector('#as-grid .w-dyn-items') ||
      document.querySelector('#as-grid [role="list"]') ||
      document.querySelector('.w-dyn-items') ||
      document.querySelector('[role="list"]')
    );
  }

  // =========================
  // DATA LOADING
  // =========================
  async function fetchText(url){
    var r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  }

  async function loadSnapshotCarsChunked(){
    // cars_index.json format:
    // { "files": ["cars_000.json", "cars_001.json", ...], "total": 160123 }
    var idxTxt = await fetchText(SNAPSHOT_INDEX);
    var idx;
    try{ idx = JSON.parse(idxTxt); }catch(e){ idx = null; }
    if (!idx || !Array.isArray(idx.files) || !idx.files.length) return null;

    var out = [];
    for (var i=0; i<idx.files.length; i++){
      var file = idx.files[i];
      var url = SNAPSHOT_BASE + file + '?_=' + Date.now();
      var txt = await fetchText(url);
      var arr = parseJSON(txt); // parseJSON supports arrays and {cars:[]}
      if (arr && arr.length) out = out.concat(arr);
    }
    return out.length ? out : null;
  }

  async function loadCars(){
    // 1) snapshot (chunked: avoids GitHub 100MB limit)
    try{
      var snapCars = await loadSnapshotCarsChunked();
      if (snapCars && snapCars.length){
        // if snapshot looks like it lacks coords, fall through to live API
        var ok = hasCoords(snapCars[0]);
        if (ok){
          log('using snapshot (chunked)', snapCars.length);
          return snapCars;
        }
        log('snapshot missing coords → will try live API');
      } else {
        log('snapshot empty → will try live API');
      }
    }catch(e){
      log('snapshot failed → will try live API', e && e.message);
    }

    // 2) live API fallback
    try{
      var apiTxt = await fetchText(API);
      var apiCars = parseJSON(apiTxt);
      if (apiCars && apiCars.length){
        log('using live API', apiCars.length);
        return apiCars;
      }
    }catch(e2){
      log('live API failed', e2 && e2.message);
    }

    return [];
  }

  function renderInitial(listInner, cars){
    // render only first 24 to keep DOM light; Part B will take over
    var n = Math.min(PAGE_SIZE_BOOT, cars.length);
    var html = '';
    for (var i=0;i<n;i++) html += cardHTML(cars[i]);
    listInner.innerHTML = html || '<div class="as-no-results" style="padding:16px;">No cars available.</div>';
    listInner.setAttribute('data-as-grid','1');
  }

  // =========================
  // BOOT
  // =========================
  function boot(tries){
    tries = tries || 0;
    var listInner = getListInner();
    if (!listInner){
      if (tries < 80) return setTimeout(function(){ boot(tries+1); }, 100);
      log('❌ could not find vehicles list (#vehiclesList / #as-grid)');
      return;
    }

    // kill the Webflow CMS 24 *visually* immediately (prevents seeing “wrong” list)
    // (we'll render our own 24 as soon as data arrives)
    listInner.innerHTML = '';

    loadCars().then(function(cars){

  function ukBounds(lat, lng){
    lat = num(lat); lng = num(lng);
    return (
      isFinite(lat) && isFinite(lng) &&
      lat >= 49.5 && lat <= 61.5 &&
      lng >= -8.8 && lng <= 2.2
    );
  }

  function normalizeCoords(c){
    var lat = c.latitude ?? c.lat ?? c.dealer_lat;
    var lng = c.longitude ?? c.lng ?? c.dealer_lng;

    lat = num(lat);
    lng = num(lng);

    // Detect swapped lat/lng (VERY common in your data)
    if (
      lat >= -8.8 && lat <= 2.2 &&
      lng >= 49.5 && lng <= 61.5
    ){
      var t = lat; lat = lng; lng = t;
    }

    // If still not UK, nuke coords so map can't plot it
    if (!ukBounds(lat, lng)){
      c.latitude = null;
      c.longitude = null;
      return c;
    }

    c.latitude = lat;
    c.longitude = lng;
    // keep main coords canonical; clear alternates ONLY after we have good UK coords
    c.lat = null;
    c.lng = null;
  
    return c;
  }

  function hasValidPrice(c){
  var p = num(c.price_gbp ?? c.price ?? '');
  return isFinite(p) && p > 0;
}

window.__ticaryCars = Array.isArray(cars)
  ? cars.filter(hasValidPrice).map(normalizeCoords)
  : [];


  renderInitial(listInner, window.__ticaryCars);

  try{
    if (typeof window.__ticaryApply === 'function') window.__ticaryApply();
  }catch(e){}

  log('✅ cars ready:', (window.__ticaryCars||[]).length);

        // Signal to Part B (and anything else) that cars are now available
  try { window.dispatchEvent(new Event('ticary:cars-ready')); } catch(e){}

  // Race-proof: if Part B defines __ticaryApply slightly later, call again
  setTimeout(function(){
    try{ if (typeof window.__ticaryApply === 'function') window.__ticaryApply(); }catch(e){}
  }, 0);
  setTimeout(function(){
    try{ if (typeof window.__ticaryApply === 'function') window.__ticaryApply(); }catch(e){}
  }, 250);
});

  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ boot(0); });
  } else {
    boot(0);
  }
})();

// Facet option renderer (kept separate to avoid Webflow 50k embed limit)
  window.setFacetOptions = function(selectEl, facetArr, selectedValue, total, emptyLabel){
    if (!selectEl) return;

    selectEl.innerHTML = '';
    selectEl.appendChild(new Option(emptyLabel || 'Any', ''));

    (facetArr || []).forEach(row => {
      const v = row.value;
      if (!v) return;

      const n = Number(row.count || 0);

      // If option is currently selected, show CURRENT TOTAL
      const labelCount = (selectedValue && v === selectedValue) ? Number(total || 0) : n;

      selectEl.appendChild(
        new Option(`${v} (${labelCount.toLocaleString('en-GB')})`, v)
      );
    });
  };

(function () {
  if (document.getElementById('tc-ai-search-top')) return;
  const wrapper = document.getElementById('as-filters');
  if (!wrapper) return;

  const wrap = document.createElement('div');
  wrap.id = 'tc-ai-search-top';
  wrap.className = 'tc-aiTopWrap';

  /* Blob+spark layer: sibling to button, all animation lives here */
  const blobLayer = document.createElement('div');
  blobLayer.className = 'tc-aiBlobLayer';

  const btn = document.createElement('a');
  btn.href = 'https://ticary.co.uk/ai-search';
  btn.className = 'tc-aiTopBtn';
  /* btn innerHTML is set once and never touched again */
  btn.innerHTML = `
    <span>Try Ticary AI Search</span>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="16.65" y1="16.65" x2="21" y2="21"></line>
    </svg>`;

  wrap.appendChild(blobLayer);
  wrap.appendChild(btn);
  wrapper.insertBefore(wrap, wrapper.firstChild);

  /* ── Blobs ── */
  const blobs = [
    { color:'rgba(124,58,237,.95)',  size:90,  x:12,  y:50, dur:7200,  dx:38,  dy:14  },
    { color:'rgba(236,72,153,.9)',   size:80,  x:78,  y:45, dur:9000,  dx:-30, dy:22  },
    { color:'rgba(99,102,241,.85)',  size:70,  x:48,  y:55, dur:11000, dx:22,  dy:-20 },
  ];

  blobs.forEach(b => {
    const el = document.createElement('span');
    el.className = 'tc-aiBlob';
    el.style.cssText = `
      width:${b.size}px;
      height:${b.size}px;
      background:radial-gradient(circle at 40% 40%, ${b.color}, transparent 70%);
      filter:blur(18px);
      left:${b.x}%;
      top:50%;
      transform:translate(-50%,-50%);
    `;
    blobLayer.appendChild(el);

    el.animate([
      { transform:'translate(-50%,-50%) scale(1)' },
      { transform:`translate(calc(-50% + ${b.dx}px), calc(-50% + ${b.dy}px)) scale(1.15)` },
      { transform:`translate(calc(-50% - ${b.dx*.5}px), calc(-50% + ${b.dy*.3}px)) scale(.9)` },
      { transform:'translate(-50%,-50%) scale(1)' },
    ], { duration:b.dur, iterations:Infinity, easing:'ease-in-out', direction:'alternate' });
  });

  /* ── Sparks: also go into blobLayer, never into btn ── */
  const cols = [
    'rgba(167,139,250,.95)',
    'rgba(236,72,153,.95)',
    'rgba(255,255,255,.9)',
    'rgba(99,102,241,.95)',
    'rgba(244,114,182,.9)',
  ];

  function spawnSpark(big) {
    const s = document.createElement('span');
    s.className = 'tc-aiSpark';
    const size = big ? 6 + Math.random()*8 : 3 + Math.random()*5;
    const dur  = (.55 + Math.random()*.75).toFixed(2);
    const col  = cols[Math.floor(Math.random()*cols.length)];
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${5 + Math.random()*90}%;
      top:${10 + Math.random()*80}%;
      background:${col};
      box-shadow:0 0 ${size+4}px ${col};
      --d:${dur}s;
    `;
    blobLayer.appendChild(s);
    setTimeout(() => s.remove(), dur*1000 + 120);
  }

  setInterval(() => spawnSpark(false), 400);
  btn.addEventListener('mouseenter', () => {
    for (let i = 0; i < 10; i++) setTimeout(() => spawnSpark(true), i*50);
  });
})();

/* Ticary shim: Part B expects `scope` to be a DOM root with querySelector */
window.scope = window.scope || document;

(function bootPartB(tries) {
  tries = typeof tries === 'number' ? tries : 0;
  if (window.__ticaryPartBLoaded) return;
  window.__ticaryPartB = 'booting';
  // Bind global error logging ONCE (do not rebind on every bootPartB retry)
  if (!window.__ticaryPartBErrBound) {
    window.__ticaryPartBErrBound = true;

    window.addEventListener('error', function (ev) {
      try {
        var msg  = (ev && ev.message) ? ev.message : 'Script error.';
        var src  = (ev && ev.filename) ? ev.filename : '';
        var line = (ev && ev.lineno) ? ev.lineno : '';
        var col  = (ev && ev.colno) ? ev.colno : '';

        console.warn('[ticary:partB] global error:', msg, src, String(line) + ':' + String(col));

        if (ev && ev.error && ev.error.stack) {
          console.warn(ev.error.stack);
        }
      } catch (_) {}
    });

    window.addEventListener('unhandledrejection', function (ev) {
      try {
        var reason = ev && ev.reason;
        console.warn('[ticary:partB] unhandled rejection:', reason);
        if (reason && reason.stack) console.warn(reason.stack);
      } catch (_) {}
    });
  }


  // Style for the bottom Clear all button
  if (!window.__asfClearStyled) {
    window.__asfClearStyled = true;
    const style = document.createElement('style');
    style.textContent = `
      .asf-controls .asf-clear-main {
        background: #3fb1ce !important;
        color: #ffffff !important;
        border: none !important;
        width: 100%;
        border-radius: 999px;
        font-weight: 600;
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
        transition: box-shadow 0.2s ease, transform 0.1s ease;
      }
      .asf-controls .asf-clear-main:hover {
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.5); /* red glow */
        transform: translateY(-1px);
      }
    `;
    document.head.appendChild(style);
  }

  // Tighten spacing above "Postcode or address" in Distance box
  (function(){
    if (window.__asfDistanceTightened) return;
    window.__asfDistanceTightened = true;
    const style = document.createElement('style');
    style.textContent = `
      .asf-sec#asf-distance .asf-body > .row:first-of-type {
        margin-top: -6px;
      }
    `;
    document.head.appendChild(style);
  })();

  const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGF6d2FyLWQiLCJhIjoiY21mMmxncXhzMXJ5aTJqcXl0NjR3MHhvbSJ9.LxklMmgRSbTmC6NG2JrXQQ';
  const PAGE_SIZE   = 24;
  let state = null; // IMPORTANT: avoids "Cannot access 'state' before initialization"


  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const num = (t) => { const n = String(t ?? '').replace(/[^0-9.\-]/g, ''); return n ? Number(n) : NaN; };
  const uniqueSorted = (a) => {
  const arr = Array.from(new Set((a || []).filter(v => v !== null && v !== undefined && v !== '')));
  return arr.sort((x, y) => String(x).localeCompare(String(y), 'en', { numeric: true }));
};


  // Show engine sizes nicely (e.g. 1.0L, 1.5L, 2.0L) but keep raw numeric values
  const formatEngineLabel = (v) => {
    const n = num(v);
    if (!isFinite(n) || n <= 0) return v;
    const rounded = Math.round(n * 10) / 10;
    return `${rounded.toFixed(1)}L`;
  };

  const distMiles = (a, b) => {
    if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return NaN;
    const R = 3958.7613, toR = d => d * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const getThumb = (card) => {
    const img = card.querySelector('img.as-thumb');
    if (img?.src) return img.src;
    const el = card.querySelector('.as-thumb');
    if (!el) return '';
    const s = el.getAttribute('style') || getComputedStyle(el).backgroundImage || '';
    const m = s.match(/url\(["']?([^"')]+)["']?\)/i);
    return m ? m[1] : '';
  };

  // ✅ Always target the cars list ONLY (prevents nuking other Webflow lists)
const listInner =
  document.getElementById('vehiclesList') ||
  document.querySelector('#as-grid .w-dyn-items') ||
  document.querySelector('#as-grid [role="list"]');

  if (!listInner) {
    if (tries < 40) {
      return setTimeout(() => bootPartB(tries + 1), 100);
    }
    console.error('❌ No list for Ticary Part B after waiting');
    return;
  }
  window.__ticaryPartB = 'starting';
  listInner.setAttribute('data-as-grid', '1');

// ✅ Wait for data before proceeding (event-based + fallback, no duplicates)
if (!Array.isArray(window.__ticaryCars) || window.__ticaryCars.length === 0) {

  // bind once: wake Part B when Part A finishes
  if (!window.__ticaryWaitCarsBound) {
    window.__ticaryWaitCarsBound = true;
    window.addEventListener('ticary:cars-ready', function(){
      try { bootPartB(0); } catch(e) {}
    }, { once: true });
  }

  // keep waiting longer (chunked snapshot can take time)
  if (tries < 300) return setTimeout(function(){ bootPartB(tries + 1); }, 200);

  console.error('❌ window.__ticaryCars never became available (timeout)');
  return;
}

// also wait until at least one card exists (prevents Part B running too early)
if (!document.querySelector('.as-card')) {
  if (tries < 120) return setTimeout(function(){ bootPartB(tries + 1); }, 120);
  console.warn('❌ cards never rendered (timeout)');
  return;
}

    // ✅ Build from full dataset in memory (NOT from DOM)
  const rawCars = Array.isArray(window.__ticaryCars) ? window.__ticaryCars : [];
  const items = rawCars.map((car) => {
    car = car || {};

    // ✅ Compatibility aliases for older map/popup code (Part C)
    try {
      // URL / navigation
      car.url = car.url || car.listing_url || car.listingUrl || '';

      // Price fields
      car.price = car.price ?? car.price_gbp ?? car.priceGBP ?? null;
      car.finance_monthly = car.finance_monthly ?? car.finance_monthly_gbp ?? car.financeMonthly ?? null;

      // Images (pick a sensible “primary”)
      const cover =
        car.image_cover_url ||
        car.image_cover ||
        car.cover_image_url ||
        car.cover_url ||
        car.hero_image_url ||
        '';

      const imgs =
        car.images ||
        car.image_urls ||
        car.imageUrls ||
        car.photos ||
        car.photo_urls ||
        car.gallery ||
        car.gallery_urls ||
        [];

      const firstImg = Array.isArray(imgs) ? (imgs[0] || '') : (imgs || '');

      car.primary_image =
        car.primary_image ||
        car.primaryImage ||
        car.image ||
        car.image_url ||
        car.imageUrl ||
        car.main_image ||
        car.mainImage ||
        cover ||
        firstImg ||
        '';

      // Also expose “thumb” alias (lots of map popups use this)
      car.thumb = car.thumb || car.primary_image || car.image_cover_url || cover || firstImg || '';
    } catch (e) {}

    const lat = num(car.latitude ?? car.lat ?? car.dealer_lat);
    const lng = num(car.longitude ?? car.lng ?? car.dealer_lng);

    const data = {
      id: String(car.id ?? '').trim(),
      make: String(car.make ?? '').trim(),
      model: String(car.model ?? '').trim(),
      edition: String((car.variant ?? car.variants ?? car.edition ?? car.trim ?? '')).trim(),
      fuel: String(car.fuel_type ?? '').trim(),
      gearbox: String(car.transmission ?? '').trim(),
      bodytype: String(car.body_type ?? '').trim(),
      color: String((car.colour ?? car.color ?? '')).trim(),
      engine: num(car.engine_size_l ?? car.engine_l ?? car.engine_size ?? car.engine),
      year: num(car.year),
      mileage: num(car.mileage_mi),
      price: num(car.price ?? car.price_gbp ?? car.priceGBP),
      finance: num(car.finance_monthly_gbp ?? car.finance_monthly ?? car.finance),
      lat, lng,
      thumb: String(car.thumb || car.primary_image || car.image_cover_url || '').trim(),
      url: String(car.url || car.listing_url || '').trim(),
      dealer: String(car.dealer_name ?? car.dealer ?? car.dealerName ?? '').trim()
      
    };

    return { car, item: null, card: null, data };
  });

  // ✅ EXPOSE EARLY 
window.__ticaryItems = items;
window.__ticaryApply = function () {
  try {
    if (!state) return setTimeout(window.__ticaryApply, 50);
    apply();
  } catch (e) {
    console.error('❌ Part B apply() crashed', e);
  }
};



  // FAVOURITES: keep behaviour, but attach buttons AFTER render
  const loadFavs = () => { try { return JSON.parse(localStorage.getItem('as:favs') || '[]'); } catch { return []; } };
  const saveFavs = (ids) => { try { localStorage.setItem('as:favs', JSON.stringify(ids)); } catch {} };
  let favIDs = new Set(loadFavs());

  // expose for other embeds if needed
  window.__ticaryFavIDs = favIDs;
  window.__ticarySaveFavs = saveFavs;

  window.__ticaryEnsureFavButtons = function(scope){
    try{
      const cards = (scope || document).querySelectorAll('.as-card');
      cards.forEach((card) => {
        if (card.querySelector('.as-fav-btn')) return;

        const url = card.dataset.url || '';
        const vid = card.dataset.vehicleId || card.dataset.id || '';
        const id  = url || vid;
        if (!id) return;

        const btn = document.createElement('button');
        btn.className = 'as-fav-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Favourite');
        btn.setAttribute('aria-pressed', favIDs.has(id) ? 'true' : 'false');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M12.1 21.35c-.13 .09-.3 .09-.43 0C7.14 17.77 4 15.03 2.53 12.7 1.4 10.93 1.2 8.9 2.13 7.18 3.03 5.51 4.77 4.5 6.6 4.5c1.54 0 3.02.74 3.9 1.93.88-1.19 2.36-1.93 3.9-1.93 1.83 0 3.57 1.01 4.47 2.68.93 1.72.73 3.75-.4 5.52-1.47 2.33-4.61 5.07-9.37 8.65z"/>
          </svg>`;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const on = btn.getAttribute('aria-pressed') === 'true';
          const next = !on;
          btn.setAttribute('aria-pressed', next ? 'true' : 'false');

          if (next) favIDs.add(id);
          else favIDs.delete(id);

          saveFavs([...favIDs]);

          // keep your existing optional integrations
          if (state.favsOnly) apply();
          if (window.updateFavsPanel) window.updateFavsPanel();

          try{
            const v = Number(card.dataset.vehicleId || 0) || 0;
            if (window.tcFavSync) window.tcFavSync({ on: next, vehicle_id: v, url: (url || id) });
          }catch(e){}
        });

        card.appendChild(btn);
      });
    }catch(e){}
  };

  // Finance placeholder now also runs AFTER render
  window.__ticaryFinanceFix = function(scope){
    try{
      const cards = (scope || document).querySelectorAll('.as-card');
      cards.forEach((card) => {
        const finEl = card.querySelector('.as-finance-inline');
        if (!finEl) return;
        const n = num(finEl.textContent);
        if (!isFinite(n) || n <= 0) {
          finEl.textContent = 'Contact dealer for finance';
          finEl.classList.add('as-finance-inline--fallback');
        }
      });
    }catch(e){}
  };


  // GLOBAL LISTS FILTERS
  const allMakes     = uniqueSorted(items.map(x => x.data.make));
  const modelsByMake = {};

  items.forEach(({ data }) => {
    if (data.make)  (modelsByMake[data.make]  ||= new Set()).add(data.model);
  });

  Object.keys(modelsByMake).forEach(m => modelsByMake[m] = uniqueSorted([...modelsByMake[m]]));

  const fuels     = uniqueSorted(items.map(x => x.data.fuel));
  const gearboxes = uniqueSorted(items.map(x => x.data.gearbox));
  const bodytypes = uniqueSorted(items.map(x => x.data.bodytype)).filter(Boolean);
  const colours   = uniqueSorted(items.map(x => x.data.color)).filter(Boolean);
  const engines = Array.from(
  new Set(
    items
      .map(x => x.data.engine)
      .filter(v => {
        const n = num(v);
        return isFinite(n) && n > 0;
      })
      .map(v => Math.round(num(v) * 10) / 10)
  )
).sort((a, b) => a - b);


  const yearMin = Math.min(...items.map(x => isFinite(x.data.year) ? x.data.year : Infinity));
  const yearMax = Math.max(...items.map(x => isFinite(x.data.year) ? x.data.year : -Infinity));

   state = {
    sort: 'price-desc',
    shown: PAGE_SIZE,
    favsOnly: false,
    filters: {
      make: '', model: '', trim: '',
      fuel: '', gearbox: '', bodytype: '', colour: '',
      engineMin: '', engineMax: '',
      priceMin: '', priceMax: '', financeMin: '', financeMax: '',
      yearMin: '', yearMax: '', mileageMax: '', distance: '', origin: null
    },
    draft: null
  };
  window.state = state;
  let commitTimer = null;

  // BUILD FILTERS UI
  function buildFiltersUI() {
    const host = $('#as-filters-body') || $('#as-filters');
    if (!host || host.querySelector('.asf')) return;

    const sec = (id, title, body, open = false) => `
      <section class="asf-sec" id="${id}" data-open="${open ? 'true' : 'false'}">
        <header><h5>${title}</h5><span class="chev"></span></header>
        <div class="asf-body">${body}</div>
      </section>`;

    const html = `
      <div class="asf">
        ${sec('asf-distance', 'Distance', `
         <div class="row">
           <label for="asf-origin">Postcode or address</label>
           <div class="btnbar" style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap;">
            <input id="asf-origin" type="text" placeholder="e.g. SW1A 1AA or Bristol" style="flex:1 1 auto;min-width:0">
            <button type="button" id="asf-origin-set" class="btn pin">Set</button>
           </div>

           <button type="button" id="asf-use-loc" class="btn" style="margin-top:8px;width:100%;">Use my location</button>
           <div class="help" id="asf-loc-status"></div>
         </div>

         <div class="row">
            <div class="asf-distance-row">
              <button type="button" id="asf-dist-dec" class="btn asf-dist-step">−</button>

              <div class="as-range as-range--distance">
                <div class="as-range-track"></div>
                <input id="asf-distance-range" type="range" min="5" max="300" step="5" value="25" disabled>
              </div>

              <button type="button" id="asf-dist-inc" class="btn asf-dist-step">+</button>
            </div>
            <div class="help asf-distance-help">
              <span id="asf-distance-label">Within 25 miles</span>
            </div>
         </div>
        `, true)}

        ${sec('asf-vehicle', 'Vehicle', `
          <div class="row">
            <label for="asf-make">Make</label>
            <select id="asf-make">
              <option value="">Any</option>
            </select>
          </div>

          <div class="row">
            <label for="asf-model">Model</label>
            <select id="asf-model" disabled>
              <option value="">Choose make first</option>
            </select>
          </div>

          <div class="row">
            <label for="asf-trim">Variant</label>
            <input
              id="asf-trim"
              type="text"
              placeholder="Choose model first"
              autocomplete="off"
            >
          </div>

          <div class="grid-2" style="margin-bottom: 10px;">
            <div class="row">
              <label for="asf-engine-min">Engine min</label>
              <select id="asf-engine-min">
                <option value="">Any</option>
              </select>
            </div>
            <div class="row">
              <label for="asf-engine-max">Engine max</label>
              <select id="asf-engine-max">
                <option value="">Any</option>
              </select>
            </div>
          </div>

          <div class="grid-2">
            <div class="row">
              <label for="asf-fuel">Fuel</label>
              <select id="asf-fuel">
                <option value="">Any</option>
              </select>
            </div>
            <div class="row">
              <label for="asf-gear">Gearbox</label>
              <select id="asf-gear">
                <option value="">Any</option>
              </select>
            </div>
          </div>

          <div class="row" style="display:${bodytypes.length ? 'block' : 'none'}">
            <div class="grid-2">
              <div class="row">
                <label for="asf-bodytype">Body type</label>
                <select id="asf-bodytype">
                  <option value="">Any</option>
                </select>
              </div>
              <div class="row">
                <label for="asf-colour">Colour</label>
                <select id="asf-colour">
                  <option value="">Any</option>
                </select>
              </div>
            </div>
          </div>
        `, false)}

        ${sec('asf-year', 'Year', `
          <div class="grid-2">
            <div class="row">
              <label for="asf-year-min">Year from</label>
              <input id="asf-year-min" type="number" inputmode="numeric" placeholder="${isFinite(yearMin) ? yearMin : ''}">
            </div>
            <div class="row">
              <label for="asf-year-max">Year to</label>
              <input id="asf-year-max" type="number" inputmode="numeric" placeholder="${isFinite(yearMax) ? yearMax : ''}">
            </div>
          </div>
        `, false)}

        ${sec('asf-price', 'Price', `
          <div class="grid-2">
            <div class="row">
              <label for="asf-price-min">Price min</label>
              <select id="asf-price-min">
                <option value="">Any</option>
                <option value="500">£500</option>
                <option value="1000">£1,000</option>
                <option value="1500">£1,500</option>
                <option value="2000">£2,000</option>
                <option value="2500">£2,500</option>
                <option value="3000">£3,000</option>
                <option value="4000">£4,000</option>
                <option value="5000">£5,000</option>
                <option value="7500">£7,500</option>
                <option value="10000">£10,000</option>
                <option value="12500">£12,500</option>
                <option value="15000">£15,000</option>
                <option value="20000">£20,000</option>
                <option value="25000">£25,000</option>
                <option value="30000">£30,000</option>
                <option value="35000">£35,000</option>
                <option value="40000">£40,000</option>
                <option value="45000">£45,000</option>
                <option value="50000">£50,000</option>
                <option value="60000">£60,000</option>
                <option value="70000">£70,000</option>
                <option value="80000">£80,000</option>
                <option value="90000">£90,000</option>
                <option value="100000">£100,000</option>
                <option value="125000">£125,000</option>
                <option value="150000">£150,000</option>
                <option value="200000">£200,000</option>
              </select>
            </div>
            <div class="row">
              <label for="asf-price-max">Price max</label>
              <select id="asf-price-max">
                <option value="">Any</option>
                <option value="3000">£3,000</option>
                <option value="4000">£4,000</option>
                <option value="5000">£5,000</option>
                <option value="7500">£7,500</option>
                <option value="10000">£10,000</option>
                <option value="12500">£12,500</option>
                <option value="15000">£15,000</option>
                <option value="20000">£20,000</option>
                <option value="25000">£25,000</option>
                <option value="30000">£30,000</option>
                <option value="35000">£35,000</option>
                <option value="40000">£40,000</option>
                <option value="45000">£45,000</option>
                <option value="50000">£50,000</option>
                <option value="60000">£60,000</option>
                <option value="70000">£70,000</option>
                <option value="80000">£80,000</option>
                <option value="90000">£90,000</option>
                <option value="100000">£100,000</option>
                <option value="125000">£125,000</option>
                <option value="150000">£150,000</option>
                <option value="200000">£200,000</option>
              </select>
            </div>
          </div>

          <h6 class="asf-monthly-label">Monthly price</h6>
          <div class="grid-2">
            <div class="row">
              <label for="asf-fin-min">Monthly min</label>
              <select id="asf-fin-min">
                <option value="">Any</option>
                <option value="50">£50</option>
                <option value="75">£75</option>
                <option value="100">£100</option>
                <option value="125">£125</option>
                <option value="150">£150</option>
                <option value="175">£175</option>
                <option value="200">£200</option>
                <option value="225">£225</option>
                <option value="250">£250</option>
                <option value="275">£275</option>
                <option value="300">£300</option>
                <option value="325">£325</option>
                <option value="350">£350</option>
                <option value="375">£375</option>
                <option value="400">£400</option>
                <option value="450">£450</option>
                <option value="500">£500</option>
                <option value="600">£600</option>
                <option value="700">£700</option>
                <option value="800">£800</option>
                <option value="900">£900</option>
                <option value="1000">£1,000</option>
                <option value="1250">£1,250</option>
                <option value="1500">£1,500</option>
                <option value="2000">£2,000</option>
              </select>
            </div>
            <div class="row">
              <label for="asf-fin-max">Monthly max</label>
              <select id="asf-fin-max">
                <option value="">Any</option>
                <option value="150">£150</option>
                <option value="175">£175</option>
                <option value="200">£200</option>
                <option value="225">£225</option>
                <option value="250">£250</option>
                <option value="275">£275</option>
                <option value="300">£300</option>
                <option value="325">£325</option>
                <option value="350">£350</option>
                <option value="375">£375</option>
                <option value="400">£400</option>
                <option value="450">£450</option>
                <option value="500">£500</option>
                <option value="600">£600</option>
                <option value="700">£700</option>
                <option value="800">£800</option>
                <option value="900">£900</option>
                <option value="1000">£1,000</option>
                <option value="1250">£1,250</option>
                <option value="1500">£1,500</option>
                <option value="2000">£2,000</option>
                <option value="2500">£2,500</option>
              </select>
            </div>
          </div>
        `, false)}

        ${sec('asf-mileage', 'Mileage', `
          <div class="row">
            <label for="asf-mileage-max">Max mileage</label>
            <select id="asf-mileage-max">
              <option value="">Any</option>
              <option value="0">0 (Brand new)</option>
              <option value="5000">5,000</option>
              <option value="10000">10,000</option>
              <option value="15000">15,000</option>
              <option value="20000">20,000</option>
              <option value="30000">30,000</option>
              <option value="40000">40,000</option>
              <option value="50000">50,000</option>
              <option value="60000">60,000</option>
              <option value="80000">80,000</option>
              <option value="100000">100,000</option>
              <option value="120000">120,000</option>
              <option value="150000">150,000</option>
              <option value="200000">200,000</option>
            </select>
          </div>
        `, false)}

        <div class="asf-controls">
          <div class="asf-controls-row asf-controls-bottom">
            <button type="button" id="asf-clear" class="btn asf-clear-main" style="width:100%;">Clear all</button>
          </div>
        </div>
      </div>
    `;

    const shell = document.createElement('div');
    shell.innerHTML = html;
    host.appendChild(shell.firstElementChild);
    const scope = host.querySelector('.asf');

    // Mobile filters header (Filters / Done)
    if (scope && !host.querySelector('.asf-mobile-head')) {
      const mHead = document.createElement('div');
      mHead.className = 'asf-mobile-head';
      mHead.innerHTML = `
        <div class="asf-mobile-title">Filters</div>
        <button type="button" class="asf-mobile-close" id="asf-mobile-close">Done</button>
      `;
      host.insertBefore(mHead, scope);
    }

    const mobileClose = host.querySelector('#asf-mobile-close');
    mobileClose?.addEventListener('click', () => {
      if (window.tcFilterPanel && typeof window.tcFilterPanel.close === 'function') {
        window.tcFilterPanel.close();
      } else {
        document.body.classList.add('as-no-filters');
      }
    });

    const btnClear = $('#asf-clear', scope);

    $$('.asf-sec', scope).forEach(sec => {
      sec.querySelector('header')?.addEventListener('click', () => {
        const open = sec.getAttribute('data-open') === 'true';
        sec.setAttribute('data-open', !open ? 'true' : 'false');
      });
    });

    const selMake      = $('#asf-make', scope),
          selModel     = $('#asf-model', scope),
          selTrim      = $('#asf-trim', scope),
          selEngineMin = $('#asf-engine-min', scope),
          selEngineMax = $('#asf-engine-max', scope);
    const selFuel      = $('#asf-fuel', scope),
          selGear      = $('#asf-gear', scope);
    const selBody      = $('#asf-bodytype', scope),
          selColour    = $('#asf-colour', scope);
          
              // Variant keyword starts locked
    if (selTrim) {
      selTrim.disabled = true;
    }

    allMakes.forEach(v  => selMake.appendChild(new Option(v, v)));
    engines.forEach(v   => {
      const label = formatEngineLabel(v);
      selEngineMin?.appendChild(new Option(label, v));
      selEngineMax?.appendChild(new Option(label, v));
    });
    fuels.forEach(v     => selFuel.appendChild(new Option(v, v)));
    gearboxes.forEach(v => selGear.appendChild(new Option(v, v)));
    bodytypes.forEach(v => selBody?.appendChild(new Option(v, v)));
    colours.forEach(v   => selColour?.appendChild(new Option(v, v)));

    const fillModels = (make) => {
      selModel.innerHTML = '';
      if (!make) {
        selModel.disabled = true;
        selModel.appendChild(new Option('Choose make first', ''));
        return;
      }
      selModel.appendChild(new Option('Any', ''));
      (modelsByMake[make] || []).forEach(v => selModel.appendChild(new Option(v, v)));
      selModel.disabled = false;
    };
        // For free-text variant search we just clear it when make/model change
    const fillTrims = (model) => {
      if (!selTrim) return;
      selTrim.value = '';
    };


    state.draft = JSON.parse(JSON.stringify(state.filters));

    function commitAndApplyFromUI() {
      state.filters = JSON.parse(JSON.stringify(state.draft));
      if (commitTimer) clearTimeout(commitTimer);
      commitTimer = setTimeout(() => {
        state.shown = PAGE_SIZE;
        apply();
        if (typeof window.updateURLFromForm === 'function') {
          try { window.updateURLFromForm(); } catch (e) {}
        }
      }, 120);
    }

        selMake.addEventListener('change', () => {
      state.draft.make  = selMake.value;
      state.draft.model = '';
      state.draft.trim  = '';

      fillModels(state.draft.make);
      fillTrims('');

      if (selTrim) {
        selTrim.value    = '';
        selTrim.disabled = true; // lock until model is chosen
      }

      commitAndApplyFromUI();
    });

    selModel.addEventListener('change', () => {
      state.draft.model = selModel.value;
      state.draft.trim  = '';

      fillTrims(state.draft.model);

      if (selTrim) {
        selTrim.value    = '';
        // enable only when both make + model are picked
        selTrim.disabled = !(state.draft.make && state.draft.model);
      }

      commitAndApplyFromUI();
    });

    // Variant keyword search – live
    if (selTrim) {
      selTrim.addEventListener('input', () => {
        state.draft.trim = selTrim.value.trim();
        commitAndApplyFromUI();
      });
    }

    function syncEngineMin() {
      if (!selEngineMin) return;
      const minVal = num(selEngineMin.value);
      const maxVal = selEngineMax ? num(selEngineMax.value) : NaN;

      let min = isFinite(minVal) ? minVal : '';
      let max = isFinite(maxVal) ? maxVal : '';

      if (min !== '' && max !== '' && min > max && selEngineMax) {
        selEngineMax.value = String(min);
        max = min;
      }

      state.draft.engineMin = min;
      state.draft.engineMax = max;
      commitAndApplyFromUI();
    }

    function syncEngineMax() {
      if (!selEngineMax) return;
      const maxVal = num(selEngineMax.value);
      const minVal = selEngineMin ? num(selEngineMin.value) : NaN;

      let max = isFinite(maxVal) ? maxVal : '';
      let min = isFinite(minVal) ? minVal : '';

      if (min !== '' && max !== '' && max < min && selEngineMin) {
        selEngineMin.value = String(max);
        min = max;
      }

      state.draft.engineMin = min;
      state.draft.engineMax = max;
      commitAndApplyFromUI();
    }

    selEngineMin?.addEventListener('change', syncEngineMin);
    selEngineMax?.addEventListener('change', syncEngineMax);

    selFuel.addEventListener('change', () => {
      state.draft.fuel = selFuel.value;
      commitAndApplyFromUI();
    });
    selGear.addEventListener('change', () => {
      state.draft.gearbox = selGear.value;
      commitAndApplyFromUI();
    });
    selBody?.addEventListener('change', () => {
      state.draft.bodytype = selBody.value;
      commitAndApplyFromUI();
    });
    selColour?.addEventListener('change', () => {
      state.draft.colour = selColour.value;
      commitAndApplyFromUI();
    });

    const iPriceMin = $('#asf-price-min', scope),
          iPriceMax = $('#asf-price-max', scope);
    const iYearMin  = $('#asf-year-min', scope),
          iYearMax  = $('#asf-year-max', scope);
    const iMilesMax = $('#asf-mileage-max', scope);
    const iFinMin   = $('#asf-fin-min', scope),
          iFinMax   = $('#asf-fin-max', scope);

    const readNum = el => { const v = num(el.value); return isFinite(v) ? v : ''; };

    [iPriceMin, iPriceMax, iYearMin, iYearMax, iMilesMax, iFinMin, iFinMax].forEach(inp => {
      inp?.addEventListener('change', () => {
        state.draft.priceMin    = readNum(iPriceMin);
        state.draft.priceMax    = readNum(iPriceMax);
        state.draft.yearMin     = readNum(iYearMin);
        state.draft.yearMax     = readNum(iYearMax);
        state.draft.mileageMax  = readNum(iMilesMax);
        state.draft.financeMin  = readNum(iFinMin);
        state.draft.financeMax  = readNum(iFinMax);
        commitAndApplyFromUI();
      });
    });

    // DISTANCE WIDGET
    const originInput = $('#asf-origin', scope),
          originSet   = $('#asf-origin-set', scope);
    const btnUseLoc   = $('#asf-use-loc', scope),
          rngDist     = $('#asf-distance-range', scope);
    const lblDist     = $('#asf-distance-label', scope),
          lblStat     = $('#asf-loc-status', scope);
    const btnDistDec  = $('#asf-dist-dec', scope),
          btnDistInc  = $('#asf-dist-inc', scope);

    const setDistLabel = () => {
      if (!rngDist || !lblDist) return;
      const max        = Number(rngDist.max || 300);
      const val        = Number(rngDist.value || 0);
      const isNational = (val >= max);

      lblDist.textContent = isNational ? 'National' : `Within ${val} miles`;

      if (window.__asDistanceRadiusLive) {
        const miles = isNational ? 0 : val;
        window.__asDistanceRadiusLive(miles);
      }
    };

    setDistLabel();

    if (rngDist) {
      rngDist.addEventListener('input', setDistLabel);
      rngDist.addEventListener('change', () => {
        const max = Number(rngDist.max || 300);
        const val = Number(rngDist.value || 0);
        state.draft.distance = (val >= max) ? '' : val;
        commitAndApplyFromUI();
      });
    }

    function stepDistance(delta) {
      if (!rngDist) return;
      const min = Number(rngDist.min || 0);
      const max = Number(rngDist.max || 300);
      let val   = Number(rngDist.value || 0);
      if (!isFinite(val)) val = min || 0;

      val = Math.round((val + delta) / 10) * 10;
      if (val < min) val = min;
      if (val > max) val = max;

      rngDist.value = String(val);
      const maxRange = Number(rngDist.max || 300);
      state.draft.distance = (val >= maxRange) ? '' : val;
      rngDist.dispatchEvent(new Event('input', { bubbles: false }));
      commitAndApplyFromUI();
    }

    if (btnDistDec) btnDistDec.addEventListener('click', () => stepDistance(-10));
    if (btnDistInc) btnDistInc.addEventListener('click', () => stepDistance(10));

    async function geocodeAddress(q) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&country=gb&access_token=${MAPBOX_TOKEN}`;
        const r   = await fetch(url);
        const j   = await r.json();
        const f   = j?.features?.[0];
        if (f && Array.isArray(f.center)) return { lng: f.center[0], lat: f.center[1] };
      } catch {}
      return null;
    }

    originSet.addEventListener('click', async () => {
      const q = (originInput.value || '').trim();
      if (!q) { lblStat.textContent = 'Enter a postcode or address'; return; }
      lblStat.textContent = 'Searching…';
      const pt = await geocodeAddress(q);
      if (pt) {
        state.draft.origin = pt;
        rngDist.disabled   = false;
        lblStat.textContent = 'Location set';
        state.draft.distance = Number(rngDist.value) || '';
        commitAndApplyFromUI();
      } else {
        lblStat.textContent = 'Not found';
      }
    });

    btnUseLoc.addEventListener('click', () => {
      lblStat.textContent = 'Locating…';
      if (!navigator.geolocation) { lblStat.textContent = 'Geolocation not supported'; return; }
      navigator.geolocation.getCurrentPosition(
        pos => {
          state.draft.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          rngDist.disabled   = false;
          lblStat.textContent = 'Location set';
          state.draft.distance = Number(rngDist.value) || '';
          commitAndApplyFromUI();
        },
        () => {
          lblStat.textContent = 'Location denied';
          rngDist.disabled    = true;
          state.draft.origin  = null;
          state.draft.distance = '';
          commitAndApplyFromUI();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });

    btnClear?.addEventListener('click', () => {
      state.filters = {
        make: '', model: '', trim: '',
        fuel: '', gearbox: '', bodytype: '', colour: '',
        engineMin: '', engineMax: '',
        priceMin: '', priceMax: '', financeMin: '', financeMax: '',
        yearMin: '', yearMax: '', mileageMax: '', distance: '',
        origin: state.filters.origin
      };
      state.draft = JSON.parse(JSON.stringify(state.filters));

               selMake.value = '';

      if (selModel) {
        selModel.innerHTML = '';
        selModel.appendChild(new Option('Choose make first', ''));
        selModel.disabled = true;
      }

      if (selTrim) {
        selTrim.value    = '';
        selTrim.disabled = true; // lock variant keyword again on clear
      }

      if (selEngineMin) selEngineMin.value = '';
      if (selEngineMax) selEngineMax.value = '';
      selFuel.value = '';
      selGear.value = '';
      if (selBody)   selBody.value   = '';
      if (selColour) selColour.value = '';

      iPriceMin.value = ''; iPriceMax.value = '';
      iYearMin.value  = ''; iYearMax.value  = '';
      iMilesMax.value = '';
      if (iFinMin) iFinMin.value = '';
      if (iFinMax) iFinMax.value = '';

      if (rngDist) {
        rngDist.value = rngDist.max;
        setDistLabel();
      }
      state.draft.distance   = '';
      state.filters.distance = '';
      state.shown = PAGE_SIZE;
      apply();

      if (typeof window.updateURLFromForm === 'function') {
        try { window.updateURLFromForm(); } catch (e) {}
      }

    });
  }

  // Variant / edition search helpers
  function normaliseVariantText(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchesVariantQuery(editionRaw, queryRaw) {
    if (!editionRaw || !queryRaw) return false;

    const edition = normaliseVariantText(editionRaw);
    const query   = normaliseVariantText(queryRaw);

    if (!edition || !query) return false;

    // Phrase-level
    if (edition.includes(query)) return true;

    // Word-level: all query tokens must appear as whole words
    const words  = edition.split(' ');
    const tokens = query.split(' ');

    return tokens.every(token => {
      if (!token) return true;
      return words.includes(token);
    });
  }

  function passesFilters(r) {
    const f = state.filters;
    const d = r.data;

    if (f.make && d.make !== f.make) return false;
    if (f.model && d.model !== f.model) return false;

    if (f.trim) {
      const ed = d.edition || d.trim || '';
      if (!matchesVariantQuery(ed, f.trim)) return false;
    }

    if (f.fuel && d.fuel !== f.fuel) return false;
    if (f.gearbox && d.gearbox !== f.gearbox) return false;
    if (f.bodytype && d.bodytype !== f.bodytype) return false;

    if (f.colour) {
      const carColour = (d.color || '').trim().toLowerCase();
      if (!carColour || carColour !== f.colour.toLowerCase()) return false;
    }

    // Engine range
    if (f.engineMin !== '' || f.engineMax !== '') {
      const engVal = num(d.engine);
      if (!isFinite(engVal)) return false;
      if (f.engineMin !== '' && engVal < f.engineMin) return false;
      if (f.engineMax !== '' && engVal > f.engineMax) return false;
    }

    if (f.priceMin !== '' && (!isFinite(d.price) || d.price < f.priceMin)) return false;
    if (f.priceMax !== '' && (!isFinite(d.price) || d.price > f.priceMax)) return false;

    if ((f.financeMin !== '' || f.financeMax !== '')) {
      if (!isFinite(d.finance) || d.finance <= 0) return false;
      if (f.financeMin !== '' && d.finance < f.financeMin) return false;
      if (f.financeMax !== '' && d.finance > f.financeMax) return false;
    }

    if (f.yearMin !== '' && (!isFinite(d.year) || d.year < f.yearMin)) return false;
    if (f.yearMax !== '' && (!isFinite(d.year) || d.year > f.yearMax)) return false;

    if (f.mileageMax !== '' && (!isFinite(d.mileage) || d.mileage > f.mileageMax)) return false;

    if (f.distance && f.origin) {
      const dm = distMiles({ lat: d.lat, lng: d.lng }, f.origin);
      if (!isFinite(dm) || dm > f.distance) return false;
    }

    return true;
  }

  function itemDistanceMiles(data) {
    const origin = state.filters.origin;
    if (!origin || !isFinite(data.lat) || !isFinite(data.lng)) return Infinity;
    const dm = distMiles({ lat: data.lat, lng: data.lng }, origin);
    return isFinite(dm) ? dm : Infinity;
  }

  const sorts = {
    'price-desc':   (a, b) => (b.data.price || 0)    - (a.data.price || 0),
    'price-asc':    (a, b) => (a.data.price || 0)    - (b.data.price || 0),
    'finance-asc':  (a, b) => (a.data.finance || 1e15) - (b.data.finance || 1e15),
    'finance-desc': (a, b) => (b.data.finance || 0)  - (a.data.finance || 0),
    'year-desc':    (a, b) => (b.data.year || 0)     - (a.data.year || 0),
    'year-asc':     (a, b) => (a.data.year || 0)     - (b.data.year || 0),
    'mileage-asc':  (a, b) => (a.data.mileage || 1e15) - (b.data.mileage || 1e15),
    'mileage-desc': (a, b) => (b.data.mileage || 0)  - (a.data.mileage || 0),
    'distance-asc': (a, b) => itemDistanceMiles(a.data) - itemDistanceMiles(b.data)
  };

  function renderTags() {
    const cont = $('.as-filter-tags');
    if (!cont) return;
    cont.innerHTML = '';

    const f = state.filters;
    const addTag = (label, key, val) => {
      const tag = document.createElement('div');
      tag.className = 'as-filter-tag';
      tag.innerHTML = `${label}<button type="button" aria-label="Remove">&times;</button>`;
      tag.querySelector('button')?.addEventListener('click', () => {
        state.filters[key] = val !== undefined ? val : '';
        if (key === 'make') { state.filters.model = ''; state.filters.trim = ''; }
        if (key === 'model') state.filters.trim = '';
        apply();
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          window.scrollTo(0, 0);
        }
      });
      cont.appendChild(tag);
    };

    if (f.make)  addTag(`Make: ${f.make}`, 'make');
    if (f.model) addTag(`Model: ${f.model}`, 'model');
    if (f.trim)  addTag(`Trim: ${f.trim}`, 'trim');
    if (f.fuel)  addTag(`Fuel: ${f.fuel}`, 'fuel');
    if (f.gearbox) addTag(`Gearbox: ${f.gearbox}`, 'gearbox');
    if (f.bodytype) addTag(`Body: ${f.bodytype}`, 'bodytype');
    if (f.colour)   addTag(`Colour: ${f.colour}`, 'colour');
    if (f.engineMin !== '') addTag(`Engine from ${f.engineMin}L`, 'engineMin');
    if (f.engineMax !== '') addTag(`Engine to ${f.engineMax}L`, 'engineMax');
    if (f.priceMin !== '') addTag(`Min: £${Number(f.priceMin).toLocaleString('en-GB')}`, 'priceMin');
    if (f.priceMax !== '') addTag(`Max: £${Number(f.priceMax).toLocaleString('en-GB')}`, 'priceMax');
    if (f.financeMin !== '') addTag(`Finance: £${Number(f.financeMin).toLocaleString('en-GB')}+/mo`, 'financeMin');
    if (f.financeMax !== '') addTag(`Finance: £${Number(f.financeMax).toLocaleString('en-GB')}/mo`, 'financeMax');
    if (f.yearMin   !== '') addTag(`From ${f.yearMin}`, 'yearMin');
    if (f.yearMax   !== '') addTag(`To ${f.yearMax}`, 'yearMax');
    if (f.mileageMax !== '') addTag(`Max ${Number(f.mileageMax).toLocaleString('en-GB')} mi`, 'mileageMax');
    if (f.distance) addTag(`Within ${f.distance} miles`, 'distance', '');
  }

  function apply() {
    let filtered;
    if (state.favsOnly) {
      filtered = items.filter(x => {
        const id = x.data.url || x.card.dataset.id || '';
        return id && favIDs.has(id);
      });
    } else {
      filtered = items.filter(passesFilters);
    }

    if (state.sort === 'finance-asc' || state.sort === 'finance-desc') {
      filtered = filtered.filter(x => Number.isFinite(x.data.finance) && x.data.finance > 0);
    }

    if (state.sort === 'distance-asc') {
      if (state.filters.origin) {
        filtered = filtered.filter(x => Number.isFinite(itemDistanceMiles(x.data)));
      }
    }

    const sorter =
      (state.sort === 'distance-asc' && !state.filters.origin)
        ? sorts['price-desc']
        : (sorts[state.sort] || sorts['price-desc']);

    const sorted = filtered.slice().sort(sorter);
    const visibleCount = Math.min(sorted.length, state.shown);

    try {
      const host = listInner && listInner.parentElement;
      if (host) {
        let empty = host.querySelector('.as-no-results');
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'as-no-results';
          empty.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" class="as-no-results-icon">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" />
              <circle cx="9" cy="10" r="0.9" fill="currentColor" />
              <circle cx="15" cy="10" r="0.9" fill="currentColor" />
              <path d="M8.2 16c1-.9 2.2-1.4 3.8-1.4s2.8.5 3.8 1.4"
                    fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            <h3>No cars found</h3>
            <p>No vehicles match your current filters.</p>
            <p class="as-no-results-sub">
              Try widening your distance, relaxing price filters,
              or clearing some spec filters.
            </p>
          `;
          host.insertBefore(empty, listInner);
        }
        empty.style.display = sorted.length === 0 ? 'block' : 'none';
      }
    } catch (e) {
      console.warn('No-results placeholder issue', e);
    }

        // ✅ Render only the visible slice (24 at a time)
    const cardHTML = window.__ticaryCardHTML;

    if (typeof cardHTML === 'function') {
      let html = '';
      for (let i = 0; i < visibleCount; i++) {
        html += cardHTML(sorted[i].car);
      }

      // replace list contents with only what's visible
      listInner.innerHTML = html;
  

      // lightweight appear animation (keeps your "as-appear" behaviour)
      const rendered = $$('.w-dyn-item, [role="listitem"]', listInner);
      rendered.forEach((it) => {
        it.classList.remove('as-appear');
        void it.offsetWidth;
        it.classList.add('as-appear');
      });

      // attach favourites + finance placeholder for rendered cards only
      if (window.__ticaryEnsureFavButtons) window.__ticaryEnsureFavButtons(listInner);
      if (window.__ticaryFinanceFix) window.__ticaryFinanceFix(listInner);
    } else {
      // fallback: if card renderer missing, show nothing instead of crashing
      listInner.innerHTML = '';
    }


    var countEl = $("#as-count-new") || $("#as-count");
    if (countEl) {
      countEl.textContent = `${sorted.length} result${sorted.length === 1 ? "" : "s"}`;
    }

    const more = $("#as-more");
    if (more) {
      const rem = sorted.length - state.shown;
      more.style.display = rem > 0 ? "block" : "none";
      if (rem > 0) {
        more.textContent = `See ${rem} more car${rem === 1 ? "" : "s"}`;
      }
    }

    renderTags();

    if (window.updateMap) {
      window.updateMap({
        sorted,
        base: items,
        filters: state.filters
      });
    }
  }

  function buildToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'as-listbar-new';
    toolbar.innerHTML = `
      <div class="as-listbar-left">
        <span id="as-count-new">0 results</span>
        <div class="as-filter-tags"></div>
      </div>
      <div class="as-listbar-right">
        <select id="as-sort-new">
          <option value="price-desc">Price: High to Low</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="finance-asc">Finance: Low to High</option>
          <option value="finance-desc">Finance: High to Low</option>
          <option value="distance-asc">Distance: Closest first</option>
          <option value="year-desc">Newest first</option>
          <option value="year-asc">Oldest first</option>
          <option value="mileage-asc">Mileage: Low to High</option>
          <option value="mileage-desc">Mileage: High to Low</option>
        </select>
        <button type="button" id="as-filters-toggle-new" class="as-ctrl-new">Hide filters</button>
        <button type="button" id="as-map-toggle-new" class="as-ctrl-new">Hide map</button>
      </div>
    `;
    listInner.parentElement?.insertBefore(toolbar, listInner);

    const sortSel = $('#as-sort-new');
    if (sortSel) sortSel.value = state.sort;
    sortSel?.addEventListener('change', (e) => {
      state.sort = e.target.value;
      apply();
    });

    var filterBtn = $('#as-filters-toggle-new') || $('#as-filters-toggle');
    if (filterBtn) {
      const body   = document.body;
      const THRESH = 320;
      let changeMode = false;

      const isMobile = () =>
        window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

      const filtersOpen = () => !body.classList.contains('as-no-filters');

      function setNormalLabel() {
        if (isMobile()) {
          filterBtn.textContent = 'Filters';
        } else {
          filterBtn.textContent = filtersOpen() ? 'Hide filters' : 'Show filters';
        }
      }

      function setChangeLabel() {
        filterBtn.textContent = 'Change filters';
      }

      function updateMode() {
        if (isMobile()) {
          changeMode = false;
          setNormalLabel();
          return;
        }
        const shouldChange = window.scrollY > THRESH;
        if (shouldChange && !changeMode) {
          changeMode = true;
          setChangeLabel();
        } else if (!shouldChange && changeMode) {
          changeMode = false;
          setNormalLabel();
        }
      }

      setNormalLabel();
      window.addEventListener('scroll', updateMode, { passive: true });

      filterBtn.addEventListener('click', () => {
        if (isMobile()) {
          body.classList.add('as-no-filters');
          if (window.tcFilterPanel && typeof window.tcFilterPanel.open === 'function') {
            window.tcFilterPanel.open();
          }
          return;
        }

        if (changeMode) {
          if (!filtersOpen()) {
            body.classList.remove('as-no-filters');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          body.classList.toggle('as-no-filters');
          setNormalLabel();
        }

        setTimeout(() => {
          if (window.map && typeof window.map.resize === 'function') {
            window.map.resize();
          }
        }, 120);
      });
    }

    var mapBtn = $('#as-map-toggle-new') || $('#as-map-toggle');
    if (mapBtn) {
      const body = document.body;
      const isMobile = () =>
        window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

      const mapVisible = () => !body.classList.contains('as-no-map');

      function setMapLabel() {
        if (isMobile()) {
          mapBtn.textContent = mapVisible() ? 'List' : 'Map';
        } else {
          mapBtn.textContent = mapVisible() ? 'Hide map' : 'Show map';
        }
      }

      setMapLabel();

      mapBtn.addEventListener('click', () => {
        if (isMobile()) {
          const visible = mapVisible();
          if (visible) {
            body.classList.add('as-no-map');
            body.classList.remove('as-mobile-map-only');
          } else {
            body.classList.remove('as-no-map');
            body.classList.add('as-mobile-map-only');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setMapLabel();
          setTimeout(() => {
            if (window.map && typeof window.map.resize === 'function') {
              window.map.resize();
            }
          }, 120);
          return;
        }

        const wasVisible = mapVisible();
        body.classList.toggle('as-no-map');
        setMapLabel();

        if (!wasVisible) {
          setTimeout(() => {
            if (window.map && typeof window.map.resize === 'function') {
              window.map.resize();
            }
          }, 100);
        }
      });
    }
  }

  const more = $('#as-more');
  if (more) more.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.shown += PAGE_SIZE;
    apply();
  });

  window.__ticaryState    = state;
  window.__ticaryFavIDs   = favIDs;
  window.__ticarySaveFavs = saveFavs;

  function init() {
  try {
    buildToolbar();
    buildFiltersUI();

    document.body.classList.remove('as-no-filters');
    document.body.classList.remove('as-no-map');
    document.body.classList.remove('as-mobile-map-only');

    setTimeout(() => {
      apply();
      
      window.__ticaryPartBLoaded = true;
      window.dispatchEvent(new CustomEvent('ticary:partb:loaded'));
      console.log('✅ Part B LOADED FLAG SET');

      console.log('✅ Part B complete');
    }, 300);
  } catch (e) {
    console.error('❌ Part B init crashed', e);
  }
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(0);

/* =========================================================
   TICARY — PART B.1 DATA ENRICHMENT (IMPROVED PARSING)
========================================================= */
(function(){
  const clean = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/\u00a0/g,' ').trim();
    return (!s || s === 'null' || s === 'undefined') ? '' : s;
  };

  const toNum = (v) => {
    const s = String(v ?? '').replace(/[^\d.\-]/g,'');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const splitList = (s) => {
    s = clean(s);
    if (!s) return [];
    // normalise bullets + newlines
    s = s.replace(/\r/g,'\n')
         .replace(/[•·●▪■]+/g, '\n')
         .replace(/\n{2,}/g, '\n');

    // choose best delimiter
    const delim =
      s.includes('\n') ? '\n' :
      s.includes(';')  ? ';'  :
      s.includes('|')  ? '|'  :
      s.includes(',')  ? ','  : null;

    const parts = delim ? s.split(delim) : [s];
    return parts.map(x => clean(x)).filter(Boolean);
  };

  const toArray = (v) => {
    if (Array.isArray(v)) return v.map(clean).filter(Boolean);

    if (v && typeof v === 'object') {
      // handle JSON object like {0:"...",1:"..."} or {items:[...]}
      if (Array.isArray(v.items)) return v.items.map(clean).filter(Boolean);
      return Object.values(v).map(clean).filter(Boolean);
    }

    if (typeof v === 'string') {
      const s = clean(v);
      if (!s) return [];

      // try JSON
      if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
        try {
          const j = JSON.parse(s);
          if (Array.isArray(j)) return j.map(clean).filter(Boolean);
          if (j && typeof j === 'object') return Object.values(j).map(clean).filter(Boolean);
        } catch {}
      }

      return splitList(s);
    }

    return [];
  };

  function enrich(){
    const items = window.__ticaryItems;
    if (!Array.isArray(items)) return;

    for (const o of items){
      const c = o.car || {};
      const d = o.data || (o.data = {});

      // carry-over specs
      if (d.power == null) d.power = toNum(c.power_ps ?? c.power);
      if (d.doors == null) d.doors = toNum(c.doors);
      if (!clean(d.drivetrain)) d.drivetrain = clean(c.drivetrain);
      if (!clean(d.euro)) d.euro = clean(c.euro_standard ?? c.euro);

      // address + seller
      if (!clean(d.reg)) d.reg = clean(c.vehicle_registration_mark ?? c.reg);
      if (d.owners == null) d.owners = toNum(c.num_owners);
      if (!clean(d.street)) d.street = clean(c.street);
      if (!clean(d.city)) d.city = clean(c.city);
      if (!clean(d.county)) d.county = clean(c.county);
      if (!clean(d.postal_code)) d.postal_code = clean(c.postal_code);
      if (!clean(d.phone)) d.phone = clean(c.seller_phone ?? c.phone);
      if (!clean(d.email)) d.email = clean(c.seller_email ?? c.email);

      // rich text fields (robust parsing)
      const feats = toArray(c.features);
      const opts  = toArray(c.options);
      if (!Array.isArray(d.features) || d.features.length === 0) d.features = feats;
      if (!Array.isArray(d.options)  || d.options.length === 0)  d.options  = opts;
      if (!clean(d.seller_comments)) d.seller_comments = clean(c.seller_comments);

      // performance
      if (d.maxspeed_mph == null) d.maxspeed_mph = toNum(c.performance_maxspeed_mph);
      if (d.zero_to_60_mph == null) d.zero_to_60_mph = toNum(c.performance_acceleration_zero_to_60_mph);
      if (d.combined_mpg == null) d.combined_mpg = toNum(c.efficiency_combined_mpg);
    }

    window.__ticaryDataEnriched = true;
    console.log('✅ Part B.1 enriched + parsed');
  }

  if (window.__ticaryPartBLoaded) enrich();
  else window.addEventListener('ticary:partb:loaded', enrich, { once: true });
})();

(function TicaryFacetCounts(){
  if (window.__ticaryFacetCountsLoaded) return;
  window.__ticaryFacetCountsLoaded = true;

  const num = (t) => {
    const n = String(t ?? '').replace(/[^0-9.\-]/g, '');
    return n ? Number(n) : NaN;
  };

  // --- Variant matching (mirrors Part B behaviour) ---
  function normaliseVariantText(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function matchesVariantQuery(editionRaw, queryRaw) {
    if (!editionRaw || !queryRaw) return false;
    const edition = normaliseVariantText(editionRaw);
    const query   = normaliseVariantText(queryRaw);
    if (!edition || !query) return false;
    if (edition.includes(query)) return true;
    const words  = edition.split(' ');
    const tokens = query.split(' ');
    return tokens.every(tok => !tok || words.includes(tok));
  }

  // --- Distance helper (mirrors Part B behaviour) ---
  function distMiles(a, b) {
    if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return NaN;
    const R = 3958.7613, toR = d => d * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Keys that represent filter fields in your state
  const FILTER_KEYS = [
    'make','model','trim','fuel','gearbox','bodytype','colour',
    'engineMin','engineMax',
    'priceMin','priceMax','financeMin','financeMax',
    'yearMin','yearMax','mileageMax','distance','origin'
  ];

  // Read current state safely
  function getState(){
    return window.__ticaryState || window.state || null;
  }
  function getItems(){
    return Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
  }

  // Core filter test (same logic as Part B, but standalone)
  function passesFilters(data, filters){
    const f = filters || {};

    if (f.make && data.make !== f.make) return false;
    if (f.model && data.model !== f.model) return false;

    if (f.trim) {
      const ed = data.edition || data.trim || '';
      if (!matchesVariantQuery(ed, f.trim)) return false;
    }

    if (f.fuel && data.fuel !== f.fuel) return false;
    if (f.gearbox && data.gearbox !== f.gearbox) return false;
    if (f.bodytype && data.bodytype !== f.bodytype) return false;

    if (f.colour) {
      const carColour = String(data.color || '').trim().toLowerCase();
      if (!carColour || carColour !== String(f.colour).trim().toLowerCase()) return false;
    }

    // Engine
    if (f.engineMin !== '' || f.engineMax !== '') {
      const engVal = num(data.engine);
      if (!isFinite(engVal)) return false;
      if (f.engineMin !== '' && engVal < f.engineMin) return false;
      if (f.engineMax !== '' && engVal > f.engineMax) return false;
    }

    // Price
    if (f.priceMin !== '' && (!isFinite(data.price) || data.price < f.priceMin)) return false;
    if (f.priceMax !== '' && (!isFinite(data.price) || data.price > f.priceMax)) return false;

    // Finance range: Part B excludes cars without finance when a finance filter is set
    if (f.financeMin !== '' || f.financeMax !== '') {
      const fin = num(data.finance);
      if (!isFinite(fin) || fin <= 0) return false;
      if (f.financeMin !== '' && fin < f.financeMin) return false;
      if (f.financeMax !== '' && fin > f.financeMax) return false;
    }

    // Year
    if (f.yearMin !== '' && (!isFinite(data.year) || data.year < f.yearMin)) return false;
    if (f.yearMax !== '' && (!isFinite(data.year) || data.year > f.yearMax)) return false;

    // Mileage
    if (f.mileageMax !== '' && (!isFinite(data.mileage) || data.mileage > f.mileageMax)) return false;

    // Distance
    if (f.distance && f.origin) {
      const dm = distMiles({ lat: data.lat, lng: data.lng }, f.origin);
      if (!isFinite(dm) || dm > f.distance) return false;
    }

    return true;
  }

  // Build a filter object like current state, but allow overrides
  function cloneFilters(filters){
    const out = {};
    FILTER_KEYS.forEach(k => out[k] = (filters && k in filters) ? filters[k] : '');
    return out;
  }

  // Eligible set for a facet = cars that pass all current filters EXCEPT that facet
  function buildEligible(excludeKeys){
    const st = getState();
    const items = getItems();
    if (!st || !st.filters) return [];
    const base = cloneFilters(st.filters);

    // remove excluded keys (treat as unset)
    (excludeKeys || []).forEach(k => {
      if (k === 'origin') base.origin = st.filters.origin; // keep origin unless explicitly excluding it
      else base[k] = '';
    });

    const eligible = [];
    for (let i=0;i<items.length;i++){
      const d = items[i]?.data;
      if (d && passesFilters(d, base)) eligible.push(d);
    }
    return eligible;
  }

  // Helpers: keep original option labels
  function stashOptionLabel(opt){
    if (!opt) return '';
    if (!opt.dataset) opt.dataset = {};
    if (!opt.dataset.baseLabel) opt.dataset.baseLabel = opt.textContent;
    return opt.dataset.baseLabel;
  }

  function setOptionTextWithCount(opt, count){
  const base = stashOptionLabel(opt).replace(/\s*\(\d+\)\s*$/,'').trim();

  // Always keep placeholder / empty option visible
  if (!opt.value || opt.disabled) {
    opt.hidden = false;
    opt.textContent = base;
    return;
  }

  const st = getState();
  const isSelected = st && st.filters && String(st.filters[opt.parentElement?.id?.replace('asf-','')]) === String(opt.value);

  // Hide zero-count options unless currently selected
  if (!isSelected && Number(count) === 0) {
    opt.hidden = true;
    return;
  }

  opt.hidden = false;
  opt.textContent = `${base} (${count})`;
}


  // Count maps for discrete facets
  function freqMap(list, getter){
    const m = new Map();
    for (let i=0;i<list.length;i++){
      const v = getter(list[i]);
      if (!v) continue;
      m.set(v, (m.get(v) || 0) + 1);
    }
    return m;
  }

  // Numeric facet counts: check each option’s implied constraint
  function countForNumericOptions(list, testerFn){
    // returns count of items passing testerFn(d)
    let c = 0;
    for (let i=0;i<list.length;i++){
      if (testerFn(list[i])) c++;
    }
    return c;
  }

  // Main update: compute and paint counts
  function updateAllCounts(){
    const st = getState();
    if (!st || !st.filters) return;

    const scope = document.getElementById('as-filters-body') || document.getElementById('as-filters') || document;
    const selMake      = scope.querySelector('#asf-make');
    const selModel     = scope.querySelector('#asf-model');
    const selFuel      = scope.querySelector('#asf-fuel');
    const selGear      = scope.querySelector('#asf-gear');
    const selBody      = scope.querySelector('#asf-bodytype');
    const selColour    = scope.querySelector('#asf-colour');
    const selEngMin    = scope.querySelector('#asf-engine-min');
    const selEngMax    = scope.querySelector('#asf-engine-max');
    const selPriceMin  = scope.querySelector('#asf-price-min');
    const selPriceMax  = scope.querySelector('#asf-price-max');
    const selFinMin    = scope.querySelector('#asf-fin-min');
    const selFinMax    = scope.querySelector('#asf-fin-max');
    const selMilesMax  = scope.querySelector('#asf-mileage-max');

    // --- MAKE ---
    if (selMake) {
      const eligible = buildEligible(['make','model','trim']); // make affects model/trim
      const map = freqMap(eligible, d => d.make);
      [...selMake.options].forEach(opt => setOptionTextWithCount(opt, map.get(opt.value) || 0));
    }

    // --- MODEL (counts reflect current make selection, but show "if I pick this model next") ---
    if (selModel && !selModel.disabled) {
      const eligible = buildEligible(['model','trim']); // keep make in place, remove model/trim
      const map = freqMap(eligible, d => d.model);
      [...selModel.options].forEach(opt => setOptionTextWithCount(opt, map.get(opt.value) || 0));
    }

    // --- FUEL ---
    if (selFuel) {
      const eligible = buildEligible(['fuel']);
      const map = freqMap(eligible, d => d.fuel);
      [...selFuel.options].forEach(opt => setOptionTextWithCount(opt, map.get(opt.value) || 0));
    }

    // --- GEARBOX ---
    if (selGear) {
      const eligible = buildEligible(['gearbox']);
      const map = freqMap(eligible, d => d.gearbox);
      [...selGear.options].forEach(opt => setOptionTextWithCount(opt, map.get(opt.value) || 0));
    }

    // --- BODY TYPE ---
    if (selBody) {
      const eligible = buildEligible(['bodytype']);
      const map = freqMap(eligible, d => d.bodytype);
      [...selBody.options].forEach(opt => setOptionTextWithCount(opt, map.get(opt.value) || 0));
    }

    // --- COLOUR ---
    if (selColour) {
      const eligible = buildEligible(['colour']);
      const map = freqMap(eligible, d => (d.color || '').trim());
      [...selColour.options].forEach(opt => setOptionTextWithCount(opt, map.get(opt.value) || 0));
    }

    // --- ENGINE MIN / MAX ---
    // For each min option: count cars passing everything except engineMin, but with engine >= thatMin and <= current engineMax (if set)
    if (selEngMin) {
      const eligible = buildEligible(['engineMin']); // keep engineMax in place
      const currentMax = (st.filters.engineMax !== '' ? num(st.filters.engineMax) : NaN);

      [...selEngMin.options].forEach(opt => {
        if (!opt.value || opt.disabled) return setOptionTextWithCount(opt, 0);

        const vMin = num(opt.value);
        const count = countForNumericOptions(eligible, d => {
          const e = num(d.engine);
          if (!isFinite(e)) return false;
          if (isFinite(vMin) && e < vMin) return false;
          if (isFinite(currentMax) && e > currentMax) return false;
          return true;
        });

        setOptionTextWithCount(opt, count);
      });
    }

    if (selEngMax) {
      const eligible = buildEligible(['engineMax']); // keep engineMin in place
      const currentMin = (st.filters.engineMin !== '' ? num(st.filters.engineMin) : NaN);

      [...selEngMax.options].forEach(opt => {
        if (!opt.value || opt.disabled) return setOptionTextWithCount(opt, 0);

        const vMax = num(opt.value);
        const count = countForNumericOptions(eligible, d => {
          const e = num(d.engine);
          if (!isFinite(e)) return false;
          if (isFinite(currentMin) && e < currentMin) return false;
          if (isFinite(vMax) && e > vMax) return false;
          return true;
        });

        setOptionTextWithCount(opt, count);
      });
    }

    // --- PRICE MIN / MAX ---
    if (selPriceMin) {
      const eligible = buildEligible(['priceMin']); // keep priceMax in place
      const currentMax = (st.filters.priceMax !== '' ? num(st.filters.priceMax) : NaN);

      [...selPriceMin.options].forEach(opt => {
        if (!opt.value || opt.disabled) return setOptionTextWithCount(opt, 0);
        const pMin = num(opt.value);
        const count = countForNumericOptions(eligible, d => {
          const p = num(d.price);
          if (!isFinite(p)) return false;
          if (isFinite(pMin) && p < pMin) return false;
          if (isFinite(currentMax) && p > currentMax) return false;
          return true;
        });
        setOptionTextWithCount(opt, count);
      });
    }

    if (selPriceMax) {
      const eligible = buildEligible(['priceMax']); // keep priceMin in place
      const currentMin = (st.filters.priceMin !== '' ? num(st.filters.priceMin) : NaN);

      [...selPriceMax.options].forEach(opt => {
        if (!opt.value || opt.disabled) return setOptionTextWithCount(opt, 0);
        const pMax = num(opt.value);
        const count = countForNumericOptions(eligible, d => {
          const p = num(d.price);
          if (!isFinite(p)) return false;
          if (isFinite(currentMin) && p < currentMin) return false;
          if (isFinite(pMax) && p > pMax) return false;
          return true;
        });
        setOptionTextWithCount(opt, count);
      });
    }

    // --- FINANCE MIN / MAX ---
    // Mirrors Part B rule: if finance filters are used, only cars with finance > 0 are eligible
    if (selFinMin) {
      const eligible = buildEligible(['financeMin']); // keep financeMax in place
      const currentMax = (st.filters.financeMax !== '' ? num(st.filters.financeMax) : NaN);

      [...selFinMin.options].forEach(opt => {
        if (!opt.value || opt.disabled) return setOptionTextWithCount(opt, 0);
        const fMin = num(opt.value);
        const count = countForNumericOptions(eligible, d => {
          const f = num(d.finance);
          if (!isFinite(f) || f <= 0) return false;
          if (isFinite(fMin) && f < fMin) return false;
          if (isFinite(currentMax) && f > currentMax) return false;
          return true;
        });
        setOptionTextWithCount(opt, count);
      });
    }

    if (selFinMax) {
      const eligible = buildEligible(['financeMax']); // keep financeMin in place
      const currentMin = (st.filters.financeMin !== '' ? num(st.filters.financeMin) : NaN);

      [...selFinMax.options].forEach(opt => {
        if (!opt.value || opt.disabled) return setOptionTextWithCount(opt, 0);
        const fMax = num(opt.value);
        const count = countForNumericOptions(eligible, d => {
          const f = num(d.finance);
          if (!isFinite(f) || f <= 0) return false;
          if (isFinite(currentMin) && f < currentMin) return false;
          if (isFinite(fMax) && f > fMax) return false;
          return true;
        });
        setOptionTextWithCount(opt, count);
      });
    }

    // --- MILEAGE MAX ---
    if (selMilesMax) {
      const eligible = buildEligible(['mileageMax']);
      [...selMilesMax.options].forEach(opt => {
        if (!opt.value || opt.disabled) return setOptionTextWithCount(opt, 0);
        const mMax = num(opt.value);
        const count = countForNumericOptions(eligible, d => {
          const m = num(d.mileage);
          if (!isFinite(m)) return false;
          if (isFinite(mMax) && m > mMax) return false;
          return true;
        });
        setOptionTextWithCount(opt, count);
      });
    }
  }

  // Debounced refresh
  let t = null;
  function requestUpdate(){
    clearTimeout(t);
    t = setTimeout(() => {
      try { updateAllCounts(); } catch(e){ console.warn('Facet counts error:', e); }
    }, 120);
  }

  // Hook into Part B lifecycle: after apply() runs, update counts
  function hookApply(){
    // If Part B exposes __ticaryApply, wrap it once
    if (typeof window.__ticaryApply === 'function' && !window.__ticaryApply.__countsWrapped) {
      const orig = window.__ticaryApply;
      function wrapped(){
        const r = orig.apply(this, arguments);
        requestUpdate();
        return r;
      }
      wrapped.__countsWrapped = true;
      window.__ticaryApply = wrapped;
    }
  }

  // Add listeners to filter controls (so counts refresh even before apply, but will settle after apply too)
  function bindUI(){
    const host = document.getElementById('as-filters-body') || document.getElementById('as-filters') || document;
    const ids = [
      '#asf-make','#asf-model','#asf-trim','#asf-engine-min','#asf-engine-max',
      '#asf-fuel','#asf-gear','#asf-bodytype','#asf-colour',
      '#asf-price-min','#asf-price-max','#asf-fin-min','#asf-fin-max','#asf-mileage-max',
      '#asf-year-min','#asf-year-max'
    ];
    ids.forEach(sel => {
      const el = host.querySelector(sel);
      if (!el || el.__countsBound) return;
      el.__countsBound = true;
      el.addEventListener('change', requestUpdate);
      el.addEventListener('input', requestUpdate);
    });
  }

  // Boot loop: wait until Part B dataset/state exist
  (function boot(tries){
    tries = tries || 0;

    if (!Array.isArray(window.__ticaryItems) || !window.__ticaryItems.length) {
      if (tries < 120) return setTimeout(() => boot(tries+1), 100);
      return;
    }
    if (!(window.__ticaryState || window.state) || !(getState()?.filters)) {
      if (tries < 120) return setTimeout(() => boot(tries+1), 100);
      return;
    }

    hookApply();
    bindUI();
    requestUpdate();

    // Also re-bind occasionally (filters UI may rebuild)
    setInterval(() => {
      hookApply();
      bindUI();
    }, 1500);

  })(0);

})();

(function tcVariantUX(tries){
  tries = tries || 0;
  if (window.__tcVariantUXInit) return;

  var makeSel  = document.getElementById('asf-make');
  var modelSel = document.getElementById('asf-model');
  var trimInp  = document.getElementById('asf-trim');

  if (!makeSel || !modelSel || !trimInp) {
    if (tries > 60) return;
    return setTimeout(function(){ tcVariantUX(tries + 1); }, 100);
  }

  window.__tcVariantUXInit = true;

    var examplesByMake = {
    'BMW':           ['M Sport', 'M140i', 'M340i', '330e M Sport'],
    'Audi':          ['S line', 'Black Edition', 'S3', 'RS3'],
    'Mercedes-Benz': ['AMG Line', 'C43 AMG', 'Premium Plus', 'Night Edition'],
    'Volkswagen':    ['R-Line', 'GTI', 'R', 'Match'],
    'Porsche':       ['Carrera S', 'Turbo', 'Turbo S', 'GTS'],
    'Ford':          ['ST-Line', 'ST-3', 'Titanium', 'Vignale'],
    'Vauxhall':      ['SRi', 'Griffin', 'Elite Nav', 'GS Line'],
    'Toyota':        ['Icon', 'Icon Tech', 'Design', 'GR Sport'],
    'Nissan':        ['N-Connecta', 'Tekna', 'Acenta Premium'],
    'Hyundai':       ['Premium', 'N Line', 'SE Connect', 'Ultimate'],
    'Kia':           ['GT-Line', 'GT-Line S', '3', '4'],
    'Peugeot':       ['Allure', 'GT Line', 'Active Premium', 'GT'],
    'Citroen':       ['Shine', 'Shine Plus', 'Feel', 'C-Series'],
    'Renault':       ['Iconic', 'RS Line', 'GT Line', 'R.S.'],
    'SEAT':          ['FR', 'FR Sport', 'XCELLENCE', 'Cupra'],
    'Škoda':         ['SE', 'SE L', 'SportLine', 'vRS'],
    'Skoda':         ['SE', 'SE L', 'SportLine', 'vRS'], // safety duplicate
    'MINI':          ['Cooper', 'Cooper S', 'John Cooper Works'],
    'Land Rover':    ['HSE', 'HSE Dynamic', 'Autobiography', 'R-Dynamic'],
    'Range Rover':   ['HSE', 'Vogue', 'Autobiography', 'SVR'],
    'Volvo':         ['R-Design', 'Inscription', 'Momentum'],
    'Jaguar':        ['R-Sport', 'R-Dynamic', 'Portfolio', 'SVR'],
    'Honda':         ['Sport', 'SR', 'EX', 'Type R'],
    'Mazda':         ['Sport Nav', 'GT Sport', 'SE-L Nav'],
    'Lexus':         ['F Sport', 'Premium Pack', 'Takumi'],
    'Fiat':          ['Lounge', 'Pop', 'Sport', 'Dolcevita'],
    'Abarth':        ['595 Competizione', '595 Turismo', '695'],
    'Alfa Romeo':    ['Veloce', 'Ti', 'Quadrifoglio'],
    'Dacia':         ['Essential', 'Comfort', 'Prestige'],
    'Suzuki':        ['SZ-T', 'SZ5', 'Sport'],
    'MG':            ['Exclusive', 'Excite', 'Trophy'],
    'Jeep':          ['Limited', 'Trailhawk', 'Night Eagle'],
    'Tesla':         ['Long Range', 'Performance', 'Plaid'],
    'Cupra':         ['VZ2', 'VZ3', 'VZ Edition'],
    'DS':            ['Performance Line', 'Rivoli', 'Opera'],
    'Subaru':        ['Premium', 'SE', 'STI'],
    'Mitsubishi':    ['Juro', 'Exceed', '4hs'],
    'Smart':         ['Prime Premium', 'Pulse', 'Passion']
  };

  var defaultExamples = ['M Sport', 'GT Line', 'R-Line', 'Turbo S'];


  var timer = null;
  var list  = defaultExamples;
  var idx   = 0;
  var pos   = 0;

  function stopTyping() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startTyping() {
    if (!trimInp) return;
    if (trimInp.disabled) return;
    if (trimInp.value && trimInp.value.trim()) return;

    var make = makeSel.value || '';
    list = examplesByMake[make] || defaultExamples;
    if (!list.length) return;

    stopTyping();
    idx = 0;
    pos = 0;

    timer = setInterval(function(){
      if (!trimInp) { stopTyping(); return; }
      if (trimInp.disabled) { stopTyping(); return; }
      if (trimInp.value && trimInp.value.trim()) { stopTyping(); return; }

      var phrase = list[idx] || '';
      var prefix = 'e.g. ';
      var pause  = 4; // a few extra ticks at the end
      var total  = phrase.length + pause;

      if (pos <= phrase.length) {
        trimInp.placeholder = prefix + phrase.slice(0, pos);
      } else if (pos > total) {
        idx = (idx + 1) % list.length;
        pos = 0;
        return;
      }
      pos++;
    }, 120);
  }

  // When make changes, reset hint
  makeSel.addEventListener('change', function(){
    stopTyping();
    if (trimInp) {
      // Part B still controls disabled state – we just reset the placeholder
      trimInp.placeholder = 'Variant keyword';
    }
  });

  // When model changes, start hint if make+model selected and input is enabled/empty
  modelSel.addEventListener('change', function(){
    stopTyping();
    if (!trimInp) return;
    if (makeSel.value && modelSel.value && !trimInp.disabled && !(trimInp.value && trimInp.value.trim())) {
      startTyping();
    }
  });

  // If user types, kill the animation
  trimInp.addEventListener('input', function(){
    if (trimInp.value && trimInp.value.trim()) {
      stopTyping();
    }
  });

  // On focus, if they’ve already typed, stop
  trimInp.addEventListener('focus', function(){
    if (trimInp.value && trimInp.value.trim()) {
      stopTyping();
    }
  });

  // On blur, if still empty and unlocked, restart hint
  trimInp.addEventListener('blur', function(){
    if (!trimInp.value || !trimInp.value.trim()) {
      if (!trimInp.disabled && makeSel.value && modelSel.value) {
        startTyping();
      }
    }
  });
})();

(function() {
  if (window.__ticaryPartC) return;
  window.__ticaryPartC = true;

  // ✅ Disable the main-page map entirely (we're moving map usage into the vehicle popup)
  // Only allow the standalone map embed mode: ?embed=map
  const __tcParams = new URLSearchParams(location.search);
  const __tcIsEmbedMap = (__tcParams.get('embed') || '').toLowerCase() === 'map';
  if (!__tcIsEmbedMap) return;

    // Inline map toggle button styles
  (function(){
    const css = `
      #as-map-inline-toggle{
  position:absolute;
  top:14px;
  left:14px;
  z-index:5;
  padding:10px 18px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,0.25);
  background:rgba(15,20,24,0.9);
  color:#e8f0f5;
  font-size:0.9rem;
  font-weight:600;
  cursor:pointer;
  box-shadow:0 6px 18px rgba(0,0,0,0.4);
  backdrop-filter:blur(4px);
  display:inline-flex;
  align-items:center;
  gap:8px;
}
      #as-map-inline-toggle:hover{
        border-color:rgba(255,255,255,0.45);
        background:rgba(20,26,32,0.95);
      }
      #as-map-inline-toggle:active{
        transform:translateY(1px);
      }
      #as-map-inline-toggle::before{
        content:'⇤';
        font-size:0.8rem;
        opacity:0.8;
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  })();
    // Inline styles for "click to interact" map overlay
  (function(){
    const css = `
      #as-map-blocker{
        position:absolute;
        inset:0;
        z-index:5;
        display:flex;
        align-items:center;
        justify-content:center;
        border:none;
        padding:0;
        /* more transparent so the map shows through */
        background:linear-gradient(
          to bottom,
          rgba(15,23,42,0.40),
          rgba(15,23,42,0.60)
        );
        color:#e5f0ff;
        font-size:12px;
        letter-spacing:0.08em;
        text-transform:uppercase;
        cursor:pointer;
        backdrop-filter:blur(2px);
      }
      #as-map-blocker span{
        padding:7px 14px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,0.6);
        /* slightly see-through pill as well */
        background:rgba(15,23,42,0.85);
      }
      :root[data-theme="light"] #as-map-blocker{
        background:linear-gradient(
          to bottom,
          rgba(243,244,246,0.35),
          rgba(243,244,246,0.55)
        );
        color:#111827;
      }
      :root[data-theme="light"] #as-map-blocker span{
        background:rgba(255,255,255,0.90);
        border-color:rgba(148,163,184,0.7);
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  })();


    const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGF6d2FyLWQiLCJhIjoiY21mMmxncXhzMXJ5aTJqcXl0NjR3MHhvbSJ9.LxklMmgRSbTmC6NG2JrXQQ';
  const UK_CENTER = [-1.8, 53.7];
  const FAV_KEY = 'as:favs';

  // Defer heavy marker work until the user actually interacts with the map
  window.__ticaryMapReadyForPins = window.__ticaryMapReadyForPins || false;
  window.__ticaryLatestMapPayload = window.__ticaryLatestMapPayload || null;

  const $ = (s, r = document) => r.querySelector(s);


  function waitForReady(callback, tries = 0) {
    if (window.__ticaryItems && window.__ticaryApply) callback();
    else if (tries < 100) setTimeout(() => waitForReady(callback, tries + 1), 50);
    else console.error('❌ Part B not loaded');
  }

  waitForReady(() => {
    const items = window.__ticaryItems;
    const favIDs = window.__ticaryFavIDs;
    const saveFavs = window.__ticarySaveFavs;

        let mapWrap = $('.as-mapwrap');
    if (!mapWrap) {
      mapWrap = document.createElement('div');
      mapWrap.className = 'as-mapwrap';
      const mapEl = document.createElement('div');
      mapEl.id = 'as-map';
      mapWrap.appendChild(mapEl);
      var toolbar = $('.as-listbar-new') || $('.as-listbar');
      if (toolbar?.parentElement) toolbar.parentElement.insertBefore(mapWrap, toolbar);
    }

    // Mobile-only panel, but ONLY on the standalone map embed (?embed=map)
    const params      = new URLSearchParams(location.search);
    const isEmbedMap  = (params.get('embed') || '').toLowerCase() === 'map';
    const IS_MOBILE   = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

    let mobilePanel = null;
    if (IS_MOBILE && isEmbedMap && mapWrap && mapWrap.parentElement) {
      document.body.classList.add('as-map-embed');

      mobilePanel = document.getElementById('as-map-mobile-panel');
      if (!mobilePanel) {
        mobilePanel = document.createElement('div');
        mobilePanel.id = 'as-map-mobile-panel';
        mobilePanel.className = 'as-map-mobile-panel';
        mapWrap.parentElement.insertBefore(mobilePanel, mapWrap.nextSibling);
      }
    }



        if (!window.mapboxgl) { console.error('❌ Mapbox GL not loaded'); return; }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: 'as-map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: UK_CENTER,
      zoom: 5.5,
      renderWorldCopies: false
    });

    // Very loose UK-ish bounds so you can see full UK easily
    const UK_BOUNDS = [
      [-20.0, 45.0],  // SW – way out into the Atlantic, a bit below Cornwall
      [ 10.0, 65.0]   // NE – above Scotland and to the right
    ];

    map.setMaxBounds(UK_BOUNDS);
    // ❌ no minZoom – allow zooming out as far as Mapbox wants
    // map.setMinZoom(...) removed on purpose
    map.setMaxZoom(17);

    // --- Map lock: start non-interactive until user clicks overlay ---
    try {
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.dragPan.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    } catch (err) {
      console.warn('Map interaction disable failed', err);
    }

    const mapContainer = document.getElementById('as-map');
    if (mapContainer) {
      // Ensure positioned so the blocker can sit on top
      if (getComputedStyle(mapContainer).position === 'static') {
        mapContainer.style.position = 'relative';
      }

      const blocker = document.createElement('button');
      blocker.id = 'as-map-blocker';
      blocker.type = 'button';
      blocker.setAttribute('aria-label', 'Click to interact with map');
      blocker.innerHTML = '<span>Click to interact with map</span>';

      mapContainer.appendChild(blocker);

      function enableMapInteraction() {
        try {
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragPan.enable();
          map.keyboard.enable();
          map.doubleClickZoom.enable();
          map.touchZoomRotate.enable();
        } catch (err) {
          console.warn('Map interaction enable failed', err);
        }
                window.__ticaryMapReadyForPins = true;
        if (window.__ticaryLatestMapPayload) {
          try {
            updateMap(window.__ticaryLatestMapPayload, true);
          } catch (e) {
            console.warn('Map update on enable failed', e);
          }
        }

        if (blocker && blocker.parentElement) {
          blocker.parentElement.removeChild(blocker);
        }
      }

      blocker.addEventListener('click', function (ev) {
        ev.stopPropagation();
        enableMapInteraction();
      });
    }
    // --- End map lock ---

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    window.map = map;



        let markers = [];
    let activePopupData = null;

    /* ... REST OF YOUR ORIGINAL PART C CODE CONTINUES UNCHANGED ... */
    /* NOTE: keep everything below exactly as your existing embed has it. */

  });
})();

(function(){
  // TICARY — dynamic sticky top for filters (desktop only)
  if (window.__tcStickyFiltersTopV1) return;
  window.__tcStickyFiltersTopV1 = 1;

  function isDesktop(){
    return window.matchMedia && window.matchMedia('(min-width: 901px)').matches;
  }

  function update(){
    if (!isDesktop()) return;

    const header = document.getElementById('tc-header');
    const root = document.documentElement;
    if (!root) return;

    // When header is visible, use its bottom as the offset.
    // When it's gone (bottom <= 0), collapse to a small top padding.
    let top = 0;

    if (header && header.getBoundingClientRect){
      const r = header.getBoundingClientRect();
      const bottom = Math.round(r.bottom);
      if (bottom > 0) top = bottom + 0; // 12px gap under header
    }

    root.style.setProperty('--tc-sticky-top', top + 'px');
  }

  update();
  window.addEventListener('scroll', update, { passive:true });
  window.addEventListener('resize', update, { passive:true });
})();

(function(){
  // TICARY — Hard lock horizontal pan (desktop) v2
  if (window.__tcLockX_v2) return;
  window.__tcLockX_v2 = 1;

  const DESKTOP = !window.matchMedia || window.matchMedia("(min-width: 901px)").matches;
  if (!DESKTOP) return;

  const root = document.scrollingElement || document.documentElement;

  function lockX(){
    try{
      if (root && root.scrollLeft) root.scrollLeft = 0;
      if (document.documentElement.scrollLeft) document.documentElement.scrollLeft = 0;
      if (document.body.scrollLeft) document.body.scrollLeft = 0;

      // Also snap any inner scrollers that might exist
      const els = [
        document.querySelector("#as-filters"),
        document.querySelector("#as-grid"),
        document.querySelector("#as-layout"),
        document.querySelector("#as-content"),
        document.querySelector("#vehicles-list-wrapper"),
        document.querySelector(".ds-grid"),
        document.querySelector(".ds-wrap")
      ].filter(Boolean);

      for (const el of els){
        if (el.scrollLeft) el.scrollLeft = 0;
      }
    }catch(e){}
  }

  // Capture phase = intercept earlier (reduces “gesture” UI + wiggle)
  document.addEventListener("wheel", (e) => {
    const dx = e.deltaX || 0;
    const dy = e.deltaY || 0;

    // If there is any real horizontal intent, block it
    if (Math.abs(dx) > 0.5 && Math.abs(dx) >= Math.abs(dy)) {
      e.preventDefault();
      lockX();
    }
  }, { passive:false, capture:true });

  window.addEventListener("scroll", lockX, { passive:true });
  window.addEventListener("resize", lockX, { passive:true });

  setTimeout(lockX, 0);
  setTimeout(lockX, 120);
})();

(function(){
  // TICARY — on any filter change, jump to top (desktop only)
  if (window.__tcFiltersJumpTopV1) return;
  window.__tcFiltersJumpTopV1 = 1;

  const DESKTOP = window.matchMedia && window.matchMedia("(min-width: 901px)").matches;
  if (!DESKTOP) return;

  const filters = document.getElementById("as-filters");
  if (!filters) return;

  let t = 0;
  function jumpTop(){
    clearTimeout(t);
    t = setTimeout(()=>{
      // smooth but quick
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 40);
  }

  // Any select / checkbox / radio / range / text input changes in filters
  filters.addEventListener("change", (e)=>{
    const el = e.target;
    if (!el) return;
    // ignore irrelevant stuff
    if (el.closest("button")) return;
    jumpTop();
  }, true);

  // Catch "Apply" buttons too (if you have one)
  filters.addEventListener("click", (e)=>{
    const apply = e.target?.closest?.("#asf-apply, [data-filter-apply], .asf-apply");
    if (!apply) return;
    jumpTop();
  }, true);
})();

/* TICARY — Lightweight override for "Change filters" mode (desktop only)
   - No MutationObserver, no scroll listeners
   - Click toggles filters only (no scroll-to-top)
   - Small interval corrects label if Part B flips it to "Change filters"
*/
(function(){
  if (window.__tcFixChangeFiltersLiteV1) return;
  window.__tcFixChangeFiltersLiteV1 = 1;

  const mqDesktop = window.matchMedia ? window.matchMedia('(min-width: 901px)') : null;
  const isDesktop = () => !mqDesktop || mqDesktop.matches;

  function labelForState(){
    const closed = document.body.classList.contains('as-no-filters');
    return closed ? 'Show filters' : 'Hide filters';
  }

  function setLabel(btn){
    if (!btn || !isDesktop()) return;
    const want = labelForState();
    if (btn.textContent !== want) btn.textContent = want;
  }

  function init(){
    var btn = document.getElementById('as-filters-toggle-new') || document.getElementById('as-filters-toggle');
    if (!btn) return false;

    // Ensure label is correct now
    setLabel(btn);

    // Override click BEFORE Part B's handler (capture)
    if (!btn.__tcBoundLite){
      btn.__tcBoundLite = true;

      btn.addEventListener('click', function(e){
        if (!isDesktop()) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        document.body.classList.toggle('as-no-filters');
        setLabel(btn);

        setTimeout(() => {
          if (window.map && typeof window.map.resize === 'function') window.map.resize();
        }, 120);
      }, true);
    }

    // Low-frequency “label corrector”
    // Only does anything if the label is wrong (e.g., becomes "Change filters")
    if (!window.__tcFixChangeFiltersLiteTimer){
      window.__tcFixChangeFiltersLiteTimer = setInterval(() => {
        if (!isDesktop()) return;
        var b = document.getElementById('as-filters-toggle-new') || document.getElementById('as-filters-toggle');
        if (!b) return;

        // Only correct if it has drifted
        const want = labelForState();
        if (b.textContent !== want) b.textContent = want;
      }, 350);
    }

    return true;
  }

  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (init() || tries > 80) clearInterval(t);
  }, 150);
})();

/* ==== Ticary /improved — Shareable URLs (V3.1 zero-safe) ==== */
(function(){
  if (window.__tcUrlSyncV31) return; window.__tcUrlSyncV31 = true;

  // -------- helpers ----------
  const $  = (s,sc=document)=>sc.querySelector(s);
  const $$ = (s,sc=document)=>Array.from(sc.querySelectorAll(s));
  const num = (v)=>{ const n=Number((v||'').toString().replace(/[, ]+/g,'')); return isFinite(n)?n:''; };
  const to5 = (x)=> (Math.round(x*1e5)/1e5).toString();
  const z2e = (v)=> v===0 ? '' : v; // zero -> empty (unset)

  const MAP = {
  make:'m', model:'mo', trim:'tr', fuel:'fu', gearbox:'gb', bodytype:'bt',
  priceMin:'pmin', priceMax:'pmax', yearMin:'ymin', yearMax:'ymax',
  mileageMax:'mil', distance:'dist', origin:'o', sort:'s',
  financeMin:'fmin', financeMax:'fmax'
};

const parseQS = () => {
  const q = new URLSearchParams(location.search);
  const o = {};
  for (const [k, v] of q) o[k] = v;
  return o;
};


  function filtersFromQS(q){
    const f = {
      make:q[MAP.make]||'', model:q[MAP.model]||'', trim:q[MAP.trim]||'',
      fuel:q[MAP.fuel]||'', gearbox:q[MAP.gearbox]||'', bodytype:q[MAP.bodytype]||'',
      priceMin:z2e(num(q[MAP.priceMin])), priceMax:z2e(num(q[MAP.priceMax])),
      yearMin:z2e(num(q[MAP.yearMin])),   yearMax:z2e(num(q[MAP.yearMax])),
      mileageMax: z2e(num(q[MAP.mileageMax])),
      distance:   z2e(num(q[MAP.distance])),
      financeMin: z2e(num(q[MAP.financeMin])),
      financeMax: z2e(num(q[MAP.financeMax])),
      origin:     null,
      sort:       q[MAP.sort] || ''

    };
    const O=q[MAP.origin];
    if (O){ const m=O.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/); if(m) f.origin={lat:+m[1], lng:+m[2]}; }
    if (!f.origin) f.distance=''; // safety: no origin => ignore distance
    return f;
  }

  function setControlsAndStateFromFilters(f, scope){
    const ev = (el,t='change')=> el && el.dispatchEvent(new Event(t,{bubbles:true}));
    const setVal=(sel,v)=>{ if (sel && v!==''){ sel.value=v; ev(sel); } };
    const setNum=(inp,v)=>{ if (inp && v!==''){ inp.value=v; ev(inp,'input'); ev(inp,'change'); } };

    const selMake=$('#asf-make',scope), selModel=$('#asf-model',scope), selTrim=$('#asf-trim',scope);

    // populate dependent selects reliably
    if (selMake && f.make){ selMake.value=f.make; ev(selMake); }
    const fillModels = (window.fillModels||window.populateModels||(()=>{}));
    const fillTrims  = (window.fillTrims ||window.populateTrims ||(()=>{}));
    try{ if (fillModels && f.make) fillModels(f.make); }catch{}
    try{ if (selModel && f.model){ selModel.disabled=false; selModel.value=f.model; ev(selModel); } }catch{}
    try{ if (fillTrims && f.model) fillTrims(f.model); }catch{}
    try{ if (selTrim && f.trim){ selTrim.disabled=false; selTrim.value=f.trim; ev(selTrim); } }catch{}

    setVal($('#asf-fuel',scope), f.fuel);
    setVal($('#asf-gear',scope), f.gearbox);
    setVal($('#asf-bodytype',scope), f.bodytype);

    setNum($('#asf-price-min',scope), f.priceMin);
    setNum($('#asf-price-max',scope), f.priceMax);
    setNum($('#asf-year-min', scope), f.yearMin);
    setNum($('#asf-year-max', scope), f.yearMax);
    setNum($('#asf-mileage-max',scope), f.mileageMax);
    setNum($('#asf-fin-min',scope), f.financeMin);
    setNum($('#asf-fin-max',scope), f.financeMax);


    // distance/origin controls
    const rng=$('#asf-distance-range',scope), lbl=$('#asf-distance-label',scope);
    if (f.origin){
      if (!window.state) window.state={};
      (state.draft ||= {}).origin = {lat:f.origin.lat, lng:f.origin.lng};
      (state.filters ||= {}).origin = {lat:f.origin.lat, lng:f.origin.lng};
      if (rng){ rng.disabled=false; if (f.distance!=='') rng.value=String(f.distance); }
      if (lbl){ const v=rng?.value||f.distance||25; lbl.textContent=`Within ${v} miles`; }
    }

    // sorting
    if (f.sort){ const s=$('#as-sort'); if (s){ s.value=f.sort; ev(s,'change'); } }

    // ALSO pack into state (zeros already normalized)
    if (!window.state) window.state={};
    const pack = {
      make:f.make||'', model:f.model||'', trim:f.trim||'',
      fuel:f.fuel||'', gearbox:f.gearbox||'', bodytype:f.bodytype||'',
      priceMin:f.priceMin||'', priceMax:f.priceMax||'',
      yearMin:f.yearMin||'',   yearMax:f.yearMax||'',
      mileageMax:f.mileageMax||'',
      distance:f.distance||'',
      origin:f.origin||null
    };
    state.draft   = Object.assign({}, state.draft  ||{}, pack);
    state.filters = Object.assign({}, state.filters||{}, pack);
  }

  function buildQSFromControls(scope){
    const p = new URLSearchParams();
    const val = (id)=> ( $(id,scope)?.value || '' ).trim();
    const nn  = (id)=> { const v = num($(id,scope)?.value); return (v===0?'':v); }; // drop zeros

        const m = {
      [MAP.make]:       val('#asf-make'),
      [MAP.model]:      val('#asf-model'),
      [MAP.trim]:       val('#asf-trim'),
      [MAP.fuel]:       val('#asf-fuel'),
      [MAP.gearbox]:    val('#asf-gear'),
      [MAP.bodytype]:   val('#asf-bodytype'),
      [MAP.priceMin]:   nn('#asf-price-min'),
      [MAP.priceMax]:   nn('#asf-price-max'),
      [MAP.yearMin]:    nn('#asf-year-min'),
      [MAP.yearMax]:    nn('#asf-year-max'),
      [MAP.mileageMax]: nn('#asf-mileage-max'),
      [MAP.distance]:   nn('#asf-distance-range'),
      [MAP.financeMin]: nn('#asf-fin-min'),
      [MAP.financeMax]: nn('#asf-fin-max'),
      [MAP.sort]:       $('#as-sort')?.value || ''
    };


    const origin = (window.state && (state.draft?.origin || state.filters?.origin)) || null;
    if (origin && isFinite(origin.lat) && isFinite(origin.lng)) m[MAP.origin] = `${to5(origin.lat)},${to5(origin.lng)}`;
    else delete m[MAP.distance]; // no origin => drop dist

    for (const [k,v] of Object.entries(m)) if (v!=='' && v!=null) p.set(k,v);
    return p.toString();
  }

  function dataReady(){
    if (window.state && ((state.items&&state.items.length) || (state.all&&state.all.length))) return true;
    if (document.querySelector('.as-card,[data-as-id],[data-lat]')) return true;
    return false;
  }

  function runApply(){
    if (typeof window.apply === 'function'){ try{ window.apply(); return; }catch{} }
    const btn=$('#asf-apply')||$('#asf-apply-top'); if (btn){ btn.click(); return; }
  }

  function hydrateFromURL(){
    const q = parseQS();
    const hasAny = Object.keys(q).some(k=>Object.values(MAP).includes(k));
    if (!hasAny) return;

    const scope = $('#as-filters-body .asf') || $('#as-filters-body') || document;
    const f = filtersFromQS(q);
    setControlsAndStateFromFilters(f, scope);

    // Apply after UI+data are there, then burst-apply a few times to catch late data
    let tries=0, max=600; // up to ~10s waiting for data
    const wait = () => {
      if (dataReady() || tries>max){
        runApply();
        for (let i=1;i<=8;i++) setTimeout(runApply, i*250);
        return;
      }
      tries++; requestAnimationFrame(wait);
    };
    wait();
  }

  function updateURLFromForm(){
    const scope = $('#as-filters-body .asf') || $('#as-filters-body') || document;
    const qs = buildQSFromControls(scope);
    const url = qs ? (`?${qs}`) : location.pathname;
    history.pushState({qs}, '', url);
  }

  function wire(){
  const scope = $('#as-filters-body .asf') || $('#as-filters-body') || document;

  const applyLikeButtons = [
    ...$$('#asf-apply', scope),
    ...$$('#asf-apply-top', scope),
    ...$$('#asf-distance-go', scope)
  ];

  applyLikeButtons.forEach(b => {
    b.addEventListener('click', () => {
      // Update URL / results
      setTimeout(updateURLFromForm, 0);

      // On mobile, close the slide-in filters panel
      try {
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && window.tcFilterPanel && typeof window.tcFilterPanel.close === 'function') {
          setTimeout(() => window.tcFilterPanel.close(), 0);
        }
      } catch (e) {}
    }, { passive: true });
  });

  [...$$('#asf-clear',scope), ...$$('#asf-clear-top',scope)].forEach(b=>{
    b.addEventListener('click', ()=> setTimeout(()=> history.pushState({}, '', location.pathname), 0), {passive:true});
  });
  $('#as-sort')?.addEventListener('change', ()=> setTimeout(updateURLFromForm, 0), {passive:true});
}
    // Distance "Go" button – same behaviour as Search
  const distanceGo = $('#asf-distance-go', scope) || document.getElementById('asf-distance-go');
  if (distanceGo) {
    distanceGo.addEventListener('click', () => {
      // Update URL / results
      setTimeout(updateURLFromForm, 0);

      // On mobile, close the slide-in filters panel
      try {
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && window.tcFilterPanel && typeof window.tcFilterPanel.close === 'function') {
          setTimeout(() => window.tcFilterPanel.close(), 0);
        }
      } catch (e) {}
    }, { passive: true });
  }


  function boot(){
  let tries=0, max=300;

  function wrapApplyOnce(){
    if (window.__tcApplyWrapped) return;
    const orig = window.apply;
    if (typeof orig !== 'function') return;
    window.__tcApplyWrapped = true;
    window.apply = function(...args){
      const out = orig.apply(this, args);
      try { updateURLFromForm(); } catch(e){}
      return out;
    };
  }

  const tick = () => {
    const uiReady = $('#asf-apply') && $('#as-filters-body');
    if (uiReady){
      wrapApplyOnce();
      wire();
      hydrateFromURL();
      return;
    }
    if (++tries > max){
      hydrateFromURL();
      return;
    }
    requestAnimationFrame(tick);
  };
  tick();
}


  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Back/forward -> re-hydrate
  window.addEventListener('popstate', ()=> hydrateFromURL());
})();

/* Jump to top on Apply / Clear (buttons at top & bottom, and future re-renders) */
(function(){
  if (window.__asJumpTop) return; window.__asJumpTop = true;

  function jumpToTop(){
    try {
      (document.scrollingElement || document.documentElement)
        .scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0,0);
    }
  }

  // Event delegation so it works even if Webflow re-renders the listbar/filters
  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest(
      '#asf-apply, #asf-apply-top, #asf-clear, #asf-clear-top, ' +
      '[data-as-action="apply"], [data-as-action="clear"], ' +
      '.asf-apply, .asf-clear'
    );
    if (btn) jumpToTop();
  }, { capture:true, passive:true });

  // Also handle Enter key submits inside the filters form
  document.addEventListener('submit', function(ev){
    const form = ev.target;
    if (!form) return;
    const inFilters = form.closest('#as-filters-body, .asf, #as-filters');
    if (inFilters) jumpToTop();
  }, { capture:true });
})();

/* Ticary — Smart popup anchoring V2
   Keeps popup attached to the pin but auto-flips anchor on pan/zoom to stay in view. */
(function(){
  if (window.__tcSmartPopupAnchorV2) return; window.__tcSmartPopupAnchorV2 = true;

  function offsets(px){
    return {
      'top': [0,  px],
      'top-left': [ px,  px],
      'top-right': [-px,  px],
      'bottom': [0, -px],
      'bottom-left': [ px, -px],
      'bottom-right': [-px, -px],
      'left': [ px, 0],
      'right': [-px, 0]
    };
  }

  function adjustAnchor(popup, depth){
    const map = popup && popup._map; if (!map) return;
    const mapEl = map.getContainer(); if (!mapEl) return;
    const el = popup.getElement(); if (!el) return;

    requestAnimationFrame(()=>{
      const mr = mapEl.getBoundingClientRect();
      const br = el.getBoundingClientRect();
      const margin = 8;

      const overTop    = br.top    < mr.top    + margin;
      const overBottom = br.bottom > mr.bottom - margin;
      const overLeft   = br.left   < mr.left   + margin;
      const overRight  = br.right  > mr.right  - margin;

      // If nothing is clipped, we're good.
      if (!(overTop || overBottom || overLeft || overRight)) return;

      // Screen point of the pin
      const pt = map.project(popup._lngLat);
      const availLeft   = (pt.x - mr.left);
      const availRight  = (mr.right - pt.x);
      const availTop    = (pt.y - mr.top);
      const availBottom = (mr.bottom - pt.y);

      let anchor = popup.options.anchor || 'bottom';

      // Prefer switching axis that's overflowing most.
      if (overTop || overBottom){
        // vertical overflow → use a side with more space
        anchor = (availRight >= availLeft) ? 'left' : 'right';
      } else if (overLeft || overRight){
        // horizontal overflow → use top/bottom with more space
        anchor = (availBottom >= availTop) ? 'top' : 'bottom';
      }

      // If unchanged, bail.
      if (popup.options.anchor === anchor) return;

      try {
        popup.options.anchor = anchor;
        popup.setOffset(offsets(12));
        // Force Mapbox to recompute layout at the same lng/lat
        popup.setLngLat(popup._lngLat);
      } catch(e) {
        // Rare fallback: recreate popup with new anchor
        try{
          const html = el.querySelector('.mapboxgl-popup-content')?.innerHTML || '';
          const ll = popup._lngLat;
          const o = popup.options || {};
          popup.remove();
          new mapboxgl.Popup({
            anchor,
            offset: offsets(12),
            closeButton: o.closeButton !== false,
            closeOnClick: o.closeOnClick !== false,
            maxWidth: o.maxWidth || '320px',
            className: o.className || ''
          }).setLngLat(ll).setHTML(html).addTo(map);
        }catch(_){}
      }

      // Re-check a couple times in case content size/layout changed.
      const n = (depth|0);
      if (n < 3) requestAnimationFrame(()=>adjustAnchor(popup, n+1));
    });
  }

  // Patch addTo so every new popup auto-adjusts on open and during map interactions
  const _addTo = mapboxgl.Popup.prototype.addTo;
  mapboxgl.Popup.prototype.addTo = function(map){
    const popup = this;
    let raf = 0;
    const reAdjust = ()=>{ cancelAnimationFrame(raf); raf = requestAnimationFrame(()=>adjustAnchor(popup)); };

    popup.once('open', () => {
      reAdjust();
      // re-check after images/carousels settle
      setTimeout(reAdjust, 120);
      setTimeout(reAdjust, 300);
    });

    // Keep it in view while the user moves/zooms the map
    popup.on('open', () => {
      if (!popup._map) return;
      const m = popup._map;
      m.on('move', reAdjust);
      m.on('zoom', reAdjust);
      m.on('resize', reAdjust);
      m.on('moveend', reAdjust);
    });
    popup.on('close', () => {
      if (!popup._map) return;
      const m = popup._map;
      m.off('move', reAdjust);
      m.off('zoom', reAdjust);
      m.off('resize', reAdjust);
      m.off('moveend', reAdjust);
    });

    return _addTo.call(this, map);
  };
})();

/* Year inputs → real selects overlay (V2.1)
   - Keeps original #asf-year-min / #asf-year-max inputs (hidden)
   - Mirrors values both ways
   - Auto clamps Min > Max
   - Resets selects to "Any" on Clear (top/bottom) and on popstate re-hydration */
(function(){
  if (window.__asYearSelectsV21) return; window.__asYearSelectsV21 = true;

  const IDS = ['asf-year-min','asf-year-max'];
  const MIN_YEAR = 1990;

  function buildSelect(forId){
    const input = document.getElementById(forId);
    if (!input || input.dataset.hasSelect) return null;

    const curYear = new Date().getFullYear();
    const sel = document.createElement('select');
    sel.id = forId + '-select';
    sel.className = 'asf-year-select';
    sel.setAttribute('aria-label', forId.includes('min') ? 'Year from' : 'Year to');

    // Any
    const oAny = document.createElement('option');
    oAny.value = ''; oAny.textContent = 'Any';
    sel.appendChild(oAny);

    for (let y = curYear; y >= MIN_YEAR; y--){
      const o = document.createElement('option');
      o.value = String(y);
      o.textContent = String(y);
      sel.appendChild(o);
    }

    // initial value from input
    if (input.value) sel.value = String(input.value);

    // place select before input and hide input (but keep IDs)
    input.parentNode.insertBefore(sel, input);
    input.style.display = 'none';

    // mirror select -> input
    function writeBack(){
      input.value = sel.value;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
    }
    sel.addEventListener('change', ()=>{ __lastChanged = forId; clampYears(); writeBack(); });

    // mirror input -> select (URL hydration / programmatic)
    function syncFromInput(){ if (sel.value !== input.value) sel.value = input.value || ''; }
    input.addEventListener('change', syncFromInput);
    input.addEventListener('input',  syncFromInput);

    input.dataset.hasSelect = '1';
    return sel;
  }

  let __lastChanged = null;
  function clampYears(){
    const minIn  = document.getElementById('asf-year-min');
    const maxIn  = document.getElementById('asf-year-max');
    const minSel = document.getElementById('asf-year-min-select');
    const maxSel = document.getElementById('asf-year-max-select');
    if (!minIn || !maxIn || !minSel || !maxSel) return;

    const a = minSel.value ? parseInt(minSel.value,10) : null;
    const b = maxSel.value ? parseInt(maxSel.value,10) : null;
    if (a!=null && b!=null && a>b){
      if (__lastChanged === 'asf-year-min'){
        maxSel.value = String(a);
        maxIn.value  = String(a);
        maxIn.dispatchEvent(new Event('input', {bubbles:true}));
        maxIn.dispatchEvent(new Event('change',{bubbles:true}));
      } else {
        minSel.value = String(b);
        minIn.value  = String(b);
        minIn.dispatchEvent(new Event('input', {bubbles:true}));
        minIn.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
  }

  function syncFromInputs(){
    const minIn  = document.getElementById('asf-year-min');
    const maxIn  = document.getElementById('asf-year-max');
    const minSel = document.getElementById('asf-year-min-select');
    const maxSel = document.getElementById('asf-year-max-select');
    if (minIn && minSel) minSel.value = minIn.value || '';
    if (maxIn && maxSel) maxSel.value = maxIn.value || '';
  }

  function resetYearToAny(){
    const minIn  = document.getElementById('asf-year-min');
    const maxIn  = document.getElementById('asf-year-max');
    const minSel = document.getElementById('asf-year-min-select');
    const maxSel = document.getElementById('asf-year-max-select');
    if (minSel) minSel.value = '';
    if (maxSel) maxSel.value = '';
    if (minIn) { minIn.value=''; minIn.dispatchEvent(new Event('input',{bubbles:true})); minIn.dispatchEvent(new Event('change',{bubbles:true})); }
    if (maxIn) { maxIn.value=''; maxIn.dispatchEvent(new Event('input',{bubbles:true})); maxIn.dispatchEvent(new Event('change',{bubbles:true})); }
  }

  function initOnce(){
    IDS.forEach(buildSelect);
    clampYears();
  }

  // Boot when filters are present
  const boot = ()=>{
    if (document.getElementById('asf-year-min') && document.getElementById('asf-year-max')){
      initOnce();
    } else {
      let tries=0; const t=setInterval(()=>{
        if (document.getElementById('asf-year-min') && document.getElementById('asf-year-max')){
          clearInterval(t); initOnce();
        } else if (++tries>100){ clearInterval(t); }
      },50);
    }
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Re-init if filters rerender
  const mo = new MutationObserver(()=> initOnce());
  mo.observe(document.body, {childList:true, subtree:true});

  // Click capture: Clear buttons -> reset selects to Any (and inputs)
  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest('#asf-clear, #asf-clear-top, .asf-clear, [data-as-action="clear"], .as-btn-clear');
    if (!btn) return;
    // let their clear logic run, then sync ours
    setTimeout(resetYearToAny, 0);
    setTimeout(resetYearToAny, 60);
    setTimeout(syncFromInputs, 120);
  }, {capture:true, passive:true});

  // Back/forward navigation may hydrate values → reflect into selects
  window.addEventListener('popstate', ()=> {
    setTimeout(syncFromInputs, 0);
    setTimeout(syncFromInputs, 80);
  });
})();

/* Keep the popup "View" button blue on every carousel slide */
(function(){
  if (window.__tcPopupViewBlue) return; window.__tcPopupViewBlue = true;

  // Identify a "View" button (fallback if a slide misses .as-pop-view)
  function isViewBtn(el){
    if (!el || el.tagName!=='A') return false;
    if (el.classList.contains('as-pop-view')) return true;
    const t = (el.textContent||'').trim().toLowerCase();
    return t === 'view' || t === 'view details' || t === 'view car' || t === 'view vehicle';
  }

  function tagButtons(scope){
    scope.querySelectorAll('a').forEach(a=>{
      if (isViewBtn(a)) a.classList.add('as-pop-view');
    });
  }

  // Watch each popup individually so carousel DOM swaps get re-tagged
  function watchPopup(pop){
    if (!pop || pop.__watched) return;
    pop.__watched = true;
    tagButtons(pop);

    const mo = new MutationObserver(muts=>{
      for (const m of muts){
        if (m.type === 'childList'){
          m.addedNodes && m.addedNodes.forEach(n=>{
            if (n.nodeType===1) tagButtons(n);
          });
        }
      }
    });
    mo.observe(pop, {childList:true, subtree:true});
  }

  // When a popup appears, start watching it
  const root = document.body;
  const boot = ()=>{
    document.querySelectorAll('.mapboxgl-popup').forEach(watchPopup);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  const globalMO = new MutationObserver(muts=>{
    for (const m of muts){
      m.addedNodes && m.addedNodes.forEach(n=>{
        if (n.nodeType===1 && n.classList.contains('mapboxgl-popup')) watchPopup(n);
      });
    }
  });
  globalMO.observe(root, {childList:true, subtree:true});

  // Also tag on any click within a popup (covers slide nav buttons)
  document.addEventListener('click', e=>{
    const pop = e.target && e.target.closest('.mapboxgl-popup');
    if (pop) tagButtons(pop);
  }, {capture:true, passive:true});
})();

/* === Ticary Map Palette — friendly green land, pale blue water, light roads === */
(function(){
  if (window.__tcFlatPaletteV5) return; 
  window.__tcFlatPaletteV5 = true;

  // Friendly, slightly cartoonish palette
  const PIN   = '#2F7DE1';  // pin / primary blue
  const LAND  = '#A9D98B';  // soft light green land
  const PARK  = '#A9D98B';   // extra-light park/green
  const WATER = '#3fb1ce';  // ocean = pin blue
  const BLDG  = '#FFFFFF';  // white buildings
  const OUTL  = '#9FB6D0';  // soft blue-grey outlines
  const TEXT  = '#223047';  // dark slate for labels

  const ROAD         = '#FFFFFF'; // main road line (light)
  const ROAD_OUTLINE = '#F7D69A'; // warm yellowy outline for big roads

  const CITY_KEEP_GREY = true;    // keep urban/residential greys from base style

  // Capture latest map instance if not global
  (function hookMap(){
    if (!window.mapboxgl || !mapboxgl.Map || mapboxgl.Map.__tcHooked) return;
    const Orig = mapboxgl.Map;
    mapboxgl.Map = function(opts){
      const inst = new Orig(opts);
      window.__asMap = inst;
      return inst;
    };
    mapboxgl.Map.prototype = Orig.prototype;
    mapboxgl.Map.__tcHooked = true;
  })();

  function mapInst(){ 
    return window.__asMap || window.map || window.asMap || window.MAP || null; 
  }

  const setPaint = (m,id,p,v)=>{ try{ m.setPaintProperty(id,p,v); }catch(e){} };
  const setLayout= (m,id,p,v)=>{ try{ m.setLayoutProperty(id,p,v); }catch(e){} };
  const has = (id,re)=> re.test(id);

  function recolor(m){
    const style = m.getStyle && m.getStyle();
    if (!style || !style.layers) return;

    // 0) Background
    style.layers
      .filter(l=>l.type==='background')
      .forEach(l=>{
        setPaint(m, l.id, 'background-color', LAND);
      });

    style.layers.forEach(l=>{
      const id = l.id || '';
      const t  = l.type;

     // 1) Land & greens — flatten *everything* green-ish to one colour
if (
  t === 'fill' &&
  has(
    id,
    /(land$|landcover|landuse|park|natural|terrain|forest|wood|scrub|grass|meadow|national[-_ ]?park|national[-_ ]?landscape|protected|conservation|nature[-_ ]?reserve)/i
  )
) {
  const isUrban = CITY_KEEP_GREY && has(id,/(urban|residential|built)/i);
  if (!isUrban){
    setPaint(m, id, 'fill-color', LAND);
    setPaint(m, id, 'fill-opacity', 1);
  }
}
// 1b) Remove hillshade / relief darkening
if (t === 'fill' && has(id, /hillshade/i)) {
  setPaint(m, id, 'fill-opacity', 0);
}


      // 2) Buildings
      if (has(id,/building/)){
        if (t === 'fill'){
          setPaint(m, id, 'fill-color', BLDG);
          setPaint(m, id, 'fill-outline-color', OUTL);
          setPaint(m, id, 'fill-opacity', 0.9);
        } else if (t === 'line'){
          setPaint(m, id, 'line-color', OUTL);
          setPaint(m, id, 'line-width', 0.6);
        }
      }

      // 3) Water everywhere
      if (has(id,/^(water|waterway)/)){
        if (t === 'fill'){
          setPaint(m, id, 'fill-color', WATER);
          setPaint(m, id, 'fill-opacity', 1);
        } else if (t === 'line'){
          setPaint(m, id, 'line-color', WATER);
          setPaint(m, id, 'line-opacity', 1);
        }
      }

      // 4) Labels/icons — dark slate text + white halo for readability
      if (t === 'symbol'){
        setPaint(m, id, 'text-color', TEXT);
        setPaint(m, id, 'icon-color', TEXT);
        try{
          setPaint(m, id, 'text-halo-color', '#ffffff');
          setPaint(m, id, 'text-halo-width', 1.1);
        }catch(_){}
      }

      // 5) Roads — make them light and friendly (no black roads)
      if (t === 'line' && has(id,/^road-/)) {
        // Default road look
        setPaint(m, id, 'line-color', ROAD);
        // keep whatever width Mapbox uses (we're just recolouring)
        // we could gently fatten but it's optional
      }

      // Motorways / trunk / primary — give them a bit more weight + warm outline
      if (t === 'line' && has(id,/(motorway|trunk|primary)/)) {
        setPaint(m, id, 'line-color', ROAD);
        setPaint(m, id, 'line-width', [
          'interpolate', ['linear'], ['zoom'],
          5, 1.5,
          10, 3,
          14, 5,
          16, 7
        ]);
        // Some styles use separate casing layers, but we can try outline here
        try {
          setPaint(m, id, 'line-gap-width', 0);
          setPaint(m, id, 'line-outline-color', ROAD_OUTLINE);
        } catch(e){}
      }

      // 6) Rails / airports — keep subdued so roads & pins pop
      if (t === 'line' && has(id,/(rail|railway|aeroway|runway|airport)/i)){
        setPaint(m, id, 'line-color', OUTL);
        setPaint(m, id, 'line-opacity', 0.55);
      }
    });

    // Flatter look: remove fog if present
    try{ m.setFog(null); }catch(_){}
  }

  // Boot + re-apply on style reloads
  (function boot(tries=0){
    const m = mapInst();
    if (!m || typeof m.getStyle !== 'function'){
      if (tries > 200) return;
      setTimeout(()=>boot(tries+1), 60);
      return;
    }
    const apply = ()=> recolor(m);
    if (m.isStyleLoaded && !m.isStyleLoaded()){
      m.once('styledata', apply);
    } else {
      apply();
    }
    m.on('styledata', apply);
  })();
})();

/* Ticary — soften/remove road casings (white outlines on main roads) */
(function(){
  if (window.__tcRoadCasingTrim) return; window.__tcRoadCasingTrim = true;

  // Tune these:
  const CASING_OPACITY = 0.12;               // 0 = remove, 0.1–0.2 = subtle
  const CASING_COLOR   = 'rgba(0,0,0,0.25)'; // replace bright white with soft dark

  function getMap(){
    return window.__asMap || window.map || window.asMap || window.MAP || null;
  }
  function setPaint(m,id,p,v){ try{ m.setPaintProperty(id,p,v); }catch(e){} }

  function tameCasings(m){
    const style = m.getStyle && m.getStyle();
    if (!style || !style.layers) return;
    style.layers.forEach(l=>{
      const id = l.id || ''; const t = l.type;
      // Many Mapbox styles name these like:
      // road-primary-case, road-secondary-tertiary-case, road-motorway-trunk-case,
      // bridge-primary-case, tunnel-motorway-trunk-case, etc.
      if (t==='line' && /(road|bridge|tunnel).*?-case\b/i.test(id)){
        // Option A: make them very subtle
        setPaint(m, id, 'line-color', CASING_COLOR);
        setPaint(m, id, 'line-opacity', CASING_OPACITY);
        // If the style exposes casing width, give it a tiny nudge down
        try{
          const w = m.getPaintProperty(id, 'line-width');
          if (typeof w === 'number') setPaint(m, id, 'line-width', Math.max(0, w * 0.7));
        }catch(_){}
      }
    });
  }

  (function boot(tries=0){
    const m = getMap();
    if (!m || !m.getStyle){ if (tries>200) return; return setTimeout(()=>boot(tries+1), 60); }
    const apply = ()=> tameCasings(m);
    if (m.isStyleLoaded && !m.isStyleLoaded()){ m.once('styledata', apply); } else { apply(); }
    m.on('styledata', apply); // re-apply after any setStyle() / style reload
  })();
})();

(function () {
  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function closeFiltersForMobile() {
    const body = document.body;
    if (!body) return;
    // Hide filters overlay
    body.classList.add('as-no-filters');
    // In case any older class is still in use, clear it too (harmless if not)
    body.classList.remove('as-mobile-filters-open');
  }

  function scrollToResults() {
    const list =
      document.querySelector('#as-list') ||
      document.querySelector('.as-list') ||
      document.querySelector('.w-dyn-list');
    if (!list) return;

    const rect = list.getBoundingClientRect();
    const target = rect.top + window.scrollY - 64; // small offset under header
    window.scrollTo({ top: target, behavior: 'smooth' });
  }

  function wireApplyButtons() {
    const scope = document.getElementById('as-filters-body') || document;
    const buttons = scope.querySelectorAll('#asf-apply, #asf-apply-top, .asf-apply');

    buttons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          if (!isMobile()) return;
          // Let existing apply logic run first
          setTimeout(() => {
            closeFiltersForMobile();
            scrollToResults();
          }, 80);
        },
        { passive: true }
      );
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireApplyButtons);
  } else {
    wireApplyButtons();
  }
})();

(function(){
  if (window.__tcFavCleanSyncV1) return;
  window.__tcFavCleanSyncV1 = 1;

  const API = "https://vehicle-api-espm.onrender.com";
  const FAV_KEY = "as:favs";

  const loadFavs = () => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); }
    catch { return []; }
  };

  const saveFavs = (ids) => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); }
    catch {}
  };

  async function getToken(){
    try{
      const sb = window.sb;
      if (!sb?.auth?.getSession) return null;
      const { data } = await sb.auth.getSession();
      return data?.session?.access_token || null;
    }catch(e){
      return null;
    }
  }

  async function syncToServer(on, vehicle_id){
    if (!vehicle_id) return;

    const token = await getToken();
    if (!token) return;

    try{
      await fetch(`${API}/me/favourites/${vehicle_id}`, {
        method: on ? "POST" : "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
    }catch(e){
      console.warn("Fav sync failed", e);
    }
  }

  // Heart click -> sync to Neon
  document.addEventListener("click", function(e){
    const btn = e.target.closest(".as-fav-btn");
    if (!btn) return;

    const card = btn.closest(".as-card");
    if (!card) return;

    const vehicle_id = Number(card.dataset.vehicleId || 0);
    if (!vehicle_id) return;

    setTimeout(() => {
      const on = btn.getAttribute("aria-pressed") === "true";
      syncToServer(on, vehicle_id);
    }, 0);
  }, true);

  // Hydrate from Neon on page load
  async function hydrate(){
    const token = await getToken();
    if (!token) return;

    try{
      const res = await fetch(`${API}/me/favourites`, {
        headers: { Authorization: "Bearer " + token }
      });

      if (!res.ok) return;
      const data = await res.json();
      const serverIds = Array.isArray(data?.vehicle_ids) ? data.vehicle_ids : [];

      if (!serverIds.length) return;

      const cards = document.querySelectorAll(".as-card");
      const urlSet = new Set(loadFavs());

      cards.forEach(card => {
        const vid = Number(card.dataset.vehicleId || 0);
        if (!vid) return;

        if (serverIds.includes(vid)){
          const btn = card.querySelector(".as-fav-btn");
          if (btn) btn.setAttribute("aria-pressed", "true");

          if (card.dataset.url){
            urlSet.add(card.dataset.url);
          }
        }
      });

      saveFavs([...urlSet]);

      if (typeof window.updateFavsPanel === "function"){
        window.updateFavsPanel();
      }

    }catch(e){}
  }

  setTimeout(hydrate, 600);

})();

(function(){
  if (window.__tcDrawerFavBridgeV1) return;
  window.__tcDrawerFavBridgeV1 = 1;

  document.addEventListener("click", function(e){
    const removeBtn = e.target.closest(".th-fav-item-remove");
    if (!removeBtn) return;

    const item = removeBtn.closest(".th-fav-item");
    if (!item) return;

    const link = item.querySelector("a[href]");
    const url = (link?.getAttribute("href") || link?.href || "").trim();
    if (!url) return;

    const cards = document.querySelectorAll(".as-card");
    for (const card of cards){
      const cardUrl = (card.dataset.url || "").trim();
      if (cardUrl === url){
        const heart = card.querySelector(".as-fav-btn");
        if (heart && heart.getAttribute("aria-pressed") === "true"){
          heart.click();
        }
        break;
      }
    }
  }, true);
})();

(function(){
  if (window.__tcFavFabStableV1) return;
  window.__tcFavFabStableV1 = 1;

  const FAV_KEY = "as:favs";

  function qs(s,r=document){ return r.querySelector(s); }

  function findTopBtn(){
    return qs('#tc-backtotop, .back-to-top, .as-topbtn, [data-back-to-top]');
  }

  function findHeaderFavBtn(){
    return qs(
      '#tc-header [aria-label*="Favour"],' +
      '#tc-header [aria-label*="Favor"],' +
      '#tc-header .th-favs,' +
      '#tc-header .th-favs-btn,' +
      '#tc-header #tc-favs-btn,' +
      '#tc-header [data-favs],' +
      '#tc-header [data-favs-btn]'
    );
  }
  function findAnyFavBtn(){
    return qs(
      '#tc-favs-btn, .th-favs, .th-favs-btn, .as-favs-btn, [data-favs], [data-favs-btn], button[aria-label*="Favour"], button[aria-label*="Favor"]'
    );
  }

  // ---------- CREATE FAB ----------
  function ensureFab(){
    let fab = document.getElementById('tc-favs-fab');
    if (!fab){
      fab = document.createElement('button');
      fab.id = 'tc-favs-fab';
      fab.type = 'button';
      fab.setAttribute('aria-label','Favourites');
      fab.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 21 C 8 18, 4 14, 4 10 C 4 7, 6 5, 8.5 5 C 10 5, 11.5 5.9, 12 7 C 12.5 5.9, 14 5, 15.5 5 C 18 5, 20 7, 20 10 C 20 14, 16 18, 12 21 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
      document.body.appendChild(fab);
    }
    let badge = fab.querySelector('.tc-badge');
    if (!badge){
      badge = document.createElement('span');
      badge.className = 'tc-badge';
      fab.appendChild(badge);
    }
    return { fab, badge };
  }

  const { fab, badge } = ensureFab();

  // click opens your existing drawer button
  fab.addEventListener('click', function(){
    const btn = findHeaderFavBtn() || findAnyFavBtn();
    if (btn) btn.click();
  });

  // ---------- VISIBILITY (match back-to-top if it exists) ----------
  function syncVisibility(){
    const topBtn = findTopBtn();
    if (topBtn){
      const cs = getComputedStyle(topBtn);
      fab.style.display =
        (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0')
          ? 'flex' : 'none';
    } else {
      fab.style.display = (window.scrollY > 600) ? 'flex' : 'none';
    }
  }

  // ---------- COUNT (ONLY TRUST as:favs + drawer DOM) ----------
  function getLocalCount(){
    try{
      const a = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(a) ? a.length : 0;
    }catch(e){ return 0; }
  }

  function paintCount(){
    // if drawer has rendered, trust it
    const drawerCount = document.querySelectorAll('.th-fav-item').length;
    const n = drawerCount > 0 ? drawerCount : getLocalCount();

    if (n > 0){
      badge.textContent = (n > 99) ? '99+' : String(n);
      badge.style.display = 'flex';
      fab.classList.add('has-count');
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
      fab.classList.remove('has-count');
    }
    fab.setAttribute('aria-label', n > 0 ? `Favourites (${n})` : 'Favourites');
  }

  function refresh(){
    syncVisibility();
    paintCount();
  }

  // boot
  refresh();

  // keep it updated
  window.addEventListener('scroll', syncVisibility, { passive:true });
  window.addEventListener('resize', syncVisibility);
  window.addEventListener('focus', paintCount, { passive:true });
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) paintCount(); }, { passive:true });
  window.addEventListener('storage', (e)=>{ if(e.key === FAV_KEY) paintCount(); });

  // after favourite actions / drawer remove / opening drawer
  document.addEventListener('click', (e)=>{
    if (e.target.closest('.as-fav-btn') || e.target.closest('.th-fav-item-remove') || e.target.closest('#tc-favs-fab')){
      setTimeout(paintCount, 120);
      setTimeout(paintCount, 600);
    }
  }, true);

  // if you have updateFavsPanel, hook it so badge always matches drawer
  const oldUpdate = window.updateFavsPanel;
  if (typeof oldUpdate === 'function'){
    window.updateFavsPanel = function(){
      const out = oldUpdate.apply(this, arguments);
      setTimeout(paintCount, 0);
      return out;
    };
  }
})();

(function(){
  if (window.__metaRowPad) return; window.__metaRowPad = 1;

  function $all(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function lineHeightPx(el){
    var lh = getComputedStyle(el).lineHeight;
    return lh === 'normal' ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 1.2) : parseFloat(lh);
  }

  // returns true if the left part ("Fuel • Gearbox") wraps within the row
  function isWrapped(row){
    if (!row) return false;
    var left = row.querySelector('.as-fg');
    if (!left) return false;

    // width-based check: does left need more width than available (row minus finance)?
    var finance = row.querySelector('.as-finance-inline');
    var avail = row.clientWidth - (finance ? finance.offsetWidth : 0) - 8; // small gap
    var wrapsByWidth = left.scrollWidth > avail;

    // height-based check: row height > one line height
    var wrapsByHeight = row.scrollHeight > (lineHeightPx(row) * 1.35); // small tolerance

    return wrapsByWidth || wrapsByHeight;
  }

  function applyPad(){
    $all('.as-card .as-meta-b').forEach(function(row){
      try{
        if (isWrapped(row)) row.classList.remove('as-meta-b--pad');
        else row.classList.add('as-meta-b--pad');
      }catch(_){}
    });
  }

  // run now, after filters/pagination, and on resize/mutations
  function boot(){ applyPad(); var t=0, iv=setInterval(function(){ applyPad(); if(++t>10) clearInterval(iv); }, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  var ro; try{
    ro = new ResizeObserver(applyPad);
    $all('.as-card .as-meta-b').forEach(function(row){ ro.observe(row); });
    window.addEventListener('resize', applyPad);
  }catch(_){
    window.addEventListener('resize', applyPad);
  }

  document.addEventListener('click', function(e){
    if (e.target && e.target.closest('#asf-apply,[data-as-action="apply"],#asf-clear,[data-as-action="clear"],#as-more,.as-more,.w-pagination-next')){
      setTimeout(function(){ applyPad(); }, 250);
    }
  }, true);

  new MutationObserver(function(){ applyPad(); }).observe(document.body,{childList:true,subtree:true});
})();

(function () {
  if (window.__backToTopOnce) return; window.__backToTopOnce = 1;

  // --- Config you can tweak ---
  var SHOW_AFTER_PX = 600;          // when to appear
  var SIZE = 44;                    // button size in px
  var BRAND = '#3fb1ce';            // your blue

  // --- Styles ---
  var css = ''
  + '.backtop{position:fixed;left:clamp(12px,2vw,20px);'
  + 'bottom:clamp(12px,2vh,20px);z-index:9999;width:'+SIZE+'px;height:'+SIZE+'px;'
  + 'border-radius:999px;background:'+BRAND+';color:#fff;display:grid;place-items:center;'
  + 'box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer;border:none;'
  + 'opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .18s,transform .18s,visibility .18s}'
  + '.backtop.show{opacity:1;visibility:visible;transform:translateY(0)}'
  + '.backtop svg{width:55%;height:55%;pointer-events:none}'
  + '.backtop:focus{outline:2px solid #fff;outline-offset:2px}'
  + '.backtop:hover{filter:brightness(1.05)}'
  + '@media (prefers-reduced-motion:reduce){.backtop{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // --- Button ---
  var btn = document.createElement('button');
  btn.className = 'backtop'; btn.type = 'button'; btn.setAttribute('aria-label','Back to top');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 7-1.4 1.4L13 9.8V20h-2V9.8L6.4 13.4 5 12z" fill="currentColor"/></svg>';
  document.body.appendChild(btn);

  // Click → smooth scroll (respect reduced motion)
  btn.addEventListener('click', function(){
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  // Show/hide on scroll
  function toggle(){
    if (window.scrollY > SHOW_AFTER_PX) { btn.classList.add('show'); }
    else { btn.classList.remove('show'); }
  }
  window.addEventListener('scroll', toggle, { passive: true });
  document.addEventListener('DOMContentLoaded', toggle);
  toggle();
})();

(function(){
  if (window.__tcEditionTip) return; window.__tcEditionTip = 1;

  var tipEl = null;
  var activeTarget = null;

  function ensureTip(){
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'tc-tip';
    tipEl.style.display = 'none';
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function getTipText(card, ed){
    // Prefer Trim (as you were doing), fallback to edition text
    var trimEl = card.querySelector('.as-trim[fs-list-field="trim"]');
    var text = (trimEl && trimEl.textContent && trimEl.textContent.trim())
            || (ed.textContent && ed.textContent.trim())
            || '';
    return text;
  }

  function positionTip(ed){
    if (!tipEl || tipEl.style.display === 'none') return;
    var r = ed.getBoundingClientRect();

    // place under the edition line, slightly offset
    var x = r.left;
    var y = r.bottom + 10;

    // keep inside viewport
    var pad = 10;
    var maxX = window.innerWidth - tipEl.offsetWidth - pad;
    var maxY = window.innerHeight - tipEl.offsetHeight - pad;

    x = Math.max(pad, Math.min(x, maxX));
    y = Math.max(pad, Math.min(y, maxY));

    tipEl.style.left = x + 'px';
    tipEl.style.top  = y + 'px';
  }

  function showTip(ed){
  // ONLY show tooltip if edition is actually clamped
  if (ed.scrollHeight <= ed.clientHeight + 1) return;

  var card = ed.closest('.as-card');
  if (!card) return;

  var text = getTipText(card, ed);
  if (!text) return;

  ensureTip();
  tipEl.textContent = text;
  tipEl.style.display = 'block';
  positionTip(ed);
  activeTarget = ed;
}


  function hideTip(){
    if (!tipEl) return;
    tipEl.style.display = 'none';
    tipEl.textContent = '';
    activeTarget = null;
  }

  // event delegation so it works for dynamically loaded cards too
  document.addEventListener('mouseenter', function(e){
    var ed = e.target && e.target.closest && e.target.closest('.as-edition[fs-list-field="edition"]');
    if (!ed) return;

    // remove native delayed tooltip if anything re-added it
    ed.removeAttribute('title');

    showTip(ed);
  }, true);

  document.addEventListener('mouseleave', function(e){
    var ed = e.target && e.target.closest && e.target.closest('.as-edition[fs-list-field="edition"]');
    if (!ed) return;
    hideTip();
  }, true);

  window.addEventListener('scroll', function(){
    if (activeTarget) positionTip(activeTarget);
  }, { passive:true });

  window.addEventListener('resize', function(){
    if (activeTarget) positionTip(activeTarget);
  });

})();

 (function () {
    if (window.__asMobileApplyClose) return;
    window.__asMobileApplyClose = 1;

    function isMobile() {
      return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    }

    document.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest(
        '#asf-apply, #asf-apply-top, .asf-apply, [data-as-action="apply"]'
      );
      if (!btn) return;

      // Only do this on mobile, and only if the mobile filters are actually open
      if (!isMobile()) return;
      if (!document.body.classList.contains('as-mobile-filters-open')) return;

      const closeBtn = document.querySelector('.asf-mobile-close');
      if (closeBtn) closeBtn.click(); // use existing close logic
    }, { capture: true });
  })();
  
    // Lazy-load vehicle thumbnails
  (function () {
    if (window.__ticaryLazyThumbs) return;
    window.__ticaryLazyThumbs = 1;

    function loadThumb(el) {
      if (!el) return;
      var src = el.getAttribute('data-bg');
      if (!src) return;
      el.style.backgroundImage = "url('" + src.replace(/'/g, "\\'") + "')";
      el.removeAttribute('data-bg');
    }

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          loadThumb(el);
          if (io) io.unobserve(el);
        });
      }, { root: null, rootMargin: '200px 0px', threshold: 0.01 });
    }

    function watchThumb(el) {
      if (!el || !el.hasAttribute('data-bg')) return;
      if (io) {
        io.observe(el);
      } else {
        // no IntersectionObserver support: just load immediately
        loadThumb(el);
      }
    }

    function scanThumbs() {
      var thumbs = document.querySelectorAll('.as-thumb[data-bg]');
      thumbs.forEach(watchThumb);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scanThumbs);
    } else {
      scanThumbs();
    }

    // Also handle new cards being added (see more, favourites view, etc.)
    try {
      var grid = document.querySelector('#as-grid') ||
                 document.querySelector('#vehiclesList') ||
                 document;
      var mo = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          (m.addedNodes || []).forEach(function (node) {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches && node.matches('.as-thumb[data-bg]')) {
              watchThumb(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('.as-thumb[data-bg]').forEach(watchThumb);
            }
          });
        });
      });
      mo.observe(grid, { childList: true, subtree: true });
    } catch (e) {}
  })();

/* =========================================================
   TICARY – Mobile filters slide-in panel (LOCK PAGE SCROLL)
   Full replacement for the tcFilterPanel block
========================================================= */
(function(){
  if (window.__tcFilterPanelV2) return;
  window.__tcFilterPanelV2 = true;

  var panel, panelBody, overlay, contentWrapper;
  var filtersHost = null;

  // --- Scroll lock helpers ---
  var __tcScrollY = 0;
  function lockPageScroll(){
    // store current scroll
    __tcScrollY = window.scrollY || window.pageYOffset || 0;

    // lock body in place
    document.body.style.position = 'fixed';
    document.body.style.top = (-__tcScrollY) + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // optional hook for CSS if needed
    document.body.classList.add('tc-scroll-locked');
  }

  function unlockPageScroll(){
    // unlock
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';

    document.body.classList.remove('tc-scroll-locked');

    // restore scroll position
    window.scrollTo(0, __tcScrollY || 0);
  }

  function ensurePanel(){
    if (panel) return;

    // Backdrop
    overlay = document.createElement('div');
    overlay.className = 'tc-filter-overlay';
    document.body.appendChild(overlay);

    // Full-screen panel
    panel = document.createElement('div');
    panel.className = 'tc-filter-panel';
    panel.innerHTML = ''
      + '<div class="tc-filter-panel-header">'
      +   '<div class="tc-filter-panel-title">Filters</div>'
      +   '<button type="button" class="tc-filter-panel-close" aria-label="Close filters">×</button>'
      + '</div>'
      + '<div class="tc-filter-panel-body" id="tc-filter-panel-body"></div>';
    document.body.appendChild(panel);

    panelBody = panel.querySelector('.tc-filter-panel-body');

    // Inner wrapper that will host the *contents* of as-filters-body
    contentWrapper = document.createElement('div');
    contentWrapper.className = 'tc-filter-content';
    panelBody.appendChild(contentWrapper);

    var closeBtn = panel.querySelector('.tc-filter-panel-close');

    function handleClose(){
      if (window.tcFilterPanel && typeof window.tcFilterPanel.close === 'function') {
        window.tcFilterPanel.close();
      }
    }

    overlay.addEventListener('click', handleClose);
    closeBtn.addEventListener('click', handleClose);
  }

  // Move *children* of as-filters-body into the panel
  function moveFiltersContentsIn(){
    if (!filtersHost) {
      filtersHost = document.getElementById('as-filters-body') ||
                    document.getElementById('as-filters');
    }
    if (!filtersHost || !contentWrapper) return;

    // If we already own the contents, don't re-move them
    if (contentWrapper.__tcOwnsFilters) return;

    while (filtersHost.firstChild) {
      contentWrapper.appendChild(filtersHost.firstChild);
    }
    contentWrapper.__tcOwnsFilters = true;
  }

  // Put the contents back into as-filters-body for desktop/normal view
  function restoreFiltersContents(){
    if (!filtersHost || !contentWrapper || !contentWrapper.__tcOwnsFilters) return;

    while (contentWrapper.firstChild) {
      filtersHost.appendChild(contentWrapper.firstChild);
    }
    contentWrapper.__tcOwnsFilters = false;
  }

  function open(){
    ensurePanel();
    moveFiltersContentsIn();

    // ✅ Lock the page behind
    lockPageScroll();

    document.body.classList.add('tc-filter-panel-open');
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('active');
  }

  function close(){
    restoreFiltersContents();

    document.body.classList.remove('tc-filter-panel-open');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    // ✅ Unlock + restore scroll
    unlockPageScroll();
  }

  window.tcFilterPanel = { open: open, close: close };
})();

/* =========================================================
   TICARY – Mapbox resize synced to filters/map transitions
   Adds tc-map-mask during resize window to hide black flicker
========================================================= */
(function(){
  if (window.__tcMapboxAnimV1) return;
  window.__tcMapboxAnimV1 = true;

  const body = document.body;
  const getMap = () => window.map || window.__asMap || null;

  function safeResize(){
    const m = getMap();
    if (!m || typeof m.resize !== 'function') return;
    try { m.resize(); } catch(e) {}
  }

  function settleResize(){
    requestAnimationFrame(() => {
      safeResize();
      requestAnimationFrame(safeResize);
    });
  }

  function maskOn(){
  // Set mask colour based on YOUR actual theme hook (html[data-theme="light"])
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  body.style.setProperty('--tc-mask-bg', light ? '#ffffff' : '#0b1220');
  body.classList.add('tc-map-mask');
}

  function maskOff(){
  body.classList.remove('tc-map-mask');
}


  function run(){
    const grid    = document.querySelector('.as-grid');
    const mapwrap = document.querySelector('.as-mapwrap');

    maskOn();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      settleResize();
      setTimeout(maskOff, 140);
    };

    const onEnd = (e) => {
      const t = e && e.target;
      if (t !== grid && t !== mapwrap) return;
      const p = String(e.propertyName || '');
      if (p && !/grid-template-columns|max-height|width|height/i.test(p)) return;
      finish();
    };

    const cleanup = () => {
      if (grid){
        grid.removeEventListener('transitionend', onEnd);
        grid.removeEventListener('transitioncancel', onEnd);
      }
      if (mapwrap){
        mapwrap.removeEventListener('transitionend', onEnd);
        mapwrap.removeEventListener('transitioncancel', onEnd);
      }
      clearTimeout(fallback);
      clearTimeout(mid);
    };

    if (grid){
      grid.addEventListener('transitionend', onEnd);
      grid.addEventListener('transitioncancel', onEnd);
    }
    if (mapwrap){
      mapwrap.addEventListener('transitionend', onEnd);
      mapwrap.addEventListener('transitioncancel', onEnd);
    }

    // Midway resize reduces “jump” while mask hides any flicker
    const mid = setTimeout(safeResize, 140);

    // Always finish
    const fallback = setTimeout(finish, 900);
  }

  // Buttons that change map size
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest(
      '#as-filters-toggle-new, #as-map-toggle-new, #as-map-inline-toggle'
    );
    if (!btn) return;
    setTimeout(run, 0);
  }, true);

})();

/* =========================================================
   TICARY – Mapbox smooth OPEN (fix jank on re-open)
   Only resizes when opening, timed to your CSS slide
========================================================= */
(function(){
  if (window.__tcMapOpenResizeV1) return;
  window.__tcMapOpenResizeV1 = true;

  const body = document.body;

  function safeResize(){
    try{
      if (window.map && typeof window.map.resize === 'function') window.map.resize();
    }catch(e){}
  }

  function settleResize(){
    requestAnimationFrame(() => {
      safeResize();
      requestAnimationFrame(safeResize);
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#as-map-toggle-new, #as-map-inline-toggle');
    if (!btn) return;

    // Determine OPENING based on current state BEFORE the click toggles classes
    const opening = body.classList.contains('as-no-map');

    if (!opening) return; // closing already looks good

    // 1) quick nudge right after DOM/class change
    setTimeout(safeResize, 40);

    // 2) final settle right after your 320ms CSS transition
    setTimeout(settleResize, 340);
  }, true);
})();

/* TICARY — SEARCH PAGE: HARD DISABLE OLD MAP AREA (SAFE v2) */
(function(){
  if (window.__tcSearchMapHardOff_v2) return;
  window.__tcSearchMapHardOff_v2 = 1;

  function hardOff(){
    try{
      if (!document.body) return;

      // Force the “map closed” state your layout expects
      document.body.classList.add('as-no-map');

      // Hide/disable any map toggle buttons if they exist
      ['as-map-toggle','as-map-toggle-new','as-map-inline-toggle'].forEach(function(id){
        var b = document.getElementById(id);
        if (!b) return;
        b.style.display = 'none';
        b.setAttribute('aria-hidden','true');
        b.setAttribute('tabindex','-1');
      });

      // Collapse the old map wrapper if present
      var els = document.querySelectorAll('.as-mapwrap, #as-map');
      els.forEach(function(el){
        el.style.display = 'none';
        el.style.height = '0px';
        el.style.minHeight = '0px';
        el.style.maxHeight = '0px';
        el.style.overflow = 'hidden';
        el.style.padding = '0px';
        el.style.margin = '0px';
      });
    }catch(e){
      // swallow errors so we never break the rest of the page
      console.warn('[tc map hardOff] failed', e);
    }
  }

  // Run after Webflow + your other scripts have had a chance to initialize
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(hardOff, 0);
      setTimeout(hardOff, 200);
      setTimeout(hardOff, 800);
    });
  } else {
    setTimeout(hardOff, 0);
    setTimeout(hardOff, 200);
    setTimeout(hardOff, 800);
  }
})();

(function(){
  // Mark thumbs as "wide" if their real aspect ratio is very wide
  const WIDE_RATIO = 1.85; // tweak: 1.75 = more aggressive, 2.0 = only super-wide

  function markThumb(thumb){
    if (!thumb || thumb.classList.contains('tc-wide-checked')) return;
    thumb.classList.add('tc-wide-checked');

    // Case A) <img> based
    const img = thumb.querySelector('img');
    if (img){
      const apply = () => {
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        if (w && h && (w / h) >= WIDE_RATIO) thumb.classList.add('is-wide');
      };
      if (img.complete) apply();
      else img.addEventListener('load', apply, { once:true });
      return;
    }

    // Case B) background-image based (best-effort: load it to measure)
    const bg = getComputedStyle(thumb).backgroundImage || '';
    const m = bg.match(/url\(["']?([^"')]+)["']?\)/i);
    const src = m ? m[1] : '';
    if (!src) return;

    const probe = new Image();
    probe.onload = () => {
      if ((probe.naturalWidth / probe.naturalHeight) >= WIDE_RATIO) thumb.classList.add('is-wide');
    };
    probe.src = src;
  }

  function scan(){
    document.querySelectorAll('.as-thumb').forEach(markThumb);
  }

  // initial + keep up with re-renders (your list re-paints)
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList:true, subtree:true });
})();


/* =========================================================
   TICARY — Page Body Custom Code (migrated to bundle.js)
   - Origin placeholder typing
   - Embed mode (map/list) iframe sizing
   - Loader overlay
   - Cross-tab favourites sync ping
   - Header AI btn hover propagation fix
========================================================= */

/* --- asf-origin placeholder: style + typing --- */
(function(){
  if (window.__tcAsfOriginPlaceholder_v1) return;
  window.__tcAsfOriginPlaceholder_v1 = 1;

  // run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else { init(); }

  function init(){
    var input = document.getElementById('asf-origin');
    if(!input) return;

    // 1) Lighten placeholder (near-white). Only inject once.
    if(!document.getElementById('asf-origin-ph-style')){
      var st = document.createElement('style');
      st.id = 'asf-origin-ph-style';
      st.textContent =
        '#asf-origin::placeholder{color:var(--as-dim,rgba(255,255,255,.78));opacity:1}' +
        '#asf-origin:-ms-input-placeholder{color:var(--as-dim,rgba(255,255,255,.78))}' +
        '#asf-origin::-ms-input-placeholder{color:var(--as-dim,rgba(255,255,255,.78))}';
      document.head.appendChild(st);
    }

    // 2) Placeholder typing effect
    var phrases = (input.getAttribute('data-phrases') || 'e.g. SW1A 1AA|e.g. Bristol|e.g. M1 2AB|e.g. Cardiff')
      .split('|').map(function(s){return s.trim();}).filter(Boolean);
    if(!phrases.length) return;

    var i=0, j=0, dir=1, t;
    var TYPE=90, ERASE=40, HOLD_FULL=1200, HOLD_GAP=600, START=800;

    function tick(){
      // pause if user interacting or value present
      if(document.activeElement===input || input.value){
        input.placeholder='';
        return;
      }
      var target = phrases[i];
      j += dir;
      input.placeholder = target.slice(0, j);

      if(j===target.length){ dir=-1; t=setTimeout(tick, HOLD_FULL); return; }
      if(j===0){ dir=1; i=(i+1)%phrases.length; t=setTimeout(tick, HOLD_GAP); return; }
      t=setTimeout(tick, dir>0 ? TYPE : ERASE);
    }

    setTimeout(tick, START);

    input.addEventListener('input', function(){ input.placeholder=''; });
    input.addEventListener('focus', function(){ input.placeholder=''; });
    input.addEventListener('blur', function(){
      if(input.value) { input.placeholder=''; return; }
      clearTimeout(t); j=0; dir=1; setTimeout(tick, 400);
    });
  }
})();

/* --- Embed mode: map/list + height postMessage --- */
(function(){
  if (window.__asEmbedV2) return; window.__asEmbedV2 = true;

  const p = new URLSearchParams(location.search);
  const mode = (p.get('mode')||'').toLowerCase(); // 'map' | 'list'
  if (!mode) return;

  const Q = (p.get('q')||'').trim();

  const IS_MOBILE = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  const baseH = Math.max(1, parseInt(p.get('h')||'0', 10)) || 360;
  const H = IS_MOBILE ? (window.innerHeight || baseH) : baseH;

  const PAD = 0;

  const $ = (s,r=document)=>r.querySelector(s);
  const $$= (s,r=document)=>Array.from(r.querySelectorAll(s));
  function hide(sel){ $$(sel).forEach(el=>{ el.style.setProperty('display','none','important'); }); }
  function zero(sel){ $$(sel).forEach(el=>{ el.style.margin='0'; el.style.padding='0'; }); }

  const mapEl    = $('#as-map,[data-map],.as-map');
  const mapWrap  = (mapEl && (mapEl.closest('.section,.w-container,.container,[class*="container"],[class*="section"]') || mapEl)) || null;
  const filtersUI= $('#as-filters,[data-filters],.as-filters,#as-filters-body');
  const listWrap = $('#as-list,[data-list],.as-list');

  hide('header, .th-wrap, [data-global-header], footer, .tf-wrap, [data-global-footer]');
  hide('.asq-wrap, .searchbar, [data-searchbar]');
  zero('body, html, main, .page-wrap, .section, .container, .w-container');
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.background = 'transparent';

  if (mode === 'map') {
    document.body.classList.add('as-embed-map');
    if (filtersUI) filtersUI.style.setProperty('display','none','important');
    if (listWrap)  listWrap.style.setProperty('display','none','important');

    const target = mapWrap || mapEl;
    if (target) {
      target.style.margin = '0';
      target.style.padding = '0';
      target.style.minHeight = H + 'px';
      target.style.maxHeight = H + 'px';
      target.style.height    = H + 'px';
    }
    if (mapEl) {
      mapEl.style.minHeight = H + 'px';
      mapEl.style.maxHeight = H + 'px';
      mapEl.style.height    = H + 'px';
    }
  } else if (mode === 'list') {
    if (filtersUI) filtersUI.style.setProperty('display','none','important');
    if (mapWrap)   mapWrap.style.setProperty('display','none','important');
    if (listWrap)  { listWrap.style.margin='0'; listWrap.style.padding='0'; }
  }

  function applyQueryNow(){
    try{
      const input = document.querySelector('#asq');
      const btn   = document.querySelector('#asq-apply');
      if (input && btn && Q) { input.value = Q; btn.click(); }
      else {
        const makeSel = document.querySelector('[data-filter="make"] select, select[id*="make" i]');
        if (makeSel && Q) {
          const mk = Q.toLowerCase().split(/\s+/)[0];
          for (const opt of makeSel.options) {
            if ((opt.textContent||'').toLowerCase().includes(mk)) {
              makeSel.value = opt.value;
              makeSel.dispatchEvent(new Event('change',{bubbles:true}));
              break;
            }
          }
          const applyBtn = document.querySelector('#asf-apply,[data-filter-apply]');
          applyBtn && applyBtn.click();
        }
      }
    }catch(e){}
  }
  requestAnimationFrame(()=> setTimeout(applyQueryNow, 350));

  function currentHeight(){
    const el = mapWrap || mapEl || document.documentElement;
    const h = (el && (el.getBoundingClientRect().height || el.offsetHeight)) || H;
    return Math.max(H, Math.round(h) + PAD);
  }
  function sendHeight(){ parent.postMessage({ type:'as-embed-height', height: currentHeight() }, '*'); }
  ['load','resize'].forEach(ev=> addEventListener(ev, ()=> setTimeout(sendHeight, 60)));
  const mo = new MutationObserver(()=> setTimeout(sendHeight, 40));
  mo.observe(document.documentElement, {childList:true,subtree:true,attributes:true});
  setTimeout(sendHeight, 400);
})();

/* --- Loader overlay --- */
(function () {
  if (window.__ticaryLoaderBooted) return;
  window.__ticaryLoaderBooted = 1;

  function createLoader() {
    if (document.getElementById('ticary-loader')) return;
    var wrap = document.createElement('div');
    wrap.id = 'ticary-loader';
    wrap.className = 'ticary-loader';
    wrap.innerHTML =
      '<div class="ticary-loader__inner">' +
        '<div class="ticary-loader__logo">T<span>ICARY</span></div>' +
        '<div class="ticary-loader__spinner"></div>' +
        '<div class="ticary-loader__text">Loading cars…</div>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  function hideLoader() {
    var wrap = document.getElementById('ticary-loader');
    if (!wrap) return;
    if (wrap.classList.contains('ticary-loader--hide')) return;
    wrap.classList.add('ticary-loader--hide');
    setTimeout(function () {
      if (wrap && wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
    }, 450);
  }

  function isReady() {
    try {
      var hasCars = window.__ticaryCars && window.__ticaryCars.length;
      var hasCard = document.querySelector('.as-card');
      return !!(hasCars && hasCard);
    } catch (e) {
      return false;
    }
  }

  function boot() {
    createLoader();

    var tries = 0;
    var maxTries = 60; // ~9s at 150ms steps
    var iv = setInterval(function () {
      tries++;
      if (isReady() || tries > maxTries) {
        clearInterval(iv);
        hideLoader();
      }
    }, 150);

    setTimeout(hideLoader, 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.ticaryHideLoader = hideLoader;
})();

/* --- Cross-tab favourites sync ping --- */
(function(){
  if (window.__tcFavBroadcastV1) return;
  window.__tcFavBroadcastV1 = 1;

  const CH = ("BroadcastChannel" in window) ? new BroadcastChannel("tc:favs") : null;

  function reconcileSoon(){
    if (typeof window.tcReconcileFavs === "function") {
      setTimeout(() => { try { window.tcReconcileFavs(); } catch(e){} }, 80);
    }
  }

  if (CH){
    CH.onmessage = (ev) => {
      if (ev?.data?.type === "favs_changed") reconcileSoon();
    };
  }

  document.addEventListener("click", (e) => {
    const isHeart = e.target?.closest?.(".as-fav-btn");
    const isSlideRemove = e.target?.closest?.(".th-fav-item-remove");
    if (!isHeart && !isSlideRemove) return;

    setTimeout(() => {
      try{
        CH && CH.postMessage({ type: "favs_changed", at: Date.now() });
      }catch(e){}
    }, 350);
  }, true);

})();

/* --- Header AI button hover propagation fix --- */
(function(){
  if (window.__tcAiBtnHoverFix_v1) return;
  window.__tcAiBtnHoverFix_v1 = 1;

  const aiBtn = document.querySelector('#tc-header a.tc-ai-btn');
  if(!aiBtn) return;

  aiBtn.addEventListener('mouseenter', e => { e.stopImmediatePropagation(); }, true);
  aiBtn.addEventListener('mouseover',  e => { e.stopImmediatePropagation(); }, true);
})();
