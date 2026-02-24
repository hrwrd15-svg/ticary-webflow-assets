console.log("✅ popup.js loaded (GitHub)");
/* =========================================================
   TICARY — Popup Module (bundle-safe, token-safe)
   - waits for DOM + avoids hardcoded Mapbox token
   - idempotent: runs once
========================================================= */
(function(){
  if (window.__tcdm_v7_bundle) return;
  window.__tcdm_v7_bundle = 1;

  const $ = (s, r=document) => r.querySelector(s);

  // Wait for modal DOM to exist (bundle can execute before Webflow embeds render)
  function whenReady(cb, tries=0){
    const overlay = $('#tcdm-overlay');
    const modal   = $('#tcdm');
    const scrollWrap = $('#tcdm-scroll');

    if (overlay && modal && scrollWrap) return cb({ overlay, modal, scrollWrap });
    if (tries >= 200) return; // ~10s max
    setTimeout(() => whenReady(cb, tries+1), 50);
  }

  whenReady(({ overlay, modal, scrollWrap }) => {
    // prevent double-init if Webflow embed still has old script
    if (window.__tcdm_v7) return;
    window.__tcdm_v7 = 1;

    const mapToggle   = $('#tcdm-mapToggle');
    const mapSection  = $('#tcdm-mapSection');
    const mapCanvas   = $('#tcdm-mapCanvas');
    const mapCloseBtn = $('#tcdm-mapClose');

    // IMPORTANT: no hardcoded token (GitHub secret scan)
    const MAPBOX_TOKEN = String(window.__ticaryMapboxToken || '').trim();

    let __tcdmMap = null;
    let __tcdmMarkers = [];
    let __tcdmPrevScroll = 0;
    let __tcdmCurrent = null;

    const clean = v => (v ?? '').toString().replace(/\s+/g,' ').trim();
    const isEmpty = v => {
      if (v === null || v === undefined) return true;
      const s = clean(v);
      return !s || s.toLowerCase()==='null' || s.toLowerCase()==='nan' || s==='—';
    };
    const num = v => {
      const n = Number(String(v ?? '').replace(/[^\d.]/g,''));
      return Number.isFinite(n) ? n : null;
    };
    const moneyGBP = v => {
      const n = num(v);
      if (!n || n <= 0) return 'POA';
      return '£' + Math.round(n).toLocaleString('en-GB');
    };
    const miles = v => {
      const n = num(v);
      if (!n || n <= 0) return null;
      return Math.round(n).toLocaleString('en-GB') + ' miles';
    };
    const isFiniteNum = n => (typeof n === 'number' && isFinite(n));

    function haversineMiles(aLat,aLng,bLat,bLng){
      const R = 3958.7613;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const s1 = Math.sin(dLat/2);
      const s2 = Math.sin(dLng/2);
      const aa = s1*s1 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*s2*s2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(aa)));
    }

    // --- Geocode cache ---
    let __tcdmGeoCache = {};
    try{ __tcdmGeoCache = JSON.parse(localStorage.getItem('tcdm:geoCache') || '{}') || {}; }catch(e){ __tcdmGeoCache = {}; }
    function __tcdmSaveGeoCache(){ try{ localStorage.setItem('tcdm:geoCache', JSON.stringify(__tcdmGeoCache)); }catch(e){} }

    async function __tcdmGeocodeGB(query){
      const q = clean(query || '');
      if (!q) return null;
      if (__tcdmGeoCache[q]) return __tcdmGeoCache[q];

      if (!MAPBOX_TOKEN) return null; // token not available -> skip geocode

      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
        `?country=GB&limit=1&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;

      try{
        const r = await fetch(url);
        if (!r.ok) return null;
        const j = await r.json();
        const c = j?.features?.[0]?.center;
        if (Array.isArray(c) && c.length === 2){
          const out = { lng: c[0], lat: c[1] };
          __tcdmGeoCache[q] = out;
          __tcdmSaveGeoCache();
          return out;
        }
      }catch(e){}
      return null;
    }

    function destroyTcdmMap(){
      try{ __tcdmMarkers.forEach(m => m.remove()); }catch(_){}
      __tcdmMarkers = [];
      try{ if (__tcdmMap) __tcdmMap.remove(); }catch(_){}
      __tcdmMap = null;
    }

    function ensureTcdmMap(){
      if (__tcdmMap || !mapCanvas) return;
      if (!window.mapboxgl) return;

      // No token? don't init map. (Prevents runtime errors + avoids GitHub secret scanning.)
      if (!MAPBOX_TOKEN){
        console.warn('[tcdm] Mapbox token missing: set window.__ticaryMapboxToken in Webflow <head>.');
        return;
      }

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const theme = (document.documentElement.getAttribute('data-theme') || '').toLowerCase();
      const style = theme === 'light'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/navigation-night-v1';

      const center = (isFiniteNum(__tcdmCurrent?.lat) && isFiniteNum(__tcdmCurrent?.lng))
        ? [__tcdmCurrent.lng, __tcdmCurrent.lat]
        : [-1.8, 53.7];

      __tcdmMap = new mapboxgl.Map({
        container: mapCanvas,
        style,
        center,
        zoom: (center[0] === -1.8 && center[1] === 53.7) ? 5.5 : 10,
        renderWorldCopies:false
      });

      __tcdmMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    function addMarker(lng, lat, opts){
      if (!__tcdmMap) return null;
      const el = document.createElement('div');
      el.className = 'tcdm-mapMarker' + (opts?.current ? ' is-current' : '');
      if (opts?.current) el.style.zIndex = '9999';

      const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]);
      if (opts?.popupHtml){
        marker.setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(opts.popupHtml));
      }
      marker.addTo(__tcdmMap);
      __tcdmMarkers.push(marker);
      return marker;
    }

    function pick(d, keys){
      for (const k of keys){
        const v = d?.[k];
        if (!isEmpty(v)) return v;
      }
      return null;
    }

    function populateMarkers(){
      if (!__tcdmMap || !__tcdmCurrent) return;

      const curLat = __tcdmCurrent.lat;
      const curLng = __tcdmCurrent.lng;
      if (!isFiniteNum(curLat) || !isFiniteNum(curLng)) return;

      try{ __tcdmMarkers.forEach(m => m.remove()); }catch(_){}
      __tcdmMarkers = [];

      const curTitle = clean([pick(__tcdmCurrent,['make']), pick(__tcdmCurrent,['model'])].filter(Boolean).join(' ')) || 'This vehicle';
      const curPrice = moneyGBP(pick(__tcdmCurrent,['price_gbp','price']));
      addMarker(curLng, curLat, {
        current:true,
        popupHtml: `
          <div style="font-weight:900;margin-bottom:4px;">${curTitle}</div>
          <div style="font-weight:850;color:#3fb1ce;">${curPrice || ''}</div>
        `
      });

      try{ __tcdmMap.jumpTo({ center:[curLng, curLat], zoom: 12.75 }); }catch(_){}

      (function callRadiusAddon(tries){
        tries = typeof tries === 'number' ? tries : 0;
        if (typeof window.__tcdmAttachRadius === 'function'){
          window.__tcdmAttachRadius({
            map: __tcdmMap,
            current: __tcdmCurrent,
            addMarker,
            haversineMiles,
            pick, clean, isEmpty, isFiniteNum, moneyGBP
          });
          return;
        }
        if (tries >= 20) return;
        setTimeout(() => callRadiusAddon(tries + 1), 100);
      })();
    }

    async function openMapSection(){
      modal.classList.add('is-map-open');
      if (!mapSection) return;

      __tcdmPrevScroll = scrollWrap.scrollTop || 0;

      mapSection.classList.add('is-open');
      mapSection.setAttribute('aria-hidden','false');

      (function(){
        if (!__tcdmCurrent) return;
        const toF = (v) => {
          const n = parseFloat(String(v ?? '').trim());
          return Number.isFinite(n) ? n : null;
        };
        const latVal = pick(__tcdmCurrent, ['lat','latitude','dealer_lat','dealer_latitude','location_lat','location_latitude','vehicle_lat','vehicle_latitude']);
        const lngVal = pick(__tcdmCurrent, ['lng','lon','long','longitude','dealer_lng','dealer_lon','dealer_longitude','location_lng','location_lon','location_longitude','vehicle_lng','vehicle_lon','vehicle_longitude']);
        const lat = toF(latVal), lng = toF(lngVal);
        if (lat !== null && lng !== null){ __tcdmCurrent.lat = lat; __tcdmCurrent.lng = lng; }
      })();

      if (__tcdmCurrent && (!isFiniteNum(__tcdmCurrent.lat) || !isFiniteNum(__tcdmCurrent.lng))){
        const postcode = clean(pick(__tcdmCurrent, ['postal_code','postcode'])) || '';
        const addr = [pick(__tcdmCurrent,['street']), pick(__tcdmCurrent,['city']), pick(__tcdmCurrent,['county']), postcode]
          .map(clean).filter(Boolean).join(', ');
        const geo = await __tcdmGeocodeGB(postcode || addr);
        if (geo){ __tcdmCurrent.lat = geo.lat; __tcdmCurrent.lng = geo.lng; }
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          destroyTcdmMap();
          ensureTcdmMap();

          // If token missing, ensureTcdmMap will refuse -> still scroll to section gracefully.
          try{ __tcdmMap && __tcdmMap.resize(); }catch(_){}

          if (__tcdmMap) populateMarkers();

          try{
            const top = mapSection.offsetTop;
            scrollWrap.scrollTo({ top, behavior: 'smooth' });
          }catch(_){}
        });
      });
    }

    function closeMapSection(){
      modal.classList.remove('is-map-open');
      if (!mapSection) return;
      mapSection.classList.remove('is-open');
      mapSection.setAttribute('aria-hidden','true');
      destroyTcdmMap();
      scrollWrap.scrollTo({ top: __tcdmPrevScroll, behavior:'smooth' });
    }

    mapToggle?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!__tcdmCurrent) return;
      if (mapSection.classList.contains('is-open')) closeMapSection();
      else openMapSection();
    }, true);

    mapCloseBtn?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      closeMapSection();
    }, true);

    function setText(id, v){
      const el = document.getElementById(id);
      if (el) el.textContent = clean(v);
    }

    function setDealerContact(phone, email){
      const el = document.getElementById('tcdm-dealerContact');
      if (!el) return;
      el.innerHTML = '';

      const add = (svg, text) => {
        const wrap = document.createElement('span');
        wrap.className = 'tcdm-contactItem';
        wrap.innerHTML = svg;
        const t = document.createElement('span');
        t.textContent = String(text || '').trim();
        wrap.appendChild(t);
        el.appendChild(wrap);
      };

      const p = (phone || '').toString().trim();
      const m = (email || '').toString().trim();

      if (p) add(
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5.06 2h3a2 2 0 0 1 2 1.72 12.66 12.66 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9 10a16 16 0 0 0 5 5l1.36-1.31a2 2 0 0 1 2.11-.45 12.66 12.66 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>`,
        p
      );

      if (m) add(
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4h16v16H4z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>`,
        m
      );

      el.classList.toggle('tcdm-hide', (!p && !m));
    }

    function setRow(rowId, valueId, v, fmtFn){
      const row = document.getElementById(rowId);
      const val = fmtFn ? fmtFn(v) : v;
      const empty = isEmpty(val);
      if (row) row.classList.toggle('tcdm-hide', empty);
      if (!empty) setText(valueId, val);
    }

    function lockScroll(on){
      const root = document.documentElement;
      if (on){ root.style.overflow='hidden'; document.body.style.overflow='hidden'; }
      else { root.style.overflow=''; document.body.style.overflow=''; }
    }

    function open(){
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden','false');
      lockScroll(true);
    }
    function close(){
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden','true');
      lockScroll(false);
      try{ closeMapSection(); }catch(_){}
      closeFullscreen();
    }

    $('#tcdm-close')?.addEventListener('click', close, true);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); }, true);
    document.addEventListener('keydown', e => {
      if (!overlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }, true);

    // Tabs
    const tabBtns = Array.from(document.querySelectorAll('.tcdm-tab'));
    const panes   = Array.from(document.querySelectorAll('.tcdm-pane'));
    tabBtns.forEach(b => b.addEventListener('click', () => {
      tabBtns.forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      const name = b.getAttribute('data-tab');
      panes.forEach(p => p.classList.toggle('is-on', p.getAttribute('data-pane') === name));
    }));

    // Data from window.__ticaryItems
    function getItemDataForCard(card){
      const id = clean(card?.dataset?.vehicleId || card?.getAttribute('data-vehicle-id'));
      if (!id) return null;
      const items = Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
      let entry = items.find(x => String(x?.data?.id ?? '') === String(id));
      if (entry?.data) return entry.data;
      const raw = items.find(x => String(x?.id ?? '') === String(id));
      return raw || null;
    }

    // Images
    const imgEl   = $('#tcdm-img');
    const thumbs  = $('#tcdm-thumbs');
    const prevBtn = $('#tcdm-prev');
    const nextBtn = $('#tcdm-next');
    const countEl = $('#tcdm-count');

    let imgs = [];
    let idx = 0;

    function decodeNextImage(url){
      const u = clean(url);
      if (!u) return '';
      try{
        if (u.includes('/_next/image') && u.includes('url=')){
          const parsed = new URL(u, window.location.href);
          const inner = parsed.searchParams.get('url');
          if (inner) return decodeURIComponent(inner);
        }
      }catch(_){}
      return u;
    }
    const normUrl = u => clean(decodeNextImage(u));

    function dedupe(list){
      const out = [], seen = new Set();
      for (const raw of list){
        const u = normUrl(raw);
        if (!u) continue;
        if (seen.has(u)) continue;
        seen.add(u);
        out.push(u);
      }
      return out;
    }

    function setCount(){
      if (countEl) countEl.textContent = `${imgs.length ? (idx+1) : 0} / ${imgs.length || 0}`;
    }

    function renderThumbs(){
      if (!thumbs) return;
      thumbs.innerHTML = '';
      imgs.forEach((u, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tcdm-thumb' + (i===idx ? ' is-on' : '');
        b.innerHTML = `<img alt="" loading="lazy" src="${u}">`;
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAt(i); }, true);
        thumbs.appendChild(b);
      });
    }

    function isFullscreenOpen(){ return !!(fso && fso.classList.contains('is-open')); }

    function showAt(i){
      if (!imgs.length){
        if (imgEl) imgEl.src = '';
        setCount();
        return;
      }
      idx = Math.max(0, Math.min(imgs.length-1, i));
      if (imgEl) imgEl.src = imgs[idx];
      setCount();

      if (thumbs){
        const ts = Array.from(thumbs.querySelectorAll('.tcdm-thumb'));
        ts.forEach((t,j) => t.classList.toggle('is-on', j===idx));
        const active = ts[idx];
        if (active) active.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
      }

      if (isFullscreenOpen()) $('#tcdm-fsoImg').src = imgs[idx] || '';
    }

    prevBtn?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAt(idx-1); }, true);
    nextBtn?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAt(idx+1); }, true);

    function buildImmediateImages(d){
      const out = [];

      const cover = clean(pick(d, ['image_cover_url','thumb','primary_image','image','cover','image_url']) || '');
      if (cover) out.push(cover);

      function pushMany(v){
        if (!v) return;

        if (Array.isArray(v)){
          v.map(normUrl).filter(Boolean).forEach(u => out.push(u));
          return;
        }

        if (typeof v === 'object'){
          const maybe = v.images || v.urls || v.photo_links || v.photos;
          if (Array.isArray(maybe)){
            maybe.map(normUrl).filter(Boolean).forEach(u => out.push(u));
          }
          return;
        }

        const s = clean(v);
        if (!s) return;

        if (s.startsWith('[') && s.endsWith(']')){
          try{
            const arr = JSON.parse(s);
            if (Array.isArray(arr)){
              arr.map(normUrl).filter(Boolean).forEach(u => out.push(u));
              return;
            }
          }catch(_){}
        }

        s.split(/\s*(?:\r?\n|,|\||;)\s*/g)
          .map(normUrl)
          .filter(Boolean)
          .forEach(u => out.push(u));
      }

      pushMany(d?.images);
      pushMany(d?.image_urls);
      pushMany(d?.photo_links);
      pushMany(d?.photos);
      pushMany(d?.vehicle_images);
      pushMany(d?.vehicle_image_urls);

      return dedupe(out);
    }

    async function fetchJson(url){
      try{
        const r = await fetch(url, { credentials: 'omit' });
        if (!r.ok) return null;
        return await r.json();
      }catch(_){ return null; }
    }

    async function hydrateImages(vehicleId, immediate){
      const vid = Number(String(vehicleId || '').trim());
      const base = Array.isArray(immediate) ? immediate : [];
      if (!Number.isFinite(vid) || vid <= 0){
        imgs = dedupe(base); idx = 0; renderThumbs(); showAt(0);
        return;
      }

      const j1 = await fetchJson(`https://vehicle-api-espm.onrender.com/cars/${vid}/images`);
      const a1 = Array.isArray(j1?.images) ? j1.images.map(normUrl).filter(Boolean) : [];

      const j2 = await fetchJson(`https://vehicle-api-espm.onrender.com/vehicle-images?vehicle_id=${vid}`);
      const a2 = Array.isArray(j2?.images) ? j2.images.map(normUrl).filter(Boolean) : [];

      const merged = dedupe([...base, ...a1, ...a2]);
      const current = imgs[idx] || '';
      imgs = merged;
      idx = Math.max(0, imgs.indexOf(current));
      if (idx < 0) idx = 0;
      renderThumbs(); showAt(idx);
    }

    // Fullscreen
    const fso      = $('#tcdm-fso');
    const fsoImg   = $('#tcdm-fsoImg');
    const fsoClose = $('#tcdm-fsoClose');
    const fsoPrev  = $('#tcdm-fsoPrev');
    const fsoNext  = $('#tcdm-fsoNext');
    const fsBtn    = $('#tcdm-fsBtn');

    function openFullscreen(){
      if (!fso || !fsoImg || !imgs.length) return;
      fso.classList.add('is-open');
      fso.setAttribute('aria-hidden','false');
      fsoImg.src = imgs[idx] || '';
    }
    function closeFullscreen(){
      if (!fso) return;
      fso.classList.remove('is-open');
      fso.setAttribute('aria-hidden','true');
      if (fsoImg) fsoImg.src = '';
    }

    fsBtn?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openFullscreen(); }, true);
    imgEl?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openFullscreen(); }, true);

    fsoClose?.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      closeFullscreen();
    }, true);

    fso?.addEventListener('click', e => { if (e.target === fso) closeFullscreen(); }, true);
    fsoPrev?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAt(idx-1); }, true);
    fsoNext?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAt(idx+1); }, true);

    document.addEventListener('keydown', e => {
      if (!isFullscreenOpen()) return;
      if (e.key === 'Escape'){ e.preventDefault(); closeFullscreen(); }
      if (e.key === 'ArrowLeft'){ e.preventDefault(); showAt(idx-1); }
      if (e.key === 'ArrowRight'){ e.preventDefault(); showAt(idx+1); }
    }, true);

    // Favourites (mirror card toggle)
    const favBtn = $('#tcdm-fav');
    function findFavToggle(card){
      return card.querySelector('.as-fav, .as-fav-btn, [data-fav], [data-favourite], button[aria-label*="favour"], button[aria-label*="Favor"]');
    }
    function isFavActive(btn){
      if (!btn) return false;
      const aria = (btn.getAttribute('aria-pressed') || '').toLowerCase();
      if (aria === 'true') return true;
      const d = (btn.getAttribute('data-active') || btn.getAttribute('data-selected') || '').toLowerCase();
      if (d === 'true' || d === '1' || d === 'yes') return true;
      return /active|selected|is-active|is-fav|faved|saved/i.test(btn.className || '');
    }
    function syncFav(card){
      const fb = findFavToggle(card);
      favBtn?.classList.toggle('is-fav', isFavActive(fb));
      if (favBtn){
        favBtn.onclick = () => {
          const f = findFavToggle(card);
          if (f) f.click();
          setTimeout(() => syncFav(card), 80);
          setTimeout(() => syncFav(card), 280);
        };
      }
    }

    const aListing = $('#tcdm-openListing');

    function populate(card){
      const d = getItemDataForCard(card);
      if (!d) return;

      __tcdmCurrent = d;

      const make  = pick(d, ['make']) || '';
      const model = pick(d, ['model']) || '';
      setText('tcdm-title', [make, model].filter(Boolean).join(' ') || 'Vehicle');
      setText('tcdm-sub', pick(d, ['variant','edition','trim']) || '');

      setText('tcdm-price', moneyGBP(pick(d, ['price_gbp','price'])));

      const yr = pick(d, ['year']);
      setText('tcdm-reg', `Year: ${clean(yr || '—')}`);

      const milRaw = pick(d, ['mileage_mi','mileage']);
      const milTxt = milRaw ? miles(milRaw) : '—';
      setText('tcdm-euro', `Mileage: ${milTxt}`);

      const b1  = pick(d, ['fuel_type','fuel']);
      const b2  = pick(d, ['transmission','gearbox']);
      const eng = pick(d, ['engine_size_l','engine']);
      const pps = pick(d, ['power_ps','power']);
      const b3  = num(eng) ? `${num(eng).toFixed(1)}L` : (eng || null);
      const b4  = num(pps) ? `${num(pps)} PS` : (pps || null);

      [['tcdm-b1', b1], ['tcdm-b2', b2], ['tcdm-b3', b3], ['tcdm-b4', b4]].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('tcdm-hide', isEmpty(val));
        if (!isEmpty(val)) el.textContent = clean(val);
      });

      const dealerName = clean(pick(d, ['dealer_name','dealer']) || '—');

      const street   = clean(pick(d,['street']) || '');
      const city     = clean(pick(d,['city']) || '');
      const county   = clean(pick(d,['county']) || '');
      const postcode = clean(pick(d,['postal_code','postcode']) || '');

      const fullAddr = [street, city, county, postcode].filter(Boolean).join(', ');
      const addr = fullAddr;

      const dealerAddrEl = document.getElementById('tcdm-dealerAddr');
      if (dealerAddrEl) dealerAddrEl.classList.add('tcdm-hide');

      const dealerNameEl = $('#tcdm-dealerName');
      if (dealerNameEl){
        if (fullAddr){
          dealerNameEl.innerHTML = `
            <span style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
              <span style="font-weight:850;">${dealerName}</span>
              <span style="display:inline-flex;align-items:center;gap:6px;font-weight:650;color:var(--tc-dim);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                ${fullAddr}
              </span>
            </span>
          `;
        } else {
          dealerNameEl.textContent = dealerName;
        }
      }

      const phone = pick(d, ['seller_phone','phone']);
      const email = pick(d, ['seller_email','email']);
      setDealerContact(phone, email);

      setRow('row-year','tcdm-year', pick(d,['year']));
      setRow('row-mileage','tcdm-mileage', pick(d,['mileage_mi','mileage']), miles);
      setRow('row-fuel','tcdm-fuel', pick(d,['fuel_type','fuel']));
      setRow('row-trans','tcdm-trans', pick(d,['transmission','gearbox']));
      setRow('row-body','tcdm-body', pick(d,['body_type','bodytype']));
      setRow('row-colour','tcdm-colour', pick(d,['color','colour']));
      setRow('row-phone','tcdm-phone', pick(d,['seller_phone','phone']));
      setRow('row-email','tcdm-email', pick(d,['seller_email','email']));
      setRow('row-address','tcdm-address', addr || null);

      setRow('row-engine','tcdm-engine', pick(d,['engine_size_l','engine']), v => num(v) ? `${num(v).toFixed(1)}L` : v);
      setRow('row-power','tcdm-power', pick(d,['power_ps','power']), v => num(v) ? `${num(v)} PS` : v);
      setRow('row-drive','tcdm-drive', pick(d,['drivetrain']));
      setRow('row-doors','tcdm-doors', pick(d,['doors']));
      setRow('row-owners','tcdm-owners', pick(d,['num_owners','owners']));
      setRow('row-mpg','tcdm-mpg', pick(d,['efficiency_combined_mpg','combined_mpg']), v => num(v) ? `${num(v).toFixed(1)} mpg` : v);
      setRow('row-top','tcdm-top', pick(d,['performance_maxspeed_mph','maxspeed_mph']), v => num(v) ? `${num(v)} mph` : v);
      setRow('row-060','tcdm-060', pick(d,['performance_acceleration_zero_to_60_mph','zero_to_60_mph']), v => num(v) ? `${num(v).toFixed(1)}s` : v);

      const listEl = $('#tcdm-featList');
      if (listEl){
        listEl.innerHTML = '';
        let feats = pick(d, ['features','options']);
        if (Array.isArray(feats)) feats = feats.map(clean).filter(Boolean);
        else if (typeof feats === 'string') feats = feats.split(/\n|•|,|;/).map(clean).filter(Boolean);
        else feats = [];
        if (!feats.length){
          const li = document.createElement('li'); li.textContent = 'No features listed'; listEl.appendChild(li);
        } else {
          feats.slice(0, 220).forEach(f => { const li = document.createElement('li'); li.textContent = f; listEl.appendChild(li); });
        }
      }

      const cEl = $('#tcdm-comments');
      if (cEl){
        const comments = clean(pick(d, ['seller_comments','seller_comment','description']) || '');
        cEl.textContent = comments || 'No seller comments';
      }

      const listingUrl = clean(pick(d, ['listing_url','url']) || '');
      if (aListing){
        if (listingUrl){ aListing.href = listingUrl; aListing.style.opacity=''; aListing.style.pointerEvents=''; }
        else { aListing.href='#'; aListing.style.opacity='.5'; aListing.style.pointerEvents='none'; }
      }

      const immediate = buildImmediateImages(d);
      imgs = immediate.length ? immediate : [];
      idx = 0;
      renderThumbs(); showAt(0);

      const vid = pick(d,['id']) || clean(card?.dataset?.vehicleId);
      hydrateImages(vid, immediate);

      syncFav(card);
    }

    function openWithCard(card){
      populate(card);
      open();
    }

    // ✅ EXPOSE: open the modal from anywhere (drawer, map popup, etc.)
    window.tcOpenDetailsModal = function(opts){
      opts = opts || {};
      const vid = Number(opts.vehicle_id || opts.id || 0);
      if (!vid) return false;

      let card =
        document.querySelector(`.as-card[data-vehicle-id="${vid}"]`) ||
        document.querySelector(`.as-card[data-vehicleid="${vid}"]`) ||
        null;

      if (!card){
        card = document.createElement('article');
        card.className = 'as-card';
        card.dataset.vehicleId = String(vid);
        if (opts.url) card.dataset.url = String(opts.url);
      }

      try{
        openWithCard(card);
        return true;
      }catch(e){
        console.warn('[tcdm] tcOpenDetailsModal failed', e);
        return false;
      }
    };

    // 1) OPEN POPUP from card image / "view details" buttons
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t) return;
      const card = t.closest?.('.as-card');
      if (!card) return;

      const hitImg = t.closest?.('img, .as-thumb, .as-thumb-wrap, .as-image, .as-img');
      const hitView =
        t.closest?.('.as-view, .as-viewdetails, [data-view-details], [data-action="view-details"]') ||
        (t.closest?.('button, a') && /view details|details|view/i.test((t.closest('button, a')?.textContent || '').trim()));

      if (!hitImg && !hitView) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
      e.stopPropagation();
      openWithCard(card);
    }, true);

    // 2) OPEN POPUP from map marker popup button: <button data-tcdm-open="123">
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-tcdm-open]') : null;
      if (!btn) return;

      const vid = String(btn.getAttribute('data-tcdm-open') || '').trim();
      if (!vid) return;

      e.preventDefault();
      e.stopPropagation();

      const cards = Array.from(document.querySelectorAll('.as-card'));
      const card = cards.find(c => {
        const a = String(c.getAttribute('data-vehicle-id') || '').trim();
        const b = String(c.getAttribute('data-vehicleid') || '').trim();
        const cId = String(c.dataset?.vehicleId || '').trim();
        return a === vid || b === vid || cId === vid;
      });

      if (card){
        try{ closeMapSection(); }catch(_){}
        openWithCard(card);
      }
    }, true);

    console.log('[ticary] popup module loaded (bundle-safe)');
  });

})();

