(function(){
  // =========================
  // CONFIG
  // =========================
  var SNAPSHOT = 'https://raw.githubusercontent.com/hrwrd15-svg/vehicle_snapshot/main/cars.json?_=' + Date.now();
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

  async function loadCars(){
    // 1) snapshot
    try{
      var snapTxt = await fetchText(SNAPSHOT);
      var snapCars = parseJSON(snapTxt);
      if (snapCars && snapCars.length){
        // if snapshot looks like it lacks coords, fall through to live API
        var ok = hasCoords(snapCars[0]);
        if (ok){
          log('using snapshot', snapCars.length);
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

