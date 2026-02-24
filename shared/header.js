/* =========================================================
   TICARY — Header Logic Pack (v1)
   - header shadow on scroll
   - favourites panel + badge + full-screen toggle (mobile opens full)
   - theme toggle (tc-theme)
   - profile dropdown (Supabase session aware)
========================================================= */
(function () {
  if (window.__tcHeaderPack_v1) return;
  window.__tcHeaderPack_v1 = 1;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  }

  const $ = (s, r = document) => r.querySelector(s);

  onReady(function init() {
    // ---------------------------
    // 1) Header soft shadow on scroll
    // ---------------------------
    (function headerShadow() {
      if (window.__tcHeaderShadow_v1) return;
      window.__tcHeaderShadow_v1 = 1;

      const el = document.getElementById("tc-header");
      if (!el) return;

      const set = () => {
        el.style.boxShadow =
          window.scrollY > 6 ? "0 10px 30px rgba(0,0,0,.35)" : "none";
      };
      set();
      window.addEventListener("scroll", set, { passive: true });
    })();

    // ---------------------------
    // 2) Favourites panel
    // ---------------------------
    (function favPanel() {
      if (window.__tcFavPanel_v1) return;
      window.__tcFavPanel_v1 = 1;

      const favBtn = document.getElementById("th-fav-btn");
      if (!favBtn) return;

      const FAV_KEY = "as:favs";

      // Build panel shell (only once)
      let panel = document.querySelector(".th-fav-panel");
      let overlay = document.querySelector(".th-fav-overlay");

      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "th-fav-overlay";
        document.body.appendChild(overlay);
      }
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "th-fav-panel";
        panel.innerHTML = `
          <div class="th-fav-panel-header">
            <div class="th-fav-header-main">
              <div class="th-fav-panel-title">Favourites</div>
            </div>
            <div class="th-fav-header-actions">
              <button class="th-fav-panel-full-btn th-fav-view-toggle" type="button">See full screen</button>
              <button class="th-fav-panel-close" aria-label="Close">×</button>
            </div>
          </div>
          <div class="th-fav-panel-body" id="th-fav-panel-body">
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
              <div style="font-size:0.9rem;margin-top:8px;">Click the heart icon on vehicles to save them here</div>
            </div>
          </div>
        `;
        document.body.appendChild(panel);
      }

      const closeBtn = panel.querySelector(".th-fav-panel-close");
      const panelBody = panel.querySelector("#th-fav-panel-body");
      const fullBtn = panel.querySelector(".th-fav-panel-full-btn");
      const countBadge = document.getElementById("th-fav-count");

      // --- Storage helpers ---
      function getFavs() {
        try {
          const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
          return Array.isArray(v) ? v : [];
        } catch (_) {
          return [];
        }
      }

      function syncGlobalSet(ids) {
        if (window.__ticaryFavIDs instanceof Set) {
          const set = window.__ticaryFavIDs;
          set.clear();
          ids.forEach((id) => set.add(id));
        }
      }

      function setFavs(ids) {
        try {
          localStorage.setItem(FAV_KEY, JSON.stringify(ids));
        } catch (_) {}
        syncGlobalSet(ids);
      }

      // --- Header badge ---
      function syncHeaderFromFavs(ids) {
        const n = ids.length;
        if (countBadge) {
          countBadge.textContent = n;
          countBadge.style.display = n > 0 ? "inline-flex" : "none";
        }
        favBtn.classList.toggle("has-favs", n > 0);
      }

      // --- Formatters ---
      const formatMoney = (raw) => {
        if (!raw) return "";
        const txt = String(raw).trim();
        if (/£/.test(txt)) return txt;
        const num = Number(txt.replace(/,/g, ""));
        if (!isFinite(num)) return txt;
        return "£" + num.toLocaleString("en-GB", { maximumFractionDigits: 0 });
      };

      const formatMonthly = (raw) => {
        if (!raw) return "";
        const txt = String(raw).trim();
        if (/contact\s+dealer/i.test(txt)) return "";
        if (/£/.test(txt) && /month/i.test(txt)) return txt;

        const num = Number(txt.replace(/,/g, ""));
        if (!isFinite(num)) return "";
        const rounded = Math.round(num);
        return "£" + rounded.toLocaleString("en-GB") + " / month";
      };

      function emptyHtml(title, subtitle) {
        return `
          <div class="th-fav-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12.1 21.35c-.13 .09-.3 .09-.43 0C7.14 17.77 4 15.03 2.53 12.7
                       1.4 10.93 1.2 8.9 2.13 7.18 3.03 5.51 4.77 4.5 6.6 4.5
                       c1.54 0 3.02.74 3.9 1.93.88-1.19 2.36-1.93 3.9-1.93
                       1.83 0 3.57 1.01 4.47 2.68.93 1.72.73 3.75-.4 5.52
                       -1.47 2.33-4.61 5.07-9.37 8.65z"
                    fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>
            <div>${title}</div>
            <div style="font-size:0.9rem;margin-top:8px;">${subtitle}</div>
          </div>
        `;
      }

      // --- Render panel from fav IDs ---
      function renderPanelFromFavs(ids) {
        if (!ids || !ids.length) {
          panelBody.innerHTML = emptyHtml(
            "No favourites yet",
            "Click the heart icon on vehicles to save them here"
          );
          return;
        }

        const cards = Array.from(document.querySelectorAll(".as-card"));
        const items = cards.map((card) => ({
          url: card.dataset.url || card.querySelector("a")?.href || "",
          make: card.querySelector('[fs-list-field="make"]')?.textContent?.trim() || "",
          model: card.querySelector('[fs-list-field="model"]')?.textContent?.trim() || "",
          edition: card.querySelector('[fs-list-field="edition"]')?.textContent?.trim() || "",
          price: card.querySelector('[fs-list-field="price"]')?.textContent?.trim() || "",
          finance: card.querySelector('[fs-list-field="finance_monthly"]')?.textContent?.trim() || "",
          year: card.querySelector('[fs-list-field="year"]')?.textContent?.trim() || "",
          mileage: card.querySelector('[fs-list-field="mileage"]')?.textContent?.trim() || "",
          fuelGearbox: card.querySelector(".as-fg")?.textContent?.trim() || "",
          thumb:
            card
              .querySelector(".as-thumb")
              ?.style?.backgroundImage?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] ||
            card.querySelector("img.as-thumb")?.src ||
            "",
        }));

        const favItems = items.filter((it) => ids.includes(it.url));
        if (!favItems.length) {
          panelBody.innerHTML = emptyHtml(
            "No favourites yet on this view",
            "Scroll or change filters to see saved cars."
          );
          return;
        }

        const viewItems = favItems.map((it) => ({
          ...it,
          priceDisplay: formatMoney(it.price),
          financeDisplay: formatMonthly(it.finance),
        }));

        panelBody.innerHTML = viewItems
          .map(
            (it) => `
            <article class="th-fav-item">
              <a href="${it.url}" class="th-fav-item-thumb" style="background-image:url('${it.thumb}')" target="_blank" rel="noopener noreferrer"></a>
              <div class="th-fav-item-info">
                <a href="${it.url}" class="th-fav-item-title-wrap" target="_blank" rel="noopener noreferrer">
                  <div class="th-fav-item-title">${it.make} ${it.model}</div>
                  ${
                    it.edition
                      ? `<div class="th-fav-item-edition">${it.edition}</div>`
                      : ""
                  }
                </a>

                <div class="th-fav-item-meta-row">
                  <span class="th-fav-item-meta-main">
                    ${[it.year, it.mileage ? `${it.mileage} miles` : ""].filter(Boolean).join(" • ")}
                  </span>
                </div>

                ${
                  it.fuelGearbox
                    ? `<div class="th-fav-item-fg-row"><span class="th-fav-item-fg">${it.fuelGearbox}</span></div>`
                    : ""
                }

                <div class="th-fav-item-price-row">
                  <span class="th-fav-item-price">${it.priceDisplay}</span>
                  ${
                    it.financeDisplay
                      ? `<span class="th-fav-item-finance">${it.financeDisplay}</span>`
                      : `<span class="th-fav-item-finance-placeholder">Contact dealer for finance</span>`
                  }
                </div>

                <div class="th-fav-item-actions">
                  <a href="${it.url}" class="th-fav-item-details-btn" target="_blank" rel="noopener noreferrer">View details</a>
                  <button class="th-fav-item-remove" data-url="${it.url}">Remove</button>
                </div>
              </div>
            </article>
          `
          )
          .join("");

        // Wire remove buttons (click the REAL heart button for truth)
        panelBody.querySelectorAll(".th-fav-item-remove").forEach((btn) => {
          btn.addEventListener("click", () => {
            const url = btn.getAttribute("data-url");
            if (!url) return;

            const items = Array.isArray(window.__ticaryItems) ? window.__ticaryItems : [];
            const hit = items.find((it) => it?.data?.url === url);
            const card = hit?.card;
            if (!card) return;

            const heart = card.querySelector(".as-fav-btn");
            if (!heart) return;

            if (heart.getAttribute("aria-pressed") === "true") {
              heart.click();
            }
          });
        });
      }

      function refreshAll() {
        const ids = getFavs();
        syncHeaderFromFavs(ids);
        if (panel.classList.contains("open")) {
          renderPanelFromFavs(ids);
        }
      }

      // Fullscreen mode state
      let isFull = false;

      function openPanel() {
        panel.classList.add("open");
        overlay.classList.add("active");

        const onMobile =
          window.matchMedia && window.matchMedia("(max-width: 768px)").matches;

        if (onMobile) {
          isFull = true;
          panel.classList.add("th-fav-panel--full");
          if (fullBtn) fullBtn.textContent = "See compact";
        } else {
          isFull = false;
          panel.classList.remove("th-fav-panel--full");
          if (fullBtn) fullBtn.textContent = "See full screen";
        }

        refreshAll();
        startObserver();
      }

      function closePanel() {
        panel.classList.remove("open", "th-fav-panel--full");
        overlay.classList.remove("active");
        isFull = false;
        if (fullBtn) fullBtn.textContent = "See full screen";
        stopObserver();
      }

      favBtn.addEventListener("click", openPanel);
      closeBtn && closeBtn.addEventListener("click", closePanel);
      overlay.addEventListener("click", closePanel);

      if (fullBtn) {
        fullBtn.addEventListener("click", () => {
          isFull = !isFull;
          panel.classList.toggle("th-fav-panel--full", isFull);
          fullBtn.textContent = isFull ? "See compact" : "See full screen";
        });
      }

      // Global hook for hearts in cards
      window.updateFavsPanel = function () {
        refreshAll();
      };

      // Listen for localStorage changes (other tab)
      window.addEventListener("storage", (e) => {
        if (e.key === FAV_KEY) refreshAll();
      });

      // Keep panel in sync when listing grid changes
      let mo = null;
      let raf = 0;

      function scheduleRefresh() {
        if (!panel.classList.contains("open")) return;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          refreshAll();
        });
      }

      function findListRoot() {
        return (
          document.querySelector("#as-grid") ||
          document.querySelector(".as-grid") ||
          document.querySelector("#vehiclesList") ||
          document.querySelector(".w-dyn-items") ||
          document.querySelector('[role="list"]')
        );
      }

      function startObserver() {
        if (mo) return;

        const target = findListRoot();
        if (!target) {
          setTimeout(startObserver, 400);
          return;
        }

        mo = new MutationObserver(() => scheduleRefresh());
        mo.observe(target, { childList: true, subtree: true });
      }

      function stopObserver() {
        if (!mo) return;
        mo.disconnect();
        mo = null;
      }

      // Initial header badge
      syncHeaderFromFavs(getFavs());
      // keep global set in sync on boot too
      syncGlobalSet(getFavs());
    })();

    // ---------------------------
    // 3) Theme toggle
    // ---------------------------
    (function themeToggle() {
      if (window.__tcThemeToggle_v1) return;
      window.__tcThemeToggle_v1 = 1;

      const THEME_KEY = "tc-theme";

      function applyTheme(theme) {
        const root = document.documentElement;
        const btn = document.getElementById("th-theme-toggle");

        if (theme === "light") root.setAttribute("data-theme", "light");
        else {
          root.removeAttribute("data-theme");
          theme = "dark";
        }

        if (btn) {
          const light = theme === "light";
          btn.setAttribute(
            "aria-label",
            light ? "Switch to dark theme" : "Switch to light theme"
          );
        }
      }

      let stored = (localStorage.getItem(THEME_KEY) || "").toLowerCase();
      if (stored !== "light" && stored !== "dark") stored = "dark";
      applyTheme(stored);

      const btn = document.getElementById("th-theme-toggle");
      if (!btn) return;

      btn.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") === "light"
            ? "light"
            : "dark";
        const next = current === "light" ? "dark" : "light";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    })();

    // ---------------------------
    // 4) Profile dropdown (Supabase)
    // ---------------------------
    (function profileDropdown() {
      if (window.__tcProfileHeaderV2) return;
      window.__tcProfileHeaderV2 = 1;

      const LOGIN_URL = "/login";
      const ACCOUNT_URL = "/account";

      function hideOldAuthLinks() {
        document
          .querySelectorAll(".tc-login-link,.tc-account-link,.tc-logout-btn")
          .forEach((el) => {
            el.style.display = "none";
          });
      }

      async function waitForSB(ms = 9000) {
        const start = Date.now();
        while (Date.now() - start < ms) {
          if (
            window.sb &&
            window.sb.auth &&
            typeof window.sb.auth.getSession === "function"
          ) {
            return window.sb;
          }
          await new Promise((r) => setTimeout(r, 120));
        }
        return null;
      }

      async function getLoggedIn() {
        const sb = await waitForSB(9000);
        if (!sb) return false;
        try {
          const { data } = await sb.auth.getSession();
          return !!data?.session;
        } catch (_) {
          return false;
        }
      }

      function ensureProfileUI() {
        const header = $("#tc-header");
        const themeBtn = header && header.querySelector("#th-theme-toggle");
        if (!header || !themeBtn) return false;

        if (header.querySelector(".tc-prof-wrap")) return true;

        const wrap = document.createElement("div");
        wrap.className = "tc-prof-wrap";
        wrap.innerHTML = `
          <button class="tc-prof-btn" aria-expanded="false" type="button" aria-label="Profile">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.2 0-7.5 2.1-7.5 4.5V21h15v-2.25c0-2.4-3.3-4.5-7.5-4.5Z" fill="currentColor"/>
            </svg>
          </button>
          <div class="tc-prof-dd" role="menu" aria-label="Profile menu"></div>
        `;

        themeBtn.after(wrap);

        const btn = wrap.querySelector(".tc-prof-btn");
        const dd = wrap.querySelector(".tc-prof-dd");

        Object.assign(dd.style, {
          position: "absolute",
          right: "0",
          top: "calc(100% + 10px)",
          background: "var(--tc-head-surface, #0b0f16)",
          border: "1px solid rgba(255,255,255,.15)",
          borderRadius: "12px",
          minWidth: "180px",
          padding: "6px",
          display: "none",
          zIndex: "99999",
        });

        wrap.style.position = "relative";
        wrap.style.marginLeft = "8px";

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const open = dd.style.display === "block";
          dd.style.display = open ? "none" : "block";
          btn.setAttribute("aria-expanded", open ? "false" : "true");
        });

        document.addEventListener("click", () => {
          dd.style.display = "none";
          btn.setAttribute("aria-expanded", "false");
        });

        return true;
      }

      function setDropdownHTML(dd, loggedIn) {
        if (!dd) return;

        if (!loggedIn) {
          dd.innerHTML = `<a class="tc-prof-item" href="${LOGIN_URL}">Log in</a>`;
          return;
        }

        dd.innerHTML = `
          <a class="tc-prof-item" href="${ACCOUNT_URL}">Account</a>
          <a class="tc-prof-item tc-prof-garage" href="https://ticary.co.uk/my-garage">My Garage</a>
          <button class="tc-prof-item" type="button" id="tc-prof-logout">Log out</button>
        `;

        const out = dd.querySelector("#tc-prof-logout");
        out &&
          out.addEventListener("click", async () => {
            try {
              const sb = await waitForSB(9000);
              await sb?.auth?.signOut?.();
            } catch (_) {}
            location.reload();
          });
      }

      async function render() {
        hideOldAuthLinks();
        if (!ensureProfileUI()) return;

        const dd = document.querySelector(".tc-prof-wrap .tc-prof-dd");
        if (!dd) return;

        dd.innerHTML = `<div class="tc-prof-item tc-prof-loading">…</div>`;

        const loggedIn = await getLoggedIn();
        setDropdownHTML(dd, loggedIn);

        try {
          const sb = window.sb;
          if (sb?.auth?.onAuthStateChange) {
            sb.auth.onAuthStateChange(() => {
              setTimeout(async () => {
                const li = await getLoggedIn();
                setDropdownHTML(dd, li);
              }, 50);
            });
          }
        } catch (_) {}
      }

      render();
    })();
  });
})();