/* =========================================================
   Back to details button (always visible in map mode)
========================================================= */
(function(){
  if (window.__tcdm_mapback_v4) return;
  window.__tcdm_mapback_v4 = 1;

  const $ = (s,r=document)=>r.querySelector(s);
  const modal = document.getElementById('tcdm');
  const right = document.getElementById('tcdm-right');
  if (!modal || !right) return;

  let wrap = right.querySelector('.tcdm-mapBackWrap');
  if (!wrap){
    wrap = document.createElement('div');
    wrap.className = 'tcdm-mapBackWrap';
    wrap.style.display = 'none';
    wrap.style.padding = '0 0 14px 0';
    right.prepend(wrap);
  }

  let btn = document.getElementById('tcdm-mapBackBtn');
  if (!btn){
    btn = document.createElement('button');
    btn.id = 'tcdm-mapBackBtn';
    btn.type = 'button';
    btn.textContent = '← Back to details';
    btn.style.width = '100%';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'center';
    btn.style.alignItems = 'center';
    btn.style.padding = '14px 14px';
    btn.style.borderRadius = '14px';
    btn.style.background = 'rgba(63,177,206,.22)';
    btn.style.border = '1px solid rgba(63,177,206,.60)';
    btn.style.color = 'var(--tc-text)';
    btn.style.fontWeight = '950';
    btn.style.cursor = 'pointer';
    wrap.appendChild(btn);

    btn.addEventListener('click', function(e){
      e.preventDefault(); 
      e.stopPropagation();
      const t = $('#tcdm-mapToggle');
      if (t) t.click();
    }, true);
  }

  const sync = () => {
    const on = modal.classList.contains('is-map-open');
    wrap.style.display = on ? 'block' : 'none';
  };

  sync();
  new MutationObserver(sync).observe(modal, {attributes:true, attributeFilter:['class']});
})();

