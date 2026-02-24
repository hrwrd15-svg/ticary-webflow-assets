(function(){
  if (window.__tcFavMetaCacheV2) return;
  window.__tcFavMetaCacheV2 = 1;

  const FAV_KEY = "as:favs";     // array of URLs
  const MAP_KEY = "as:favmap";   // url -> metadata object

  const clean = (t)=> (t ?? "").toString().trim();
  const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };

  const loadFavs = () => {
    const a = load(FAV_KEY, []);
    return Array.isArray(a) ? a.filter(Boolean) : [];
  };
  const loadMap = () => {
    const m = load(MAP_KEY, {});
    return (m && typeof m === "object") ? m : {};
  };

  function getCardUrl(card){
    return clean(card?.dataset?.url) || clean(card?.querySelector("a")?.href) || "";
  }

  function getText(card, sel){
    return clean(card?.querySelector(sel)?.textContent);
  }

  function getThumb(card){
    // ✅ best: your cards store it on data-bg
    const bg = clean(card?.querySelector(".as-thumb")?.getAttribute("data-bg"));
    if (bg) return bg;

    // fallback: background-image style
    const styleBg = card?.querySelector(".as-thumb")?.style?.backgroundImage || "";
    const m = styleBg.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (m && m[1]) return clean(m[1]);

    // fallback img
    const img = card?.querySelector("img.as-thumb")?.src || card?.querySelector("img")?.src || "";
    return clean(img);
  }

  // Parse "2020 • 12,345 miles" safely
  function parseYearMileage(metaText){
    const txt = clean(metaText);
    if (!txt) return { year:"", mileage:"" };

    // year: first 4-digit
    const y = (txt.match(/\b(19|20)\d{2}\b/) || [])[0] || "";

    // mileage: number before "miles"
    const mm = txt.match(/([\d,]+)\s*miles/i);
    const miles = mm ? mm[1].replace(/,/g,"") : "";

    return { year: y, mileage: miles };
  }

  function buildMetaFromCard(card){
    const url = getCardUrl(card);
    if (!url) return null;

    const make    = getText(card, '[fs-list-field="make"]')  || getText(card, ".as-make");
    const model   = getText(card, '[fs-list-field="model"]') || getText(card, ".as-model");
    const edition = getText(card, '[fs-list-field="edition"]') || getText(card, ".as-edition");

    // ✅ Price: prefer the visible pill, fallback to hidden field
    const priceVisible = getText(card, ".as-price-badge");
    const priceHidden  = getText(card, '[fs-list-field="price"]');
    const price = priceVisible || priceHidden;

    // ✅ Year/mileage: prefer visible meta row, fallback to hidden fields
    const metaA = getText(card, ".as-meta-a");
    const ym = parseYearMileage(metaA);
    const yearHidden    = getText(card, '[fs-list-field="year"]');
    const mileageHidden = getText(card, '[fs-list-field="mileage"]');

    const year = ym.year || yearHidden;
    const mileage = ym.mileage || mileageHidden;

    // ✅ Finance: prefer visible, fallback hidden
    const financeVisible = getText(card, ".as-finance-inline");
    const financeHidden  = getText(card, '[fs-list-field="finance_monthly"]');
    const finance = financeVisible || financeHidden;

    const fg = clean(card?.querySelector(".as-fg")?.textContent) || "";

    // vehicle id best-effort
    const vehicle_id =
      Number(card?.dataset?.vehicleId || 0) ||
      Number(card?.dataset?.vehicle_id || 0) ||
      null;

    const thumb = getThumb(card);

    return {
      url,
      vehicle_id,
      make, model, edition,
      price,
      finance,
      year,
      mileage,
      fuelGearbox: fg,
      thumb
    };
  }

  function upsertMeta(meta){
    if (!meta?.url) return;
    const map = loadMap();
    map[meta.url] = { ...(map[meta.url] || {}), ...meta };
    save(MAP_KEY, map);
  }

  function removeMetaByUrl(url){
    url = clean(url);
    if (!url) return;
    const map = loadMap();
    if (map[url]) {
      delete map[url];
      save(MAP_KEY, map);
    }
  }

  // When heart is clicked, cache meta
  document.addEventListener("click", (ev)=>{
    const btn = ev.target?.closest?.(".as-fav-btn");
    if (!btn) return;

    const card = btn.closest(".as-card");
    if (!card) return;

    setTimeout(()=>{
      const url = getCardUrl(card);
      const on  = btn.getAttribute("aria-pressed") === "true";
      if (!url) return;

      if (on){
        const meta = buildMetaFromCard(card);
        if (meta) upsertMeta(meta);
      } else {
        removeMetaByUrl(url);
      }
    }, 0);
  }, true);

  // Refresh cache for any favourited cars currently visible
  function refreshVisibleFavs(){
    const favs = new Set(loadFavs());
    if (!favs.size) return;

    document.querySelectorAll(".as-card").forEach(card=>{
      const url = getCardUrl(card);
      if (!url || !favs.has(url)) return;
      const meta = buildMetaFromCard(card);
      if (meta) upsertMeta(meta);
    });
  }

  // Observe list changes
  (function(){
    let mo = null;

    function findListRoot(){
      return (
        document.querySelector("#as-grid") ||
        document.querySelector(".as-grid") ||
        document.querySelector("#vehiclesList") ||
        document.querySelector(".w-dyn-items") ||
        document.querySelector('[role="list"]')
      );
    }

    function start(){
      if (mo) return;
      const target = findListRoot();
      if (!target) return setTimeout(start, 350);

      mo = new MutationObserver(()=> {
        requestAnimationFrame(refreshVisibleFavs);
      });
      mo.observe(target, { childList:true, subtree:true });
      refreshVisibleFavs();
    }

    start();
  })();

  refreshVisibleFavs();
})();