/* =========================================================
   TICARY – Search page: Inject + wire mega panels (V2)
   - waits for header/nav
   - supports .tc-header-nav .tc-nav-link
========================================================= */
(function(){
  if (window.__tcHeaderMegaV2) return;
  window.__tcHeaderMegaV2 = true;

  function init(){
    const header = document.getElementById('tc-header');
    if (!header) return false;

    // Mobile: do not inject mega panels at all
    if (window.matchMedia && window.matchMedia('(max-width: 899px)').matches){
      header.classList.remove('tc-mega-open');
      const existing = header.querySelector('.tc-mega-wrap');
      if (existing) existing.remove();
      return true;
    }

    const nav = header.querySelector('.tc-header-nav');
    if (!nav) return false;

    const links = Array.from(nav.querySelectorAll('.tc-nav-link'));
    if (!links.length) return false;

    // Don’t double-inject
    if (header.querySelector('.tc-mega-wrap')) return true;

    // Build wrap + panel
    const wrap = document.createElement('div');
    wrap.className = 'tc-mega-wrap';
    wrap.innerHTML = `
      <div class="tc-mega-panel" role="dialog" aria-label="Header menu">
        <div class="tc-mega-grid">
          <div class="tc-mega-col">
            <div class="tc-mega-title" data-col-title></div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
            <a class="tc-mega-viewall" href="#" data-viewall>View all</a>
          </div>
          <div class="tc-mega-col">
            <div class="tc-mega-title">FAQ</div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
          </div>
          <div class="tc-mega-col">
            <div class="tc-mega-title">Best picks</div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
            <div class="tc-mega-line"></div>
          </div>
        </div>
      </div>
    `;
    header.appendChild(wrap);

    const panel   = wrap.querySelector('.tc-mega-panel');
    const titleEl = wrap.querySelector('[data-col-title]');
    const viewAll = wrap.querySelector('[data-viewall]');

    let closeT = null;

    function open(name){
      header.classList.add('tc-mega-open');
      if (titleEl) titleEl.textContent = name || '';
      if (viewAll){
        viewAll.textContent = 'View all ' + String(name || '').toLowerCase();
        viewAll.setAttribute('href', '#');
      }
    }
    function close(){
      header.classList.remove('tc-mega-open');
    }
    function scheduleClose(){
      clearTimeout(closeT);
      closeT = setTimeout(close, 120);
    }
    function cancelClose(){
      clearTimeout(closeT);
    }

    links.forEach(a => {
      const name = (a.textContent || '').trim();
      a.addEventListener('mouseenter', () => { cancelClose(); open(name); });
      a.addEventListener('mouseleave', scheduleClose);
      a.addEventListener('focus', () => open(name));
      a.addEventListener('blur', scheduleClose);
    });

    panel.addEventListener('mouseenter', cancelClose);
    panel.addEventListener('mouseleave', scheduleClose);

    document.addEventListener('pointerdown', (e) => {
      if (!header.classList.contains('tc-mega-open')) return;
      if (!header.contains(e.target)) close();
    });

    return true;
  }

  function boot(){
    if (init()) return;

    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (init() || tries > 60) clearInterval(t); // ~6s max
    }, 100);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();

(function(){
  if (window.__tcMobileNavV1) return;
  window.__tcMobileNavV1 = 1;

  function qs(s,r){ return (r||document).querySelector(s); }

  function init(){
    const header = qs('#tc-header');
    if (!header) return false;

    const inner = qs('.th-inner', header) || header;
    const cta   = qs('.th-cta', header) || inner;

    // Build button (only once)
    if (!qs('.tc-mnav-btn', header)){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tc-mnav-btn';
      btn.setAttribute('aria-label','Open menu');
      btn.innerHTML = '<span class="tc-mnav-ico"><span></span></span><span>Menu</span>';
      cta.appendChild(btn);
    }

        // Build overlay + drawer (create if missing)
    let overlay = qs('.tc-mnav-overlay');
    let drawer  = qs('.tc-mnav-drawer');

    if (!overlay){
      overlay = document.createElement('div');
      overlay.className = 'tc-mnav-overlay';
      document.body.appendChild(overlay);
    }

    if (!drawer){
      drawer = document.createElement('div');
      drawer.className = 'tc-mnav-drawer';
      drawer.innerHTML = `
        <div class="tc-mnav-top">
          <div class="tc-mnav-title">MENU</div>
          <button class="tc-mnav-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="tc-mnav-links"></div>
      `;
      document.body.appendChild(drawer);

      // Populate links only once (on first create)
      const linksBox = qs('.tc-mnav-links', drawer);

      // Home at top
      const home = document.createElement('a');
      home.href = 'https://ticary.co.uk/old-home';
      home.textContent = 'Home';
      linksBox.appendChild(home);

      // Clone existing header links into drawer
      const srcLinks = header.querySelectorAll('.tc-header-nav a.tc-nav-link, .tc-header-nav a');
      srcLinks.forEach(a=>{
        const href = a.getAttribute('href') || '#';
        const txt  = (a.textContent || '').trim();
        if (!txt) return;
        // avoid duplicating Home if it already exists in nav
        if (/^home$/i.test(txt)) return;
             
        const item = document.createElement('a');
        item.href = href;
        item.textContent = txt;
        linksBox.appendChild(item);
      });
    
          // ---- Auth links (mobile only) ----
      const login = document.createElement('a');
      login.href = '/login';
      login.textContent = 'Log in';
      login.className = 'tc-login-link';
      linksBox.appendChild(login);

      const account = document.createElement('a');
      account.href = '/account';
      account.textContent = 'Account';
      account.className = 'tc-account-link';
      linksBox.appendChild(account);

      const logout = document.createElement('a');
      logout.href = '#';
      logout.textContent = 'Log out';
      logout.className = 'tc-logout-btn';
      linksBox.appendChild(logout);   
     }
    
    // Always (re)bind controls safely
    const btn   = qs('.tc-mnav-btn', header);
    const close = qs('.tc-mnav-close', drawer);

    function open(){
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
      document.documentElement.style.overflow = 'hidden';
    }
    function shut(){
      overlay.classList.remove('is-open');
      drawer.classList.remove('is-open');
      document.documentElement.style.overflow = '';
    }

    if (btn && !btn.__tcBound){
      btn.__tcBound = true;
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); open(); });
    }
    if (!overlay.__tcBound){
      overlay.__tcBound = true;
      overlay.addEventListener('click', shut);
    }
    if (close && !close.__tcBound){
      close.__tcBound = true;
      close.addEventListener('click', shut);
    }

    if (!document.__tcMnavEsc){
      document.__tcMnavEsc = true;
      document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') shut(); });
    }
    
        // ---- Set html.tc-logged-in based on Supabase session ----
    async function setAuthClass(){
      try{
        const sb = window.sb;
        if (!sb?.auth?.getSession) return;
        const { data } = await sb.auth.getSession();
        document.documentElement.classList.toggle('tc-logged-in', !!data?.session);
      }catch(e){}
    }
    setAuthClass();
    try{
      window.sb?.auth?.onAuthStateChange && window.sb.auth.onAuthStateChange(setAuthClass);
    }catch(e){}

    // ---- Logout handler (works for drawer + anywhere using .tc-logout-btn) ----
        if (!document.__tcLogoutBound){
      document.__tcLogoutBound = true;
      document.addEventListener('click', async (e)=>{
        const a = e.target?.closest?.('.tc-logout-btn');
        if (!a) return;
        e.preventDefault();
        try{ await window.sb?.auth?.signOut(); }catch(err){}
        setTimeout(()=>location.reload(), 60);
      }, true);
    }

    return true;
  }

  // Try a few times in case header loads late
  let tries = 0;
  const t = setInterval(()=>{
    tries++;
    if (init() || tries > 40) clearInterval(t);
  }, 150);
})();