/* =========================================================
   Nested scroll handoff
========================================================= */
(function(){
  if (window.__tcdm_scroll_handoff_v1) return;
  window.__tcdm_scroll_handoff_v1 = 1;

  function attach(){
    const pane = document.getElementById('tcdm-paneContainer');
    if (!pane) return;

    const modal = document.getElementById('tcdm');
    if (!modal) return;

    modal.addEventListener('wheel', function(e){
      const box = e.target && e.target.closest ? e.target.closest('.tcdm-scroll') : null;
      if (!box) return;

      if (!pane || pane.offsetParent === null) return;

      const deltaY = e.deltaY || 0;
      if (!deltaY) return;

      const atTop = box.scrollTop <= 0;
      const atBottom = (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 1);

      if (deltaY < 0 && !atTop) return;
      if (deltaY > 0 && !atBottom) return;

      e.preventDefault();
      e.stopPropagation();
      pane.scrollTop += deltaY;
    }, { passive:false });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attach, { once:true });
  } else {
    attach();
  }
})();

/* =========================================================
   Lock modal heights to left column
========================================================= */
(function(){
  if (window.__tcdm_lock_heights_v1) return;
  window.__tcdm_lock_heights_v1 = 1;

  const $ = (s,r=document)=>r.querySelector(s);

  function lock(){
    const overlay = $('#tcdm-overlay');
    const modal   = $('#tcdm');
    if (!overlay || !modal) return;

    if (!overlay.classList.contains('is-open')) return;
    if (modal.classList.contains('is-map-open')) return;

    const left = $('#tcdm-left');
    const cta  = $('#tcdm-ctaBar');
    if (!left || !cta) return;

    const leftH = Math.floor(left.getBoundingClientRect().height || 0);
    if (leftH < 240) return;

    const cap = Math.floor(Math.min(window.innerHeight * 0.92, 980));
    const modalH = Math.max(320, Math.min(leftH, cap));

    const ctaH = Math.floor(cta.getBoundingClientRect().height || 0);
    const rightPadding = 32;
    const rightGap = 12;
    const paneMax = Math.max(220, modalH - ctaH - rightPadding - rightGap);

    modal.style.setProperty('--tcdm-lock-h', modalH + 'px');
    modal.style.setProperty('--tcdm-pane-max', paneMax + 'px');
  }

  function burst(){
    lock();
    setTimeout(lock, 50);
    setTimeout(lock, 150);
    setTimeout(lock, 350);
    setTimeout(lock, 700);
  }

  const overlay = document.getElementById('tcdm-overlay');
  const modal   = document.getElementById('tcdm');

  if (overlay){
    new MutationObserver(burst).observe(overlay, { attributes:true, attributeFilter:['class'] });
  }
  if (modal){
    new MutationObserver(burst).observe(modal, { attributes:true, attributeFilter:['class'] });
  }

  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('.tcdm-tab')) burst();
  }, true);

  window.addEventListener('resize', () => setTimeout(burst, 60), { passive:true });

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', burst, { once:true });
  } else {
    burst();
  }
})();