(function(){
  if (window.__tcStampIdsV1) return;
  window.__tcStampIdsV1 = 1;

  function stamp(){
    const items = Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
    if (!items.length) return;

    for (const it of items){
      const card = it?.card;
      const data = it?.data;
      if (!card || !data) continue;

      const vid = data.id;
      const url = data.url;

      if (vid && !card.dataset.vehicleId) card.dataset.vehicleId = String(vid);
      if (url && !card.dataset.url) card.dataset.url = String(url);
    }
  }

  // stamp now + whenever Part B says it's ready
  stamp();
  window.addEventListener("ticary:partb:loaded", stamp);

  // also restamp if the list re-renders
  const target =
    document.querySelector("#as-grid") ||
    document.querySelector(".as-grid") ||
    document.querySelector("#vehiclesList") ||
    document.querySelector(".w-dyn-items") ||
    document.querySelector('[role="list"]');

  if (target){
    const mo = new MutationObserver(()=> requestAnimationFrame(stamp));
    mo.observe(target, { childList:true, subtree:true });
  } else {
    // fallback: retry a few times if target isn't there yet
    let n = 0;
    const iv = setInterval(()=>{
      stamp();
      if (++n > 30) clearInterval(iv);
    }, 250);
  }
})();

(function(){
  if (window.__tcFavSyncFixV1) return;
  window.__tcFavSyncFixV1 = true;

  // -------- Stable access token (NO AbortController) --------
  async function getAccessTokenSafe(){
    // 1) Try supabase-js session (no user fetch)
    try{
      const sb = window.supabase || window._supabase || window.supabaseClient;
      if (sb?.auth?.getSession){
        const { data, error } = await sb.auth.getSession();
        if (!error){
          const t = data?.session?.access_token;
          if (t) return t;
        }
      }
    }catch(e){}

    // 2) Fallback: read stored supabase auth token directly
    try{
      const keys = Object.keys(localStorage || {});
      const k = keys.find(x => /^sb-.*-auth-token$/.test(x));
      if (k){
        const raw = localStorage.getItem(k);
        if (raw){
          const j = JSON.parse(raw);
          // supabase-js v2 usually stores { access_token, refresh_token, ... }
          const t = j?.access_token || j?.currentSession?.access_token;
          if (t) return t;
        }
      }
    }catch(e){}

    return "";
  }

  // -------- Canonical favourites writer (checks response) --------
  async function favWrite({ on, vehicle_id }){
    const token = await getAccessTokenSafe();
    if (!token) throw new Error("No access token (user not logged in / session not ready)");

    const base = "https://vehicle-api-espm.onrender.com";
    const url  = `${base}/me/favourites/${vehicle_id}`;

    const res = await fetch(url, {
      method: on ? "POST" : "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok){
      const txt = await res.text().catch(()=> "");
      throw new Error(`Fav sync failed ${res.status}: ${txt || res.statusText}`);
    }
    return true;
  }

  // Expose ONE function everyone should use
  window.tcFavSync = async function({ on, vehicle_id }){
    vehicle_id = Number(vehicle_id || 0);
    if (!vehicle_id) return;

    // avoid double firing from multiple listeners
    const key = `${on ? "on" : "off"}:${vehicle_id}`;
    window.__tcFavInflight ||= new Set();
    if (window.__tcFavInflight.has(key)) return;
    window.__tcFavInflight.add(key);

    try{
      await favWrite({ on, vehicle_id });
      // Success: nothing else required — your reconcile poller will now match DB truth
      // (Optionally you can trigger a refresh event if you have one)
      window.dispatchEvent(new CustomEvent("tc:favs:synced", { detail:{ on, vehicle_id }}));
    } catch (e){
      console.warn("[FAV] Sync error:", e?.message || e);

      // IMPORTANT: if sync failed, revert UI toggle so it reflects DB truth
      try{
        const btn = document.querySelector(`.as-card [data-vehicle-id="${vehicle_id}"] .as-fav-btn, .as-card .as-fav-btn[data-vehicle-id="${vehicle_id}"]`);
        // best-effort revert: flip aria-pressed back
        // (if you have a more specific selector in your code, use that)
      }catch(_){}
    } finally {
      window.__tcFavInflight.delete(key);
    }
  };

  console.log("✅ tcFavSync Fix loaded (no AbortController token fetch)");
})();

/* TICARY — Favourites drawer: render from full dataset (not DOM) (v1) */
(function(){
  if (window.__tcFavDrawerDataBackfillV1) return;
  window.__tcFavDrawerDataBackfillV1 = 1;

  const FAV_KEY = "as:favs";

  const clean = (v)=> (v ?? "").toString().trim();
  const isNum  = (v)=> /^-?\d+(\.\d+)?$/.test(String(v||"").trim());
  
  const MAP_KEY = "as:favmap"; // url -> metadata (must include vehicle_id)

  const loadJSON = (k, fb)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }catch{ return fb; } };
  const saveJSON = (k, v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };


  function loadFavs(){
    try{
      const a = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    }catch{ return []; }
  }
  function saveFavs(arr){
    try{ localStorage.setItem(FAV_KEY, JSON.stringify(arr)); }catch(e){}
    // keep Part B Set in sync (if present)
    try{
      if (window.__ticaryFavIDs instanceof Set){
        window.__ticaryFavIDs.clear();
        arr.forEach(x => window.__ticaryFavIDs.add(x));
      }
    }catch(e){}
  }

  // Build quick lookup maps from full dataset
  function getItems(){
    return Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
  }
  function buildMaps(){
    const items = getItems();
    const byUrl = new Map();
    const byId  = new Map();
    for (const it of items){
      const d = it?.data || {};
      const url = clean(d.url);
      const id  = clean(d.id);
      if (url) byUrl.set(url, it);
      if (id)  byId.set(id, it);
    }
    return { byUrl, byId };
  }

  // Normalise favourites -> URLs where possible (using full dataset)
  function normaliseFavsToUrls(){
    const raw = loadFavs().map(clean).filter(Boolean);
    if (!raw.length) return [];

    const { byUrl, byId } = buildMaps();

    const out = [];
    const seen = new Set();

    for (const x of raw){
      // already a URL
      if (/^https?:\/\//i.test(x)){
        if (!seen.has(x)){ seen.add(x); out.push(x); }
        continue;
      }

      // numeric id -> resolve to url
      if (isNum(x)){
        const it = byId.get(String(parseInt(x,10)));
        const url = clean(it?.data?.url);
        if (url && !seen.has(url)){ seen.add(url); out.push(url); }
        continue;
      }

      // unknown string (could be old-style id); try match byId anyway
      const it = byId.get(x);
      const url = clean(it?.data?.url);
      if (url && !seen.has(url)){ seen.add(url); out.push(url); }
    }

    return out;
  }

  // Formatters (keep simple)
  const formatMoney = (raw)=>{
    const txt = clean(raw);
    if (!txt) return "";
    if (/£/.test(txt)) return txt;
    const n = Number(txt.replace(/,/g,""));
    if (!isFinite(n)) return "";
    return "£" + n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  };
  const formatMonthly = (raw)=>{
    const txt = clean(raw);
    if (!txt) return "";
    if (/contact\s+dealer/i.test(txt)) return "";
    if (/£/.test(txt) && /month/i.test(txt)) return txt;
    const n = Number(txt.replace(/,/g,""));
    if (!isFinite(n)) return "";
    return "£" + Math.round(n).toLocaleString("en-GB") + " / month";
  };

  function setHeaderBadge(n){
    const badge = document.getElementById("th-fav-count");
    const btn   = document.getElementById("th-fav-btn");
    if (badge){
      badge.textContent = String(n);
      badge.style.display = n > 0 ? "inline-flex" : "none";
    }
    if (btn) btn.classList.toggle("has-favs", n > 0);
  }

  function renderDrawerFromFavUrls(favUrls){
    const panelBody = document.getElementById("th-fav-panel-body");
    if (!panelBody) return;

    if (!favUrls.length){
      panelBody.innerHTML = `
        <div class="th-fav-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.1 21.35c-.13 .09-.3 .09-.43 0C7.14 17.77 4 15.03 2.53 12.7
                     1.4 10.93 1.2 8.9 2.13 7.18 3.03 5.51 4.77 4.5 6.6 4.5
                     c1.54 0 3.02.74 3.9 1.93.88-1.19 2.36-1.93 3.9-1.93
                     1.83 0 3.57 1.01 4.47 2.68.93 1.72.73 3.75-.4 5.52
                     -1.47 2.33-4.61 5.07-9.37 8.65z"
                  fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          <div>No favourites yet</div>
          <div style="font-size: 0.9rem; margin-top: 8px;">
            Click the heart icon on vehicles to save them here
          </div>
        </div>
      `;
      return;
    }

    const { byUrl } = buildMaps();

    const viewItems = favUrls.map(url => {
      const it = byUrl.get(url);
      const d  = it?.data || {};
      return {
        url,
        thumb: clean(d.thumb),
        make: clean(d.make),
        model: clean(d.model),
        edition: clean(d.edition),
        year: clean(d.year),
        mileage: clean(d.mileage),
        fuelGearbox: clean(d.fuel) && clean(d.gearbox) ? `${clean(d.fuel)} • ${clean(d.gearbox)}` : clean(d.fuelGearbox),
        priceDisplay: formatMoney(d.price),
        financeDisplay: formatMonthly(d.finance),
      };
    }).filter(x => x.url); // keep only valid

    panelBody.innerHTML = viewItems.map(it => `
      <article class="th-fav-item">
        <a href="${it.url}" class="th-fav-item-thumb" style="background-image:url('${it.thumb}')"></a>
        <div class="th-fav-item-info">
          <a href="${it.url}" class="th-fav-item-title-wrap">
            <div class="th-fav-item-title">${it.make} ${it.model}</div>
            ${it.edition ? `<div class="th-fav-item-edition">${it.edition}</div>` : ``}
          </a>

          <div class="th-fav-item-meta-row">
            <span class="th-fav-item-meta-main">
              ${[it.year, it.mileage ? `${it.mileage} miles` : ""].filter(Boolean).join(" • ")}
            </span>
          </div>

          ${it.fuelGearbox ? `
            <div class="th-fav-item-fg-row">
              <span class="th-fav-item-fg">${it.fuelGearbox}</span>
            </div>
          ` : ``}

          <div class="th-fav-item-price-row">
            <span class="th-fav-item-price">${it.priceDisplay || ""}</span>
            ${
              it.financeDisplay
                ? `<span class="th-fav-item-finance">${it.financeDisplay}</span>`
                : `<span class="th-fav-item-finance-placeholder">Contact dealer for finance</span>`
            }
          </div>

          <div class="th-fav-item-actions">
            <a href="${it.url}" class="th-fav-item-details-btn">View details</a>
            <button class="th-fav-item-remove" data-url="${it.url}">Remove</button>
          </div>
        </div>
      </article>
    `).join("");

    // IMPORTANT: we DO NOT bind remove here — your existing remove-override script
    // (tcDrawerRemoveOverrideV3) already handles .th-fav-item-remove correctly.
  }

  function refreshDrawer(){
    const favUrls = normaliseFavsToUrls();
    // keep storage as URLs so the header embed stays happy
    saveFavs(favUrls);
        // ✅ Backfill favmap from full dataset so drawer remove can delete from DB even if not rendered
    try{
      const map = loadJSON(MAP_KEY, {});
      const { byUrl } = buildMaps();

      favUrls.forEach(url => {
        const it = byUrl.get(url);
        const d  = it?.data || {};
        const vehicle_id = Number(d.id || 0) || 0;
        if (!vehicle_id) return;

        map[url] = {
          ...(map[url] || {}),
          url,
          vehicle_id,
          // optional extras (nice to have, harmless)
          make: d.make || map[url]?.make,
          model: d.model || map[url]?.model,
          edition: d.edition || map[url]?.edition,
          thumb: d.thumb || map[url]?.thumb
        };
      });

      saveJSON(MAP_KEY, map);
    }catch(e){}

    setHeaderBadge(favUrls.length);

    // only repaint if drawer exists (safe to call always)
    renderDrawerFromFavUrls(favUrls);

    // also update floating badge if you have one
    try{ window.dispatchEvent(new CustomEvent("tc:favs:drawer:refresh")); }catch(e){}
  }

  // Expose for other scripts
  window.tcRefreshFavDrawer = refreshDrawer;

  // Run after dataset exists
  (function wait(n){
    if (Array.isArray(window.__ticaryItems) && window.__ticaryItems.length){
      refreshDrawer();
      return;
    }
    if (n > 200) { refreshDrawer(); return; }
    setTimeout(()=>wait(n+1), 50);
  })(0);

  // Refresh triggers
  document.addEventListener("click", (e)=>{
    if (e.target?.closest?.(".as-fav-btn") || e.target?.closest?.("#th-fav-btn") || e.target?.closest?.(".th-fav-item-remove")){
      setTimeout(refreshDrawer, 80);
    }
  }, true);

  window.addEventListener("storage", (e)=>{
    if (e.key === FAV_KEY) refreshDrawer();
  });

  document.addEventListener("visibilitychange", ()=>{
    if (document.visibilityState === "visible") setTimeout(refreshDrawer, 120);
  });

})();

