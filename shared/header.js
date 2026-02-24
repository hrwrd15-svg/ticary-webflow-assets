(function(){
  if (window.__tcHeaderConsistentNavV1) return;
  window.__tcHeaderConsistentNavV1 = 1;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  }

  onReady(function(){
    const header = document.getElementById('tc-header');
    if (!header) return;

    // Hide desktop nav links - move everything to drawer on all devices
    const desktopNav = header.querySelector('.tc-header-nav');
    if (desktopNav) {
      desktopNav.style.display = 'none';
    }

    // Ensure hamburger button is always visible (not just mobile)
    const hamburgerBtn = header.querySelector('.tc-mnav-btn');
    if (hamburgerBtn) {
      hamburgerBtn.style.display = 'inline-flex !important';
    }
  });
})();