/* =========================================================
   TICARY — Popup Map Aid (Radius UI + marker popups)
   - Exposes: window.__tcdmAttachRadius(params)
   - Idempotent
========================================================= */
(function(){
  if (window.__tcdmMapAid_v74) return;
  window.__tcdmMapAid_v74 = 1;

  function ensureRadiusUI(){
    const mount = document.getElementById('tcdm-radiusMount');
    const hintText = document.getElementById('tcdm-mapHintText');
    const hint = hintText?.parentElement;

    const host = mount || hint;
    if (!host) return;

    if (document.getElementById('tcdm-mapRadiusRow')) return;

    const row = document.createElement('div');
    row.id = 'tcdm-mapRadiusRow';
    row.innerHTML = `
      <div id="tcdm-radiusVal">20 mi</div>
      <div id="tcdm-radiusCtrl">
        <button id="tcdm-radiusMinus" class="tcdm-mapBtn" type="button" aria-label="Decrease radius">−</button>
        <input id="tcdm-radius" type="range" min="5" max="300" step="5" value="20">
        <button id="tcdm-radiusPlus" class="tcdm-mapBtn" type="button" aria-label="Increase radius">+</button>
      </div>
      <button id="tcdm-mapWithin" class="tcdm-mapBtn" type="button">Show within</button>
    `;
    host.appendChild(row);
  }

  function parseMoreCount(){
    const more = document.getElementById('as-more');
    if (!more) return 0;
    const cs = window.getComputedStyle(more);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || 1) === 0) return 0;
    const txt = (more.textContent || '').replace(/\s+/g,' ').trim();
    const m = txt.match(/See\s+(\d+)\s+more/i);
    return m ? parseInt(m[1],10) || 0 : 0;
  }

  function clickMoreOnce(){
    const more = document.getElementById('as-more');
    if (!more) return false;
    const cs = window.getComputedStyle(more);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || 1) === 0) return false;
    more.click();
    return true;
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  async function waitForCardChange(prevCount){
    for (let i=0;i<12;i++){
      const now = document.querySelectorAll('.as-card').length;
      if (now > prevCount) return true;
      await sleep(100);
    }
    return false;
  }

  function groupKey(lat, lng){
    const r = (n) => (Math.round(n * 10000) / 10000).toFixed(4);
    return r(lat) + ',' + r(lng);
  }

  // === Exposed hook that popup.js calls ===
  window.__tcdmAttachRadius = function(params){
    try{
      ensureRadiusUI();

      const { map, current, haversineMiles, pick, clean, isFiniteNum, moneyGBP } = params || {};
      if (!map || !current || !isFiniteNum(current.lat) || !isFiniteNum(current.lng)) return;
      if (!window.mapboxgl) return;

      try { map.resize(); } catch(_){}

      // OPEN ZOOM (less zoomed-in on open)
      try{
        const OPEN_ZOOM = 7.4;
        const MAX_OPEN_ZOOM = 12.0;
        const target = Math.min(OPEN_ZOOM, MAX_OPEN_ZOOM);
        map.easeTo({ center:[current.lng, current.lat], zoom: target, duration: 380 });
      }catch(_){}

      const pill      = document.getElementById('tcdm-mapPill');
      const hintText  = document.getElementById('tcdm-mapHintText');

      const radiusInput = document.getElementById('tcdm-radius');
      const radiusValEl = document.getElementById('tcdm-radiusVal');
      const withinBtn   = document.getElementById('tcdm-mapWithin');
      const minusBtn    = document.getElementById('tcdm-radiusMinus');
      const plusBtn     = document.getElementById('tcdm-radiusPlus');

      if (!radiusInput || !radiusValEl || !withinBtn) return;

      function getRadiusMiles(){
        const v = parseFloat(radiusInput.value);
        if (!Number.isFinite(v)) return 20;
        return (v >= 300) ? Infinity : v;
      }
      function labelForRadius(r){
        return (r === Infinity) ? 'National' : `${Math.round(r)} mi`;
      }
      function setRadiusLabel(){
        const raw = parseFloat(radiusInput.value);
        radiusValEl.textContent = (raw >= 300) ? 'National' : `${Math.round(raw)} mi`;
      }
      function clampRadius(v){
        const min = parseFloat(radiusInput.min || '5');
        const max = parseFloat(radiusInput.max || '300');
        v = Math.round(v / 5) * 5;
        return Math.max(min, Math.min(max, v));
      }
      function setRadius(v){
        const vv = (v === Infinity) ? 300 : v;
        radiusInput.value = String(clampRadius(vv));
        setRadiusLabel();
        updateUI();
      }

      if (minusBtn){
        minusBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setRadius((parseFloat(radiusInput.value)||20) - 20); };
      }
      if (plusBtn){
        plusBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setRadius((parseFloat(radiusInput.value)||20) + 20); };
      }

      const items = Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
      const byId = new Map();
      for (const it of items){
        const d = it && (it.data || it);
        const id = clean(pick(d, ['id','vehicle_id','vehicleId']));
        if (id) byId.set(String(id), d);
      }

      function getVisibleVehicleIds(){
        const cards = Array.from(document.querySelectorAll('.as-card'));
        return cards
          .filter(c => {
            if (!c || c.offsetParent === null) return false;
            const cs = window.getComputedStyle(c);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || 1) === 0) return false;
            return true;
          })
          .map(c => clean(
            c.dataset?.vehicleId ||
            c.getAttribute('data-vehicle-id') ||
            c.getAttribute('data-vehicleid') ||
            c.getAttribute('data-id')
          ))
          .filter(Boolean);
      }

      const curId = clean(pick(current, ['id','vehicle_id','vehicleId']));

      function coverUrl(d){
        return clean(pick(d, ['image_cover_url','cover','primary_image','thumb','image','cover_image_url','image_url']) || '');
      }
      function milesText(d){
        const raw = pick(d, ['mileage','miles','odometer_miles']);
        const n = parseFloat(String(raw ?? '').replace(/[^0-9.]/g,''));
        return Number.isFinite(n) ? `${Math.round(n).toLocaleString()} mi` : '';
      }

      function buildPoolFromVisible(){
        const visibleIds = getVisibleVehicleIds();
        const pool = [];

        for (const id of visibleIds){
          const d = byId.get(String(id));
          if (!d) continue;

          const did = clean(pick(d, ['id','vehicle_id','vehicleId']));
          if (curId && did && String(did) === String(curId)) continue;

          const lat = parseFloat(String(pick(d, ['lat','latitude','dealer_lat','location_lat','vehicle_lat']) || ''));
          const lng = parseFloat(String(pick(d, ['lng','lon','long','longitude','dealer_lng','dealer_lon','vehicle_lng','vehicle_lon']) || ''));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const dist = haversineMiles(current.lat, current.lng, lat, lng);
          if (dist < 0.08) continue;

          pool.push({ d, lat, lng, dist, did });
        }

        pool.sort((a,b) => a.dist - b.dist);
        return pool;
      }

      const PAGE = 24;
      const shownIds = new Set();
      let shown = 0;

      const bounds = new mapboxgl.LngLatBounds([current.lng, current.lat],[current.lng, current.lat]);
      let pool = buildPoolFromVisible();

      const createdMarkers = [];
      function clearCreatedMarkers(){
        try{ createdMarkers.forEach(m => m.remove()); }catch(_){}
        createdMarkers.length = 0;
      }

      function estimateTotalFiltered(){
        const visibleIds = getVisibleVehicleIds();
        const more = parseMoreCount();
        return Math.max(1, visibleIds.length + more);
      }

      function countEligibleRemainingWithinRadius(r){
        return pool.reduce((acc, x) => {
          const key = String(x.did || '');
          if (!key || shownIds.has(key)) return acc;
          if (x.dist <= r) acc += 1;
          return acc;
        }, 0);
      }

      function updateUI(){
        pool = buildPoolFromVisible();

        const totalFiltered = estimateTotalFiltered();
        const showing = 1 + shown;
        if (pill) pill.textContent = `Showing ${showing} of ${totalFiltered}`;

        if (hintText){
          hintText.textContent = `Nearest cars are based on your current filters. Choose a radius and reveal cars on the map.`;
        }

        const r = getRadiusMiles();
        const label = labelForRadius(r);

        const moreRemaining = parseMoreCount();
        const eligibleRemaining = countEligibleRemainingWithinRadius(r);

        if (withinBtn){
          if (moreRemaining > 0){
            withinBtn.disabled = false;
            withinBtn.textContent = `Show within ${label}`;
          } else {
            if (eligibleRemaining === 0){
              withinBtn.disabled = true;
              withinBtn.textContent = `No more within ${label}`;
            } else {
              withinBtn.disabled = false;
              withinBtn.textContent = `Show within ${label} (${eligibleRemaining} left)`;
            }
          }
        }
      }

      function buildPopupHtml(item, totalAtSpot){
        const d = item.d;

        const year  = clean(pick(d, ['year']));
        const make  = clean(pick(d, ['make']));
        const model = clean(pick(d, ['model']));
        const title = clean([year, make, model].filter(Boolean).join(' ')) || 'Vehicle';

        const price = moneyGBP(pick(d,['price_gbp','price']));
        const miles = milesText(d);

        const dealer = clean(pick(d, ['dealer_name','dealer']) || '');
        const img = coverUrl(d);

        const dist = (typeof item.dist === 'number' && isFinite(item.dist)) ? `${item.dist.toFixed(1)} mi` : '';

        const showNav = totalAtSpot > 1;

        return `
          <div class="tc-pop" data-tc-pop>
            <div class="tc-popImgWrap">
              <img class="tc-popImgTop" src="${img || ''}" alt="" onerror="this.style.display='none'">
              ${showNav ? `
                <button type="button" class="tc-imgNavBtn tc-imgPrev" data-tc-prev aria-label="Previous">‹</button>
                <button type="button" class="tc-imgNavBtn tc-imgNext" data-tc-next aria-label="Next">›</button>
              ` : ``}
            </div>

            <div class="tc-popBody">
              <div class="tc-popTitle">${title}</div>

              <div class="tc-popMetaLine">
                ${price}${miles ? ` • ${miles}` : ``}
              </div>

              ${(dealer || dist) ? `
                <div class="tc-popDealerLine">
                  ${dealer ? `<span>${dealer}</span>` : ``}
                  ${(dealer && dist) ? `<span class="tc-dot">•</span>` : ``}
                  ${dist ? `<span>${dist} away</span>` : ``}
                </div>
              ` : ``}

              ${item.did ? `
                <button class="tc-popCta" type="button" data-tcdm-open="${item.did}">
                  View details
                </button>
              ` : ``}
            </div>
          </div>
        `;
      }

      function panPinIntoSafeZone(lng, lat){
        try{
          map.resize();
          const mapEl = map.getContainer();
          const rect = mapEl.getBoundingClientRect();

          const SAFE_TOP    = rect.top + 160;
          const SAFE_BOTTOM = rect.bottom - 210;

          const pt = map.project([lng, lat]);
          const pinY = rect.top + pt.y;

          let dy = 0;
          if (pinY < SAFE_TOP) dy = SAFE_TOP - pinY;
          else if (pinY > SAFE_BOTTOM) dy = SAFE_BOTTOM - pinY;

          if (dy !== 0){
            map.panBy([0, -dy], { duration: 260 });
          }
        }catch(_){}
      }

      function addGroupedMarker(groupItems, opts){
        const first = groupItems[0];
        const lat = first.lat, lng = first.lng;

        const outer = document.createElement('div');

        const pin = document.createElement('div');
        pin.className = 'tc-pin' + (opts?.current ? ' is-current' : '');

        if (groupItems.length > 1){
          const b = document.createElement('div');
          b.className = 'tc-pinCount';
          b.textContent = String(groupItems.length);
          pin.appendChild(b);
        }

        const tip = document.createElement('div');
        tip.className = 'tc-pinTip';
        const dealer = clean(pick(first.d, ['dealer_name','dealer']) || '');
        tip.textContent = opts?.current ? 'This car' : (dealer || 'Dealer');
        pin.appendChild(tip);

        outer.appendChild(pin);

        let idx = 0;
        const popup = new mapboxgl.Popup({
          offset: 18,
          closeButton: true,
          closeOnClick: true,
          anchor: 'bottom',
          maxWidth: '320px'
        });

        function renderPopup(){
          popup.setHTML(buildPopupHtml(groupItems[idx], groupItems.length));
          popup.setLngLat([lng, lat]).addTo(map);

          setTimeout(() => {
            const root = popup.getElement();
            if (!root) return;

            const prev = root.querySelector('[data-tc-prev]');
            const next = root.querySelector('[data-tc-next]');

            if (prev){
              prev.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                idx = (idx - 1 + groupItems.length) % groupItems.length;
                renderPopup();
              };
            }
            if (next){
              next.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                idx = (idx + 1) % groupItems.length;
                renderPopup();
              };
            }

            panPinIntoSafeZone(lng, lat);
          }, 0);
        }

        pin.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          renderPopup();
        });

        const marker = new mapboxgl.Marker({ element: outer, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);

        if (opts?.current){
          try{ outer.style.zIndex = '999999'; }catch(_){}
        }

        createdMarkers.push(marker);
        return marker;
      }

      function buildCurrentGroup(){
        try{
          const curLat = parseFloat(current.lat);
          const curLng = parseFloat(current.lng);
          if (!Number.isFinite(curLat) || !Number.isFinite(curLng)) return null;

          const curKey = groupKey(curLat, curLng);

          const base = {
            d: current,
            lat: curLat,
            lng: curLng,
            dist: 0,
            did: clean(pick(current, ['id','vehicle_id','vehicleId'])) || ''
          };

          const visibleIds = getVisibleVehicleIds();
          const group = [base];

          for (const id of visibleIds){
            const d = byId.get(String(id));
            if (!d) continue;

            const did = clean(pick(d, ['id','vehicle_id','vehicleId']));
            if (!did) continue;
            if (base.did && String(did) === String(base.did)) continue;

            const lat = parseFloat(String(pick(d, ['lat','latitude','dealer_lat','location_lat','vehicle_lat']) || ''));
            const lng = parseFloat(String(pick(d, ['lng','lon','long','longitude','dealer_lng','dealer_lon','vehicle_lng','vehicle_lon']) || ''));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

            if (groupKey(lat, lng) !== curKey) continue;

            const dist = haversineMiles(curLat, curLng, lat, lng);
            group.push({ d, lat, lng, dist, did });
          }

          group.slice(1).sort((a,b) => (a.dist||0) - (b.dist||0));
          return group;
        }catch(_){ return null; }
      }

      async function ensureMoreLoadedIfNeeded(){
        const r = getRadiusMiles();
        let moreRemaining = parseMoreCount();
        if (!moreRemaining) return;

        for (let attempt=0; attempt<8; attempt++){
          pool = buildPoolFromVisible();
          const eligible = countEligibleRemainingWithinRadius(r);
          moreRemaining = parseMoreCount();

          if (!moreRemaining) break;
          if (eligible >= PAGE) break;

          const prevCards = document.querySelectorAll('.as-card').length;
          const clicked = clickMoreOnce();
          if (!clicked) break;
          await waitForCardChange(prevCards);
        }

        pool = buildPoolFromVisible();
      }

      function addWithinRadius(){
        const r = getRadiusMiles();
        const slice = [];

        for (const x of pool){
          const key = String(x.did || '');
          if (!key || shownIds.has(key)) continue;
          if (x.dist > r) break;
          slice.push(x);
          if (slice.length >= PAGE) break;
        }
        if (!slice.length) return false;

        const groups = new Map();
        for (const x of slice){
          shownIds.add(String(x.did || ''));
          shown += 1;
          bounds.extend([x.lng, x.lat]);

          const k = groupKey(x.lat, x.lng);
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(x);
        }

        for (const [, arr] of groups) addGroupedMarker(arr);

        try{
          map.resize();

          const padding = { top: 160, bottom: 210, left: 70, right: 70 };

          const cam = map.cameraForBounds(bounds, { padding, maxZoom: 12.75 });
          if (cam){
            const MIN_ZOOM = 5.9;
            const z = Math.max(cam.zoom, MIN_ZOOM);

            map.easeTo({
              center: cam.center,
              zoom: z,
              bearing: map.getBearing(),
              pitch: map.getPitch(),
              duration: 450
            });
          } else {
            map.fitBounds(bounds, { padding, maxZoom: 12.75, duration: 450 });
          }
        }catch(_){}

        return true;
      }

      setRadiusLabel();
      radiusInput.oninput = () => { setRadiusLabel(); updateUI(); };

      clearCreatedMarkers();

      const curGroup = buildCurrentGroup();
      if (curGroup && curGroup.length >= 1){
        addGroupedMarker(curGroup, { current:true });
      }

      updateUI();

      withinBtn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();

        withinBtn.disabled = true;
        const r = getRadiusMiles();
        withinBtn.textContent = `Loading…`;

        await ensureMoreLoadedIfNeeded();

        const ok = addWithinRadius();
        updateUI();

        if (!ok){
          withinBtn.disabled = true;
          withinBtn.textContent = `No more within ${labelForRadius(r)}`;
        } else {
          try { map.resize(); } catch(_){}
        }
      };

    }catch(_){}
  };

  console.log('✅ popup-map-aid.js loaded (GitHub)');
})();