(function(){
  // TICARY — Safe favourites reconcile (prevents "drawer flicker")
  // Drop-in override for window.tcReconcileFavs
  if (window.__tcSafeReconcileV1) return;
  window.__tcSafeReconcileV1 = 1;

  const API_BASE = "https://vehicle-api-espm.onrender.com";
  const FAV_KEY  = "as:favs";     // array of URLs (drawer reads this)
  const MAP_KEY  = "as:favmap";   // url -> metadata (should include vehicle_id)

  const clean = (t)=> (t ?? "").toString().trim();

  const loadJSON = (k, fb)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }catch{ return fb; } };
  const saveJSON = (k, v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  const loadFavUrls = ()=> {
    const a = loadJSON(FAV_KEY, []);
    return Array.isArray(a) ? a.map(clean).filter(Boolean) : [];
  };

  const loadFavMap = ()=> {
    const m = loadJSON(MAP_KEY, {});
    return (m && typeof m === "object") ? m : {};
  };

  async function getTokenSafe(){
    // 1) normal supabase session
    try{
      const sb = window.sb;
      if (sb?.auth?.getSession){
        const { data, error } = await sb.auth.getSession();
        if (!error){
          const t = data?.session?.access_token;
          if (t) return t;
        }
      }
    }catch(e){}

    // 2) fallback: read stored supabase auth token directly
    try{
      const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x));
      if (k){
        const raw = localStorage.getItem(k);
        if (raw){
          const j = JSON.parse(raw);
          const t = j?.access_token || j?.currentSession?.access_token;
          if (t) return t;
        }
      }
    }catch(e){}

    return "";
  }

  async function fetchServerFavIDs(token){
    const j = await fetch(`${API_BASE}/me/favourites`, {
      headers: { Authorization: "Bearer " + token }
    }).then(r => r.ok ? r.json() : null);
    return Array.isArray(j?.vehicle_ids) ? j.vehicle_ids.map(Number).filter(n=>Number.isFinite(n)) : [];
  }

  function paintHeartsFromServerIDs(serverIDs){
    const set = new Set(serverIDs);
    const items = Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
    for (const it of items){
      const btn = it?.card?.querySelector?.(".as-fav-btn");
      if (!btn) continue;
      const vid = Number(it?.data?.id || it?.card?.dataset?.vehicleId || 0);
      if (!vid) continue;
      btn.setAttribute("aria-pressed", set.has(vid) ? "true" : "false");
    }
  }

  async function safeReconcile(){
    const token = await getTokenSafe();
    if (!token) return;

    const serverIDs = await fetchServerFavIDs(token);
    paintHeartsFromServerIDs(serverIDs);

    // Build URL set ONLY from cached favmap (don’t rely on rendered cards)
    const favMap = loadFavMap(); // url -> meta (meta.vehicle_id)
    const nextUrls = [];

    // Keep any existing URLs that we cannot verify (prevents flicker)
    const currentUrls = loadFavUrls();
    const currentSet  = new Set(currentUrls);

    // 1) Add any URL whose meta.vehicle_id is in serverIDs
    const idSet = new Set(serverIDs.map(Number));
    for (const [url, meta] of Object.entries(favMap)){
      const vid = Number(meta?.vehicle_id || meta?.vehicleId || 0);
      if (!vid) continue;
      if (idSet.has(vid)) nextUrls.push(clean(url));
    }

    // 2) Also keep existing URLs that have no meta yet (unknown vid)
    for (const url of currentSet){
      const meta = favMap[url];
      const vid = Number(meta?.vehicle_id || meta?.vehicleId || 0);
      if (!vid) nextUrls.push(url);
    }

    // De-dupe
    const finalUrls = Array.from(new Set(nextUrls)).filter(Boolean);

    saveJSON(FAV_KEY, finalUrls);

    // Re-render drawer + badge if your header exposes it
    try{ window.updateFavsPanel?.(); }catch(e){}
  }

  // Override the old reconcile (the one that was nuking as:favs)
  window.tcReconcileFavs = safeReconcile;

  // Run a couple times on load (sessions + caches can arrive late)
  setTimeout(safeReconcile, 150);
  setTimeout(safeReconcile, 900);

  // Also when auth confirms
  try{
    window.sb?.auth?.onAuthStateChange?.((ev)=>{
      if (ev === "SIGNED_IN" || ev === "TOKEN_REFRESHED"){
        setTimeout(safeReconcile, 250);
      }
    });
  }catch(e){}
})();

