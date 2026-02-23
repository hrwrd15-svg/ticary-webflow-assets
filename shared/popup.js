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