(function(){
  if (window.__tcFavFieldRestoreV1) return;
  window.__tcFavFieldRestoreV1 = 1;

  const clean = (t)=> (t ?? "").toString().trim();

  function ensureHiddenField(card, field, value){
    value = clean(value);
    if (!value) return;

    let el = card.querySelector(`[fs-list-field="${field}"]`);
    if (!el){
      el = document.createElement("span");
      el.setAttribute("fs-list-field", field);
      el.style.display = "none";
      card.appendChild(el);
    }
    // keep current content in sync
    if (el.textContent !== value) el.textContent = value;
  }

  function extractYearMileage(card){
    // Try your current visible meta line (common in your builds)
    const meta = clean(card.querySelector(".as-meta-a")?.textContent);
    // Examples: "2019 • 42,000 miles" or "2019 · 42,000 miles"
    const year = (meta.match(/\b(19|20)\d{2}\b/) || [])[0] || "";
    const miles = (meta.match(/([\d,]+)\s*miles/i) || [])[1] || "";
    return { year: clean(year), mileage: clean(miles) };
  }

  function hydrateCard(card){
    if (!card || card.__tcFavHydrated) return;

    // Pull from current visible UI (adjusts to your newer card layout)
    const price =
      clean(card.querySelector(".as-price-badge")?.textContent) ||
      clean(card.querySelector(".as-price")?.textContent) ||
      clean(card.querySelector('[fs-list-field="price"]')?.textContent);

    const finance =
      clean(card.querySelector(".as-finance-inline")?.textContent) ||
      clean(card.querySelector('[fs-list-field="finance_monthly"]')?.textContent);

    const { year, mileage } = extractYearMileage(card);

    // Restore what the favourites drawer expects
    ensureHiddenField(card, "price", price);
    ensureHiddenField(card, "finance_monthly", finance);
    ensureHiddenField(card, "year", year);
    ensureHiddenField(card, "mileage", mileage);

    card.__tcFavHydrated = true;
  }

  function hydrateAll(){
    document.querySelectorAll(".as-card").forEach(hydrateCard);
  }

  // Run now + after list updates
  hydrateAll();

  const listRoot =
    document.querySelector("#as-grid") ||
    document.querySelector(".as-grid") ||
    document.querySelector("#vehiclesList") ||
    document.querySelector(".w-dyn-items") ||
    document.querySelector('[role="list"]');

  if (listRoot){
    const mo = new MutationObserver(() => {
      // clear hydration flag for new nodes only
      document.querySelectorAll(".as-card").forEach(card => {
        if (!card.__tcFavHydrated) hydrateCard(card);
      });
    });
    mo.observe(listRoot, { childList:true, subtree:true });
  }

})();