/* TICARY — Drawer remove ALWAYS deletes from DB (no DOM render needed) (v3 token-safe) */
(function(){
  if (window.__tcDrawerRemoveFromDatasetV3) return;
  window.__tcDrawerRemoveFromDatasetV3 = 1;

  const API = "https://vehicle-api-espm.onrender.com";
  const FAV_KEY = "as:favs";     // URLs array
  const MAP_KEY = "as:favmap";   // url -> { vehicle_id, ... } (fallback)

  const clean = (v)=> (v ?? "").toString().trim();
  const loadJSON = (k, fb)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }catch{ return fb; } };
  const saveJSON = (k, v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  // Canonicalise URLs so keys match even if query/hash differs
  function canonUrl(u){
    u = clean(u);
    if (!u) return "";
    try{
      const U = new URL(u, location.href);
      U.search = "";
      U.hash = "";
      U.pathname = U.pathname.replace(/\/+$/, "");
      return U.origin + U.pathname;
    }catch(e){
      return u.replace(/[?#].*$/, "").replace(/\/+$/, "");
    }
  }

  // ✅ Token getter aligned with your working tcFavSync code
  async function getAccessTokenSafe(){
    // 1) Try supabase-js session
    try{
      const sb = window.supabase || window._supabase || window.supabaseClient || window.sb;
      if (sb?.auth?.getSession){
        const { data, error } = await sb.auth.getSession();
        if (!error){
          const t = data?.session?.access_token;
          if (t) return t;
        }
      }
    }catch(e){}

    // 2) Fallback: read stored supabase auth token directly
    try{
      const keys = Object.keys(localStorage || {});
      const k = keys.find(x => /^sb-.*-auth-token$/.test(x));
      if (k){
        const raw = localStorage.getItem(k);
        if (raw){
          const j = JSON.parse(raw);
          const t = j?.access_token || j?.currentSession?.access_token;
          if (t) return t;
        }
      }
    }catch(e){}

    return "";
  }

  async function deleteFromNeon(vehicle_id){
    const token = await getAccessTokenSafe();
    if (!token){
      console.warn("[FAV REMOVE] No access token — cannot delete from DB");
      return false;
    }
    if (!vehicle_id) return false;

    const res = await fetch(`${API}/me/favourites/${encodeURIComponent(vehicle_id)}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    }).catch(()=>null);

    if (!res){
      console.warn("[FAV REMOVE] Network error deleting", vehicle_id);
      return false;
    }
    if (!res.ok){
      const txt = await res.text().catch(()=> "");
      console.warn("[FAV REMOVE] DB delete failed", res.status, txt || res.statusText);
      return false;
    }
    return true;
  }

  function removeLocal(url){
    const cu = canonUrl(url);
    if (!cu) return;

    const favs = loadJSON(FAV_KEY, []);
    const next = Array.isArray(favs)
      ? favs.map(clean).filter(Boolean).filter(x => canonUrl(x) !== cu)
      : [];
    saveJSON(FAV_KEY, next);

    const map = loadJSON(MAP_KEY, {});
    if (map && typeof map === "object"){
      for (const k of Object.keys(map)){
        if (canonUrl(k) === cu) delete map[k];
      }
      saveJSON(MAP_KEY, map);
    }
  }

  function lookupVehicleIdFromDataset(url){
    const cu = canonUrl(url);
    if (!cu) return 0;

    const items = Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
    for (const it of items){
      const d = it?.data || {};
      if (canonUrl(d.url) === cu){
        const vid = Number(d.id || 0) || 0;
        if (vid) return vid;
      }
    }
    return 0;
  }

  function lookupVehicleIdFromFavMap(url){
    const cu = canonUrl(url);
    if (!cu) return 0;

    const map = loadJSON(MAP_KEY, {});
    if (!map || typeof map !== "object") return 0;

    // direct + canonical scan
    const direct = map[url] || map[cu];
    const v1 = Number(direct?.vehicle_id || direct?.vehicleId || 0) || 0;
    if (v1) return v1;

    for (const [k, meta] of Object.entries(map)){
      if (canonUrl(k) === cu){
        const v2 = Number(meta?.vehicle_id || meta?.vehicleId || 0) || 0;
        if (v2) return v2;
      }
    }
    return 0;
  }

  document.addEventListener("click", async (e)=>{
    const btn = e.target?.closest?.(".th-fav-item-remove");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const favItem = btn.closest(".th-fav-item");
    const rawUrl =
      clean(btn.getAttribute("data-url")) ||
      clean(favItem?.querySelector('a[href]')?.getAttribute("href")) ||
      clean(favItem?.querySelector('a[href]')?.href);

    if (!rawUrl) return;

    // resolve id without needing main list to be rendered
    const vehicle_id =
      lookupVehicleIdFromDataset(rawUrl) ||
      lookupVehicleIdFromFavMap(rawUrl) ||
      0;

    // local UI immediately
    removeLocal(rawUrl);
    try{ favItem?.remove?.(); }catch(e){}
    try{ window.tcRefreshFavDrawer?.(); }catch(e){}
    try{ window.updateFavsPanel?.(); }catch(e){}

    // DB delete
    if (!vehicle_id){
      console.warn("[FAV REMOVE] Could not resolve vehicle_id for", rawUrl);
      return;
    }

    await deleteFromNeon(vehicle_id);

    // optional reconcile
    try{ window.tcReconcileFavs?.(); }catch(e){}
  }, true);

})();

/* TICARY — Favourites drawer opens the details popup instead of navigating (v1) */
(function(){
  if (window.__tcFavDrawerOpenPopupV1) return;
  window.__tcFavDrawerOpenPopupV1 = 1;

  const MAP_KEY = "as:favmap";
  const clean = (v)=> (v ?? "").toString().trim();
  const loadJSON = (k, fb)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }catch{ return fb; } };

  function getFromFavItem(el){
    const item = el.closest(".th-fav-item");
    if (!item) return { url:"", vehicle_id:0 };

    const url =
      clean(item.querySelector(".th-fav-item-details-btn")?.getAttribute("href")) ||
      clean(item.querySelector(".th-fav-item-title-wrap")?.getAttribute("href")) ||
      clean(item.querySelector(".th-fav-item-thumb")?.getAttribute("href")) ||
      clean(item.querySelector("a[href]")?.getAttribute("href"));

    const map = loadJSON(MAP_KEY, {});
    const vehicle_id = Number(map?.[url]?.vehicle_id || map?.[url]?.vehicleId || 0) || 0;

    return { url, vehicle_id };
  }

  function clickRenderedCardOpener({ url, vehicle_id }){
    // Prefer match by vehicle_id
    if (vehicle_id){
      const card =
        document.querySelector(`.as-card[data-vehicle-id="${vehicle_id}"]`) ||
        document.querySelector(`.as-card[data-vehicleid="${vehicle_id}"]`) ||
        document.querySelector(`.as-card[data-vehicle_id="${vehicle_id}"]`);
      if (card){
        const btn =
          card.querySelector(".as-cta") ||
          card.querySelector(".as-btn") ||
          card.querySelector('a[href*="/cars/"], a[href*="/vehicle/"], a[href*="/listing/"]');
        if (btn){ btn.click(); return true; }
      }
    }

    // Fallback match by URL
    if (url){
      const cards = Array.from(document.querySelectorAll(".as-card"));
      const hit = cards.find(c => clean(c.dataset.url) === url);
      if (hit){
        const btn = hit.querySelector(".as-cta") || hit.querySelector(".as-btn") || hit.querySelector("a");
        if (btn){ btn.click(); return true; }
      }
    }

    return false;
  }

  function openViaGlobalHook({ url, vehicle_id }){
    // If you already have a global modal opener in your system, we’ll use it if present.
    // Add aliases here if you know the real function name.
    const f =
      window.tcOpenVehicleModal ||
      window.tcOpenVehicle ||
      window.openVehicleModal ||
      window.openVehicleDetails ||
      null;

    if (typeof f === "function"){
      try{ f({ url, vehicle_id }); return true; }catch(e){}
    }

    // Event hook (lets your existing modal code listen without coupling)
    try{
      window.dispatchEvent(new CustomEvent("ticary:open-vehicle", { detail:{ url, vehicle_id } }));
      // If a listener exists, it will handle it. If not, nothing breaks.
      return true;
    }catch(e){}

    return false;
  }

  // Intercept clicks in the drawer on: thumb, title, view details
  document.addEventListener("click", function(e){
    const a = e.target?.closest?.(
      ".th-fav-item-details-btn, .th-fav-item-thumb, .th-fav-item-title-wrap"
    );
    if (!a) return;

    const { url, vehicle_id } = getFromFavItem(a);
    if (!url && !vehicle_id) return;

    e.preventDefault();
    e.stopPropagation();

    // 1) Best: click the real rendered card opener (guaranteed same popup)
    if (clickRenderedCardOpener({ url, vehicle_id })) return;

    // 2) Next: try your global modal hook / event bridge
    openViaGlobalHook({ url, vehicle_id });

    // 3) Absolute fallback: if nothing else exists, go to the URL (never dead)
    // (Delay slightly so if an event listener exists, it has a chance to open the modal)
    setTimeout(() => {
      // If no modal appeared, you can uncomment to force navigation:
      // location.href = url;
    }, 200);
  }, true);
})();

(function(){
  if (window.__tcFavDrawerOpenModalV1) return;
  window.__tcFavDrawerOpenModalV1 = 1;

  const MAP_KEY = "as:favmap";
  const clean = (v)=> (v ?? "").toString().trim();

  function loadMap(){
    try{
      const j = JSON.parse(localStorage.getItem(MAP_KEY) || "{}");
      return (j && typeof j === "object") ? j : {};
    }catch{ return {}; }
  }

  function getUrlFromClick(target){
    const item = target.closest?.(".th-fav-item");
    if (!item) return "";

    // prefer remove button data-url (you already render this)
    const rm = item.querySelector(".th-fav-item-remove[data-url]");
    if (rm?.dataset?.url) return clean(rm.dataset.url);

    // fallback to any anchor href
    const a = target.closest("a");
    return clean(a?.href || "");
  }

  document.addEventListener("click", (e)=>{
    const hit = e.target?.closest?.(
      "#th-fav-panel-body .th-fav-item-thumb, " +
      "#th-fav-panel-body .th-fav-item-details-btn, " +
      "#th-fav-panel-body .th-fav-item-title-wrap"
    );
    if (!hit) return;

    const url = getUrlFromClick(hit);
    if (!url) return;

    const map = loadMap();
    const meta = map[url] || {};
    const vid = Number(meta.vehicle_id || meta.vehicleId || 0);

    // if we have an id + modal opener, open modal and prevent navigation
    if (vid && typeof window.tcOpenDetailsModal === "function"){
      e.preventDefault();
      e.stopPropagation();
      window.tcOpenDetailsModal({ vehicle_id: vid, url });
      return;
    }

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

    // otherwise: allow normal navigation (no preventDefault)
  }, true);
})();