/* =========================================================
   TICARY — TCDM Modal Stack Back (v3) — bundle-safe
   Adds: restores prior popup's MAP OPEN state when going back.
========================================================= */
(function(){
  if (window.__tcModalStackBack_v3) return;
  window.__tcModalStackBack_v3 = 1;

  const stack = (window.__tcModalStack = window.__tcModalStack || []);

  const num = (v) => {
    const n = Number(String(v ?? '').trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  function whenReady(cb, tries=0){
    // We need modal DOM (close button) + tcOpenDetailsModal eventually
    const overlay = document.getElementById('tcdm-overlay');
    const closeBtn = document.getElementById('tcdm-close');
    if (overlay && closeBtn) return cb();

    if (tries >= 200) return; // ~10s
    setTimeout(() => whenReady(cb, tries+1), 50);
  }

  function getCurrentId(){
    return num(window.__tcdmCurrentVehicleId || 0);
  }

  function isMapOpenNow(){
    const ms = document.getElementById('tcdm-mapSection');
    return !!(ms && ms.classList.contains('is-open'));
  }

  function pushCurrentIfNeeded(nextId){
    const curId = getCurrentId();
    nextId = num(nextId);
    if (!curId || !nextId || curId === nextId) return;

    const top = stack[stack.length - 1];
    const topId = (top && typeof top === 'object') ? num(top.id) : num(top);

    if (topId !== curId){
      stack.push({ id: curId, mapOpen: isMapOpenNow() });
    }
  }

  function openId(id){
    id = num(id);
    if (!id) return false;
    window.__tcdmCurrentVehicleId = id;

    if (typeof window.tcOpenDetailsModal === 'function'){
      try{ window.tcOpenDetailsModal({ vehicle_id: id }); return true; }catch(_){}
    }
    return false;
  }

  function restoreMapIfNeeded(){
    // after openId(prev), wait until modal is open then re-open map section
    let tries = 0;
    const iv = setInterval(() => {
      tries++;

      const overlay = document.getElementById('tcdm-overlay');
      if (!overlay || !overlay.classList.contains('is-open')){
        if (tries > 60) clearInterval(iv);
        return;
      }

      const mapSection = document.getElementById('tcdm-mapSection');
      const mapToggle  = document.getElementById('tcdm-mapToggle');

      if (mapSection && mapSection.classList.contains('is-open')){
        clearInterval(iv);
        return; // already open
      }

      if (mapToggle){
        mapToggle.click(); // opens map (runs main popup logic)
        clearInterval(iv);
        return;
      }

      if (tries > 60) clearInterval(iv);
    }, 80);
  }

  function wrapTcOpen(){
    const fn = window.tcOpenDetailsModal;
    if (typeof fn !== 'function' || fn.__tcWrapped_v3) return;

    function wrapped(opts){
      opts = opts || {};
      const nextId = num(opts.vehicle_id || opts.id || 0);
      if (nextId){
        pushCurrentIfNeeded(nextId);
        window.__tcdmCurrentVehicleId = nextId;
      }
      return fn.call(this, opts);
    }
    wrapped.__tcWrapped_v3 = 1;
    window.tcOpenDetailsModal = wrapped;
  }

  whenReady(() => {
    // 1) WRAP tcOpenDetailsModal so currentId ALWAYS updates and stack ALWAYS pushes
    wrapTcOpen();
    let tries = 0;
    const iv = setInterval(() => {
      wrapTcOpen();
      tries++;
      if (tries > 40 || (window.tcOpenDetailsModal && window.tcOpenDetailsModal.__tcWrapped_v3)) clearInterval(iv);
    }, 100);

    // 2) When opening Car B from map popup button, push Car A (+mapOpen) then set current to B
    document.addEventListener('click', function(e){
      const btn = e.target && e.target.closest ? e.target.closest('[data-tcdm-open]') : null;
      if (!btn) return;

      const nextId = num(btn.getAttribute('data-tcdm-open'));
      if (!nextId) return;

      pushCurrentIfNeeded(nextId);
      window.__tcdmCurrentVehicleId = nextId;
    }, true);

    // 3) When opening from a card click, set current
    document.addEventListener('click', function(e){
      const t = e.target;
      if (!t || !t.closest) return;

      const card = t.closest('.as-card');
      if (!card) return;

      const id =
        num(card.dataset?.vehicleId) ||
        num(card.getAttribute('data-vehicle-id')) ||
        num(card.getAttribute('data-vehicleid'));

      if (!id) return;

      const hitImg = t.closest('img, .as-thumb, .as-thumb-wrap, .as-image, .as-img');
      const hitView =
        t.closest('.as-view, .as-viewdetails, [data-view-details], [data-action="view-details"]') ||
        (t.closest('button, a') && /view details|details|view/i.test((t.closest('button, a')?.textContent || '').trim()));

      if (!hitImg && !hitView) return;

      window.__tcdmCurrentVehicleId = id;
    }, true);

    // 4) BACK on close: if stack has prev, go back (and restore map state if needed)
    document.addEventListener('click', function(e){
      const closeBtn = e.target && e.target.closest ? e.target.closest('#tcdm-close') : null;
      if (!closeBtn) return;

      const prev = stack.pop();
      const prevId = (prev && typeof prev === 'object') ? num(prev.id) : num(prev);

      if (!prevId) return; // no previous -> allow normal close

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      openId(prevId);

      // restore map open state
      const wantsMap = !!(prev && typeof prev === 'object' && prev.mapOpen);
      if (wantsMap) restoreMapIfNeeded();
    }, true);

    console.log('[ticary] modal stack back loaded (v3)');
  });

})();

(function(){
  if (window.__tcDealerSave_snapshot_v1) return;
  window.__tcDealerSave_snapshot_v1 = 1;

  const API_BASE = 'https://vehicle-api-espm.onrender.com';
  const $ = (s,r=document)=>r.querySelector(s);

  const log = (...a)=>{ try{ console.log('[dealer-saves]', ...a); }catch(_){} };
  const warn = (...a)=>{ try{ console.warn('[dealer-saves]', ...a); }catch(_){} };

  // ✅ Capture which vehicle was clicked to open the modal
  window.__tcLastVehicleId = window.__tcLastVehicleId || null;
  document.addEventListener('click', (e) => {
    const card = e.target?.closest?.('[data-vehicle-id]');
    const vid = card?.getAttribute('data-vehicle-id');
    if (vid){
      window.__tcLastVehicleId = String(vid).trim();
      //log('captured vehicle_id', window.__tcLastVehicleId);
    }
  }, true);

  // ---- auth token helpers (Supabase) ----
  function getAccessToken(){
    try{
      const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x));
      if (!k) return null;
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const j = JSON.parse(raw);
      return j?.access_token || j?.currentSession?.access_token || null;
    }catch(_){ return null; }
  }
  function authHeaders(){
    const t = getAccessToken();
    if (!t) return null;
    return { "Authorization": "Bearer " + t };
  }

  function modalOpen(){
    const ov = $('#tcdm-overlay');
    return !!(ov && ov.classList.contains('is-open'));
  }

  function ensureInlinePill(){
    const nameEl = $('#tcdm-dealerName');
    if (!nameEl) return null;

    let pill = nameEl.querySelector('.tcdm-likeInline');
    if (pill) return pill;

    pill = document.createElement('span');
    pill.className = 'tcdm-likeInline';
    pill.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3h-4z"></path>
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
      </svg>
      <span class="tcdm-likeCount">0</span>
    `;
    nameEl.insertBefore(pill, nameEl.firstChild);
    return pill;
  }

  function getOrCreateSaveButton(){
    const block = $('#tcdm-dealerBlock');
    if (!block) return null;

    let btn = block.querySelector('.tcdm-saveDealerBtn');
    if (!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tcdm-saveDealerBtn';
      btn.style.width = '100%';
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.gap = '8px';
      btn.style.padding = '10px 12px';
      btn.style.borderRadius = '12px';
      btn.style.border = '1px solid rgba(63,177,206,.40)';
      btn.style.background = 'rgba(63,177,206,.14)';
      btn.style.color = 'var(--tc-text)';
      btn.style.fontSize = '12px';
      btn.style.fontWeight = '900';
      btn.style.cursor = 'pointer';
      btn.style.marginBottom = '10px';
      btn.style.transition = 'transform .14s ease, background .14s ease, border-color .14s ease';
      btn.textContent = '★ Save dealer';

      block.insertBefore(btn, block.firstChild);
    }
    return btn;
  }

  function setCount(n){
    const pill = ensureInlinePill();
    const c = pill?.querySelector('.tcdm-likeCount');
    if (c) c.textContent = String(Math.max(0, Number(n)||0));
  }

  function setSavedUI(saved){
    const btn = getOrCreateSaveButton();
    if (!btn) return;
    btn.classList.toggle('is-on', !!saved);
    btn.textContent = saved ? '✓ Dealer saved' : '★ Save dealer';
  }

  function setDisabled(msg){
    const btn = getOrCreateSaveButton();
    if (!btn) return;
    btn.classList.add('is-disabled');
    btn.classList.remove('is-on','is-loading');
    btn.textContent = msg;
  }

  function setLoading(on){
    const btn = getOrCreateSaveButton();
    if (!btn) return;
    btn.classList.toggle('is-loading', !!on);
  }

  // ✅ Find dealer_id from snapshot list
  function resolveDealerIdFromSnapshot(){
    const vid = String(window.__tcLastVehicleId || '').trim();
    if (!vid) return '';

    const cars = window.__ticaryCars;
    if (!Array.isArray(cars) || !cars.length) return '';

    const car = cars.find(x => String(x?.id ?? x?.vehicle_id ?? '').trim() === vid);
    if (!car) return '';

    const did = car?.dealer_id ?? car?.dealerId ?? car?.dealerID ?? '';
    const digits = String(did || '').replace(/\D+/g,'');
    return digits || '';
  }

  async function apiGetStatus(dealer_id){
    const h = authHeaders();
    if (!h) return { __noauth:true };
    const url = `${API_BASE}/me/dealer-saves/status?dealer_id=${encodeURIComponent(dealer_id)}`;
    try{
      const r = await fetch(url, { headers: h });
      if (!r.ok) return { __err:true, status:r.status, text: await r.text().catch(()=> '') };
      return await r.json();
    }catch(e){
      return { __err:true, status:0, text:String(e) };
    }
  }

  async function apiToggle(dealer_id){
    const h = authHeaders();
    if (!h) return { __noauth:true };
    try{
      const r = await fetch(`${API_BASE}/me/dealer-saves/toggle`, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type':'application/json' }, h),
        body: JSON.stringify({ dealer_id })
      });
      if (!r.ok) return { __err:true, status:r.status, text: await r.text().catch(()=> '') };
      return await r.json();
    }catch(e){
      return { __err:true, status:0, text:String(e) };
    }
  }

  let lastDealerId = null;
  let inflight = false;

  async function refresh(){
    if (!modalOpen()) return;

    ensureInlinePill();
    const btn = getOrCreateSaveButton();
    if (!btn) return;

    const h = authHeaders();
    if (!h){
      setCount(0);
      setDisabled('Log in to save dealer');
      return;
    } else {
      btn.classList.remove('is-disabled');
    }

    const dealer_id = resolveDealerIdFromSnapshot();

    // Helpful debug if it fails:
    if (!dealer_id){
      setCount(0);
      setDisabled('Dealer unavailable');
      // Uncomment if you want to see why:
      //log('missing dealer_id', { vid: window.__tcLastVehicleId, cars: Array.isArray(window.__ticaryCars)?window.__ticaryCars.length:0 });
      return;
    }

    if (dealer_id === lastDealerId && !inflight) return;
    lastDealerId = dealer_id;

    inflight = true;
    setLoading(true);

    const res = await apiGetStatus(dealer_id);

    inflight = false;
    setLoading(false);

    if (res?.__noauth){
      setCount(0);
      setDisabled('Log in to save dealer');
      return;
    }
    if (res?.__err){
      warn('status failed', res.status, res.text);
      return;
    }

    setCount(res.total_saves ?? 0);
    setSavedUI(!!res.is_saved);
  }

  function wireOnce(){
    const btn = getOrCreateSaveButton();
    if (!btn || btn.__wired) return;
    btn.__wired = true;

    btn.addEventListener('click', async (e)=>{
      e.preventDefault();
      e.stopPropagation();

      if (btn.classList.contains('is-loading')) return;
      if (!modalOpen()) return;

      const h = authHeaders();
      if (!h){
        setDisabled('Log in to save dealer');
        return;
      }

      const dealer_id = resolveDealerIdFromSnapshot();
      if (!dealer_id){
        setDisabled('Dealer unavailable');
        return;
      }

      setLoading(true);
      const res = await apiToggle(dealer_id);
      setLoading(false);

      if (res?.__noauth){
        setDisabled('Log in to save dealer');
        return;
      }
      if (res?.__err){
        warn('toggle failed', res.status, res.text);
        return;
      }

      setCount(res.total_saves ?? 0);
      setSavedUI(!!res.is_saved);
    }, true);
  }

  let lastOpen = false;
  let ticks = 0;

  setInterval(()=>{
    const open = modalOpen();
    if (open && (!lastOpen || ticks < 10)){
      ticks++;
      wireOnce();
      refresh();
    } else if (!open){
      ticks = 0;
      lastDealerId = null;
      inflight = false;
    }
    lastOpen = open;
  }, 140);

})();
